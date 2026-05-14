# Current Priorities
*Last updated: 2026-05-14 — update this file when focus shifts*

## Active right now

1. **Reconciliation workflow** — design and code the token-efficient April 2026 reconciliation (3 API calls + local Node.js processing). Approach documented in `reconciliation-workflow.md`.

2. **Production Xero connection** — connected to real StroPro org. Validating invoice and RCTI creation against real data. CG 2026-05-6 invoice created successfully.

3. **RCTI business rules mapping** — discovering real adviser group contacts and patterns from live Xero data. Canaccord bulk pattern documented. Several contacts still TBD (C2, JPM).

## Near-term

4. **Settlement Party Adv logic** — the AdviserFees table has a `Settlement Party Adv` field (Stropro, Mason Stevens, NetWealth, Praemium). Logic to be defined — affects RCTI routing.

5. **Canaccord RCTI contacts** — individual adviser contacts exist in Xero. Bulk vs individual RCTI decision logic established but not fully tested in production.

## On the backlog

6. **Production org migration** — custom Xero connection ($10 AUD/month) purchased. Config updated. Working against real org now.

7. **Invoice reconciliation tool** — build the full reconciliation script once approach is finalised.
