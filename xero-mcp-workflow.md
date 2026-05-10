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
7. [Known Limitations of the MCP Server](#7-known-limitations-of-the-mcp-server)
8. [Claude Code Extension Plan](#8-claude-code-extension-plan)
9. [Common Errors & Fixes](#9-common-errors--fixes)
10. [Reference: IDs & Credentials](#10-reference-ids--credentials)

---

## 1. Project Overview

The goal is to automate the creation of **distribution fee invoices** in Xero by pulling data from an **Airtable base** ("Distribution Tracker"), using Claude as the orchestration layer via the **Xero MCP server**.

### Trigger
User says: _"Create invoice for product [CODE]"_ (e.g. `BARC 2026-04-2`)

### Output
A **draft invoice** in Xero with:
- Contact mapped from product code prefix
- Amount calculated as `SUM(Sales.Amount[Cash]) × Product.Upfront%`
- Correct currency, dates, account, and tax settings

---

## 2. Architecture

```
Claude Desktop
    │
    ├── Airtable MCP (cloud connector)
    │       └── Distribution Tracker base
    │               ├── Products table
    │               ├── Sales table
    │               └── AdviserFees table
    │
    └── Xero MCP (local, custom)
            └── @xeroapi/xero-mcp-server
                    └── Demo Company (AU)
```

### Claude Desktop Config File Location
```
C:\Users\Jose De la Hoz\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json
```

### Current Config
```json
{
  "mcpServers": {
    "xero": {
      "command": "npx",
      "args": ["-y", "@xeroapi/xero-mcp-server@latest"],
      "env": {
        "XERO_CLIENT_ID": "70D9CF57F37244A6924FB8A5E1472885",
        "XERO_CLIENT_SECRET": "nSw3wxIf1X3HjRomtcRapQJh3JCmNxqApuw6gM64xNkGIawl",
        "XERO_SCOPES": "accounting.invoices accounting.payments accounting.banktransactions accounting.manualjournals accounting.contacts accounting.settings payroll.employees payroll.timesheets payroll.settings"
      }
    }
  }
}
```

> ⚠️ **IMPORTANT:** Claude Desktop rewrites this file automatically. If it stops working, check if the `mcpServers` block was overwritten. Use `taskkill /F /IM claude.exe /T` to fully quit Claude Desktop before editing.

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

### 4.3 Invoice Calculation Formula
```
Price = SUM(Sales.Amount[Cash] WHERE Product = [CODE]) × Products.Upfront%
```

**Example:**
- `BARC 2026-04-2`: SUM = $200,000 × 2.65% = **$5,300.00 AUD**
- `BARC 2026-04-3`: SUM = $120,000 × 2.65% = **$3,180.00 USD**

---

## 5. Xero Configuration

### 5.1 Organisation
- **Name:** Demo Company (AU)
- **ID:** `938e1bc2-a50c-4c6d-881b-4d765a758150`
- **Short Code:** `!08ZkX`
- **Currency:** AUD
- **App Type:** Custom Connection

### 5.2 Contacts (Issuer Banks)

| Code Prefix | Contact Name | Xero Contact ID |
|---|---|---|
| `BNP` | BNP Paribas | `cab01bf8-994a-476b-84e8-40e2ceecae92` |
| `CG` | Citigroup | `b2cc653e-9523-4215-bb6f-87f86d983728` |
| `MF` | Marex Financial | `374d776e-5992-43fb-ab2b-672b213feac3` |
| `BARC` | Barclays | `af46e4b2-7070-46fb-8e92-14917149bf3b` |
| `NOMU` | Nomura | `496b431f-ae61-4a9e-a118-f76ff81b9b09` |

> Each contact has been configured with:
> - **Sales defaults → Branding theme:** Standard
> - **Sales defaults → Amounts are:** (set as needed)

### 5.3 Account

| Code | Name | Type | Tax Type | Xero ID |
|---|---|---|---|---|
| `201` | Distribution Fees - Advisory | Revenue | EXEMPTOUTPUT (GST Free Income) | `44accb59-40c5-4dcc-b7e1-359fb21eb3c3` |

### 5.4 Tax Rate
- **Name:** GST Free Income
- **Tax Type:** `EXEMPTOUTPUT`
- **Rate:** 0%

---

## 6. Invoice Creation Workflow

### 6.1 Invoice Spec

| Field | Value | Source |
|---|---|---|
| Contact | Issuer bank | Extracted from `product.Code` prefix |
| Issue Date | `product.Strike Date (Approx)` | Airtable Products |
| Due Date | Today's date | System |
| Invoice Number | Auto-generated by Xero | - |
| Reference | `product.Code` | Airtable Products |
| Branding Theme | Standard | Contact default |
| Currency | `product.Currency` | Airtable Products |
| Amounts Are | No Tax | Contact default |
| Description | `Distribution Fees -- {product.Code}` | Calculated |
| Qty | 1 | Fixed |
| Price | `SUM(Amount[Cash]) × Upfront% / 100` | Calculated |
| Account | `201 - Distribution Fees - Advisory` | Fixed |
| Tax Rate | GST Free Income | Fixed |
| Status | DRAFT | Fixed (review before approving) |

### 6.2 Contact Prefix Mapping Logic
```
Code: "BARC 2026-04-2"
       ^^^^
       Prefix = "BARC" → Contact = Barclays

Code: "BNP 2026-03-1"
       ^^^
       Prefix = "BNP" → Contact = BNP Paribas

Mapping:
BNP   → BNP Paribas
CG    → Citigroup
MF    → Marex Financial
BARC  → Barclays
NOMU  → Nomura
```

### 6.3 Step-by-Step Claude Workflow

**User says:** `"Create invoice for BARC 2026-04-2"`

**Claude does:**
1. Query Airtable Products table filtered by `Code = "BARC 2026-04-2"`
   - Gets: Strike Date, Upfront%, Currency
2. Query Airtable Sales table filtered by `Product contains "BARC 2026-04-2"`
   - Gets: SUM of `Amount [Cash]`
3. Calculate: `Price = SUM × Upfront%`
4. Extract prefix `BARC` → map to Xero Contact ID
5. Call `xero:create-invoice` with all fields
6. Call `xero:update-invoice` to set the correct due date (today)
   - ⚠️ Due date must be set via update because Xero applies contact default terms on creation

---

## 7. Known Limitations of the MCP Server

The current `@xeroapi/xero-mcp-server@latest` does **not** support these fields on invoice creation:

| Missing Field | Xero API Parameter | Impact |
|---|---|---|
| Currency | `CurrencyCode` | USD invoices created in AUD by default |
| Amounts Are | `LineAmountTypes` | Defaults to `EXCLUSIVE`, not `NOTAX` |
| Branding Theme | `BrandingThemeID` | Must be set on contact as default |
| Due Date on create | `DueDate` | Must be set via a second update call |

### Workarounds Currently In Use
1. **Branding theme** → Set "Standard" as default on each contact in Xero ✅
2. **Amounts Are** → Set as default on each contact in Xero ✅
3. **Due Date** → Create invoice, then immediately update it with correct due date ✅
4. **Currency** → ⚠️ Not solved yet — requires MCP extension (see Section 8)

---

## 8. Claude Code Extension Plan

### 8.1 Goal
Fork and modify `@xeroapi/xero-mcp-server` to add:
- `CurrencyCode` parameter to `create-invoice`
- `LineAmountTypes` parameter to `create-invoice`
- `BrandingThemeID` parameter to `create-invoice`
- `DueDate` parameter to `create-invoice` (eliminate the need for a second update call)

### 8.2 Setup Steps

**1. Clone/copy the source:**
```bash
cd C:\Users\Jose De la Hoz
git clone https://github.com/XeroAPI/xero-mcp-server.git xero-mcp-custom
cd xero-mcp-custom
npm install
```

**2. Key files to modify:**
```
xero-mcp-custom/
├── src/
│   ├── tools/
│   │   └── accounting/
│   │       └── create-invoice.tool.ts      ← Add new parameters here
│   ├── handlers/
│   │   └── accounting/
│   │       └── create-invoice.handler.ts   ← Pass parameters to Xero API here
│   └── clients/
│       └── xero-client.ts                  ← Authentication (already working)
```

**3. Changes to `create-invoice.tool.ts`:**
Add to the input schema:
```typescript
currencyCode: {
  type: "string",
  description: "Currency code e.g. AUD, USD, GBP",
  optional: true
},
lineAmountTypes: {
  type: "string", 
  enum: ["EXCLUSIVE", "INCLUSIVE", "NOTAX"],
  description: "How tax is applied to line items",
  optional: true
},
brandingThemeId: {
  type: "string",
  description: "Xero Branding Theme ID",
  optional: true
},
dueDate: {
  type: "string",
  description: "Due date in YYYY-MM-DD format",
  optional: true
}
```

**4. Changes to `create-invoice.handler.ts`:**
```typescript
const invoice: Invoice = {
  type: params.type,
  contact: { contactID: params.contactId },
  date: params.date,
  dueDate: params.dueDate,           // ← ADD
  currencyCode: params.currencyCode, // ← ADD
  lineAmountTypes: params.lineAmountTypes, // ← ADD
  brandingTheme: params.brandingThemeId    // ← ADD
    ? { brandingThemeID: params.brandingThemeId }
    : undefined,
  lineItems: params.lineItems,
  reference: params.reference,
  status: Invoice.StatusEnum.DRAFT
};
```

**5. Build:**
```bash
npm run build
```

**6. Update `claude_desktop_config.json` to use local version:**
```json
{
  "mcpServers": {
    "xero": {
      "command": "node",
      "args": ["C:/Users/Jose De la Hoz/xero-mcp-custom/dist/index.js"],
      "env": {
        "XERO_CLIENT_ID": "70D9CF57F37244A6924FB8A5E1472885",
        "XERO_CLIENT_SECRET": "nSw3wxIf1X3HjRomtcRapQJh3JCmNxqApuw6gM64xNkGIawl",
        "XERO_SCOPES": "accounting.invoices accounting.payments accounting.banktransactions accounting.manualjournals accounting.contacts accounting.settings payroll.employees payroll.timesheets payroll.settings"
      }
    }
  }
}
```

**7. Restart Claude Desktop:**
```bash
taskkill /F /IM claude.exe /T
```
Then relaunch.

### 8.3 Getting the Standard Branding Theme ID
You'll need the Branding Theme ID to pass it in the invoice. Call this in Claude after the MCP is working:
```
List all Xero branding themes
```
Or via the API:
```
GET https://api.xero.com/api.xro/2.0/BrandingThemes
```

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
**Fix:** Always call `xero:update-invoice` immediately after `xero:create-invoice` to set the correct due date.

---

### Error: Invoice created in AUD instead of USD
**Cause:** The current MCP server doesn't support `CurrencyCode` parameter.  
**Fix (temporary):** Manually change currency in Xero.  
**Fix (permanent):** Extend the MCP server (see Section 8).

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

### Key Xero IDs
| Item | Value |
|---|---|
| Account 201 ID | `44accb59-40c5-4dcc-b7e1-359fb21eb3c3` |
| BNP Paribas Contact ID | `cab01bf8-994a-476b-84e8-40e2ceecae92` |
| Citigroup Contact ID | `b2cc653e-9523-4215-bb6f-87f86d983728` |
| Marex Financial Contact ID | `374d776e-5992-43fb-ab2b-672b213feac3` |
| Barclays Contact ID | `af46e4b2-7070-46fb-8e92-14917149bf3b` |
| Nomura Contact ID | `496b431f-ae61-4a9e-a118-f76ff81b9b09` |

---

> 📝 **Next Steps:**
> 1. Move to Claude Code
> 2. Clone `xero-mcp-server` and add missing invoice fields
> 3. Test with Demo Company
> 4. Once working, apply the same pattern to build the **Purchase Orders** workflow
