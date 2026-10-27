import type { VanillaBetterAuthClient } from "@neondatabase/neon-js/auth";
import { isDemo, exitDemo } from "../demo/transport";
let clientPromise: Promise<VanillaBetterAuthClient | null> | undefined;
export function managedClient() {
  return (clientPromise ||= (async () => {
    const res = await fetch("/api/auth/config", { credentials: "same-origin" });
    if (!res.ok) throw new Error("Authentication service unavailable");
    const config = await res.json();
    if (config.provider !== "neon") return null;
    const [{ createAuthClient }, { BetterAuthVanillaAdapter }] =
      await Promise.all([
        import("@neondatabase/neon-js/auth"),
        import("@neondatabase/neon-js/auth/vanilla"),
      ]);
    return createAuthClient(config.auth_url, {
      adapter: BetterAuthVanillaAdapter({
        fetchOptions: { credentials: "include" },
      }),
    });
  })().catch((error) => {
    clientPromise = undefined;
    throw error;
  }));
}
export async function identityHeaders(): Promise<Record<string, string>> {
  const client = await managedClient();
  if (!client) return {};
  const session = await client.getSession({
    fetchOptions: { credentials: "include" },
  });
  if (!session.data?.user) return {};
  const result = await client.token({
    fetchOptions: { credentials: "include" },
  });
  if (result.error || !result.data?.token)
    throw new Error("Sign in again to refresh your session");
  return { Authorization: "Bearer " + result.data.token };
}
export async function managedSignOut(all = false) {
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
