const clientId = process.env.WORKOS_CLIENT_ID ?? "";

const authConfig = {
  providers: clientId
    ? [
        // Standard WorkOS Provider (handles Staging/Dev tokens natively)
        {
          domain: `https://api.workos.com/user_management/${clientId}`,
          applicationID: clientId,
        },
        // Native WorkOS Provider for custom domain
        {
          domain: `https://auth.defensdark-ai.co/user_management/${clientId}`,
          applicationID: clientId,
        },
        // Legacy custom domain without user_management prefix
        {
          domain: `https://auth.defensdark-ai.co/`,
          applicationID: clientId,
        },
      ]
    : [],
};

export default authConfig;
