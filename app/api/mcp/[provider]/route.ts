import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { McpGateway } from "@/src/mcp/gateway";
import { verifyMcpToken } from "@/src/auth/auth";
import { providerRegistry } from "@/src/providers/registry";

export const runtime = "edge";

interface RouteContext {
  params: Promise<{ provider: string }>;
}

async function handleDedicatedMcpRequest(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const { provider: providerId } = await context.params;
  const url = new URL(request.url);

  // If user visits via browser directly, return status info for this specific provider MCP
  const acceptHeader = request.headers.get("accept") || "";
  if (
    request.method === "GET" &&
    acceptHeader.includes("text/html") &&
    !acceptHeader.includes("text/event-stream")
  ) {
    const provider = providerRegistry.get(providerId);
    return new Response(
      JSON.stringify(
        {
          name: `${provider?.name || providerId} Dedicated MCP Server`,
          provider: providerId,
          status: provider?.status || "unknown",
          version: "1.0.0",
          transport: "Streamable HTTP",
          auth: "Required (Bearer <mcp_token> / x-api-key)",
          endpoints: {
            mcp: url.pathname,
            aggregatedMcp: "/api/mcp",
            dashboard: "/",
          },
          tools: provider?.getAvailableTools() || [],
          instructions: `Connect your AI client to ${url.pathname} with 'Authorization: Bearer <your_token>'.`,
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

  // 1. 验证用户专属 MCP Token
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
          message: `未授权访问: ${verification.error || "缺少或无效的 MCP Token"}。请访问控制台 (/) 注册并获取专属 Token。`,
        },
        id: null,
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "WWW-Authenticate": `Bearer realm="${providerId} MCP"`,
        },
      }
    );
  }

  // 2. 检查用户是否已连接该特定平台
  const { ConnectionService } = await import("@/src/services/connection");
  const conn = await ConnectionService.getUserConnection(verification.userId || "", providerId);
  if (!conn || conn.status !== "active") {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32002,
          message: `您尚未在控制台 (/) 绑定「${providerId}」应用。请登录控制台完成应用授权后，再使用此专享 MCP 端点。`,
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

  // 3. 使用 McpGateway 构建针对该平台的专属独立 MCP Server
  const server = await McpGateway.createDedicatedMcpServer(
    verification.userId || "",
    providerId,
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

export async function GET(request: Request, context: RouteContext) {
  return handleDedicatedMcpRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return handleDedicatedMcpRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return handleDedicatedMcpRequest(request, context);
}
