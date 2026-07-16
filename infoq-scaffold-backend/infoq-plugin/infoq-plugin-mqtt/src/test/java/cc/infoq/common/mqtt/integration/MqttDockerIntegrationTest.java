package cc.infoq.common.mqtt.integration;

import cc.infoq.common.mqtt.MqttInboundMessage;
import cc.infoq.common.mqtt.MqttProtocol;
import cc.infoq.common.mqtt.MqttProtocolStatus;
import cc.infoq.common.mqtt.MqttPublishCommand;
import cc.infoq.common.mqtt.config.MqttProperties;
import cc.infoq.common.mqtt.service.MqttClientRegistry;
import cc.infoq.common.mqtt.service.MqttPluginMonitor;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import javax.net.SocketFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.IOException;
import java.net.Socket;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@Tag("docker-it")
class MqttDockerIntegrationTest {

    private static final Duration WAIT = Duration.ofSeconds(20);
    private MqttClientRegistry registry;
    private MqttPluginMonitor monitor;
    private Probe probe;
    private LinkedBlockingQueue<MqttInboundMessage> inbound;
    private String uri;
    private String base;

    @AfterEach
    void closeClients() {
        if (probe != null) {
            probe.close();
        }
        if (registry != null) {
            registry.close();
        }
    }

    @Test
    void shouldVerifyRealTlsAclQosAndClientIdTakeover() throws Exception {
        initialize();
        verifyQos(MqttProtocol.V3_1_1, "v3");
        verifyQos(MqttProtocol.V5, "v5");
        verifyBadCredentials();
        verifyUntrustedCertificate();
        verifyDeniedTopic();
        verifyPlaintextPortIsClosed();
        verifyV3TakeoverRecovery();
    }

    private void initialize() throws Exception {
        String runId = required("INFOQ_IT_RUN_ID");
        uri = required("INFOQ_IT_MQTT_URI");
        base = "infoq/it/" + runId;
        inbound = new LinkedBlockingQueue<>();
        MqttProperties properties = new MqttProperties();
        properties.setEnabled(true);
        properties.setRequired(true);
        configure(properties.getV3(), "infoq-it-" + runId + "-v3", required("INFOQ_IT_MQTT_V3_USERNAME"),
            required("INFOQ_IT_MQTT_V3_PASSWORD"), base + "/v3/in/#");
        configure(properties.getV5(), "infoq-it-" + runId + "-v5", required("INFOQ_IT_MQTT_V5_USERNAME"),
            required("INFOQ_IT_MQTT_V5_PASSWORD"), base + "/v5/in/#");
        monitor = new MqttPluginMonitor(properties);
        registry = new MqttClientRegistry(properties, monitor, List.of(inbound::offer));
        probe = Probe.connect(uri, "probe-" + runId, required("INFOQ_IT_MQTT_PROBE_USERNAME"),
            required("INFOQ_IT_MQTT_PROBE_PASSWORD"));
        probe.subscribe(base + "/#", 2);
        assertTrue(monitor.status().protocols().get(MqttProtocol.V3_1_1).connected());
        assertTrue(monitor.status().protocols().get(MqttProtocol.V5).connected());
    }

    private void verifyQos(MqttProtocol protocol, String protocolTopic) throws Exception {
        for (int qos = 0; qos <= 2; qos++) {
            String outbound = base + "/" + protocolTopic + "/out/q" + qos;
            registry.publish(new MqttPublishCommand(protocol, outbound, new byte[]{(byte) qos}, qos, false, null));
            assertEquals(qos, probe.await(outbound).qos());
            String inboundTopic = base + "/" + protocolTopic + "/in/q" + qos;
            probe.publish(inboundTopic, new byte[]{(byte) (qos + 10)}, qos);
            MqttInboundMessage message = awaitInbound(inboundTopic);
            assertEquals(protocol, message.protocol());
            assertEquals(qos, message.qos());
        }
    }

