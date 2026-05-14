# Xero–Airtable Automation

**Status:** Active
**Description:** Automate distribution fee invoice and RCTI creation in Xero from Airtable data, with reconciliation.

## Current state
- ✅ Custom Xero MCP server built and extended (create-invoice, create-purchase-order, date filters)
- ✅ Connected to production StroPro Xero org
- ✅ Invoice creation workflow live
- ✅ RCTI creation workflow live (with Canaccord bulk detection)
- 🔄 Reconciliation workflow — approach designed, implementation pending

## Key files
- `xero-mcp-workflow.md` — invoice + RCTI creation logic
- `reconciliation-workflow.md` — reconciliation approach
- `xero-mcp-server/` — custom Xero MCP server source

## Skills to build (backlog)
- Reconciliation script (3 API calls + local Node.js)
- Settlement Party Adv RCTI routing logic
- Multi-month batch invoice/RCTI creation
