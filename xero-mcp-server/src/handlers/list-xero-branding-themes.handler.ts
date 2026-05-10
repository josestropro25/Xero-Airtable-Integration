import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { BrandingTheme } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export async function listXeroBrandingThemes(): Promise<XeroClientResponse<BrandingTheme[]>> {
  try {
    await xeroClient.authenticate();

    const response = await xeroClient.accountingApi.getBrandingThemes(
      xeroClient.tenantId,
      getClientHeaders(),
    );

    return {
      result: response.body.brandingThemes ?? [],
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
