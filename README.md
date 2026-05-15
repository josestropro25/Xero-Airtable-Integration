# Xero–Airtable Invoice Automation

Automates the full distribution-fee cycle for StroPro Operations: invoice creation, RCTI (purchase order) creation, and monthly reconciliation. Claude is the orchestration layer, pulling from an Airtable base (Distribution Tracker) and writing to Xero via MCP servers.

## What it does

| Task | Trigger | Output |
|---|---|---|
| **Create invoice** | _"Create invoice for BARC 2026-04-2"_ | Draft invoice in Xero (ACCREC) with correct contact, currency, account, branding, description, and tax — internal (Stropro) or external (Mason Stevens / NetWealth) format |
| **Create RCTI** | _"Create the RCTI for BARC 2026-04-2"_ | Submitted purchase order (ACCPAY) in Xero, grouped by Adviser Group × Settlement Party Adv, with Canaccord bulk detection and adviser-specific tax exceptions |
| **Reconcile a month** | _"Reconcile April 2026"_ | Classified report listing complete / missing / expected-missing / flagged products. 3 API calls total, processed locally by `scripts/reconcile.js` |

Source of truth is **Xero**, not the Airtable Invoice/RCTI checkboxes.

## Architecture

```
Claude Code (VS Code) / Claude Desktop
    │
    ├── Airtable MCP (hosted — mcp.airtable.com)
    │       └── Distribution Tracker base
    │               ├── Products (codes, strike dates, ISIN, upfront %)
    │               ├── Sales (cash, notional, adviser group, adviser fee %)
    │               └── AdviserFees (Settlement Party Adv: Stropro / MS / NW / Praemium)
    │
    └── Xero MCP (local, custom — xero-mcp-server/)
            └── StroPro Operations Pty Ltd (production)
```

## Setup

### 1. Clone the repo
```bash
git clone <repo-url>
cd Xero-Airtable-Integration
```

### 2. Build the Xero MCP server
```bash
cd xero-mcp-server
npm install
npm run build
cd ..
```

### 3. Create your local `.mcp.json`
`.mcp.json` is gitignored. Copy the template and fill in your values:
```bash
cp .mcp.json.example .mcp.json
```
Then edit `.mcp.json`:
- Replace `<absolute-path-to-repo>` with the full path on your machine
- Replace `<your-xero-client-id>` and `<your-xero-client-secret>` with your Xero Custom Connection credentials

### 4. Connect Airtable
The Airtable MCP uses the hosted server at `https://mcp.airtable.com/mcp`. On first use, Claude Code will trigger an OAuth login in the browser.

### 5. Restart Claude Code
Fully close and reopen VS Code so Claude Code picks up `.mcp.json`.

> **Note:** Local MCP servers must be defined in `.mcp.json`, not in `.claude/settings.json`. `settings.json` does not support `mcpServers` — servers defined there are silently ignored.

## Project structure

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Master orchestration file — context, rules, workflow pointers |
| `xero-mcp-workflow.md` | Invoice + RCTI creation SOP (Sections 6 and 7) |
| `reconciliation-workflow.md` | 3-phase reconciliation SOP (gather → classify → report) |
| `scripts/reconcile.js` | Local cross-reference script |
| `.claude/rules/` | Always-loaded domain rules (terminology, exact-match, settlement party, etc.) |
| `context/` | Who Jose is, what StroPro does, current priorities |
| `decisions/log.md` | Append-only decision log |
| `archives/` | Historical run snapshots |
| `xero-mcp-server/` | Forked & extended Xero MCP server |
| `TROUBLESHOOTING.md` | Errors and fixes |
| `PENDING.md` | Known issues and future work |
| `.mcp.json.example` | MCP server template — copy to `.mcp.json` (gitignored) |

## Internal vs External invoices

| Type | Settlement Party Adv | Reference | Account | Description |
|---|---|---|---|---|
| Internal | Stropro / blank | `BARC 2026-04-2` | 200 | `Distribution Fees -- {code}` |
| External MS | Mason Stevens | `BARC 2026-04-2 MS` | 310 | 3-line: code / ISIN / `notional @ upfront%` |
| External NW | NetWealth | `BARC 2026-04-2 NW` | 310 | 3-line: code / ISIN / `notional @ upfront%` |

External AUD invoices use the Standard branding theme; external USD invoices use **Stropr Ops USD - Revenue**. See `xero-mcp-workflow.md` Section 6.1b for full spec.

## RCTI tax exceptions

- **Default:** GST on Expenses (`INPUT`, 10%) — `lineAmountTypes: EXCLUSIVE`
- **Solomons:** BAS Excluded (`BASEXCLUDED`, 0%) — `lineAmountTypes: NOTAX`
- **Cindy Mao** / **Self-Directed**: no RCTI required (skip + notify)

## Issuer contact prefix mapping

| Prefix | Xero Contact |
|---|---|
| `BARC` | Barclays |
| `BNP` | BNP Paribas |
| `CG` | Citi Group |
| `MBL` | Macquarie Bank Limited |
| `MF` | Marex Financial |
| `NOMU` | Nomura |
| `NX` | Natixis |
| `MS` | Morgan Stanley (not yet in workflow Section 5.2) |
| `C2` | TBD |
| `JPM` | JP Morgan (assumed, TBD) |

> Don't confuse the **product prefix `MS`** (Morgan Stanley as issuer) with the **reference suffix ` MS`** (Mason Stevens as settlement custodian). Same letters, different meanings.

## Extensions made to the Xero MCP server

The forked server (`xero-mcp-server/`) extends the upstream package with:

**create-invoice** — added params:
- `currencyCode` — e.g. `AUD`, `USD`
- `lineAmountTypes` — `EXCLUSIVE` / `INCLUSIVE` / `NOTAX`
- `brandingThemeId` — Xero branding theme UUID
- `dueDate` — eliminates the second `update-invoice` call

**create-purchase-order** — new tool for RCTIs (ACCPAY purchase orders with `SUBMITTED` default status, branding theme, currency)

**list-invoices** — new filters: `dateFrom`, `dateTo`, `type`, `reference`, `compact=true` (returns `Reference | InvoiceNumber | Status | Currency | Net` per line — used by reconciliation)

**list-purchase-orders** — new tool with `reference` filter, paginates all pages automatically when no page specified

**list-branding-themes** — new tool to enumerate available themes

See `xero-mcp-workflow.md` Section 8 for implementation detail and `PENDING.md` for open items.
