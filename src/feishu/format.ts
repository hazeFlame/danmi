import type {
  FeishuComment,
  FeishuTask,
  FeishuTasklist,
} from "./types.js";

function formatTimestamp(ts?: string): string {
  if (!ts) return "无";
  const num = Number(ts);
  if (isNaN(num) || num <= 0) return "无";
  return new Date(num).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

export function formatTaskMarkdown(task: FeishuTask): string {
  const isCompleted = task.completed_at && task.completed_at !== "0";
  const statusStr = isCompleted
    ? `已完成 (完成时间: ${formatTimestamp(task.completed_at)})`
    : "待处理";

  const membersStr =
    task.members && task.members.length > 0
      ? task.members
          .map((m) => `${m.name || m.id}${m.role ? ` (${m.role})` : ""}`)
          .join(", ")
      : "未指定";

  const dueStr = task.due?.timestamp
    ? formatTimestamp(task.due.timestamp)
    : "无截止时间";

  const lines: string[] = [
    `### 📋 任务: ${task.summary || "未命名任务"}`,
    `- **任务 GUID**: \`${task.guid}\``,
    `- **状态**: ${statusStr}`,
    `- **截止日期**: ${dueStr}`,
    `- **负责人/成员**: ${membersStr}`,
  ];

  if (task.creator?.name || task.creator?.id) {
    lines.push(`- **创建人**: ${task.creator.name || task.creator.id}`);
  }

  if (task.subtask_count !== undefined && task.subtask_count > 0) {
    lines.push(`- **子任务数量**: ${task.subtask_count}`);
  }

  if (task.url) {
    lines.push(`- **飞书链接**: [查看任务](${task.url})`);
  }

  if (task.description && task.description.trim()) {
    lines.push(`\n**任务描述**:\n${task.description.trim()}`);
  }

  return lines.join("\n");
}

export function formatTasklistMarkdown(list: FeishuTasklist): string {
  const lines: string[] = [
    `### 📁 清单: ${list.name}`,
    `- **清单 GUID**: \`${list.guid}\``,
  ];
  if (list.owner?.name || list.owner?.id) {
    lines.push(`- **负责人**: ${list.owner.name || list.owner.id}`);
  }
  if (list.url) {
    lines.push(`- **飞书链接**: [查看清单](${list.url})`);
  }
  return lines.join("\n");
}

export function formatCommentMarkdown(comment: FeishuComment): string {
  const author = comment.creator?.name || comment.creator?.id || "未知用户";
  const time = formatTimestamp(comment.created_at);
  return `> **${author}** (${time}):\n> ${comment.content}\n`;
}
