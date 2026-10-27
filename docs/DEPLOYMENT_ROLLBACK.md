# Deployment rollback

Record the Git commit and Cloudflare deployment version plus Render deploy ID. Restore the previous Worker version through Cloudflare Deployments or wrangler rollback. Restore the previous Render image/deploy from its dashboard (Free retains limited rollback history). Deploy matching gateway/backend versions.

Rollback application code only; retain existing database tables, identities, encrypted evidence and append-only history. Never reset Neon to repair a frontend release. Keep cryptographic secrets unchanged. Before future schema changes, obtain a reviewed backup/restore plan. If compromised, disable public traffic first and rotate the gateway credential in both stores together; encryption/hash/HMAC rotation requires a separate history-aware plan.
