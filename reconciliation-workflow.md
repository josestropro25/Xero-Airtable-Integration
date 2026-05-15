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

Any of the following phrasings trigger this workflow:
- _"Reconcile April 2026"_
- _"Reconciliation for April 2026"_
- _"Do a rec of the invoices and RCTIs for April"_
- _"Let's do a rec for April"_
- _"Have we done all invoices and RCTIs for April?"_
- Any other request using `rec`, `reconcile`, or `reconciliation` together with a month

Extract the month and year, then derive the date range: first day of month → first day of next month (e.g. `2026-04-01` → `2026-05-01`).

**If the request is ambiguous, ask the user — do not infer.** Specifically:
- **Year not given** (e.g. just "April") → ask: _"Which year — April 2026?"_ Do not silently default to the current year or the most recent past occurrence.
- **Month not given** (e.g. "rec the invoices") → ask which month.
- **Scope unclear** (e.g. "rec these products" with no list) → ask which products or period.

Only proceed once the month and year are confirmed.

---

## 3. Context Management Rules

A full reconciliation run covers ~55 products across 3 data sources. These rules prevent context exhaustion.

### How data flows — read this first
Every API tool result lands in context automatically — you cannot prevent this. A full Airtable products response (~55 records) and a full Xero POs response (~700 lines) will both enter context whether you want them to or not. Left alone, they consume most of the context window before the reconciliation is even half done.

The fix: **immediately after receiving each API response, use the Write tool to save it to a file on disk.** The `reconcile.js` script reads from files — not from context. Once saved to disk, the in-context copy serves no purpose and can be ignored. If context later compresses or rolls over, the data is safe on disk and the script still runs.

**Never rely on context to hold reconciliation data between steps.**

### Rules
- **After every API call: write the response to disk** unless Claude already auto-saved it. Some large tool results (e.g. Xero POs, often 700+ lines) are auto-saved to a tool-results folder and Claude returns the file path — in that case, just note the path and skip the manual Write. For smaller responses (Airtable ~55 records, Xero invoices compact ~300 tokens) Claude does *not* auto-save — use the Write tool yourself.
- **Use `compact=true` for Xero invoices.** Returns ~5 tokens per invoice vs ~200 verbose. Never fetch verbose for a bulk run.
- **Never make one Xero API call per product.** Always date-range bulk fetches — 3 calls total for the entire month.
- **All cross-referencing runs in Node.js, not in conversation.** Do not loop products in context. Write files, run script, paste ~50-line output.
- **Fetch all 3 sources in parallel** — issue all three tool calls in a *single message* (multiple tool_use blocks). Sequential calls waste round-trips and burn cache.
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

Paste the full output (~50 lines) into the conversation. Do not interpret yet — that's Phase 2.

**Compact invoice file format** (one line per invoice; for reference if writing your own parsing):
```
Reference | InvoiceNumber | Status | Currency | Net
CG 2026-04-6 NW | INV-0881 | PAID | AUD | 3910
NX 2026-04-1 - MS | INV-0886 | AUTHORISED | USD | 4250
```

---

## Phase 2 — Classify Results

**Goal:** For every product not showing ✅ on both, determine whether the gap is genuine or expected.
**No API calls in this phase** unless explicitly needed for a specific investigation.

The script outputs four categories. Work through each:

### Category A — ✅ Both complete
No action. Skip.

### Category B — Invoice only (✅ invoice, ❌ RCTI)

These products have an invoice in Xero but no RCTI. Before treating as a genuine gap, check whether an RCTI was ever expected.

**Bulk-query AdviserFees once for ALL Category B products at the start of Phase 2** (single API call). Filter by Strike Date for the period being reconciled — same date range as Phase 1:

```json
{
  "operator": "and",
  "operands": [
    {"operator": ">=", "operands": ["fldM6hUDPQMy0KEk6", {"mode": "exactDate", "exactDate": "YYYY-MM-01", "timeZone": "Australia/Sydney"}]},
    {"operator": "<",  "operands": ["fldM6hUDPQMy0KEk6", {"mode": "exactDate", "exactDate": "YYYY-(MM+1)-01", "timeZone": "Australia/Sydney"}]}
  ]
}
```

