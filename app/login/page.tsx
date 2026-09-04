"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/src/auth/client";
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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Key, AlertCircle, Radio } from "lucide-react";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // If already logged in, redirect to home/dashboard
    authClient
      .getSession()
      .then((res) => {
        if (res?.data?.user) {
          window.location.href = "/";
        } else {
          setCheckingSession(false);
        }
      })
      .catch(() => {
        setCheckingSession(false);
      });
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setSubmitting(true);

    try {
      if (isRegister) {
        const res = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        if (res.error) {
          setAuthError(res.error.message || "注册失败，请重试");
        } else {
          window.location.href = "/";
        }
      } else {
        const res = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (res.error) {
          setAuthError(res.error.message || "登录失败，请检查邮箱和密码");
        } else {
          window.location.href = "/";
        }
      }
    } catch (err: any) {
      setAuthError(err?.message || "网络请求异常");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-muted/20 flex items-center justify-center p-6 text-foreground">
        <div className="flex items-center gap-3">
          <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">正在校验登录状态...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-level-1">
            <Radio className="size-6 animate-pulse text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            danmi
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            连接飞书生态的 Model Context Protocol 服务平台
          </p>
        </div>

        <Card className="shadow-level-2 border border-border rounded-2xl">
          <CardHeader className="space-y-1 text-center pb-4">
            <CardTitle className="text-base font-bold">
              {isRegister ? "注册账号" : "用户登录"}
            </CardTitle>
            <CardDescription className="text-xs">
              {isRegister
                ? "创建您的账号以开启 MCP 凭据与生态连接"
                : "输入账号密码以进入控制台"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Login / Register toggle pill */}
            <div className="grid grid-cols-2 rounded-full bg-muted/60 border border-border p-1 text-center text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setAuthError("");
                }}
                className={`rounded-full py-1.5 transition-all duration-150 active:scale-[0.98] ${
                  !isRegister
                    ? "bg-card text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                登录
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setAuthError("");
                }}
                className={`rounded-full py-1.5 transition-all duration-150 active:scale-[0.98] ${
                  isRegister
                    ? "bg-card text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                注册
              </button>
            </div>

            {authError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>错误提示</AlertTitle>
                <AlertDescription className="text-xs">{authError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {isRegister && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium">姓名</Label>
                  <Input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="请输入姓名"
                    rounded="pill"
                    className="text-xs"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">邮箱地址</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  rounded="pill"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">密码</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  rounded="pill"
                  className="text-xs"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full gap-2 font-semibold shadow-level-1 mt-2"
              >
                {submitting ? (
                  "处理中..."
                ) : isRegister ? (
                  "完成注册并进入"
                ) : (
                  "立即登录"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
