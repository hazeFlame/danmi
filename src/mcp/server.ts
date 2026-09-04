import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FeishuClient, type FeishuClientConfig } from "../feishu/client.js";
import {
  formatCommentMarkdown,
  formatTaskMarkdown,
  formatTasklistMarkdown,
} from "../feishu/format.js";

/**
 * Creates and configures a Feishu Task MCP server instance
 */
export function createFeishuMcpServer(
  clientOrConfig?: FeishuClient | FeishuClientConfig
): McpServer {
  const client =
    clientOrConfig instanceof FeishuClient
      ? clientOrConfig
      : new FeishuClient(clientOrConfig);

  const server = new McpServer({
    name: "feishu-task-mcp",
    version: "1.0.0",
  });

  // Tool 1: 获取单个任务详情
  server.registerTool(
    "get_task",
    {
      description:
        "获取指定飞书任务的详细信息（标题、说明、截止时间、完成状态、成员、飞书链接等）",
      inputSchema: {
        task_guid: z
          .string()
          .describe("飞书任务全局唯一标识符 (task_guid)"),
        user_id_type: z
          .enum(["open_id", "union_id", "user_id"])
          .optional()
          .describe("用户 ID 类型，默认为 open_id"),
      },
    },
    async ({ task_guid, user_id_type }) => {
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
              text: `获取任务 [${task_guid}] 失败: ${error?.message || String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Tool 2: 获取任务列表
  server.registerTool(
    "list_tasks",
    {
      description:
        "查询飞书任务列表，支持根据是否完成进行筛选以及分页查询",
      inputSchema: {
        completed: z
          .boolean()
          .optional()
          .describe("是否已完成。true 表示只查已完成，false 表示只查待办，不传则返回全部"),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("每页条数，默认 20，最大 100"),
        page_token: z
          .string()
          .optional()
          .describe("分页标记，用于请求下一页"),
        user_id_type: z
          .enum(["open_id", "union_id", "user_id"])
          .optional()
          .describe("用户 ID 类型，默认为 open_id"),
      },
    },
    async ({ completed, page_size, page_token, user_id_type }) => {
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
              text: `获取任务列表失败: ${error?.message || String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Tool 3: 获取清单（Tasklist）列表
  server.registerTool(
    "list_tasklists",
    {
      description: "获取当前可访问的飞书任务清单（Tasklist）列表",
      inputSchema: {
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("每页条数，默认 20，最大 100"),
        page_token: z
          .string()
          .optional()
          .describe("分页标记"),
        user_id_type: z
          .enum(["open_id", "union_id", "user_id"])
          .optional()
          .describe("用户 ID 类型，默认为 open_id"),
      },
    },
    async ({ page_size, page_token, user_id_type }) => {
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
              text: `获取任务清单列表失败: ${error?.message || String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Tool 4: 获取特定清单内的任务
  server.registerTool(
    "list_tasklist_tasks",
    {
      description: "查询指定飞书任务清单（Tasklist）下的任务列表",
      inputSchema: {
        tasklist_guid: z
          .string()
          .describe("任务清单 GUID (tasklist_guid)"),
        completed: z
          .boolean()
          .optional()
          .describe("是否已完成。true 为已完成，false 为待办，不传为全部"),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("每页条数"),
        page_token: z
          .string()
          .optional()
          .describe("分页标记"),
        user_id_type: z
          .enum(["open_id", "union_id", "user_id"])
          .optional()
          .describe("用户 ID 类型"),
      },
    },
    async ({ tasklist_guid, completed, page_size, page_token, user_id_type }) => {
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
  server.registerTool(
    "get_task_comments",
    {
      description: "获取指定飞书任务的评论与讨论列表",
      inputSchema: {
        task_guid: z
          .string()
          .describe("任务 GUID (task_guid)"),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("每页条数"),
        page_token: z
          .string()
          .optional()
          .describe("分页标记"),
        user_id_type: z
          .enum(["open_id", "union_id", "user_id"])
          .optional()
          .describe("用户 ID 类型"),
      },
    },
    async ({ task_guid, page_size, page_token, user_id_type }) => {
      try {
        const result = await client.getTaskComments(task_guid, {
          pageSize: page_size,
          pageToken: page_token,
          userIdType: user_id_type,
        });

        const commentTexts = result.items.map((c) =>
          formatCommentMarkdown(c)
        );

        const summary = [
          `任务 [${task_guid}] 共有 ${result.items.length} 条评论：`,
          "",
          ...(commentTexts.length > 0
            ? commentTexts
            : ["暂无评论讨论"]),
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
  server.registerTool(
    "list_subtasks",
    {
      description: "获取指定飞书任务的子任务列表",
      inputSchema: {
        task_guid: z
          .string()
          .describe("父任务 GUID (task_guid)"),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("每页条数"),
        page_token: z
          .string()
          .optional()
          .describe("分页标记"),
        user_id_type: z
          .enum(["open_id", "union_id", "user_id"])
          .optional()
          .describe("用户 ID 类型"),
      },
    },
    async ({ task_guid, page_size, page_token, user_id_type }) => {
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

  return server;
}
