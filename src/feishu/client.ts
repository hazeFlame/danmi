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
}
