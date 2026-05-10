# Pending Changes & Known Issues

## High Priority

### 1. Hardcoded path in `.claude/settings.json`
The Xero MCP `args` path is absolute and tied to Jose's machine:
```
C:/Users/Jose De la Hoz/Desktop/Repositories/Xero-Airtable-Integration/xero-mcp-server/dist/index.js
```
**Fix:** Use a relative path or document that this must be updated per machine after cloning.

### 2. Xero credentials in `.claude/settings.json`
`XERO_CLIENT_ID` and `XERO_CLIENT_SECRET` are committed in plaintext.
**Fix:** Move to `.env` file (gitignored) and load via `env` referencing system env vars, or use a secrets manager.

### 3. Get Standard Branding Theme ID
The `brandingThemeId` parameter is now supported in `create-invoice` but we don't yet have the ID for the "Standard" theme in Demo Company (AU).
**Fix:** Call `list-branding-themes` in Claude after MCP is running and store the ID here and in `xero-mcp-workflow.md`.

## Medium Priority

### 4. Eliminate the double-call for due date
The workflow currently calls `create-invoice` then `update-invoice` to set the due date. Now that `dueDate` is supported on create, the update step is no longer needed.
**Fix:** Update the Claude workflow prompt / instructions in `xero-mcp-workflow.md` to pass `dueDate` directly on create.

### 5. Test USD invoice creation
Currency support (`currencyCode`) was the last known blocker. Needs end-to-end test with `BARC 2026-04-3` (USD product) to confirm invoices are created in the correct currency.

## Future Features

### 6. Purchase Orders workflow
After the invoice workflow is stable, apply the same pattern to build a Purchase Orders automation pulling from the same Airtable base.
See `xero-mcp-workflow.md` Section 8 for reference.

### 7. Rebuild for production Xero org
Everything is currently configured against Demo Company (AU). When ready to go live, new Xero org ID, contact IDs, and account IDs will need to be mapped.
