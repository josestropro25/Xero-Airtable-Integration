# Reconciliation Workflow
## Airtable ↔ Xero Cross-Check

---

## 1. Purpose & Scope

Verify that every product in Airtable for a given period has both:
- A **sales invoice** created in Xero (ACCREC)
- An **RCTI** (purchase order) created in Xero for each non-exempt adviser group

**This workflow is read-only.** It produces a classified report of what is complete, what is genuinely missing, and what is expected to be missing. It does not create or modify any documents. Invoice and RCTI creation is a separate workflow.

Source of truth: **Xero** — not the Airtable Invoice/RCTI checkboxes (those are manually maintained and may lag).

---

## 2. Trigger

User says: _"Reconcile April 2026"_ or _"Have we done all invoices and RCTIs for April?"_

Extract the month and year. Derive date range: first day of month → first day of next month.

---

## 3. Context Management Rules

A full reconciliation run covers ~55 products across 3 data sources. These rules prevent context exhaustion.

### How data flows — read this first
Every API tool result lands in context automatically — you cannot prevent this. A full Airtable products response (~55 records) and a full Xero POs response (~700 lines) will both enter context whether you want them to or not. Left alone, they consume most of the context window before the reconciliation is even half done.

The fix: **immediately after receiving each API response, use the Write tool to save it to a file on disk.** The `reconcile.js` script reads from files — not from context. Once saved to disk, the in-context copy serves no purpose and can be ignored. If context later compresses or rolls over, the data is safe on disk and the script still runs.

**Never rely on context to hold reconciliation data between steps.**

### Rules
- **After every API call: write the response to disk immediately**, before making the next call. Use the Write tool.
- **Use `compact=true` for Xero invoices.** Returns ~5 tokens per invoice vs ~200 verbose. Never fetch verbose for a bulk run.
- **Never make one Xero API call per product.** Always date-range bulk fetches — 3 calls total for the entire month.
- **All cross-referencing runs in Node.js, not in conversation.** Do not loop products in context. Write files, run script, paste ~50-line output.
- **Fetch all 3 sources in parallel** when context is fresh — three simultaneous calls, then three writes to disk.
- **Airtable base ID: `appYvjM849EsLrpbW`** — use directly, do not look up.

### Temp file locations
```
scripts/temp/products_<month>.json    ← Airtable products
scripts/temp/invoices_<month>.txt     ← Xero invoices (compact)
<Claude tool-results folder>/*.txt    ← Xero POs (auto-saved when response > limit)
```

---

## Phase 1 — Gather Data

**Goal:** Fetch all 3 data sources, write to disk, run the script, get raw output.
**API calls: 3 total.**

### Step 1.1 — Fetch Airtable products (parallel with 1.2 and 1.3)

Query Products table (`tblbqpCqSdBvxqc6T`) filtered by Strike Date range:

```json
{
  "operator": "and",
  "operands": [
    {"operator": ">=", "operands": ["fldRmizE67tvwOTc6", {"mode": "exactDate", "exactDate": "YYYY-MM-01", "timeZone": "Australia/Sydney"}]},
    {"operator": "<",  "operands": ["fldRmizE67tvwOTc6", {"mode": "exactDate", "exactDate": "YYYY-MM-01 (next month)", "timeZone": "Australia/Sydney"}]}
  ]
}
```

Fields: Code (`fldGwppKvbYFiTAsa`), Strike Date (`fldRmizE67tvwOTc6`), Currency (`fldUNJ9HydcFWOUPY`)

→ **Immediately use the Write tool** to save the full JSON response to `scripts/temp/products_<month>.json`. Do not proceed to Step 1.4 until this file exists on disk.

### Step 1.2 — Fetch Xero invoices (parallel with 1.1 and 1.3)

Call `list-invoices` with:
- `dateFrom` = first day of month
- `dateTo` = first day of next month
- `type` = ACCREC
- `compact` = true

→ **Immediately use the Write tool** to save the text output to `scripts/temp/invoices_<month>.txt`. Do not proceed to Step 1.4 until this file exists on disk.

### Step 1.3 — Fetch Xero purchase orders (parallel with 1.1 and 1.2)

Call `list-purchase-orders` with no filters. The handler fetches all pages automatically.

→ This response is too large to fit in context. Claude will automatically save it to a file in the tool-results folder and return the file path. **Note that path — it is the `<pos_file>` argument for the script.** Do not attempt to read the full PO response into context.

### Step 1.4 — Run the reconciliation script

```bash
node scripts/reconcile.js <products_file> <pos_file> <invoices_file>
```

Paste the full output (~50 lines) into the conversation. Do not interpret yet.

---

## Phase 2 — Classify Results

**Goal:** For every product not showing ✅ on both, determine whether the gap is genuine or expected.
**No API calls in this phase** unless explicitly needed for a specific investigation.

The script outputs four categories. Work through each:

### Category A — ✅ Both complete
No action. Skip.

### Category B — Invoice only (✅ invoice, ❌ RCTI)

These products have an invoice in Xero but no RCTI. Before treating as a genuine gap, check whether an RCTI was ever expected.

**For each product in this category:**

