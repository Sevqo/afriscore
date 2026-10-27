import { useEffect, useState } from "react";
import { api } from "../lib/api-client";
import { Logo } from "../components/Logo";
import { managedClient, managedSignOut } from "./auth";
import { types, Field, Alert, Currency } from "./AccountUI";
export function AccountSettings({ account }: { account: any }) {
  const [sessions, setSessions] = useState<any[]>([]);
  useEffect(() => {
    let live = true;
    api("/api/auth/sessions")
      .then((r) => {
        if (live) setSessions(r.data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
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
    <main className="account-entry">
      <Logo />
      <a href="/app/workspaces">All workspaces</a>
      <h1>Account & security</h1>
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
      <section className="account-form">
        <h2>Secure your account</h2>
        <p>
          Active sessions: {sessions.length}. Use sign out all sessions to
          revoke access across devices.
        </p>
        {sessions.map((s) => (
          <article className="account-record" key={s.id}>
            <span>
              {s.current
                ? "Current session"
                : s.user_agent || "Authenticated session"}
            </span>
            <span>Expires {new Date(s.expires_at).toLocaleString()}</span>
          </article>
        ))}
        <a href="/forgot-password">Reset password using your verified email</a>
        <a href="/verify">Verify your email</a>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() =>
            action(async () => {
              await api("/api/auth/signout-all", "POST", {});
              await managedSignOut(true);
              location.href = "/login";
            }, "Signed out")
          }
        >
          Sign out all sessions
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
      <Alert error={error} />
      {notice && (
        <p className="alert" role="status">
          {notice}
        </p>
      )}
    </main>
  );
}
