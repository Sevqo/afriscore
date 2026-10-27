import { useState } from 'react';
export function InteractiveExample({
  kind = "reconciliation",
}: {
  kind?: string;
}) {
  const [amount, setAmount] = useState(1500),
    [reference, setReference] = useState(true),
    [day, setDay] = useState(5),
    [claims, setClaims] = useState(["Business name", "Delivery completion"]),
    [checks, setChecks] = useState(["Signature", "Current status"]);
  const privacy = ["business-passport", "private-sharing"].includes(kind),
    cash = ["cash-flow", "forecasts"].includes(kind),
    credential = [
      "digital-credentials",
      "blockchain-proof",
      "business-trust",
    ].includes(kind);
  return (
    <section className="interactive-example">
      <div>
        <span className="eyebrow">Try an explanation</span>
        <h2>
          {privacy
            ? "Choose what a recipient sees"
            : cash
              ? "What changes when a customer pays late?"
              : credential
                ? "A valid signature is only one check"
                : "Match a payment to its invoice"}
        </h2>
        <p>
          Learning simulation only. Nothing is sent to an API, no merchant
          record changes, and no money moves.
        </p>
      </div>
      <div className="example-controls">
        {privacy ? (
          <fieldset>
            <legend>Illustrative claims to disclose</legend>
            {["Business name", "Delivery completion", "Invoice totals"].map(
              (c) => (
                <label key={c}>
                  <input
                    type="checkbox"
                    checked={claims.includes(c)}
                    onChange={() =>
                      setClaims(
                        claims.includes(c)
                          ? claims.filter((x) => x !== c)
                          : [...claims, c],
                      )
                    }
                  />
                  {c}
                </label>
              ),
            )}
          </fieldset>
        ) : cash ? (
          <label>
            Expected receipt day: {day}
            <input
              type="range"
              min="1"
              max="30"
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            />
            <small>
              KSh 12,000 receipt; KSh 8,000 expense due on day 10. Illustrative
              opening cash: KSh 0.
            </small>
          </label>
        ) : credential ? (
          <fieldset>
            <legend>Which checks have evidence?</legend>
            {[
              "Signature",
              "Current status",
              "Recognized issuer",
              "Independent evidence",
            ].map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={checks.includes(c)}
                  onChange={() =>
                    setChecks(
                      checks.includes(c)
                        ? checks.filter((x) => x !== c)
                        : [...checks, c],
                    )
                  }
                />
                {c}
              </label>
            ))}
          </fieldset>
        ) : (
          <>
            <label>
              Confirmed receipt amount
              <select
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              >
                <option value="1500">KSh 1,500</option>
                <option value="2500">KSh 2,500</option>
                <option value="3000">KSh 3,000</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={reference}
                onChange={(e) => setReference(e.target.checked)}
              />
              Reference matches invoice INV-104
            </label>
          </>
        )}
      </div>
      <div className="example-result" role="status" aria-live="polite">
        <span>
          {privacy
            ? "Recipient preview"
            : cash
              ? "Illustrative planning result"
              : credential
                ? "Separate verification layers"
                : "Invoice INV-104 · KSh 2,500"}
        </span>
        <h3>
          {privacy
            ? claims.length +
              (claims.length === 1 ? " selected claim" : " selected claims")
            : cash
              ? day > 10
                ? "Receipt arrives after the expense"
                : "Receipt arrives before the expense"
              : credential
                ? checks.length === 4
                  ? "All four example checks supplied"
                  : "Some checks remain uncertain"
                : !reference
                  ? "Unmatched: review required"
                  : amount > 2500
                    ? "Amount mismatch: review required"
                    : amount === 2500
                      ? "Fully paid in this example"
                      : "Partially paid in this example"}
        </h3>
        {privacy ? (
          <>
            <ul>
              {claims.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p>
              Unselected claims stay out of this preview. Real sharing
              additionally requires purpose, recipient authorization and expiry
              controls.
            </p>
          </>
        ) : cash ? (
          <p>
            {day > 10
              ? "The day-10 expense creates an illustrative KSh 8,000 gap until the receipt arrives."
              : "After the expense, illustrative movement is KSh 4,000."}{" "}
            The month’s net movement is still KSh 4,000. Timing changes the
            temporary gap; this is not your bank balance.
          </p>
        ) : credential ? (
          <ul>
            {[
              "Signature",
              "Current status",
              "Recognized issuer",
              "Independent evidence",
            ].map((c) => (
              <li key={c}>
                {c}:{" "}
                {checks.includes(c)
                  ? "supplied in this example"
                  : "not established"}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {!reference || amount > 2500
              ? "No automatic allocation is made in this example. Inspect the reference and amount rather than forcing a match."
              : "Outstanding: KSh " +
                (2500 - amount).toLocaleString("en-KE") +
                ". Only the confirmed allocated amount reduces what is owed."}
          </p>
        )}
      </div>
    </section>
  );
}
