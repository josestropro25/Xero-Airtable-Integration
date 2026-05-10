# Troubleshooting Guide

Issues encountered setting up and running the Xero–Airtable invoice automation. Organised by area.

---

## Table of Contents
1. [Xero MCP Server — Setup](#1-xero-mcp-server--setup)
2. [Claude Code — MCP Configuration](#2-claude-code--mcp-configuration)
3. [Claude Desktop — MCP Configuration](#3-claude-desktop--mcp-configuration)
4. [Airtable MCP](#4-airtable-mcp)
5. [Invoice Creation](#5-invoice-creation)
6. [Git & Repository](#6-git--repository)
7. [TypeScript Build](#7-typescript-build)

---

## 1. Xero MCP Server — Setup

### Node.js version too old

**Symptom:**
```
npm WARN EBADENGINE Unsupported engine {
  package: '@hono/node-server@1.19.14',
  required: { node: '>=18.14.1' },
  current: { node: 'v18.12.1' }
}
```

**Fix:** Install Node.js v20+ from https://nodejs.org. Verify:
```bash
node -v   # Should be v20+
npm -v
```

---

### Missing npm directory after Node reinstall

**Symptom:**
```
npm ERR! code ENOENT
npm ERR! path C:\Users\...\AppData\Roaming\npm
npm ERR! errno -4058
```

**Fix:**
```bash
mkdir "%APPDATA%\npm"
```

---

### `dist/` folder missing — MCP server won't start

**Symptom:** Claude Code or Claude Desktop can't find `dist/index.js`. The `dist/` folder is gitignored and not committed.

**Fix:** Build the server after cloning:
```bash
cd xero-mcp-server
npm install
npm run build
```
Run this any time you pull changes to `xero-mcp-server/src/`.

---

### Environment Variables not set

**Symptom:**
```
Error: Environment Variables not set - please check your .env file
```

**Cause:** Running `node dist/index.js` directly in the terminal without the required env vars. The MCP server is designed to be launched by Claude Code or Claude Desktop, which inject the env vars from `.mcp.json` or `claude_desktop_config.json`.

**Fix:** This error is expected if you run the server manually. It is not an error when Claude Code or Claude Desktop launches it. Do not run the server directly — let the host application start it.

---

### Xero OAuth scope error

**Symptom:**
```
Failed to get Xero token with V2 scopes:
{"error":"invalid_scope","error_description":"Client credentials scope validation failed"}
```

**Cause:** One or more scopes in `XERO_SCOPES` are not enabled on the Xero Developer app. Even one unticked scope blocks the entire token request.

**Fix:** Go to Xero Developer Portal → your app → Configuration → tick **all** scope checkboxes → save. Required scopes:
```
accounting.invoices accounting.payments accounting.banktransactions
accounting.manualjournals accounting.contacts accounting.settings
payroll.employees payroll.timesheets payroll.settings
```

---

## 2. Claude Code — MCP Configuration

### Xero MCP tools not appearing in Claude Code

**Symptom:** No `mcp__xero__*` tools available. Only cloud connectors (`mcp__claude_ai_*`) appear.

**Root cause — most common:** `mcpServers` defined in `.claude/settings.json` is **silently ignored**. That key is not valid in `settings.json`. The schema rejects it without any visible error.

**Fix:** Define local MCP servers in `.mcp.json` at the project root, not in `settings.json`:
```json
{
  "mcpServers": {
    "xero": {
      "command": "node",
      "args": ["<absolute-path>/xero-mcp-server/dist/index.js"],
      "env": { ... }
    }
  }
}
```

Then add this to `.claude/settings.json` to auto-approve it:
```json
{ "enableAllProjectMcpServers": true }
```

---

### MCP tools still not appearing after creating `.mcp.json`

**Symptom:** `.mcp.json` exists and looks correct, but Xero tools still don't appear.

**Cause:** Claude Code reads `.mcp.json` at startup. A window reload (`Developer: Reload Window`) may not be enough if the file was missing when VS Code first launched.

**Fix:** Fully close VS Code (File → Exit) and reopen it. A window reload is not sufficient for picking up a newly created `.mcp.json`.

---

### `settings.json` reported as broken symlink in logs

**Symptom:** In the Claude VSCode extension log:
```
Broken symlink or missing file encountered for settings.json at path:
c:\...\Xero-Airtable-Integration\.claude\settings.json
```

**Cause:** This error appeared in earlier sessions when `.claude/settings.json` did not yet exist. It is not harmful — Claude Code logs this for any missing optional config file. Once the file exists and VS Code is fully restarted, the error stops.

**Fix:** Ensure `.claude/settings.json` exists (even with just `{}`) and do a full VS Code restart.

---

### VS Code Source Control shows two repositories

**Symptom:** The VS Code Source Control panel shows `Xero-Airtable-Integration` and `xero-mcp-server` as separate repos.

**Cause:** `xero-mcp-server/` was originally cloned with `git clone`, which left a nested `.git` directory. VS Code cached it as a separate repository. Even after removing the nested `.git`, VS Code retains the discovery.

**Fix:** Do a window reload (`Ctrl+Shift+P` → Developer: Reload Window). VS Code will re-scan and only find one `.git` at the root.

---

### Confusing cloud Xero connector with local custom MCP

**Symptom:** You see `mcp__claude_ai_Xero__authenticate` and `mcp__claude_ai_Xero__complete_authentication` but no invoice tools.

**Cause:** These are tools from the **cloud Xero connector** (`mcp.xero.com/mcp`) synced from your claude.ai account. This is a different, limited connector — it only handles OAuth, not invoice operations.

**Fix:** The full invoice tools come from the **local custom MCP** (`xero-mcp-server/dist/index.js`) configured in `.mcp.json`. Make sure that file exists and VS Code has been fully restarted. The cloud connector and the local MCP are independent.

---

## 3. Claude Desktop — MCP Configuration

### Xero MCP not appearing in Claude Desktop

**Causes & fixes:**
1. **JSON syntax error in config** — open `claude_desktop_config.json` and validate the JSON. Claude Desktop sometimes corrupts it by injecting a `preferences` block. Keep only the `mcpServers` block.
2. **Node.js too old** — upgrade to v20+.
3. **Missing npm directory** — run `mkdir "%APPDATA%\npm"`.
4. **Claude Desktop not fully quit** — use `taskkill /F /IM claude.exe /T` then relaunch. Closing the window is not enough.

---

### Claude Desktop config file getting corrupted

**Symptom:**
```
SyntaxError: Unexpected non-whitespace character after JSON at position 449
```

**Cause:** Claude Desktop automatically rewrites the config file and injects a `preferences` block. If the file already has content in an unexpected format, the merge corrupts it.

**Fix:** Open the config file and replace its entire contents with only the `mcpServers` block:
```json
{
  "mcpServers": {
    "xero": { ... }
  }
}
```
Remove any `preferences` block. Claude Desktop will re-add its own preferences cleanly on next launch.

---

## 4. Airtable MCP

### `search_records` returns 403

**Symptom:**
```
Public API request returned 403: You are not permitted to perform this operation
```

**Cause:** The `search_records` tool requires a different permission level than `list_records_for_table`. The cloud Airtable connector may not grant search access for certain bases.

**Fix:** Use `list_records_for_table` with a `filters` parameter instead of `search_records`. Both can filter by field value.

---

### Can't filter Sales records by linked Product record ID

**Symptom:** Filtering the Sales table by `fldbye2NOk0tq8Xjh` (Product link field) using a record ID string returns 400 or zero results.

**Cause:** The Product field in the Sales table is a **Lookup** type, not a simple linked record. The filter API doesn't accept record IDs for lookup fields. The field value is stored as a nested object with `linkedRecordIds` and `valuesByLinkedRecordId`.

**Fix:** Fetch all Sales records without a filter and process them in code. The product name is nested at:
```
record.cellValuesByFieldId["fldbye2NOk0tq8Xjh"].valuesByLinkedRecordId[id][0].name
```
Match against the product code string (e.g. `"BARC 2026-04-2"`) using `startsWith`.

---

### Airtable result too large for context

**Symptom:**
```
result (148,903 characters) exceeds maximum allowed tokens. Output has been saved to ...
```

**Cause:** The Sales table is large. Fetching all records without a field filter returns too much data.

**Fix:** Always specify `fieldIds` in `list_records_for_table` to limit returned fields to only what you need (e.g. Product link + Amount [Cash]). If the result is still too large, read the saved output file and use Node.js to filter it:
```bash
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('<path-to-output-file>', 'utf8'));
// filter and aggregate as needed
"
```

---

## 5. Invoice Creation

### Invoice created in AUD instead of expected currency

**Symptom:** A USD product generates an AUD invoice.

**Cause:** The upstream `@xeroapi/xero-mcp-server` does not support the `currencyCode` parameter. Our custom fork adds it.

**Fix:** Pass `currencyCode` explicitly when calling `create-invoice`:
```
currencyCode: "USD"
```
Make sure you are using the **local custom MCP** (`xero-mcp-server/dist/index.js`), not the upstream `npx @xeroapi/xero-mcp-server@latest`.

---

### Due date is 30 days from today instead of today

**Symptom:** Invoice due date defaults to 30 days from creation.

**Cause:** Without an explicit `dueDate`, Xero applies the contact's default payment terms.

**Fix:** Pass `dueDate` explicitly on `create-invoice` (supported in the custom MCP):
```
dueDate: "2026-05-10"
```

---

### Branding theme not applied to invoice

**Symptom:** Invoice is created without the Standard branding theme.

**Cause:** The upstream MCP doesn't support `brandingThemeId`. Our custom fork adds it.

**Fix:** Pass the branding theme ID explicitly:
```
brandingThemeId: "aefae6d5-7bbe-4e2e-aadc-302cd07a0fc1"
```
Use `list-branding-themes` to retrieve IDs for other themes.

---

## 6. Git & Repository

### `xero-mcp-server/` treated as a git submodule

**Symptom:** `git add xero-mcp-server/` only stages a single gitlink entry, not the individual files.

**Cause:** `xero-mcp-server/` was cloned with `git clone`, leaving a nested `.git` directory. Git treats a directory with its own `.git` as a submodule.

**Fix:** Remove the nested `.git`:
```bash
rm -rf xero-mcp-server/.git
```
Then `git add xero-mcp-server/` stages all files normally.

---

### `.mcp.json` accidentally committed with credentials

**Symptom:** Xero client ID and secret visible in git history.

**Prevention:** `.mcp.json` is in `.gitignore`. Never remove it from there. Use `.mcp.json.example` as the committed template with placeholder values.

**If already committed:** Rotate your Xero client secret immediately in the Xero Developer Portal, then remove the file from git history with `git filter-repo` or contact your repo admin.

---

## 7. TypeScript Build

### `CurrencyCode` type cast error

**Symptom:**
```
error TS2352: Conversion of type 'string' to type 'CurrencyCode' may be a mistake
```

**Fix:** Double-cast via `unknown`:
```typescript
currencyCode as unknown as CurrencyCode
```

---

### `Invoice.LineAmountTypesEnum` does not exist

**Symptom:**
```
error TS2694: Namespace '...Invoice' has no exported member 'LineAmountTypesEnum'
```

**Cause:** `LineAmountTypes` is a top-level export in `xero-node`, not nested inside `Invoice`.

**Fix:** Import it directly and map string values to enum:
```typescript
import { LineAmountTypes } from "xero-node";

const map: Record<string, LineAmountTypes> = {
  EXCLUSIVE: LineAmountTypes.Exclusive,
  INCLUSIVE: LineAmountTypes.Inclusive,
  NOTAX: LineAmountTypes.NoTax,
};
```
