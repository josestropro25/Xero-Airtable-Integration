# Current Priorities
*Last updated: 2026-05-15 — update this file when focus shifts*

## Active right now

1. **April 2026 remediation** — reconciliation complete (23/55 both done). Genuine gaps identified:
   - 8 products missing invoices: MBL 04-1 through 04-4, NX 04-7 through 04-10
   - 16 products missing RCTIs: NX 04-4/5/12-15, NOMU 04-2/3/4, BARC 04-2 through 04-6, BNP 04-1, C2 04-1
   - Manual review: NOMU 2026-04-1 duplicate invoices, CG 2026-04-3 duplicate RCTIs

2. **C2 and JPM prefix mapping** — unknown issuers, no Xero contacts yet. Need to identify before creating invoices.

## Near-term

3. **Settlement Party Adv logic for RCTI creation** — suffix rule (MS/NW) is documented and used in reconciliation matching. Still need to wire it into the invoice/RCTI creation workflow so references are built correctly at creation time.

4. **CG 2026-05-6 RCTI** — new adviser groups (Pridham Capital, Taylor Collinson, Bayside Asset Management) need Xero contacts created and flow clarified before RCTI can be created.

## Done (recently)

- ✅ Reconciliation workflow — 3-call approach, `scripts/reconcile.js`, full SOP in `reconciliation-workflow.md`
- ✅ Settlement Party Adv suffix mapping — documented in rules and reconciliation workflow
- ✅ Production Xero connection — live against real StroPro org
- ✅ Canaccord bulk RCTI pattern — documented and detected by reconcile.js
