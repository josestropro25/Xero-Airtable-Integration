import { z } from "zod";
import { createXeroPurchaseOrder } from "../../handlers/create-xero-purchase-order.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const lineItemSchema = z.object({
  description: z.string().describe("The description of the line item"),
  quantity: z.number().describe("The quantity of the line item"),
  unitAmount: z.number().describe("The unit amount (price) of the line item"),
  accountCode: z.string().describe("The account code — can be obtained from the list-accounts tool"),
  taxType: z.string().describe("The tax type — can be obtained from the list-tax-rates tool"),
  itemCode: z.string().optional(),
});

const CreatePurchaseOrderTool = CreateXeroTool(
  "create-purchase-order",
  "Create a purchase order (RCTI) in Xero. Purchase orders are different from bills/invoices. " +
  "When created, a link to view the purchase order in Xero is returned. " +
  "Default status is SUBMITTED (submitted for approval).",
  {
    contactId: z.string().describe("The ID of the supplier contact. Can be obtained from the list-contacts tool."),
    lineItems: z.array(lineItemSchema),
    date: z.string().describe("The date of the purchase order (YYYY-MM-DD format).").optional(),
    deliveryDate: z.string().describe("The delivery date of the purchase order (YYYY-MM-DD format). Defaults to today.").optional(),
    reference: z.string().describe("A reference for the purchase order (e.g. product code).").optional(),
    currencyCode: z.string().describe("Currency code e.g. AUD, USD, GBP. Defaults to organisation base currency.").optional(),
    lineAmountTypes: z.enum(["EXCLUSIVE", "INCLUSIVE", "NOTAX"]).describe("How tax is applied. EXCLUSIVE = tax exclusive (default for RCTIs).").optional(),
    brandingThemeId: z.string().describe("The Xero branding theme ID. Use list-branding-themes to get IDs.").optional(),
    status: z.enum(["DRAFT", "SUBMITTED"]).describe("Status of the purchase order. SUBMITTED = submitted for approval. Defaults to SUBMITTED.").optional(),
  },
  async ({ contactId, lineItems, date, deliveryDate, reference, currencyCode, lineAmountTypes, brandingThemeId, status }) => {
    const result = await createXeroPurchaseOrder(
      contactId,
      lineItems,
      date,
      deliveryDate,
      reference,
      currencyCode,
      lineAmountTypes,
      brandingThemeId,
      status ?? "SUBMITTED",
    );

    if (result.isError) {
      return {
        content: [{ type: "text" as const, text: `Error creating purchase order: ${result.error}` }],
      };
    }

    const po = result.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Purchase order created successfully:",
            `ID: ${po.purchaseOrderID}`,
            `PO Number: ${po.purchaseOrderNumber}`,
            `Contact: ${po.contact?.name}`,
            `Date: ${po.date}`,
            `Delivery Date: ${po.deliveryDate}`,
            `Reference: ${po.reference}`,
            `Total: ${po.total}`,
            `Status: ${po.status}`,
          ].filter(Boolean).join("\n"),
        },
      ],
    };
  },
);

export default CreatePurchaseOrderTool;