Fetch fields:
- Adviser Group (`fldz9bz3z1ZO2BFpj`)
- Settlement Party Adv (`fld4pYt0Ximcc9Y3z`)
- Product (`fldh9LunXPaSlSu26`) — to match rows back to product codes

**For each Category B product, apply this logic:**

1. Look up all AdviserFee rows for the product from the bulk response.
2. Apply exemption rules — if **all** AdviserFee rows are exempt, no RCTI is expected:
   - Adviser Group = `Cindy Mao` → exempt
   - Adviser Group = `Self-Directed` or `Self Directed` → exempt
3. Classify:
   - **All rows exempt** → mark as `N/A — no RCTI expected`
   - **Any non-exempt row exists** → mark as `RCTI MISSING — genuine gap`, add to action list with `(Adviser Group, Settlement Party Adv)` per non-exempt row (one RCTI per unique combination — see `xero-mcp-workflow.md` Section 7.2)

> **Settlement Party Adv usage:** Phase 2 uses it only to populate the action list in Phase 3 — not to decide exemption. Exemption is by Adviser Group only.

### Category C — RCTI only (❌ invoice, ✅ RCTI)

These products have an RCTI but no invoice. Check the script output:

- If the script flagged `⚠️ DUPLICATE` invoices for this product (invoices exist but are flagged ambiguous, so script shows ❌ on the invoice column): treat as **RCTI status is fine; invoice review needed.** Surface in the flags section, do **not** add to either action list.
- If invoice was DELETED in Xero (visible in the compact output, status `DELETED`): mark as `INVOICE DELETED — manual review needed`. Do not add to action list.
- Otherwise → mark as `INVOICE MISSING — genuine gap`, add to invoice action list.

### Category D — Neither (❌ invoice, ❌ RCTI)

Both missing. Apply the same AdviserFees exemption check as Category B:
- If all AdviserFee rows for the product are exempt (Cindy Mao / Self-Directed) → the RCTI side is `N/A`; only the invoice goes to the action list.
- Otherwise → both go to the action list.

### Edge case: ⚠️ Invoice flag + missing RCTI

A product can show `⚠️ INV-XXXX, INV-YYYY` (duplicate invoices) **AND** `❌ Missing` RCTI. The script classifies this under Category C (because the invoice column doesn't start with `✅`), but it is really a Category B with a flag. Reclassify:
- Add to RCTI action list (treat as Category B for RCTI purposes — run the AdviserFees exemption check)
- Also surface the duplicate invoice in the flags section for manual review

### Flags

Any `⚠️` flag from the script output (duplicate invoices, duplicate RCTIs):
- List in the flags section of Phase 3
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
- [product code] | [strike date] | [currency] | [internal/external + suffix]

**RCTIs to create:**
- [product code] | [adviser group] | [settlement party] | [strike date]

> **Adviser names are NOT fetched here.** The reconciliation workflow stops at adviser group. The creation workflow re-queries Sales/AdviserFees to get the individual adviser name (e.g. "Yan Hu" for Gloryhouse). This keeps reconciliation to 3 + 1 API calls total.

> **Praemium handling:** If a Category B product has Settlement Party Adv = Praemium, list it in the RCTI action list with `[settlement party] = Praemium`, `[suffix] = TBD`. The creation workflow will stop and ask the user how to handle Praemium (the suffix and account treatment are not yet defined — see `xero-mcp-workflow.md` Section 6).

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

## New Prefixes / Contacts Discovered

These prefixes were discovered during reconciliation runs but are not yet in `xero-mcp-workflow.md` Section 5.2 as fully-mapped issuer contacts. Move into Section 5.2 once confirmed.

| Prefix | Company | Xero Contact ID |
|---|---|---|
| MS | Morgan Stanley | `e3ffacf5-3999-4a3d-a0f2-e6601108c5fa` |
| C2 | Unknown — TBD | TBD |
| JPM | JP Morgan (assumed) | TBD |

> **Terminology collision:** The product prefix `MS` (Morgan Stanley as issuer) is different from the reference suffix ` MS` (Mason Stevens as settlement custodian). They look similar but mean different things — distinguish by context (prefix at the start of the code, suffix after a space).

---

## Historical runs

Past reconciliation snapshots are kept in `archives/` for reference, e.g.:
- `archives/reconciliation-2026-04.md` — April 2026 run results
