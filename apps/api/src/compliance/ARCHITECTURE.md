# KYC / AML Architecture (Real-Money Mode)

Activated when `REAL_MONEY_ENABLED=true`. Demo / virtual Birr does **not** require KYC.

## Principles

1. **Fail closed** — missing provider, failed webhook signature, or non-APPROVED KYC blocks real-money actions.
2. **No bypass APIs** — no skip-KYC, no force-approve for real money, no silent AML override.
3. **Provider abstraction** — swap Sumsub / Onfido / Jumio without changing business code.
4. **Human review** — AML blocks open a case; dismiss does not auto-retry the blocked tx.

---

## KYC Provider Interface

```ts
createVerification(input) → { externalId, status, redirectUrl? }
getVerificationStatus(externalId) → { status, rejectionReasons? }
submitDocuments({ externalId, documents }) → status
handleWebhook(headers, rawBody) → { externalId, status, processed }  // must verify signature
```

| Provider | When |
|----------|------|
| `null` (default) | Unconfigured — all KYC calls fail if real money is on |
| `sandbox` | Integration tests only — still not auto-approve for production |
| `sumsub` / `onfido` / … | Production — set `KYC_PROVIDER` + vendor secrets |

Env: `KYC_PROVIDER`, vendor API keys, webhook HMAC secret.

### Flow

1. User `POST /api/kyc/verifications`
2. Provider returns hosted URL or accepts `submitDocuments`
3. Provider webhook → `POST /api/kyc/webhooks` (HMAC verified)
4. Status persisted on `kyc_verifications`
5. `KycService.assertKycApprovedForRealMoney(userId)` gates deposits/withdrawals/payouts

---

## AML

### Transaction monitoring

Every real-money `DEPOSIT` | `WITHDRAWAL` | `TRANSFER` | `BET` | `PAYOUT` calls:

```ts
AmlService.evaluateTransaction(event, riskContext)
```

If any finding has `blockOperation: true` → **abort the operation** and open `aml_alerts`.

### Rules

| Rule | Signal |
|------|--------|
| `VELOCITY_DEPOSIT` / `VELOCITY_WITHDRAWAL` | Count & sum windows (1h / 24h) |
| `RAPID_ROUND_TRIP` | Withdraw soon after similar deposit |
| `STRUCTURING` | Multiple txs just under threshold |
| `UNUSUAL_AMOUNT` | Far above recent median |
| `MULTI_ACCOUNT_DEVICE` | Same device fingerprint, ≥3 accounts |
| `MULTI_ACCOUNT_IP` | Shared IP across many accounts |
| `COUNTRY_BLOCKED` / `IP_RISK` | Restricted jurisdictions |
| `COUNTRY_MISMATCH` | Profile country ≠ IP country |

### Device fingerprinting & IP risk

- `DeviceFingerprint` stores **hashes only** (fingerprint, IP, UA) — not raw PII logs.
- `recordDevice` on login / sensitive actions.
- Linked accounts queried for multi-account rules.

### Country restrictions

Default block set: high-risk OFAC-style codes (extend via config). IP country vs profile country mismatch raises MEDIUM alert.

---

## Manual review workflow

| Endpoint | Action |
|----------|--------|
| `GET /api/compliance/reviews/alerts` | Open queue |
| `POST .../alerts/:id/claim` | Assign to analyst |
| `POST .../alerts/:id/resolve` | `CONFIRMED` or `DISMISSED` + notes |

**Important:** `DISMISSED` does **not** unlock a blocked transaction automatically. Ops must re-submit the payment for a **fresh** AML evaluation.

---

## Real-money gate

```ts
RealMoneyGate.assertAllowed(userId, txEvent, riskContext)
// 1) if !REAL_MONEY_ENABLED → allow (demo)
// 2) assertKycApprovedForRealMoney
// 3) evaluateTransaction → if blocked throw AML_HOLD
```

Wallet / payment modules **must** call this before any real fund movement.

---

## What is intentionally missing

- No admin “approve without documents” for real money
- No client flag to skip KYC
- No webhook handler that accepts unsigned bodies
