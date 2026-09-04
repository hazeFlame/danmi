"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Rocket,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Unlink,
  ExternalLink,
  Loader2,
  Radio,
  KeyRound,
  ArrowRight,
  Copy,
  Check,
  Calendar,
  CheckSquare,
  Boxes,
  FileText,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface FeishuConfigItem {
  configured: boolean;
  appId?: string;
  appName?: string;
  updatedAt?: string;
}

export default function McpPortalPage() {
  const [feishuConfig, setFeishuConfig] = useState<FeishuConfigItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [feishuError, setFeishuError] = useState<string | null>(null);
  const [feishuSuccess, setFeishuSuccess] = useState<string | null>(null);

  // 设备流状态
  const [deviceFlowActive, setDeviceFlowActive] = useState(false);
  const [deviceStep, setDeviceStep] = useState<1 | 2>(1);
  const [deviceStatusText, setDeviceStatusText] = useState("");
  const [activeVerificationUrl, setActiveVerificationUrl] = useState("");
  const pollTimerRef = useRef<any>(null);
  const popupRef = useRef<Window | null>(null);

  const [origin, setOrigin] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    loadFeishuConfig();

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  async function loadFeishuConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/feishu/config");
      if (res.ok) {
        const data = (await res.json()) as FeishuConfigItem;
        setFeishuConfig(data);
      }
    } catch (err) {
      console.error("加载飞书配置失败:", err);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================================
  // 一键免密设备流授权流程
  // =========================================================================
  async function handleStartOneClickAuth() {
    setFeishuError(null);
    setFeishuSuccess(null);
    setDeviceFlowActive(true);
    setDeviceStep(1);
    setDeviceStatusText("正在连接飞书开放平台发起设备授权...");

    const popupWidth = 560;
    const popupHeight = 720;
    const left = window.screenX + (window.outerWidth - popupWidth) / 2;
    const top = window.screenY + (window.outerHeight - popupHeight) / 2;
    const popup = window.open(
      "about:blank",
      "feishu_auth_window",
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
    popupRef.current = popup;

    try {
      const startRes = await fetch("/api/feishu/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });

      const startData = (await startRes.json()) as any;
      if (!startRes.ok || !startData.success) {
        throw new Error(startData.error || "发起飞书授权失败");
      }

      const { verificationUrl, deviceCode } = startData;
      setActiveVerificationUrl(verificationUrl);
      setDeviceStatusText("已打开飞书授权窗口，请在弹窗中选择或创建应用...");

      if (popup && !popup.closed) {
        popup.location.href = verificationUrl;
      }

      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

      let step1PollCount = 0;
      let currentInterval = Math.max(startData.interval || 5, 5) * 1000;

      const scheduleNextStep1Poll = () => {
        pollTimerRef.current = setTimeout(async () => {
          step1PollCount++;
          if (step1PollCount > 120) {
            setDeviceFlowActive(false);
            setFeishuError("飞书授权超时，请重试");
            return;
          }

          try {
            const pollRes = await fetch("/api/feishu/device", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "poll_app", deviceCode }),
            });
            const pollData = (await pollRes.json()) as any;

            if (pollData.status === "error") {
              setDeviceFlowActive(false);
              setFeishuError(pollData.error || "飞书授权失败");
              return;
            }

            if (pollData.slowDown) {
              currentInterval = Math.min(currentInterval + 2000, 12000);
            }

            if (pollData.status === "app_ready" && pollData.step === 2) {
              setDeviceStep(2);
              setDeviceStatusText(
                `已选定应用「${pollData.appName || pollData.appId}」，请在弹窗中确认授权...`
              );

              const step2Url = pollData.step2VerificationUrl;
              setActiveVerificationUrl(step2Url);

              if (popupRef.current && !popupRef.current.closed) {
                popupRef.current.location.href = step2Url;
                popupRef.current.focus();
              } else {
                popupRef.current = window.open(
                  step2Url,
                  "feishu_auth_window",
                  "width=560,height=720,scrollbars=yes,resizable=yes"
                );
              }

              startTokenPolling(
                pollData.appId,
                pollData.appSecret,
                pollData.appName,
                pollData.step2DeviceCode
              );
              return;
            }

            if (pollData.status === "completed") {
              finishAuthSuccess(pollData.appName, pollData.appId);
              return;
            }

            scheduleNextStep1Poll();
          } catch (pollErr: any) {
            console.warn("轮询状态中...", pollErr);
            scheduleNextStep1Poll();
          }
        }, currentInterval);
      };

      scheduleNextStep1Poll();
    } catch (err: any) {
      if (popup && !popup.closed) popup.close();
      setDeviceFlowActive(false);
      setFeishuError(err?.message || "网络请求异常");
    }
  }

  function startTokenPolling(
    appId: string,
    appSecret: string,
    appName: string,
    step2DeviceCode: string
  ) {
    let step2PollCount = 0;
    let currentInterval = 5000;

    const scheduleNextTokenPoll = () => {
      pollTimerRef.current = setTimeout(async () => {
        step2PollCount++;
        if (step2PollCount > 80) {
          finishAuthSuccess(appName, appId);
          return;
        }

        try {
          const pollRes = await fetch("/api/feishu/device", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "poll_token",
              appId,
              appSecret,
              appName,
              step2DeviceCode,
            }),
          });
          const pollData = (await pollRes.json()) as any;

          if (pollData.slowDown) {
            currentInterval = Math.min(currentInterval + 2000, 12000);
          }

          if (pollData.status === "completed") {
            finishAuthSuccess(appName, appId);
            return;
          }

          scheduleNextTokenPoll();
        } catch (err) {
          console.warn("阶段二轮询中...", err);
          scheduleNextTokenPoll();
        }
      }, currentInterval);
    };

    scheduleNextTokenPoll();
  }

  function finishAuthSuccess(appName?: string, appId?: string) {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    setDeviceFlowActive(false);
    setFeishuSuccess(`已成功连接飞书应用「${appName || appId || "自建应用"}」`);
    loadFeishuConfig();
  }

  function handleCancelAuth() {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    setDeviceFlowActive(false);
    setDeviceStatusText("");
  }

  async function handleDeleteFeishu() {
    if (
      !confirm(
        "确定要解除此飞书应用的绑定吗？解除后 MCP 端点将无法再访问飞书服务。"
      )
    ) {
      return;
    }

    try {
      const res = await fetch("/api/feishu/config", { method: "DELETE" });
      if (res.ok) {
        setFeishuConfig({ configured: false });
        setFeishuSuccess("已解除绑定");
      }
    } catch (err: any) {
      alert(`解除失败: ${err?.message || err}`);
    }
  }

  const mcpServerUrl = `${origin || "http://localhost:3000"}/api/mcp`;

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* 提示消息 */}
      {feishuError && (
        <Alert variant="destructive" className="py-3">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-xs">{feishuError}</AlertDescription>
        </Alert>
      )}

      {feishuSuccess && (
        <Alert variant="success" className="py-3">
          <CheckCircle2 className="size-4" />
          <AlertDescription className="text-xs">{feishuSuccess}</AlertDescription>
        </Alert>
      )}

      {/* Hero Greeting & Quick Action Category Chips */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Hi, there 👋
              </h1>
              <Badge variant="secondary" className="px-2.5 py-0.5 text-[11px] font-semibold">
                Orbital v0.1
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              通过 Model Context Protocol 赋能外部智能体无缝访问飞书协作与业务数据。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="mint" className="gap-1.5 px-3 py-1">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Runtime Active
            </Badge>
          </div>
        </div>

        {/* Quick Action Category Chips (Pastel Pills as per DESIGN.md) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 shadow-2xs">
            <span className="flex size-5 items-center justify-center rounded-full bg-rose text-rose-foreground">
              <Calendar className="size-3" />
            </span>
            <span className="text-xs font-medium text-foreground">日程日历</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 shadow-2xs">
            <span className="flex size-5 items-center justify-center rounded-full bg-sky text-sky-foreground">
              <CheckSquare className="size-3" />
            </span>
            <span className="text-xs font-medium text-foreground">待办任务</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 shadow-2xs">
            <span className="flex size-5 items-center justify-center rounded-full bg-amber text-amber-foreground">
              <Boxes className="size-3" />
            </span>
            <span className="text-xs font-medium text-foreground">多维表格</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 shadow-2xs">
            <span className="flex size-5 items-center justify-center rounded-full bg-mint text-mint-foreground">
              <FileText className="size-3" />
            </span>
            <span className="text-xs font-medium text-foreground">云文档知识库</span>
          </div>
        </div>
      </div>

      {/* Bento Grid: 飞书应用连接模块 + 智能体运行时卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 核心卡片 1：飞书自建应用连接 */}
        <Card className="lg:col-span-2 shadow-level-1">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                飞书应用连接
              </CardTitle>
              <CardDescription className="text-xs">
                授权并绑定飞书自建应用，为 MCP 工具链提供凭据与权限。
              </CardDescription>
            </div>
            {feishuConfig?.configured ? (
              <Badge variant="mint" className="gap-1.5">
                <CheckCircle2 className="size-3.5" />
                已连接
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground gap-1.5">
                <AlertCircle className="size-3.5" />
                待连接
              </Badge>
            )}
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            {feishuConfig?.configured && !deviceFlowActive ? (
              /* 状态 1: 已绑定 */
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/40">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-foreground">
                      {feishuConfig.appName || "飞书自建应用"}
                    </span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {feishuConfig.appId}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-600 font-medium">已激活</span>
                    {feishuConfig.updatedAt && (
                      <>
                        <span>·</span>
                        <span>更新于: {new Date(feishuConfig.updatedAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartOneClickAuth}
                    className="gap-1.5"
                  >
                    <RefreshCw className="size-3.5" />
                    重新授权
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteFeishu}
                    className="gap-1.5"
                  >
                    <Unlink className="size-3.5" />
                    解除绑定
                  </Button>
                </div>
              </div>
            ) : deviceFlowActive ? (
              /* 状态 2: 正在进行设备流授权 */
              <div className="p-5 rounded-2xl border border-secondary/30 bg-secondary/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Loader2 className="size-4 animate-spin text-secondary" />
                    <span className="font-semibold text-sm text-foreground">
                      飞书免密授权进行中...
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs font-bold">
                    第 {deviceStep} / 2 步
                  </Badge>
                </div>

                {/* 进度指示 */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div
                    className={cn(
                      "p-2.5 rounded-xl border text-center transition-all",
                      deviceStep === 1
                        ? "border-secondary bg-card shadow-2xs font-semibold text-secondary"
                        : "border-border bg-card/60 text-muted-foreground"
                    )}
                  >
                    1. 授权登录与选定应用
                  </div>
                  <div
                    className={cn(
                      "p-2.5 rounded-xl border text-center transition-all",
                      deviceStep === 2
                        ? "border-secondary bg-card shadow-2xs font-semibold text-secondary"
                        : "border-border bg-card/60 text-muted-foreground"
                    )}
                  >
                    2. 确认应用权限
                  </div>
                </div>

                <div className="text-xs text-muted-foreground bg-card p-3 rounded-xl border border-border space-y-2">
                  <p className="font-medium text-foreground">{deviceStatusText}</p>
                  {activeVerificationUrl && (
                    <div className="flex items-center gap-2 pt-1">
                      <span>若未自动弹出，请手动点击：</span>
                      <a
                        href={activeVerificationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-secondary underline font-medium inline-flex items-center gap-0.5"
                      >
                        授权链接
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelAuth}
                    className="text-xs text-muted-foreground"
                  >
                    取消授权
                  </Button>
                </div>
              </div>
            ) : (
              /* 状态 3: 未配置 */
              <div className="p-8 rounded-2xl border border-dashed border-border bg-muted/20 text-center space-y-4">
                <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-2xs">
                  <Sparkles className="size-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-foreground">
                    一键免密连接飞书应用
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                    无需手动繁琐复制 AppID 与 AppSecret，通过设备授权流弹窗即可在 10 秒内完成配置。
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    size="default"
                    onClick={handleStartOneClickAuth}
                    className="gap-2 px-6 shadow-level-1"
                  >
                    <Rocket className="size-4" />
                    授权连接飞书
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 核心卡片 2：Featured Agent Bento (Level Inverted 深石板黑曜石卡片) */}
        <Card variant="inverted" className="flex flex-col justify-between p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge className="bg-secondary text-white border-transparent px-2.5 py-0.5 font-semibold text-[10px]">
                Data & Action Runtime
              </Badge>
              <Zap className="size-4 text-secondary" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                飞书协同生态运行时
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                全面开放 14+ 飞书官方 MCP Tools，支持智能体自主管理日历事件、查询与分配任务、推送消息与搜索多维表格。
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">通信协议</span>
            <span className="font-mono text-slate-200">Streamable HTTP (MCP)</span>
          </div>
        </Card>
      </div>

      {/* Floating AI Composer 风格：MCP 服务端点悬浮栏 */}
      <Card variant="floating" className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-foreground">
                MCP 服务端点
              </span>
              <Badge variant="mint" className="text-[10px] h-4.5 px-2">
                HTTP Streaming
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate max-w-xl">
              {mcpServerUrl}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyText(mcpServerUrl)}
              className="gap-1.5 text-xs shadow-2xs"
            >
              {copiedUrl ? (
                <>
                  <Check className="size-3.5 text-emerald-600" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  复制端点
                </>
              )}
            </Button>

            <Link
              href="/tokens"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "gap-1.5 text-xs text-primary-foreground shadow-level-1"
              )}
            >
              <KeyRound className="size-3.5" />
              前往令牌管理
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
