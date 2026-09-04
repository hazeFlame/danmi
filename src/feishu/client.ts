import type {
  FeishuApiResponse,
  FeishuComment,
  FeishuTask,
  FeishuTasklist,
  FeishuTenantAccessTokenResponse,
  ListCommentsResult,
  ListTasklistsResult,
  ListTasksResult,
} from "./types.js";

export interface FeishuClientConfig {
  appId?: string;
  appSecret?: string;
  baseUrl?: string;
  userAccessToken?: string;
}

export class FeishuClient {
  private appId: string;
  private appSecret: string;
  private baseUrl: string;
  private userAccessToken?: string;

  private cachedTenantToken?: string;
  private tokenExpiresAt = 0;

  constructor(config: FeishuClientConfig = {}) {
    this.appId =
      config.appId ||
      process.env.FEISHU_APP_ID ||
      process.env.LARK_APP_ID ||
      "";
    this.appSecret =
      config.appSecret ||
      process.env.FEISHU_APP_SECRET ||
      process.env.LARK_APP_SECRET ||
      "";
    this.baseUrl = (
      config.baseUrl ||
      process.env.FEISHU_BASE_URL ||
      "https://open.feishu.cn"
    ).replace(/\/$/, "");
    this.userAccessToken =
      config.userAccessToken ||
      process.env.FEISHU_USER_ACCESS_TOKEN;
  }

  /**
   * Check if client has necessary credentials
   */
  public hasCredentials(): boolean {
    return Boolean(
      this.userAccessToken || (this.appId && this.appSecret)
    );
  }

