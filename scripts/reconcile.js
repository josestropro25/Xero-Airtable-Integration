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

// ─── 1. Parse Airtable products ───────────────────────────────────────────────
const productsData = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
const products = productsData.records.map(r => ({
  code:        r.cellValuesByFieldId['fldGwppKvbYFiTAsa'],
  strikeDate:  r.cellValuesByFieldId['fldRmizE67tvwOTc6'],
  currency:    r.cellValuesByFieldId['fldUNJ9HydcFWOUPY']?.name ?? 'AUD',
})).filter(p => p.code);

// ─── 2. Parse Xero invoices (compact format) ──────────────────────────────────
// Format: "Reference | InvoiceNumber | Status | Currency | Net"
const invoicesText = fs.readFileSync(invoicesFile, 'utf8');
const invoiceMap = {}; // { reference: [{ number, status }] }
for (const line of invoicesText.split('\n')) {
  const parts = line.split('|').map(s => s.trim());
  if (parts.length < 3 || parts[0] === 'Reference' || parts[0].startsWith('Found')) continue;
  const [ref, number, status] = parts;
  if (!ref || ref === '(no ref)') continue;
  if (!invoiceMap[ref]) invoiceMap[ref] = [];
  invoiceMap[ref].push({ number, status });
}

// ─── 3. Parse Xero purchase orders (text format) ──────────────────────────────
// Format: "- PO-XXXX | Contact | Ref: ... | Net: ... | Status: ..."
const posText = fs.readFileSync(posFile, 'utf8');
const poMap = {}; // { reference: [{ number, status, contact }] }

// Detect bulk Canaccord POs (reference like "Stropro April FCNs")
const bulkPosByMonth = {}; // { "2026-04": "PO-0682" }

for (const line of posText.split('\n')) {
  if (!line.startsWith('- PO-')) continue;
  const poMatch = line.match(/^- (PO-\d+) \| (.+?) \| Ref: (.*?) \| Net: .+ \| Status: (.+)$/);
  if (!poMatch) continue;
  const [, number, contact, ref, status] = poMatch;
  if (status === 'DELETED') continue;

  // Detect bulk Canaccord PO pattern "Stropro [Month] FCNs"
  const bulkMatch = ref.match(/Stropro (\w+) FCNs/i);
  if (bulkMatch) {
    // Map month name to YYYY-MM — simplified, expand if needed
    const monthNames = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                         jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
    const monthKey = monthNames[bulkMatch[1].toLowerCase().slice(0,3)];
    if (monthKey) {
      // Extract year from surrounding context — assume current year logic
      // For now store by month name for matching
      const key = `${bulkMatch[1].toLowerCase()}`;
      bulkPosByMonth[key] = number;
    }
    continue;
  }

  if (!ref) continue;
  if (!poMap[ref]) poMap[ref] = [];
  poMap[ref].push({ number, status, contact });
}

// ─── 4. Cross-reference ───────────────────────────────────────────────────────
const results = [];
const flags = [];

// Detect month from products for Canaccord bulk check
const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

for (const product of products) {
  const { code, strikeDate, currency } = product;

  // Invoice check
  const invs = invoiceMap[code] ?? [];
  let invoiceStatus = '❌ Missing';
  if (invs.length === 1) {
    invoiceStatus = `✅ ${invs[0].number}`;
  } else if (invs.length > 1) {
    invoiceStatus = `⚠️ ${invs.map(i => i.number).join(', ')}`;
    flags.push(`Duplicate invoices for ${code}: ${invs.map(i => i.number).join(', ')}`);
  }

  // RCTI check
  const pos = poMap[code] ?? [];
  let rctiStatus = '❌ Missing';
  if (pos.length >= 1) {
    rctiStatus = `✅ ${pos.map(p => p.number).join(', ')}`;
  } else {
    // Check Canaccord bulk PO for this month
    if (strikeDate) {
      const monthIdx = parseInt(strikeDate.split('-')[1], 10) - 1;
      const monthKey = monthNames[monthIdx];
      if (monthKey && bulkPosByMonth[monthKey]) {
        rctiStatus = `✅ ${bulkPosByMonth[monthKey]} (bulk)`;
      }
    }
  }

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
console.log(`⚠️  Invoice only:       ${invOnly.length}`);
console.log(`⚠️  RCTI only:          ${rctiOnly.length}`);
console.log(`❌ Neither:             ${neither.length}`);
if (flags.length) console.log(`🚩 Flags:              ${flags.length}`);
console.log(`${'='.repeat(70)}\n`);

// Full table
console.log('Product          | Strike Date | Cur | Invoice           | RCTI');
console.log('-'.repeat(80));
for (const r of results) {
  console.log(
    `${r.code.padEnd(16)} | ${r.strikeDate.padEnd(11)} | ${r.currency.padEnd(3)} | ${r.invoiceStatus.padEnd(17)} | ${r.rctiStatus}`
  );
}

// Missing lists
if (invOnly.length || neither.length) {
  console.log('\n--- Missing Invoice ---');
  [...invOnly, ...neither].forEach(r => console.log(`  ${r.code} (${r.strikeDate})`));
}
if (rctiOnly.length || neither.length) {
  console.log('\n--- Missing RCTI ---');
  [...rctiOnly, ...neither].forEach(r => console.log(`  ${r.code} (${r.strikeDate})`));
}
if (flags.length) {
  console.log('\n--- Flags ---');
  flags.forEach(f => console.log(`  ⚠️  ${f}`));
}
