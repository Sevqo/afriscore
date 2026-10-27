# Workspace routing

GET /api/auth/account authenticates, loads current memberships joined to active workspaces, then selects a valid last_workspace_id, a matching primary_experience or the oldest available membership. No membership routes to /app/workspaces. The resolver returns allowlisted paths built from stored kind and ID, never a client-supplied redirect.

- Personal: /app/personal
- Business: /app/business/:id
- Developer: /app/developer
- Setup/switching: /app/workspaces
- Identity/preferences/security: /app/account

Deep links are checked against the loaded authorized list before rendering. APIs independently check every requested resource scope. Unknown or revoked workspaces show an access-required state. Changing a profile preference cannot grant a membership. Saved revoked preferences fall back to another authorized workspace.

POST /api/auth/account/workspace saves only an active current membership. New setup runs in one transaction. A validated create intent can survive an auth callback; ordinary login never asks users to choose account type again. The full Business shell receives a validated organization ID. Async data completions are guarded against stale scopes; workspace navigation uses fresh server resolution.

Signup intent survives verification and a required subsequent sign-in through a validated create parameter. Explicit add-workspace intent routes an existing identity to setup; ordinary login has no such intent and resolves the authorized last workspace. Browser URL state is never a permission grant. Account defaults seed new setup forms; each existing workspace retains its own currency/timezone defaults.

## Refactor boundary
Routing remains membership-driven in accounts/Accounts.tsx. AccountChooser, WorkspaceSetup, AccountSettings, FocusedWorkspace and DeveloperPanels are separate components with shared AccountUI primitives. Signup intent remains validated against Personal/Business/Developer; it does not grant access. Existing selection and stale-response guards are preserved. Managed operations/Passport requests now use the same authenticated HTTP transport as account resolution.
