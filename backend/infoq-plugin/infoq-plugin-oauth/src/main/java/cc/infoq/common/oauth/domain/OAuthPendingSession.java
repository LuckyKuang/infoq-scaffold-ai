package cc.infoq.common.oauth.domain;

import lombok.Data;

@Data
public class OAuthPendingSession {

    private String providerCode;

    private String clientId;

    private String redirect;

    private String state;

    private String codeVerifier;

    private String codeChallenge;

    private String nonce;

    private String browserBinding;

    private Long createdAt;
}
