# Xero–Airtable Invoice Automation

Automates distribution fee invoice creation in Xero by pulling data from an Airtable base, with Claude as the orchestration layer via MCP servers.

## How it works

**Trigger:** Tell Claude _"Create invoice for BARC 2026-04-2"_

**Claude then:**
1. Queries Airtable (Distribution Tracker) for the product's Strike Date, Upfront %, and Currency
2. Sums the linked Sales records (`Amount [Cash]`)
3. Calculates `Price = SUM × Upfront%`
4. Maps the product code prefix to the correct Xero contact
5. Creates a draft invoice in Xero with all fields set correctly

## Architecture

```
Claude Code / Claude Desktop
    ├── Airtable MCP  →  Distribution Tracker base (Products, Sales, AdviserFees)
    └── Xero MCP      →  Demo Company (AU)
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

`.mcp.json` is gitignored because it contains credentials and a machine-specific path. Copy the example and fill in your values:

```bash
cp .mcp.json.example .mcp.json
```

Then edit `.mcp.json`:
- Replace `<absolute-path-to-repo>` with the full path to this repo on your machine
- Replace `<your-xero-client-id>` and `<your-xero-client-secret>` with your Xero app credentials

### 4. Connect Airtable

The Airtable MCP uses the hosted server at `https://mcp.airtable.com/mcp`. On first use, Claude Code will trigger an OAuth login in the browser.

### 5. Restart Claude Code

Close and fully reopen VS Code so Claude Code picks up `.mcp.json`.

> **Note:** Local MCP servers must be defined in `.mcp.json`, not in `.claude/settings.json`. The `settings.json` file does not support `mcpServers` — servers defined there are silently ignored. `.claude/settings.json` only controls permissions and behaviour settings.

## Key files

| File | Purpose |
|---|---|
| `.mcp.json.example` | MCP server template — copy to `.mcp.json` (gitignored) and fill in credentials |
| `.claude/settings.json` | Claude Code behaviour settings (auto-approves project MCPs) |
| `xero-mcp-server/` | Forked & extended Xero MCP server |
| `xero-mcp-workflow.md` | Full workflow documentation, IDs, and setup history |
| `PENDING.md` | Known issues and future work |

## Contact → Code prefix mapping

| Prefix | Contact |
|---|---|
| `BARC` | Barclays |
| `BNP` | BNP Paribas |
| `CG` | Citigroup |
| `MF` | Marex Financial |
| `NOMU` | Nomura |

## Extensions made to the Xero MCP server

The `create-invoice` tool was extended to support fields missing from the upstream package:

- `currencyCode` — e.g. `AUD`, `USD`, `GBP`
- `lineAmountTypes` — `EXCLUSIVE`, `INCLUSIVE`, or `NOTAX`
- `brandingThemeId` — Xero branding theme UUID
- `dueDate` — eliminates the need for a second `update-invoice` call

See `PENDING.md` for remaining known issues.
