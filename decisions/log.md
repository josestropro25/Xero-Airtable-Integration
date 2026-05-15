# Decision Log

Append-only. When a meaningful decision is made, log it here.

Format: [YYYY-MM-DD] DECISION: ... | REASONING: ... | CONTEXT: ...

---

[2026-05-10] DECISION: Use .mcp.json for local Xero MCP (not settings.json) | REASONING: settings.json does not support mcpServers — silently ignored by Claude Code | CONTEXT: Discovered after debugging why Xero tools weren't appearing

[2026-05-10] DECISION: Invoice account = 200 (not 201) in production | REASONING: Account 201 in StroPro Xero is "Distribution fees - Self Managed" — different product. 200 is "Distribution fees - Advisory" | CONTEXT: Discovered on first connection to real StroPro org

[2026-05-10] DECISION: Airtable is read-only permanently | REASONING: Risk of modifying production financial data. RCTI checkbox ticked manually by user after review | CONTEXT: Established as hard rule at start of project

[2026-05-11] DECISION: Canaccord RCTIs — detect and ask, never auto-bulk | REASONING: Pattern varies (bulk vs individual) depending on whether same adviser appears across consecutive same-month products | CONTEXT: Discovered from real Xero data showing PO-0682 "Stropro April FCNs"

[2026-05-11] DECISION: Reconciliation uses 3 bulk API calls + local Node.js processing | REASONING: One API call per product exhausted the context window (85% of tokens) without completing | CONTEXT: Failed attempt at per-product reconciliation for April 2026

[2026-05-15] DECISION: Settlement Party Adv field in AdviserFees determines invoice suffix | REASONING: Xero references for MS/NW trades observed in production data (e.g. "CG 2026-04-6 NW", "NX 2026-04-1 - MS"); confirmed by user that the suffix marks the custodian | CONTEXT: Discovered while running April 2026 reconciliation; many "missing invoices" were actually present with suffixes

[2026-05-15] DECISION: External invoice description uses Notional[Local] not Amount[Cash] | REASONING: Verified against existing invoices INV-0873 (CG 2026-03-15, 500,000 @ 2.65% = $13,250) and INV-0957 (CG 2026-05-4 MS, 150,000 @ 2.49% = $3,735) | CONTEXT: Notional and Amount[Cash] differ in the Sales table (e.g. CG 2026-05-4: 150,000 vs 128,805)

[2026-05-15] DECISION: Solomons RCTIs use BAS Excluded (BASEXCLUDED, NOTAX) not GST on Expenses | REASONING: Confirmed by user — Solomons is invoiced without GST | CONTEXT: Discovered when creating BARC 2026-05-1/2 RCTIs (PO-0690, PO-0691); first time Solomons used as adviser group

[2026-05-15] DECISION: External invoices in USD use "Stropr Ops USD - Revenue" branding theme; AUD external uses Standard | REASONING: Confirmed by user against existing USD external invoices | CONTEXT: Theme ID e0ad3aaa-50bc-468e-a117-b719b6dd5ed5

[2026-05-15] DECISION: RCTIs grouped by (Adviser Group × Settlement Party Adv) not just Adviser Group | REASONING: Same adviser group can settle via different platforms (e.g. Gloryhouse / Stropro and Gloryhouse / MS) — these are separate financial transactions | CONTEXT: Clarified during workflow audit when reviewing multi-settlement edge cases

[2026-05-15] DECISION: When Adviser(s) is blank in Airtable, write "[Adviser name]" placeholder in RCTI description and flag in summary | REASONING: User prefers a visible placeholder over omitting the line — makes the gap obvious for manual completion | CONTEXT: Pattern established during BARC 2026-05-1/2 RCTI creation
