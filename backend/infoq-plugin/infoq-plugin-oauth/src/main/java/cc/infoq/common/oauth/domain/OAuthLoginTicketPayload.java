package cc.infoq.common.oauth.domain;

import lombok.Data;

@Data
public class OAuthLoginTicketPayload {

    private Long userId;

    private String clientId;

    private String providerCode;

    private String providerKey;

    private String providerSubject;

    private String redirect;

    private String browserBinding;

    private Long issuedAt;
}
