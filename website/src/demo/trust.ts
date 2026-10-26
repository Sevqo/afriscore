import sample from './credential-sample.json';
const decode = (part: string) =>
  JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(
        atob(part.replaceAll('-', '+').replaceAll('_', '/')),
        (c) => c.charCodeAt(0),
      ),
    ),
  );
const vc = decode(sample.credential.split('.')[1]);
export function seedTrust(state: any) {
  if (state['/trust/passport']) return;
  const p = {
    id: vc.credentialSubject.id.replace('urn:uuid:', ''),
    display_name: 'Amani Supplies · Demo',
    category: 'Supplier',
    industry: 'Trade',
    country: 'KE',
    subject: vc.credentialSubject.id,
    verification_status: 'not_submitted',
    public_profile: false,
    status: 'active',
  };
  state['/trust/passport'] = {
    passport: p,
    credentials: [
      {
        id: vc.id.replace('urn:uuid:', ''),
        type: vc.type[1],
        issuer_id: sample.issuer_metadata.id,
        status: 'active',
        valid_until: vc.validUntil,
        claims: vc.credentialSubject,
        created_at: vc.validFrom,
      },
    ],
    evidence: [
      {
        id: crypto.randomUUID(),
        source_kind: 'profile',
        source_id: state['/organization'].id,
        assurance_level: 0,
        method: 'self_reported_demo',
        limitations: 'Synthetic browser data; no source verification.',
        status: 'active',
      },
    ],
    relationships: [],
    requests: [],
    grants: [],
    identity_reviews: [],
    disputes: [],
    index: {
      methodology: 'evidence-coverage-v1',
      value: 20,
      purpose: 'Evidence coverage only, not a trust or credit score.',
      components: [
        'profile',
        'payment',
        'order',
        'shipment',
        'relationship',
      ].map((category) => ({
        category,
        weight: 20,
        covered: category === 'profile',
        source_verified_count: 0,
      })),
    },
  };
  state['/trust/issuers'] = { data: [sample.issuer_metadata] };
  state['/trust/issuance-requests'] = { data: [] };
  state['/trust/history'] = { data: [] };
}
export async function demoTrust(
  state: any,
  route: string,
  method: string,
  input: any,
): Promise<any | null> {
  if (!route.startsWith('/trust/')) return null;
  seedTrust(state);
  const d = state['/trust/passport'],
    p = d.passport,
    history = state['/trust/history'].data;
  const added = (kind: string, body: any) => {
    const row = {
      ...body,
      id: crypto.randomUUID(),
      org_id: state['/organization'].id,
      created_at: new Date().toISOString(),
      kind,
    };
    history.unshift({
      id: crypto.randomUUID(),
      action: 'demo.trust.' + kind,
      resource_id: row.id,
      created_at: new Date().toISOString(),
    });
    return row;
  };
  const error = (message: string) => ({ __error: message });
  if (route === '/trust/passport') {
    if (method === 'GET') return d;
    if (method === 'PATCH') {
      Object.assign(p, input);
      return p;
    }
    return error('Sample Passport already exists.');
  }
  if (route === '/trust/sources')
    return {
      data: [
        {
          kind: 'profile',
          id: state['/organization'].id,
          key: 'profile:' + state['/organization'].id,
          label: p.display_name,
        },
        ...(state['/records/invoices']?.data || []).map((r: any) => ({
          kind: 'invoice',
          id: r.id,
          key: 'invoice:' + r.id,
          label: r.reference,
        })),
        ...(state['/records/orders']?.data || []).map((r: any) => ({
          kind: 'order',
          id: r.id,
          key: 'order:' + r.id,
          label: r.reference,
        })),
      ],
    };
  if (route === '/trust/issuers' && method === 'GET') return state[route];
  if (route.startsWith('/trust/issuers/') && method === 'GET')
    return sample.issuer_metadata;
  if (route === '/trust/history') return state[route];
  if (route === '/trust/credentials') return { data: d.credentials };
  const credential =
    /^\/trust\/credentials\/([^/]+)(?:\/(export|proof|status))?$/.exec(route);
  if (credential) {
    const c = d.credentials.find((c: any) => c.id === credential[1]);
    if (!c) return error('Sample credential not found');
    if (credential[2] === 'export')
      return {
        ...sample,
        profile: 'VC2-JOSE-ES256-minimal-v1',
        demo: true,
        notice:
          'Synthetic sample. Status snapshots expire; no current remote issuer trust or chain status is asserted.',
      };
    if (credential[2] === 'proof')
      return {
        status: 'not_anchored_in_browser_demo',
        inclusion: 'not_checked',
        onchain: false,
        reason: 'Use the backend local-chain workflow to check real anchors.',
      };
    if (credential[2] === 'status')
      return error('Issuer status changes require a connected backend.');
    return { ...c, credential: vc, token: sample.credential };
  }
  if (route === '/trust/verify') {
    if (!crypto.subtle)
      return {
        signature: 'unavailable',
        overall: 'requires_review',
        reason:
          'Use HTTPS or localhost for browser cryptographic verification.',
      };
    if (input.credential_id)
      input = { ...input, credential: sample.credential };
    try {
      const parts = input.credential.split('.'),
        header = decode(parts[0]),
        payload = decode(parts[1]),
        key: any = sample.issuer_metadata.jwks.keys.find(
          (k: any) => k.kid === header.kid,
        );
      if (!key || header.alg !== 'ES256' || header.typ !== 'vc+jwt')
        return {
          signature: 'not_checked',
          overall: 'requires_review',
          reason: 'The offline demo only has the sample issuer public key.',
        };
      const publicKey = await crypto.subtle.importKey(
          'jwk',
          key,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['verify'],
        ),
        signature = Uint8Array.from(
          atob(parts[2].replaceAll('-', '+').replaceAll('_', '/')),
          (c) => c.charCodeAt(0),
        ),
        valid = await crypto.subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          publicKey,
          signature,
          new TextEncoder().encode(parts[0] + '.' + parts[1]),
        );
      return {
        signature: valid ? 'valid' : 'invalid',
        period:
          payload.validFrom <= new Date().toISOString() &&
          payload.validUntil > new Date().toISOString()
            ? 'current'
            : 'expired_or_future',
        issuer: payload.issuer,
        issuer_authority: 'sandbox_sample_only',
        status: 'current_remote_status_unavailable',
        anchor: 'not_checked',
        overall: valid ? 'requires_review' : 'failed',
        limitations:
          'Real browser signature check; synthetic claims. Fresh status and issuer authority require a connected verifier.',
      };
    } catch {
      return {
        signature: 'invalid',
        overall: 'failed',
        reason: 'Credential could not be checked.',
      };
    }
  }
  if (route === '/trust/evidence' && method === 'POST') {
    const existing = d.evidence.find(
      (e: any) =>
        e.source_kind === input.source_kind && e.source_id === input.source_id,
    );
    if (existing) return { ...existing, duplicate: true };
    const row = added('evidence', {
      ...input,
      status: 'active',
      assurance_level: 0,
      method: 'self_reported_demo',
      limitations: 'Synthetic browser record only.',
    });
    d.evidence.push(row);
    const covered = new Set(d.evidence.map((e: any) => e.source_kind));
    d.index.components.forEach(
      (c: any) => (c.covered = covered.has(c.category)),
    );
    d.index.value =
      d.index.components.filter((c: any) => c.covered).length * 20;
    return row;
  }
  if (route === '/trust/identity-reviews' && method === 'POST') {
    const row = added('identity_review', {
      ...input,
      status: 'pending',
      history: [
        {
          status: 'pending',
          source: 'browser_demo',
          at: new Date().toISOString(),
        },
      ],
    });
    d.identity_reviews.push(row);
    p.verification_status = 'pending';
    return row;
  }
  if (route === '/trust/documents')
    return error(
      'Use the connected encrypted document workflow; do not save identity documents in a public browser demo.',
    );
  if (route === '/trust/issuance-requests' && method === 'GET')
    return state[route];
  if (route === '/trust/relationships') {
    if (method === 'GET') return { data: d.relationships };
    const row = added('relationship', {
      ...input,
      peer_org: input.counterparty_org,
      status: 'pending',
      history: [
        {
          status: 'pending',
          source: 'browser_demo',
          at: new Date().toISOString(),
        },
      ],
    });
    d.relationships.push(row);
    return row;
  }
  if (route === '/trust/requests') {
    if (method === 'GET') return { data: d.requests };
    const row = added('verification_request', {
      ...input,
      peer_org: input.holder_org,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    d.requests.push(row);
    return row;
  }
  if (route === '/trust/grants' && method === 'GET')
    return { data: d.grants, access: [] };
  if (route === '/trust/corrections' && method === 'POST') {
    const row = added('correction', {
      ...input,
      status: 'pending',
      history: [
        {
          status: 'pending',
          source: 'browser_demo',
          at: new Date().toISOString(),
        },
      ],
    });
    d.disputes.push(row);
    return row;
  }
  if (route.startsWith('/trust/public/'))
    return p.public_profile
      ? {
          ...p,
          disclaimer: 'Minimal synthetic profile enabled in this browser demo.',
        }
      : error('Public profile disabled.');
  return error(
    'This operation needs separately authenticated issuers/recipients on the connected backend. The browser demo cannot grant real authority or generate new issuer signatures.',
  );
}
