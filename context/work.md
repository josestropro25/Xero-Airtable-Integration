# StroPro — Business Context

**Company:** StroPro Operations Pty Ltd
**ABN:** 28 633 603 399
**Website:** www.stropro.com
**Address:** Suite 2, Level 1, 66-74 Clarence Street, Sydney NSW 2000

## What StroPro does

StroPro is an intermediary between financial advisers (serving high-net-worth clients) and banks that issue structured investment products (FCNs, notes, etc.). It operates in AUD and USD and manages the full product lifecycle:

1. **Structuring** — banks create products, StroPro facilitates
2. **Subscriptions** — advisers subscribe clients into products via trades
3. **Funding** — clients transfer cash referenced by Trade Number (e.g. T16121)
4. **Settlement** — principal goes to settlement account (e.g. Clearstream), revenue to StroPro
5. **Ongoing** — coupons and maturities identified by ISIN, not product name
6. **Fee invoicing** — StroPro charges issuer banks (invoices) and pays adviser groups (RCTIs)

## Key entities

- **Products** — structured investment products with internal code and ISIN
- **Trades** — one client account subscribing an amount into a product
- **Advisers** — manage client accounts, earn referral fees (paid via RCTI)
- **Adviser Groups** — organisational groups of individual advisers

## Tools in use

- **Airtable** — Distribution Tracker (source of truth for products and sales/trades)
- **Xero** — Accounting (invoices to issuers, RCTIs to advisers)
- **Claude Code** — Automation of Xero/Airtable workflows
- **Airwallex** — FX conversion (AUD↔USD)

## Revenue model

StroPro earns a distribution fee on each product:
- Charges the issuer bank: `SUM(Sales) × Upfront%`
- Pays adviser groups: `Notional × Adviser Fee%` per trade

Net revenue = Gross revenue − Adviser fees
