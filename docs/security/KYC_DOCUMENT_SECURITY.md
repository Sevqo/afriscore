# KYC document security

Documents remain encrypted in the private application database, with scoped organization/environment and appropriate owner/operator authorization. They are not public static assets. Signed sharing does not grant blanket document access. Downloads record intent in the audit log before sending file bytes; failure to record the audit prevents delivery. An audit intent does not prove that the recipient completed a download.

No storage provider, public bucket, raw document export or production identity-verification service was added. Context-bound encryption supports record swapping protection for new writes; legacy reads remain compatible. Backup scope and limitations are described in [key management](ENCRYPTION_AND_KEY_MANAGEMENT.md).

Remaining lifecycle requirements include malware scanning/quarantine, operational retention schedules, reviewed deletion/legal holds, restore drills, access-review procedures and qualified privacy/legal assessment. Database storage alone is not a vulnerability; incomplete lifecycle controls must not be marked solved by changing storage vendors.
