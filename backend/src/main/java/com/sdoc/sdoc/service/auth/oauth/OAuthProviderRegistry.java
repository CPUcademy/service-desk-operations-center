package com.sdoc.sdoc.service.auth.oauth;

import org.springframework.stereotype.Component;
import java.util.HashMap;
import java.util.Map;

@Component
public class OAuthProviderRegistry {
    private final Map<String, OAuthProvider> providers = new HashMap<>();

    public OAuthProviderRegistry(GoogleOAuthProvider googleOAuthProvider) {
        providers.put("google", googleOAuthProvider);
    }

    public OAuthProvider getProvider(String providerName) {
        OAuthProvider provider = providers.get(providerName);
        if (provider == null)
            throw new IllegalArgumentException("OAuth provider not found: " + providerName);
        return provider;
    }
}

