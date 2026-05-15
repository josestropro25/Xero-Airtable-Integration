# Xero MCP + Airtable → Invoice Automation
## Full Workflow Documentation & Claude Code Extension Guide

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Setup Journey & Lessons Learned](#3-setup-journey--lessons-learned)
4. [Airtable Data Model](#4-airtable-data-model)
5. [Xero Configuration](#5-xero-configuration)
6. [Invoice Creation Workflow](#6-invoice-creation-workflow)
7. [Purchase Order (RCTI) Workflow](#7-purchase-order-rcti-workflow)
8. [MCP Server Extensions](#8-mcp-server-extensions-completed)
9. [Common Errors & Fixes](#9-common-errors--fixes)
10. [Reference: IDs & Credentials](#10-reference-ids--credentials)

---

## 1. Project Overview

The goal is to automate the creation of **distribution fee invoices** and **RCTIs (purchase orders)** in Xero by pulling data from an **Airtable base** ("Distribution Tracker"), using Claude as the orchestration layer via the **Xero MCP server**.

> **Terminology — never mix these:**
> - **Invoice** = sales invoice to issuer bank (ACCREC). Created from product Upfront% × total sales.
> - **RCTI** = purchase order to adviser group (ACCPAY). Created from AdviserRev per sales row. Also called "purchase order" in Xero.

### Trigger
User says: _"Create invoice for product [CODE]"_ (e.g. `BARC 2026-04-2`)

### Output
A **draft invoice** in Xero with:
- Contact mapped from product code prefix
- Amount calculated as:
  - **Internal** (Settlement Party Adv = Stropro): `SUM(Sales.Amount[Cash]) × Product.Upfront%`
  - **External** (Mason Stevens / NetWealth): `SUM(Sales.Notional[Local]) × Product.Upfront%`
- Correct currency, dates, account, branding, and tax settings (see Section 6.1 / 6.1b)

---

## 2. Architecture

```
Claude Code (VS Code) / Claude Desktop
    │
    ├── Airtable MCP (cloud connector — mcp.airtable.com)
    │       └── Distribution Tracker base
    │               ├── Products table
    │               ├── Sales table
    │               └── AdviserFees table
    │
    └── Xero MCP (local, custom — xero-mcp-server/)
            └── StroPro Operations Pty Ltd (production)
```

### Claude Code Config (primary)
Local MCP servers are defined in `.mcp.json` at the repo root (gitignored — copy from `.mcp.json.example`):
```json
{
  "mcpServers": {
    "xero": {
      "command": "node",
      "args": ["<absolute-path-to-repo>/xero-mcp-server/dist/index.js"],
      "env": {
        "XERO_CLIENT_ID": "<your-client-id>",
        "XERO_CLIENT_SECRET": "<your-client-secret>",
        "XERO_SCOPES": "accounting.invoices accounting.payments accounting.banktransactions accounting.manualjournals accounting.contacts accounting.settings payroll.employees payroll.timesheets payroll.settings"
      }
    }
  }
}
```

> ⚠️ **IMPORTANT:** Local MCP servers must be in `.mcp.json`, NOT in `.claude/settings.json`. Entries in `settings.json` are silently ignored. After creating or editing `.mcp.json`, fully close and reopen VS Code.

### Claude Desktop Config (secondary)
```
C:\Users\Jose De la Hoz\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json
```
Points to the same local `xero-mcp-server/dist/index.js`. Use `taskkill /F /IM claude.exe /T` to fully quit before editing.

---

## 3. Setup Journey & Lessons Learned

### 3.1 Node.js Version Issue
**Problem:** The Xero MCP server requires Node `>=18.14.1`. Original version was `v18.12.1`.

**Error:**
```
npm WARN EBADENGINE Unsupported engine {
  package: '@hono/node-server@1.19.14',
  required: { node: '>=18.14.1' },
  current: { node: 'v18.12.1' }
}
```

**Fix:** Download and install the latest Node.js LTS from https://nodejs.org. Verify with:
```bash
node -v   # Should be v20+ or v22+
npm -v
npx -v
```

### 3.2 Missing npm Directory
**Problem:** After Node reinstall, npm global directory was missing.

**Error:**
```
npm ERR! code ENOENT
npm ERR! path C:\Users\Jose De la Hoz\AppData\Roaming\npm
npm ERR! errno -4058
```

**Fix:**
```bash
mkdir "C:\Users\Jose De la Hoz\AppData\Roaming\npm"
```

### 3.3 Config File JSON Syntax Error
**Problem:** Claude Desktop kept rewriting the config file and corrupting it.

**Error in logs:**
```
Error reading or parsing config file:
SyntaxError: Unexpected non-whitespace character after JSON at position 449
```

**Fix:** Strip out the `preferences` block entirely and keep only `mcpServers` in the config. Claude Desktop rewrites preferences automatically — mixing them causes corruption.

**How to check logs:**
```bash
type "C:\Users\Jose De la Hoz\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\logs\main.log" | findstr /i "xero mcp error config"
```

### 3.4 OAuth Scope Error
**Problem:** The MCP server uses `client_credentials` flow, which requires all requested scopes to be enabled on the Xero app. One missing scope blocks all authentication.

**Error:**
```
Failed to get Xero token with V2 scopes: 
{"error":"invalid_scope","error_description":"Client credentials scope validation failed"}
```

**Fix:** In the Xero Developer Portal → your app → Configuration → tick **ALL scope checkboxes**. Even one unticked scope causes the entire token request to fail.

**Working scopes (set via XERO_SCOPES env var):**
```
accounting.invoices accounting.payments accounting.banktransactions 
accounting.manualjournals accounting.contacts accounting.settings 
payroll.employees payroll.timesheets payroll.settings
```

### 3.5 Killing Claude Desktop Properly
Standard window close doesn't fully stop the process. Use:
```bash
taskkill /F /IM claude.exe /T
```
Then relaunch Claude Desktop. This is required after any config change.

---

## 4. Airtable Data Model

**Base:** Distribution Tracker (`appYvjM849EsLrpbW`)

### 4.1 Products Table (`tblbqpCqSdBvxqc6T`)

| Field Name | Field ID | Type | Used For |
|---|---|---|---|
| Product Key | `fldhGx67Z71G844a0` | Formula | Primary key |
| **Code** | `fldGwppKvbYFiTAsa` | Text | Invoice reference & contact lookup |
| Name/Theme | `fld6eiDriTyDiM7wG` | Text | - |
| **Strike Date (Approx)** | `fldRmizE67tvwOTc6` | Date | Invoice issue date |
| **Upfront %** | `fld6vw7Mj8aVJnYeD` | Percent | Price calculation |
| **Currency** | `fldUNJ9HydcFWOUPY` | Single Select | Invoice currency |
| Invoice | `fldaWMsYPbzvFaqr4` | Checkbox | Flag for invoicing |

### 4.2 Sales Table (`tblDF2DwnJecCmvE2`)

| Field Name | Field ID | Type | Used For |
|---|---|---|---|
| ID | `fldKUXgAlHYdAOFPy` | Auto Number | - |
| Product | `fldbye2NOk0tq8Xjh` | Lookup | Link to Products |
| **Amount [Cash]** | `fldrqlyC6R5O3qSDc` | Currency | SUM for invoice price |
| **Adviser Group** | `fldtIpJc1wNR2JzbW` | Lookup | RCTI contact grouping |
| **Notional [Local]** | `fldGnTn09blO0Q6rq` | Formula | RCTI notional; **external invoice** price/description (differs from Amount [Cash]) |
| **Adviser Fee %** | `fldRoRw2EZqTgxknp` | Lookup | RCTI price calculation |
| **Adviser(s)** | `fldU5LNEzPEWjtGIO` | Link | Individual adviser name for RCTI description |

### 4.3 Invoice Calculation Formula

Internal (Settlement Party Adv = Stropro):
```
Price = SUM(Sales.Amount[Cash] WHERE Product = [CODE]) × Products.Upfront%
```

External (Mason Stevens / NetWealth):
```
Price = SUM(Sales.Notional[Local] WHERE Product = [CODE]) × Products.Upfront%
```

**Examples:**
- Internal — `BARC 2026-04-2`: SUM(Amount[Cash]) = $200,000 × 2.65% = **$5,300 AUD**
- External — `CG 2026-03-15`: SUM(Notional[Local]) = $500,000 × 2.65% = **$13,250 USD** (INV-0873)
- External — `CG 2026-05-4 MS`: SUM(Notional[Local]) = $150,000 × 2.49% = **$3,735 AUD**

### 4.4 Critical: Exact Product Code Matching

The Sales `Product` lookup field stores values like `"CG 2026-03-1: 12M US Banks..."`. When filtering Sales rows by product code, always match using `code + ":"` — **never use a plain `startsWith(code)`**.

**Why:** `startsWith("CG 2026-03-1")` incorrectly matches `CG 2026-03-10`, `CG 2026-03-11`, etc., pulling in sales from other products and producing wrong amounts.

**Correct filter:** `name.startsWith("CG 2026-03-1:")`  
**Wrong filter:** `name.startsWith("CG 2026-03-1")`

---

## 5. Xero Configuration

> ⚠️ **All IDs below are for the PRODUCTION Stropro org.** Demo Company IDs are no longer used.

### 5.1 Organisation
- **Name:** StroPro Operations Pty Ltd
- **ID:** `5ea5440e-8a82-4a8b-85b9-089858c85ab1`
- **Short Code:** `!h-4cX`
- **Currency:** AUD
- **App Type:** Custom Connection

### 5.2 Contacts (Issuer Banks — for Invoices)

| Code Prefix | Xero Contact Name | Xero Contact ID |
|---|---|---|
| `BARC` | Barclays | `bc6678bd-156e-4e42-8608-b82d0b9248d4` |
| `BNP` | BNP Paribas | `1d4c50e0-88fd-42d3-b798-17693a587b15` |
| `CG` | Citi Group | `04ac1d3e-9f3f-4732-beba-bf6e0e862039` |
| `MF` | Marex Financial | `60465ff7-de0a-4e11-834b-345ef63fb83f` |
| `NX` | Natixis | `639522f0-204a-4251-84a2-e2d7dcc3c157` |
| `NOMU` | Nomura | `ee861c34-1069-4150-b128-7c41fc480f55` |
| `MBL` | Macquarie Bank Limited | `caec487e-9ea8-43fb-8570-a79159f85633` |

### 5.3 Accounts

| Code | Name | Type | Tax Type | Xero ID | Used For |
|---|---|---|---|---|---|
| `200` | Distribution fees - Advisory | Revenue | EXEMPTOUTPUT (GST Free Income) | `7797b245-d6a9-4638-aa9f-c292455333f7` | Invoices |
| `310` | Referral Fees - Distribution fees | Direct Costs | INPUT (GST on Expenses 10%) | `b0f93463-fddf-41d7-a730-f55d97bdd98d` | RCTIs |

> ⚠️ Invoice account is **200** in production (not 201 as in demo). Account 201 in Stropro is "Distribution fees - Self Managed" — different product.

### 5.4 Branding Themes

| Name | ID | Used For |
|---|---|---|
| **Standard** | `68901f31-8c32-40ae-b1bd-5fe9caaaabc9` | Internal invoices; external AUD invoices |
| **RCTI** | `05148358-30af-46a9-97f3-26e3ad572273` | All RCTIs (note: API may not apply — see PENDING.md item 12) |
| **Stropr Ops USD - Revenue** | `e0ad3aaa-50bc-468e-a117-b719b6dd5ed5` | External invoices in USD currency |
| StroproOps AUD | `9bca9998-20c1-41e1-b69a-238b628a185c` | Not used |

### 5.5 Tax Rates
- **Invoices:** GST Free Income — `NONE` — 0%
- **RCTIs (default):** GST on Expenses — `INPUT` — 10% — `lineAmountTypes: EXCLUSIVE`
- **RCTIs (Solomons):** BAS Excluded — `BASEXCLUDED` — 0% — `lineAmountTypes: NOTAX`

### 5.6 Adviser Group Contacts (for RCTIs)

| Adviser Group (Airtable) | Xero Contact Name | Xero Contact ID | Notes |
|---|---|---|---|
| Gloryhouse | GloryHouse Wealth Management | `46b4c223-4238-41ed-b3c0-634195d5f9a0` | Adviser always = **Yan Hu** |
| Solomons | Solomons Wealth Management Australian Pty Ltd | `d3511d0e-9392-41c7-8186-156ca6acd0e2` | Tax: BAS Excluded (`BASEXCLUDED`, `NOTAX`) — no GST |
| Life Unshackled | LifeUnshackled | `b9f0ac6e-79b9-4c60-ba54-4edf7dfa2b27` | Oliver Lawton |
| Canaccord | Canaccord Genuity Financial Limited - WIll Kenny | `fffe7d03-a05b-4daa-bbda-9749e37e26de` | **Bulk RCTI** pattern — see below |
| PY Financial | PY Financial | `0af54d87-8b4d-43e3-8e4b-09031cc30e8f` | Philip Yap — NOMU products |
| Harbour Bridge Capital | HARBOUR BRIDGE CAPITAL PTY LTD | `52b7b2e0-8f8c-496c-9f21-3686857abdcd` | All-caps in Xero |
| Granite Bay | Granite Bay - Steven Moon | `4c2f4779-d43d-4f8a-a98f-28e5bae14d07` | Bulk FCN pattern |

**Other Canaccord contacts (individual advisers):**
| Contact Name | Xero Contact ID |
|---|---|
| Canaccord Genuity Financial Limited - Michael Willet | `865f7e3a-1211-4ae4-a514-451ece4b94d4` |
| Canaccord Genuity Financial Limited - Tony Kinivan | `856f176c-b89b-4611-b753-a563255c1b7b` |
| Canaccord Genuity Financial Limited - Michael Re | `6737580a-945b-4d37-b0fd-b96201a661cc` |

### 5.7 Canaccord RCTI Pattern

Canaccord RCTIs require a **case-by-case check before creating**. The pattern depends on the data:

**Check the Canaccord sales rows first:**
- If the **same adviser** has trades across **multiple consecutive products** (e.g. the same person appears in BARC 2026-04-3, 04-4, 04-5, 04-6) → create **one bulk RCTI** to `Canaccord Genuity Financial Limited - WIll Kenny` with reference like `"Stropro April FCNs"` covering all products
- If it's a **single trade** or trades are spread across **different advisers** → assess individually

**Never create the bulk RCTI automatically. Always detect and ask first:**

> _"⚠️ I've detected [N] products under Canaccord in [Month]: [list]. Would you like a single bulk RCTI or individual ones?"_

**Grouping condition:** Same Canaccord adviser group + same month by **strike date** (not creation date).

Individual Canaccord contacts in Xero (for reference):
- WIll Kenny (bulk RCTI contact): `fffe7d03-a05b-4daa-bbda-9749e37e26de`
- Michael Willet: `865f7e3a-1211-4ae4-a514-451ece4b94d4`
- Tony Kinivan: `856f176c-b89b-4611-b753-a563255c1b7b`
- Michael Re: `6737580a-945b-4d37-b0fd-b96201a661cc`

---

## 6. Invoice Creation Workflow

Invoices are either **internal** or **external** depending on how the trade was settled:

| Type | Settlement Party Adv | Effect on invoice |
|---|---|---|
| Internal | Stropro (or blank) | Standard reference and description |
| External | Mason Stevens (`MS`) | Reference gets ` MS` suffix; description format differs |
| External | NetWealth (`NW`) | Reference gets ` NW` suffix; description format differs |
| TBD | Praemium | **Not yet defined.** Stop and ask the user how to handle Praemium before creating. |

**How to determine type:** Query AdviserFees (`tblnoxmwS2YM3Erjq`) for the product and read `Settlement Party Adv` (`fld4pYt0Ximcc9Y3z`). If the user specifies the type explicitly (e.g. "create the MS invoice for NX 2026-04-5"), use that directly without querying.

**Mixed settlement parties on one product:** A product may have multiple AdviserFee rows with different Settlement Party Adv values (e.g. one Stropro row + one Mason Stevens row).
- **For INVOICES:** create **one invoice per product**. The contact is the issuer bank regardless of settlement party. If the rows have mixed Settlement Party Adv values, stop and ask the user which to use.
- **For RCTIs:** create **one RCTI per (Adviser Group × Settlement Party Adv)** combination — see Section 7.2.

---

### 6.1 Invoice Spec — Internal (Settlement Party Adv = Stropro)

| Field | Value | Source |
|---|---|---|
| Contact | Issuer bank | Extracted from `product.Code` prefix |
| Issue Date | `product.Strike Date (Approx)` | Airtable Products |
| Due Date | Today's date | System |
| Invoice Number | Auto-generated by Xero | - |
| Reference | `product.Code` | Airtable Products |
| Branding Theme | Standard (`68901f31-8c32-40ae-b1bd-5fe9caaaabc9`) | Passed via `brandingThemeId` |
| Currency | `product.Currency` | Airtable Products |
| Amounts Are | No Tax | Passed via `lineAmountTypes: NOTAX` |
| Description | `Distribution Fees -- {product.Code}` | Calculated |
| Qty | 1 | Fixed |
| Price | `SUM(Amount[Cash]) × Upfront% / 100` | Calculated |
| Account | `200 - Distribution Fees - Advisory` | Fixed |
| Tax Rate | GST Free Income (`NONE`) | Fixed |
| Status | DRAFT | Fixed (review before approving) |

---

### 6.1b Invoice Spec — External (Settlement Party Adv = Mason Stevens or NetWealth)

All fields are identical to internal **except** Reference and Description:

| Field | Internal value | External value |
|---|---|---|
| Reference | `product.Code` | `product.Code` + ` MS` or ` NW` |
| Description | `Distribution Fees -- {product.Code}` | See format below |

**External description format (multi-line):**
```
{product.Code}
{product.ISIN}
{SUM(Notional[Local])} @ {Upfront%}
```

- `product.ISIN` comes from the ISIN field (`fldKuuUZJyI5AC2gp`) on the Products table
- `Notional[Local]` = `fldGnTn09blO0Q6rq` in the Sales table — **not** `Amount[Cash]`
- The third line shows the raw numbers — **do not calculate**, just display them
- Use `@` as the separator, with a space on each side
- Format the notional with commas and no decimal places (e.g. `500,000`); format the upfront as a percentage (e.g. `2.65%`) — no currency symbol, no dollar sign

**Example** (CG 2026-03-15, INV-0873):
```
CG 2026-03-15
XS3159470494
500,000 @ 2.65%
```
Price = 500,000 × 2.65% = 13,250 ✅

**Fields that differ from internal:**

| Field | Internal | External AUD | External USD |
|---|---|---|---|
| Reference | `product.Code` | `product.Code` + ` MS`/` NW` | `product.Code` + ` MS`/` NW` |
| Description | `Distribution Fees -- {product.Code}` | Multi-line format above | Multi-line format above |
| Account | `200 - Distribution Fees - Advisory` | `310 - Adviser Fees` | `310 - Adviser Fees` |
| Branding Theme | Standard (`68901f31-8c32-40ae-b1bd-5fe9caaaabc9`) | Standard (`68901f31-8c32-40ae-b1bd-5fe9caaaabc9`) | Stropr Ops USD - Revenue (`e0ad3aaa-50bc-468e-a117-b719b6dd5ed5`) |

**Price calculation for external invoices:** `SUM(Notional[Local]) × Upfront% / 100`
This differs from internal invoices which use `SUM(Amount[Cash]) × Upfront% / 100`.

Everything else (contact, date, currency, tax, status) is identical to the internal spec.

### 6.2 Product Code Structure

Product codes follow this format:
```
[ISSUER] [YEAR]-[MONTH]-[SEQUENCE]
```

| Segment | Description | Example |
|---|---|---|
| `ISSUER` | Issuer bank code (prefix) | `BARC`, `CG`, `NX` |
| `YEAR` | 4-digit year | `2026` |
| `MONTH` | 2-digit month | `04` = April |
| `SEQUENCE` | nth product created for that issuer in that month | `5` = fifth |

**Examples:**
- `CG 2026-03-1` → Citigroup, March 2026, 1st product that month for CG
- `BARC 2026-04-5` → Barclays, April 2026, 5th product that month for BARC

**Natural language inference:**
- "April 2026 products" → all codes matching `* 2026-04-*`
- "March BNP products" → all codes matching `BNP 2026-03-*`
- "All Nomura products" → all codes matching `NOMU *`

### 6.3 Contact Prefix Mapping

```
Mapping (Airtable prefix → Xero contact name):
BNP   → BNP Paribas
CG    → Citi Group        ← Note: "Citi Group" (two words) in Stropro Xero
MF    → Marex Financial
BARC  → Barclays
NOMU  → Nomura
NX    → Natixis
MBL   → Macquarie Bank Limited
```

### 6.4 Step-by-Step Claude Workflow

**User says:** `"Create invoice for NX 2026-04-5"` or `"Create the MS invoice for NX 2026-04-5"`

**Claude does:**

1. **Determine type (internal or external)**
   - If user specifies suffix explicitly ("MS invoice", "NW invoice") → use that, skip AdviserFees query
   - Otherwise → query AdviserFees (`tblnoxmwS2YM3Erjq`) for the product, read `Settlement Party Adv` (`fld4pYt0Ximcc9Y3z`)
     - Stropro or blank → internal
     - Mason Stevens → external, suffix ` MS`
     - NetWealth → external, suffix ` NW`

2. **Duplicate check** — call `xero:list-invoices` with reference prefix matching:
   - Internal: check for reference `= "NX 2026-04-5"`
   - External: check for reference starting with `"NX 2026-04-5 "` (catches both NW and MS variants)
   - **If found** → stop. Report the existing invoice. Do not proceed.
   - **If not found** → continue.

3. **Query Airtable Products** — filter by `Code = "NX 2026-04-5"`
   - Gets: Strike Date, Upfront%, Currency, **ISIN** (external only)

4. **Query Airtable Sales** — filter by `Product name startsWith "NX 2026-04-5:"` (**colon required**)
   - Internal: get SUM of `Amount [Cash]` (`fldrqlyC6R5O3qSDc`)
   - External: get SUM of `Notional [Local]` (`fldGnTn09blO0Q6rq`)

5. **Build the invoice fields:**
   - Reference: `product.Code` (internal) or `product.Code + " MS"/" NW"` (external)
   - Description: internal format or external format (see 6.1 / 6.1b)
   - Price: `SUM(Amount[Cash]) × Upfront% / 100` (internal) or `SUM(Notional[Local]) × Upfront% / 100` (external)

6. **Call `xero:create-invoice`** with all fields including `dueDate`, `currencyCode`, `lineAmountTypes`, and `brandingThemeId`

### 6.5 Multi-product Invoices

A single invoice can cover multiple products (one line item per product). This is useful when all products share the same issuer contact.

- Reference: list all codes e.g. `BARC 2026-04-3 / 04-4 / 04-5`
- Each product = one line item: `Distribution Fees -- {code}`, amount = SUM × Upfront%
- Use when the user says "create one invoice for these products"

### 6.6 Data Consistency Checks

Before creating an invoice, flag any of the following anomalies to the user — do not block creation, just report:

- **Upfront %** is not a round number (e.g. `1.40518%` instead of `1.4%`) — may indicate a data entry error in Airtable
- **Sales SUM is zero** — no sales rows found for the product
- **Strike Date** is in the future or more than 6 months in the past
- **Currency mismatch** — product currency doesn't match the expected issuer currency
- **FX Rate = 1** for a USD product — likely not yet set in Airtable, ask user for real rate

Report as: _"⚠️ Flag: [field] value is [value] — please confirm before finalising."_

### 6.7 Result Summary Format

Always report results in this format — **net amount only**, no GST-inclusive totals:

**Invoices:**

| Invoice | Contact | Reference | Net | Strike Date | Tax | Status |
|---|---|---|---|---|---|---|
| BARC 2026-04-2 | Barclays | BARC 2026-04-2 | $5,300 | 2026-04-28 | No Tax | DRAFT |
| CG 2026-05-4 MS | Citi Group | CG 2026-05-4 MS | $3,735 | 2026-05-06 | No Tax | DRAFT |

**RCTIs:**

| PO | Reference | Adviser | Contact | Net | Strike Date | Tax | Status |
|---|---|---|---|---|---|---|---|
| PO-0028 | BARC 2026-04-3/4/5/6 | Will Kenny | Canaccord Brisbane | $12,703 | 2026-04-28 | Exclusive | Submitted |
| PO-0690 | BARC 2026-05-1 | ⚠️ [Adviser name] | Solomons Wealth Management | $6,440 | 2026-05-15 | BAS Excl. | Submitted |

**Tax column values:** `No Tax`, `Exclusive`, `Inclusive`, `BAS Excl.`
**Adviser column:** if blank in Airtable, show `⚠️ [Adviser name]` to flag for manual update.

---

## 7. Purchase Order (RCTI) Workflow

Purchase orders are called **RCTIs** (Recipient-Created Tax Invoices). They represent the adviser fees paid out to each adviser group for their share of a product's sales.

> **Settlement party has no effect on RCTIs.** Whether the invoice was internal (Stropro) or external (Mason Stevens / NetWealth), the RCTI spec is identical — same contact, same reference (no suffix), same account, same format.

> **Language note:** The user refers to purchase orders as "RCTIs". Any of the following mean the same thing:
> - _"Create the RCTI for BARC 2026-03-4"_
> - _"Do the purchase orders for BARC 2026-03-4"_
> - _"Reconcile RCTIs with invoices"_

### 7.1 Trigger
User says: _"Create purchase orders for BARC 2026-03-4"_

### 7.2 Grouping Logic

Sales rows for a product are grouped by **(Adviser Group × Settlement Party Adv)**:
- **One PO per unique combination** of Adviser Group + Settlement Party Adv per product
- If the same group appears multiple times with the same Settlement Party → **one PO with multiple line items**
- If the same group appears with **different Settlement Party Adv values** (e.g. Gloryhouse / Stropro and Gloryhouse / Mason Stevens) → **separate PO per Settlement Party** — these settle differently and must not be merged
- If a product has multiple different Adviser Groups → **separate PO per group** (already the default)

**Multi-product RCTIs:** When multiple products share the same adviser group (common with Canaccord and same adviser), they can be consolidated into **one RCTI** with one line item per product:
- Reference: list all codes e.g. `BARC 2026-04-3 / 04-4 / 04-5 / 04-6`
- Date: earliest strike date across the products
- Each product = one line item with its own description, notional, fee, and FX rate if USD
- Triggered when user says "create one RCTI for these products" or lists multiple products for the same group

**Exceptions — skip and notify the user, do NOT create a PO:**
- Adviser Group = `"Cindi Mao"` → skip, report: _"Skipped: Cindi Mao — no PO required"_
- Adviser Group = `"Self-directed"` (shown as `"Self Directed"` in Airtable) → skip, report: _"Skipped: Self-directed sale — no PO required"_

**Tax exceptions by contact:**
- Adviser Group = `"Solomons"` → Tax: BAS Excluded (0%) — use `taxType: BASEXCLUDED`, `lineAmountTypes: NOTAX`
  All other adviser groups use GST on Expenses (`INPUT`, 10%, `lineAmountTypes: EXCLUSIVE`)

### 7.3 Step-by-Step Claude Workflow

**User says:** `"Create purchase orders for BARC 2026-03-4"`

**Claude does:**
1. Check Xero — call `xero:list-purchase-orders` filtered by `reference = "BARC 2026-03-4"`
   - **If found** → stop. Report existing POs (ID, status, adviser group, link). Do not proceed.
   - **If not found** → continue to step 2.
2. Query Airtable Products table filtered by `Code = "BARC 2026-03-4"`
   - Gets: Strike Date, Currency, FX Rate
3. Query Airtable Sales table — filter by `Product name startsWith "BARC 2026-03-4:"` (**colon required — see Section 4.4**)
   - Gets per row: Adviser Group, Settlement Party Adv (via AdviserFees), Notional [Local], Adviser Fee %, Adviser(s), AdviserRev[Local]
4. Filter out exception groups (`Cindi Mao`, `Self-directed`) — notify user for each skipped row
5. Group remaining rows by Adviser Group
6. For each Adviser Group:
   - Verify the group exists as a Xero contact (create if missing — notify user)
   - Build line items (one per sales row in the group)
   - Create one ACCPAY purchase order in Xero
7. Report all created POs with links
8. Remind user to tick the `RCTI` checkbox on the product in Airtable

### 7.4 Purchase Order Spec

| Field | Value | Source |
|---|---|---|
| Contact | Adviser Group name | `sales.AdviserGroup` |
| Date | Strike Date | `products.Strike Date (Approx)` |
| Delivery Date | Today | System |
| Order Number | Auto-generated | Xero |
| Reference | Product code | `products.Code` |
| Branding Theme | RCTI (`05148358-30af-46a9-97f3-26e3ad572273`) | Fixed (see Section 5.4) — note: API may not apply, see PENDING.md item 12 |
| Currency | AUD | Always — even for USD products |
| Tax (default) | GST on Expenses 10% — `INPUT` — `lineAmountTypes: EXCLUSIVE` | Section 5.5 |
| Tax (Solomons) | BAS Excluded 0% — `BASEXCLUDED` — `lineAmountTypes: NOTAX` | Exception, see Section 7.2 |

### 7.5 Line Item Spec

**For AUD products** (`products.Currency = AUD`):

| Field | Value |
|---|---|
| Description | `{products.Code}`<br>`{notional[Local]} @ {adviserFee%}`<br>`{adviser name(s)}` *(if blank, write `[Adviser name]` as placeholder and flag it in the summary)* |
| Qty | 1 |
| Price | `notional[Local] × adviserFee%` |
| Account | `310 - Referral Fees - Distribution fees` |
| Tax | GST on Expenses (10%) — Xero tax type: `INPUT` |

**For USD products** (`products.Currency = USD`):

| Field | Value |
|---|---|
| Description | `{products.Code}`<br>`Conversion Rate at {fx}`<br>`{notional[Local]} @ {adviserFee%}`<br>`{adviser name(s)}` *(if blank, write `[Adviser name]` as placeholder and flag it in the summary)* |
| Qty | 1 |
| Price | `(notional[Local] × adviserFee%) / fx` *(converts USD adviser fee to AUD)* |
| Account | `310 - Referral Fees - Distribution fees` |
| Tax | GST on Expenses (10%) — Xero tax type: `INPUT` |

> **FX Rate note:** `fx` is stored as AUD→USD (e.g., `0.7093` means 1 AUD = 0.7093 USD). Dividing by fx converts USD to AUD (e.g., $2,700 USD / 0.7093 ≈ $3,806 AUD). The FX field in Airtable may be `1` or outdated — **always ask the user for the current rate when creating RCTIs for USD products**.

> **Adviser Fee % note:** stored as decimal in Airtable (e.g., `0.015` = 1.5%). No `/100` needed.

> **Adviser name note:** if `Adviser(s)` field is blank, write `[Adviser name]` as a placeholder on the third description line — do not omit the line. Flag it in the summary table with ⚠️. **Exception:** if Adviser Group is `Gloryhouse`, always use `Yan Hu` regardless of what Airtable says.

> **RCTI checkbox note:** Claude does NOT tick the RCTI checkbox in Airtable (read-only rule). User must tick it manually after reviewing POs in Xero.

### 7.6 Pre-requisites Before Testing

1. **RCTI branding theme** — must be created manually in Xero (Settings → Invoice Settings → Branding Themes → Add). Then run `list-branding-themes` to get the ID.
2. **Adviser Group contacts** — exist in the real Xero org but not in Demo Company. Must be created before testing.
3. **Account 310** — verify it exists in Xero and get its ID via `list-accounts`.

---

## 8. Custom MCP Server (Implemented)

### 8.1 What Was Done
Forked `@xeroapi/xero-mcp-server` into `xero-mcp-server/` within this repo and extended `create-invoice` with four missing fields. Also added `list-branding-themes` tool.

### 8.2 Key Files Modified

```
xero-mcp-server/
├── src/
│   ├── tools/
│   │   ├── create/
│   │   │   ├── create-invoice.tool.ts           ← Added currencyCode, dueDate, lineAmountTypes, brandingThemeId
│   │   │   ├── create-purchase-order.tool.ts    ← New tool for RCTIs
│   │   │   └── index.ts                         ← Registered purchase order tool
│   │   └── list/
│   │       ├── list-branding-themes.tool.ts     ← New tool
│   │       └── index.ts                         ← Registered branding themes tool
│   └── handlers/
│       ├── create-xero-invoice.handler.ts       ← Passes new params to Xero API
│       ├── create-xero-purchase-order.handler.ts ← New handler for RCTIs
│       └── list-xero-branding-themes.handler.ts ← New handler
```

### 8.3 Build & Deploy
```bash
cd xero-mcp-server
npm install
npm run build
```

After building, the compiled output is at `xero-mcp-server/dist/index.js`. Point both `.mcp.json` (Claude Code) and `claude_desktop_config.json` (Claude Desktop) to this file. Fully close and reopen VS Code after any build.

---

## 9. Common Errors & Fixes

### Error: `invalid_scope`
```
Failed to get Xero token with V2 scopes: 
{"error":"invalid_scope","error_description":"Client credentials scope validation failed"}
```
**Cause:** One or more scopes in `XERO_SCOPES` not enabled on the Xero app.  
**Fix:** Go to Xero Developer Portal → App → Configuration → tick ALL scope boxes → save → restart Claude Desktop.

---

### Error: `Environment Variables not set`
```
Error: Environment Variables not set - please check your .env file
```
**Cause:** Running `npx @xeroapi/xero-mcp-server@latest` directly in terminal without env vars.  
**Fix:** This is expected when running manually. Claude Desktop injects the env vars from the config. It's not an error when running from Claude Desktop.

---

### Error: `Unexpected non-whitespace character after JSON`
```
SyntaxError: Unexpected non-whitespace character after JSON at position 449
```
**Cause:** Claude Desktop corrupted the config file by merging its own `preferences` block.  
**Fix:** Open the config file, replace entire contents with clean JSON containing only `mcpServers`. Remove the `preferences` block entirely.

---

### Error: MCP server not appearing in Claude Desktop
**Symptoms:** No `mcp-server-xero.log` in the logs folder, Xero tools not available.  
**Causes & Fixes:**
1. Config file has JSON syntax error → check with `type config.json`
2. Node.js version too old → upgrade to v20+
3. Missing npm directory → `mkdir "%APPDATA%\npm"`
4. Claude Desktop not fully restarted → `taskkill /F /IM claude.exe /T`

---

### Error: Due date wrong on invoice
**Cause:** Xero applies the contact's default payment terms (e.g. 30 days) when no due date is specified.  
**Fix:** Pass `dueDate` directly on `create-invoice` (supported in our custom MCP). No second update call needed.

---

### Error: Invoice created in AUD instead of USD
**Cause:** The upstream MCP server doesn't support `CurrencyCode` parameter.  
**Fix:** Pass `currencyCode` on `create-invoice` (supported in our custom MCP at `xero-mcp-server/`).

---

## 10. Reference: IDs & Credentials

### Xero App
| Item | Value |
|---|---|
| App Name | MCP Claude DEMO Company |
| Client ID | `70D9CF57F37244A6924FB8A5E1472885` |
| Client Secret | `nSw3wxIf1X3HjRomtcRapQJh3JCmNxqApuw6gM64xNkGIawl` |
| App Type | Custom Connection |
| Organisation | Demo Company (AU) |
| Org ID | `938e1bc2-a50c-4c6d-881b-4d765a758150` |

### Airtable
| Item | Value |
|---|---|
| Base Name | Distribution Tracker |
| Base ID | `appYvjM849EsLrpbW` |
| Products Table ID | `tblbqpCqSdBvxqc6T` |
| Sales Table ID | `tblDF2DwnJecCmvE2` |
| AdviserFees Table ID | `tblnoxmwS2YM3Erjq` |

### Key Xero IDs — Accounts (Production)
| Code | Name | ID |
|---|---|---|
| 200 | Distribution fees - Advisory (Invoices) | `7797b245-d6a9-4638-aa9f-c292455333f7` |
| 310 | Referral Fees - Distribution fees (RCTIs) | `b0f93463-fddf-41d7-a730-f55d97bdd98d` |

### Key Xero IDs — Issuer Bank Contacts (Production)
| Prefix | Xero Name | Contact ID |
|---|---|---|
| BARC | Barclays | `bc6678bd-156e-4e42-8608-b82d0b9248d4` |
| BNP | BNP Paribas | `1d4c50e0-88fd-42d3-b798-17693a587b15` |
| CG | Citi Group | `04ac1d3e-9f3f-4732-beba-bf6e0e862039` |
| MF | Marex Financial | `60465ff7-de0a-4e11-834b-345ef63fb83f` |
| NX | Natixis | `639522f0-204a-4251-84a2-e2d7dcc3c157` |
| NOMU | Nomura | `ee861c34-1069-4150-b128-7c41fc480f55` |
| MBL | Macquarie Bank Limited | `caec487e-9ea8-43fb-8570-a79159f85633` |

### Key Xero IDs — Adviser Group Contacts (Production)
See Section 5.6 for full list.

---

> 📝 **Next Steps:**
> 1. ~~Move to Claude Code~~ ✅
> 2. ~~Clone `xero-mcp-server` and add missing invoice fields~~ ✅
> 3. ~~Test with Demo Company~~ ✅ (invoices and RCTIs confirmed)
> 4. ~~Build Purchase Orders (RCTI) workflow~~ ✅
> 5. Build invoice reconciliation workflow (see PENDING.md item 6)
> 6. Migrate to production Xero org (see PENDING.md item 8)