    private void verifyBadCredentials() {
        assertThrows(MqttException.class, () -> connect("bad-password", required("INFOQ_IT_MQTT_V3_USERNAME"),
            "invalid-password", null));
    }

    private void verifyUntrustedCertificate() throws Exception {
        assertThrows(MqttException.class, () -> connect("bad-ca", required("INFOQ_IT_MQTT_V3_USERNAME"),
            required("INFOQ_IT_MQTT_V3_PASSWORD"), rejectingSocketFactory()));
    }

    private void verifyDeniedTopic() throws Exception {
        MqttAsyncClient denied = connect("denied", required("INFOQ_IT_MQTT_DENIED_USERNAME"),
            required("INFOQ_IT_MQTT_DENIED_PASSWORD"), null);
        try {
            boolean rejected = false;
            try {
                publish(denied, base + "/denied", 1);
            } catch (MqttException ex) {
                rejected = true;
            }
            assertTrue(rejected || !denied.isConnected(), "Broker must reject denied topic publish");
            assertNull(probe.poll(base + "/denied", Duration.ofSeconds(2)));
        } finally {
            close(denied);
        }
    }

    private void verifyPlaintextPortIsClosed() {
        assertThrows(IOException.class, () -> new Socket("mqtt-broker", 1883));
    }

    private void verifyV3TakeoverRecovery() throws Exception {
        MqttAsyncClient duplicate = connect("infoq-it-" + required("INFOQ_IT_RUN_ID") + "-v3",
            required("INFOQ_IT_MQTT_V3_USERNAME"), required("INFOQ_IT_MQTT_V3_PASSWORD"), null);
        try {
            awaitCondition(() -> {
                MqttProtocolStatus v3 = monitor.status().protocols().get(MqttProtocol.V3_1_1);
                return v3.connected() && v3.reconnects() >= 1;
            });
        } finally {
            close(duplicate);
        }
        String recovered = base + "/v3/in/recovered";
        probe.publish(recovered, new byte[]{1}, 1);
        assertEquals(MqttProtocol.V3_1_1, awaitInbound(recovered).protocol());
        MqttProtocolStatus v5 = monitor.status().protocols().get(MqttProtocol.V5);
        assertTrue(v5.connected());
        assertEquals(0, v5.reconnects());
    }

    private void configure(MqttProperties.ProtocolProperties properties, String clientId, String username,
                           String password, String subscription) {
        properties.setEnabled(true);
        properties.setUri(uri);
        properties.setClientId(clientId);
        properties.setUsername(username);
        properties.setPassword(password);
        properties.setTlsEnabled(true);
        properties.setQos(2);
        properties.setAutomaticReconnect(true);
        properties.setConnectTimeout(Duration.ofSeconds(10));
        properties.setCompletionTimeout(Duration.ofSeconds(10));
        properties.setSubscriptions(List.of(subscription));
    }

    private MqttInboundMessage awaitInbound(String topic) throws InterruptedException {
        long deadline = System.nanoTime() + WAIT.toNanos();
        while (System.nanoTime() < deadline) {
            MqttInboundMessage message = inbound.poll(500, TimeUnit.MILLISECONDS);
            if (message != null && topic.equals(message.topic())) {
                return message;
            }
        }
        fail("Timed out waiting for MQTT inbound topic hash=" + Integer.toHexString(topic.hashCode()));
        return null;
    }

    private void awaitCondition(Condition condition) throws Exception {
        long deadline = System.nanoTime() + WAIT.toNanos();
        while (System.nanoTime() < deadline) {
            if (condition.matches()) {
                return;
            }
            Thread.sleep(100);
        }
        fail("Timed out waiting for MQTT v3 reconnect and subscription recovery");
    }

