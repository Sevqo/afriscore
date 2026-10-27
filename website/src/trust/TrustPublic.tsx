import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { Form, Field, request } from '../operations/UI';
import { VerificationReport, download } from './PassportWorkspace';
export function TrustPublic({
  mode,
}: {
  mode: 'verify' | 'share' | 'profile';
}) {
  const [error, setError] = useState(''),
    [result, setResult] = useState<any>(null),
    [credential, setCredential] = useState(''),
    [busy, setBusy] = useState(false);
  const last = location.pathname.split('/').pop();
  useEffect(() => {
    if (mode === 'profile')
      request('/trust/public/' + last)
        .then(setResult)
        .catch((e) => setError(e.message));
  }, [mode]);
  async function action(fn: () => Promise<any>) {
    setError('');
    setBusy(true);
    try {
      setResult(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header />
      <main className="trust-public">
        <span className="eyebrow">
          AFRICORE VERIFICATION GATEWAY · SANDBOX BETA
        </span>
        <h1>
          {mode === 'share'
            ? 'A specific disclosure. A named recipient.'
            : mode === 'profile'
              ? 'A business profile, shared by choice.'
              : 'Check the credential. Understand the evidence.'}
        </h1>
        <p>
          Cryptographic integrity, issuer authority, current status and evidence
          quality are separate questions. No account is needed to verify a
          credential you are authorized to hold.
        </p>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {mode === 'verify' && (
          <Form
            submit={() =>
              action(() =>
                request('/trust/verify', 'POST', {
                  credential: credential.trim(),
                }),
              )
            }
          >
            <h2>Verify a signed business credential</h2>
            <Field label="Compact VC JWT">
              <textarea
                required
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="Paste the credential token you are authorized to verify."
              />
            </Field>
            <Field label="Or load an exported verification bundle or token (up to 1 MB)">
              <input
                type="file"
                accept=".json,.jwt,.txt"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1000000) {
                    setError('Maximum 1 MB');
                    return;
                  }
                  const text = await file.text();
                  try {
                    setCredential(
                      JSON.parse(text).credential ||
                        JSON.parse(text).token ||
                        '',
                    );
                  } catch {
                    setCredential(text.trim());
                  }
                }}
              />
            </Field>
            <p>
              Processed for this check. Uploaded credential contents are not
              retained in the verification report. Issuer keys are pinned to the
              configured registry; unrecognized issuer keys need an independent
              verifier.
            </p>
            <button className="button" disabled={busy}>
              {busy ? 'Checking…' : 'Verify credential'}
            </button>
          </Form>
        )}
        {mode === 'share' && (
          <section className="panel">
            <h2>Recipient-bound presentation</h2>
            <p>
              Sign in as a member of the recipient business before opening this
              disclosure. An expiring one-time link may only be opened once.
            </p>
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                action(() =>
                  request('/trust/presentations/' + last, 'POST', {}),
                )
              }
            >
              {busy ? 'Checking access…' : 'Open as the named recipient'}
            </button>
            {result?.presentation && (
              <>
                <p>Purpose: {result.purpose}</p>
                <p>
                  Disclosed credential types:{' '}
                  {result.disclosed_types.join(', ')}
                </p>
                <button
                  onClick={() => download(result, 'africore-presentation.json')}
                >
                  Save authorized presentation
                </button>
                <button
                  onClick={() =>
                    action(() =>
                      request('/trust/verify-presentation', 'POST', {
                        presentation: result.presentation,
                        audience: 'urn:uuid:' + result.recipient_org,
                        nonce: result.nonce,
                      }),
                    )
                  }
                >
                  Verify presentation checks
                </button>
                <p>
                  Revocation stops future access; it cannot delete copies
                  already disclosed.
                </p>
              </>
            )}
          </section>
        )}
        {mode === 'profile' && result && (
          <section className="passport-card">
            <h2>{result.display_name}</h2>
            <p>
              {result.category} · {result.country} · {result.industry}
            </p>
            <p>{result.verification_status}</p>
            <p className="record-id">{result.subject}</p>
            <p>{result.disclaimer}</p>
          </section>
        )}
        {result && mode !== 'profile' && !result.presentation && (
          <VerificationReport report={result} />
        )}
        <section className="panel">
          <h2>Independent checking</h2>
          <p>
            Credential exports include public issuer metadata, short-lived
            signed status snapshots and any available Merkle proof. The
            independently runnable verifier uses Node crypto and can query a
            pinned local EVM contract.
          </p>
          <code>
            node scripts/verify-credential.mjs --file bundle.json --rpc YOUR_RPC
            --contract PINNED_ADDRESS
          </code>
          <p>
            Fresh status and independently assessed issuer authority remain
            necessary. No production issuer network, public testnet deployment
            or OpenID wallet conformance is claimed.
          </p>
        </section>
      </main>
    </>
  );
}
