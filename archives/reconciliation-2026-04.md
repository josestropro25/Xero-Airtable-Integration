# Reconciliation Snapshot — April 2026

*Archived: 2026-05-15. Original location: bottom of `reconciliation-workflow.md`.*

This is a frozen state from the April 2026 reconciliation run. It is not SOP content. For current reconciliation results, re-run `scripts/reconcile.js`.

## Raw run output (55 products, 3 API calls)

- 23 both complete
- 23 invoice only
- 8 neither
- 1 flag

## Classified

- 7 CG products (04-8 through 04-14) → invoice only, all Cindy Mao → N/A, expected
- 16 products → genuine RCTI gap (NX 04-4/5/12-15, NOMU 04-2/3/4, BARC 04-2 through 06, BNP 04-1, C2 04-1)
- 8 products → both missing (MBL 04-1 through 04-4, NX 04-7 through 04-10)

## Manual review flags

- ⚠️ NOMU 2026-04-1 — 2 invoices: INV-0913 ($6,150 PAID) + INV-0914 ($1,370 PAID). RCTI exists (PO-0662). Extra charge unexplained.
- ⚠️ CG 2026-04-3 — 2 RCTIs: PO-0646 and PO-0647. Both active — confirm intentional.
