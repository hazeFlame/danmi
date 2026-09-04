import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type ProviderCategory = "collaboration" | "developer" | "productivity" | "ai";

export type ProviderAuthType = "device_flow" | "oauth2" | "api_key";

export type ProviderStatus = "available" | "coming_soon" | "planned";

export interface ProviderToolMeta {
  name: string;
  description: string;
  category?: string;
  parameters?: Record<string, any>;
}

export interface ProviderContext {
  userId: string;
  customD1?: D1Database;
  baseUrl?: string;
}

/**
 * 统一的集成平台（Provider）接口定义
 */
export interface IntegrationProvider<TCredentials = any> {
  id: string; // 如 'feishu', 'dingtalk', 'wecom', 'github'
  name: string; // 如 '飞书', '钉钉', '企业微信'
  shortDescription: string;
  description: string;
  iconName: string; // lucide icon identifier
  category: ProviderCategory;
  authType: ProviderAuthType;
  status: ProviderStatus;
  
  // 官方控制台或应用中心跳转链接
  consoleUrl?: string;

  // 校验该凭据是否有效
  validateCredentials(credentials: TCredentials): Promise<boolean>;

  // 获取该 Provider 声明的公开工具元信息清单
  getAvailableTools(): ProviderToolMeta[];

  // 向聚合或专享 MCP Server 实例动态挂载该 Provider 的全部工具
  registerTools(
    server: McpServer,
    credentials: TCredentials,
    context?: ProviderContext
  ): Promise<void> | void;

  // 创建专属于该 Provider 的独立 MCP Server 实例
  createStandaloneServer(
    credentials: TCredentials,
    context?: ProviderContext
  ): Promise<McpServer> | McpServer;
}
