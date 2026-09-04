import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

// In-memory fallback cache for development/test runtimes without D1 binding
const memoryFeishuConfigs = new Map<string, any>();

export async function getD1Database(customD1?: D1Database): Promise<D1Database | null> {
  if (customD1) return customD1;
  try {
    const { env } = await import("cloudflare:workers");
    return (env as any)?.DB || null;
  } catch {
    return null;
  }
}

export async function getDb(customD1?: D1Database) {
  try {
    const d1 = await getD1Database(customD1);
    if (d1) {
      return drizzle(d1, { schema });
    }
  } catch (err) {
    console.warn("初始化 Drizzle D1 数据库实例失败:", err);
  }
  return null;
}

export async function getUserFeishuConfig(userId: string, customD1?: D1Database) {
  try {
    const db = await getDb(customD1);
    if (db) {
      const configs = await db
        .select()
        .from(schema.feishuConfig)
        .where(eq(schema.feishuConfig.userId, userId))
        .limit(1);
      return configs[0] || null;
    }
  } catch (err) {
    console.warn("查询 D1 数据库 feishu_config 失败，自动降级至内存读取:", err);
  }
  return memoryFeishuConfigs.get(userId) || null;
}

export async function upsertUserFeishuConfig(
  userId: string,
  config: {
    appId: string;
    appSecret: string;
    appName?: string;
    userAccessToken?: string;
    userRefreshToken?: string;
  },
  customD1?: D1Database
) {
  const now = new Date();

  try {
    const db = await getDb(customD1);
    if (db) {
      const existing = await getUserFeishuConfig(userId, customD1);
      if (existing) {
        await db
          .update(schema.feishuConfig)
          .set({
            appId: config.appId,
            appSecret: config.appSecret,
            appName: config.appName || existing.appName,
            userAccessToken: config.userAccessToken ?? existing.userAccessToken,
            userRefreshToken: config.userRefreshToken ?? existing.userRefreshToken,
            updatedAt: now,
          })
          .where(eq(schema.feishuConfig.userId, userId));
      } else {
        await db.insert(schema.feishuConfig).values({
          id: crypto.randomUUID(),
          userId,
          appId: config.appId,
          appSecret: config.appSecret,
          appName: config.appName,
          userAccessToken: config.userAccessToken,
          userRefreshToken: config.userRefreshToken,
          createdAt: now,
          updatedAt: now,
        });
      }
      return await getUserFeishuConfig(userId, customD1);
    }
  } catch (err) {
    console.warn("写入 D1 数据库 feishu_config 失败，自动降级至内存缓存:", err);
  }

  // Memory fallback
  const existing = memoryFeishuConfigs.get(userId);
  const record = {
    id: existing?.id || crypto.randomUUID(),
    userId,
    appId: config.appId,
    appSecret: config.appSecret,
    appName: config.appName || existing?.appName || "飞书自建应用",
    userAccessToken: config.userAccessToken ?? existing?.userAccessToken,
    userRefreshToken: config.userRefreshToken ?? existing?.userRefreshToken,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  memoryFeishuConfigs.set(userId, record);
  return record;
}

export async function deleteUserFeishuConfig(userId: string, customD1?: D1Database) {
  try {
    const db = await getDb(customD1);
    if (db) {
      await db
        .delete(schema.feishuConfig)
        .where(eq(schema.feishuConfig.userId, userId));
    }
  } catch (err) {
    console.warn("从 D1 删除 feishuConfig 失败:", err);
  }
  memoryFeishuConfigs.delete(userId);
  return true;
}
