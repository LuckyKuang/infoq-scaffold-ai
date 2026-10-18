package cc.infoq.common.mail.utils;

import cc.infoq.common.utils.SpringUtils;
import cn.hutool.extra.mail.JakartaMail;
import cn.hutool.extra.mail.MailAccount;
import jakarta.mail.Session;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.springframework.context.support.GenericApplicationContext;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class MailUtilsTest {

    @BeforeAll
    static void initSpringContext() {
        MailAccount account = new MailAccount();
        account.setHost("smtp.example.com");
        account.setPort(465);
        account.setFrom("default@example.com");
        account.setUser("default");
        account.setPass("default-pass");

        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(MailAccount.class, () -> account);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("getMailAccount: should return configured account and allow overriding sender credentials")
    void getMailAccountShouldWork() {
        MailAccount account = MailUtils.getMailAccount();
        assertEquals("default@example.com", account.getFrom());

        MailAccount overridden = MailUtils.getMailAccount("custom@example.com", "custom-user", "custom-pass");
        assertEquals("custom@example.com", overridden.getFrom());
        assertEquals("custom-user", overridden.getUser());
        assertEquals("custom-pass", overridden.getPass());
    }

    @Test
    @DisplayName("getSession: should create session for singleton and non-singleton mode")
    void getSessionShouldWork() {
        MailAccount account = MailUtils.getMailAccount();
        account.setAuth(true);

        Session singleton = MailUtils.getSession(account, true);
        Session nonSingleton = MailUtils.getSession(account, false);

        assertNotNull(singleton);
        assertNotNull(nonSingleton);
    }

    @Test
    @DisplayName("splitAddress: should split by comma or semicolon")
    void splitAddressShouldWork() throws Exception {
        Method splitAddress = MailUtils.class.getDeclaredMethod("splitAddress", String.class);
        splitAddress.setAccessible(true);

        Object comma = splitAddress.invoke(null, "a@x.com,b@y.com");
        Object semicolon = splitAddress.invoke(null, "a@x.com;b@y.com");
        Object single = splitAddress.invoke(null, "a@x.com");

        assertEquals(List.of("a@x.com", "b@y.com"), comma);
        assertEquals(List.of("a@x.com", "b@y.com"), semicolon);
        assertEquals(List.of("a@x.com"), single);
    }

    @Test
    @DisplayName("send: should delegate to JakartaMail with global session and optional cc/bcc/image")
    void sendShouldDelegateToJakartaMailWithGlobalSession() {
        MailAccount account = MailUtils.getMailAccount();
        JakartaMail mail = Mockito.mock(JakartaMail.class, Mockito.RETURNS_SELF);

        try (MockedStatic<JakartaMail> mockedStatic = Mockito.mockStatic(JakartaMail.class)) {
            mockedStatic.when(() -> JakartaMail.create(account)).thenReturn(mail);
            Mockito.when(mail.send()).thenReturn("message-1");

            TrackCloseInputStream imageStream = new TrackCloseInputStream("img".getBytes(StandardCharsets.UTF_8));
            Map<String, InputStream> imageMap = new HashMap<>();
            imageMap.put("logo", imageStream);

            String messageId = MailUtils.send(
                "to1@example.com;to2@example.com",
                "cc@example.com",
                "bcc@example.com",
                "标题",
                "正文",
                imageMap,
                true
            );

            assertEquals("message-1", messageId);
            Mockito.verify(mail).setUseGlobalSession(true);
            Mockito.verify(mail).setTos("to1@example.com", "to2@example.com");
            Mockito.verify(mail).setCcs("cc@example.com");
            Mockito.verify(mail).setBccs("bcc@example.com");
            Mockito.verify(mail).setHtml(true);
            Mockito.verify(mail).addImage("logo", imageStream);
            Mockito.verify(mail).send();
            assertTrue(imageStream.closed);
        }
    }

    @Test
    @DisplayName("send with custom account: should use non-global session and skip cc/bcc")
    void sendWithCustomAccountShouldUseNonGlobalSession() {
        MailAccount account = new MailAccount();
        account.setHost("smtp.custom.example.com");
        account.setFrom("custom@example.com");
        account.setUser("custom");
        account.setPass("custom-pass");

        JakartaMail mail = Mockito.mock(JakartaMail.class, Mockito.RETURNS_SELF);

        try (MockedStatic<JakartaMail> mockedStatic = Mockito.mockStatic(JakartaMail.class)) {
            mockedStatic.when(() -> JakartaMail.create(account)).thenReturn(mail);
            Mockito.when(mail.send()).thenReturn("message-2");

            String messageId = MailUtils.send(account, List.of("to@example.com"), "主题", "正文", false);

            assertEquals("message-2", messageId);
            Mockito.verify(mail).setUseGlobalSession(false);
            Mockito.verify(mail, Mockito.never()).setCcs(Mockito.any(String[].class));
            Mockito.verify(mail, Mockito.never()).setBccs(Mockito.any(String[].class));
            Mockito.verify(mail).setHtml(false);
            Mockito.verify(mail).send();
        }
    }

    @Test
    @DisplayName("send overloads: should route every send/sendText/sendHtml entrypoint")
    void sendOverloadsShouldRouteAllEntrypoints() {
        MailAccount defaultAccount = MailUtils.getMailAccount();
        MailAccount customAccount = new MailAccount();
        customAccount.setHost("smtp.custom.example.com");
        customAccount.setFrom("custom@example.com");
        customAccount.setUser("custom");
        customAccount.setPass("custom-pass");

        JakartaMail defaultMail = Mockito.mock(JakartaMail.class, Mockito.RETURNS_SELF);
        JakartaMail customMail = Mockito.mock(JakartaMail.class, Mockito.RETURNS_SELF);

        try (MockedStatic<JakartaMail> mockedStatic = Mockito.mockStatic(JakartaMail.class)) {
            mockedStatic.when(() -> JakartaMail.create(defaultAccount)).thenReturn(defaultMail);
            mockedStatic.when(() -> JakartaMail.create(customAccount)).thenReturn(customMail);
            Mockito.when(defaultMail.send()).thenReturn("default-message");
            Mockito.when(customMail.send()).thenReturn("custom-message");

            assertEquals("default-message", MailUtils.sendText("to@example.com", "s1", "c1"));
            assertEquals("default-message", MailUtils.sendHtml("to@example.com", "s2", "c2"));
            assertEquals("default-message", MailUtils.send("to@example.com", "s3", "c3", false));
            assertEquals("default-message", MailUtils.send("to@example.com", "cc@example.com", "bcc@example.com", "s4", "c4", true));
            assertEquals("default-message", MailUtils.sendText(List.of("to@example.com"), "s5", "c5"));
            assertEquals("default-message", MailUtils.sendHtml(List.of("to@example.com"), "s6", "c6"));
            assertEquals("default-message", MailUtils.send(List.of("to@example.com"), "s7", "c7", false));
            assertEquals("default-message", MailUtils.send(List.of("to@example.com"), List.of("cc@example.com"), List.of("bcc@example.com"), "s8", "c8", true));

            assertEquals("custom-message", MailUtils.send(customAccount, "to@example.com", "s9", "c9", false));
            assertEquals("custom-message", MailUtils.send(customAccount, List.of("to@example.com"), "s10", "c10", true));
            assertEquals("custom-message", MailUtils.send(customAccount, List.of("to@example.com"), List.of("cc@example.com"), List.of("bcc@example.com"), "s11", "c11", false));

            assertEquals("default-message", MailUtils.sendHtml("to@example.com", "s12", "c12", singleImageMap("logo-a")));
            assertEquals("default-message", MailUtils.send("to@example.com", "s13", "c13", singleImageMap("logo-b"), false));
            assertEquals("default-message", MailUtils.send("to@example.com", "cc@example.com", "bcc@example.com", "s14", "c14", singleImageMap("logo-c"), true));
            assertEquals("default-message", MailUtils.sendHtml(List.of("to@example.com"), "s15", "c15", singleImageMap("logo-d")));
            assertEquals("default-message", MailUtils.send(List.of("to@example.com"), "s16", "c16", singleImageMap("logo-e"), false));
            assertEquals("default-message", MailUtils.send(List.of("to@example.com"), List.of("cc@example.com"), List.of("bcc@example.com"), "s17", "c17", singleImageMap("logo-f"), true));

            assertEquals("custom-message", MailUtils.send(customAccount, "to@example.com", "s18", "c18", singleImageMap("logo-g"), true));
            assertEquals("custom-message", MailUtils.send(customAccount, List.of("to@example.com"), "s19", "c19", singleImageMap("logo-h"), false));
            assertEquals("custom-message", MailUtils.send(customAccount, List.of("to@example.com"), List.of("cc@example.com"), List.of("bcc@example.com"), "s20", "c20", singleImageMap("logo-i"), true));

            Mockito.verify(defaultMail, Mockito.atLeastOnce()).setUseGlobalSession(true);
            Mockito.verify(customMail, Mockito.atLeastOnce()).setUseGlobalSession(false);
        }
    }

    private static Map<String, InputStream> singleImageMap(String key) {
        Map<String, InputStream> imageMap = new HashMap<>();
        imageMap.put(key, new ByteArrayInputStream("img".getBytes(StandardCharsets.UTF_8)));
        return imageMap;
    }

    private static class TrackCloseInputStream extends ByteArrayInputStream {

        private boolean closed;

        private TrackCloseInputStream(byte[] buf) {
            super(buf);
        }

        @Override
        public void close() throws IOException {
            super.close();
            this.closed = true;
        }
    }
}
