type ProviderResult = {data?: any; error?: {message?: string} | null};
type Provider = {
  getSession(options: any): Promise<ProviderResult>;
  listSessions(): Promise<ProviderResult>;
  revokeSession(input: {token: string}): Promise<ProviderResult>;
  revokeOtherSessions(): Promise<ProviderResult>;
};
function checked(result: ProviderResult) {
  if (result.error) throw new Error(result.error.message || 'Session operation unavailable');
  return result.data;
}
// Opaque revocation handles stay in this closure, never in rendered records,
// storage, URLs, telemetry or application API requests.
export function providerSessions(client: Provider) {
  let handles = new Map<string, string>();
  let current: string | undefined;
  return {
    async load() {
      const identity = checked(await client.getSession({fetchOptions: {credentials: 'include', headers: {'X-Force-Fetch': 'true'}}}));
      current = identity?.session?.id;
      const rows = checked(await client.listSessions());
      if (!Array.isArray(rows)) throw new Error('Provider session list unavailable');
      handles = new Map(rows.filter(row => typeof row.id === 'string' && typeof row.token === 'string').map(row => [row.id, row.token]));
      return rows.map(row => ({id: row.id, user_agent: row.userAgent, expires_at: row.expiresAt, created_at: row.createdAt, current: current ? row.id === current : undefined, can_revoke: !!current && row.id !== current && handles.has(row.id)}));
    },
    async revoke(id: string) {
      if (!current || id === current || !handles.has(id)) throw new Error('Refresh sessions before revoking another device');
      checked(await client.revokeSession({token: handles.get(id)!}));
      handles.delete(id);
    },
    async revokeOthers() {
      if (!current) throw new Error('Current session could not be identified. Sign in again.');
      checked(await client.revokeOtherSessions());
    },
  };
}
