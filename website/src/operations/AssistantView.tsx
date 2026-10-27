import { useState } from 'react';
import { Field, Form, Provenance, money, type API } from './UI';
export function AssistantView({
  api,
  currency,
}: {
  api: API;
  currency: string;
}) {
  const [result, setResult] = useState<any>(null),
    [question, setQuestion] = useState(''),
    [history, setHistory] = useState<any[]>([]);
  return (
    <>
      <section className="panel assistant-intro">
        <h2>Understand your records. Keep control.</h2>
        <p>
          The assistant explains one authorized data tool at a time. It cannot
          move money, change invoices or send messages. Review the minimized
          evidence before allowing AI processing.
        </p>
        <div className="assistant-prompts">
          {[
            'Which invoices should I follow up on?',
            'Summarize my payment activity.',
            'What if my customer pays late?',
          ].map((q) => (
            <button key={q} onClick={() => setQuestion(q)}>
              {q}
            </button>
          ))}
        </div>
      </section>
      <Form
        submit={async (d) => {
          const r = await api('/assistant', 'POST', {
            question: d.question,
            tool: d.tool,
            currency,
            horizon: Number(d.horizon),
            scenario: d.scenario,
            consent_to_provider: d.consent === 'on',
          });
          setResult(r);
          setHistory((h) => [...h, { question: d.question, ...r }]);
        }}
      >
        <Field label="Question">
          <textarea
            name="question"
            required
            minLength={3}
            maxLength={1500}
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </Field>
        <Field label="Authorized data tool">
          <select name="tool">
            <option value="financial_summary">Financial summary</option>
            <option value="receivables">Receivables</option>
            <option value="forecast">Forecast</option>
            <option value="reconciliation">Reconciliation</option>
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Forecast horizon">
            <select name="horizon">
              {[7, 30, 60, 90].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Field label="Forecast scenario">
            <select name="scenario">
              {['expected', 'optimistic', 'conservative'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        <label className="checkbox-field">
          <input type="checkbox" name="consent" />
          Allow sending my question and minimized numeric evidence to the
          configured AI provider.
        </label>
        <button className="button">Review evidence / ask assistant</button>
      </Form>
      {result && (
        <section className="panel assistant-answer">
          <Provenance label={result.classification || result.status} />
          <h2>
            {result.status === 'answered'
              ? 'Assistant explanation'
              : 'Computed evidence'}
          </h2>
          <p className="assistant-text">
            {result.explanation || result.message}
          </p>
          <EvidenceSummary evidence={result.evidence} currency={currency} />
          <p className="muted">
            No action was executed. Review AI explanations against the
            calculation evidence.
          </p>
        </section>
      )}
      {history.length > 1 && (
        <details className="panel">
          <summary>Earlier questions in this browser session</summary>
          {history.slice(0, -1).map((r, i) => (
            <p key={i}>
              {r.question} · {r.status}
            </p>
          ))}
        </details>
      )}
    </>
  );
}
function EvidenceSummary({
  evidence,
  currency,
}: {
  evidence: any;
  currency: string;
}) {
  if (!evidence) return null;
  const metrics =
    evidence.metrics ||
    Object.fromEntries(
      Object.entries(evidence).filter(([key]) => key.endsWith('_minor')),
    );
  return (
    <div className="assistant-evidence">
      <h3>Supporting calculation evidence</h3>
      <p>
        {evidence.period?.from} – {evidence.period?.to} · {currency}
      </p>
      {Object.entries(metrics).map(([key, value]) => (
        <div className="list-row" key={key}>
          <span>{key.replaceAll('_minor', '').replaceAll('_', ' ')}</span>
          <b>
            {value === null ? 'Not available' : money(Number(value), currency)}
          </b>
        </div>
      ))}
      {evidence.quality?.missing_expense_data && (
        <p>Expense coverage is incomplete.</p>
      )}
      {evidence.starting_balance_minor === null && (
        <p>No starting bank balance was supplied.</p>
      )}
      {evidence.invoices && (
        <p>{evidence.invoices.length} open invoices in the evidence.</p>
      )}
      <p className="muted">{evidence.classification?.replaceAll('_', ' ')}</p>
    </div>
  );
}
