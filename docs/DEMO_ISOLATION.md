# Demo isolation

/demo explicitly starts the browser-local synthetic transport. Ordinary signup/sign-in exits that transport and uses the backend identity system. The account chooser and signup do not copy demo records into authenticated workspaces. The public shared password panel is removed.

The browser transport no longer accepts a shared demo email/password; guest access is explicit through /demo. Separate loopback demo-server fixtures are never a normal server authentication bypass. Guest transport cannot mint real server API keys. Managed mode does not accept legacy session cookies or local credential endpoints.

The connected Neon development preview is separate from existing browser/static/loopback demos. Synthetic managed API tests and isolated SQLite browser QA use explicitly generated test identities and ignored private state. Never commit those credentials, databases or connection URLs. Normal authenticated records live in the configured server database and survive browser refresh; local browser clearing affects only guest exploration.
