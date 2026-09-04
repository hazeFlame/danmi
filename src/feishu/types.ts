/**
 * Feishu Task v2 API Type Definitions
 */

export interface FeishuApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
  error?: {
    message?: string;
    log_id?: string;
    permission_violations?: Array<{
      type: string;
      subject: string;
      description: string;
    }>;
  };
}

export interface FeishuTenantAccessTokenResponse {
  code: number;
  msg: string;
  tenant_access_token: string;
  expire: number;
}

export interface TaskMember {
  id: string;
  type?: "user" | "app" | "chat";
  role?: "assignee" | "follower" | "creator";
  name?: string;
  avatar?: string;
}

export interface TaskDue {
  timestamp?: string;
  is_all_day?: boolean;
}

export interface TaskStart {
  timestamp?: string;
  is_all_day?: boolean;
}

export interface TaskOrigin {
  platform_i18n_name?: string;
  href?: {
    url: string;
    title: string;
  };
}

export interface TaskCustomField {
  guid: string;
  name?: string;
  type?: string;
  value?: unknown;
}

export interface FeishuTask {
  guid: string;
  summary: string;
  description?: string;
  due?: TaskDue;
  start?: TaskStart;
  completed_at?: string; // "0" means not completed, otherwise millisecond timestamp
  status?: string;
  creator?: TaskMember;
  members?: TaskMember[];
  subtask_count?: number;
  tasklists?: Array<{
    tasklist_guid: string;
    section_guid?: string;
  }>;
  origin?: TaskOrigin;
  extra?: string;
  url?: string;
  custom_fields?: TaskCustomField[];
  created_at?: string;
  updated_at?: string;
}

export interface FeishuTasklist {
  guid: string;
  name: string;
  creator?: TaskMember;
  owner?: TaskMember;
  members?: TaskMember[];
  url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FeishuComment {
  id: string;
  content: string;
  creator?: TaskMember;
  reply_to_comment_id?: string;
  created_at?: string;
  updated_at?: string;
  resource_type?: string;
  resource_id?: string;
}

export interface ListTasksResult {
  items: FeishuTask[];
  page_token?: string;
  has_more?: boolean;
}

export interface ListTasklistsResult {
  items: FeishuTasklist[];
  page_token?: string;
  has_more?: boolean;
}

export interface ListCommentsResult {
  items: FeishuComment[];
  page_token?: string;
  has_more?: boolean;
}
