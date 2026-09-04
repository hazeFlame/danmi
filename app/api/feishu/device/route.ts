import { auth } from "@/src/auth/auth";
import { upsertUserFeishuConfig } from "@/src/auth/db";

export const runtime = "edge";

// 飞书官方 CLI 设备码与应用注册端点
const FEISHU_ACCOUNTS_ORIGIN = "https://accounts.feishu.cn";
const FEISHU_OPEN_ORIGIN = "https://open.feishu.cn";

export async function POST(req: Request) {
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
  const { action } = body;

  try {
    // =========================================================================
    // 阶段一启动：发起 App Registration，获取专属 user_code 与 verification_url
    // =========================================================================
    if (action === "start") {
      const form = new URLSearchParams();
      form.set("action", "begin");
      form.set("archetype", "PersonalAgent");
      form.set("auth_method", "client_secret");
      form.set("request_user_info", "open_id tenant_brand");

      const res = await fetch(`${FEISHU_ACCOUNTS_ORIGIN}/oauth/v1/app/registration`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return Response.json(
          { error: `请求飞书设备注册服务失败 [${res.status}]: ${errText}` },
          { status: 500 }
        );
      }

      const data = (await res.json()) as any;
      if (data.error) {
        return Response.json(
          { error: `飞书接口错误: ${data.error_description || data.error}` },
          { status: 400 }
        );
      }

      const userCode = data.user_code;
      const deviceCode = data.device_code;
      // 优先打开用户指定的 open.feishu.cn/page/cli 页面
      const verificationUrl = `https://open.feishu.cn/page/cli?user_code=${userCode}`;

      return Response.json({
        success: true,
        step: 1,
        deviceCode,
        userCode,
        verificationUrl,
        expiresIn: data.expires_in || 3600,
        interval: data.interval || 5,
      });
    }

    // =========================================================================
    // 阶段一轮询：检查用户是否在弹窗中选择已有应用或创建了新应用
    // =========================================================================
    if (action === "poll_app") {
      const { deviceCode, customScope } = body;
      if (!deviceCode) {
        return Response.json({ error: "缺少 deviceCode 参数" }, { status: 400 });
      }

      const form = new URLSearchParams();
      form.set("action", "poll");
      form.set("device_code", deviceCode);

      const res = await fetch(`${FEISHU_ACCOUNTS_ORIGIN}/oauth/v1/app/registration`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });

      const data = (await res.json()) as any;

      const errStr = data.error || "";
      const descStr = data.error_description || "";

      // 仍在等待用户在弹窗中选择/创建应用 (RFC 8628: authorization_pending 与 slow_down)
      if (
        errStr === "authorization_pending" ||
        errStr === "slow_down" ||
        data.code === 20094 ||
        descStr.toLowerCase().includes("frequently") ||
        errStr.toLowerCase().includes("frequently")
      ) {
        return Response.json({
          status: "pending",
          slowDown: errStr === "slow_down" || descStr.toLowerCase().includes("frequently"),
        });
      }

      // 真实错误退出 (如 access_denied, expired_token)
      if (errStr) {
        return Response.json({
          status: "error",
          error: descStr || errStr,
        });
      }

      // 阶段一成功：拿到应用凭证 client_id 与 client_secret
      const clientId = data.client_id;
      const clientSecret = data.client_secret;

      if (!clientId || !clientSecret) {
        return Response.json({ status: "pending" });
      }

      // 尝试获取应用名称
      let appName = "飞书自建应用";
      try {
        const tokenRes = await fetch(
          `${FEISHU_OPEN_ORIGIN}/open-apis/auth/v3/tenant_access_token/internal`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({ app_id: clientId, app_secret: clientSecret }),
          }
        );
        if (tokenRes.ok) {
          const tokenData = (await tokenRes.json()) as any;
          if (tokenData.code === 0 && tokenData.tenant_access_token) {
            const botRes = await fetch(`${FEISHU_OPEN_ORIGIN}/open-apis/bot/v3/info`, {
              headers: { Authorization: `Bearer ${tokenData.tenant_access_token}` },
            });
            if (botRes.ok) {
              const botData = (await botRes.json()) as any;
              if (botData.code === 0 && botData.bot?.app_name) {
                appName = botData.bot.app_name;
              }
            }
          }
        }
      } catch {
        // 获取失败不影响主流程
      }

      // 紧接着启动阶段二：设备权限授权 (Device Authorization)
      try {
        const basicAuth = btoa(`${clientId}:${clientSecret}`);

        // 梯队化候选 scope：纯免审只读权限优先（无需管理员审核）
        const baseCandidates = [
          // 1. 办公全生态免审只读全家桶（多维表格 + 云文档 + 知识库 + 日历 + 任务 + 通讯录）
          "bitable:app:readonly docx:document:readonly wiki:wiki:readonly calendar:calendar:readonly task:task:read task:tasklist:read task:comment:read contact:user.base:readonly offline_access",
          // 2. 多维表格 + 任务系统全套免审（多维表格 + 任务全套只读）
          "bitable:app:readonly task:task:read task:tasklist:read task:comment:read offline_access",
          "bitable:app:readonly task:task:read task:tasklist:read offline_access",
          // 3. 多维表格 + 云文档 + 任务协同组合
          "bitable:app:readonly docx:document:readonly task:task:read task:tasklist:read task:comment:read offline_access",
          "bitable:app:readonly docx:document:readonly calendar:calendar:readonly task:task:read task:tasklist:read task:comment:read offline_access",
          // 4. 单多维表格免审只读
          "bitable:app:readonly offline_access",
          // 5. 任务核心免审只读（无需管理员审批，勾选即用）
          "task:task:read task:tasklist:read task:comment:read offline_access",
          "task:task:read task:tasklist:read offline_access",
          "task:task:read offline_access",
          // 6. 其他生态模块免审兜底
          "docx:document:readonly offline_access",
          "calendar:calendar:readonly offline_access",
          "contact:user.base:readonly offline_access",
          // 7. 基础离线访问兜底
          "offline_access",
        ];

        let customCandidate: string | null = null;
        if (typeof customScope === "string" && customScope.trim()) {
          const trimmed = customScope.trim();
          customCandidate = trimmed.includes("offline_access")
            ? trimmed
            : `${trimmed} offline_access`;
        }

        const scopeCandidates = Array.from(
          new Set(customCandidate ? [customCandidate, ...baseCandidates] : baseCandidates)
        );

        let devAuthData: any = null;

        for (const scope of scopeCandidates) {
          console.log(`[Device Flow] 正在尝试阶段二授权，scope: "${scope}"`);
          const devAuthForm = new URLSearchParams();
          devAuthForm.set("client_id", clientId);
          devAuthForm.set("scope", scope);

          const devAuthRes = await fetch(
            `${FEISHU_ACCOUNTS_ORIGIN}/oauth/v1/device_authorization`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${basicAuth}`,
              },
              body: devAuthForm.toString(),
            }
          );

          const data = (await devAuthRes.json().catch(() => ({}))) as any;
          console.log(`[Device Flow] 阶段二响应 [HTTP ${devAuthRes.status}]:`, data);

          if (devAuthRes.ok && data.device_code && !data.error) {
            devAuthData = data;
            break;
          }
        }

        if (devAuthData?.device_code) {
          // 遵循飞书官方规范：必须原样使用 verification_uri_complete，绝不能篡改域名或路径
          const step2Url =
            devAuthData.verification_uri_complete ||
            devAuthData.verification_uri ||
            `${FEISHU_ACCOUNTS_ORIGIN}/oauth/v1/device/verify?flow_id=${devAuthData.flow_id || ""}&user_code=${devAuthData.user_code || ""}`;

          console.log(`[Device Flow] 阶段二发起成功，官方授权链接: ${step2Url}`);

          return Response.json({
            status: "app_ready",
            step: 2,
            appId: clientId,
            appSecret: clientSecret,
            appName,
            step2DeviceCode: devAuthData.device_code,
            step2UserCode: devAuthData.user_code,
            step2VerificationUrl: step2Url,
          });
        } else {
          console.warn("[Device Flow] 所有 scope 候选均未能发起阶段二设备授权，可能应用暂未在飞书开放平台配置对应权限");
        }
      } catch (err: any) {
        console.error("[Device Flow] 阶段二发起异常:", err);
      }

      // 若阶段二不可用或失败，仍自动保存已成功获取的飞书应用凭据
      await upsertUserFeishuConfig(session.user.id, {
        appId: clientId,
        appSecret: clientSecret,
        appName,
      });

      return Response.json({
        status: "completed",
        step: 2,
        appId: clientId,
        appName,
        message: `成功连接飞书自建应用「${appName}」！`,
      });
    }

    // =========================================================================
    // 阶段二轮询：检查用户是否在权限授权弹窗中点击了“同意授权”
    // =========================================================================
    if (action === "poll_token") {
      const { appId, appSecret, appName, step2DeviceCode } = body;
      if (!appId || !appSecret || !step2DeviceCode) {
        return Response.json({ error: "参数不完整" }, { status: 400 });
      }

      const tokenForm = new URLSearchParams();
      tokenForm.set("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
      tokenForm.set("device_code", step2DeviceCode);
      tokenForm.set("client_id", appId);
      tokenForm.set("client_secret", appSecret);

      const tokenRes = await fetch(`${FEISHU_OPEN_ORIGIN}/open-apis/authen/v2/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenForm.toString(),
      });

      const tokenData = (await tokenRes.json().catch(() => ({}))) as any;
      const tokenErr = tokenData.error || "";
      const tokenDesc = tokenData.error_description || "";

      if (
        tokenErr === "authorization_pending" ||
        tokenErr === "slow_down" ||
        tokenData.code === 20094 ||
        tokenDesc.toLowerCase().includes("frequently") ||
        tokenErr.toLowerCase().includes("frequently")
      ) {
        return Response.json({
          status: "pending",
          slowDown: tokenErr === "slow_down" || tokenDesc.toLowerCase().includes("frequently"),
        });
      }

      // 阶段二完成 (拿到 user_access_token) 或结束
      const userAccessToken = tokenData.data?.access_token || tokenData.access_token;
      const userRefreshToken = tokenData.data?.refresh_token || tokenData.refresh_token;

      // 保存完整配置（含应用密钥与用户授权 Token）到数据库
      await upsertUserFeishuConfig(session.user.id, {
        appId,
        appSecret,
        appName: appName || "飞书自建应用",
        userAccessToken,
        userRefreshToken,
      });

      return Response.json({
        status: "completed",
        appId,
        appName: appName || "飞书自建应用",
        hasUserToken: Boolean(userAccessToken),
        message: `成功完成飞书应用绑定与任务权限授权！`,
      });
    }

    return Response.json({ error: "未知操作" }, { status: 400 });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "设备流处理异常" },
      { status: 500 }
    );
  }
}
