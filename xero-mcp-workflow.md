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
Claude Code (VS Code) / Claude Desktop
    │
    ├── Airtable MCP (cloud connector — mcp.airtable.com)
    │       └── Distribution Tracker base
    │               ├── Products table
    │               ├── Sales table
    │               └── AdviserFees table
    │
    └── Xero MCP (local, custom — xero-mcp-server/)
            └── Demo Company (AU)
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
| `NX` | Natixis | `b27ed1ba-56e2-44f4-892e-6182f25992cf` |

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
| Branding Theme | Standard (`aefae6d5-7bbe-4e2e-aadc-302cd07a0fc1`) | Passed via `brandingThemeId` |
| Currency | `product.Currency` | Airtable Products |
| Amounts Are | No Tax | Passed via `lineAmountTypes: NOTAX` |
| Description | `Distribution Fees -- {product.Code}` | Calculated |
| Qty | 1 | Fixed |
| Price | `SUM(Amount[Cash]) × Upfront% / 100` | Calculated |
| Account | `201 - Distribution Fees - Advisory` | Fixed |
| Tax Rate | GST Free Income | Fixed |
| Status | DRAFT | Fixed (review before approving) |

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
Mapping:
BNP   → BNP Paribas
CG    → Citigroup
MF    → Marex Financial
BARC  → Barclays
NOMU  → Nomura
NX    → Natixis
```

### 6.4 Step-by-Step Claude Workflow

**User says:** `"Create invoice for BARC 2026-04-2"`

**Claude does:**
1. Query Airtable Products table filtered by `Code = "BARC 2026-04-2"`
   - Gets: Strike Date, Upfront%, Currency
2. Query Airtable Sales table filtered by `Product contains "BARC 2026-04-2"`
   - Gets: SUM of `Amount [Cash]`
3. Calculate: `Price = SUM × Upfront%`
4. Extract prefix `BARC` → map to Xero Contact ID
5. Call `xero:create-invoice` with all fields including `dueDate`, `currencyCode`, `lineAmountTypes`, and `brandingThemeId`

---

## 7. MCP Server Extensions (Completed)

The upstream `@xeroapi/xero-mcp-server@latest` was missing four fields on invoice creation. All four have been added to our custom fork at `xero-mcp-server/`:

| Field | Xero API Parameter | Status |
|---|---|---|
| Currency | `currencyCode` | ✅ Added — USD/AUD/GBP work correctly |
| Amounts Are | `lineAmountTypes` | ✅ Added — pass `NOTAX`, `EXCLUSIVE`, or `INCLUSIVE` |
| Branding Theme | `brandingThemeId` | ✅ Added — Standard ID: `aefae6d5-7bbe-4e2e-aadc-302cd07a0fc1` |
| Due Date on create | `dueDate` | ✅ Added — no second update call needed |

A `list-branding-themes` tool was also added to retrieve theme IDs on demand.

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
│   │   │   └── create-invoice.tool.ts        ← Added 4 new parameters
│   │   └── list/
│   │       ├── list-branding-themes.tool.ts  ← New tool
│   │       └── index.ts                      ← Registered new tool
│   └── handlers/
│       ├── create-xero-invoice.handler.ts    ← Passes new params to Xero API
│       └── list-xero-branding-themes.handler.ts ← New handler
```

### 8.3 Build & Deploy
```bash
cd xero-mcp-server
npm install
npm run build
```

After building, the compiled output is at `xero-mcp-server/dist/index.js`. Point both `.mcp.json` (Claude Code) and `claude_desktop_config.json` (Claude Desktop) to this file.

### 8.3 Branding Theme IDs (Demo Company AU)

| Name | ID |
|---|---|
| Standard | `aefae6d5-7bbe-4e2e-aadc-302cd07a0fc1` |
| Special Projects | `dfe23d27-a3a6-4ef3-a5ca-b9e02b142dde` |
| Very orange invoice! | `2ced98b8-3be9-42c4-ae79-fe3c8bca3490` |

To fetch themes in future, use the `list-branding-themes` tool (added to this MCP server).

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

### Key Xero IDs
| Item | Value |
|---|---|
| Account 201 ID | `44accb59-40c5-4dcc-b7e1-359fb21eb3c3` |
| BNP Paribas Contact ID | `cab01bf8-994a-476b-84e8-40e2ceecae92` |
| Citigroup Contact ID | `b2cc653e-9523-4215-bb6f-87f86d983728` |
| Marex Financial Contact ID | `374d776e-5992-43fb-ab2b-672b213feac3` |
| Barclays Contact ID | `af46e4b2-7070-46fb-8e92-14917149bf3b` |
| Nomura Contact ID | `496b431f-ae61-4a9e-a118-f76ff81b9b09` |
| Natixis Contact ID | `b27ed1ba-56e2-44f4-892e-6182f25992cf` |

---

> 📝 **Next Steps:**
> 1. ~~Move to Claude Code~~ ✅
> 2. ~~Clone `xero-mcp-server` and add missing invoice fields~~ ✅
> 3. ~~Test with Demo Company~~ ✅ (BARC 2026-04-2 AUD + BARC 2026-04-3 USD confirmed)
> 4. Apply the same pattern to build the **Purchase Orders** workflow
