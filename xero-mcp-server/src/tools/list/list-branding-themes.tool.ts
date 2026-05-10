import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroBrandingThemes } from "../../handlers/list-xero-branding-themes.handler.js";

const ListBrandingThemesTool = CreateXeroTool(
  "list-branding-themes",
  "List all branding themes in Xero. Returns the ID and name of each theme. Use the ID with the create-invoice brandingThemeId parameter.",
  {},
  async () => {
    const result = await listXeroBrandingThemes();

    if (result.isError) {
      return {
        content: [{ type: "text" as const, text: `Error listing branding themes: ${result.error}` }],
      };
    }

    const themes = result.result;

    return {
      content: [
        {
          type: "text" as const,
          text: themes.length === 0
            ? "No branding themes found."
            : ["Branding themes:", ...themes.map(t => `- ${t.name}: ${t.brandingThemeID}`)].join("\n"),
        },
      ],
    };
  },
);

export default ListBrandingThemesTool;
