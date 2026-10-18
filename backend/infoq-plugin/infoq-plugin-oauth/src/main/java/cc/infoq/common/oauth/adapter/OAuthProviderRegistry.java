package cc.infoq.common.oauth.adapter;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.MessageUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class OAuthProviderRegistry {

    private final Map<String, OAuthProviderAdapter> adapters;

    public OAuthProviderRegistry(List<OAuthProviderAdapter> adapters) {
        this.adapters = new LinkedHashMap<>();
        for (OAuthProviderAdapter adapter : adapters) {
            this.adapters.put(adapter.providerCode(), adapter);
        }
    }

    public OAuthProviderAdapter requireAdapter(String providerCode) {
        OAuthProviderAdapter adapter = adapters.get(providerCode);
        if (adapter == null) {
            throw new ServiceException(MessageUtils.message("auth.oauth.provider.unsupported"));
        }
        return adapter;
    }
}
