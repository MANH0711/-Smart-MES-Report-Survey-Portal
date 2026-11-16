# Security Specification — Smart MES & Report Survey Portal

## 1. Data Invariants
1. **Identity Integrity**: Every user profile (`/users/{userId}`) and survey response (`/responses/{responseId}`) must bind ownership (`uid` / `respondentUid`) strictly to `request.auth.uid` unless created by a verified Admin during seeded/bulk operations.
2. **RBAC Privilege Isolation**: Non-admin users can only create their own profile with `role == 'respondent'` and cannot modify `role` on update. Admin privilege requires either verified bootstrapped email (`ruanyoujin84@gmail.com` with `email_verified == true`) or existence in `/admins/{request.auth.uid}`.
3. **PII Protection**: `/users/{userId}` and `/responses/{responseId}` contain employee PII (`email`, `employeeId`, `fullName`). Blanket `list` is forbidden for standard respondents; non-admins can only query/read documents where `resource.data.respondentUid == request.auth.uid`.
4. **Terminal State Locking**: Once a `/responses/{responseId}` document transitions to `status == 'submitted'`, non-admin users cannot overwrite or revert it.
5. **Immutable Audit Trail**: `/auditLogs/{logId}` entries are append-only (`create` allowed for verified Admins/Analysts, `update` and `delete` strictly denied for all users).
6. **Temporal Integrity & Path Hardening**: All document IDs must match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and all strings/arrays have explicit `.size()` upper bounds.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Privilege Escalation on Create**: Unprivileged user attempts `POST /users/{uid}` with `{ role: "admin" }` -> `PERMISSION_DENIED`.
2. **Shadow Field Injection on Profile Update**: User updates `/users/{uid}` adding `{ isVerifiedAdmin: true }` -> `PERMISSION_DENIED` (`hasOnly` rejection).
3. **Role Escalation via Update**: Respondent updates `/users/{uid}` changing `role` from `"respondent"` to `"admin"` -> `PERMISSION_DENIED`.
4. **PII Scraping List Query**: Respondent attempts `list` on `/users` -> `PERMISSION_DENIED`.
5. **Cross-User Response Read**: Respondent A attempts `get` on `/responses/{respB}` owned by Respondent B -> `PERMISSION_DENIED`.
6. **Spoofed Respondent UID**: User A creates `/responses/{id}` with `respondentUid: "userB"` -> `PERMISSION_DENIED`.
7. **Unverified Email Write**: Authenticated user with `email_verified == false` attempts write on `/responses/{id}` -> `PERMISSION_DENIED`.
8. **Post-Submission Tampering**: Respondent attempts to update `/responses/{id}` when `existing().status == "submitted"` -> `PERMISSION_DENIED`.
9. **Orphaned Campaign Response**: User submits `/responses/{id}` referencing non-existent `campaignId: "fake_campaign_999"` -> `PERMISSION_DENIED` (`exists()` check fails).
10. **ID Poisoning Attack**: User attempts write to `/responses/${'a'.repeat(500)}` -> `PERMISSION_DENIED` (`isValidId` fails).
11. **Array Exhaustion (Denial of Wallet)**: User submits `/responses/{id}` with `selectedForms` array length `> 100` -> `PERMISSION_DENIED`.
12. **Audit Log Tampering**: Even an Admin attempts `update` or `delete` on `/auditLogs/{logId}` -> `PERMISSION_DENIED`.
