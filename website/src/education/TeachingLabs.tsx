import { useState } from 'react';
export function InvoiceLab() {
    const [items, setItems] = useState([{ name: 'Site preparation', quantity: 1, price: 30000 }, { name: 'Installation work', quantity: 1, price: 20000 }]), [paid, setPaid] = useState(30000), [preview, setPreview] = useState(false);
    const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0), valid = items.every(i => i.name.trim() && Number.isSafeInteger(i.quantity) && i.quantity > 0 && Number.isSafeInteger(i.price) && i.price >= 0) && Number.isSafeInteger(total) && total <= 10000000 && Number.isSafeInteger(paid) && paid >= 0 && paid <= total;
    return <section className="learning-paths invoice-lab"><h3>Prepare an example invoice</h3><p>Isolated browser exercise · whole KSh amounts · no invoice is saved and no payment is requested.</p>{items.map((item, index) => <fieldset key={index}><legend>Line {index + 1}</legend><label>Description<input maxLength={80} value={item.name} onChange={e => setItems(items.map((v, i) => i === index ? { ...v, name: e.target.value } : v))}/></label><label>Quantity<input type="number" min="1" max="100" step="1" value={item.quantity} onChange={e => setItems(items.map((v, i) => i === index ? { ...v, quantity: e.target.valueAsNumber || 0 } : v))}/></label><label>Unit price (KSh)<input type="number" min="0" max="1000000" step="1" value={item.price} onChange={e => setItems(items.map((v, i) => i === index ? { ...v, price: e.target.valueAsNumber || 0 } : v))}/></label></fieldset>)}<button className="secondary-button" disabled={items.length >= 5} onClick={() => setItems([...items, { name: 'Additional work', quantity: 1, price: 1000 }])}>Add example line</button><label>Simulated allocated payment (KSh)<input type="number" min="0" max={total} step="1" value={paid} onChange={e => setPaid(e.target.valueAsNumber || 0)}/></label><button className="secondary-button" disabled={!valid} onClick={() => setPreview(!preview)}>{preview ? 'Hide' : 'Preview'} example invoice</button><p role="status">{valid ? 'Total: KSh ' + total.toLocaleString('en-KE') + '. Remaining: KSh ' + (total - paid).toLocaleString('en-KE') + '.' : 'Use positive whole quantities, whole nonnegative amounts, a total up to KSh 10,000,000 and a payment no larger than the total.'}</p>{preview && valid && <article className="article-example"><h4>Fictional contractor · Example invoice</h4><ul>{items.map((i, n) => <li key={n}>{i.name}: {i.quantity} × KSh {i.price.toLocaleString('en-KE')}</li>)}</ul><p>Issued value: KSh {total.toLocaleString('en-KE')} · Allocated: KSh {paid.toLocaleString('en-KE')} · Outstanding: KSh {(total - paid).toLocaleString('en-KE')}</p><p>A due date determines when the unpaid amount becomes overdue. Reminders do not confirm payment. This example is not a tax invoice or eTIMS document.</p></article>}</section>;
}
async function digest(text: string) { const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('AfriCore education only\n' + text)); return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join(''); }
export function IntegrityLab() {
    const [claim, setClaim] = useState('Fictional supplier completed delivery A'), [commitment, setCommitment] = useState(''), [result, setResult] = useState(''), [busy, setBusy] = useState(false);
    async function run(create: boolean) { setBusy(true); try {
        const hash = await digest(claim);
        if (create) {
            setCommitment(hash);
            setResult('Sample commitment created. Change the example claim, then verify it.');
        }
        else
            setResult(hash === commitment ? 'Matches the saved sample commitment. This does not verify the claim’s truth.' : 'Does not match: the sample claim changed.');
    }
    catch {
        setResult('Cryptographic verification is unavailable in this browser. Use a supported secure browser context.');
    }
    finally {
        setBusy(false);
    } }
    return <section className="learning-paths"><h3>Change a claim and check its fingerprint</h3><p>Local SHA-256 exercise using fictional text. No private records, signing keys, API request or blockchain transaction is involved.</p><label>Example claim<input value={claim} maxLength={140} onChange={e => setClaim(e.target.value)}/></label><button className="secondary-button" disabled={busy || !claim} onClick={() => void run(true)}>Generate sample commitment</button><button className="secondary-button" disabled={busy || !commitment} onClick={() => void run(false)}>Verify current claim</button>{commitment && <p style={{ overflowWrap: 'anywhere' }}>Saved fingerprint: <code>{commitment}</code></p>}<p role="status">{result}</p><p>This genuine hash comparison teaches tamper detection. It is not a signature, Merkle inclusion proof or on-chain verification. The authenticated implementation checks those separately, along with status and issuer authority.</p></section>;
}
export function CredentialLab() {
    const [claim, setClaim] = useState('Fictional supplier completed delivery A'), [keys, setKeys] = useState<CryptoKeyPair | null>(null), [signature, setSignature] = useState<ArrayBuffer | null>(null), [revoked, setRevoked] = useState(false), [busy, setBusy] = useState(false), [result, setResult] = useState('');
    async function issue() { setBusy(true); try {
        const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
        const signed = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(claim));
        setKeys(pair);
        setSignature(signed);
        setRevoked(false);
        setResult('Fictional issuer signed this example. No business credential was issued.');
    }
    catch {
        setResult('Signing is unavailable in this browser. Use a supported secure context.');
    }
    finally {
        setBusy(false);
    } }
    async function verify() { if (!keys || !signature)
        return; setBusy(true); try {
        const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keys.publicKey, signature, new TextEncoder().encode(claim));
        setResult('Signature: ' + (valid ? 'valid' : 'invalid; signed text changed') + '. Example status: ' + (revoked ? 'revoked' : 'active') + '. Issuer: fictional, no independent authority. ' + (valid && !revoked ? 'Integrity and example status pass; factual truth remains unverified.' : 'Do not accept this example.'));
    }
    catch {
        setResult('Verification could not complete. Do not treat an error as a valid result.');
    }
    finally {
        setBusy(false);
    } }
    return <section className="learning-paths"><h3>Issue and check a fictional signed claim</h3><p>Genuine browser ECDSA P-256 signatures with an ephemeral non-exportable private key. This is a cryptography exercise, not the platform’s JOSE credential profile or an authorized issuer.</p><label>Example signed claim<input maxLength={140} value={claim} onChange={e => setClaim(e.target.value)}/></label><button className="secondary-button" disabled={busy || !claim} onClick={() => void issue()}>Sign new example</button><button className="secondary-button" disabled={busy || !signature} onClick={() => void verify()}>Check signature and example status</button><button className="secondary-button" disabled={!signature || revoked || busy} onClick={() => { setRevoked(true); setResult('Example status changed to revoked. Recheck: the signature can remain valid while status prevents acceptance.'); }}>Revoke example</button><p role="status">{result}</p><p>Change the text after signing to test alteration. Sign a new example to restart. Reloading discards the key and signature. Nothing is saved, shared, sent to an API or published on-chain.</p></section>;
}
export function SourceLab({ data }: {
    data: boolean;
}) {
    const [authorized, setAuthorized] = useState(false), [format, setFormat] = useState('A'), [result, setResult] = useState(''), [seen, setSeen] = useState(false), [failure, setFailure] = useState(false);
    function run() { if (!authorized) {
        setResult('Permission required. No example record processed.');
        return;
    } if (failure) {
        setResult('Example source failed. No new record processed; inspect and retry after review.');
        return;
    } setResult(seen ? 'Duplicate source reference receipt-001: no second record created.' : 'One normalized merchant-imported record: source receipt-001, KES 2,500.00, inflow. Provider verified: false.'); setSeen(true); }
    return <section className="learning-paths"><h3>{data ? 'Two formats, one consistent example record' : 'Follow an example source connection'}</h3><p>Local synthetic exercise. No credentials, external connection, file upload or workspace write.</p><label>Source format<select value={format} onChange={e => setFormat(e.target.value)}><option value="A">Example A · CREDIT</option><option value="B">Example B · CR</option></select></label><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{format === 'A' ? 'reference: receipt-001; type: CREDIT; amount: 2500.00; currency: KES' : 'source_id: receipt-001; direction: CR; amount_minor: 250000; currency: KES'}</pre><label><input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)}/>Allow this fictional source for the exercise</label><label><input type="checkbox" checked={failure} onChange={e => setFailure(e.target.checked)}/>Simulate source failure</label><button className="secondary-button" onClick={run}>{data ? 'Normalize example' : 'Run example sync'}</button><button className="secondary-button" onClick={() => { setAuthorized(false); setResult('Disconnected. Existing example provenance remains; no further sync permitted.'); }}>Disconnect example</button><p role="status">{result}</p><p>The two formats describe the same reference. Running either twice does not create a second financial record. Normalization retains merchant provenance; it does not establish provider confirmation.</p></section>;
}
