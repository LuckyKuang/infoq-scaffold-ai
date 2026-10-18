package cc.infoq.common.oauth.support;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.MessageUtils;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class OAuthRedirectValidator {

    private static final Pattern ENCODED_BYTES = Pattern.compile("(?:%[0-9a-fA-F]{2})+");

    public static String requireSafeRelativeRedirect(String redirect) {
        if (redirect == null) {
            return "/index";
        }
        try {
            URI.create(redirect.replace(" ", "%20"));
        } catch (IllegalArgumentException e) {
            throw invalidRedirect();
        }
        String candidate = redirect;
        String path = redirect.split("[?#]", 2)[0];
        // 检查解码后的边界，但保留原始 query/hash，避免把 %26 改成新的参数。
        for (int depth = 0; depth < 8; depth++) {
            if (!candidate.startsWith("/") || path.contains("//") || candidate.contains("\\")
                || containsControl(candidate) || candidate.contains("\uFFFD") || !candidate.equals(candidate.strip())
                || Character.isSpaceChar(candidate.charAt(candidate.length() - 1)) || candidate.endsWith("\uFEFF")
                || java.util.Arrays.stream(path.split("/", -1)).anyMatch(part -> part.equals(".") || part.equals(".."))) {
                throw invalidRedirect();
            }
            String decoded = decodePercent(candidate, depth == 0);
            if (decoded.equals(candidate)) return redirect;
            path = decodePercent(path, depth == 0);
            candidate = decoded;
        }
        throw invalidRedirect();
    }

    private static String decodePercent(String value, boolean strict) {
        if (strict && Pattern.compile("%(?![0-9a-fA-F]{2})").matcher(value).find()) throw invalidRedirect();
        Matcher encoded = ENCODED_BYTES.matcher(value);
        StringBuilder decoded = new StringBuilder();
        while (encoded.find()) {
            byte[] bytes = new byte[encoded.group().length() / 3];
            for (int i = 0; i < bytes.length; i++) {
                bytes[i] = (byte) Integer.parseInt(encoded.group().substring(i * 3 + 1, i * 3 + 3), 16);
            }
            try {
                String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
                encoded.appendReplacement(decoded, Matcher.quoteReplacement(text));
            } catch (CharacterCodingException e) {
                throw invalidRedirect();
            }
        }
        encoded.appendTail(decoded);
        return decoded.toString();
    }

    private static ServiceException invalidRedirect() {
        return new ServiceException(MessageUtils.message("auth.oauth.redirect.invalid"));
    }

    private static boolean containsControl(String value) {
        for (int i = 0; i < value.length(); i++) {
            if (Character.isISOControl(value.charAt(i))) {
                return true;
            }
        }
        return false;
    }
}
