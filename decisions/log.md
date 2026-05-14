# Decision Log

Append-only. When a meaningful decision is made, log it here.

Format: [YYYY-MM-DD] DECISION: ... | REASONING: ... | CONTEXT: ...

---

[2026-05-10] DECISION: Use .mcp.json for local Xero MCP (not settings.json) | REASONING: settings.json does not support mcpServers — silently ignored by Claude Code | CONTEXT: Discovered after debugging why Xero tools weren't appearing

[2026-05-10] DECISION: Invoice account = 200 (not 201) in production | REASONING: Account 201 in StroPro Xero is "Distribution fees - Self Managed" — different product. 200 is "Distribution fees - Advisory" | CONTEXT: Discovered on first connection to real StroPro org

[2026-05-10] DECISION: Airtable is read-only permanently | REASONING: Risk of modifying production financial data. RCTI checkbox ticked manually by user after review | CONTEXT: Established as hard rule at start of project

[2026-05-11] DECISION: Canaccord RCTIs — detect and ask, never auto-bulk | REASONING: Pattern varies (bulk vs individual) depending on whether same adviser appears across consecutive same-month products | CONTEXT: Discovered from real Xero data showing PO-0682 "Stropro April FCNs"

[2026-05-11] DECISION: Reconciliation uses 3 bulk API calls + local Node.js processing | REASONING: One API call per product exhausted the context window (85% of tokens) without completing | CONTEXT: Failed attempt at per-product reconciliation for April 2026
