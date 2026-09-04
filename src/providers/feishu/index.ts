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
  // 多维表格 (Bitable)
  {
    name: "feishu_list_bitable_tables",
    description: "列出飞书多维表格中的所有数据表（含 table_id 与名称）",
    category: "多维表格",
  },
  {
    name: "feishu_list_bitable_fields",
    description: "获取指定多维表格数据表的字段列表（含字段名、字段类型等）",
    category: "多维表格",
  },
  {
    name: "feishu_search_bitable_records",
    description: "查询与搜索多维表格记录行（支持分页、筛选表达式与排序）",
    category: "多维表格",
  },
  {
    name: "feishu_get_bitable_record",
    description: "获取多维表格中指定记录行 (record_id) 的详细字段数据",
    category: "多维表格",
  },
  {
    name: "feishu_create_bitable_record",
    description: "向多维表格数据表中插入一条新记录行",
    category: "多维表格",
  },
  {
    name: "feishu_update_bitable_record",
    description: "更新多维表格中指定记录行的数据字段",
    category: "多维表格",
  },
  // 云文档 (Docx)
  {
    name: "feishu_get_document_raw_content",
    description: "获取飞书新版云文档 (Docx) 的纯文本/Markdown内容",
    category: "云文档",
  },
  {
    name: "feishu_create_document",
    description: "在指定文件夹或根目录创建新的飞书云文档",
    category: "云文档",
  },
  // 日历日程 (Calendar)
  {
    name: "feishu_list_calendars",
    description: "获取当前用户的主日历和所有日历列表",
    category: "日历日程",
  },
  {
    name: "feishu_list_calendar_events",
    description: "获取指定日历的日程安排列表（支持时间范围筛选）",
    category: "日历日程",
  },
  {
    name: "feishu_create_calendar_event",
    description: "在飞书日历中创建新的日程会议（可指定开始结束时间与描述）",
    category: "日历日程",
  },
  // 知识库 (Wiki)
  {
    name: "feishu_list_wiki_spaces",
    description: "获取飞书知识库空间列表（含空间 ID、名称与描述）",
    category: "知识库",
  },
  {
    name: "feishu_get_wiki_node",
    description: "获取指定知识库节点信息（获取对应文档 obj_token 与 obj_type）",
    category: "知识库",
  },
  // 用户与通讯录 (Contact/User)
  {
    name: "feishu_get_user_info",
    description: "获取当前飞书授权用户的基本信息（姓名、头像、open_id 等）",
    category: "用户与通讯录",
  },
  // 即时通讯 (IM)
  {
    name: "feishu_send_message",
    description: "向指定飞书用户 (open_id) 或群聊 (chat_id) 发送文本消息通知",
    category: "即时通讯",
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

    // =========================================================================
    // 多维表格 (Bitable) 工具
    // =========================================================================

    // Tool 7: 列出多维表格数据表
    registerWithAliases(
      "list_bitable_tables",
      {
        description: "列出飞书多维表格（Base）中的所有数据表（含 table_id 与名称）",
        inputSchema: {
          app_token: z.string().describe("多维表格 app_token（通常位于多维表格链接中，如 feishu.cn/base/bascnxxxxxxxx）"),
          page_size: z.number().int().min(1).max(100).optional().describe("每页条数，默认 20，最大 100"),
          page_token: z.string().optional().describe("分页标记"),
        },
      },
      async ({ app_token, page_size, page_token }: any) => {
        try {
          const res = await client.listBitableTables(app_token, { pageSize: page_size, pageToken: page_token });
          const items = res.items || [];
          const listText = items.map((t, idx) => `${idx + 1}. **${t.name}** (\`table_id: ${t.table_id}\`)`).join("\n");
          return {
            content: [
              {
                type: "text",
                text: `📊 多维表格 [${app_token}] 共有 ${items.length} 个数据表：\n\n${listText || "暂无数据表"}\n\n\`\`\`json\n${JSON.stringify(res, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `获取多维表格 [${app_token}] 数据表失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // Tool 12: 列出数据表字段
    registerWithAliases(
      "list_bitable_fields",
      {
        description: "获取指定多维表格数据表的字段列表（含字段名称、字段类型）",
        inputSchema: {
          app_token: z.string().describe("多维表格 app_token"),
          table_id: z.string().describe("数据表 ID (table_id)"),
          page_size: z.number().int().min(1).max(100).optional().describe("每页条数，默认 50"),
          page_token: z.string().optional().describe("分页标记"),
        },
      },
      async ({ app_token, table_id, page_size, page_token }: any) => {
        try {
          const res = await client.listBitableFields(app_token, table_id, { pageSize: page_size, pageToken: page_token });
          const items = res.items || [];
          const listText = items.map((f, idx) => `${idx + 1}. **${f.field_name}** (类型: \`${f.ui_type || f.type}\`, id: \`${f.field_id}\`)`).join("\n");
          return {
            content: [
              {
                type: "text",
                text: `📋 数据表 [${table_id}] 字段结构（共 ${items.length} 个字段）：\n\n${listText || "暂无字段"}\n\n\`\`\`json\n${JSON.stringify(res, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `获取多维表格字段失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // Tool 13: 查询多维表格记录
    registerWithAliases(
      "search_bitable_records",
      {
        description: "查询与搜索多维表格记录行（支持分页、筛选表达式与排序）",
        inputSchema: {
          app_token: z.string().describe("多维表格 app_token"),
          table_id: z.string().describe("数据表 ID (table_id)"),
          filter: z.string().optional().describe("筛选公式，例如: CurrentValue.[状态] = \"已完成\""),
          sort: z.string().optional().describe("排序字段及方向，例如: [\"创建时间 DESC\"]"),
          page_size: z.number().int().min(1).max(100).optional().describe("每页返回数量，默认 20，最大 100"),
          page_token: z.string().optional().describe("分页标记"),
        },
      },
      async ({ app_token, table_id, filter, sort, page_size, page_token }: any) => {
        try {
          const res = await client.searchBitableRecords(app_token, table_id, { filter, sort, pageSize: page_size, pageToken: page_token });
          const items = res.items || [];
          return {
            content: [
              {
                type: "text",
                text: `🔍 成功查询到 ${items.length} 条记录 (总计: ${res.total ?? "未知"})\n\n\`\`\`json\n${JSON.stringify(res, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `查询多维表格记录失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // Tool: 获取多维表格单条记录详情
    registerWithAliases(
      "get_bitable_record",
      {
        description: "获取多维表格中指定记录行 (record_id) 的详细字段数据",
        inputSchema: {
          app_token: z.string().describe("多维表格 app_token"),
          table_id: z.string().describe("数据表 ID (table_id)"),
          record_id: z.string().describe("记录 ID (record_id)"),
        },
      },
      async ({ app_token, table_id, record_id }: any) => {
        try {
          const res = await client.getBitableRecord(app_token, table_id, record_id);
          return {
            content: [
              {
                type: "text",
                text: `📋 **多维表格记录 [${record_id}]**:\n\n\`\`\`json\n${JSON.stringify(res.record, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `获取多维表格记录 [${record_id}] 失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // Tool 14: 新增多维表格记录
    registerWithAliases(
      "create_bitable_record",
      {
        description: "向多维表格数据表中插入一条新记录行",
        inputSchema: {
          app_token: z.string().describe("多维表格 app_token"),
          table_id: z.string().describe("数据表 ID (table_id)"),
          fields: z.record(z.string(), z.any()).describe("字段名与其对应的值构成的键值对对象，例如: {\"任务名\": \"撰写周报\", \"负责人\": \"ou_xxx\"}"),
        },
      },
      async ({ app_token, table_id, fields }: any) => {
        try {
          const res = await client.createBitableRecord(app_token, table_id, fields);
          return {
            content: [
              {
                type: "text",
                text: `✅ 成功向多维表格新增记录！\n\n- **Record ID**: \`${res.record.record_id}\`\n\n\`\`\`json\n${JSON.stringify(res.record, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `新增多维表格记录失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // Tool 15: 更新多维表格记录
    registerWithAliases(
      "update_bitable_record",
      {
        description: "更新多维表格中指定记录行的数据字段",
        inputSchema: {
          app_token: z.string().describe("多维表格 app_token"),
          table_id: z.string().describe("数据表 ID (table_id)"),
          record_id: z.string().describe("记录 ID (record_id)"),
          fields: z.record(z.string(), z.any()).describe("需要更新的字段名及新值构成的键值对对象"),
        },
      },
      async ({ app_token, table_id, record_id, fields }: any) => {
        try {
          const res = await client.updateBitableRecord(app_token, table_id, record_id, fields);
          return {
            content: [
              {
                type: "text",
                text: `✏️ 成功更新多维表格记录 [${record_id}]！\n\n\`\`\`json\n${JSON.stringify(res.record, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `更新多维表格记录失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // =========================================================================
    // 云文档 (Docx) 工具
    // =========================================================================

    // Tool 16: 获取文档纯文本/Markdown
    registerWithAliases(
      "get_document_raw_content",
      {
        description: "获取飞书新版云文档 (Docx) 的纯文本/Markdown内容",
        inputSchema: {
          document_id: z.string().describe("云文档 Document ID (通常为文档 URL 中的 token，如 docxcnxxxxxxxx)"),
        },
      },
      async ({ document_id }: any) => {
        try {
          const res = await client.getDocumentRawContent(document_id);
          return {
            content: [
              {
                type: "text",
                text: `📄 **文档内容 [${document_id}]**:\n\n${res.content || "(文档内容为空)"}`,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `获取文档 [${document_id}] 内容失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // Tool 17: 创建云文档
    registerWithAliases(
      "create_document",
      {
        description: "在指定文件夹或根目录创建新的飞书云文档",
        inputSchema: {
          title: z.string().min(1).describe("文档标题"),
          folder_token: z.string().optional().describe("所在文件夹的 folder_token，不传则在根目录创建"),
        },
      },
      async ({ title, folder_token }: any) => {
        try {
          const res = await client.createDocument(title, folder_token);
          return {
            content: [
              {
                type: "text",
                text: `🎉 云文档创建成功！\n\n- **标题**: ${res.document.title}\n- **Document ID**: \`${res.document.document_id}\`\n\n\`\`\`json\n${JSON.stringify(res.document, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `创建云文档失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // =========================================================================
    // 日历日程 (Calendar) 工具
    // =========================================================================

    // Tool 18: 列出日历
    registerWithAliases(
      "list_calendars",
      {
        description: "获取当前用户的主日历和所有日历列表",
        inputSchema: {
          page_size: z.number().int().min(1).max(100).optional().describe("每页数量，默认 20"),
          page_token: z.string().optional().describe("分页标记"),
        },
      },
      async ({ page_size, page_token }: any) => {
        try {
          const res = await client.listCalendars({ pageSize: page_size, pageToken: page_token });
          const list = res.calendar_list || [];
          const listText = list.map((c, idx) => `${idx + 1}. **${c.summary}** (\`id: ${c.id}\`)`).join("\n");
          return {
            content: [
              {
                type: "text",
                text: `📅 找到 ${list.length} 个日历：\n\n${listText || "暂无日历"}\n\n\`\`\`json\n${JSON.stringify(res, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `获取日历列表失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // Tool 19: 查询日程事件
    registerWithAliases(
      "list_calendar_events",
      {
        description: "获取指定日历的日程安排列表（支持时间范围筛选）",
        inputSchema: {
          calendar_id: z.string().describe("日历 ID（可调用 list_calendars 获取，或传 'primary' 表示主日历）"),
          start_time: z.string().optional().describe("日程起始时间戳（毫秒字符串，如今日 0 点）"),
          end_time: z.string().optional().describe("日程结束时间戳（毫秒字符串）"),
          page_size: z.number().int().min(1).max(100).optional().describe("每页数量，默认 20"),
        },
      },
      async ({ calendar_id, start_time, end_time, page_size }: any) => {
        try {
          const res = await client.listCalendarEvents(calendar_id, { startTime: start_time, endTime: end_time, pageSize: page_size });
          const items = res.items || [];
          const listText = items.map((e, idx) => {
            const start = e.start_time?.timestamp ? new Date(Number(e.start_time.timestamp)).toLocaleString() : "未指定";
            return `${idx + 1}. **${e.summary || "未命名日程"}** (时间: ${start}, id: \`${e.event_id}\`)`;
          }).join("\n");
          return {
            content: [
              {
                type: "text",
                text: `📅 日历 [${calendar_id}] 共有 ${items.length} 个日程事件：\n\n${listText || "暂无日程事件"}\n\n\`\`\`json\n${JSON.stringify(res, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `获取日程列表失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // Tool 20: 创建日历日程
    registerWithAliases(
      "create_calendar_event",
      {
        description: "在飞书日历中创建新的日程会议（可指定开始结束时间与描述）",
        inputSchema: {
          calendar_id: z.string().describe("日历 ID（如 'primary' 表示主日历）"),
          summary: z.string().min(1).describe("日程标题"),
          description: z.string().optional().describe("日程说明或会议议程"),
          start_timestamp: z.string().describe("开始时间戳（毫秒字符串，如 '1725450000000'）"),
          end_timestamp: z.string().describe("结束时间戳（毫秒字符串，如 '1725453600000'）"),
        },
      },
      async ({ calendar_id, summary, description, start_timestamp, end_timestamp }: any) => {
        try {
          const res = await client.createCalendarEvent(calendar_id, {
            summary,
            description,
            startTime: { timestamp: start_timestamp },
            endTime: { timestamp: end_timestamp },
          });
          return {
            content: [
              {
                type: "text",
                text: `🎉 日程创建成功！\n\n- **标题**: ${summary}\n- **Event ID**: \`${res.event?.event_id}\`\n\n\`\`\`json\n${JSON.stringify(res, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `创建日程事件失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // =========================================================================
    // 即时通讯 (IM) 工具
    // =========================================================================

    // Tool 21: 发送消息
    registerWithAliases(
      "send_message",
      {
        description: "向指定飞书用户 (open_id) 或群聊 (chat_id) 发送文本消息通知",
        inputSchema: {
          receive_id_type: z.enum(["open_id", "chat_id", "user_id", "email"]).describe("接收者 ID 类型（个人通常用 open_id，群聊用 chat_id）"),
          receive_id: z.string().describe("接收者的 ID (open_id 或 chat_id 等)"),
          text: z.string().min(1).describe("要发送的消息文本内容"),
        },
      },
      async ({ receive_id_type, receive_id, text }: any) => {
        try {
          const content = JSON.stringify({ text });
          const res = await client.sendMessage(receive_id_type, receive_id, "text", content);
          return {
            content: [
              {
                type: "text",
                text: `💬 飞书消息发送成功！\n\n- **接收者**: \`${receive_id}\` (${receive_id_type})\n- **Message ID**: \`${res.message_id || res.data?.message_id}\`\n- **内容**: ${text}`,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `发送飞书消息失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // =========================================================================
    // 知识库 (Wiki) 工具
    // =========================================================================

    // Tool 22: 列出知识空间
    registerWithAliases(
      "list_wiki_spaces",
      {
        description: "获取飞书知识库空间列表（含空间 ID、名称与描述）",
        inputSchema: {
          page_size: z.number().int().min(1).max(50).optional().describe("每页数量，默认 20"),
          page_token: z.string().optional().describe("分页标记"),
        },
      },
      async ({ page_size, page_token }: any) => {
        try {
          const res = await client.listWikiSpaces({ pageSize: page_size, pageToken: page_token });
          const items = res.items || [];
          const listText = items.map((s, idx) => `${idx + 1}. **${s.name}** (\`space_id: ${s.space_id}\`)${s.description ? ` - ${s.description}` : ""}`).join("\n");
          return {
            content: [
              {
                type: "text",
                text: `📚 共查询到 ${items.length} 个知识库空间：\n\n${listText || "暂无知识库空间"}\n\n\`\`\`json\n${JSON.stringify(res, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `获取知识库空间列表失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // Tool 23: 获取知识空间节点信息
    registerWithAliases(
      "get_wiki_node",
      {
        description: "获取指定知识库节点信息（获取对应文档 obj_token 与 obj_type）",
        inputSchema: {
          token: z.string().describe("知识库节点 token（或 wiki 网页链接中的 token）"),
        },
      },
      async ({ token }: any) => {
        try {
          const res = await client.getWikiNode(token);
          return {
            content: [
              {
                type: "text",
                text: `📖 **知识库节点信息**:\n\n- **标题**: ${res.node?.title || "未命名"}\n- **文档类型 (obj_type)**: \`${res.node?.obj_type}\`\n- **文档 Token (obj_token)**: \`${res.node?.obj_token}\`\n- **知识空间 ID**: \`${res.node?.space_id}\`\n\n\`\`\`json\n${JSON.stringify(res.node, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `获取知识库节点信息失败: ${error?.message || String(error)}` }],
          };
        }
      }
    );

    // =========================================================================
    // 用户与通讯录 (Contact/User) 工具
    // =========================================================================

    // Tool 24: 获取当前授权用户信息
    registerWithAliases(
      "get_user_info",
      {
        description: "获取当前飞书授权用户的基本信息（姓名、头像、open_id 等）",
        inputSchema: {},
      },
      async () => {
        try {
          const res = await client.getUserInfo();
          return {
            content: [
              {
                type: "text",
                text: `👤 **当前飞书用户信息**:\n\n- **姓名**: ${res.name || "(未知)"}\n- **Open ID**: \`${res.open_id || "无"}\`\n- **User ID**: \`${res.user_id || "无"}\`\n- **Tenant Key**: \`${res.tenant_key || "无"}\`\n\n\`\`\`json\n${JSON.stringify(res, null, 2)}\n\`\`\``,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `获取飞书用户信息失败: ${error?.message || String(error)}` }],
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
