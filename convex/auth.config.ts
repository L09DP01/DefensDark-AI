const clientId = process.env.WORKOS_CLIENT_ID ?? "";

const authConfig = {
  providers: clientId
    ? [
        {
          type: "customJwt" as const,
          issuer: `https://api.workos.com/user_management/${clientId}`,
          algorithm: "RS256" as const,
          jwks: `https://api.workos.com/sso/jwks/${clientId}`,
        },
        {
          type: "customJwt" as const,
          issuer: `https://auth.defensdark-ai.co/user_management/${clientId}`,
          algorithm: "RS256" as const,
          jwks: `https://auth.defensdark-ai.co/sso/jwks/${clientId}`,
        },
        {
          type: "customJwt" as const,
          issuer: `https://auth.defensdark-ai.co/`,
          algorithm: "RS256" as const,
          jwks: `https://auth.defensdark-ai.co/sso/jwks/${clientId}`,
        },
      ]
    : [],
};

export default authConfig;
