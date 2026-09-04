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
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Key className="size-5 text-primary" />
            令牌管理
          </h2>
          <Badge variant="secondary" className="text-[11px]">API Keys</Badge>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          签发并管理用于 Cursor、Claude Code、Windsurf 等客户端连接 MCP 服务的鉴权令牌。
        </p>
      </div>

      {/* 新签发 Token 成功展示卡片 */}
      {createdKey && (
        <Alert variant="success" className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-mint-foreground" />
            <AlertTitle className="font-semibold text-sm text-mint-foreground">
              令牌签发成功
            </AlertTitle>
          </div>
          <AlertDescription className="space-y-3 mt-1">
            <p className="text-xs text-foreground/80">
              请妥善保管该令牌。出于安全考虑，完整 Token 仅在生成时展示一次：
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                readOnly
                value={createdKey}
                rounded="pill"
                className="font-mono text-xs bg-card flex-1 min-w-[280px]"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(createdKey)}
                className="gap-1.5 shrink-0 text-xs shadow-2xs"
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
                className="gap-1.5 shrink-0 text-xs shadow-2xs"
              >
                <Copy className="size-3.5" />
                复制客户端配置
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧两列：签发表单与列表 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 创建新 Token */}
          <Card className="shadow-level-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Plus className="size-4 text-primary" />
                创建新令牌
              </CardTitle>
              <CardDescription className="text-xs">
                为特定的 AI 客户端签发带有过期机制的安全访问凭证。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="keyName" className="text-xs font-medium text-foreground">
                      令牌标识 / 客户端名称
                    </Label>
                    <Input
                      id="keyName"
                      placeholder="例如：Cursor / Claude Desktop"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      rounded="pill"
                      className="text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="expiry" className="text-xs font-medium text-foreground">
                      有效天数
                    </Label>
                    <Input
                      id="expiry"
                      type="number"
                      min="1"
                      max="365"
                      value={keyExpiryDays}
                      onChange={(e) => setKeyExpiryDays(e.target.value)}
                      rounded="pill"
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
                  {submitting ? "创建中..." : "创建令牌"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 令牌列表 */}
          <Card className="shadow-level-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Key className="size-4 text-primary" />
                    令牌清单
                  </CardTitle>
                  <CardDescription className="text-xs">
                    当前处于有效状态或待管理的全部访问密钥。
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  共 {apiKeys.length} 个
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl">
                  暂无已创建的令牌，请在上方创建新令牌。
                </div>
              ) : (
                <div className="rounded-2xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">名称</TableHead>
                        <TableHead className="text-xs font-semibold">Token 前缀</TableHead>
                        <TableHead className="text-xs font-semibold">创建日期</TableHead>
                        <TableHead className="text-xs font-semibold">到期时间</TableHead>
                        <TableHead className="text-xs font-semibold text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((k) => (
                        <TableRow key={k.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs font-semibold text-foreground">
                            {k.name || "未命名"}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            <span className="px-2 py-0.5 rounded-full bg-muted/60 border border-border font-mono text-[11px]">
                              {k.start || k.prefix || "••••••••"}...
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="size-3 text-muted-foreground" />
                              {new Date(k.createdAt).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {k.expiresAt
                              ? new Date(k.expiresAt).toLocaleDateString()
                              : <Badge variant="outline" className="text-[10px] h-4.5 px-2">永久</Badge>}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteKey(k.id)}
                              className="text-muted-foreground hover:text-destructive hover:bg-rose/40"
                              title="撤销此令牌"
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
          <Card className="shadow-level-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Laptop className="size-4 text-primary" />
                  客户端快捷接入
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                选择你的 AI IDE 或宿主客户端，一键复制 MCP 配置：
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 客户端切换药丸控件 */}
              <div className="flex items-center gap-1 rounded-full border border-border bg-muted/50 p-1">
                {(["cursor", "claude", "windsurf"] as const).map((client) => (
                  <button
                    key={client}
                    type="button"
                    onClick={() => setSelectedClient(client)}
                    className={`flex-1 py-1 text-xs font-medium rounded-full transition-all duration-150 text-center active:scale-[0.98] ${
                      selectedClient === client
                        ? "bg-card text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {client === "cursor" ? "Cursor" : client === "claude" ? "Claude" : "Windsurf"}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    mcpServers 配置片段：
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => copyToClipboard(getClientConfigSnippet(selectedClient))}
                    className="text-secondary gap-1 px-2.5"
                  >
                    <Copy className="size-3" />
                    复制
                  </Button>
                </div>

                {/* Inverted Obsidian Dark Code Container per DESIGN.md */}
                <div className="rounded-2xl bg-[#0B0F19] p-3.5 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 shadow-inverted">
                  <pre>{getClientConfigSnippet(selectedClient)}</pre>
                </div>
              </div>

              <div className="rounded-2xl border border-border p-3.5 bg-muted/30 text-xs space-y-2 text-muted-foreground">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Terminal className="size-3.5 text-secondary" />
                  端点连接详情
                </div>
                <ul className="space-y-1 text-[11px]">
                  <li className="flex items-start gap-1">
                    <span className="font-semibold text-foreground shrink-0">端点 URL:</span>
                    <code className="font-mono text-foreground break-all">{serverMcpUrl}</code>
                  </li>
                  <li className="flex items-start gap-1">
                    <span className="font-semibold text-foreground shrink-0">鉴权请求头:</span>
                    <code className="font-mono text-foreground">Authorization: Bearer &lt;Token&gt;</code>
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="font-semibold text-foreground">协议类型:</span>
                    <span>Streamable HTTP MCP</span>
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
