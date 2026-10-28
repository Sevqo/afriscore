import { transport, isDemo } from '../demo/transport';
import { identityHeaders } from '../accounts/auth';
import { createAuthenticatedTransport } from './authenticated-transport';
import { protectedQueries, queryIdentity, queryKey, cacheable, clearPrivateQueries, setQueryIdentity, invalidateWorkspace } from './query-cache';
export const apiFetch = createAuthenticatedTransport(transport, identityHeaders, isDemo);
export async function api(
  path: string,
  method = 'GET',
  body?: unknown,
  environment = 'sandbox',
  headers: Record<string, string> = {},
) {
  const identity = isDemo() ? {} : await identityHeaders();
  const send=async(signal?:AbortSignal)=>{
  const r = await apiFetch(path, {
    method,
    signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000),
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Environment': environment,
      ...headers,
      ...(!headers.Authorization && !headers.authorization ? identity : {}),
    },
    body: ['GET','HEAD'].includes(method) ? undefined : JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => {
    throw new Error(
      'Unable to reach AfriCore. Please try again shortly.',
    );
  });
  if (!r.ok) {
    if (r.status===401&&!headers.Authorization&&!headers.authorization) {clearPrivateQueries();window.dispatchEvent(new CustomEvent('africore:access-changed'));}
    if(r.status===403)invalidateWorkspace(path,environment);
    throw new Error(
      data.message ||
        data.issues?.map((i: { message: string }) => i.message).join(', ') ||
        data.error ||
        'Request failed',
    );
  }
  if(method!=='GET')invalidateWorkspace(path,environment);
  if(path==='/api/auth/account'&&!identity.Authorization&&data.user?.id)setQueryIdentity('legacy:'+data.user.id);
  return data;
  };
  const subject=isDemo()?'isolated-browser-demo':queryIdentity();
  return method==='GET'&&subject&&cacheable(path)&&!Object.keys(headers).length
    ? protectedQueries.read(queryKey(subject,environment,path),send):send();
}
