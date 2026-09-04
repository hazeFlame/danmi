import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { McpGateway } from "@/src/mcp/gateway";
import { verifyMcpToken } from "@/src/auth/auth";
import { providerRegistry } from "@/src/providers/registry";

export const runtime = "edge";

async function handleMcpRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // If user visits via browser directly, return status info
  const acceptHeader = request.headers.get("accept") || "";
  if (
    request.method === "GET" &&
    acceptHeader.includes("text/html") &&
    !acceptHeader.includes("text/event-stream")
  ) {
    const supportedProviders = providerRegistry.getAll().map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      dedicatedEndpoint: `/api/mcp/${p.id}`,
    }));

    return new Response(
      JSON.stringify(
        {
          name: "Omni-Platform Universal Aggregated MCP Server",
          status: "online",
          version: "1.0.0",
          transport: "Streamable HTTP",
          auth: "Required (Bearer <mcp_token> / x-api-key)",
          endpoints: {
            aggregatedMcp: url.pathname,
            dedicatedEndpoints: supportedProviders,
            dashboard: "/",
          },
          instructions:
            "Please visit / to manage your integrations and get your personal MCP Token, then connect with 'Authorization: Bearer <your_token>'.",
        },
        null,
        2
      ),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // 1. 验证用户专属 MCP Token (通过 Authorization Bearer, x-api-key, 或 URL query token)
  const authHeader = request.headers.get("authorization") || "";
  const apiKeyHeader = request.headers.get("x-api-key") || "";
  const queryToken = url.searchParams.get("token") || "";

  const rawToken = authHeader || apiKeyHeader || queryToken;
  const verification = await verifyMcpToken(rawToken);

  if (!verification.valid) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: `未授权访问: ${verification.error || "缺少或无效的 MCP Token"}。请访问控制台 (/) 注册并生成您的专属 MCP Token。`,
        },
        id: null,
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "WWW-Authenticate": 'Bearer realm="Feishu MCP"',
        },
      }
    );
  }

  // 2. 检查用户是否已接入至少一个协同平台应用
  const { ConnectionService } = await import("@/src/services/connection");
  const connections = await ConnectionService.getUserConnections(verification.userId || "");
  if (connections.length === 0) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32002,
          message:
            "您尚未在控制台 (/) 绑定任何平台应用（如飞书）。请登录控制台完成一键免密授权或填写凭据后，再连接此 MCP 端点。",
        },
        id: null,
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // 3. 使用 McpGateway 构建用户专属的【全能聚合 MCP Server】
  const server = await McpGateway.createAggregatedMcpServer(
    verification.userId || "",
    { baseUrl: url.origin }
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless edge mode
    enableJsonResponse: true,
  });

  await server.connect(transport);

  // Normalize Accept header for MCP Streamable HTTP requirement
  let req = request;
  if (
    !acceptHeader.includes("text/event-stream") ||
    !acceptHeader.includes("application/json")
  ) {
    const headers = new Headers(request.headers);
    headers.set("accept", "application/json, text/event-stream");

    let bodyData: BodyInit | null = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      bodyData = await request.text();
    }

    req = new Request(request.url, {
      method: request.method,
      headers,
      body: bodyData,
    });
  }

  const response = await transport.handleRequest(req);

  // Add CORS headers for web MCP clients
  const resHeaders = new Headers(response.headers);
  resHeaders.set("Access-Control-Allow-Origin", "*");
  resHeaders.set(
    "Access-Control-Allow-Methods",
    "GET, POST, DELETE, OPTIONS"
  );
  resHeaders.set("Access-Control-Allow-Headers", "*");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}
