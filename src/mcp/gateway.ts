import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { providerRegistry } from "../providers/registry";
import { ConnectionService } from "../services/connection";
import type { ProviderContext } from "../providers/types";

export class McpGateway {
  /**
   * 构建用户专属的【全能聚合 MCP Server】(/api/mcp 或 /api/mcp/all)
   * 动态整合该用户已激活的所有平台（飞书、钉钉、企微等）的工具集
   */
  static async createAggregatedMcpServer(
    userId: string,
    context?: Partial<ProviderContext>
  ): Promise<McpServer> {
    const server = new McpServer({
      name: "omni-aggregated-mcp",
      version: "1.0.0",
    });

    const fullContext: ProviderContext = {
      userId,
      customD1: context?.customD1,
      baseUrl: context?.baseUrl,
    };

    // 1. 读取当前用户已连接的全部平台凭据
    const connections = await ConnectionService.getUserConnections(
      userId,
      context?.customD1
    );

    // 2. 如果用户尚未配置任何平台，注册引导工具，优雅提示
    if (connections.length === 0) {
      server.registerTool(
        "get_platform_status",
        {
          description: "获取当前 MCP 网关连接状态与支持的平台列表",
          inputSchema: {},
        },
        async () => ({
          content: [
            {
              type: "text",
              text: `【MCP 平台就绪】当前您的账号尚未绑定任何外部应用。\n请登录控制台 (/) 在「应用集成中心」一键连接飞书、钉钉或企业微信，系统将自动挂载对应平台的数据查询与操作工具。`,
            },
          ],
        })
      );
      return server;
    }

    // 3. 动态聚合各个 Provider 的工具
    for (const conn of connections) {
      const provider = providerRegistry.get(conn.providerId);
      if (provider && provider.status === "available") {
        try {
          provider.registerTools(server, conn.credentials, fullContext);
        } catch (err: any) {
          console.error(
            `[McpGateway] 挂载 Provider [${conn.providerId}] 工具异常:`,
            err
          );
        }
      }
    }

    return server;
  }

  /**
   * 构建用户专属的【平台独立 MCP Server】(/api/mcp/:provider，如 /api/mcp/feishu)
   * 仅暴露该特定平台的工具，满足细粒度隔离和场景化 Agent 挂载
   */
  static async createDedicatedMcpServer(
    userId: string,
    providerId: string,
    context?: Partial<ProviderContext>
  ): Promise<McpServer> {
    const provider = providerRegistry.get(providerId);
    if (!provider) {
      const server = new McpServer({
        name: `unknown-provider-mcp`,
        version: "1.0.0",
      });
      server.registerTool(
        "provider_error",
        {
          description: "未知平台提示",
          inputSchema: {},
        },
        async () => ({
          isError: true,
          content: [
            {
              type: "text",
              text: `平台 [${providerId}] 不存在或暂未受支持。当前支持的平台包括: ${providerRegistry
                .getAll()
                .map((p) => p.id)
                .join(", ")}`,
            },
          ],
        })
      );
      return server;
    }

    const fullContext: ProviderContext = {
      userId,
      customD1: context?.customD1,
      baseUrl: context?.baseUrl,
    };

    const conn = await ConnectionService.getUserConnection(
      userId,
      providerId,
      context?.customD1
    );

    // 未连接该特定平台时的友好提示工具
    if (!conn || conn.status !== "active") {
      const server = new McpServer({
        name: `${providerId}-mcp-server`,
        version: "1.0.0",
      });
      server.registerTool(
        `connect_${providerId}_guide`,
        {
          description: `获取 ${provider.name} 连接引导说明`,
          inputSchema: {},
        },
        async () => ({
          content: [
            {
              type: "text",
              text: `您尚未连接 ${provider.name}。\n请访问平台控制台 (/) ->「应用集成」卡片中完成 ${provider.name} 授权绑定后即可使用此专享 MCP 服务。`,
            },
          ],
        })
      );
      return server;
    }

    // 实例化该 Provider 的独立专享 Server
    return provider.createStandaloneServer(conn.credentials, fullContext);
  }
}
