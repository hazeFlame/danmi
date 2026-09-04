# danmi

基于 Cloudflare Worker + Vinext 构建的多平台 Model Context Protocol (MCP) 服务。
采用 **Better Auth** 多用户认证体系，支持用户自助注册并生成专属 MCP Token。**服务端无需配置任何全局凭据**，支持用户在前端控制台一键免密授权或自主绑定自建应用，实现真正的多租户数据与权限隔离。

---

## 🔒 安全架构设计

```
                    ┌───────────────────────────────┐
                    │       客户端 (Client)         │
                    │   Cursor / Claude Desktop     │
                    └──────────────┬────────────────┘
                                   │
               携带专属 MCP Token: Authorization: Bearer <mcp_token>
                                   │
                                   ▼
              ┌───────────────────────────────────────────┐
              │      Cloudflare Worker (/api/mcp)         │
              │                                           │
              │ 1. Better Auth 验证用户 MCP Token 合法性   │
              │ 2. 按用户身份检索其在控制台绑定的飞书凭据: │
              │    - 用户个人自建应用 (cli_xxxxxxxx)       │
              │    - 绑定的 App Secret (安全持久化于 D1)   │
              │ 3. 动态实例化该用户的 FeishuClient 调取任务│
              └────────────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌───────────────────────────────┐
                    │      飞书开放平台 (Feishu)     │
                    │     Task v2 Open APIs         │
                    └───────────────────────────────┘
```

- **纯正多租户 BYOK 架构**：服务器无需全局硬编码任何飞书密钥，每个用户自主绑定各自的飞书应用（`cli_xxx`）。
- **凭证安全隔离**：用户在控制台录入后安全持久化，终端 AI 客户端只使用生成的专属 MCP Token。
- **一键免密设备流授权**：网页端支持调用飞书官方设备流（`open.feishu.cn/page/cli`）一键授权，无需手动填写复杂参数。

---

## 🛠️ 支持的 MCP 工具 (Tools)

| 工具名称 | 功能描述 | 核心参数 |
| :--- | :--- | :--- |
| `feishu_get_task` / `get_task` | 获取指定任务详情（标题、说明、截止时间、完成状态、成员、飞书链接等） | `task_guid` (必需) |
| `feishu_list_tasks` / `list_tasks` | 查询任务列表，支持根据完成状态筛选以及分页 | `completed` (可选), `page_size`, `page_token` |
| `feishu_list_tasklists` / `list_tasklists` | 获取当前可访问的任务清单（Tasklist）列表 | `page_size`, `page_token` |
| `feishu_list_tasklist_tasks` / `list_tasklist_tasks` | 查询特定清单下的所有任务 | `tasklist_guid` (必需), `completed`, `page_size` |
| `feishu_get_task_comments` / `get_task_comments` | 获取指定任务的评论回复与讨论列表 | `task_guid` (必需), `page_size`, `page_token` |
| `feishu_list_subtasks` / `list_subtasks` | 获取指定任务的子任务列表 | `task_guid` (必需), `page_size`, `page_token` |

---

## 🚀 本地开发与部署

### 1. 配置服务端环境变量
本地运行时创建 `.dev.vars`（仅服务端运行可见）：
```bash
cp .dev.vars.example .dev.vars
# 仅包含 BETTER_AUTH_SECRET 与 BETTER_AUTH_URL，服务端不存放任何第三方飞书密钥
```

### 2. 启动本地开发服务
```bash
pnpm run dev
```

### 3. 使用流程
1. 访问网页：`http://localhost:3000/`（首次使用进入 `/login` 注册/登录）。
2. 在 **「连接飞书」** 卡片中点击「一键免密授权」，在弹窗中选择或创建飞书应用并点击授权。
3. 点击左下角 **「令牌管理」**（`/tokens`），点击「立即签发专属 Token」。
4. 点击「一键复制配置」，直接粘贴进 Cursor / Claude Desktop / Windsurf 即可！

---

## 🔌 客户端配置接入 (极简格式)

直接在客户端 MCP 配置文件中粘贴：

```json
{
  "feishu-task": {
    "serverUrl": "https://<your-worker>.workers.dev/api/mcp",
    "headers": {
      "Authorization": "Bearer <YOUR_MCP_TOKEN>"
    }
  }
}
```

> 💡 **在控制台生成 Token 后，控制台页面提供了一键复制按钮，会自动为您把专属 Token 填入上方配置，开箱即用！**
}
```

---

## ☁️ 部署到 Cloudflare Workers

1. **设置生产密钥**：
```bash
npx wrangler secret put FEISHU_APP_ID
npx wrangler secret put FEISHU_APP_SECRET
npx wrangler secret put BETTER_AUTH_SECRET
```

2. **数据库生成与迁移 (Drizzle Kit + Cloudflare D1 自动增量迁移)**：
```bash
# 生成 Drizzle 迁移 SQL 文件
pnpm run db:generate

# 本地执行迁移
pnpm run db:migrate:local

# 生产远程执行迁移 (需先执行 npx wrangler d1 create danmi 并在 wrangler.jsonc 填入 database_id)
pnpm run db:migrate:remote
```

3. **构建并部署 Worker**：
```bash
pnpm run build
pnpm run deploy
```

---

## 🧪 自动化测试验证

运行内置的端到端鉴权拦截与 MCP 协议测试：
```bash
npx tsx test/verify-auth-mcp.ts
```
