import { transport, isDemo } from '../demo/transport';
import { identityHeaders } from '../accounts/auth';
import { createAuthenticatedTransport } from './authenticated-transport';
export const apiFetch = createAuthenticatedTransport(transport, identityHeaders, isDemo);
export async function api(
  path: string,
  method = 'GET',
  body?: unknown,
  environment = 'sandbox',
  headers: Record<string, string> = {},
) {
  const r = await apiFetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Environment': environment,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => {
    throw new Error(
      'Unable to reach AfriCore. Please try again shortly.',
    );
  });
  if (!r.ok)
    throw new Error(
      data.message ||
        data.issues?.map((i: { message: string }) => i.message).join(', ') ||
        data.error ||
        'Request failed',
    );
  return data;
}
