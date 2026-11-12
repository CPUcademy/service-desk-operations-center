package com.sdoc.sdoc.service.auth.oauth;

import com.sdoc.sdoc.api.dto.UserDataDto;

public interface OAuthProvider {
    UserDataDto fetchUserInfo(String accessToken);
    String getProviderName();

    default String exchangeAuthCodeForAccessToken(String authCode, String redirectUri) {
        throw new UnsupportedOperationException("Provider does not support auth code flow");
    }
}
