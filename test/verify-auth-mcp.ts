import { POST, GET } from "../app/api/mcp/route";
import { auth } from "../src/auth/auth";
import {
  getUserFeishuConfig,
  upsertUserFeishuConfig,
  deleteUserFeishuConfig,
} from "../src/auth/db";

async function runTest() {
  console.log("=== 1. 测试未授权访问 /api/mcp (应当被 401 拦截) ===");
  const unauthReq = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
    }),
  });

  const unauthRes = await POST(unauthReq);
  console.log("未携带 Token 状态码:", unauthRes.status);
  const unauthJson = (await unauthRes.json()) as any;
  console.log("未携带 Token 拦截响应:", unauthJson.error?.message);

  if (unauthRes.status !== 401) {
    throw new Error("未授权请求未被 401 拦截");
  }

  console.log("\n=== 2. 测试伪造/无效 Token 访问 /api/mcp (应当被 401 拦截) ===");
  const fakeTokenReq = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: "Bearer fake_token_abc_123",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
    }),
  });

  const fakeTokenRes = await POST(fakeTokenReq);
  console.log("伪造 Token 状态码:", fakeTokenRes.status);
  const fakeTokenJson = (await fakeTokenRes.json()) as any;
  console.log("伪造 Token 拦截响应:", fakeTokenJson.error?.message);

  if (fakeTokenRes.status !== 401) {
    throw new Error("伪造 Token 未被 401 拦截");
  }

  console.log("\n=== 3. 使用 Better Auth 注册用户并生成专属 MCP Token ===");
  const testEmail = `testuser_${Date.now()}@example.com`;
  const signUpRes = (await auth.api.signUpEmail({
    body: {
      name: "测试开发者",
      email: testEmail,
      password: "password123456",
    },
  })) as any;

  if (!signUpRes?.user?.id) {
    throw new Error(`用户注册失败: ${JSON.stringify(signUpRes)}`);
  }

  console.log("用户注册成功:", signUpRes.user.email);
  const userId = signUpRes.user.id;

  const createKeyRes = (await auth.api.createApiKey({
    body: {
      userId: userId,
      name: "Cursor Desktop Client",
      expiresIn: 30 * 24 * 60 * 60,
    },
  })) as any;

  if (!createKeyRes?.key) {
    throw new Error(`生成 MCP Token 失败: ${JSON.stringify(createKeyRes)}`);
  }

  const mcpToken = createKeyRes.key;
  console.log("专属 MCP Token 生成成功! Token 前缀/密钥:", mcpToken.slice(0, 10) + "...");

  console.log("\n=== 4. 测试用户未绑定飞书自建应用时的调度 (应当被 400 引导拦截) ===");
  const unconfiguredReq = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${mcpToken}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
    }),
  });

  const unconfiguredRes = await POST(unconfiguredReq);
  console.log("未绑定飞书时状态码:", unconfiguredRes.status);
  const unconfiguredJson = (await unconfiguredRes.json()) as any;
  console.log("未绑定飞书提示响应:", unconfiguredJson.error?.message);

  if (unconfiguredRes.status !== 400 || unconfiguredJson.error?.code !== -32002) {
    throw new Error("未绑定飞书时未正确拦截引导");
  }

  console.log("\n=== 5. 测试飞书设备流一键授权发起接口 (POST /api/feishu/device) ===");
  const signInRes = await auth.api.signInEmail({
    body: { email: testEmail, password: "password123456" },
    asResponse: true,
  });
  const cookie = signInRes.headers.get("set-cookie") || "";

  const { POST: devicePOST } = await import("../app/api/feishu/device/route");
  const deviceStartReq = new Request("http://localhost:3000/api/feishu/device", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ action: "start" }),
  });

  const deviceStartRes = await devicePOST(deviceStartReq as any);
  console.log("设备流发起状态码:", deviceStartRes.status);
  const deviceStartJson = (await deviceStartRes.json()) as any;
  console.log("获取到的飞书授权 verificationUrl:", deviceStartJson.verificationUrl);
  console.log("获取到的 userCode:", deviceStartJson.userCode);

  if (deviceStartRes.status !== 200 || !deviceStartJson.verificationUrl?.includes("page/cli")) {
    throw new Error("设备流发起失败或未返回正确的 verificationUrl");
  }

  console.log("\n=== 6. 模拟用户在控制台完成飞书应用绑定与授权 ===");
  await upsertUserFeishuConfig(userId, {
    appId: "cli_a1b2c3d4e5f6g7h8",
    appSecret: "mock_secret_xxxxxxxxxxxxxxxx",
    appName: "开发者测试任务助手",
    userAccessToken: "u-mock_user_access_token_123",
  });
  const savedConfig = await getUserFeishuConfig(userId);
  console.log("成功保存用户飞书凭据与个人令牌:", {
    appId: savedConfig?.appId,
    appName: savedConfig?.appName,
    hasUserToken: Boolean(savedConfig?.userAccessToken),
  });

  console.log("\n=== 7. 携带用户 Token 再次请求 /api/mcp (应当鉴权通过并使用该飞书应用 200 OK) ===");
  const authReq = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${mcpToken}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 10,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "cursor-client", version: "1.0" },
      },
    }),
  });

  const authRes = await POST(authReq);
  console.log("绑定后合法 Token 状态码:", authRes.status);
  const authJson = (await authRes.json()) as any;
  console.log("合法 Token 初始化响应结果:", JSON.stringify(authJson, null, 2));

  if (authRes.status !== 200 || !authJson.result?.serverInfo) {
    throw new Error("携带合法 Token 初始化失败");
  }

  console.log("\n=== 7. 测试携带合法 Token 查询工具列表 tools/list ===");
  const toolsReq = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${mcpToken}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/list",
      params: {},
    }),
  });

  const toolsRes = await POST(toolsReq);
  console.log("Tools/list 状态码:", toolsRes.status);
  const toolsJson = (await toolsRes.json()) as any;
  const toolNames = toolsJson.result?.tools?.map((t: any) => t.name);
  console.log("成功读取到的工具列表:", toolNames);

  if (!toolNames.includes("get_task") || !toolNames.includes("list_tasks")) {
    throw new Error("工具列表不完整");
  }

  console.log("\n=== 8. 测试解除绑定飞书后，MCP 再次恢复拦截 ===");
  await deleteUserFeishuConfig(userId);
  const afterDeleteRes = await POST(authReq);
  console.log("解除绑定后状态码:", afterDeleteRes.status);
  const afterDeleteJson = (await afterDeleteRes.json()) as any;
  console.log("解除绑定后提示信息:", afterDeleteJson.error?.message);

  if (afterDeleteRes.status !== 400 || afterDeleteJson.error?.code !== -32002) {
    throw new Error("解除绑定后未正确恢复拦截");
  }

  console.log("\n🎉 多租户飞书自主绑定 (BYOK)、动态租户检索与安全 MCP 访问全链路验证成功！");
}

runTest().catch((err) => {
  console.error("测试异常:", err);
  process.exit(1);
});
