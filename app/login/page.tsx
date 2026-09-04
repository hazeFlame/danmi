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
import { Key, AlertCircle } from "lucide-react";

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
    <main className="min-h-screen bg-muted/20 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            danmi
          </h1>
          <p className="text-sm text-muted-foreground">
            登录以管理 MCP 访问与令牌
          </p>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="space-y-1 text-center pb-4">
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Key className="size-5" />
            </div>
            <CardTitle className="text-lg">
              {isRegister ? "注册账号" : "登录"}
            </CardTitle>
            <CardDescription>
              {isRegister
                ? "创建您的账号以使用服务"
                : "输入邮箱与密码"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Login / Register toggle */}
            <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-center text-sm font-medium">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setAuthError("");
                }}
                className={`rounded-md py-1.5 transition-all ${
                  !isRegister
                    ? "bg-background text-foreground shadow-xs"
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
                className={`rounded-md py-1.5 transition-all ${
                  isRegister
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                注册
              </button>
            </div>

            {authError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>错误</AlertTitle>
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {isRegister && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">姓名</Label>
                  <Input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="请输入姓名"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full gap-2 font-semibold"
              >
                {submitting ? (
                  "处理中..."
                ) : isRegister ? (
                  "注册"
                ) : (
                  "登录"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
