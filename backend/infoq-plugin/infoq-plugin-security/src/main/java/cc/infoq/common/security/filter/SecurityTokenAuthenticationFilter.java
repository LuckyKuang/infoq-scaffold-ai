package cc.infoq.common.security.filter;

import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.security.auth.*;
import cc.infoq.common.utils.StringUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

@Slf4j
public class SecurityTokenAuthenticationFilter extends OncePerRequestFilter {

    private final SecurityTokenResolver tokenResolver;
    private final SecurityTokenService tokenService;
    private final AuthenticationEntryPoint authenticationEntryPoint;

    public SecurityTokenAuthenticationFilter(SecurityTokenResolver tokenResolver,
                                             SecurityTokenService tokenService,
                                             AuthenticationEntryPoint authenticationEntryPoint) {
        this.tokenResolver = tokenResolver;
        this.tokenService = tokenService;
        this.authenticationEntryPoint = authenticationEntryPoint;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        Optional<SecurityResolvedToken> resolvedToken = Optional.empty();
        try {
            resolvedToken = tokenResolver.resolve(request);
            if (resolvedToken.isPresent()) {
                SecurityResolvedClientId clientId = tokenResolver.resolveClientId(request)
                    .orElseThrow(() -> new SecurityAuthenticationException("request clientId is required"));
                SecurityTokenAuthentication tokenAuthentication = tokenService.authenticate(
                    resolvedToken.get().token(),
                    clientId.clientId()
                );
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    tokenAuthentication,
                    null,
                    authorities(tokenAuthentication.loginUser())
                );
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
            filterChain.doFilter(request, response);
        } catch (SecurityAuthenticationException ex) {
            SecurityContextHolder.clearContext();
            log.warn("token authentication failed, path={}, tokenDigest={}, reason={}",
                request.getRequestURI(),
                resolvedToken.map(value -> tokenService.shortDigest(value.token())).orElse("none"),
                ex.getMessage());
            authenticationEntryPoint.commence(request, response, new BadCredentialsException(ex.getMessage(), ex));
        }
    }

    private Set<GrantedAuthority> authorities(LoginUser loginUser) {
        Set<GrantedAuthority> authorities = new HashSet<>();
        if (loginUser == null) {
            return authorities;
        }
        if (loginUser.getMenuPermission() != null) {
            loginUser.getMenuPermission().stream()
                .filter(StringUtils::isNotBlank)
                .map(SimpleGrantedAuthority::new)
                .forEach(authorities::add);
        }
        if (loginUser.getRolePermission() != null) {
            loginUser.getRolePermission().stream()
                .filter(StringUtils::isNotBlank)
                .map(role -> role.startsWith("ROLE_") ? role : "ROLE_" + role)
                .map(SimpleGrantedAuthority::new)
                .forEach(authorities::add);
        }
        return authorities;
    }

}
