import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api-client";
import {Overlay} from "../components/Overlay";
import { Logo } from "../components/Logo";
import { managedClient, managedSignOut } from "./auth";
import {providerSessions} from "./security-sessions";
import {describeSession,sessionDate} from "./session-presentation";
import {changeAccountPassword} from "./security-password";
import {PasswordInput} from "./PasswordInput";
import { types, Field, Alert, Currency } from "./AccountUI";
export function AccountSettings({ account }: { account: any }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoaded,setSessionsLoaded]=useState(false),[confirmAll,setConfirmAll]=useState(false);
  const applicationRevoked=useRef(false);
  const sessionController=useRef<ReturnType<typeof providerSessions>|null>(null);
  const [sessionRevision,setSessionRevision]=useState(0),[confirmRevoke,setConfirmRevoke]=useState<string|null>(null);
  useEffect(() => {
    let live = true;
    setSessionsLoaded(false);sessionController.current=null;
    (async()=>{const client=await managedClient();if(client){const controller=providerSessions(client);const data=await controller.load();if(live)sessionController.current=controller;return {data};}return api("/api/auth/sessions");})()
      .then((r) => {
        if (live) {setSessions(r.data);setSessionsLoaded(true);}
      })
      .catch((e) => {
        if (live) {setError(e.message);setSessionsLoaded(true);}
      });
    return () => {
      live = false;
    };
  }, [sessionRevision]);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function action(fn: () => Promise<any>, message: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-entry security-center">
      <Logo />
      <a href="/app/workspaces">All workspaces</a>
      <h1>Account & security</h1>
      <Alert error={error} />
        <p>Account defaults apply to new workspaces. Existing workspaces retain their own currency and timezone.</p>
      <p>
        {account.user.email} ·{" "}
        {account.user.verified
          ? "Email verified"
          : "Email verification pending"}
      </p>
      <form
        className="account-form"
        onSubmit={(e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.currentTarget));
          action(
            () => api("/api/auth/account", "PATCH", d),
            "Preferences saved. Permissions remain based on your memberships.",
          );
        }}
      >
        <Field label="Display name">
          <input
            name="display_name"
            defaultValue={account.profile?.display_name || ""}
            required
          />
        </Field>
        <Field label="Default currency">
          <Currency
            name="currency"
            defaultValue={account.profile?.currency || "KES"}
          />
        </Field>
        <Field label="Timezone">
          <input
            name="timezone"
            defaultValue={account.profile?.timezone || "Africa/Nairobi"}
            required
          />
        </Field>
        <Field label="Preferred experience">
          <select
            name="primary_experience"
            defaultValue={account.profile?.primary_experience || "business"}
          >
            {types.map((t) => (
              <option value={t.kind} key={t.kind}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
        <button className="button" disabled={busy}>
          Save preferences
        </button>
      </form>
      <form
        className="account-form"
        onSubmit={(e) => {
          e.preventDefault();
          const email = String(new FormData(e.currentTarget).get("email"));
          action(async () => {
            const client = await managedClient();
            if (!client)
              throw new Error(
                "Email changes require the managed authentication provider.",
              );
            const result = await client.changeEmail({
              newEmail: email,
              callbackURL: location.origin + "/auth/callback",
            });
            if (result.error)
              throw new Error(
                result.error.message || "Email change unavailable",
              );
          }, "Check your email to confirm the address change.");
        }}
      >
        <h2>Change email</h2>
        <Field label="New email address">
          <input type="email" name="email" required autoComplete="email" />
        </Field>
        <button className="secondary-button" disabled={busy}>
          Request email change
        </button>
        <p>
          Confirmation follows the configured provider policy. An address change
          never adds workspace permissions.
        </p>
      </form>
      <section className="account-form" aria-labelledby="security-overview"><h2 id="security-overview">Security overview</h2><p>{account.user.verified?'Your email is verified.':'Your email needs verification.'} Review active sessions and keep your recovery email accessible.</p><dl className="security-facts"><div><dt>Email</dt><dd>{account.user.verified?'Verified':'Verification pending'}</dd></div><div><dt>Active sessions</dt><dd>{sessionsLoaded?sessions.length:'Loading…'}</dd></div><div><dt>Two-factor authentication</dt><dd>Unavailable with the current managed provider</dd></div></dl></section>
      <form className="account-form" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);const form=e.currentTarget;action(async()=>{await changeAccountPassword(await managedClient(),String(d.get('current_password')),String(d.get('password')),String(d.get('confirm_password')));form.reset();},'Password changed. Other provider sessions were revoked. Previously issued API tokens may remain valid for up to 15 minutes.');}}><h2>Password</h2><Field label="Current password"><input required type="password" name="current_password" autoComplete="current-password"/></Field><PasswordInput/><Field label="Confirm new password"><input required type="password" minLength={8} maxLength={200} name="confirm_password" autoComplete="new-password"/></Field><button className="button" disabled={busy}>Change password</button><a href="/forgot-password">Reset password using your verified email</a></form>
      <section className="account-form"><h2>Two-factor authentication</h2><p>TOTP enrollment and recovery codes are unavailable in this managed authentication configuration. No second factor is currently enforced. A supported provider capability or a separately validated authentication migration is required.</p></section>
      <section className="account-form"><h2>Passkeys & trusted devices</h2><p>Passkey registration and remembered-device controls are unavailable in the current managed configuration. Active sessions below describe sign-ins; they do not certify trusted devices.</p></section>
      <section className="account-form"><h2>Active sessions</h2><p>{sessionsLoaded?sessions.length+' active sessions':'Loading sessions…'}. Device names are approximate browser hints. Provider update time is not a reliable last-activity timestamp.</p><div className="security-sessions">{sessions.map(s=><article className="account-record security-session" key={s.id}><h3>{describeSession(s.user_agent)}</h3>{s.current===true&&<span className="badge">Current session</span>}<dl><div><dt>Expires</dt><dd>{sessionDate(s.expires_at)}</dd></div><div><dt>Last active</dt><dd>Unavailable</dd></div></dl>{s.can_revoke&&<button className="secondary-button" disabled={busy} onClick={()=>setConfirmRevoke(s.id)}>Revoke session</button>}</article>)}</div>{sessionsLoaded&&!sessions.length&&<p>No sessions could be displayed. Refresh or sign in again if this is unexpected.</p>}<p>Revoking a provider session stops session refresh. Previously issued API tokens can remain valid for up to 15 minutes. Sign out everywhere immediately revokes all AfriCore API access as well.</p>

        <button className="secondary-button" disabled={busy} onClick={()=>setSessionRevision(n=>n+1)}>Refresh sessions</button>{sessionController.current&&sessions.some(s=>s.current)&&<button className="secondary-button" disabled={busy||sessions.length<2} onClick={()=>setConfirmRevoke('others')}>Revoke all other sessions</button>}
        <button
          className="secondary-button"
          disabled={busy}
          onClick={()=>setConfirmAll(true)}
        >
          Sign out everywhere
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() =>
            action(
              () => api("/api/auth/account/deletion-request", "POST", {}),
              "Deletion review requested. Financial and signed history is retained pending review.",
            )
          }
        >
          Request account deletion review
        </button>
        <p>
          Deletion requires review of workspace ownership and retention
          obligations. This request does not erase financial records.
        </p>
      </section>
      <section className="account-form"><h2>Account recovery</h2><p>Keep access to your verified email. Password recovery uses the configured provider; actual inbox delivery must be confirmed by the recipient.</p><a href="/verify">Review email verification</a></section><section className="account-form"><h2>Recent security activity</h2><p>Sign-ins for currently active sessions, reported by the authentication provider. Revoked and expired sign-ins are not included.</p><ul className="security-activity">{sessions.filter(s=>s.created_at).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,10).map(s=><li key={s.id}><strong>Session started · {describeSession(s.user_agent)}</strong><time dateTime={s.created_at}>{sessionDate(s.created_at)}</time></li>)}</ul>{!sessions.some(s=>s.created_at)&&<p>No sign-in timestamps are available.</p>}<p>Complete historical account events are not available yet. Authorized workspace audit history remains available in your workspace.</p></section><section className="account-form"><h2>Security notifications</h2><p>Verification and recovery messages follow the configured provider policy. Additional account alert delivery and notification preferences are not configured. Suspicious sign-in detection and locations are not inferred.</p></section><section className="account-form"><h2>Account protection settings</h2><p>Workspace roles and service permissions are enforced on the server. Changing your name, email or preferences does not grant additional access. Strong second-factor approval remains unavailable until the authentication architecture supports it.</p></section>
      {confirmAll&&<Overlay onClose={()=>setConfirmAll(false)}><section className="service-detail" role="dialog" aria-modal="true" aria-labelledby="signout-confirm"><h2 id="signout-confirm">Sign out everywhere?</h2><p>You will need to sign in again on every device.</p><div className="service-actions"><button className="secondary-button" disabled={busy} onClick={()=>setConfirmAll(false)}>Keep sessions</button><button className="button" disabled={busy} onClick={()=>action(async()=>{if(!applicationRevoked.current){await api('/api/auth/signout-all','POST',{});applicationRevoked.current=true;}await managedSignOut(true);location.href='/login';},'Signed out')}>Confirm sign out everywhere</button></div></section></Overlay>}
      {confirmRevoke&&<Overlay onClose={()=>setConfirmRevoke(null)}><section className="service-detail" role="dialog" aria-modal="true" aria-labelledby="revoke-title"><h2 id="revoke-title">{confirmRevoke==='others'?'Revoke all other sessions?':'Revoke this session?'}</h2><p>The device will need to sign in again. Previously issued API tokens expire within 15 minutes.</p><div className="service-actions"><button disabled={busy} className="secondary-button" onClick={()=>setConfirmRevoke(null)}>Cancel</button><button disabled={busy} className="button" onClick={()=>action(async()=>{if(!sessionController.current)throw Error('Refresh sessions first');if(confirmRevoke==='others')await sessionController.current.revokeOthers();else await sessionController.current.revoke(confirmRevoke);setConfirmRevoke(null);setSessionRevision(n=>n+1);},'Provider sessions revoked. Previously issued API tokens may remain valid for up to 15 minutes.')}>Confirm revocation</button></div></section></Overlay>}

      {notice && (
        <p className="alert" role="status">
          {notice}
        </p>
      )}
    </main>
  );
}
