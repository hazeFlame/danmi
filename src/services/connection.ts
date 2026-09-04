import { eq, and } from "drizzle-orm";
import { getDb, getUserFeishuConfig } from "../auth/db";
import * as schema from "../auth/schema";

export interface UserConnectionRecord<TCredentials = any, TMetadata = any> {
  id: string;
  userId: string;
  providerId: string;
  connectionName: string;
  status: "active" | "inactive" | "expired";
  credentials: TCredentials;
  metadata?: TMetadata;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory fallback cache for development/test environments without D1 binding
const memoryConnections = new Map<string, UserConnectionRecord>();

function memoryKey(userId: string, providerId: string): string {
  return `${userId}:${providerId}`;
}

export class ConnectionService {
  /**
   * 获取指定用户的所有已激活连接
   */
  static async getUserConnections(
    userId: string,
    customD1?: D1Database
  ): Promise<UserConnectionRecord[]> {
    const list: UserConnectionRecord[] = [];

    try {
      const db = await getDb(customD1);
      if (db) {
        const rows = await db
          .select()
          .from(schema.userConnection)
          .where(
            and(
              eq(schema.userConnection.userId, userId),
              eq(schema.userConnection.status, "active")
            )
          );

        for (const r of rows) {
          list.push({
            id: r.id,
            userId: r.userId,
            providerId: r.providerId,
            connectionName: r.connectionName,
            status: r.status as any,
            credentials: JSON.parse(r.credentials || "{}"),
            metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
          });
        }
      }
    } catch (err) {
      console.warn("[ConnectionService] 读取 D1 user_connection 失败，自动降级:", err);
    }

    // 合并内存中的连接
    for (const [key, item] of memoryConnections.entries()) {
      if (key.startsWith(`${userId}:`) && item.status === "active") {
        if (!list.some((existing) => existing.providerId === item.providerId)) {
          list.push(item);
        }
      }
    }

    // 向下兼容：如果列表中还没有飞书连接，检查旧版 feishu_config 表
    if (!list.some((c) => c.providerId === "feishu")) {
      const feishuOld = await getUserFeishuConfig(userId, customD1);
      if (feishuOld && (feishuOld.appId || feishuOld.userAccessToken)) {
        list.push({
          id: feishuOld.id || "feishu-legacy",
          userId,
          providerId: "feishu",
          connectionName: feishuOld.appName || "我的飞书自建应用",
          status: "active",
          credentials: {
            appId: feishuOld.appId,
            appSecret: feishuOld.appSecret,
            appName: feishuOld.appName,
            userAccessToken: feishuOld.userAccessToken,
            userRefreshToken: feishuOld.userRefreshToken,
          },
          createdAt: feishuOld.createdAt ? new Date(feishuOld.createdAt) : new Date(),
          updatedAt: feishuOld.updatedAt ? new Date(feishuOld.updatedAt) : new Date(),
        });
      }
    }

    return list;
  }

  /**
   * 获取指定用户的特定平台连接
   */
  static async getUserConnection(
    userId: string,
    providerId: string,
    customD1?: D1Database
  ): Promise<UserConnectionRecord | null> {
    try {
      const db = await getDb(customD1);
      if (db) {
        const rows = await db
          .select()
          .from(schema.userConnection)
          .where(
            and(
              eq(schema.userConnection.userId, userId),
              eq(schema.userConnection.providerId, providerId)
            )
          )
          .limit(1);

        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            userId: r.userId,
            providerId: r.providerId,
            connectionName: r.connectionName,
            status: r.status as any,
            credentials: JSON.parse(r.credentials || "{}"),
            metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
          };
        }
      }
    } catch (err) {
      console.warn(`[ConnectionService] 读取 D1 连接 [${providerId}] 失败:`, err);
    }

    // 内存降级
    const mem = memoryConnections.get(memoryKey(userId, providerId));
    if (mem) return mem;

    // 向下兼容：飞书旧配置读取
    if (providerId === "feishu") {
      const feishuOld = await getUserFeishuConfig(userId, customD1);
      if (feishuOld && (feishuOld.appId || feishuOld.userAccessToken)) {
        return {
          id: feishuOld.id || "feishu-legacy",
          userId,
          providerId: "feishu",
          connectionName: feishuOld.appName || "我的飞书自建应用",
          status: "active",
          credentials: {
            appId: feishuOld.appId,
            appSecret: feishuOld.appSecret,
            appName: feishuOld.appName,
            userAccessToken: feishuOld.userAccessToken,
            userRefreshToken: feishuOld.userRefreshToken,
          },
          createdAt: feishuOld.createdAt ? new Date(feishuOld.createdAt) : new Date(),
          updatedAt: feishuOld.updatedAt ? new Date(feishuOld.updatedAt) : new Date(),
        };
      }
    }

    return null;
  }

  /**
   * 保存或更新用户的平台连接凭据
   */
  static async upsertUserConnection(
    userId: string,
    providerId: string,
    data: {
      connectionName: string;
      credentials: any;
      metadata?: any;
      status?: "active" | "inactive" | "expired";
    },
    customD1?: D1Database
  ): Promise<UserConnectionRecord> {
    const now = new Date();
    const status = data.status || "active";
    const credentialsStr = JSON.stringify(data.credentials || {});
    const metadataStr = data.metadata ? JSON.stringify(data.metadata) : null;

    try {
      const db = await getDb(customD1);
      if (db) {
        const existing = await this.getUserConnection(userId, providerId, customD1);
        if (existing && existing.id !== "feishu-legacy") {
          await db
            .update(schema.userConnection)
            .set({
              connectionName: data.connectionName,
              credentials: credentialsStr,
              metadata: metadataStr,
              status,
              updatedAt: now,
            })
            .where(eq(schema.userConnection.id, existing.id));
        } else {
          await db.insert(schema.userConnection).values({
            id: crypto.randomUUID(),
            userId,
            providerId,
            connectionName: data.connectionName,
            credentials: credentialsStr,
            metadata: metadataStr,
            status,
            createdAt: now,
            updatedAt: now,
          });
        }
        const updated = await this.getUserConnection(userId, providerId, customD1);
        if (updated) return updated;
      }
    } catch (err) {
      console.warn(`[ConnectionService] 写入 D1 连接 [${providerId}] 失败，降级至内存:`, err);
    }

    // 内存存储
    const record: UserConnectionRecord = {
      id: crypto.randomUUID(),
      userId,
      providerId,
      connectionName: data.connectionName,
      status,
      credentials: data.credentials,
      metadata: data.metadata,
      createdAt: now,
      updatedAt: now,
    };
    memoryConnections.set(memoryKey(userId, providerId), record);
    return record;
  }

  /**
   * 解绑或移除指定平台连接
   */
  static async deleteUserConnection(
    userId: string,
    providerId: string,
    customD1?: D1Database
  ): Promise<boolean> {
    try {
      const db = await getDb(customD1);
      if (db) {
        await db
          .delete(schema.userConnection)
          .where(
            and(
              eq(schema.userConnection.userId, userId),
              eq(schema.userConnection.providerId, providerId)
            )
          );
      }
    } catch (err) {
      console.warn(`[ConnectionService] 删除 D1 连接 [${providerId}] 失败:`, err);
    }

    memoryConnections.delete(memoryKey(userId, providerId));
    return true;
  }
}
