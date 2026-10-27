import { useEffect, useRef, useState, type ReactNode } from "react";
import { BusinessApp } from "../BusinessApp";
import { api } from "../lib/api-client";
import { Logo } from "../components/Logo";
import { isDemo } from "../demo/transport";
import { types, Alert } from "./AccountUI";
import { Workspaces } from "./WorkspaceSetup";
import { AccountSettings } from "./AccountSettings";
import { FocusedWorkspace } from "./FocusedWorkspace";
import "./accounts.css";
export function AccountApp() {
  const [account, setAccount] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (isDemo()) return;
    let live = true;
    api("/api/auth/account")
      .then((a) => {
        if (live) setAccount(a);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(()=>{const changed=()=>{setAccount(null);setError('Your session or workspace permissions changed. Sign in to resolve current access.');};window.addEventListener('africore:access-changed',changed);return()=>window.removeEventListener('africore:access-changed',changed);},[]);
  if (isDemo()) return <BusinessApp />;
  if (error)
    return (
      <main className="account-entry">
        <Logo />
        <h1>Workspace unavailable</h1>
        <Alert error={error} />
        <a className="button" href="/login">
          Sign in
        </a>
      </main>
    );
  if (!account)
    return (
      <main className="account-entry" role="status">
        Loading your account…
      </main>
    );
  const path = location.pathname;
  if (path === "/app" || path === "/auth/callback") {
    const create = new URLSearchParams(location.search).get("create");
    location.replace(
      types.some((t) => t.kind === create)
        ? "/app/workspaces?create=" + create
        : account.destination,
    );
    return <p role="status">Opening your workspace…</p>;
  }
  if (path === "/app/account") return <AccountSettings account={account} />;
  if (path === "/app/workspaces") return <Workspaces account={account} />;
  const target = path.startsWith("/app/business/")
    ? account.workspaces.find(
        (w: any) => w.kind === "business" && w.id === path.split("/")[3],
      )
    : account.workspaces.find((w: any) => "/app/" + w.kind === path);
  if (!target)
    return (
      <main className="account-entry">
        <h1>Workspace access required</h1>
        <p>This address is not one of your current memberships.</p>
        <a href="/app/workspaces">View authorized workspaces</a>
      </main>
    );
  return (
    <ActiveWorkspace
      key={target.id}
      id={target.id}
      selected={account.workspace?.id === target.id}
    >
      {target.kind === "business" ? (
        <BusinessApp initialOrg={target.id} account={account} />
      ) : (
        <FocusedWorkspace
          key={target.id}
          workspace={target}
          account={account}
        />
      )}
    </ActiveWorkspace>
  );
}
function ActiveWorkspace({
  id,
  selected,
  children,
}: {
  id: string;
  selected: boolean;
  children: ReactNode;
}) {
  const [error, setError] = useState(""),
    [ready, setReady] = useState(selected);
  const visit = useRef<Promise<any> | null>(null);
  useEffect(() => {
    let live = true;
    if (selected) {
      setReady(true);
      return;
    }
    visit.current ||= api("/api/auth/account/workspace", "POST", {
      workspace_id: id,
    });
    visit.current
      .then(() => {
        if (live) setReady(true);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id, selected]);
  return error ? (
    <main className="account-entry">
      <h1>Workspace access changed</h1>
      <Alert error={error} />
      <a href="/app/workspaces">Resolve current access</a>
    </main>
  ) : !ready ? (
    <main className="account-entry" role="status">
      Opening your authorized workspace…
    </main>
  ) : (
    children
  );
}
