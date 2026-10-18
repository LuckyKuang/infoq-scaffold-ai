package cc.infoq.common.security.browser;

import cc.infoq.common.security.auth.SecurityAuthenticationException;
import cc.infoq.common.security.auth.SecurityTokenAuthentication;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.security.auth.SecurityTokenSession;
import cc.infoq.common.security.auth.SecurityTokenStore;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;

public class BrowserSessionService {
    public record Created(String handle, long maxAge) { }
    public record Restored(SecurityTokenAuthentication authentication, long remainingSeconds) { }

    private final BrowserSessionProperties properties;
    private final BrowserSessionStore store;
    private final SecurityTokenStore tokenStore;
    private final SecurityTokenService tokenService;
    private final SecureRandom random = new SecureRandom();
    private final Clock clock;

    public BrowserSessionService(BrowserSessionProperties properties, BrowserSessionStore store,
                                 SecurityTokenStore tokenStore, SecurityTokenService tokenService) {
        this(properties, store, tokenStore, tokenService, Clock.systemUTC());
    }

    BrowserSessionService(BrowserSessionProperties properties, BrowserSessionStore store,
                          SecurityTokenStore tokenStore, SecurityTokenService tokenService, Clock clock) {
        this.properties = properties;
        this.store = store;
        this.tokenStore = tokenStore;
        this.tokenService = tokenService;
        this.clock = clock;
    }

    public Created bind(SecurityTokenAuthentication authentication, String clientId, String scope, String oldHandle) {
        if (!clientId.equals(authentication.session().getClientId())) {
            throw new BrowserSessionException(401, "client_mismatch");
        }
        long now = clock.millis();
        Long tokenExpiry = authentication.session().getExpireTime();
        long expiresAt = tokenExpiry == null || tokenExpiry <= 0
            ? now + properties.getTtlSeconds() * 1000 : Math.min(tokenExpiry, now + properties.getTtlSeconds() * 1000);
        long seconds = (expiresAt - now) / 1000;
        if (seconds <= 0) {
            throw new BrowserSessionException(401, "expired");
        }
        if (validHandle(oldHandle)) {
            BrowserSessionStore.Binding old = store.find(oldHandle);
            if (old != null && scope.equals(old.getScope()) && clientId.equals(old.getClientId())
                && !authentication.tokenDigest().equals(old.getTokenDigest())) {
                tokenStore.revoke(null, old.getTokenDigest());
            }
            // A handle supplied from another scope must never revoke or delete that scope's identity.
            if (old != null && scope.equals(old.getScope()) && clientId.equals(old.getClientId())) {
                store.delete(oldHandle);
            }
        }
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String handle = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        store.save(handle, new BrowserSessionStore.Binding(authentication.tokenDigest(), clientId, scope, expiresAt),
            Duration.ofMillis(expiresAt - now));
        return new Created(handle, seconds);
    }

    public Restored restore(String handle, String clientId, String scope) {
        BrowserSessionStore.Binding binding = requireBinding(handle, clientId, scope);
        SecurityTokenSession session = tokenStore.findByDigest(binding.getTokenDigest()).orElse(null);
        if (session == null) {
            store.delete(handle);
            throw new BrowserSessionException(401, "revoked");
        }
        SecurityTokenAuthentication authentication;
        try {
            authentication = tokenService.authenticate(session.getAccessToken(), clientId);
        } catch (SecurityAuthenticationException exception) {
            store.delete(handle);
            throw new BrowserSessionException(401, "expired_or_revoked");
        }
        if (!binding.getTokenDigest().equals(authentication.tokenDigest())) {
            store.delete(handle);
            throw new BrowserSessionException(401, "inconsistent_session");
        }
        Long tokenExpiry = session.getExpireTime();
        long expiry = tokenExpiry == null || tokenExpiry <= 0 ? binding.getExpiresAt() : Math.min(binding.getExpiresAt(), tokenExpiry);
        long seconds = (expiry - clock.millis()) / 1000;
        if (seconds <= 0) {
            store.delete(handle);
            throw new BrowserSessionException(401, "expired");
        }
        return new Restored(authentication, seconds);
    }

    public Optional<SecurityTokenSession> delete(String handle, String clientId, String scope) {
        if (!validHandle(handle)) {
            return Optional.empty();
        }
        BrowserSessionStore.Binding binding = store.find(handle);
        if (binding == null) {
            return Optional.empty();
        }
        if (!scope.equals(binding.getScope())) {
            throw new BrowserSessionException(401, "scope_mismatch");
        }
        if (!clientId.equals(binding.getClientId())) {
            store.delete(handle);
            throw new BrowserSessionException(401, "client_mismatch");
        }
        Optional<SecurityTokenSession> session = tokenStore.findByDigest(binding.getTokenDigest());
        if (session.isPresent()) {
            tokenStore.revoke(session.get().getAccessToken(), binding.getTokenDigest());
        }
        store.delete(handle);
        return session;
    }

    private BrowserSessionStore.Binding requireBinding(String handle, String clientId, String scope) {
        if (!validHandle(handle)) {
            throw new BrowserSessionException(401, "missing_or_invalid_cookie");
        }
        BrowserSessionStore.Binding binding = store.find(handle);
        if (binding == null) {
            throw new BrowserSessionException(401, "missing_or_expired");
        }
        if (!scope.equals(binding.getScope())) {
            throw new BrowserSessionException(401, "scope_mismatch");
        }
        if (!clientId.equals(binding.getClientId()) || binding.getExpiresAt() <= clock.millis()) {
            store.delete(handle);
            throw new BrowserSessionException(401, "client_mismatch_or_expired");
        }
        return binding;
    }

    static boolean validHandle(String handle) {
        if (handle == null || !handle.matches("[A-Za-z0-9_-]{43}")) {
            return false;
        }
        try {
            return Base64.getUrlDecoder().decode(handle).length == 32;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }
}
