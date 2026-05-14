import { z } from "zod";
import { listXeroInvoices } from "../../handlers/list-xero-invoices.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatLineItem } from "../../helpers/format-line-item.js";

const ListInvoicesTool = CreateXeroTool(
  "list-invoices",
  "List invoices in Xero. This includes Draft, Submitted, and Paid invoices. \
  Ask the user if they want to see invoices for a specific contact, \
  invoice number, or to see all invoices before running. \
  Ask the user if they want the next page of invoices after running this tool \
  if 10 invoices are returned. \
  If they want the next page, call this tool again with the next page number \
  and the contact or invoice number if one was provided in the previous call.",
  {
    page: z.number(),
    contactIds: z.array(z.string()).optional(),
    invoiceNumbers: z
      .array(z.string())
      .optional()
      .describe("If provided, invoice line items will also be returned"),
    reference: z.string().optional().describe("Filter by exact reference (e.g. product code 'CG 2026-04-1'). Uses Xero server-side filtering — fast and accurate."),
    dateFrom: z.string().optional().describe("Filter invoices from this date inclusive (YYYY-MM-DD). Use with dateTo to fetch a full month e.g. 2026-04-01."),
    dateTo: z.string().optional().describe("Filter invoices up to but not including this date (YYYY-MM-DD). e.g. 2026-05-01 for all of April."),
    type: z.string().optional().describe("Filter by invoice type: ACCREC (sales invoices) or ACCPAY (bills)."),
    compact: z.boolean().optional().describe("When true, returns only Reference | InvoiceNumber | Status per line. Use for reconciliation to minimise token usage."),
  },
  async ({ page, contactIds, invoiceNumbers, reference, dateFrom, dateTo, type, compact }) => {
    const response = await listXeroInvoices(page, contactIds, invoiceNumbers, reference, dateFrom, dateTo, type);
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing invoices: ${response.error}`,
          },
        ],
      };
    }

    const invoices = response.result;
    const returnLineItems = (invoiceNumbers?.length ?? 0) > 0;

    // Compact mode — for reconciliation, returns only what's needed
    if (compact) {
      const lines = (invoices ?? []).map(inv =>
        `${inv.reference ?? "(no ref)"} | ${inv.invoiceNumber ?? "-"} | ${inv.status ?? "-"} | ${inv.currencyCode ?? "AUD"} | ${inv.subTotal ?? 0}`
      );
      return {
        content: [{
          type: "text" as const,
          text: `Found ${lines.length} invoices (compact):\nReference | InvoiceNumber | Status | Currency | Net\n${lines.join("\n")}`,
        }],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${invoices?.length || 0} invoices:`,
        },
        ...(invoices?.map((invoice) => ({
          type: "text" as const,
          text: [
            `Invoice ID: ${invoice.invoiceID}`,
            `Invoice: ${invoice.invoiceNumber}`,
            invoice.reference ? `Reference: ${invoice.reference}` : null,
            `Type: ${invoice.type || "Unknown"}`,
            `Status: ${invoice.status || "Unknown"}`,
            invoice.contact
              ? `Contact: ${invoice.contact.name} (${invoice.contact.contactID})`
              : null,
            invoice.date ? `Date: ${invoice.date}` : null,
            invoice.dueDate ? `Due Date: ${invoice.dueDate}` : null,
            invoice.lineAmountTypes
              ? `Line Amount Types: ${invoice.lineAmountTypes}`
              : null,
            invoice.subTotal ? `Sub Total: ${invoice.subTotal}` : null,
            invoice.totalTax ? `Total Tax: ${invoice.totalTax}` : null,
            `Total: ${invoice.total || 0}`,
            invoice.totalDiscount
              ? `Total Discount: ${invoice.totalDiscount}`
              : null,
            invoice.currencyCode ? `Currency: ${invoice.currencyCode}` : null,
            invoice.currencyRate
              ? `Currency Rate: ${invoice.currencyRate}`
              : null,
            invoice.updatedDateUTC
              ? `Last Updated: ${invoice.updatedDateUTC}`
              : null,
            invoice.fullyPaidOnDate
              ? `Fully Paid On: ${invoice.fullyPaidOnDate}`
              : null,
            invoice.amountDue ? `Amount Due: ${invoice.amountDue}` : null,
            invoice.amountPaid ? `Amount Paid: ${invoice.amountPaid}` : null,
            invoice.amountCredited
              ? `Amount Credited: ${invoice.amountCredited}`
              : null,
            invoice.hasErrors ? "Has Errors: Yes" : null,
            invoice.isDiscounted ? "Is Discounted: Yes" : null,
            returnLineItems
              ? `Line Items: ${invoice.lineItems?.map(formatLineItem)}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListInvoicesTool;
