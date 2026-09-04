import { betterAuth } from "better-auth";
import { apiKey } from "@better-auth/api-key";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import * as schema from "./schema";
import { getDb, getD1Database } from "./db";

export interface AuthEnv {
  DB?: D1Database;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  [key: string]: any;
}

let cachedD1Auth: any = null;
let fallbackAuth: any = null;

/**
 * 清理 Cookie 请求头中的 session_data，防止 Better Auth 解密 Base64Compact 缓存时抛出 Invalid Base64 character: . 异常
 */
export function sanitizeCookieHeader(cookieHeader: string | null | undefined): string {
  if (!cookieHeader) return "";
  return cookieHeader
    .split(";")
    .map((c) => c.trim())
    .filter((c) => {
      if (!c) return false;
      const name = c.split("=")[0].trim();
      if (
        name === "better-auth.session_data" ||
        name.startsWith("better-auth.session_data.") ||
        name === "__Secure-better-auth.session_data" ||
        name.startsWith("__Secure-better-auth.session_data.")
      ) {
        return false;
      }
      return true;
    })
    .join("; ");
}

function getFallbackAuth() {
  if (!fallbackAuth) {
    fallbackAuth = betterAuth({
      secret:
        process.env.BETTER_AUTH_SECRET ||
        "feishu_mcp_better_auth_default_secret_key_32_chars",
      baseURL: process.env.BETTER_AUTH_URL || process.env.BASE_URL,
      advanced: {
        database: {
          joins: false,
        },
      },
      session: {
        cookieCache: {
          enabled: false,
        },
      },
      emailAndPassword: {
        enabled: true,
      },
      plugins: [
        apiKey({
          apiKeyHeaders: ["x-api-key", "authorization"],
        }),
      ],
    });
  }
  return fallbackAuth;
}

export async function getAuth(customD1?: D1Database) {
  try {
    const d1 = customD1 || (await getD1Database());
    if (d1) {
      if (!cachedD1Auth) {
        const db = await getDb(d1);
        if (db) {
          cachedD1Auth = betterAuth({
            database: drizzleAdapter(db, {
              provider: "sqlite",
              schema: {
                user: schema.user,
                session: schema.session,
                account: schema.account,
                verification: schema.verification,
                apikey: schema.apikey,
                userRelations: schema.userRelations,
                sessionRelations: schema.sessionRelations,
                accountRelations: schema.accountRelations,
                apikeyRelations: schema.apikeyRelations,
              },
            }),
            advanced: {
              database: {
                joins: false,
              },
            },
            session: {
              cookieCache: {
                enabled: false,
              },
            },
            secret:
              process.env.BETTER_AUTH_SECRET ||
              "feishu_mcp_better_auth_default_secret_key_32_chars",
            baseURL: process.env.BETTER_AUTH_URL || process.env.BASE_URL,
            emailAndPassword: {
              enabled: true,
            },
            plugins: [
              apiKey({
                apiKeyHeaders: ["x-api-key", "authorization"],
              }),
            ],
          });
        }
      }
      if (cachedD1Auth) return cachedD1Auth;
    }
  } catch (err) {
    console.warn("初始化 D1 认证数据库实例失败，自动降级至内存认证实例:", err);
  }

  return getFallbackAuth();
}

/**
 * 统一导出的 auth 对象代理：
 * 兼容已有的同步引用 (如 import { auth } from "@/src/auth/auth")，
 * 在调用异步 API (api.getSession, api.verifyApiKey 等) 时自动调度连接到 D1 数据库实例。
 * 内置 Cookie 防御性清洗，彻底消灭 `Invalid Base64 character: .` 导致的 500 崩溃。
 */
