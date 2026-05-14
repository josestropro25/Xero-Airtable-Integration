import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Invoice } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getInvoices(
  invoiceNumbers: string[] | undefined,
  contactIds: string[] | undefined,
  page: number,
  reference: string | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  type: string | undefined,
): Promise<Invoice[]> {
  await xeroClient.authenticate();

  const whereParts: string[] = [];
  if (reference) whereParts.push(`Reference=="${reference}"`);
  if (dateFrom) whereParts.push(`Date>=DateTime(${dateFrom.replace(/-/g, ",")})`);
  if (dateTo) whereParts.push(`Date<DateTime(${dateTo.replace(/-/g, ",")})`);
  if (type) whereParts.push(`Type=="${type}"`);
  const where = whereParts.length > 0 ? whereParts.join("&&") : undefined;

  const invoices = await xeroClient.accountingApi.getInvoices(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    where,
    "Date ASC", // order
    undefined, // iDs
    invoiceNumbers,
    contactIds,
    undefined, // statuses
    page,
    false, // includeArchived
    false, // createdByMyApp
    undefined, // unitdp
    false, // summaryOnly
    100, // pageSize
    undefined, // searchTerm
    getClientHeaders(),
  );
  return invoices.body.invoices ?? [];
}

/**
 * List invoices from Xero with optional filters: reference, date range, type
 */
export async function listXeroInvoices(
  page: number = 1,
  contactIds?: string[],
  invoiceNumbers?: string[],
  reference?: string,
  dateFrom?: string,
  dateTo?: string,
  type?: string,
): Promise<XeroClientResponse<Invoice[]>> {
  try {
    const invoices = await getInvoices(invoiceNumbers, contactIds, page, reference, dateFrom, dateTo, type);

    return {
      result: invoices,
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
