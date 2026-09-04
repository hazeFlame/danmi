import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { IntegrationProvider, ProviderToolMeta, ProviderContext } from "../types";
import { FeishuClient } from "../../feishu/client";
import {
  formatCommentMarkdown,
  formatTaskMarkdown,
} from "../../feishu/format";

export interface FeishuCredentials {
  appId?: string;
  appSecret?: string;
  appName?: string;
  userAccessToken?: string;
  userRefreshToken?: string;
}

const FEISHU_TOOLS: ProviderToolMeta[] = [
  {
    name: "feishu_get_task",
    description: "获取指定飞书任务的详细信息（标题、说明、截止时间、完成状态、成员、飞书链接等）",
    category: "任务协同",
  },
  {
    name: "feishu_list_tasks",
    description: "查询飞书任务列表，支持根据是否完成进行筛选以及分页查询",
    category: "任务协同",
  },
  {
    name: "feishu_list_tasklists",
    description: "获取飞书任务清单列表（支持分页查询）",
    category: "任务协同",
  },
  {
    name: "feishu_list_tasklist_tasks",
    description: "获取指定飞书任务清单内的所有任务列表",
    category: "任务协同",
  },
  {
    name: "feishu_get_task_comments",
    description: "获取指定飞书任务下的所有评论列表",
    category: "任务协同",
  },
  {
    name: "feishu_list_subtasks",
    description: "获取指定飞书任务下的所有子任务列表",
    category: "任务协同",
  },
];

export class FeishuProvider implements IntegrationProvider<FeishuCredentials> {
  id = "feishu";
  name = "飞书 (Lark)";
  shortDescription = "智能办公协同平台，支持任务、日历、云文档与多维表格";
  description = "连接您的飞书自建应用，赋予 AI 助手直接读取与管理飞书待办任务、清单和协作讨论的强大能力。";
  iconName = "Building2";
  category = "collaboration" as const;
  authType = "device_flow" as const;
  status = "available" as const;
  consoleUrl = "https://open.feishu.cn/app";

  getAvailableTools(): ProviderToolMeta[] {
    return FEISHU_TOOLS;
  }

  async validateCredentials(credentials: FeishuCredentials): Promise<boolean> {
    if (!credentials) return false;
    return Boolean(
      credentials.userAccessToken ||
      (credentials.appId && credentials.appSecret)
    );
  }

