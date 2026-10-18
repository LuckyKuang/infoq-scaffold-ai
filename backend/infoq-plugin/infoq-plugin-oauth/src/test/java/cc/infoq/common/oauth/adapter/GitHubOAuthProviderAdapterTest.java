package cc.infoq.common.oauth.adapter;

import cc.infoq.common.oauth.config.properties.OAuthProperties;
import cc.infoq.common.oauth.domain.OAuthIdentityProfile;
import cc.infoq.common.oauth.domain.OAuthPendingSession;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@Tag("dev")
class GitHubOAuthProviderAdapterTest {

    @Test
    @DisplayName("buildAuthorizationUri: should encode multi-scope query value")
    void buildAuthorizationUriShouldEncodeMultiScopeQueryValue() {
        GitHubOAuthProviderAdapter adapter = new GitHubOAuthProviderAdapter();
        OAuthProperties.Provider provider = new OAuthProperties.Provider();
        provider.setClientId("client-id");
        provider.setClientSecret("client-secret");
        provider.setRedirectUri("https://example.com/auth/oauth/github/callback");
        provider.setScopes(List.of("read:user", "user:email"));

        OAuthPendingSession pendingSession = new OAuthPendingSession();
        pendingSession.setState("state-1");
        pendingSession.setNonce("nonce-1");
        pendingSession.setCodeChallenge("challenge-1");

        URI uri = adapter.buildAuthorizationUri(provider, pendingSession);

        assertThat(uri.toString()).contains("scope=read:user%20user:email");
        assertThat(uri.toString()).contains("redirect_uri=https://example.com/auth/oauth/github/callback");
    }

    @Test
    @DisplayName("fetchProfile: should use verified primary email endpoint")
    void fetchProfileShouldUseVerifiedPrimaryEmailEndpoint() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        GitHubOAuthProviderAdapter adapter = new GitHubOAuthProviderAdapter(builder.build());
        OAuthProperties.Provider provider = provider();
        OAuthPendingSession pendingSession = pendingSession();
        server.expect(requestTo("https://github.com/login/oauth/access_token"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{\"access_token\":\"token-1\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.github.com/user"))
            .andExpect(method(HttpMethod.GET))
            .andExpect(header("Authorization", "Bearer token-1"))
            .andRespond(withSuccess("{\"id\":123,\"login\":\"octocat\",\"name\":\"Octo\",\"email\":null,\"avatar_url\":\"https://example.com/a.png\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.github.com/user/emails"))
            .andExpect(method(HttpMethod.GET))
            .andExpect(header("Authorization", "Bearer token-1"))
            .andRespond(withSuccess("""
                [
                  {"email":"secondary@example.com","primary":false,"verified":true},
                  {"email":"primary@example.com","primary":true,"verified":true}
                ]
                """, MediaType.APPLICATION_JSON));

        OAuthIdentityProfile profile = adapter.fetchProfile(provider, pendingSession, "code-1");

        assertThat(profile.getSubject()).isEqualTo("123");
        assertThat(profile.getEmail()).isEqualTo("primary@example.com");
        assertThat(profile.getEmailVerified()).isTrue();
        server.verify();
    }

    @Test
    @DisplayName("fetchProfile: should ignore unverified primary email")
    void fetchProfileShouldIgnoreUnverifiedPrimaryEmail() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        GitHubOAuthProviderAdapter adapter = new GitHubOAuthProviderAdapter(builder.build());
        OAuthProperties.Provider provider = provider();
        OAuthPendingSession pendingSession = pendingSession();
        server.expect(requestTo("https://github.com/login/oauth/access_token"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{\"access_token\":\"token-1\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.github.com/user"))
            .andRespond(withSuccess("{\"id\":123,\"login\":\"octocat\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.github.com/user/emails"))
            .andRespond(withSuccess("[{\"email\":\"primary@example.com\",\"primary\":true,\"verified\":false}]", MediaType.APPLICATION_JSON));

        OAuthIdentityProfile profile = adapter.fetchProfile(provider, pendingSession, "code-1");

        assertThat(profile.getEmail()).isNull();
        assertThat(profile.getEmailVerified()).isFalse();
        server.verify();
    }

    private OAuthProperties.Provider provider() {
        OAuthProperties.Provider provider = new OAuthProperties.Provider();
        provider.setClientId("client-id");
        provider.setClientSecret("client-secret");
        provider.setRedirectUri("https://example.com/auth/oauth/github/callback");
        return provider;
    }

    private OAuthPendingSession pendingSession() {
        OAuthPendingSession pendingSession = new OAuthPendingSession();
        pendingSession.setCodeVerifier("verifier-1");
        return pendingSession;
    }
}
