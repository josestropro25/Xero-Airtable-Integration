# Reconciliation Workflow
## Airtable ↔ Xero Cross-Check

---

## 1. Purpose

Verify that every product in Airtable for a given period has both:
- A **sales invoice** created in Xero (ACCREC)
- An **RCTI** (purchase order) created in Xero for each adviser group

Source of truth: **Xero** — not the Airtable Invoice/RCTI checkboxes (those are manually maintained and may lag behind).

---

## 2. Trigger

User says: _"Reconcile April 2026"_ or _"Have we done all invoices and RCTIs for April?"_

---

## 3. Token-Efficient Approach

**Do NOT make one Xero API call per product.** That burns the context window before the reconciliation is complete.

Instead:

### Step 1 — Get all products for the period from Airtable
- Query Products table filtered by month/year (e.g. Code contains `2026-04-`)
- Gets: Code, Strike Date, Currency per product
- Result: list of ~50 product codes

### Step 2 — Fetch ALL invoices for the period from Xero in one call
- Call `list-invoices` with `dateFrom=2026-04-01`, `dateTo=2026-05-01`, `type=ACCREC`
- Result saved to file (large) — process with Node.js locally
- Build a set of all references found in Xero

### Step 3 — Fetch ALL purchase orders from Xero in one call
- Call `list-purchase-orders` with no filter (fetches all pages automatically)
- Result saved to file — process with Node.js locally
- Build a set of all references found (excluding DELETED)

### Step 4 — Cross-reference locally (Node.js, no API calls)
For each of the ~50 products:
- Invoice found in Step 2? → ✅ or ❌
- RCTI found in Step 3? → ✅ or ❌ (note: Canaccord uses bulk reference, not product code)

### Step 5 — Return summary table only
Output only the final table to the context — not raw Xero data.

---

## 4. Output Format

| Product | Strike Date | Currency | Invoice | RCTI |
|---|---|---|---|---|
| CG 2026-04-1 | 2026-04-02 | AUD | ✅ INV-0883 | ✅ PO-0648 |
| CG 2026-04-2 | 2026-04-07 | AUD | ❌ Missing | ✅ PO-0655 |
| NX 2026-04-1 | 2026-04-07 | USD | ❌ Missing | ✅ PO-0671 |

Followed by:
- Count: X/Y complete (both done), X invoice-only, X RCTI-only, X neither
- Any flags (duplicate invoices, unknown references, etc.)

---

## 5. Special Cases

### Canaccord bulk RCTIs
Canaccord products are not covered by individual product-code POs. They appear under a bulk reference like `"Stropro April FCNs"` (PO-0682). When checking RCTI status for Canaccord products:
- Look for a bulk PO covering the relevant month — if it exists, mark all Canaccord products for that month as ✅ RCTI
- Do NOT mark as ❌ just because no individual product-code PO exists

### Duplicate invoices
If a product reference returns 2+ invoices (e.g. NOMU 2026-04-1 has INV-0913 and INV-0914):
- Flag as ⚠️ DUPLICATE — list both invoice numbers
- Do not block the reconciliation, just highlight for manual review

### DELETED purchase orders
Ignore DELETED POs in the reconciliation. If a product only has a DELETED PO and no replacement, mark as ❌ RCTI missing.

### Self-directed sales
Products where all sales rows are Self-directed will have an invoice but no RCTI. This is expected — mark as ✅ Invoice | N/A RCTI.

---

## 6. Known Gaps (April 2026 as of 2026-05-14)

From initial reconciliation run — to be completed:

**Missing invoices:**
- CG 2026-04-2, 04-04, 04-06, 04-16, 04-17
- All NX 2026-04-xx products
- NOMU 2026-04-2, 04-03, 04-04
- All MBL 2026-04-xx products
- C2 2026-04-1

**Missing RCTIs:**
- CG 2026-04-8 through 14
- NOMU 2026-04-2, 04-03, 04-04
- NX 2026-04-4/5/7-15
- MBL 2026-04-1 through 4
- C2 2026-04-1

**Flags:**
- ⚠️ NOMU 2026-04-1 has 2 invoices: INV-0913 ($6,150) + INV-0914 ($1,370) — same reference, needs review
- ⚠️ MS prefix maps to Morgan Stanley — contact ID `e3ffacf5-3999-4a3d-a0f2-e6601108c5fa` — not yet in workflow mappings

---

## 7. New Prefixes / Contacts Discovered

| Prefix | Company | Contact ID |
|---|---|---|
| MS | Morgan Stanley | `e3ffacf5-3999-4a3d-a0f2-e6601108c5fa` |
| C2 | Unknown | TBD |
| JPM | JP Morgan (assumed) | TBD |
