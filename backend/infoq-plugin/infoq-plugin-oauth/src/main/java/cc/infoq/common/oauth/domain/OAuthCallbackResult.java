package cc.infoq.common.oauth.domain;

import lombok.Data;

@Data
public class OAuthCallbackResult {

    private String clientId;

    private String redirect;

    private String browserBinding;

    private OAuthIdentityProfile profile;
}
