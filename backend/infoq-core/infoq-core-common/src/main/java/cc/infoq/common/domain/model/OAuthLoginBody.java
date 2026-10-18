package cc.infoq.common.domain.model;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * OAuth 票据登录对象
 */
@Data
public class OAuthLoginBody {

    @NotBlank(message = "{auth.clientid.not.blank}")
    private String clientId;

    @NotBlank(message = "{auth.grant.type.not.blank}")
    private String grantType;

    @NotBlank(message = "{auth.oauth.ticket.not.blank}")
    private String loginTicket;
}
