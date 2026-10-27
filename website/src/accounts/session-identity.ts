type SessionResult = {
  data?: { user?: unknown; session?: { token?: string } | null } | null;
  error?: unknown;
};
type SessionClient = {
  getSession(options: { fetchOptions: { credentials: 'include'; headers?: Record<string,string> } }): Promise<SessionResult>;
};
// The SDK injects set-auth-jwt into session.token. Never send an opaque cookie token.
function currentJWT(token: string | undefined) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(part => !part)) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 10000;
  } catch { return false; }
}
export async function sessionIdentity(client: SessionClient): Promise<Record<string,string>> {
  let result = await client.getSession({ fetchOptions: { credentials: 'include' } });
  if (result.error) throw new Error('Unable to restore your sign-in session. Please retry.');
  if (!result.data?.user) return {};
  if (!currentJWT(result.data.session?.token)) {
    // Supported SDK force-fetch header avoids a cached expired/opaque session.
    result = await client.getSession({ fetchOptions: { credentials: 'include', headers: { 'X-Force-Fetch': 'true' } } });
    if (result.error || !result.data?.user || !currentJWT(result.data.session?.token))
      throw new Error('Your sign-in session could not be restored. Please sign in again.');
  }
  // Signature, issuer, audience, revocation and membership are verified on the server.
  return { Authorization: 'Bearer ' + result.data!.session!.token! };
}
