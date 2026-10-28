import {singleFlight} from './single-flight';
import { sessionIdentity } from './session-identity';
import { setQueryIdentity, clearPrivateQueries } from '../lib/query-cache';
import { isDemo, exitDemo } from "../demo/transport";
export const managedClient=singleFlight(async () => {
    const res = await fetch("/api/auth/config", { credentials: "same-origin",signal:AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error("Authentication service unavailable");
    const config = await res.json();
    if (config.provider === "legacy") return null;
    if (config.provider !== "neon" || typeof config.auth_url !== "string") throw new Error("Authentication is not configured correctly. Contact support.");
    if (!window.isSecureContext) throw new Error("Secure sign-in requires HTTPS on this address. Use the trusted local HTTPS setup or localhost on your computer.");
    const [{ createAuthClient }, { BetterAuthVanillaAdapter }] =
      await Promise.all([
        import("@neondatabase/auth"),
        import("@neondatabase/auth/vanilla"),
      ]);
    return createAuthClient(config.auth_url, {
      adapter: BetterAuthVanillaAdapter({
        fetchOptions: { credentials: "include" },
      }),
    });
});
let identityFlight:Promise<Record<string,string>>|undefined;
let identityEpoch=0;
export async function identityHeaders(): Promise<Record<string, string>> {
  if(identityFlight)return identityFlight;
  const epoch=identityEpoch;
  const pending=(async()=>{
  const client = await managedClient();
  if (!client) return {};
  const headers=await sessionIdentity(client,(identity)=>{if(epoch===identityEpoch)setQueryIdentity(identity);});
  if(epoch!==identityEpoch)throw new Error('Your session changed. Please sign in again.');
  return headers;
  })();
  identityFlight=pending;
  try{return await pending;}finally{if(identityFlight===pending)identityFlight=undefined;}
}
export async function managedSignOut(all = false) {
  identityEpoch++;identityFlight=undefined;
  clearPrivateQueries();
  if (isDemo()) {
    exitDemo();
    return;
  }
  const client = await managedClient();
  if (client) {
    if (all) await client.revokeSessions();
    else {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await identityHeaders()),
        },
        body: "{}",
      });
      if (!response.ok) throw new Error("Session revocation failed");
    }
    await client.signOut();
  } else if (!all)
    await fetch("/api/auth/signout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
}
