#!/usr/bin/env node
/**
 * Reconciliation script — Airtable vs Xero
 *
 * Usage:
 *   node scripts/reconcile.js <products_file> <pos_file> <invoices_text_file>
 *
 * Args:
 *   products_file    — path to Airtable list_records_for_table output (JSON)
 *   pos_file         — path to Xero list-purchase-orders output (text)
 *   invoices_file    — path to Xero list-invoices compact output (text)
 *
 * Outputs summary table + counts to stdout only.
 */

const fs = require('fs');

const [,, productsFile, posFile, invoicesFile] = process.argv;

if (!productsFile || !posFile || !invoicesFile) {
  console.error('Usage: node reconcile.js <products_file> <pos_file> <invoices_file>');
  process.exit(1);
}

// ─── Helper: expand a multi-product reference into a list of product codes ────
// Examples:
//   "CG 2026-03-1 & CG 2026-03-2"   → ["CG 2026-03-1", "CG 2026-03-2"]
//   "NX 2026-03-10, 11, 12"         → ["NX 2026-03-10", "NX 2026-03-11", "NX 2026-03-12"]
//   "BARC 2026-04-3 / 04-4 / 04-5"  → ["BARC 2026-04-3", "BARC 2026-04-4", "BARC 2026-04-5"]
//   "CG 2026-04-6 NW"               → ["CG 2026-04-6"]          (suffix ignored)
//   "NX 2026-04-1 - MS"             → ["NX 2026-04-1"]
//   "Stropro April FCNs"            → []                         (handled by Canaccord bulk logic)
function expandReference(ref) {
  const fullCodeRegex = /^([A-Z0-9]+)\s(\d{4})-(\d{2})-(\d+)/;
  const firstMatch = ref.match(fullCodeRegex);
  if (!firstMatch) return [];

  const [, prefix, year, month, firstSeq] = firstMatch;
  const codes = new Set([`${prefix} ${year}-${month}-${firstSeq}`]);

  // Anything after the first full code may list more products separated by &, /, or ,
  const after = ref.slice(firstMatch[0].length);
  const parts = after.split(/\s*[&/,]\s*|\s+and\s+/i);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const fullMatch = trimmed.match(/^([A-Z0-9]+)\s(\d{4})-(\d{2})-(\d+)/);
    if (fullMatch) {
      codes.add(`${fullMatch[1]} ${fullMatch[2]}-${fullMatch[3]}-${fullMatch[4]}`);
      continue;
    }

    const monthSeqMatch = trimmed.match(/^(\d{2})-(\d+)$/);
    if (monthSeqMatch) {
      codes.add(`${prefix} ${year}-${monthSeqMatch[1]}-${monthSeqMatch[2]}`);
      continue;
    }

    const seqMatch = trimmed.match(/^(\d+)$/);
    if (seqMatch) {
      codes.add(`${prefix} ${year}-${month}-${seqMatch[1]}`);
      continue;
    }
  }

  return [...codes];
}

// ─── 1. Parse Airtable products ───────────────────────────────────────────────
const productsData = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
const products = productsData.records.map(r => ({
  code:        r.cellValuesByFieldId['fldGwppKvbYFiTAsa'],
  strikeDate:  r.cellValuesByFieldId['fldRmizE67tvwOTc6'],
  currency:    r.cellValuesByFieldId['fldUNJ9HydcFWOUPY']?.name ?? 'AUD',
})).filter(p => p.code);

// ─── 2. Parse Xero invoices (compact format) ──────────────────────────────────
// Format: "Reference | InvoiceNumber | Status | Currency | Net"
// Maps product code → list of invoices that cover it
const invoicesText = fs.readFileSync(invoicesFile, 'utf8');
const invoiceMap = {}; // { productCode: [{ number, status, reference }] }
for (const line of invoicesText.split('\n')) {
  const parts = line.split('|').map(s => s.trim());
  if (parts.length < 3 || parts[0] === 'Reference' || parts[0].startsWith('Found')) continue;
  const [ref, number, status] = parts;
  if (!ref || ref === '(no ref)') continue;
  if (status === 'DELETED') continue;

  // Expand multi-product references into individual product codes
  const codes = expandReference(ref);
  for (const code of codes) {
    if (!invoiceMap[code]) invoiceMap[code] = [];
    invoiceMap[code].push({ number, status, reference: ref });
  }
}

// ─── 3. Parse Xero purchase orders (text format) ──────────────────────────────
// Format: "- PO-XXXX | Contact | Ref: ... | Net: ... | Status: ..."
const posText = fs.readFileSync(posFile, 'utf8');
const poMap = {}; // { productCode: [{ number, status, contact, reference }] }

// Detect bulk Canaccord POs (reference like "Stropro April FCNs")
const bulkPosByMonth = {}; // { "apr": "PO-0682" }

