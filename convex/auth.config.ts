const clientId = process.env.WORKOS_CLIENT_ID ?? "";
const customIssuer =
  process.env.WORKOS_ISSUER_URL ?? process.env.NEXT_PUBLIC_WORKOS_ISSUER_URL ?? "";

const providers = clientId
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
  : [];

if (customIssuer && clientId) {
  const cleanIssuer = customIssuer.endsWith("/")
    ? customIssuer.slice(0, -1)
    : customIssuer;

  providers.push({
    type: "customJwt" as const,
    issuer: customIssuer,
    algorithm: "RS256" as const,
    jwks: `${cleanIssuer}/sso/jwks/${clientId}`,
  });
}

const authConfig = {
  providers,
};

export default authConfig;
