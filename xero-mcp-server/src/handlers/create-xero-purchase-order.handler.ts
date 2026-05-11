import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { CurrencyCode, LineAmountTypes, LineItemTracking, PurchaseOrder } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface PurchaseOrderLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

async function createPurchaseOrder(
  contactId: string,
  lineItems: PurchaseOrderLineItem[],
  date: string | undefined,
  deliveryDate: string | undefined,
  reference: string | undefined,
  currencyCode: string | undefined,
  lineAmountTypes: string | undefined,
  brandingThemeId: string | undefined,
  status: string,
): Promise<PurchaseOrder | undefined> {
  await xeroClient.authenticate();

  const lineAmountTypesMap: Record<string, LineAmountTypes> = {
    EXCLUSIVE: LineAmountTypes.Exclusive,
    INCLUSIVE: LineAmountTypes.Inclusive,
    NOTAX: LineAmountTypes.NoTax,
  };

  const purchaseOrder: PurchaseOrder = {
    contact: { contactID: contactId },
    lineItems: lineItems,
    date: date || new Date().toISOString().split("T")[0],
    deliveryDate: deliveryDate || new Date().toISOString().split("T")[0],
    ...(reference ? { reference } : {}),
    ...(currencyCode ? { currencyCode: currencyCode as unknown as CurrencyCode } : {}),
    ...(lineAmountTypes ? { lineAmountTypes: lineAmountTypesMap[lineAmountTypes] } : {}),
    ...(brandingThemeId ? { brandingTheme: { brandingThemeID: brandingThemeId } } : {}),
    status: status as unknown as PurchaseOrder.StatusEnum,
  };

  const response = await xeroClient.accountingApi.createPurchaseOrders(
    xeroClient.tenantId,
    { purchaseOrders: [purchaseOrder] },
    true,
    undefined,
    getClientHeaders(),
  );

  return response.body.purchaseOrders?.[0];
}

export async function createXeroPurchaseOrder(
  contactId: string,
  lineItems: PurchaseOrderLineItem[],
  date?: string,
  deliveryDate?: string,
  reference?: string,
  currencyCode?: string,
  lineAmountTypes?: string,
  brandingThemeId?: string,
  status = "SUBMITTED",
): Promise<XeroClientResponse<PurchaseOrder>> {
  try {
    const created = await createPurchaseOrder(
      contactId,
      lineItems,
      date,
      deliveryDate,
      reference,
      currencyCode,
      lineAmountTypes,
      brandingThemeId,
      status,
    );

    if (!created) {
      throw new Error("Purchase order creation failed.");
    }

    return { result: created, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
