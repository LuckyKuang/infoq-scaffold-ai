package cc.infoq.common.oauth.domain;

import lombok.Data;

@Data
public class OAuthCallbackRequest {

    private String code;

    private String state;

    private String error;

    private String errorDescription;
}
