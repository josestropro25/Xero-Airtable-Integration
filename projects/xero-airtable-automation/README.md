# Xero–Airtable Automation

**Status:** Active
**Description:** Automate distribution fee invoice and RCTI creation in Xero from Airtable data, with reconciliation.

## Current state
- ✅ Custom Xero MCP server built and extended (create-invoice with currency/due-date/branding, create-purchase-order, list-purchase-orders, date filters, compact mode)
- ✅ Connected to production StroPro Xero org
- ✅ Invoice creation workflow live — internal (Stropro) and external (MS/NW) variants
- ✅ RCTI creation workflow live — Canaccord bulk detection, Solomons BAS Excluded exception, [Adviser name] placeholder
- ✅ Reconciliation workflow live — `scripts/reconcile.js` (3-call bulk approach, suffix-aware matching, exemption classification)

## Key files
- `xero-mcp-workflow.md` — invoice + RCTI creation logic (Sections 6 and 7)
- `reconciliation-workflow.md` — 3-phase SOP (gather → classify → report)
- `scripts/reconcile.js` — local cross-reference script
- `xero-mcp-server/` — custom Xero MCP server source
- `.claude/rules/xero-airtable-rules.md` — domain rules (always loaded into context)

## Skills to build (backlog)
- Multi-month batch invoice/RCTI creation
- C2 / JPM prefix mapping (pending issuer bank identification)
