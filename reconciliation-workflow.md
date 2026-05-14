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
- Query Products table (`tblbqpCqSdBvxqc6T`) filtered by **Strike Date** range using server-side date operators
- Filter format (confirmed working):
  ```json
  {
    "operator": "and",
    "operands": [
      {"operator": ">=", "operands": ["fldRmizE67tvwOTc6", {"mode": "exactDate", "exactDate": "2026-04-01", "timeZone": "Australia/Sydney"}]},
      {"operator": "<",  "operands": ["fldRmizE67tvwOTc6", {"mode": "exactDate", "exactDate": "2026-05-01", "timeZone": "Australia/Sydney"}]}
    ]
  }
  ```
- Fields to fetch: Code (`fldGwppKvbYFiTAsa`), Strike Date (`fldRmizE67tvwOTc6`), Currency (`fldUNJ9HydcFWOUPY`)
- Result: list of ~55 products for the month, saved to file
- **Do NOT filter by product code string** — use Strike Date field, it is the authoritative date

### Step 2 — Fetch ALL invoices for the period from Xero in one call
- Call `list-invoices` with `dateFrom=2026-04-01`, `dateTo=2026-05-01`, `type=ACCREC`, **`compact=true`**
- `compact=true` returns only `Reference | InvoiceNumber | Status | Currency | Net` per line (~5 tokens per invoice vs ~200 verbose)
- Result goes into context (~300 tokens for 70 invoices) — acceptable
- Save this output to a text file for the Node.js script

### Step 3 — Fetch ALL purchase orders from Xero in one call
- Call `list-purchase-orders` with no filter (handler fetches all pages automatically)
- Result saved to file — process with Node.js locally
- Build a lookup: `{ [reference]: poNumber }` excluding DELETED status

### Step 4 — Cross-reference locally (Node.js, no API calls)
```bash
node scripts/reconcile.js <products_file> <pos_file> <invoices_file>
```
- Reads Airtable products file (JSON) and PO file (text) from disk
- Reads compact invoice file (text) from disk
- For each product: checks invoice lookup and PO lookup by exact reference
- Applies Canaccord bulk PO rule (matches "Stropro [Month] FCNs" pattern)
- Detects flags: duplicate invoices, etc.

### Step 5 — Return summary only (tiny context footprint)
Paste the Node.js output into the conversation. Total context cost: ~50 lines.

**Total API calls: 3** (1 Airtable + 1 Xero invoices compact + 1 Xero POs)
**Script:** `scripts/reconcile.js`

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
