import "server-only";

export const CONNECTION_PROVIDERS = ["asana", "slack"] as const;
export type ConnectionProvider = (typeof CONNECTION_PROVIDERS)[number];

export type OAuthProvider = {
  id: ConnectionProvider;
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  scopeParam: "scope" | "user_scope";
  clientIdEnv: string;
  clientSecretEnv: string;
  redirectPath: string;
  usePkce: boolean;
};

const providers: Record<ConnectionProvider, OAuthProvider> = {
  asana: {
    id: "asana",
    name: "Asana",
    authorizeUrl: "https://app.asana.com/-/oauth_authorize",
    tokenUrl: "https://app.asana.com/-/oauth_token",
    scopes: [
      "openid",
      "email",
      "profile",
      "users:read",
      "tasks:read",
      "projects:read",
    ],
    scopeParam: "scope",
    clientIdEnv: "ASANA_OAUTH_CLIENT_ID",
    clientSecretEnv: "ASANA_OAUTH_CLIENT_SECRET",
    redirectPath: "/api/integrations/asana/callback",
    usePkce: true,
  },
  slack: {
    id: "slack",
    name: "Slack",
    authorizeUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["channels:read", "groups:read", "im:read", "mpim:read"],
    scopeParam: "user_scope",
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
    redirectPath: "/api/integrations/slack/callback",
    usePkce: false,
  },
};

export function isConnectionProvider(
  value: string,
): value is ConnectionProvider {
  return CONNECTION_PROVIDERS.includes(value as ConnectionProvider);
}

export function getOAuthProvider(value: string): OAuthProvider | null {
  return isConnectionProvider(value) ? providers[value] : null;
}

export function providerCredentials(provider: OAuthProvider) {
  const clientId = process.env[provider.clientIdEnv]?.trim();
  const clientSecret = process.env[provider.clientSecretEnv]?.trim();
  return {
    clientId: clientId || null,
    clientSecret: clientSecret || null,
    configured: Boolean(clientId && clientSecret),
  };
}

export function providerCredentialsById(providerId: ConnectionProvider) {
  return providerCredentials(providers[providerId]);
}
