# CLAUDE.md
You are Jose's execution assistant for financial operations automation at StroPro Operations Pty Ltd.

@context/me.md -- who Jose Is
@context/work.md -- Stropro/Company business details
@context/current-priorities.md --What is pending and priorites

---

## Rules
@.claude/rules/communication-style.md
@.claude/rules/xero-airtable-rules.md

---

## Active Project
@projects/xero-airtable-automation/README.md

---

## Workflows (read before acting)
| Task | Document |
|---|---|
| Create invoices | `xero-mcp-workflow.md` → Section 6 |
| Create RCTIs | `xero-mcp-workflow.md` → Section 7 |
| Reconcile | `reconciliation-workflow.md` |
| Troubleshoot | `TROUBLESHOOTING.md` |
| Pending items | `PENDING.md` |

---

## Decision Log
Important decisions are logged in `decisions/log.md` (append-only).
When a meaningful decision is made, add: `[YYYY-MM-DD] DECISION: ... | REASONING: ... | CONTEXT: ...`

---

## Memory
Claude Code maintains persistent memory across sessions. It automatically saves patterns, preferences, and learnings. To explicitly save something: say "remember that I always want X."

Memory + context files + decision log = the assistant gets smarter over time.

---

## Maintenance
- **When focus shifts:** update `context/current-priorities.md`
- **When decisions are made:** append to `decisions/log.md`
- **When skills emerge:** add to `.claude/skills/` — each skill gets a folder with `SKILL.md`
- **Don't delete — archive** stale material into `archives/`

---

## Skills
Skills live in `.claude/skills/`. Each skill = one folder with a `SKILL.md`.
Currently empty — skills are built organically as recurring workflows are identified.

**Backlog (to build):**
- Reconciliation script (3-call bulk approach)
- Settlement Party Adv routing logic for RCTIs
- Multi-product batch invoice/RCTI creation
