# KYC / AML Architecture

Activated when `REAL_MONEY_ENABLED=true`.

## KYC Provider Interface

```ts
createVerification()
getVerificationStatus()
submitDocuments()
handleWebhook()  // signature required
```

Implementations:

| Provider   | Env `KYC_PROVIDER` | Notes                                      |
|------------|--------------------|--------------------------------------------|
| Null       | `null` (default)   | Fails closed — no approvals                |
| Sandbox    | `sandbox`          | Tests only; webhooks need `KYC_WEBHOOK_SECRET` |
| Sumsub/…   | *(add class)*      | Wire real vendor under `providers/`        |

**No bypass:** `KycService.assertKycApprovedForRealMoney()` blocks deposits/withdrawals unless status is `APPROVED`. There is no admin flag to skip KYC for real-money users.

## AML

- Transaction monitoring via `AmlService.evaluateTransaction()`
- Rules: velocity, unusual patterns, structuring, multi-account (device/IP), country blocklist, IP risk
- Alerts → `aml_alerts` table
- Manual review: `GET /api/compliance/reviews/alerts`, claim, resolve
- Resolving an alert does **not** auto-replay a blocked payment; ops must resubmit for a new AML pass

## Device / IP

- Fingerprints stored hashed
- Multi-account linkage on shared device or IP

## Env

```
REAL_MONEY_ENABLED=false
KYC_PROVIDER=null
KYC_WEBHOOK_SECRET=   # min 16 chars for sandbox webhooks
```
