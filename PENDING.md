# Pending Changes & Known Issues

## High Priority

### ~~1. Hardcoded path in `.mcp.json`~~ ✓ DONE
`.mcp.json` is now gitignored. Each user creates their own from `.mcp.json.example` with their local path.

### ~~2. Xero credentials in plaintext~~ ✓ DONE
`.mcp.json` is gitignored. Credentials stay local and are never committed. `.mcp.json.example` uses placeholders.

### ~~3. Get Standard Branding Theme ID~~ ✓ DONE
Standard: `aefae6d5-7bbe-4e2e-aadc-302cd07a0fc1`
Also available: Special Projects (`dfe23d27-a3a6-4ef3-a5ca-b9e02b142dde`), Very orange invoice! (`2ced98b8-3be9-42c4-ae79-fe3c8bca3490`)

## High Priority (awaiting decision)

### 12. RCTI branding theme not applied via API
Xero's purchase order API accepts `brandingThemeId` but ignores it — POs are created without the RCTI branding theme regardless of what's passed.

**Options:**
1. Set RCTI as the default PO branding theme in Xero (Settings → Invoice Settings) — one-time fix, applies to all future POs
2. Update branding manually on each PO after creation

Awaiting approval from Jose's manager before changing Xero settings.

## Medium Priority

### 4. Eliminate the double-call for due date
The workflow currently calls `create-invoice` then `update-invoice` to set the due date. Now that `dueDate` is supported on create, the update step is no longer needed.
**Fix:** Update the Claude workflow prompt / instructions in `xero-mcp-workflow.md` to pass `dueDate` directly on create.

### ~~5. Test USD invoice creation~~ ✓ DONE
Tested 2026-05-10. BARC 2026-04-3 created in USD correctly. BARC 2026-04-2 created in AUD correctly. Both DRAFT in Xero.

## Maintenance & Cleanup

### Move workflow docs to references/sops/
Once docs stabilise, move `xero-mcp-workflow.md`, `reconciliation-workflow.md`, `TROUBLESHOOTING.md`, and `PENDING.md` to `references/sops/`. Update all cross-references in `CLAUDE.MD` and the project README. Not urgent — do this when active development slows.

## Future Features

### 9. CG 2026-05-6 RCTI — new adviser groups + flow TBD
Three adviser groups found with no Xero contacts and no defined RCTI flow yet. User to clarify process before creating:
- **Pridham Capital** — Roger Geoffrey Pridham, $20,000 @ 1.00% = $200
- **Taylor Collinson** — Stephen Spencer (⚠️ leading tab in Airtable name), $25,000 @ 1.40% = $350
- **Bayside Asset Management** — Matt Maher, $40,000 @ 1.40% = $560

Also flag: Self-Directed row ($50,000) is included in invoice but has no RCTI — expected behaviour confirmed.

### ~~10. Canaccord RCTI contact mapping~~ ✓ DONE
Canaccord uses a **bulk RCTI** pattern: one PO per month to `Canaccord Genuity Financial Limited - WIll Kenny` (`fffe7d03`) with reference `"Stropro [Month] FCNs"`. Individual product POs are deleted when consolidated. Individual adviser contacts exist (Willet, Kinivan, Re) but are not used for RCTIs.

### ~~10. Invoice branding theme for production~~ ✓ DONE
Invoices → Standard (`68901f31-8c32-40ae-b1bd-5fe9caaaabc9`). RCTIs → RCTI (`05148358-30af-46a9-97f3-26e3ad572273`).

### ~~11. Settlement Party Adv logic for RCTIs~~ ✓ PARTIALLY DONE
Suffix rule documented in `reconcile.js`, `xero-airtable-rules.md`, and `xero-mcp-workflow.md`:
- Mason Stevens → ` MS` suffix on invoice reference; account 310; 3-line description
- NetWealth → ` NW` suffix on invoice reference; account 310; 3-line description
- Stropro / blank → no suffix; account 201; single-line description
- RCTI reference never gets a suffix regardless of settlement party

**✅ Fully done.** Invoice spec: Section 6.1b in `xero-mcp-workflow.md`. RCTI spec: identical to internal — settlement party has no effect on RCTIs.



### ~~6. Invoice reconciliation workflow~~ ✓ DONE
Full SOP in `reconciliation-workflow.md`. Covers Phase 1 (data gathering), Phase 2 (classify results including exemption checks), Phase 3 (final report + action lists). Script at `scripts/reconcile.js`. First production run: April 2026, 55 products.

### 7. Purchase Orders workflow
After the invoice workflow is stable, apply the same pattern to build a Purchase Orders automation pulling from the same Airtable base.
See `xero-mcp-workflow.md` Section 8 for reference.

### 8. Migrate to Stropro production Xero org
Custom Connection subscription ($10 AUD/month) to be purchased. Steps once ready:
1. Create Custom Connection app in Xero Developer Portal under Stropro org
2. Update `Client ID` and `Client Secret` in `.mcp.json` and `claude_desktop_config.json`
3. Run `list-contacts` → map real contact IDs for all issuer banks (Barclays, Citigroup, MBL, etc.)
4. Run `list-accounts` → confirm accounts 201 and 310 exist, get real IDs
5. Run `list-branding-themes` → confirm RCTI theme exists (or create it)
6. Update Section 5 and Section 10 of `xero-mcp-workflow.md` with real IDs
