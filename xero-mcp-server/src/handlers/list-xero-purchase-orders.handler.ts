import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { PurchaseOrder } from "xero-node";

export async function listXeroPurchaseOrders(
  reference?: string,
  contactId?: string,
  page?: number,
): Promise<XeroClientResponse<PurchaseOrder[]>> {
  try {
    await xeroClient.authenticate();

    let allOrders: PurchaseOrder[] = [];

    if (page !== undefined) {
      // Single page fetch
      const response = await xeroClient.accountingApi.getPurchaseOrders(
        xeroClient.tenantId,
        undefined, undefined, undefined, undefined, undefined, page,
      );
      allOrders = response.body.purchaseOrders ?? [];
    } else {
      // Fetch ALL pages until empty — needed for reference-based reconciliation
      let currentPage = 1;
      while (true) {
        const response = await xeroClient.accountingApi.getPurchaseOrders(
          xeroClient.tenantId,
          undefined, undefined, undefined, undefined, undefined, currentPage,
        );
        const batch = response.body.purchaseOrders ?? [];
        if (batch.length === 0) break;
        allOrders = allOrders.concat(batch);
        if (batch.length < 100) break;
        currentPage++;
      }
    }

    if (reference) {
      allOrders = allOrders.filter(o =>
        o.reference?.toLowerCase() === reference.toLowerCase()
      );
    }

    if (contactId) {
      allOrders = allOrders.filter(o => o.contact?.contactID === contactId);
    }

    return { result: allOrders, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