1. Query AdviserFees table (`tblnoxmwS2YM3Erjq`) for that product — fetch fields:
   - Adviser Group (`fldz9bz3z1ZO2BFpj`)
   - Settlement Party Adv (`fld4pYt0Ximcc9Y3z`)

   Do this in a **single bulk call for all Category B products**, not one call per product.

2. Apply exemption rules — if **all** AdviserFee rows for the product are exempt, no RCTI is expected:
   - Adviser Group = `Cindy Mao` → exempt
   - Adviser Group = `Self-Directed` or `Self Directed` → exempt

3. Classify:
   - **All rows exempt** → mark as `N/A — no RCTI expected`
   - **Any non-exempt row exists** → mark as `RCTI MISSING — genuine gap`, add to action list

### Category C — RCTI only (❌ invoice, ✅ RCTI)

These products have an RCTI but no invoice. Check the invoice flag detail:

- If the script flagged `⚠️ DUPLICATE` for this product → mark as `⚠️ DUPLICATE INVOICE — manual review needed`
- If invoice was DELETED in Xero (visible from original compact output) → mark as `INVOICE DELETED — manual review needed`
- Otherwise → mark as `INVOICE MISSING — genuine gap`, add to action list

### Category D — Neither (❌ invoice, ❌ RCTI)

Both are missing. Mark as `BOTH MISSING — genuine gap`, add both to action list.

### Flags

Any `⚠️` flag from the script output (duplicate invoices, duplicate RCTIs):
- List them separately
- Do not block the report — just surface for manual review

---

## Phase 3 — Produce Final Report

**Goal:** Deliver a clear, actionable summary. No further API calls.

### Report structure

```
RECONCILIATION — [Month Year]
[date run]
===================================================
Total products:        XX
✅ Both complete:      XX
N/A (exempt, no RCTI): XX  ← Cindy Mao / Self-Directed
⚠️  Flags (review):    XX
--- Genuine gaps ---
❌ Invoice missing:    XX
❌ RCTI missing:       XX
❌ Both missing:       XX
===================================================
```

Followed by two action lists:

**Invoices to create:**
- [product code] | [strike date] | [currency]

**RCTIs to create:**
- [product code] | [adviser group] | [settlement party] | [suffix]

And a flags section:
**Manual review required:**
- [product code] — [reason]

### What this report is used for
The action lists are handed off to the invoice/RCTI creation workflow. The reconciliation workflow ends here.

---

## Reference — Matching Rules

### Xero reference suffixes (NW, MS)

Invoice and RCTI references in Xero sometimes have a suffix derived from the **Settlement Party Adv** field (`fld4pYt0Ximcc9Y3z`) in AdviserFees:

| Settlement Party Adv | Suffix | Example |
|---|---|---|
| Mason Stevens | ` MS` (sometimes ` - MS`) | `NX 2026-04-6 MS` |
| NetWealth | ` NW` | `CG 2026-04-6 NW` |
| Stropro | none | `CG 2026-04-18` |
| blank | none | `MBL 2026-04-1` |

A product can have multiple AdviserFee rows with different suffixes (e.g. one NW and one MS trade). Both a suffixed invoice and a suffixed RCTI are expected — not a discrepancy.

**Matching rule (used by `reconcile.js`):**
```
ref === code  OR  ref.startsWith(code + ' ')
```
Never use `ref.startsWith(code)` without the trailing space — causes false matches on similar codes (e.g. `CG 2026-04-1` matching `CG 2026-04-10`).

### Canaccord bulk RCTIs

Canaccord products are not covered by individual per-product POs. They appear under a monthly bulk reference like `"Stropro April FCNs"`. The script detects this pattern automatically. If the bulk PO exists for the month, all Canaccord products for that month show ✅ RCTI.

### DELETED documents

- DELETED invoices → excluded from matching (treated as not existing)
- DELETED POs → excluded from matching (treated as not existing)

---

## Known Gaps (April 2026 as of 2026-05-15)

From reconciliation run — 55 products, 3 API calls.

**Raw counts:** 23 both complete | 23 invoice only | 8 neither | 1 flag

**Classified:**
- 7 CG products (04-8 through 04-14) → invoice only, all Cindy Mao → N/A, expected
- 16 products → genuine RCTI gap (NX 04-4/5/12-15, NOMU 04-2/3/4, BARC 04-2 through 06, BNP 04-1, C2 04-1)
- 8 products → both missing (MBL 04-1 through 04-4, NX 04-7 through 04-10)

**Manual review flags:**
- ⚠️ NOMU 2026-04-1 — 2 invoices: INV-0913 ($6,150 PAID) + INV-0914 ($1,370 PAID). RCTI exists (PO-0662). Extra charge unexplained.
- ⚠️ CG 2026-04-3 — 2 RCTIs: PO-0646 and PO-0647. Both active — confirm intentional.

---

## New Prefixes / Contacts Discovered

| Prefix | Company | Contact ID |
|---|---|---|
| MS | Morgan Stanley | `e3ffacf5-3999-4a3d-a0f2-e6601108c5fa` |
| C2 | Unknown | TBD |
| JPM | JP Morgan (assumed) | TBD |
