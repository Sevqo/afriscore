# Account types

One identity can own or join multiple workspaces. Profile primary_experience is a preference, not a role. Workspace kind and current membership determine the permitted experience. New visitors choose Personal, Business or Developer at /get-started; /sign-up/:kind leads to the same identity provider with an initial setup intent. Returning users use /login and /app resolves their authorized destination.

Personal manages individual work without incorporation fields. Developer owns sandbox applications without merchant onboarding. Business retains the complete operations/trust platform. An authenticated user adds workspaces at /app/workspaces without creating another identity.

There is one default owned Personal and one default owned Developer workspace per user; a unique owner/kind constraint and serialized onboarding prevent duplicates. Additional Business organizations are supported. New workspaces start empty. Browser demo records are never imported.

Personal and Developer use an internal resource container in ac_organizations for compatibility with existing scoped services. This is not a merchant profile or legally verified business. ac_workspaces.kind is authoritative; company fields are absent from their onboarding and profile. Do not infer legal status from the legacy table name.
