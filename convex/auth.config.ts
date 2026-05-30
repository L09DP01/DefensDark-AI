const clientId = process.env.WORKOS_CLIENT_ID ?? "";

const authConfig = {
  providers: clientId
    ? [
        // Custom Domain Issuers (Production)
        {
          type: "customJwt" as const,
          issuer: `https://auth.defensdark-ai.co/`,
          algorithm: "RS256" as const,
          applicationID: clientId,
          jwks: `https://auth.defensdark-ai.co/sso/jwks/${clientId}`,
        },
        {
          type: "customJwt" as const,
          issuer: `https://auth.defensdark-ai.co/user_management/${clientId}`,
          algorithm: "RS256" as const,
          jwks: `https://auth.defensdark-ai.co/sso/jwks/${clientId}`,
          applicationID: clientId,
        },
        // Standard WorkOS Issuers (Staging/Dev)
        {
          type: "customJwt" as const,
          issuer: `https://api.workos.com/`,
          algorithm: "RS256" as const,
          applicationID: clientId,
          jwks: `https://api.workos.com/sso/jwks/${clientId}`,
        },
        {
          type: "customJwt" as const,
          issuer: `https://api.workos.com/user_management/${clientId}`,
          algorithm: "RS256" as const,
          jwks: `https://api.workos.com/sso/jwks/${clientId}`,
          applicationID: clientId,
        },
        // Specific Staging URL Issuer
        {
          type: "customJwt" as const,
          issuer: `https://modest-dandelion-80-staging.authkit.app/`,
          algorithm: "RS256" as const,
          applicationID: clientId,
          jwks: `https://api.workos.com/sso/jwks/${clientId}`,
        },
      ]
    : [],
};

export default authConfig;