  registerTools(
    server: McpServer,
    credentials: FeishuCredentials,
    _context?: ProviderContext
  ): void {
    const client = new FeishuClient({
      appId: credentials.appId,
      appSecret: credentials.appSecret,
      userAccessToken: credentials.userAccessToken,
    });

    // 辅助工具注册函数：同时注册带前缀 feishu_xxx 与无前缀 xxx（最大化兼容客户端）
    const registerWithAliases = (
      toolName: string,
      config: any,
      handler: (args: any) => Promise<any>
    ) => {
      // 1. 注册带命名空间的标准工具名 (feishu_xxx)
      server.registerTool(`feishu_${toolName}`, config, handler);
      // 2. 注册无前缀兼容别名 (xxx)
      try {
        server.registerTool(toolName, config, handler);
      } catch {
        // 如果与其他平台同名则保留命名空间版本
      }
    };

    // Tool 1: 获取单个任务详情
    registerWithAliases(
      "get_task",
      {
        description: "获取指定飞书任务的详细信息（标题、说明、截止时间、完成状态、成员、飞书链接等）",
        inputSchema: {
          task_guid: z.string().describe("飞书任务全局唯一标识符 (task_guid)"),
          user_id_type: z.enum(["open_id", "union_id", "user_id"]).optional().describe("用户 ID 类型，默认为 open_id"),
        },
      },
      async ({ task_guid, user_id_type }: any) => {
        try {
          const task = await client.getTask(task_guid, { userIdType: user_id_type });
          const markdown = formatTaskMarkdown(task);
          return {
            content: [
              {
                type: "text",
                text: `${markdown}\n\n\`\`\`json\n${JSON.stringify(task, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `获取飞书任务 [${task_guid}] 失败: ${error?.message || String(error)}`,
              },
            ],
          };
        }
      }
    );

    // Tool 2: 获取任务列表
    registerWithAliases(
      "list_tasks",
      {
        description: "查询飞书任务列表，支持根据是否完成进行筛选以及分页查询",
        inputSchema: {
          completed: z.boolean().optional().describe("是否已完成。true 表示只查已完成，false 表示只查待办，不传则返回全部"),
          page_size: z.number().int().min(1).max(100).optional().describe("每页条数，默认 20，最大 100"),
          page_token: z.string().optional().describe("分页标记，用于请求下一页"),
          user_id_type: z.enum(["open_id", "union_id", "user_id"]).optional().describe("用户 ID 类型，默认为 open_id"),
        },
      },
      async ({ completed, page_size, page_token, user_id_type }: any) => {
        try {
          const result = await client.listTasks({
            completed,
            pageSize: page_size,
            pageToken: page_token,
            userIdType: user_id_type,
          });

          const count = result.items.length;
          const taskLines = result.items.map(
            (t, idx) =>
              `${idx + 1}. [${t.completed_at && t.completed_at !== "0" ? "已完成" : "待办"}] **${t.summary || "未命名"}** (\`guid: ${t.guid}\`)${t.due?.timestamp ? ` - 截止: ${new Date(Number(t.due.timestamp)).toLocaleDateString()}` : ""}`
          );

          const summary = [
            `共查询到 ${count} 个任务${result.has_more ? "（还有更多）" : ""}：`,
            "",
            ...(taskLines.length > 0 ? taskLines : ["暂无任务"]),
            "",
            result.page_token ? `下一页标记: \`${result.page_token}\`` : "",
          ]
            .filter(Boolean)
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `${summary}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `查询飞书任务列表失败: ${error?.message || String(error)}`,
              },
            ],
          };
        }
      }
    );

    // Tool 3: 获取任务清单列表
    registerWithAliases(
      "list_tasklists",
      {
        description: "获取飞书任务清单列表（支持分页查询）",
        inputSchema: {
          page_size: z.number().int().min(1).max(100).optional().describe("每页条数，默认 20，最大 100"),
          page_token: z.string().optional().describe("分页标记，用于请求下一页"),
          user_id_type: z.enum(["open_id", "union_id", "user_id"]).optional().describe("用户 ID 类型，默认为 open_id"),
        },
      },
      async ({ page_size, page_token, user_id_type }: any) => {
        try {
          const result = await client.listTasklists({
            pageSize: page_size,
            pageToken: page_token,
            userIdType: user_id_type,
          });

          const listLines = result.items.map(
            (l, idx) =>
              `${idx + 1}. **${l.name}** (\`guid: ${l.guid}\`)${l.owner?.name ? ` - 负责人: ${l.owner.name}` : ""}`
          );

          const summary = [
            `共查询到 ${result.items.length} 个任务清单：`,
            "",
            ...(listLines.length > 0 ? listLines : ["暂无清单"]),
            "",
            result.page_token ? `下一页标记: \`${result.page_token}\`` : "",
          ]
            .filter(Boolean)
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `${summary}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `获取飞书任务清单列表失败: ${error?.message || String(error)}`,
              },
            ],
          };
        }
      }
    );

    // Tool 4: 获取指定清单的任务
    registerWithAliases(
      "list_tasklist_tasks",
      {
        description: "获取指定飞书任务清单内的所有任务列表",
        inputSchema: {
          tasklist_guid: z.string().describe("任务清单 GUID (tasklist_guid)"),
          completed: z.boolean().optional().describe("是否已完成。true 为已完成，false 为待办，不传为全部"),
          page_size: z.number().int().min(1).max(100).optional().describe("每页条数"),
          page_token: z.string().optional().describe("分页标记"),
          user_id_type: z.enum(["open_id", "union_id", "user_id"]).optional().describe("用户 ID 类型"),
        },
      },
      async ({ tasklist_guid, completed, page_size, page_token, user_id_type }: any) => {
        try {
          const result = await client.listTasklistTasks(tasklist_guid, {
            completed,
            pageSize: page_size,
            pageToken: page_token,
            userIdType: user_id_type,
          });

          const taskLines = result.items.map(
            (t, idx) =>
              `${idx + 1}. [${t.completed_at && t.completed_at !== "0" ? "已完成" : "待办"}] **${t.summary || "未命名"}** (\`guid: ${t.guid}\`)`
          );

          const summary = [
            `清单 [${tasklist_guid}] 下共查询到 ${result.items.length} 个任务：`,
            "",
            ...(taskLines.length > 0 ? taskLines : ["该清单下暂无任务"]),
            "",
            result.page_token ? `下一页标记: \`${result.page_token}\`` : "",
          ]
            .filter(Boolean)
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `${summary}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `获取清单任务失败: ${error?.message || String(error)}`,
              },
            ],
          };
        }
      }
    );

    // Tool 5: 获取任务评论列表
    registerWithAliases(
      "get_task_comments",
      {
        description: "获取指定飞书任务下的所有评论列表",
        inputSchema: {
          task_guid: z.string().describe("飞书任务 GUID (task_guid)"),
          page_size: z.number().int().min(1).max(100).optional().describe("每页条数"),
          page_token: z.string().optional().describe("分页标记"),
          user_id_type: z.enum(["open_id", "union_id", "user_id"]).optional().describe("用户 ID 类型"),
        },
      },
      async ({ task_guid, page_size, page_token, user_id_type }: any) => {
        try {
          const result = await client.getTaskComments(task_guid, {
            pageSize: page_size,
            pageToken: page_token,
            userIdType: user_id_type,
          });

          const commentTexts = result.items.map((c) => formatCommentMarkdown(c));
          const summary = [
            `任务 [${task_guid}] 共有 ${result.items.length} 条评论：`,
            "",
            ...(commentTexts.length > 0 ? commentTexts : ["暂无评论讨论"]),
            "",
            result.page_token ? `下一页标记: \`${result.page_token}\`` : "",
          ]
            .filter(Boolean)
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `${summary}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `获取任务评论失败: ${error?.message || String(error)}`,
              },
            ],
          };
        }
      }
    );

    // Tool 6: 获取子任务列表
    registerWithAliases(
      "list_subtasks",
      {
        description: "获取指定飞书任务下的所有子任务列表",
        inputSchema: {
          task_guid: z.string().describe("父任务 GUID (task_guid)"),
          page_size: z.number().int().min(1).max(100).optional().describe("每页条数"),
          page_token: z.string().optional().describe("分页标记"),
          user_id_type: z.enum(["open_id", "union_id", "user_id"]).optional().describe("用户 ID 类型"),
        },
      },
      async ({ task_guid, page_size, page_token, user_id_type }: any) => {
        try {
          const result = await client.listSubtasks(task_guid, {
            pageSize: page_size,
            pageToken: page_token,
            userIdType: user_id_type,
          });

          const taskLines = result.items.map(
            (t, idx) =>
              `${idx + 1}. [${t.completed_at && t.completed_at !== "0" ? "已完成" : "待办"}] **${t.summary || "未命名"}** (\`guid: ${t.guid}\`)`
          );

          const summary = [
            `任务 [${task_guid}] 共有 ${result.items.length} 个子任务：`,
            "",
            ...(taskLines.length > 0 ? taskLines : ["暂无子任务"]),
            "",
            result.page_token ? `下一页标记: \`${result.page_token}\`` : "",
          ]
            .filter(Boolean)
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `${summary}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `获取子任务失败: ${error?.message || String(error)}`,
              },
            ],
          };
        }
      }
    );
  }

  createStandaloneServer(
    credentials: FeishuCredentials,
    context?: ProviderContext
  ): McpServer {
    const server = new McpServer({
      name: "feishu-mcp-server",
      version: "2.0.0",
    });
    this.registerTools(server, credentials, context);
    return server;
  }
}
