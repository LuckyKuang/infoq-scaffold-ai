package cc.infoq.common.mail.config;

import cc.infoq.common.mail.config.properties.MailProperties;
import cn.hutool.extra.mail.MailAccount;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class MailConfigTest {

    @Test
    @DisplayName("mailAccount: should map MailProperties to MailAccount")
    void mailAccountShouldMapMailProperties() {
        MailProperties properties = new MailProperties();
        properties.setHost("smtp.example.com");
        properties.setPort(465);
        properties.setAuth(true);
        properties.setFrom("noreply@example.com");
        properties.setUser("mailer");
        properties.setPass("secret");
        properties.setStarttlsEnable(true);
        properties.setSslEnable(true);
        properties.setTimeout(10_000L);
        properties.setConnectionTimeout(5_000L);

        MailConfig config = new MailConfig();
        MailAccount account = config.mailAccount(properties);

        assertEquals("smtp.example.com", account.getHost());
        assertEquals(465, account.getPort());
        assertTrue(account.isAuth());
        assertEquals("noreply@example.com", account.getFrom());
        assertEquals("mailer", account.getUser());
        assertEquals("secret", account.getPass());
        assertTrue(account.isStarttlsEnable());
        assertTrue(account.isSslEnable());
        assertEquals("10000", account.getSmtpProps().getProperty("mail.smtp.timeout"));
        assertEquals("5000", account.getSmtpProps().getProperty("mail.smtp.connectiontimeout"));
        assertEquals(465, account.getSocketFactoryPort());
    }
}
