package cc.infoq.common.oauth.domain;

import lombok.Data;

import java.net.URI;

@Data
public class OAuthAuthorizationResult {

    private String providerCode;

    private String state;

    private URI authorizationUri;
}
