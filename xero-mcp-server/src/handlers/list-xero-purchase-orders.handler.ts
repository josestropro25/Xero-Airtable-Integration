import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { PurchaseOrder } from "xero-node";

export async function listXeroPurchaseOrders(
  reference?: string,
  contactId?: string,
  page: number = 1,
): Promise<XeroClientResponse<PurchaseOrder[]>> {
  try {
    await xeroClient.authenticate();

    const response = await xeroClient.accountingApi.getPurchaseOrders(
      xeroClient.tenantId,
      undefined, // ifModifiedSince
      undefined, // status
      undefined, // dateFrom
      undefined, // dateTo
      undefined, // order
      page,
    );

    let orders = response.body.purchaseOrders ?? [];

    if (reference) {
      orders = orders.filter(o =>
        o.reference?.toLowerCase().includes(reference.toLowerCase())
      );
    }

    if (contactId) {
      orders = orders.filter(o => o.contact?.contactID === contactId);
    }

    return { result: orders, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
