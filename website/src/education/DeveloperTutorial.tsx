import { useState } from "react";
const request = `curl "$AFRICORE_ORIGIN/api/v1/organizations/$ORG/records/invoices?limit=20&offset=0" \\\n  -H "Authorization: Bearer $AFRICORE_API_KEY" \\\n  -H "X-Environment: sandbox"`;
const response = JSON.stringify({ data: [], limit: 20, offset: 0 }, null, 2);
function CodeSample({ label, code }: { label: string; code: string }) {
  const [state, setState] = useState("Copy");
  return (
    <div className="education-code">
      <div>
        <span>{label}</span>
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            navigator.clipboard
              .writeText(code)
              .then(() => setState("Copied"))
              .catch(() => setState("Select the code to copy"))
          }
        >
          {state}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
export function DeveloperTutorial() {
  const [example,setExample]=useState('success');
  const outcomes:Record<string,[string,string]>={success:['200 · Illustrative empty result',response],unauthorized:['401 · Authentication required','Provide a valid scoped server credential. No credential is included in this exercise.'],forbidden:['403 · Access denied','Check current workspace membership, API scopes, environment and enabled service.'],conflict:['409 · State conflict','Inspect the original operation before retrying a write. Never create a second financial action blindly.'],limited:['429 · Rate limited','Respect retry guidance and bounded backoff. Do not retry a financial write with a fresh idempotency key.']};
  return (
    <section className="developer-tutorial">
      <span className="eyebrow">A first API request</span>
      <h2>Read your sandbox invoices.</h2>
      <p>
        Create a workspace and an application, then generate a key with the
        required record-read scope in Developers. Store it on your server.
        Replace the environment variables below with your own origin,
        organization ID and secret key; no credential is included in this
        example.
      </p>
      <CodeSample label="GET · Workspace invoices" code={request} />
      <CodeSample
        label="200 · Example for an empty workspace"
        code={response}
      />
      <section className="learning-paths"><h3>Inspect an example outcome</h3><p>Local teaching examples only. This control sends no API request and accepts no key.</p><label>Response scenario<select value={example} onChange={e=>setExample(e.target.value)}><option value="success">Empty sandbox result</option><option value="unauthorized">Missing credential</option><option value="forbidden">Permission denied</option><option value="conflict">Write state conflict</option><option value="limited">Rate limit</option></select></label><p role="status">{outcomes[example][0]}</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{outcomes[example][1]}</pre><p>For real requests, use your authorized Developer Console and the current OpenAPI schema. These explanatory error messages are not exact server response payloads.</p></section>
      <ol>
        <li>
          <strong>Authentication:</strong> a scoped key identifies the allowed
          organization and actions. A browser sign-in cookie is a separate
          authentication path.
        </li>
        <li>
          <strong>Environment:</strong> use sandbox explicitly. Production
          payment collection remains disabled.
        </li>
        <li>
          <strong>Errors:</strong> handle 401 for sign-in/key problems, 403 for
          permission denial, 409 for state conflicts and 429 for rate limiting.
          Inspect the actual response and request ID.
        </li>
        <li>
          <strong>Writes:</strong> supported payment-request creation also needs
          an eligible document and an Idempotency-Key. Save its one-time
          checkout URL securely; a retry does not reveal the secret again.
        </li>
        <li>
          <strong>Events:</strong> verify the webhook timestamp and raw-body
          HMAC before accepting a notification. Deduplicate the stable delivery
          ID.
        </li>
      </ol>
      <div className="actions">
        <a className="button" href="/api/openapi.json">
          Read the workspace API schema
        </a>
        <a className="text-link" href="/products/verification-api">
          Explore verification APIs
        </a>
      </div>
    </section>
  );
}
