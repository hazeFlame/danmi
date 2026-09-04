import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IntegrationProvider, ProviderToolMeta, ProviderContext } from "../types";

export interface WeComCredentials {
  corpId?: string;
  corpSecret?: string;
  agentId?: string;
}

const WECOM_TOOLS: ProviderToolMeta[] = [
  {
    name: "wecom_send_message",
    description: "向企业微信群机器人或成员发送应用卡片消息",
    category: "通讯协同",
  },
  {
    name: "wecom_list_contacts",
    description: "获取企业微信通讯录与部门成员列表",
    category: "通讯协同",
  },
];

export class WeComProvider implements IntegrationProvider<WeComCredentials> {
  id = "wecom";
  name = "企业微信 (WeCom)";
  shortDescription = "腾讯企业协作平台，支持组织通讯录、工作台应用与微信互通";
  description = "连接企业微信自建应用，赋予 AI Agent 触达企业员工、发送工作通知与协同处理客户联系的能力。";
  iconName = "MessageSquare";
  category = "collaboration" as const;
  authType = "api_key" as const;
  status = "planned" as const;
  consoleUrl = "https://work.weixin.qq.com";

  getAvailableTools(): ProviderToolMeta[] {
    return WECOM_TOOLS;
  }

  async validateCredentials(credentials: WeComCredentials): Promise<boolean> {
    if (!credentials) return false;
    return Boolean(credentials.corpId && credentials.corpSecret);
  }

  registerTools(_server: McpServer, _credentials: WeComCredentials, _context?: ProviderContext): void {}

  createStandaloneServer(credentials: WeComCredentials, context?: ProviderContext): McpServer {
    const server = new McpServer({ name: "wecom-mcp-server", version: "1.0.0" });
    this.registerTools(server, credentials, context);
    return server;
  }
}
