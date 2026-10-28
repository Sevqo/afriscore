# API access control

`src/platform/workspace-capabilities.ts` is the explicit reviewed route matrix. Each entry uses HTTP method and Express's declared route, not attacker-controlled path regexes. HEAD uses the corresponding GET policy. Unknown routes/kinds fail closed; route additions must update this map and contracts deliberately.

The map is only one layer. Current workspace status, membership/role, capability, API credential organization/environment/scope and verified production identity checks remain mandatory. Developer credentials remain sandbox scoped; Personal resources do not become businesses. Internal APIs never accept ordinary Developer keys as operator identity. The public gateway blocks internal APIs before these backend checks.

Approval binding commits to resource org/environment/type/ID/state/version and exact decision parameters. The assigned reviewer must retain current authority. The requester cannot self-approve. Expired, mutated, unbound historical or consumed approvals cannot execute; consumption and action share the outer transaction. UI review summaries show the actual decision and resource details without exposing encrypted material.

Search is limited to fields the response makes visible. Hidden notes do not become a search oracle. JSON-backed records still require scans; indexed domain search is future performance work, not an authorization fix.
