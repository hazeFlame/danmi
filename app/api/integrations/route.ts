import { auth } from "@/src/auth/auth";
import { providerRegistry } from "@/src/providers/registry";
import { ConnectionService } from "@/src/services/connection";
import { deleteUserFeishuConfig } from "@/src/auth/db";

export const runtime = "edge";

// GET: 获取所有可用平台及其在当前用户下的连接状态与工具清单
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

    const userId = session.user.id;
    const userConnections = await ConnectionService.getUserConnections(userId);
    const connectionMap = new Map(userConnections.map((c) => [c.providerId, c]));

    const allProviders = providerRegistry.getAll();

    const data = allProviders.map((p) => {
      const conn = connectionMap.get(p.id);
      const tools = p.getAvailableTools();

      return {
        id: p.id,
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description,
        iconName: p.iconName,
        category: p.category,
        authType: p.authType,
        status: p.status,
        consoleUrl: p.consoleUrl,
        connected: Boolean(conn && conn.status === "active"),
        connectionName: conn?.connectionName,
        updatedAt: conn?.updatedAt ? conn.updatedAt.toISOString() : undefined,
        toolsCount: tools.length,
        tools,
      };
    });

    return Response.json({
      providers: data,
      totalConnected: userConnections.length,
    });
  } catch (err: any) {
    console.error("GET /api/integrations 异常:", err);
    return Response.json({ error: err?.message || "服务器处理异常" }, { status: 500 });
  }
}

// DELETE: 断开/移除特定平台的连接
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

    const url = new URL(req.url);
    const providerId = url.searchParams.get("provider");

    if (!providerId) {
      return Response.json({ error: "缺少 provider 参数" }, { status: 400 });
    }

    const userId = session.user.id;

    // 如果是飞书，同时清理旧表 feishu_config
    if (providerId === "feishu") {
      await deleteUserFeishuConfig(userId);
    }

    await ConnectionService.deleteUserConnection(userId, providerId);

    return Response.json({
      success: true,
      message: `已断开与「${providerId}」的连接`,
    });
  } catch (err: any) {
    console.error("DELETE /api/integrations 异常:", err);
    return Response.json({ error: err?.message || "断开连接异常" }, { status: 500 });
  }
}