for (const line of posText.split('\n')) {
  if (!line.startsWith('- PO-')) continue;
  const poMatch = line.match(/^- (PO-\d+) \| (.+?) \| Ref: (.*?) \| Net: .+ \| Status: (.+)$/);
  if (!poMatch) continue;
  const [, number, contact, ref, status] = poMatch;
  if (status === 'DELETED') continue;

  // Detect bulk Canaccord PO pattern "Stropro [Month] FCNs"
  const bulkMatch = ref.match(/Stropro (\w+) FCNs/i);
  if (bulkMatch) {
    const key = bulkMatch[1].toLowerCase().slice(0, 3);
    bulkPosByMonth[key] = number;
    continue;
  }

  if (!ref) continue;
  // Expand multi-product references for POs too
  const codes = expandReference(ref);
  for (const code of codes) {
    if (!poMap[code]) poMap[code] = [];
    poMap[code].push({ number, status, contact, reference: ref });
  }
}

// ─── 4. Cross-reference ───────────────────────────────────────────────────────
const results = [];
const flags = [];

const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

for (const product of products) {
  const { code, strikeDate, currency } = product;

  // Invoice check — direct lookup on expanded map
  const invs = invoiceMap[code] ?? [];
  let invoiceStatus = '❌ Missing';
  if (invs.length === 1) {
    const i = invs[0];
    // Annotate if this invoice covers multiple products (e.g. INV-0824 "CG 2026-03-1 & CG 2026-03-2")
    const isMulti = i.reference !== code && !i.reference.startsWith(code + ' ');
    invoiceStatus = isMulti ? `✅ ${i.number} (multi: ${i.reference})` : `✅ ${i.number}`;
  } else if (invs.length > 1) {
    invoiceStatus = `⚠️ ${invs.map(i => i.number).join(', ')}`;
    flags.push(`Duplicate invoices for ${code}: ${invs.map(i => i.number).join(', ')}`);
  }

  // RCTI check — direct lookup on expanded map
  const pos = poMap[code] ?? [];
  let rctiStatus = '❌ Missing';
  if (pos.length >= 1) {
    rctiStatus = `✅ ${pos.map(p => p.number).join(', ')}`;
    if (pos.length > 1) {
      flags.push(`Multiple RCTIs for ${code}: ${pos.map(p => p.number).join(', ')}`);
    }
  }
  // NOTE: We do NOT auto-match Canaccord bulk POs against products here. The
  // script doesn't know which products are Canaccord (that needs AdviserFees).
  // Bulk PO existence is reported separately below for Phase 2 to handle.

  results.push({ code, strikeDate: strikeDate ?? '?', currency, invoiceStatus, rctiStatus });
}

// ─── 5. Output ────────────────────────────────────────────────────────────────
const both    = results.filter(r => r.invoiceStatus.startsWith('✅') && r.rctiStatus.startsWith('✅'));
const invOnly = results.filter(r => r.invoiceStatus.startsWith('✅') && !r.rctiStatus.startsWith('✅'));
const rctiOnly= results.filter(r => !r.invoiceStatus.startsWith('✅') && r.rctiStatus.startsWith('✅'));
const neither = results.filter(r => !r.invoiceStatus.startsWith('✅') && !r.rctiStatus.startsWith('✅'));

console.log(`\n${'='.repeat(70)}`);
console.log(`RECONCILIATION SUMMARY — ${products.length} products`);
console.log(`${'='.repeat(70)}`);
console.log(`✅ Both complete:      ${both.length}`);
console.log(`⚠️  Invoice only:       ${invOnly.length}   (have invoice, missing RCTI)`);
console.log(`⚠️  RCTI only:          ${rctiOnly.length}   (have RCTI, missing invoice)`);
console.log(`❌ Neither:             ${neither.length}`);
if (flags.length) console.log(`🚩 Flags:              ${flags.length}`);
console.log(`${'='.repeat(70)}\n`);

// Full table
console.log('Product          | Strike Date | Cur | Invoice                          | RCTI');
console.log('-'.repeat(110));
for (const r of results) {
  console.log(
    `${r.code.padEnd(16)} | ${r.strikeDate.padEnd(11)} | ${r.currency.padEnd(3)} | ${r.invoiceStatus.padEnd(32)} | ${r.rctiStatus}`
  );
}

// Missing lists — LABELS CORRECTED:
//   "Missing Invoice" = products with no invoice (rctiOnly + neither)
//   "Missing RCTI"    = products with no RCTI    (invOnly + neither)
if (rctiOnly.length || neither.length) {
  console.log('\n--- Missing Invoice ---');
  [...rctiOnly, ...neither].forEach(r => console.log(`  ${r.code} (${r.strikeDate})`));
}
if (invOnly.length || neither.length) {
  console.log('\n--- Missing RCTI ---');
  [...invOnly, ...neither].forEach(r => console.log(`  ${r.code} (${r.strikeDate})`));
}
if (flags.length) {
  console.log('\n--- Flags ---');
  flags.forEach(f => console.log(`  ⚠️  ${f}`));
}

// Bulk Canaccord POs — surfaced for manual Phase 2 handling
const bulkKeys = Object.keys(bulkPosByMonth);
if (bulkKeys.length) {
  console.log('\n--- Bulk Canaccord POs detected ---');
  bulkKeys.forEach(k => console.log(`  ${bulkPosByMonth[k]} — covers Canaccord products for ${k.toUpperCase()} (apply manually in Phase 2)`));
}
