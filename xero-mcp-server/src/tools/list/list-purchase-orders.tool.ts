import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroPurchaseOrders } from "../../handlers/list-xero-purchase-orders.handler.js";

const ListPurchaseOrdersTool = CreateXeroTool(
  "list-purchase-orders",
  "List purchase orders (RCTIs) in Xero. Filter by reference (product code) to check if an RCTI already exists before creating one.",
  {
    reference: z.string().describe("Filter by reference e.g. product code 'BARC 2026-04-2'. Partial match supported.").optional(),
    contactId: z.string().describe("Filter by contact ID (adviser group). Can be obtained from the list-contacts tool.").optional(),
    page: z.number().describe("Page number for pagination. Defaults to 1.").optional(),
  },
  async ({ reference, contactId, page }) => {
    const result = await listXeroPurchaseOrders(reference, contactId, page);

    if (result.isError) {
      return {
        content: [{ type: "text" as const, text: `Error listing purchase orders: ${result.error}` }],
      };
    }

    const orders = result.result;

    if (orders.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No purchase orders found." }],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Found ${orders.length} purchase order(s):`,
            ...orders.map(o =>
              `- ${o.purchaseOrderNumber} | ${o.contact?.name} | Ref: ${o.reference} | Net: ${o.subTotal} | Status: ${o.status}`
            ),
          ].join("\n"),
        },
      ],
    };
  },
);

export default ListPurchaseOrdersTool;
