"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/src/auth/client";
import {
  Key,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  Copy,
  Check,
  Laptop,
  Terminal,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface ApiKeyItem {
  id: string;
  name?: string | null;
  start?: string | null;
  prefix?: string | null;
  createdAt: string | Date;
  expiresAt?: string | Date | null;
}

export default function TokensPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [keyName, setKeyName] = useState("");
  const [keyExpiryDays, setKeyExpiryDays] = useState("30");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [origin, setOrigin] = useState("");
  const [selectedClient, setSelectedClient] = useState<"cursor" | "claude" | "windsurf">("cursor");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    loadApiKeys();
  }, []);

  async function loadApiKeys() {
    try {
      const res = await authClient.apiKey.list();
      const list = (res?.data as any)?.apiKeys || res?.data;
      if (Array.isArray(list)) {
        setApiKeys(list as ApiKeyItem[]);
      }
    } catch (err) {
      console.error("加载 API Keys 失败:", err);
    }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyName.trim()) return;

    setSubmitting(true);
    try {
      const days = parseInt(keyExpiryDays, 10) || 30;
      const expiresIn = days > 0 ? days * 24 * 60 * 60 : undefined;
      const res = await authClient.apiKey.create({
        name: keyName.trim(),
        expiresIn,
      });

      if (res?.data?.key) {
        setCreatedKey(res.data.key);
        setKeyName("");
        await loadApiKeys();
      } else if (res?.error) {
        alert(`签发失败: ${res.error.message}`);
      }
    } catch (err: any) {
      alert(`签发失败: ${err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteKey(id: string) {
    if (!confirm("确定要撤销此 MCP Token 吗？撤销后关联的客户端将无法再访问 MCP。")) {
      return;
    }
    try {
      await authClient.apiKey.delete({
        keyId: id,
      });
      await loadApiKeys();
    } catch (err: any) {
      alert(`撤销失败: ${err?.message || err}`);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  const serverMcpUrl = `${origin || "http://localhost:3000"}/api/mcp`;
  const tokenValue = createdKey || (apiKeys[0]?.start ? `${apiKeys[0].start}...` : "<YOUR_MCP_TOKEN>");

  function getClientConfigSnippet(client: "cursor" | "claude" | "windsurf") {
    if (client === "cursor") {
      return JSON.stringify(
        {
          mcpServers: {
            "feishu-task": {
              url: serverMcpUrl,
              headers: {
                Authorization: `Bearer ${tokenValue}`,
              },
            },
          },
        },
        null,
        2
      );
    }

    if (client === "claude") {
      return JSON.stringify(
        {
          mcpServers: {
            "feishu-task": {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-fetch", serverMcpUrl],
              env: {
                AUTH_HEADER: `Bearer ${tokenValue}`,
              },
            },
          },
        },
        null,
        2
      );
    }

    return JSON.stringify(
      {
        mcpServers: {
          "feishu-task": {
            serverUrl: serverMcpUrl,
            headers: {
              Authorization: `Bearer ${tokenValue}`,
            },
          },
        },
      },
      null,
      2
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题说明 */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Key className="size-5 text-primary" />
          令牌管理
        </h2>
        <p className="text-xs text-muted-foreground">
          管理用于连接 MCP 服务的访问令牌。
        </p>
      </div>

      {/* 新签发 Token 成功展示卡片 */}
      {createdKey && (
        <Alert className="border-primary/40 bg-primary/5">
          <Sparkles className="size-4 text-primary" />
          <AlertTitle className="text-primary font-semibold text-sm">
            令牌创建成功
          </AlertTitle>
          <AlertDescription className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">
              完整令牌仅展示一次，离开后无法再次查看，请妥善保存：
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                readOnly
                value={createdKey}
                className="font-mono text-xs bg-background flex-1 min-w-[280px]"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(createdKey)}
                className="gap-1.5 shrink-0 text-xs"
              >
                {copySuccess ? (
                  <>
                    <Check className="size-3.5 text-emerald-600" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    复制
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={() => copyToClipboard(getClientConfigSnippet(selectedClient))}
                className="gap-1.5 shrink-0 text-xs"
              >
                <Copy className="size-3.5" />
                复制配置
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧两列：签发表单与列表 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 创建新 Token */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Plus className="size-4 text-primary" />
                创建令牌
              </CardTitle>
              <CardDescription className="text-xs">
                创建用于客户端调用的访问凭证。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="keyName" className="text-xs">
                      名称
                    </Label>
                    <Input
                      id="keyName"
                      placeholder="例如：Cursor / Claude"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="expiry" className="text-xs">
                      有效期（天）
                    </Label>
                    <Input
                      id="expiry"
                      type="number"
                      min="1"
                      max="365"
                      value={keyExpiryDays}
                      onChange={(e) => setKeyExpiryDays(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || !keyName.trim()}
                  className="gap-1.5 shadow-2xs"
                >
                  <Plus className="size-3.5" />
                  {submitting ? "创建中..." : "创建"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 令牌列表 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Key className="size-4 text-primary" />
                    令牌列表
                  </CardTitle>
                  <CardDescription className="text-xs">
                    查看与管理已创建的令牌。
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  共 {apiKeys.length} 个
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border rounded-lg border-dashed">
                  暂无令牌
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">名称</TableHead>
                        <TableHead className="text-xs">Token</TableHead>
                        <TableHead className="text-xs">创建时间</TableHead>
                        <TableHead className="text-xs">到期时间</TableHead>
                        <TableHead className="text-xs text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((k) => (
                        <TableRow key={k.id}>
                          <TableCell className="text-xs font-medium">
                            {k.name || "未命名"}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {k.start || k.prefix || "••••••••"}...
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {new Date(k.createdAt).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {k.expiresAt
                              ? new Date(k.expiresAt).toLocaleDateString()
                              : "永久有效"}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteKey(k.id)}
                              className="size-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="删除"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧列：客户端配置指南 */}
        <div className="space-y-6">
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Laptop className="size-4 text-primary" />
                  客户端配置
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                将以下配置添加至客户端设置：
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 客户端切换 */}
              <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setSelectedClient("cursor")}
                  className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors text-center ${
                    selectedClient === "cursor"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Cursor
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedClient("claude")}
                  className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors text-center ${
                    selectedClient === "claude"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Claude
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedClient("windsurf")}
                  className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors text-center ${
                    selectedClient === "windsurf"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Windsurf
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    配置内容：
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(getClientConfigSnippet(selectedClient))}
                    className="h-6 text-[11px] gap-1 px-2 text-primary"
                  >
                    <Copy className="size-3" />
                    复制
                  </Button>
                </div>

                <div className="rounded-md bg-zinc-950 p-3 text-zinc-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-zinc-800">
                  <pre>{getClientConfigSnippet(selectedClient)}</pre>
                </div>
              </div>

              <div className="rounded-md border p-3 bg-muted/30 text-xs space-y-1.5 text-muted-foreground">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Terminal className="size-3.5 text-primary" />
                  端点信息：
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li>
                    端点: <code className="font-mono text-foreground">{serverMcpUrl}</code>
                  </li>
                  <li>
                    鉴权: <code className="font-mono text-foreground">Authorization: Bearer &lt;Token&gt;</code>
                  </li>
                  <li>
                    协议: Model Context Protocol (Streamable HTTP)
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