    private MqttAsyncClient connect(String clientId, String username, String password, SocketFactory factory)
        throws MqttException {
        MqttAsyncClient client = new MqttAsyncClient(uri, clientId, new MemoryPersistence());
        MqttConnectOptions options = new MqttConnectOptions();
        options.setCleanSession(true);
        options.setConnectionTimeout(Math.toIntExact(WAIT.toSeconds()));
        options.setUserName(username);
        options.setPassword(password.toCharArray());
        if (factory != null) {
            options.setSocketFactory(factory);
        }
        try {
            client.connect(options).waitForCompletion(WAIT.toMillis());
            return client;
        } catch (MqttException ex) {
            close(client);
            throw ex;
        }
    }

    private static void publish(MqttAsyncClient client, String topic, int qos) throws MqttException {
        MqttMessage message = new MqttMessage(new byte[]{1});
        message.setQos(qos);
        client.publish(topic, message).waitForCompletion(WAIT.toMillis());
    }

    private static void close(MqttAsyncClient client) {
        try {
            if (client.isConnected()) {
                client.disconnect(WAIT.toMillis());
            }
            client.close();
        } catch (MqttException ignored) {
        }
    }

    private static SocketFactory rejectingSocketFactory() throws GeneralSecurityException {
        SSLContext context = SSLContext.getInstance("TLS");
        context.init(null, new TrustManager[]{new X509TrustManager() {
            @Override public void checkClientTrusted(X509Certificate[] c, String a) throws CertificateException {
                throw new CertificateException("untrusted");
            }
            @Override public void checkServerTrusted(X509Certificate[] c, String a) throws CertificateException {
                throw new CertificateException("untrusted");
            }
            @Override public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
        }}, new SecureRandom());
        return context.getSocketFactory();
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Missing Docker integration environment variable: " + name);
        }
        return value;
    }

    @FunctionalInterface
    private interface Condition { boolean matches() throws Exception; }

    private record ProbeMessage(String topic, int qos) { }

    private static final class Probe implements MqttCallback, AutoCloseable {
        private final MqttAsyncClient client;
        private final LinkedBlockingQueue<ProbeMessage> messages = new LinkedBlockingQueue<>();

        private Probe(MqttAsyncClient client) { this.client = client; }

        static Probe connect(String uri, String clientId, String username, String password) throws MqttException {
            MqttAsyncClient client = new MqttAsyncClient(uri, clientId, new MemoryPersistence());
            Probe probe = new Probe(client);
            client.setCallback(probe);
            MqttConnectOptions options = new MqttConnectOptions();
            options.setCleanSession(true);
            options.setUserName(username);
            options.setPassword(password.toCharArray());
            client.connect(options).waitForCompletion(WAIT.toMillis());
            return probe;
        }

        void subscribe(String topic, int qos) throws MqttException { client.subscribe(topic, qos).waitForCompletion(WAIT.toMillis()); }
        void publish(String topic, byte[] payload, int qos) throws MqttException {
            MqttMessage message = new MqttMessage(payload);
            message.setQos(qos);
            client.publish(topic, message).waitForCompletion(WAIT.toMillis());
        }
        ProbeMessage await(String topic) throws InterruptedException {
            ProbeMessage result = poll(topic, WAIT);
            assertNotNull(result, "Timed out waiting for MQTT probe topic hash=" + Integer.toHexString(topic.hashCode()));
            return result;
        }
        ProbeMessage poll(String topic, Duration timeout) throws InterruptedException {
            long deadline = System.nanoTime() + timeout.toNanos();
            while (System.nanoTime() < deadline) {
                ProbeMessage message = messages.poll(500, TimeUnit.MILLISECONDS);
                if (message != null && topic.equals(message.topic())) return message;
            }
            return null;
        }
        @Override public void connectionLost(Throwable cause) { }
        @Override public void messageArrived(String topic, MqttMessage message) { messages.offer(new ProbeMessage(topic, message.getQos())); }
        @Override public void deliveryComplete(IMqttDeliveryToken token) { }
        @Override public void close() { MqttDockerIntegrationTest.close(client); }
    }
}
