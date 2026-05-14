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

## Reference suffix from Settlement Party Adv
When building the Xero reference for an invoice or RCTI, check the **Settlement Party Adv** field (`fld4pYt0Ximcc9Y3z`) in the AdviserFees table:
- `Mason Stevens` → append ` MS` → e.g. `CG 2026-04-2 MS`
- `NetWealth` → append ` NW` → e.g. `CG 2026-04-6 NW`
- `Stropro` or blank → no suffix → e.g. `CG 2026-04-18`

When matching existing Xero references back to product codes (duplicate check, reconciliation):
- Match if `ref === code` OR `ref.startsWith(code + " ")`
- Never match `ref.startsWith(code)` without the trailing space — causes false matches on similar codes

## Duplicate check — always first
Before creating any invoice or RCTI, check Xero for an existing document with that reference. Stop if found.
When checking, search by product code prefix: an existing `CG 2026-04-6 NW` counts as a match for product `CG 2026-04-6`.

## RCTI exceptions — skip and notify
- Adviser Group = "Cindi Mao" → no RCTI
- Adviser Group = "Self-directed" / "Self Directed" → no RCTI

## Gloryhouse adviser name
Always use "Yan Hu" for Gloryhouse, even if the Airtable Adviser field is blank.

## Reconciliation — token efficiency
Never make one Xero API call per product. Use date-range bulk fetches (3 calls total), process locally in Node.js, output summary only.
