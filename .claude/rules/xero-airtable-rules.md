# Xero–Airtable Domain Rules

## Terminology — never mix
- **Invoice** = ACCREC sales invoice to issuer bank
- **RCTI** = purchase order to adviser group (user calls POs "RCTIs")
- Never call an RCTI an invoice or vice versa.

## Airtable is read-only
Never modify, create, or delete Airtable records under any circumstances.

## Exact product code matching
When filtering Sales by product code, always use `name.startsWith(code + ":")`.
Never use `name.startsWith(code)` — causes false matches (CG 2026-03-1 matches CG 2026-03-10).

## Product date filter
Always filter products by the **Strike Date** field — not by string pattern in the product code.
Strike Date is the authoritative date for determining which month a product belongs to.

## USD products
Always ask the user for the FX rate before creating an RCTI for a USD product.
FX format: AUD→USD (e.g. 0.7099 = 1 AUD = 0.7099 USD). Convert: `Price AUD = USD amount / fx_rate`.

## Canaccord RCTI — detect and ask
Never auto-create a bulk Canaccord RCTI. If multiple Canaccord products share the same strike date month, flag it:
> "⚠️ I've detected [N] products under Canaccord in [Month]: [list]. Bulk or individual?"

## Duplicate check — always first
Before creating any invoice or RCTI, check Xero for an existing document with that reference. Stop if found.

## RCTI exceptions — skip and notify
- Adviser Group = "Cindi Mao" → no RCTI
- Adviser Group = "Self-directed" / "Self Directed" → no RCTI

## Gloryhouse adviser name
Always use "Yan Hu" for Gloryhouse, even if the Airtable Adviser field is blank.

## Reconciliation — token efficiency
Never make one Xero API call per product. Use date-range bulk fetches (3 calls total), process locally in Node.js, output summary only.
