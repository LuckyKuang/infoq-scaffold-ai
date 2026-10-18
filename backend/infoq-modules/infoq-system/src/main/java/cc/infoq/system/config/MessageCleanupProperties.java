package cc.infoq.system.config;

import jakarta.validation.constraints.Min;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 消息清理开关。启用后仅清理超出保留期的软删除收件记录。
 */
@Data
@Validated
@ConfigurationProperties("infoq.message.cleanup")
public class MessageCleanupProperties {

    private boolean enabled;

    @Min(1)
    private int softDeleteRetentionDays = 30;
}
