import { useState } from "react";
import { InteractiveChart, financialSeries } from "../charts/InteractiveChart";
import { InteractiveExample } from "./InteractiveExample";
import { matchingExample } from "./experienceModel";
export const experienceKinds: Record<string, string> = {
  business: "workspace",
  pay: "payment",
  invoicing: "invoice",
  reconciliation: "matching",
  "cash-flow": "cash",
  intelligence: "decision",
  automations: "rule",
  connect: "source",
  data: "normalization",
  "business-passport": "passport",
  "trust-network": "network",
  "verifiable-credentials": "credential",
  "blockchain-verification": "anchor",
  "business-verification": "review",
  "passport-privacy": "privacy",
  "protected-payments": "protection",
};
const money = (n: number) => "KSh " + n.toLocaleString("en-KE");
function Label() {
  return (
    <p className="experience-label">
      Learning simulation only · synthetic data · no records change
    </p>
  );
}
function PaymentJourney() {
  const [state, setState] = useState(0);
  const states = [
    [
      "Awaiting payment",
      "The seller creates a KSh 8,000 request against an eligible issued invoice. No receipt exists yet.",
    ],
    [
      "Payment processing",
      "Initiation is not confirmation. If a callback is missing, the request stays unresolved; do not mark the invoice paid from a browser result.",
    ],
    [
      "Provider confirmed",
      "A trusted provider event confirms the amount and currency. This is distinct from settlement to a merchant account.",
    ],
    [
      "Failed payment",
      "No confirmed receipt is allocated. Review the failure and create a permitted retry rather than inventing a paid status.",
    ],
    [
      "Reconciliation pending",
      "Inspect the reference and the eligible outstanding amount. A mismatch needs review even when a payment event exists.",
    ],
    [
      "Reconciled",
      "A confirmed amount is linked to the correct document. The invoice remainder changes; settlement remains a provider concern.",
    ],
  ];
  return (
    <>
      <h2>Follow one KSh 8,000 payment.</h2>
      <Label />
      <div className="experience-tabs" aria-label="Payment journey states">
        {states.map(([name], i) => (
          <button
            key={name}
            aria-pressed={state === i}
            onClick={() => setState(i)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="experience-result" role="status">
        <h3>{states[state][0]}</h3>
        <p>{states[state][1]}</p>
      </div>
      <p>
        These are explanatory journey stages, including failure branches, rather
        than a claim that every request traverses all states. Live provider
        collection is not enabled.
      </p>
    </>
  );
}
function Matching() {
  const [second, setSecond] = useState(false),
    [event, setEvent] = useState("matched");
  const result = matchingExample(second, event);
  return (
    <>
      <h2>Apply receipts. Keep the remainder honest.</h2>
      <Label />
      <div className="experience-facts">
        <article>
          Invoice INV-104<strong>KSh 2,500</strong>Amount due
        </article>
        <article>
          Confirmed receipt A<strong>KSh 1,500</strong>Already allocated
        </article>
        <article>
          Outstanding<strong>{money(result.remaining)}</strong>
          {result.remaining ? "Partial payment" : "Fully allocated"}
        </article>
      </div>
      <label>
        Receipt B scenario
        <select
          value={event}
          onChange={(e) => {
            setEvent(e.target.value);
            setSecond(false);
          }}
        >
          <option value="matched">Matching reference · KSh 1,000</option>
          <option value="unmatched">Unknown reference</option>
          <option value="duplicate">Duplicate of receipt A</option>
          <option value="mismatch">KSh 3,000 exceeds remainder</option>
          <option value="currency">Wrong currency</option>
        </select>
      </label>
      <button
        className="button"
        disabled={second}
        onClick={() => setSecond(true)}
      >
        Inspect receipt B
      </button>
      <div className="experience-result" role="status">
        <h3>{result.status}</h3>
        <p>{result.detail}</p>
        <p>
          Total allocated: {money(result.allocated)}. Remaining:{" "}
          {money(result.remaining)}.
        </p>
      </div>
      <p>
        Duplicate events do not create a second allocation. Manual review
        records a decision without rewriting the original evidence. Splitting a
        single receipt across unrelated invoices is not offered in this
        workflow.
      </p>
    </>
  );
}
function CashExample() {
  return (
    <>
      <h2>Money received is different from money still owed.</h2>
      <Label />
      <InteractiveChart
        title="Recorded movement · example"
        points={[
          {
            date: "2026-10-01",
            inflows: 10000000,
            outflows: 8000000,
            net: 2000000,
          },
          {
            date: "2026-10-08",
            inflows: 12000000,
            outflows: 6000000,
            net: 6000000,
          },
          { date: "2026-10-15", inflows: 8000000, outflows: 8000000, net: 0 },
        ]}
        series={financialSeries}
        currency="KES"
        description="Illustrative receipts total KSh 300,000; recorded outflows KSh 220,000; net movement KSh 80,000. Inspect each recorded date."
      />
      <div className="experience-table">
        <table>
          <thead>
            <tr>
              <th>Measure</th>
              <th>What it means here</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Outstanding invoices · KSh 90,000</td>
              <td>Still owed; excluded from confirmed receipts.</td>
            </tr>
            <tr>
              <td>Revenue and profit</td>
              <td>
                Require accounting recognition and complete costs; this chart
                does not calculate them.
              </td>
            </tr>
            <tr>
              <td>Available bank balance</td>
              <td>
                Needs verified opening cash and all account activity;
                unavailable here.
              </td>
            </tr>
            <tr>
              <td>Future receipts</td>
              <td>
                Assumptions, not guaranteed money. Explore scenarios in
                Intelligence.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
function Decisions() {
  const [conservative, setConservative] = useState(false);
  return (
    <>
      <h2>
        Reporting tells you what happened. Intelligence tests what might follow.
      </h2>
      <Label />
      <div className="experience-split">
        <div>
          <h3>The evidence</h3>
          <p>
            A fictional supplier has KSh 250,000 of invoices due next month.
            Historical payer delays are used only when enough fully settled
            invoices exist. Missing history stays visible.
          </p>
          <h3>The question</h3>
          <p>Could collections arrive after a planned stock purchase?</p>
          <label>
            Collection scenario
            <select
              value={conservative ? "conservative" : "expected"}
              onChange={(e) =>
                setConservative(e.target.value === "conservative")
              }
            >
              <option value="expected">Expected · 90% collection</option>
              <option value="conservative">
                Conservative · 65%, 14-day delay
              </option>
            </select>
          </label>
        </div>
        <div className="experience-result" role="status">
          <h3>{money(conservative ? 162500 : 225000)} assumed collections</h3>
          <p>
            {conservative
              ? "An additional 14-day delay can push receipts beyond the purchase date."
              : "The expected scenario uses a 90% collection assumption, not a learned probability."}
          </p>
          <h3>Possible response</h3>
          <p>
            Review the due invoices, confirm payment timing with customers and
            compare the stock purchase date. AfriCore does not execute these
            decisions.
          </p>
        </div>
      </div>
      <p>
        The production calculation runs deterministically over permitted
        records, obligations and explicit assumptions. Statistical confidence
        intervals, guaranteed outcomes and automatic financial decisions are not
        provided.
      </p>
    </>
  );
}
function Rule() {
  const [overdue, setOverdue] = useState(false);
  return (
    <>
      <h2>One overdue invoice. One defined follow-up.</h2>
      <Label />
      <ol className="experience-timeline">
        <li>
          <strong>Trigger</strong>Daily schedule reaches its configured hour.
        </li>
        <li>
          <strong>Condition</strong>Invoice is overdue, unpaid and in the
          selected currency.
        </li>
        <li>
          <strong>Action</strong>Create an in-app reminder for the authorized
          member.
        </li>
        <li>
          <strong>Result</strong>Persist the run, outcome and deduplication key.
        </li>
      </ol>
      <button className="secondary-button" onClick={() => setOverdue(!overdue)}>
        {overdue
          ? "Return to a not-yet-due invoice"
          : "Move the example beyond its due date"}
      </button>
      <div className="experience-result" role="status">
        <h3>
          {overdue
            ? "Condition met: in-app follow-up"
            : "Condition not met: no reminder"}
        </h3>
        <p>
          {overdue
            ? "A retry of the same scheduled trigger must reuse the run, not send another reminder."
            : "The rule does not mark an invoice paid or send a customer message."}
        </p>
      </div>
      <details>
        <summary>What happens on failure or when approval is needed?</summary>
        <p>
          Failed executions retry with backoff, then enter dead letter after
          three attempts. Paused workflows stop future execution. Creator
          permissions are rechecked. Assigned approvals are separate human
          review records; protected release checks require a different eligible
          approver. No email, SMS, WhatsApp or money movement is performed by
          these templates.
        </p>
      </details>
    </>
  );
}
function Connections({ data }: { data: boolean }) {
  return (
    <>
      <h2>
        {data
          ? "Turn source records into usable, traceable fields."
          : "Connect retrieves. Data standardizes."}
      </h2>
      <p>
        {data
          ? "Keep the original source ID, amount, currency and timestamps while validating the normalized record. Imported credit is never promoted to provider-confirmed payment."
          : "An authorized source and a normalized business record are different responsibilities. A successful sync is not payment confirmation."}
      </p>
      <ol className="experience-timeline">
        <li>
          <strong>Permitted source</strong>Provider feed or merchant CSV
        </li>
        <li>
          <strong>Connect</strong>Retrieve, retry, retain source/checkpoint
        </li>
        <li>
          <strong>Data</strong>Validate fields and preserve provenance
        </li>
        <li>
          <strong>Workspace</strong>Review records; reconcile trusted events
          separately
        </li>
      </ol>
      <div className="experience-table">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Current status</th>
              <th>Important limit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>CSV import</td>
              <td>Available · member permission required</td>
              <td>
                Manual, stable source IDs; merchant-supplied, unverified
                evidence
              </td>
            </tr>
            <tr>
              <td>Accounting, courier, store adapters</td>
              <td>Sandbox</td>
              <td>Synthetic source data, explicit retry/failure scenarios</td>
            </tr>
            <tr>
              <td>Workspace API and signed webhooks</td>
              <td>Requires configuration</td>
              <td>
                Scoped server key, permitted HTTPS endpoint and signature
                validation
              </td>
            </tr>
            <tr>
              <td>M-Pesa, banks, eTIMS</td>
              <td>Planned / awaiting authorized integration</td>
              <td>No live adapter or institutional authorization enabled</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        No live financial institution connection is claimed. Source
        modification, removal and backfill behavior need provider-specific
        implementation and tests before a live connector is added.
      </p>
    </>
  );
}
function Network() {
  const [selected, setSelected] = useState(0);
  const rows = [
    [
      "Supplier",
      "Requested",
      "The supplier has not confirmed the relationship. A one-sided request is not corroboration.",
    ],
    [
      "Customer",
      "Confirmed",
      "A separately authorized counterparty confirmed its side. This does not establish creditworthiness.",
    ],
    [
      "Logistics provider",
      "Disputed",
      "The relationship or supporting statement requires review; preserve both parties’ evidence.",
    ],
    [
      "Eligible issuer",
      "Revoked",
      "A former relationship no longer supplies current assurance. Issuer approval remains a separate governance check.",
    ],
  ];
  return (
    <>
      <h2>A relationship needs another party.</h2>
      <Label />
      <div className="relationship-grid">
        {rows.map(([name, status], i) => (
          <button
            key={name}
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            <strong>{name}</strong>
            <span>{status}</span>
          </button>
        ))}
      </div>
      <div className="experience-result" role="status">
        <h3>
          {rows[selected][0]} · {rows[selected][1]}
        </h3>
        <p>{rows[selected][2]}</p>
      </div>
      <p>
        The relationship API stores pending, confirmed, rejected and revoked.
        “Disputed” describes a situation needing evidence/correction review,
        rather than an extra implemented relationship state. A commercial link
        is not a recommendation, government verification or guarantee. This
        public model is an explanation, not a live relationship graph.
      </p>
    </>
  );
}
function Anchor() {
  return (
    <>
      <h2>Check that this credential belongs to this anchored batch.</h2>
      <Label />
      <ol className="process-timeline">
        {[
          ["Issue", "An approved sandbox issuer signs a specific claim."],
          [
            "Commit",
            "A randomized, domain-separated commitment hides the raw credential.",
          ],
          ["Batch", "A Merkle tree collects commitments into one root."],
          [
            "Anchor",
            "The configured local EVM records that root after a genuine transaction.",
          ],
          [
            "Verify",
            "Check inclusion against the on-chain root, then separately check signature, status, issuer and policy.",
          ],
        ].map(([title, text]) => (
          <li key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
      <div className="experience-result">
        <h3>What the chain adds</h3>
        <p>
          An independently queryable commitment helps detect inconsistent batch
          history. It does not prove that a business claim is honest.
          Confidential documents and personal details stay off-chain.
        </p>
      </div>
      <details>
        <summary>
          Developer depth: roots, proofs and independent verification
        </summary>
        <p>
          The implementation uses OpenZeppelin standard Merkle proofs, root-only
          Solidity storage and a separate Node verifier. Wrong roots, tampered
          paths, chain/contract mismatch and unconfirmed transactions must fail.
          Local publication is real local-EVM activity, not a public testnet or
          mainnet deployment. Production anchoring and OpenID wallet conformance
          remain gated.
        </p>
        <a href="/docs">Read the implementation guide</a>
      </details>
    </>
  );
}
function Protection() {
  return (
    <>
      <h2>The buyer and seller need different answers.</h2>
      <div className="experience-table">
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Buyer perspective</th>
              <th>Seller perspective</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Agreement</td>
              <td>Review goods, delivery terms and inspection window.</td>
              <td>Agree on scope before requesting collection.</td>
            </tr>
            <tr>
              <td>Payment evidence</td>
              <td>
                Sandbox partner simulates confirmation; no real funds move.
              </td>
              <td>Confirmation does not authorize unilateral release.</td>
            </tr>
            <tr>
              <td>Delivery</td>
              <td>
                Inspect the goods and record acceptance or a supported dispute.
              </td>
              <td>
                Submit shipment/delivery evidence; a seller assertion is not
                buyer acceptance.
              </td>
            </tr>
            <tr>
              <td>Dispute</td>
              <td>A complaint opens review, not an automatic refund.</td>
              <td>Respond with evidence and retain decision history.</td>
            </tr>
            <tr>
              <td>Reviewed outcome</td>
              <td>
                Separate eligible approval and partner confirmation are
                required.
              </td>
              <td>
                Settlement/refund states remain distinct from delivery and
                review.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        AfriCore does not hold escrow funds here. Real collection, custody,
        settlement and refunds require an authorized partner and regulatory
        review. The available workflow is sandbox-only.
      </p>
    </>
  );
}
export function ProductExperience({ path }: { path: string }) {
  const slug = path.split("/").at(-1)!,
    kind = experienceKinds[slug];
  if (!kind) return null;
  return (
    <section
      className={"distinct-experience experience-" + kind}
      data-experience={kind}
    >
      {kind === "workspace" ? (
        <>
          <h2>What will you do after signing in?</h2>
          <p>
            AfriCore Business is the operational workspace. It connects the
            records your team creates; individual tools handle collection,
            matching, analysis and proof.
          </p>
          <img
            className="workspace-preview"
            src="/media/product/workspace.webp"
            width="1200"
            height="800"
            alt="Actual synthetic AfriCore workspace with customer, order, invoice and payment sections."
            loading="lazy"
          />
          <p className="experience-label">
            Actual implemented interface · synthetic browser-demo records
          </p>
          <ol className="experience-timeline">
            <li>
              <strong>Morning</strong>Add a customer and create an itemized
              order.
            </li>
            <li>
              <strong>Before delivery</strong>Issue an invoice with terms and a
              due date.
            </li>
            <li>
              <strong>During the day</strong>Inspect payment results and review
              exceptions.
            </li>
            <li>
              <strong>Before closing</strong>Review money movement and assign
              team responsibilities.
            </li>
          </ol>
          <p>
            Team roles control who can operate records, handle finance or
            administer access. Invite employees from Team; inspect results in
            the relevant records and audit history.
          </p>
        </>
      ) : kind === "payment" ? (
        <PaymentJourney />
      ) : kind === "matching" ? (
        <Matching />
      ) : kind === "cash" ? (
        <CashExample />
      ) : kind === "decision" ? (
        <Decisions />
      ) : kind === "rule" ? (
        <Rule />
      ) : kind === "source" || kind === "normalization" ? (
        <Connections data={kind === "normalization"} />
      ) : kind === "network" ? (
        <Network />
      ) : kind === "anchor" ? (
        <Anchor />
      ) : kind === "protection" ? (
        <Protection />
      ) : kind === "invoice" ? (
        <>
          <h2>Follow the amount your customer still owes.</h2>
          <Label />
          <div className="experience-split">
            <div>
              <h3>A supplier invoice</h3>
              <p>
                Issue KSh 250,000 for supplied goods with 30-day terms. A
                confirmed KSh 100,000 allocation leaves KSh 150,000 outstanding.
              </p>
              <ol>
                <li>
                  Create line items, discount and tax using integer minor units.
                </li>
                <li>
                  Issue the draft and share or print its commercial invoice.
                </li>
                <li>
                  Follow due date, confirmed allocations and the remaining
                  balance.
                </li>
              </ol>
              <p>
                Reminders are in-app follow-ups. A formal credit-note ledger and
                eTIMS validation are not implemented; drafts and eligible
                void/cancel transitions have explicit guards.
              </p>
            </div>
            <img
              src="/media/product/invoice.webp"
              width="1200"
              height="800"
              alt="Actual synthetic invoice detail view showing line items, dates, total and paid amount."
              loading="lazy"
            />
          </div>
          <ol className="experience-timeline">
            <li>
              <strong>Issue day</strong>Customer receives the commercial
              invoice.
            </li>
            <li>
              <strong>Day 30</strong>Any unpaid amount reaches its due date.
            </li>
            <li>
              <strong>After due date</strong>The remaining balance is overdue,
              not a second debt.
            </li>
            <li>
              <strong>Final allocation</strong>A fully covered invoice closes as
              paid.
            </li>
          </ol>
        </>
      ) : kind === "passport" ? (
        <>
          <h2>A supplier introduces its business to a new customer.</h2>
          <Label />
          <div className="experience-split">
            <div>
              <h3>The customer's request</h3>
              <p>
                “Who is your business, and what evidence supports this delivery
                claim?”
              </p>
              <h3>The supplier's choice</h3>
              <p>
                Select a relevant identity or delivery credential, name the
                recipient, state the purpose and limit access. Keep unrelated
                invoice totals private.
              </p>
              <h3>The recipient's checks</h3>
              <p>
                Check the issuer, signature, current status and evidence quality
                independently. A Passport organizes proof; it does not assign a
                universal trust score.
              </p>
            </div>
            <InteractiveExample kind="private-sharing" />
          </div>
        </>
      ) : kind === "credential" ? (
        <>
          <h2>One claim. Three different roles.</h2>
          <ol className="experience-timeline">
            <li>
              <strong>Issuer</strong>Reviews evidence and signs the specific
              statement.
            </li>
            <li>
              <strong>Business / holder</strong>Receives the credential and
              authorizes a disclosure.
            </li>
            <li>
              <strong>Verifier</strong>Checks integrity, status and whether the
              issuer is suitable.
            </li>
            <li>
              <strong>Later status</strong>Expiry, suspension or revocation can
              limit current acceptance while history remains.
            </li>
          </ol>
          <InteractiveExample kind="digital-credentials" />
          <p>
            Credentials are useful independently of blockchain. A valid
            signature identifies the signing key and detects alteration; it does
            not prove that every statement is true.
          </p>
        </>
      ) : kind === "privacy" ? (
        <>
          <h2>The recipient needs a delivery claim, not your whole folder.</h2>
          <InteractiveExample kind="private-sharing" />
          <p>
            Real service access additionally requires a recipient-bound request,
            purpose, expiry and consent. Revocation stops future access; it
            cannot erase a copy already received.
          </p>
        </>
      ) : (
        <>
          <h2>Review a specific identity claim against its evidence.</h2>
          <ol className="experience-timeline">
            <li>
              <strong>Claim</strong>Record the legal/business identity
              assertion.
            </li>
            <li>
              <strong>Evidence</strong>Classify self-report, document and
              supported source evidence.
            </li>
            <li>
              <strong>Review</strong>An authorized reviewer records its reason
              and assurance.
            </li>
            <li>
              <strong>Correction</strong>Material identity changes reset review
              and suspend affected identity credentials.
            </li>
          </ol>
          <p>
            No authoritative government registry is connected. Manual review is
            not statutory certification or universal business approval.
          </p>
        </>
      )}
    </section>
  );
}
