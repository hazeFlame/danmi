import { auth } from "../src/auth/auth";
import { providerRegistry } from "../src/providers/registry";
import { ConnectionService } from "../src/services/connection";
import { GET as getIntegrations } from "../app/api/integrations/route";
import { POST as dedicatedPost } from "../app/api/mcp/[provider]/route";

async function runMultiMcpTest() {
  console.log("=== 1. 验证 ProviderRegistry 注册机制 ===");
  const providers = providerRegistry.getAll();
  console.log(
    "已注册 Providers:",
    providers.map((p) => `${p.id} (${p.name}) - ${p.status}`)
  );
  if (providers.length < 3) {
    throw new Error("ProviderRegistry 应当内置飞书、钉钉、企微");
  }

  console.log("\n=== 2. 创建测试用户并签发 Token ===");
  const testEmail = `multimcp_${Date.now()}@example.com`;
  const user = await auth.api.signUpEmail({
    body: {
      email: testEmail,
      password: "password123456",
      name: "MultiMCP Developer",
    },
  });
  const userId = user.user.id;

  const keyResult = await auth.api.createApiKey({
    body: {
      userId,
      name: "MultiMCP Test Key",
    },
  });
  const token = keyResult.key;
  console.log("用户与 Token 创建成功:", { userId, tokenPrefix: keyResult.start });

  console.log("\n=== 3. 测试专享端点 /api/mcp/feishu 未绑定时的响应 ===");
  const unconfiguredReq = new Request("http://localhost:3000/api/mcp/feishu", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0" },
      },
    }),
  });

  const unconfiguredRes = await dedicatedPost(unconfiguredReq, {
    params: Promise.resolve({ provider: "feishu" }),
  });
  console.log("未绑定飞书时 /api/mcp/feishu 状态码:", unconfiguredRes.status);
  const unconfiguredJson = (await unconfiguredRes.json()) as any;
  console.log("未绑定飞书提示响应:", unconfiguredJson.error?.message);

  if (unconfiguredRes.status !== 400 || unconfiguredJson.error?.code !== -32002) {
    throw new Error("未绑定特定平台时 /api/mcp/:provider 未正确拦截");
  }

  console.log("\n=== 4. 模拟连接飞书应用凭据到 user_connection ===");
  await ConnectionService.upsertUserConnection(userId, "feishu", {
    connectionName: "企业飞书协同助手",
    credentials: {
      appId: "cli_multimcp_12345",
      appSecret: "sec_multimcp_mock",
      appName: "企业飞书协同助手",
      userAccessToken: "u-mock_token",
    },
  });

  console.log("\n=== 5. 再次调用 /api/mcp/feishu (应当成功通过并返回独立 Server) ===");
  const configuredReq = new Request("http://localhost:3000/api/mcp/feishu", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0" },
      },
    }),
  });

  const configuredRes = await dedicatedPost(configuredReq, {
    params: Promise.resolve({ provider: "feishu" }),
  });
  console.log("连接飞书后 /api/mcp/feishu 状态码:", configuredRes.status);
  const configuredJson = (await configuredRes.json()) as any;
  console.log("Server Info:", configuredJson.result?.serverInfo);

  if (configuredRes.status !== 200 || !configuredJson.result?.serverInfo) {
    throw new Error("连接后 /api/mcp/feishu 初始化失败");
  }

  console.log("\n=== 6. 测试 /api/integrations 状态接口 ===");
  const signInRes = await auth.api.signInEmail({
    body: { email: testEmail, password: "password123456" },
    asResponse: true,
  });
  const cookie = signInRes.headers.get("set-cookie") || "";

  const integrationsReq = new Request("http://localhost:3000/api/integrations", {
    headers: {
      Cookie: cookie,
    },
  });

  const integrationsRes = await getIntegrations(integrationsReq);
  console.log("GET /api/integrations 状态码:", integrationsRes.status);
  const integrationsData = (await integrationsRes.json()) as any;
  console.log(
    "已连接数:",
    integrationsData.totalConnected,
    "平台总数:",
    integrationsData.providers?.length
  );

  const feishuStatus = integrationsData.providers?.find((p: any) => p.id === "feishu");
  console.log("飞书平台连接状态:", {
    name: feishuStatus?.name,
    connected: feishuStatus?.connected,
    connectionName: feishuStatus?.connectionName,
    toolsCount: feishuStatus?.toolsCount,
  });

  if (!feishuStatus?.connected || feishuStatus.toolsCount < 6) {
    throw new Error("飞书平台状态未能正确反映在 /api/integrations");
  }

  console.log("\n🎉 Multi-MCP 独立专享路由、插件平台注册与集成管理 API 验证全数通过！");
}

runMultiMcpTest().catch((err) => {
  console.error("Multi-MCP 测试失败:", err);
  process.exit(1);
});
