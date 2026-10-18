package cc.infoq.common.oauth.adapter;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.oauth.config.properties.OAuthProperties;
import cc.infoq.common.oauth.domain.OAuthIdentityProfile;
import cc.infoq.common.oauth.domain.OAuthPendingSession;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.StringUtils;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

abstract class AbstractOAuthProviderAdapter implements OAuthProviderAdapter {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE = new ParameterizedTypeReference<>() {
    };
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST_OF_MAP_TYPE = new ParameterizedTypeReference<>() {
    };

    private final RestClient restClient;

    protected AbstractOAuthProviderAdapter() {
        this(RestClient.builder().build());
    }

    protected AbstractOAuthProviderAdapter(RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public boolean isConfigured(OAuthProperties.Provider provider) {
        return provider != null
            && provider.hasClientSettings()
            && StringUtils.isNotBlank(resolveAuthorizeUri(provider))
            && StringUtils.isNotBlank(resolveTokenUri(provider))
            && StringUtils.isNotBlank(resolveUserInfoUri(provider));
    }

    @Override
    public URI buildAuthorizationUri(OAuthProperties.Provider provider, OAuthPendingSession pendingSession) {
        requireConfigured(provider);
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(resolveAuthorizeUri(provider))
            .queryParam("client_id", provider.getClientId())
            .queryParam("redirect_uri", provider.getRedirectUri())
            .queryParam("response_type", "code")
            .queryParam("state", pendingSession.getState());
        if (provider.getScopes() != null && !provider.getScopes().isEmpty()) {
            builder.queryParam("scope", String.join(" ", provider.getScopes()));
        }
        if (provider.isPkceEnabled() && StringUtils.isNotBlank(pendingSession.getCodeChallenge())) {
            builder.queryParam("code_challenge", pendingSession.getCodeChallenge())
                .queryParam("code_challenge_method", "S256");
        }
        if (StringUtils.isNotBlank(pendingSession.getNonce())) {
            builder.queryParam("nonce", pendingSession.getNonce());
        }
        return builder.encode().build().toUri();
    }

    protected Map<String, Object> exchangeToken(OAuthProperties.Provider provider, OAuthPendingSession pendingSession, String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", provider.getClientId());
        form.add("client_secret", provider.getClientSecret());
        form.add("code", code);
        form.add("redirect_uri", provider.getRedirectUri());
        if (provider.isPkceEnabled() && StringUtils.isNotBlank(pendingSession.getCodeVerifier())) {
            form.add("code_verifier", pendingSession.getCodeVerifier());
        }
        try {
            Map<String, Object> response = restClient.post()
                .uri(resolveTokenUri(provider))
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .accept(MediaType.APPLICATION_JSON)
                .body(form)
                .retrieve()
                .body(MAP_TYPE);
            if (response == null || StringUtils.isBlank(str(response, "access_token"))) {
                throw new ServiceException(MessageUtils.message("auth.oauth.token.exchange.failed"));
            }
            return response;
        } catch (RestClientException e) {
            throw new ServiceException(MessageUtils.message("auth.oauth.token.exchange.failed"));
        }
    }

    protected Map<String, Object> fetchUserInfo(OAuthProperties.Provider provider, String accessToken) {
        try {
            Map<String, Object> response = restClient.get()
                .uri(resolveUserInfoUri(provider))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(MAP_TYPE);
            if (response == null) {
                throw new ServiceException(MessageUtils.message("auth.oauth.userinfo.failed"));
            }
            return new LinkedHashMap<>(response);
        } catch (RestClientException e) {
            throw new ServiceException(MessageUtils.message("auth.oauth.userinfo.failed"));
        }
    }

    protected List<Map<String, Object>> fetchUserInfoList(String uri, String accessToken) {
        try {
            List<Map<String, Object>> response = restClient.get()
                .uri(uri)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(LIST_OF_MAP_TYPE);
            if (response == null) {
                throw new ServiceException(MessageUtils.message("auth.oauth.userinfo.failed"));
            }
            return new ArrayList<>(response);
        } catch (RestClientException e) {
            throw new ServiceException(MessageUtils.message("auth.oauth.userinfo.failed"));
        }
    }

    protected String str(Map<String, Object> values, String key) {
        Object value = values == null ? null : values.get(key);
        return value == null ? null : String.valueOf(value);
    }

    protected Boolean bool(Map<String, Object> values, String key) {
        Object value = values == null ? null : values.get(key);
        if (value instanceof Boolean booleanValue) {
            return booleanValue;
        }
        return value == null ? null : Boolean.valueOf(String.valueOf(value));
    }

    protected void requireSubject(OAuthIdentityProfile profile) {
        if (profile == null || StringUtils.isBlank(profile.getSubject())) {
            throw new ServiceException(MessageUtils.message("auth.oauth.subject.missing"));
        }
    }

    private void requireConfigured(OAuthProperties.Provider provider) {
        if (!isConfigured(provider)) {
            throw new ServiceException(MessageUtils.message("auth.oauth.provider.not.configured"));
        }
    }

    protected abstract String defaultAuthorizeUri();

    protected abstract String defaultTokenUri();

    protected abstract String defaultUserInfoUri();

    private String resolveAuthorizeUri(OAuthProperties.Provider provider) {
        return StringUtils.blankToDefault(provider.getAuthorizeUri(), defaultAuthorizeUri());
    }

    private String resolveTokenUri(OAuthProperties.Provider provider) {
        return StringUtils.blankToDefault(provider.getTokenUri(), defaultTokenUri());
    }

    protected String resolveUserInfoUri(OAuthProperties.Provider provider) {
        return StringUtils.blankToDefault(provider.getUserInfoUri(), defaultUserInfoUri());
    }
}
