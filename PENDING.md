# Pending Changes & Known Issues

## High Priority

### ~~1. Hardcoded path in `.mcp.json`~~ ✓ DONE
`.mcp.json` is now gitignored. Each user creates their own from `.mcp.json.example` with their local path.

### ~~2. Xero credentials in plaintext~~ ✓ DONE
`.mcp.json` is gitignored. Credentials stay local and are never committed. `.mcp.json.example` uses placeholders.

### ~~3. Get Standard Branding Theme ID~~ ✓ DONE
Standard: `aefae6d5-7bbe-4e2e-aadc-302cd07a0fc1`
Also available: Special Projects (`dfe23d27-a3a6-4ef3-a5ca-b9e02b142dde`), Very orange invoice! (`2ced98b8-3be9-42c4-ae79-fe3c8bca3490`)

## Medium Priority

### 4. Eliminate the double-call for due date
The workflow currently calls `create-invoice` then `update-invoice` to set the due date. Now that `dueDate` is supported on create, the update step is no longer needed.
**Fix:** Update the Claude workflow prompt / instructions in `xero-mcp-workflow.md` to pass `dueDate` directly on create.

### ~~5. Test USD invoice creation~~ ✓ DONE
Tested 2026-05-10. BARC 2026-04-3 created in USD correctly. BARC 2026-04-2 created in AUD correctly. Both DRAFT in Xero.

## Future Features

### 6. Purchase Orders workflow
After the invoice workflow is stable, apply the same pattern to build a Purchase Orders automation pulling from the same Airtable base.
See `xero-mcp-workflow.md` Section 8 for reference.

### 7. Rebuild for production Xero org
Everything is currently configured against Demo Company (AU). When ready to go live, new Xero org ID, contact IDs, and account IDs will need to be mapped.
