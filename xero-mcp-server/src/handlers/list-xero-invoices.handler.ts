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
): Promise<Invoice[]> {
  await xeroClient.authenticate();

  const where = reference ? `Reference=="${reference}"` : undefined;

  const invoices = await xeroClient.accountingApi.getInvoices(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    where, // where
    "UpdatedDateUTC DESC", // order
    undefined, // iDs
    invoiceNumbers, // invoiceNumbers
    contactIds, // contactIDs
    undefined, // statuses
    page,
    false, // includeArchived
    false, // createdByMyApp
    undefined, // unitdp
    false, // summaryOnly
    100, // pageSize — increased from 10
    undefined, // searchTerm
    getClientHeaders(),
  );
  return invoices.body.invoices ?? [];
}

/**
 * List all invoices from Xero, optionally filtered by reference
 */
export async function listXeroInvoices(
  page: number = 1,
  contactIds?: string[],
  invoiceNumbers?: string[],
  reference?: string,
): Promise<XeroClientResponse<Invoice[]>> {
  try {
    const invoices = await getInvoices(invoiceNumbers, contactIds, page, reference);

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
