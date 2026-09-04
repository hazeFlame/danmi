import { auth } from "@/src/auth/auth";
import {
  getUserFeishuConfig,
  upsertUserFeishuConfig,
  deleteUserFeishuConfig,
} from "@/src/auth/db";

export const runtime = "edge";

// GET: 获取当前登录用户的飞书绑定状态
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return Response.json(
        { error: "未登录，请先登录开发者账号" },
        { status: 401 }
      );
    }

    const config = await getUserFeishuConfig(session.user.id);
    if (!config) {
      return Response.json({ configured: false });
    }

    return Response.json({
      configured: true,
      appId: config.appId,
      appName: config.appName || "我的飞书应用",
      updatedAt: config.updatedAt ? new Date(config.updatedAt).toISOString() : undefined,
    });
  } catch (err: any) {
    console.error("GET /api/feishu/config 异常:", err);
    // 即使读取异常，也安全返回未配置，绝不向前端抛出 500 导致白屏
    return Response.json({ configured: false, error: err?.message }, { status: 200 });
  }
}

// POST: 测试并绑定用户的飞书应用凭据 (cli_xxx + appSecret)
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return Response.json(
        { error: "未登录，请先登录开发者账号" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const { appId, appSecret } = body || {};

    if (!appId || !appId.trim()) {
      return Response.json(
        { error: "请填写飞书 App ID (通常以 cli_ 开头)" },
        { status: 400 }
      );
    }
    if (!appSecret || !appSecret.trim()) {
      return Response.json(
        { error: "请填写飞书 App Secret" },
        { status: 400 }
      );
    }

    const cleanAppId = appId.trim();
    const cleanSecret = appSecret.trim();

    // 1. 向飞书 OpenAPI 实时验证凭证连通性
    let tenantAccessToken: string | null = null;
    try {
      const tokenRes = await fetch(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            app_id: cleanAppId,
            app_secret: cleanSecret,
          }),
        }
      );

      if (!tokenRes.ok) {
        const errText = await tokenRes.text().catch(() => "");
        return Response.json(
          { error: `飞书接口通信失败 [${tokenRes.status}]: ${errText}` },
          { status: 400 }
        );
      }

      const tokenData = (await tokenRes.json().catch(() => ({}))) as any;
      if (tokenData.code !== 0) {
        return Response.json(
          {
            error: `飞书凭据校验未通过: [代码 ${tokenData.code}] ${tokenData.msg || "App ID 或 Secret 不正确"}`,
          },
          { status: 400 }
        );
      }
      tenantAccessToken = tokenData.tenant_access_token;
    } catch (netErr: any) {
      return Response.json(
        { error: `网络请求飞书认证服务异常: ${netErr?.message || netErr}` },
        { status: 400 }
      );
    }

    let appName = "飞书自建应用";

    // 2. 尝试拉取机器人或应用基本信息（优化展示名称）
    if (tenantAccessToken) {
      try {
        const botRes = await fetch("https://open.feishu.cn/open-apis/bot/v3/info", {
          headers: {
            Authorization: `Bearer ${tenantAccessToken}`,
          },
        });
        if (botRes.ok) {
          const botData = (await botRes.json().catch(() => ({}))) as any;
          if (botData.code === 0 && botData.bot?.app_name) {
            appName = botData.bot.app_name;
          }
        }
      } catch {
        // 获取名字失败不阻断绑定
      }
    }

    // 3. 将验证通过的飞书凭证保存到当前用户下
    const saved = await upsertUserFeishuConfig(session.user.id, {
      appId: cleanAppId,
      appSecret: cleanSecret,
      appName,
    });

    return Response.json({
      success: true,
      configured: true,
      appId: saved?.appId || cleanAppId,
      appName: saved?.appName || appName,
      message: `成功连接飞书应用「${appName}」！`,
    });
  } catch (err: any) {
    console.error("POST /api/feishu/config 异常:", err);
    return Response.json(
      { error: err?.message || "服务器处理异常" },
      { status: 400 }
    );
  }
}

// DELETE: 解除当前用户的飞书绑定
export async function DELETE(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return Response.json(
        { error: "未登录，请先登录开发者账号" },
        { status: 401 }
      );
    }

    await deleteUserFeishuConfig(session.user.id);
    return Response.json({ success: true, message: "已解除飞书应用绑定" });
  } catch (err: any) {
    console.error("DELETE /api/feishu/config 异常:", err);
    return Response.json(
      { error: err?.message || "解除绑定异常" },
      { status: 500 }
    );
  }
}
