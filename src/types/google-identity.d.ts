interface GoogleTokenResponse {
  access_token: string
  error?: string
  error_description?: string
  expires_in: number
  prompt: string
  scope: string
  token_type: string
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void
}

interface GoogleTokenClientConfig {
  callback: (response: GoogleTokenResponse) => void
  client_id: string
  error_callback?: (error: { message?: string; type?: string }) => void
  scope: string
}

interface GoogleOAuth2Api {
  initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient
}

interface GoogleAccountsApi {
  oauth2: GoogleOAuth2Api
}

interface GoogleApi {
  accounts: GoogleAccountsApi
}

interface Window {
  google?: GoogleApi
}
