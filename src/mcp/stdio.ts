import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createFeishuMcpServer } from "./server.js";

async function main() {
  const server = createFeishuMcpServer();
  const transport = new StdioServerTransport();

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  await server.connect(transport);
  console.error("Feishu Task MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in stdio runner:", error);
  process.exit(1);
});
