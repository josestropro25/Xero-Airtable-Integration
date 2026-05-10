import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { CurrencyCode, Invoice, LineAmountTypes, LineItemTracking } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

async function createInvoice(
  contactId: string,
  lineItems: InvoiceLineItem[],
  type: Invoice.TypeEnum,
  reference: string | undefined,
  date: string | undefined,
  dueDate: string | undefined,
  currencyCode: string | undefined,
  lineAmountTypes: string | undefined,
  brandingThemeId: string | undefined,
): Promise<Invoice | undefined> {
  await xeroClient.authenticate();

  const invoice: Invoice = {
    type: type,
    contact: {
      contactID: contactId,
    },
    lineItems: lineItems,
    date: date || new Date().toISOString().split("T")[0],
    dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    ...(type === Invoice.TypeEnum.ACCPAY
      ? { invoiceNumber: reference }
      : { reference: reference }),
    ...(currencyCode ? { currencyCode: currencyCode as unknown as CurrencyCode } : {}),
    ...(lineAmountTypes ? { lineAmountTypes: ({ EXCLUSIVE: LineAmountTypes.Exclusive, INCLUSIVE: LineAmountTypes.Inclusive, NOTAX: LineAmountTypes.NoTax } as Record<string, LineAmountTypes>)[lineAmountTypes] } : {}),
    ...(brandingThemeId ? { brandingTheme: { brandingThemeID: brandingThemeId } } : {}),
    status: Invoice.StatusEnum.DRAFT,
  };

  const response = await xeroClient.accountingApi.createInvoices(
    xeroClient.tenantId,
    {
      invoices: [invoice],
    }, // invoices
    true, //summarizeErrors
    undefined, //unitdp
    undefined, //idempotencyKey
    getClientHeaders(),
  );
  const createdInvoice = response.body.invoices?.[0];
  return createdInvoice;
}

/**
 * Create a new invoice in Xero
 */
export async function createXeroInvoice(
  contactId: string,
  lineItems: InvoiceLineItem[],
  type: Invoice.TypeEnum = Invoice.TypeEnum.ACCREC,
  reference?: string,
  date?: string,
  dueDate?: string,
  currencyCode?: string,
  lineAmountTypes?: string,
  brandingThemeId?: string,
): Promise<XeroClientResponse<Invoice>> {
  try {
    const createdInvoice = await createInvoice(
      contactId,
      lineItems,
      type,
      reference,
      date,
      dueDate,
      currencyCode,
      lineAmountTypes,
      brandingThemeId,
    );

    if (!createdInvoice) {
      throw new Error("Invoice creation failed.");
    }

    return {
      result: createdInvoice,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