export const auth: any = new Proxy(
  {},
  {
    get(target, prop, receiver) {
      if (prop === "api") {
        return new Proxy(
          {},
          {
            get(apiTarget, apiProp) {
              return async (...args: any[]) => {
                const instance = await getAuth();
                const fn = (instance.api as any)?.[apiProp];
                if (typeof fn === "function") {
                  if (apiProp === "getSession" && args[0]?.headers) {
                    let headers = args[0].headers;
                    if (headers instanceof Headers) {
                      const cookie = headers.get("cookie");
                      if (cookie && cookie.includes("session_data")) {
                        const clonedHeaders = new Headers(headers);
                        const clean = sanitizeCookieHeader(cookie);
                        if (clean) clonedHeaders.set("cookie", clean);
                        else clonedHeaders.delete("cookie");
                        args[0] = { ...args[0], headers: clonedHeaders };
                      }
                    } else if (typeof headers === "object") {
                      const cookie = headers.cookie || headers.Cookie;
                      if (cookie && cookie.includes("session_data")) {
                        const clean = sanitizeCookieHeader(cookie);
                        args[0] = {
                          ...args[0],
                          headers: {
                            ...headers,
                            cookie: clean,
                            Cookie: clean,
                          },
                        };
                      }
                    }
                  }
                  try {
                    return await fn.apply(instance.api, args);
                  } catch (err: any) {
                    if (apiProp === "getSession") {
                      console.warn("Better Auth getSession catch:", err?.message || err);
                      return null;
                    }
                    throw err;
                  }
                }
                return fn;
              };
            },
          }
        );
      }
      if (prop === "handler") {
        return async (req: Request) => {
          const instance = await getAuth();
          const rawCookie = req.headers.get("cookie");
          const hasSessionData = Boolean(rawCookie && rawCookie.includes("session_data"));

          let requestToHandle = req;
          if (hasSessionData) {
            const sanitizedCookie = sanitizeCookieHeader(rawCookie);
            const newHeaders = new Headers(req.headers);
            if (sanitizedCookie) {
              newHeaders.set("cookie", sanitizedCookie);
            } else {
              newHeaders.delete("cookie");
            }
            requestToHandle = new Request(req.url, {
              method: req.method,
              headers: newHeaders,
              body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
            });
          }

          try {
            const res = await instance.handler(requestToHandle);
            if (hasSessionData) {
              const resHeaders = new Headers(res.headers);
              resHeaders.append(
                "set-cookie",
                "better-auth.session_data=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax"
              );
              resHeaders.append(
                "set-cookie",
                "__Secure-better-auth.session_data=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure"
              );
              return new Response(res.body, {
                status: res.status,
                statusText: res.statusText,
                headers: resHeaders,
              });
            }
            return res;
          } catch (err: any) {
            console.error("Better Auth handler error:", err);
            if (req.url.includes("get-session")) {
              return Response.json(null, {
                status: 200,
                headers: {
                  "content-type": "application/json",
                  "set-cookie":
                    "better-auth.session_data=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax",
                },
              });
            }
            throw err;
          }
        };
      }
      const syncInstance = cachedD1Auth || fallbackAuth || getFallbackAuth();
      const val = Reflect.get(syncInstance, prop, receiver);
      return typeof val === "function" ? val.bind(syncInstance) : val;
    },
  }
);

/**
 * Verify MCP Token (API Key) from incoming request
 */
export async function verifyMcpToken(
  token: string,
  _env?: AuthEnv
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  if (!token || !token.trim()) {
    return { valid: false, error: "未提供 MCP Token" };
  }

  const cleanToken = token.startsWith("Bearer ")
    ? token.slice(7).trim()
    : token.trim();

  if (!cleanToken) {
    return { valid: false, error: "MCP Token 为空" };
  }

  try {
    const authInstance = await getAuth(_env?.DB);
    const res = await authInstance.api.verifyApiKey({
      body: { key: cleanToken },
    });

    const result = res as any;
    if (result?.valid) {
      return { valid: true, userId: result?.key?.referenceId || undefined };
    }
    const errMsg =
      typeof result?.error === "string"
        ? result.error
        : result?.error?.message || "Token 无效或已过期";
    return { valid: false, error: errMsg };
  } catch (err: any) {
    return { valid: false, error: err?.message || String(err) };
  }
}
