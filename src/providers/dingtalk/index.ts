import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { IntegrationProvider, ProviderToolMeta, ProviderContext } from "../types";

export interface DingTalkCredentials {
  clientId?: string;
  clientSecret?: string;
  corpId?: string;
  accessToken?: string;
}

const DINGTALK_TOOLS: ProviderToolMeta[] = [
  {
    name: "dingtalk_get_user_tasks",
    description: "获取指定钉钉用户的待办任务列表",
    category: "待办协同",
  },
  {
    name: "dingtalk_send_work_record",
    description: "向钉钉用户发送工作待办卡片或任务通知",
    category: "消息通知",
  },
  {
    name: "dingtalk_list_approvals",
    description: "查询用户待处理或已发起的钉钉 OA 审批单列表",
    category: "OA审批",
  },
];

export class DingTalkProvider implements IntegrationProvider<DingTalkCredentials> {
  id = "dingtalk";
  name = "钉钉 (DingTalk)";
  shortDescription = "阿里巴巴智能移动办公平台，支持待办、工作通知与 OA 审批";
  description = "连接您的钉钉企业内部应用或智能工作台，让 AI Agent 轻松管理钉钉待办事项、发送卡片消息和查询 OA 审批流。";
  iconName = "Briefcase";
  category = "collaboration" as const;
  authType = "oauth2" as const;
  status = "coming_soon" as const;
  consoleUrl = "https://open-dev.dingtalk.com";

  getAvailableTools(): ProviderToolMeta[] {
    return DINGTALK_TOOLS;
  }

  async validateCredentials(credentials: DingTalkCredentials): Promise<boolean> {
    if (!credentials) return false;
    return Boolean(credentials.accessToken || (credentials.clientId && credentials.clientSecret));
  }

  registerTools(
    server: McpServer,
    _credentials: DingTalkCredentials,
    _context?: ProviderContext
  ): void {
    server.registerTool(
      "dingtalk_get_user_tasks",
      {
        description: "获取指定钉钉用户的待办任务列表",
        inputSchema: {
          user_id: z.string().describe("钉钉用户 userid"),
        },
      },
      async ({ user_id }: any) => {
        return {
          content: [
            {
              type: "text",
              text: `[DingTalk Preview] 成功查询用户 [${user_id}] 的钉钉待办任务（该能力接入准备中，即将正式发布）`,
            },
          ],
        };
      }
    );
  }

  createStandaloneServer(
    credentials: DingTalkCredentials,
    context?: ProviderContext
  ): McpServer {
    const server = new McpServer({
      name: "dingtalk-mcp-server",
      version: "1.0.0",
    });
    this.registerTools(server, credentials, context);
    return server;
  }
}
