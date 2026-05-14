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

## 3. Context Management Rules

These rules exist because a single reconciliation run covers ~55 products across 3 data sources. Violating them will exhaust the context window before the run is complete.

### Mandatory rules
- **Never dump a large API response directly into context.** Any response larger than ~20 records must be written to a file immediately after receiving it, before making the next API call. The tool result stays in context whether you write to disk or not — but writing to disk means you don't have to re-fetch it later if context rolls over.
- **Use compact mode for Xero invoices.** `compact=true` on `list-invoices` returns ~5 tokens per invoice instead of ~200. Never fetch verbose invoices for a full-month reconciliation.
- **Never make one Xero API call per product.** That's 55+ calls and will hit the context limit before finishing. Always use date-range bulk fetches.
- **All cross-referencing happens in Node.js, not in the conversation.** Do not loop through products and check each against context. Write data files, run the script, paste the ~50-line output.
- **Fetch all 3 sources in parallel** when context is fresh. Three simultaneous calls cost the same tokens as one and finish faster.
- **The Airtable base ID is `appYvjM849EsLrpbW`.** Do not guess or look it up — use this directly.

### File locations for temp data
```
scripts/temp/products_apr2026.json   ← Airtable products
scripts/temp/invoices_apr2026.txt    ← Xero invoices (compact)
<Claude tool-results folder>/*.txt   ← Xero POs (auto-saved by Claude when response > limit)
```

---

## 4. Token-Efficient Approach

**Total API calls: 3** (1 Airtable + 1 Xero invoices compact + 1 Xero POs)

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
- For each product: checks invoice lookup and PO lookup by reference
- Applies Canaccord bulk PO rule (matches "Stropro [Month] FCNs" pattern)
- Detects flags: duplicate invoices, etc.

### Step 5 — Return summary only (tiny context footprint)
Paste the Node.js output into the conversation. Total context cost: ~50 lines.

**Script:** `scripts/reconcile.js`

---

## 5. Output Format

| Product | Strike Date | Currency | Invoice | RCTI |
|---|---|---|---|---|
| CG 2026-04-1 | 2026-04-02 | AUD | ✅ INV-0883 | ✅ PO-0648 |
| CG 2026-04-2 | 2026-04-07 | AUD | ❌ Missing | ✅ PO-0655 |
| NX 2026-04-1 | 2026-04-07 | USD | ❌ Missing | ✅ PO-0671 |

Followed by:
- Count: X/Y complete (both done), X invoice-only, X RCTI-only, X neither
- Any flags (duplicate invoices, unknown references, etc.)

---

## 6. Special Cases

### Xero reference suffixes (NW, MS, etc.)
Invoice and RCTI references in Xero are sometimes created with a suffix appended to the product code. The suffix comes directly from the **Settlement Party Adv** field (`fld4pYt0Ximcc9Y3z`) in the AdviserFees table — it identifies the custodian/platform the adviser uses to settle trades.

**Suffix mapping:**
| Settlement Party Adv | Suffix | Example reference |
|---|---|---|
| Mason Stevens | ` MS` (sometimes ` - MS`) | `CG 2026-04-2 - MS`, `NX 2026-04-6 MS` |
| NetWealth | ` NW` | `CG 2026-04-6 NW`, `NOMU 2026-04-2 NW` |
| Stropro | none | `CG 2026-04-18` |
| blank | none | Granite Bay products (MBL, some NX) |

**When building a reference for a new invoice or RCTI:**
```
reference = product_code + " " + suffix   (if Mason Stevens or NetWealth)
reference = product_code                   (if Stropro or blank)
```

**When matching Xero references to Airtable product codes (reconciliation):**
- Accept an invoice/RCTI if its reference **starts with the product code followed by a space** (e.g. `CG 2026-04-4 NW` matches `CG 2026-04-4`)
- Also accept exact match (reference == product code)
- **Never use plain prefix match without the trailing space** — `CG 2026-04-1` would falsely match `CG 2026-04-10` or `CG 2026-04-12`
- The `reconcile.js` script implements this correctly: `ref === code || ref.startsWith(code + ' ')`

A product can have multiple AdviserFee rows with different Settlement Party Adv values (e.g. one NW trade and one MS trade). In that case both a suffixed invoice and a suffixed RCTI are expected — this is not a discrepancy.

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

## 7. Known Gaps (April 2026 as of 2026-05-15)

From reconciliation run using `scripts/reconcile.js` — 55 products, 3 API calls.

**Results: 23 both complete | 23 invoice only (no RCTI) | 8 neither | 1 flag**

**Missing invoices (8 products — never created):**
- MBL: 04-1, 04-2, 04-3, 04-4
- NX: 04-7, 04-8, 04-9, 04-10

**Missing RCTIs (31 products):**

Has invoice, no RCTI:
- CG: 04-8, 04-9, 04-10, 04-11, 04-12, 04-13, 04-14
- BARC: 04-2, 04-3, 04-4, 04-5, 04-6
- NX: 04-4, 04-5, 04-12, 04-13, 04-14, 04-15
- NOMU: 04-2, 04-3, 04-4
- C2 2026-04-1, BNP 2026-04-1

Missing both (invoice + RCTI):
- MBL: 04-1, 04-2, 04-3, 04-4
- NX: 04-7, 04-8, 04-9, 04-10

**Flags:**
- ⚠️ NOMU 2026-04-1 — 2 invoices: INV-0913 ($6,150 PAID) + INV-0914 ($1,370 PAID). RCTI exists (PO-0662). Extra $1,370 charge needs explanation.
- ⚠️ CG 2026-04-3 — 2 RCTIs: PO-0646 and PO-0647. Both active — confirm intentional.

---

## 8. New Prefixes / Contacts Discovered

| Prefix | Company | Contact ID |
|---|---|---|
| MS | Morgan Stanley | `e3ffacf5-3999-4a3d-a0f2-e6601108c5fa` |
| C2 | Unknown | TBD |
| JPM | JP Morgan (assumed) | TBD |
