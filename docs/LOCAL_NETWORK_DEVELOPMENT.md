# Local network development

Use Node 22+, npm ci, and npm --prefix website ci. From the repository run npm run dev. The launcher starts the API on loopback port 4005 and Vite on port 5175 with strict port selection. It waits for database readiness before starting Vite, prints localhost and detected IPv4 addresses, and stops its child processes on failure or interruption. It refuses occupied ports instead of silently reusing another environment. Vite proxies /api and /v1 to the selected loopback API, so a phone never needs a second API address.

If .env.neon.development exists it is selected automatically; otherwise .env is used. DEV_ENV_FILE explicitly selects another private file. Existing shell variables take precedence. No environment contents are printed and no database credential uses a VITE_ variable. Check the printed provider mode before signing in; an old static preview on 4173 is not a managed-auth server.

PowerShell example with explicit ports:

```powershell
$env:DEV_ENV_FILE = '.env.neon.development'
$env:DEV_PORT = '5176'
$env:DEV_API_PORT = '4005'
npm run dev
```

Connect the iPhone and laptop to the same trusted Wi-Fi/hotspot. Open a printed LAN address, not localhost on the phone. Get-NetIPConfiguration shows the active adapter IPv4 address; virtual adapters and VPN addresses may not be reachable from the phone. The IP is detected each launch, not hardcoded in application source. DEV_HOST defaults to 0.0.0.0; API_BIND_HOST is loopback in this launcher. APP_PUBLIC_URL can select an exact development hostname/origin.

## HTTPS and managed authentication

HTTP LAN access is sufficient to inspect public pages. It is not qualified for managed authentication: a remote LAN IP is not a secure browser context. The client gives an actionable HTTPS message instead of attempting insecure-cookie workarounds. Localhost remains the supported development exception. HTTPS and correct provider origins are required before phone sign-in can be accepted.

Use a trusted development certificate tool such as [mkcert](https://github.com/FiloSottile/mkcert). Generate a certificate covering localhost, the chosen LAN IP and/or resolvable local hostname. Keep the private key outside source control, for example under ignored .tmp/certificates. Use DEV_TLS_CERT and DEV_TLS_KEY for PEM certificate/key paths and APP_PUBLIC_URL for the exact HTTPS origin, including port. The same npm run dev command starts Vite HTTPS with the API still proxied over loopback. Supplying only one TLS file or a mismatched origin fails before startup. Never upload the CA private key or server key.

Install and explicitly trust the development CA on Windows and the iPhone through the device's normal profile/certificate-trust settings. Transfer only the public CA certificate using a trusted channel. Do not bypass a browser certificate warning. Certificate trust is a device-owner action; no trust store was modified in this implementation.

Add that exact HTTPS origin in the Neon development branch's trusted-domain settings. [Neon origin configuration](https://neon.com/docs/auth/guides/configure-domains) is separate from serving the page on Wi-Fi. No wildcard origin or credentialed CORS is enabled. The launcher supplies an explicit development-only origin list for the proxy; production ignores this list and retains its single configured origin/CSRF checks. Verify OTP/recovery callback URLs on the same HTTPS origin. Do not change production origins to make development work.

## Troubleshooting and verification

Check the selected network/port, readiness endpoint /v1/readiness, matching proxy API port, VPN, guest-network/client isolation and certificate SAN/trust. Vite allows only its default safe hosts plus the explicitly configured hostname. Only the website and dashboard/shared token/font directory are served through Vite's filesystem allowlist.

Windows Defender Firewall may require a rule on a trusted Private network. If a rule is actually required, an administrator should scope it to the chosen TCP frontend port, Node executable and LocalSubnet, with Profile Private; do not open all ports, all programs or Public profiles. No firewall rule or public tunnel was created here. WSL/container setups need their own documented forwarding rather than broad firewall disablement.

Executed: launcher startup against Neon development, verified database readiness, proxy endpoints, browser checks at phone widths and host-to-LAN HTTP access. These do not prove access from a physical iPhone. Remaining acceptance: owner-installed device trust, reviewed exact Neon HTTPS origin, physical iPhone Safari sign-in/session restoration and mailbox verification/recovery round trips.
