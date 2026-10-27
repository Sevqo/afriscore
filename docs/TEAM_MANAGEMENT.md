# Team directory and invitations

Members display recorded profile name/email, initials, role, active membership and current-user marker. Search filters the directory. Owners/admins can manage allowed roles and remove members; backend transactions recheck current authority. Self role changes and removal of the final owner are rejected. Removing membership preserves the user's account and historical records. Join dates and last activity are not available and are labelled unrecorded.

Invitations show pending, expired, accepted and revoked states. Renew rotates the hashed capability with a new seven-day expiry; revoke expires it and records an audit event. Acceptance and revocation serialize on the invitation row. Duplicate pending invitations and existing members are rejected. There is no connected invitation email sender: share the one-time token manually. An invited signed-in user can accept it from the workspace chooser. Tokens are not cached.
