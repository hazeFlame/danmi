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

  // Device Flow states (One-click popup authorization)
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
  // 核心：一键设备授权流程 (App Registration + Device Authorization)
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
      setDeviceStatusText(
        "已打开飞书授权窗口，请在弹窗中选择或创建应用..."
      );

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
          } catch (err) {
            console.warn("轮询状态中...", err);
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
    let step2Interval = 5000;

    const scheduleNextStep2Poll = () => {
      pollTimerRef.current = setTimeout(async () => {
        step2PollCount++;
        if (step2PollCount > 80) {
          finishAuthSuccess(appName, appId);
          return;
        }

        try {
          const tokenRes = await fetch("/api/feishu/device", {
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
          const tokenData = (await tokenRes.json()) as any;

          if (tokenData.slowDown) {
            step2Interval = Math.min(step2Interval + 2000, 12000);
          }

          if (tokenData.status === "completed") {
            finishAuthSuccess(appName, appId);
            return;
          }

          scheduleNextStep2Poll();
        } catch (err) {
          console.warn("阶段二轮询中...", err);
          scheduleNextStep2Poll();
        }
      }, step2Interval);
    };

    scheduleNextStep2Poll();
  }

  function finishAuthSuccess(appName?: string, appId?: string) {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    setDeviceFlowActive(false);
    setFeishuSuccess(`已连接飞书应用「${appName || appId || "自建应用"}」`);
    loadFeishuConfig();
  }

  function handleCancelAuth() {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    setDeviceFlowActive(false);
    setDeviceStatusText("");
  }

  async function handleDeleteFeishu() {
    if (
      !confirm(
        "确定要解除此飞书应用的绑定吗？解除后使用该账号的 MCP Token 将无法再读取飞书任务。"
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
      {/* Feedback Alerts */}
      {feishuError && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-xs">{feishuError}</AlertDescription>
        </Alert>
      )}
      {feishuSuccess && (
        <Alert className="py-2.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4" />
          <AlertDescription className="text-xs">{feishuSuccess}</AlertDescription>
        </Alert>
      )}

      {/* 核心卡片：连接飞书自建应用 */}
      <Card className="border-primary/20 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              飞书应用
            </CardTitle>
            <CardDescription className="text-xs">
              授权飞书自建应用，为 MCP 提供任务数据访问能力。
            </CardDescription>
          </div>
          {feishuConfig?.configured ? (
            <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 gap-1.5">
              <CheckCircle2 className="size-3.5" />
              已连接
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground gap-1.5">
              <AlertCircle className="size-3.5" />
              未连接
            </Badge>
          )}
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* 状态 1: 已配置 */}
          {feishuConfig?.configured && !deviceFlowActive ? (
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {feishuConfig.appName || "飞书自建应用"}
                  </span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {feishuConfig.appId}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="text-emerald-600 font-medium">已连接</span>
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
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteFeishu}
                  className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Unlink className="size-3.5" />
                  解除绑定
                </Button>
              </div>
            </div>
          ) : deviceFlowActive ? (
            /* 状态 2: 正在进行设备流授权 */
            <div className="p-5 rounded-lg border border-primary/30 bg-primary/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span className="font-semibold text-sm text-foreground">
                    飞书授权中...
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {deviceStep} / 2
                </Badge>
              </div>

              {/* 进度步进条 */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div
                  className={cn(
                    "p-2.5 rounded-md border text-center transition-colors",
                    deviceStep === 1
                      ? "border-primary bg-background shadow-xs font-semibold text-primary"
                      : "border-muted bg-muted/40 text-muted-foreground"
                  )}
                >
                  1. 选择或创建应用
                </div>
                <div
                  className={cn(
                    "p-2.5 rounded-md border text-center transition-colors",
                    deviceStep === 2
                      ? "border-primary bg-background shadow-xs font-semibold text-primary"
                      : "border-muted bg-muted/40 text-muted-foreground"
                  )}
                >
                  2. 确认应用授权
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-background/80 p-3 rounded border space-y-2">
                <p className="font-medium text-foreground">{deviceStatusText}</p>
                {activeVerificationUrl && (
                  <div className="flex items-center gap-2 pt-1">
                    <span>若未自动打开弹窗，请点击：</span>
                    <a
                      href={activeVerificationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline font-medium inline-flex items-center gap-0.5"
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
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  取消
                </Button>
              </div>
            </div>
          ) : (
            /* 状态 3: 未配置 - 授权连接按钮 */
            <div className="p-6 rounded-lg border border-dashed border-primary/40 bg-gradient-to-b from-primary/5 to-transparent text-center space-y-3">
              <div className="mx-auto size-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Rocket className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-foreground">
                  连接飞书应用
                </h3>
                <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  点击下方按钮在弹窗中完成授权，支持选择已有应用或新建应用。
                </p>
              </div>

              <div className="pt-2">
                <Button
                  size="default"
                  onClick={handleStartOneClickAuth}
                  className="gap-2 px-6 shadow-xs"
                >
                  <Rocket className="size-4" />
                  授权连接飞书
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 辅助指引：MCP 服务端点 */}
      <Card className="bg-muted/20 border-dashed">
        <CardContent className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-emerald-500" />
              <span className="text-xs font-semibold text-foreground">
                MCP 服务端点
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              {mcpServerUrl}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyText(mcpServerUrl)}
              className="gap-1.5 text-xs h-8"
            >
              {copiedUrl ? (
                <>
                  <Check className="size-3 text-emerald-600" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  复制端点
                </>
              )}
            </Button>

            <Link
              href="/tokens"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "gap-1.5 text-xs h-8 text-primary-foreground font-medium shadow-xs"
              )}
            >
              <KeyRound className="size-3.5" />
              前往令牌管理
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