  /**
   * Get valid tenant_access_token with automatic cache & refresh
   */
  public async getTenantAccessToken(): Promise<string> {
    const now = Date.now();
    // Use cached token if valid for at least 5 more minutes
    if (this.cachedTenantToken && this.tokenExpiresAt - now > 5 * 60 * 1000) {
      return this.cachedTenantToken;
    }

    if (!this.appId || !this.appSecret) {
      throw new Error(
        "Feishu credentials missing: Please provide FEISHU_APP_ID and FEISHU_APP_SECRET (or FEISHU_USER_ACCESS_TOKEN)."
      );
    }

    const url = `${this.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to request tenant_access_token: HTTP ${response.status} ${response.statusText}`
      );
    }

    const result =
      (await response.json()) as FeishuTenantAccessTokenResponse;

    if (result.code !== 0) {
      throw new Error(
        `Failed to get tenant_access_token: [${result.code}] ${result.msg}`
      );
    }

    this.cachedTenantToken = result.tenant_access_token;
    // expire is in seconds
    this.tokenExpiresAt = now + (result.expire || 7200) * 1000;
    return this.cachedTenantToken;
  }

  /**
   * Execute authenticated API request
   */
  public async request<T = unknown>(
    endpoint: string,
    options: RequestInit & { token?: string } = {}
  ): Promise<T> {
    const token =
      options.token ||
      this.userAccessToken ||
      (await this.getTenantAccessToken());

    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Content-Type", "application/json; charset=utf-8");

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Feishu HTTP request failed [${response.status} ${response.statusText}]: ${errorText}`
      );
    }

    const body = (await response.json()) as FeishuApiResponse<T>;
    if (body.code !== 0) {
      const errDetail = body.error?.message
        ? ` (${body.error.message})`
        : "";
      throw new Error(`Feishu API Error [${body.code}]: ${body.msg}${errDetail}`);
    }

    return body.data as T;
  }

  /**
   * Get task details by task_guid
   */
  public async getTask(
    taskGuid: string,
    options: { userIdType?: string; token?: string } = {}
  ): Promise<FeishuTask> {
    const userIdType = options.userIdType || "open_id";
    const endpoint = `/open-apis/task/v2/tasks/${encodeURIComponent(
      taskGuid
    )}?user_id_type=${userIdType}`;

    const data = await this.request<{ task: FeishuTask }>(endpoint, {
      method: "GET",
      token: options.token,
    });

    return data.task;
  }

  /**
   * List tasks
   */
  public async listTasks(
    options: {
      pageSize?: number;
      pageToken?: string;
      completed?: boolean;
      userIdType?: string;
      token?: string;
    } = {}
  ): Promise<ListTasksResult> {
    const params = new URLSearchParams();
    if (options.pageSize) params.set("page_size", String(options.pageSize));
    if (options.pageToken) params.set("page_token", options.pageToken);
    if (options.completed !== undefined) {
      params.set("completed", String(options.completed));
    }
    params.set("user_id_type", options.userIdType || "open_id");

    const endpoint = `/open-apis/task/v2/tasks?${params.toString()}`;
    const data = await this.request<{
      items?: FeishuTask[];
      page_token?: string;
      has_more?: boolean;
    }>(endpoint, {
      method: "GET",
      token: options.token,
    });

    return {
      items: data.items || [],
      page_token: data.page_token,
      has_more: data.has_more,
    };
  }

  /**
   * List tasklists (清单列表)
   */
  public async listTasklists(
    options: {
      pageSize?: number;
      pageToken?: string;
      userIdType?: string;
      token?: string;
    } = {}
  ): Promise<ListTasklistsResult> {
    const params = new URLSearchParams();
    if (options.pageSize) params.set("page_size", String(options.pageSize));
    if (options.pageToken) params.set("page_token", options.pageToken);
    params.set("user_id_type", options.userIdType || "open_id");

    const endpoint = `/open-apis/task/v2/tasklists?${params.toString()}`;
    const data = await this.request<{
      items?: FeishuTasklist[];
      page_token?: string;
      has_more?: boolean;
    }>(endpoint, {
      method: "GET",
      token: options.token,
    });

    return {
      items: data.items || [],
      page_token: data.page_token,
      has_more: data.has_more,
    };
  }

  /**
   * List tasks within a specific tasklist
   */
  public async listTasklistTasks(
    tasklistGuid: string,
    options: {
      pageSize?: number;
      pageToken?: string;
      completed?: boolean;
      userIdType?: string;
      token?: string;
    } = {}
  ): Promise<ListTasksResult> {
    const params = new URLSearchParams();
    if (options.pageSize) params.set("page_size", String(options.pageSize));
    if (options.pageToken) params.set("page_token", options.pageToken);
    if (options.completed !== undefined) {
      params.set("completed", String(options.completed));
    }
    params.set("user_id_type", options.userIdType || "open_id");

    const endpoint = `/open-apis/task/v2/tasklists/${encodeURIComponent(
      tasklistGuid
    )}/tasks?${params.toString()}`;

    const data = await this.request<{
      items?: FeishuTask[];
      page_token?: string;
      has_more?: boolean;
    }>(endpoint, {
      method: "GET",
      token: options.token,
    });

    return {
      items: data.items || [],
      page_token: data.page_token,
      has_more: data.has_more,
    };
  }

  /**
   * Get comments on a task
   */
  public async getTaskComments(
    taskGuid: string,
    options: {
      pageSize?: number;
      pageToken?: string;
      userIdType?: string;
      token?: string;
    } = {}
  ): Promise<ListCommentsResult> {
    const params = new URLSearchParams();
    params.set("resource_type", "task");
    params.set("resource_id", taskGuid);
    if (options.pageSize) params.set("page_size", String(options.pageSize));
    if (options.pageToken) params.set("page_token", options.pageToken);
    params.set("user_id_type", options.userIdType || "open_id");

    const endpoint = `/open-apis/task/v2/comments?${params.toString()}`;
    const data = await this.request<{
      items?: FeishuComment[];
      page_token?: string;
      has_more?: boolean;
    }>(endpoint, {
      method: "GET",
      token: options.token,
    });

    return {
      items: data.items || [],
      page_token: data.page_token,
      has_more: data.has_more,
    };
  }

  /**
   * List subtasks for a task
   */
  public async listSubtasks(
    taskGuid: string,
    options: {
      pageSize?: number;
      pageToken?: string;
      userIdType?: string;
      token?: string;
    } = {}
  ): Promise<ListTasksResult> {
    const params = new URLSearchParams();
    if (options.pageSize) params.set("page_size", String(options.pageSize));
    if (options.pageToken) params.set("page_token", options.pageToken);
    params.set("user_id_type", options.userIdType || "open_id");

    const endpoint = `/open-apis/task/v2/tasks/${encodeURIComponent(
      taskGuid
    )}/subtasks?${params.toString()}`;

    const data = await this.request<{
      items?: FeishuTask[];
      page_token?: string;
      has_more?: boolean;
    }>(endpoint, {
      method: "GET",
      token: options.token,
    });

    return {
      items: data.items || [],
      page_token: data.page_token,
      has_more: data.has_more,
    };
  }

  /**
   * Update task fields (PATCH /open-apis/task/v2/tasks/:task_guid)
   */
  public async patchTask(
    taskGuid: string,
    payload: {
      task: Record<string, any>;
      update_fields: string[];
    },
    options: { userIdType?: string; token?: string } = {}
  ): Promise<FeishuTask> {
    const userIdType = options.userIdType || "open_id";
    const endpoint = `/open-apis/task/v2/tasks/${encodeURIComponent(
      taskGuid
    )}?user_id_type=${userIdType}`;

    const data = await this.request<{ task: FeishuTask }>(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      token: options.token,
    });

    return data.task;
  }

  /**
   * Complete a task by setting completed_at to current timestamp (打勾完成任务)
   */
  public async completeTask(
    taskGuid: string,
    options: { userIdType?: string; token?: string } = {}
  ): Promise<FeishuTask> {
    return this.patchTask(
      taskGuid,
      {
        task: { completed_at: Date.now().toString() },
        update_fields: ["completed_at"],
      },
      options
    );
  }

  /**
   * Uncomplete/restore a task by setting completed_at to "0" (恢复任务至未完成)
   */
  public async uncompleteTask(
    taskGuid: string,
    options: { userIdType?: string; token?: string } = {}
  ): Promise<FeishuTask> {
    return this.patchTask(
      taskGuid,
      {
        task: { completed_at: "0" },
        update_fields: ["completed_at"],
      },
      options
    );
  }

  /**
   * Create a new task
   */
  public async createTask(
    task: {
      summary: string;
      description?: string;
      due?: { timestamp?: string; is_all_day?: boolean };
      members?: Array<{ id: string; type?: string; role?: string }>;
    },
    options: { userIdType?: string; token?: string } = {}
  ): Promise<FeishuTask> {
    const userIdType = options.userIdType || "open_id";
    const endpoint = `/open-apis/task/v2/tasks?user_id_type=${userIdType}`;

    const data = await this.request<{ task: FeishuTask }>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ task }),
      token: options.token,
    });

    return data.task;
  }

  // =========================================================================
  // 多维表格 (Bitable) API
  // =========================================================================

  /**
   * 列出多维表格中的所有数据表
   */
  public async listBitableTables(
    appToken: string,
    options: { pageSize?: number; pageToken?: string; token?: string } = {}
  ): Promise<{ items: Array<{ table_id: string; revision: number; name: string }>; has_more?: boolean; page_token?: string; total?: number }> {
    const params = new URLSearchParams();
    if (options.pageSize) params.set("page_size", String(options.pageSize));
    if (options.pageToken) params.set("page_token", options.pageToken);

    const endpoint = `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables?${params.toString()}`;
    return this.request(endpoint, { method: "GET", token: options.token });
  }

  /**
   * 列出多维表格数据表的字段列表
   */
  public async listBitableFields(
    appToken: string,
    tableId: string,
    options: { pageSize?: number; pageToken?: string; token?: string } = {}
  ): Promise<{ items: Array<{ field_id: string; field_name: string; type: number; ui_type?: string }>; has_more?: boolean; page_token?: string }> {
    const params = new URLSearchParams();
    if (options.pageSize) params.set("page_size", String(options.pageSize));
    if (options.pageToken) params.set("page_token", options.pageToken);

    const endpoint = `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/fields?${params.toString()}`;
    return this.request(endpoint, { method: "GET", token: options.token });
  }

  /**
   * 查询与搜索多维表格记录
   */
  public async searchBitableRecords(
    appToken: string,
    tableId: string,
    options: { pageSize?: number; pageToken?: string; filter?: string; sort?: string; token?: string } = {}
  ): Promise<{ items: Array<{ record_id: string; fields: Record<string, any> }>; has_more?: boolean; page_token?: string; total?: number }> {
    const params = new URLSearchParams();
    if (options.pageSize) params.set("page_size", String(options.pageSize));
    if (options.pageToken) params.set("page_token", options.pageToken);
    if (options.filter) params.set("filter", options.filter);
    if (options.sort) params.set("sort", options.sort);

    const endpoint = `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records?${params.toString()}`;
    return this.request(endpoint, { method: "GET", token: options.token });
  }

  /**
   * 获取多维表格单条记录详情
   */
  public async getBitableRecord(
    appToken: string,
    tableId: string,
    recordId: string,
    options: { token?: string } = {}
  ): Promise<{ record: { record_id: string; fields: Record<string, any>; record_url?: string } }> {
    const endpoint = `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`;
    return this.request(endpoint, { method: "GET", token: options.token });
  }

  /**
   * 新增多维表格记录行
   */
  public async createBitableRecord(
    appToken: string,
    tableId: string,
    fields: Record<string, any>,
    options: { token?: string } = {}
  ): Promise<{ record: { record_id: string; fields: Record<string, any> } }> {
    const endpoint = `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records`;
    return this.request(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ fields }),
      token: options.token,
    });
  }

  /**
   * 更新多维表格记录行
   */
  public async updateBitableRecord(
    appToken: string,
    tableId: string,
    recordId: string,
    fields: Record<string, any>,
    options: { token?: string } = {}
  ): Promise<{ record: { record_id: string; fields: Record<string, any> } }> {
    const endpoint = `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`;
    return this.request(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ fields }),
      token: options.token,
    });
  }

  // =========================================================================
  // 新版云文档 (Docx) API
  // =========================================================================

  /**
   * 获取新版云文档纯文本/Markdown内容
   */
  public async getDocumentRawContent(
    documentId: string,
    options: { token?: string } = {}
  ): Promise<{ content: string }> {
    const endpoint = `/open-apis/docx/v1/documents/${encodeURIComponent(documentId)}/raw_content`;
    return this.request(endpoint, { method: "GET", token: options.token });
  }

  /**
   * 创建新的云文档
   */
  public async createDocument(
    title: string,
    folderToken?: string,
    options: { token?: string } = {}
  ): Promise<{ document: { document_id: string; title: string; revision_id?: number } }> {
    const endpoint = `/open-apis/docx/v1/documents`;
    return this.request(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ title, folder_token: folderToken }),
      token: options.token,
    });
  }

  // =========================================================================
  // 日程与日历 (Calendar) API
  // =========================================================================

  /**
   * 获取用户的日历列表
   */
  public async listCalendars(
    options: { pageSize?: number; pageToken?: string; token?: string } = {}
  ): Promise<{ calendar_list: Array<{ id: string; summary: string; description?: string; permissions?: string }> }> {
    const params = new URLSearchParams();
    if (options.pageSize) params.set("page_size", String(options.pageSize));
    if (options.pageToken) params.set("page_token", options.pageToken);

    const endpoint = `/open-apis/calendar/v4/calendars?${params.toString()}`;
    return this.request(endpoint, { method: "GET", token: options.token });
  }

  /**
   * 查询指定日历的日程事件
   */
  public async listCalendarEvents(
    calendarId: string,
    options: { startTime?: string; endTime?: string; pageSize?: number; pageToken?: string; token?: string } = {}
  ): Promise<{ items: Array<{ event_id: string; summary: string; description?: string; start_time?: { timestamp?: string }; end_time?: { timestamp?: string }; app_link?: string }> }> {
    const params = new URLSearchParams();
    if (options.startTime) params.set("start_time", options.startTime);
    if (options.endTime) params.set("end_time", options.endTime);
    if (options.pageSize) params.set("page_size", String(options.pageSize));
    if (options.pageToken) params.set("page_token", options.pageToken);

    const endpoint = `/open-apis/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
    return this.request(endpoint, { method: "GET", token: options.token });
  }

  /**
   * 创建日程事件
   */
  public async createCalendarEvent(
    calendarId: string,
    event: {
      summary: string;
      description?: string;
      startTime: { timestamp: string };
      endTime: { timestamp: string };
    },
    options: { token?: string } = {}
  ): Promise<{ event: any }> {
    const endpoint = `/open-apis/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events`;
    return this.request(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start_time: event.startTime,
        end_time: event.endTime,
      }),
      token: options.token,
    });
  }

  // =========================================================================
  // 即时通讯与消息 (IM) API
  // =========================================================================

  /**
   * 发送即时消息（支持文本、卡片等）
   */
  public async sendMessage(
    receiveIdType: "open_id" | "chat_id" | "user_id" | "email",
    receiveId: string,
    msgType: "text" | "post" | "interactive",
    content: string,
    options: { token?: string } = {}
  ): Promise<any> {
    const endpoint = `/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`;
    return this.request(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: msgType,
        content,
      }),
      token: options.token,
    });
  }

  // =========================================================================
  // 用户基础信息 (Contact/User) API
  // =========================================================================

  /**
   * 获取当前授权用户的基本信息（姓名、open_id、头像等）
   */
  public async getUserInfo(options: { token?: string } = {}): Promise<{
    name: string;
    en_name?: string;
    avatar_url?: string;
    open_id?: string;
    union_id?: string;
    user_id?: string;
    tenant_key?: string;
  }> {
    const endpoint = `/open-apis/authen/v1/user_info`;
    return this.request<any>(endpoint, {
      method: "GET",
      token: options.token,
    });
  }

  // =========================================================================
  // 知识库 (Wiki) API
  // =========================================================================

  /**
   * 获取知识库空间列表
   */
  public async listWikiSpaces(
    options: { pageSize?: number; pageToken?: string; token?: string } = {}
  ): Promise<{ items: Array<{ space_id: string; name: string; description?: string; space_type?: string }>; page_token?: string; has_more?: boolean }> {
    const params = new URLSearchParams();
    if (options.pageSize) params.set("page_size", String(options.pageSize));
    if (options.pageToken) params.set("page_token", options.pageToken);

    const endpoint = `/open-apis/wiki/v2/spaces?${params.toString()}`;
    return this.request(endpoint, { method: "GET", token: options.token });
  }

  /**
   * 获取知识库节点信息（包含对应文档 obj_token 与 obj_type）
   */
  public async getWikiNode(
    token: string,
    options: { token?: string } = {}
  ): Promise<{ node: { space_id: string; node_token: string; obj_token: string; obj_type: string; title: string; has_child?: boolean } }> {
    const params = new URLSearchParams({ token });
    const endpoint = `/open-apis/wiki/v2/spaces/get_node?${params.toString()}`;
    return this.request(endpoint, { method: "GET", token: options.token });
  }
}



