package cc.infoq.common.oauth.domain;

import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
public class OAuthIdentityProfile {

    private String providerCode;

    private String providerKey;

    private String subject;

    private String unionId;

    private String openId;

    private String username;

    private String nickname;

    private String email;

    private Boolean emailVerified = false;

    private String avatar;

    private Map<String, Object> rawAttributes = new LinkedHashMap<>();
}
