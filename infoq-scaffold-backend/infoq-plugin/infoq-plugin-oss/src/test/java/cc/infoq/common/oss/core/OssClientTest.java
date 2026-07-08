package cc.infoq.common.oss.core;

import cc.infoq.common.oss.entity.UploadResult;
import cc.infoq.common.oss.enums.AccessPolicyType;
import cc.infoq.common.oss.exception.OssException;
import cc.infoq.common.oss.properties.OssProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.core.async.AsyncRequestBody;
import software.amazon.awssdk.core.async.ResponsePublisher;
import software.amazon.awssdk.core.async.SdkPublisher;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.transfer.s3.S3TransferManager;
import software.amazon.awssdk.transfer.s3.model.*;

import java.io.*;
import java.lang.reflect.Field;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class OssClientTest {

    @Test
    @DisplayName("helpers: should resolve domain/url/protocol/region and policy branches")
    void helperMethodsShouldResolveBranches() {
        OssProperties properties = baseProperties();
        OssClient client = new OssClient("minio", properties);
        try {
            assertEquals("http://127.0.0.1:9000", client.getDomain());
            assertEquals("http://127.0.0.1:9000/bucket", client.getUrl());
            assertEquals("http://", client.getIsHttps());
            assertEquals(Region.US_EAST_1, client.of());
            assertEquals(AccessPolicyType.PRIVATE, client.getAccessPolicy());
            assertTrue(client.checkPropertiesSame(properties));

            properties.setDomain("minio.local");
            assertEquals("http://minio.local", client.getDomain());
            assertEquals("http://minio.local/bucket", client.getUrl());

            properties.setDomain("https://cdn.example.com");
            assertEquals("https://cdn.example.com", client.getDomain());
            assertEquals("https://cdn.example.com/bucket", client.getUrl());

            properties.setEndpoint("oss-cn-hangzhou.aliyuncs.com");
            properties.setDomain("");
            properties.setIsHttps("Y");
            properties.setRegion("ap-southeast-1");
            properties.setAccessPolicy("1");

            assertEquals("https://oss-cn-hangzhou.aliyuncs.com", client.getDomain());
            assertEquals("https://bucket.oss-cn-hangzhou.aliyuncs.com", client.getUrl());
            assertEquals("https://", client.getIsHttps());
            assertEquals(Region.of("ap-southeast-1"), client.of());
            assertEquals(AccessPolicyType.PUBLIC, client.getAccessPolicy());

            String path = client.getPath("prefix", ".png");
            assertTrue(path.startsWith("prefix/"));
            assertTrue(path.endsWith(".png"));

            String noPrefixPath = client.getPath("", ".txt");
            assertTrue(noPrefixPath.endsWith(".txt"));
            assertTrue(!noPrefixPath.startsWith("/"));

            String full = client.getUrl() + "/a/b/file.txt";
            assertEquals("a/b/file.txt", client.removeBaseUrl(full));
        } finally {
            closeClient(client);
        }
    }

    @Test
    @DisplayName("presign: should create presigned get/put urls without remote call")
    void presignedUrlCreationShouldWork() {
        OssProperties properties = baseProperties();
        OssClient client = new OssClient("minio", properties);
        try {
            String getUrl = client.createPresignedGetUrl("demo/file.txt", Duration.ofMinutes(5));
            Map<String, String> metadata = new HashMap<>();
            metadata.put("k", "v");
            String putUrl = client.createPresignedPutUrl("demo/upload.bin", Duration.ofMinutes(5), metadata);

            assertNotNull(getUrl);
            assertNotNull(putUrl);
            assertTrue(getUrl.contains("demo%2Ffile.txt") || getUrl.contains("demo/file.txt"));
            assertTrue(putUrl.contains("demo%2Fupload.bin") || putUrl.contains("demo/upload.bin"));
        } finally {
            closeClient(client);
        }
    }

    @Test
    @DisplayName("upload(path): should return upload result and delete temp file")
    void uploadPathShouldReturnResultAndDeleteTempFile() throws Exception {
        OssClient client = new OssClient("minio", baseProperties());
        S3TransferManager transferManager = Mockito.mock(S3TransferManager.class);
        FileUpload fileUpload = Mockito.mock(FileUpload.class);
        CompletedFileUpload completed = CompletedFileUpload.builder()
            .response(PutObjectResponse.builder().eTag("etag-path").build())
            .build();
        when(transferManager.uploadFile(Mockito.<Consumer<UploadFileRequest.Builder>>any())).thenAnswer(invocation -> {
            Consumer<UploadFileRequest.Builder> consumer = invocation.getArgument(0);
            UploadFileRequest.Builder builder = UploadFileRequest.builder();
            consumer.accept(builder);
            builder.build();
            return fileUpload;
        });
        when(fileUpload.completionFuture()).thenReturn(CompletableFuture.completedFuture(completed));
        setField(client, "transferManager", transferManager);

        Path tempFile = Files.createTempFile("oss-upload", ".txt");
        Files.writeString(tempFile, "payload");
        UploadResult result;
        try {
            result = client.upload(tempFile, "dir/demo.txt", "md5", "text/plain");
        } finally {
            closeClient(client);
        }

        assertEquals("dir/demo.txt", result.getFilename());
        assertTrue(result.getUrl().endsWith("/dir/demo.txt"));
        assertFalse(Files.exists(tempFile));
    }

    @Test
    @DisplayName("upload(path): should wrap exception and still delete temp file")
    void uploadPathShouldWrapExceptionAndDeleteFile() throws Exception {
        OssClient client = new OssClient("minio", baseProperties());
        S3TransferManager transferManager = Mockito.mock(S3TransferManager.class);
        doThrow(new RuntimeException("upload fail"))
            .when(transferManager)
            .uploadFile(Mockito.<Consumer<UploadFileRequest.Builder>>any());
        setField(client, "transferManager", transferManager);

        Path tempFile = Files.createTempFile("oss-upload-fail", ".txt");
        Files.writeString(tempFile, "payload");
        try {
            assertThrows(OssException.class, () -> client.upload(tempFile, "dir/demo.txt", null, "text/plain"));
        } finally {
            closeClient(client);
        }
        assertFalse(Files.exists(tempFile));
    }

    @Test
    @DisplayName("upload(stream): should wrap exception when transfer layer fails early")
    void uploadStreamShouldWrapException() throws Exception {
        OssClient failedClient = new OssClient("minio", baseProperties());
        S3TransferManager failedTransferManager = Mockito.mock(S3TransferManager.class);
        doThrow(new RuntimeException("stream fail"))
            .when(failedTransferManager)
            .upload(Mockito.<Consumer<UploadRequest.Builder>>any());
        setField(failedClient, "transferManager", failedTransferManager);
        try {
            assertThrows(OssException.class,
                () -> failedClient.upload(new BufferedInputStream(new ByteArrayInputStream("x".getBytes(StandardCharsets.UTF_8))), "k", 1L, "text/plain"));
        } finally {
            closeClient(failedClient);
        }
    }

    @Test
    @DisplayName("upload(stream) lambdas: should configure put/upload request builders with replayable body")
    void uploadStreamLambdasShouldConfigureBuilders() {
        OssClient client = new OssClient("minio", baseProperties());
        try {
            PutObjectRequest.Builder putBuilder = PutObjectRequest.builder();
            ReflectionTestUtils.invokeMethod(client, "lambda$upload$2", "dir/stream.txt", "text/plain", putBuilder);
            PutObjectRequest putRequest = putBuilder.build();
            assertEquals("bucket", putRequest.bucket());
            assertEquals("dir/stream.txt", putRequest.key());
            assertEquals("text/plain", putRequest.contentType());

            AsyncRequestBody body = AsyncRequestBody.fromBytes("abc".getBytes(StandardCharsets.UTF_8));
            UploadRequest.Builder uploadBuilder = UploadRequest.builder();
            ReflectionTestUtils.invokeMethod(client, "lambda$upload$3", body, "dir/stream.txt", "text/plain", uploadBuilder);
            UploadRequest uploadRequest = uploadBuilder.build();
            assertNotNull(uploadRequest.requestBody());
            assertEquals(3L, uploadRequest.requestBody().contentLength().orElseThrow());
            assertFalse(uploadRequest.requestBody().getClass().getName().contains("BlockingInputStream"));
            assertNotNull(uploadRequest.putObjectRequest());
            assertEquals("dir/stream.txt", uploadRequest.putObjectRequest().key());
        } finally {
            closeClient(client);
        }
    }

    @Test
    @DisplayName("upload(stream): should create replayable request body for sdk retries")
    void uploadStreamShouldUseReplayableRequestBody() throws Exception {
        OssClient client = new OssClient("minio", baseProperties());
        S3TransferManager transferManager = Mockito.mock(S3TransferManager.class);
        Upload upload = Mockito.mock(Upload.class);
        CompletedUpload completed = CompletedUpload.builder()
            .response(PutObjectResponse.builder().eTag("etag-stream").build())
            .build();
        when(transferManager.upload(Mockito.<Consumer<UploadRequest.Builder>>any())).thenAnswer(invocation -> {
            Consumer<UploadRequest.Builder> consumer = invocation.getArgument(0);
            UploadRequest.Builder builder = UploadRequest.builder();
            consumer.accept(builder);
            UploadRequest uploadRequest = builder.build();
            assertEquals("dir/stream.txt", uploadRequest.putObjectRequest().key());
            assertEquals("text/plain", uploadRequest.putObjectRequest().contentType());
            assertEquals(3L, uploadRequest.requestBody().contentLength().orElseThrow());
            assertFalse(uploadRequest.requestBody().getClass().getName().contains("BlockingInputStream"));
            return upload;
        });
        when(upload.completionFuture()).thenReturn(CompletableFuture.completedFuture(completed));
        setField(client, "transferManager", transferManager);
        try {
            UploadResult result = client.upload(
                new BufferedInputStream(new ByteArrayInputStream("abc".getBytes(StandardCharsets.UTF_8))),
                "dir/stream.txt",
                3L,
                "text/plain");

            assertEquals("dir/stream.txt", result.getFilename());
            assertTrue(result.getUrl().endsWith("/dir/stream.txt"));
        } finally {
            closeClient(client);
        }
    }

    @Test
    @DisplayName("uploadSuffix: should delegate to upload overloads")
    void uploadSuffixShouldDelegateToUploadMethods() throws Exception {
        OssClient spyClient = Mockito.spy(new OssClient("minio", baseProperties()));
        UploadResult expected = UploadResult.builder()
            .url("http://fake/path")
            .filename("fake.txt")
            .eTag("etag")
            .build();
        try {
            doReturn(expected).when(spyClient)
                .upload(any(InputStream.class), any(String.class), eq(3L), eq("text/plain"));
            assertEquals(expected, spyClient.uploadSuffix("abc".getBytes(StandardCharsets.UTF_8), ".txt", "text/plain"));

            doReturn(expected).when(spyClient)
                .upload(any(InputStream.class), any(String.class), eq(2L), eq("text/plain"));
            assertEquals(expected,
                spyClient.uploadSuffix(new ByteArrayInputStream("ab".getBytes(StandardCharsets.UTF_8)), ".txt", 2L, "text/plain"));

            Path temp = Files.createTempFile("oss-upload-suffix", ".txt");
            Files.writeString(temp, "suffix");
            doReturn(expected).when(spyClient)
                .upload(eq(temp), any(String.class), nullable(String.class), eq("text/plain"));
            assertEquals(expected, spyClient.uploadSuffix(temp.toFile(), ".txt"));
            Files.deleteIfExists(temp);
        } finally {
            closeClient(spyClient);
        }
    }

    @Test
    @DisplayName("download: should write bytes and invoke content-length consumer")
    void downloadShouldWriteBytesAndInvokeLengthConsumer() throws Exception {
        OssClient client = new OssClient("minio", baseProperties());
        S3TransferManager transferManager = Mockito.mock(S3TransferManager.class);
        when(transferManager.download(anyDownloadRequest())).thenAnswer(invocation -> {
            Download<?> eachDownload = Mockito.mock(Download.class);
            ResponsePublisher<GetObjectResponse> publisher = new ResponsePublisher<>(
                GetObjectResponse.builder().contentLength(5L).build(),
                SdkPublisher.fromIterable(List.of(ByteBuffer.wrap("hello".getBytes(StandardCharsets.UTF_8))))
            );
            CompletedDownload<ResponsePublisher<GetObjectResponse>> completedDownload = CompletedDownload.builder()
                .result(publisher)
                .build();
            doReturn(CompletableFuture.completedFuture(completedDownload)).when(eachDownload).completionFuture();
            return eachDownload;
        });
        setField(client, "transferManager", transferManager);

        try {
            AtomicLong contentLength = new AtomicLong();
            WriteOutSubscriber<OutputStream> subscriber = client.download("dir/file.txt", contentLength::set);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            subscriber.writeTo(out);
            assertEquals(5L, contentLength.get());
            assertEquals("hello", out.toString(StandardCharsets.UTF_8));

            AtomicLong wrapperLength = new AtomicLong();
            ByteArrayOutputStream wrapperOut = new ByteArrayOutputStream();
            client.download("dir/file.txt", wrapperOut, wrapperLength::set);
            assertEquals(5L, wrapperLength.get());
            assertEquals("hello", wrapperOut.toString(StandardCharsets.UTF_8));
        } finally {
            closeClient(client);
        }
    }

    @Test
    @DisplayName("download wrapper/getObjectContent/delete: should cover exception and object IO branches")
    void downloadWrapperAndObjectContentAndDeleteShouldCoverBranches() throws Exception {
        OssClient spyClient = Mockito.spy(new OssClient("minio", baseProperties()));
        try {
            doThrow(new RuntimeException("download fail"))
                .when(spyClient)
                .download(eq("dir/file.txt"), nullConsumer());
            assertThrows(OssException.class,
                () -> spyClient.download("dir/file.txt", new ByteArrayOutputStream(), null));

            Path temp = Files.createTempFile("oss-object", ".txt");
            Files.writeString(temp, "content");
            doReturn(temp).when(spyClient).fileDownload("dir/object.txt");
            try (InputStream inputStream = spyClient.getObjectContent("dir/object.txt")) {
                assertEquals("content", new String(inputStream.readAllBytes(), StandardCharsets.UTF_8));
            }
            assertFalse(Files.exists(temp));
        } finally {
            closeClient(spyClient);
        }

        OssClient deleteClient = new OssClient("minio", baseProperties());
        S3AsyncClient s3Client = Mockito.mock(S3AsyncClient.class);
        when(s3Client.deleteObject(Mockito.<Consumer<DeleteObjectRequest.Builder>>any())).thenAnswer(invocation -> {
            Consumer<DeleteObjectRequest.Builder> consumer = invocation.getArgument(0);
            DeleteObjectRequest.Builder builder = DeleteObjectRequest.builder();
            consumer.accept(builder);
            builder.build();
            return CompletableFuture.completedFuture(null);
        });
        setField(deleteClient, "client", s3Client);
        try {
            deleteClient.delete(deleteClient.getUrl() + "/dir/a.txt");
            verify(s3Client).deleteObject(Mockito.<Consumer<DeleteObjectRequest.Builder>>any());
        } finally {
            closeClient(deleteClient);
        }

        OssClient failedDeleteClient = new OssClient("minio", baseProperties());
        S3AsyncClient failedS3Client = Mockito.mock(S3AsyncClient.class);
        doThrow(new RuntimeException("delete fail"))
            .when(failedS3Client)
            .deleteObject(Mockito.<Consumer<DeleteObjectRequest.Builder>>any());
        setField(failedDeleteClient, "client", failedS3Client);
        try {
            assertThrows(OssException.class, () -> failedDeleteClient.delete("dir/a.txt"));
        } finally {
            closeClient(failedDeleteClient);
        }
    }

    @Test
    @DisplayName("fileDownload/getConfigKey: should create temp file path and expose config key")
    void fileDownloadAndConfigKeyShouldWork() throws Exception {
        OssClient client = new OssClient("minio", baseProperties());
        S3TransferManager transferManager = Mockito.mock(S3TransferManager.class);
        FileDownload fileDownload = Mockito.mock(FileDownload.class);
        when(transferManager.downloadFile(Mockito.<Consumer<DownloadFileRequest.Builder>>any())).thenAnswer(invocation -> {
            Consumer<DownloadFileRequest.Builder> consumer = invocation.getArgument(0);
            DownloadFileRequest.Builder builder = DownloadFileRequest.builder();
            consumer.accept(builder);
            builder.build();
            return fileDownload;
        });
        when(fileDownload.completionFuture())
            .thenReturn(CompletableFuture.completedFuture(Mockito.mock(CompletedFileDownload.class)));
        setField(client, "transferManager", transferManager);

        Path downloaded = client.fileDownload(client.getUrl() + "/dir/a.txt");
        try {
            assertNotNull(downloaded);
            assertTrue(Files.exists(downloaded));
            assertEquals("minio", client.getConfigKey());
        } finally {
            Files.deleteIfExists(downloaded);
            closeClient(client);
        }
    }

    @Test
    @DisplayName("constructor: should throw OssException when endpoint is invalid")
    void constructorShouldThrowOnInvalidEndpoint() {
        OssProperties properties = baseProperties();
        properties.setEndpoint("://bad endpoint");
        assertThrows(OssException.class, () -> new OssClient("bad", properties));
    }

    private static OssProperties baseProperties() {
        OssProperties properties = new OssProperties();
        properties.setEndpoint("127.0.0.1:9000");
        properties.setDomain("");
        properties.setPrefix("p");
        properties.setAccessKey("ak");
        properties.setSecretKey("sk");
        properties.setBucketName("bucket");
        properties.setRegion("");
        properties.setIsHttps("N");
        properties.setAccessPolicy("0");
        return properties;
    }

    private static void setField(OssClient client, String fieldName, Object value) {
        try {
            Field field = OssClient.class.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(client, value);
        } catch (Exception e) {
            throw new AssertionError("failed to set field: " + fieldName, e);
        }
    }

    private static void closeClient(OssClient client) {
        closeField(client, "transferManager");
        closeField(client, "client");
        closeField(client, "presigner");
    }

    private static void closeField(OssClient client, String fieldName) {
        try {
            Field field = OssClient.class.getDeclaredField(fieldName);
            field.setAccessible(true);
            Object value = field.get(client);
            if (value instanceof AutoCloseable closeable) {
                closeable.close();
            }
        } catch (Exception ignored) {
            // best-effort cleanup for sdk resources
        }
    }

    private static <T> DownloadRequest<T> anyDownloadRequest() {
        return any();
    }

    private static <T> Consumer<T> nullConsumer() {
        return isNull();
    }
}
