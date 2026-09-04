"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Layers,
  Key,
  LogOut,
  Radio,
  X,
  Calendar,
  CheckSquare,
  Boxes,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  session?: any;
  tokenCount?: number;
  onSignOut?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  session,
  tokenCount = 0,
  onSignOut,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(true);

  const isPortalActive = pathname === "/";
  const isTokensActive = pathname === "/tokens";

  const userInitial = (session?.user?.name || session?.user?.email || "U")[0].toUpperCase();

  return (
    <>
      {/* 移动端遮罩层 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* 桌面端：72px 极简图标导轨 (Icon Rail) */}
      <aside className="hidden lg:flex w-[72px] shrink-0 flex-col items-center justify-between border-r border-border bg-card py-5 z-20">
        {/* 顶部 Brand Orb */}
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/"
            className="group relative flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-level-1 transition-transform hover:scale-105"
            title="danmi - 飞书 MCP 平台"
          >
            <Radio className="size-5 text-primary-foreground transition-transform group-hover:rotate-12" />
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card animate-pulse" />
          </Link>

          {/* 分割点 */}
          <div className="w-8 h-px bg-border my-1" />

          {/* 核心功能药丸导轨 */}
          <nav className="flex flex-col items-center gap-3">
            {/* MCP 门户 */}
            <Link
              href="/"
              title="MCP 门户"
              className={cn(
                "relative flex size-11 items-center justify-center rounded-full transition-all duration-150 active:scale-[0.96]",
                isPortalActive
                  ? "bg-primary text-primary-foreground shadow-inverted font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Layers className="size-5" />
            </Link>

            {/* 令牌管理 */}
            <Link
              href="/tokens"
              title="令牌管理"
              className={cn(
                "relative flex size-11 items-center justify-center rounded-full transition-all duration-150 active:scale-[0.96]",
                isTokensActive
                  ? "bg-primary text-primary-foreground shadow-inverted font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Key className="size-5" />
              {tokenCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-white shadow-xs">
                  {tokenCount}
                </span>
              )}
            </Link>
          </nav>
        </div>

        {/* 底部控制与用户信息 */}
        <div className="flex flex-col items-center gap-3">
          {/* 折叠/展开二级抽屉按钮 */}
          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="hidden xl:flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title={drawerOpen ? "收起侧栏面板" : "展开侧栏面板"}
          >
            {drawerOpen ? (
              <ChevronLeft className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>

          <div className="w-8 h-px bg-border my-1" />

          {/* 用户头像 Orb */}
          <div
            className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shadow-2xs"
            title={session?.user?.name || session?.user?.email || "当前用户"}
          >
            {userInitial}
          </div>

          {/* 退出登录 */}
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-rose/60 hover:text-rose-foreground transition-all duration-150"
              title="退出登录"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </aside>

      {/* 桌面端二级抽屉 (Drawer Panel) */}
      {drawerOpen && (
        <aside className="hidden xl:flex w-64 shrink-0 flex-col justify-between border-r border-border bg-card/60 backdrop-blur-xs p-4 z-10 transition-all">
          <div className="space-y-6">
            {/* 工作区标头 */}
            <div className="px-2 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Workspace
                </span>
                <span className="size-1.5 rounded-full bg-emerald-500" />
              </div>
              <h2 className="text-sm font-bold text-foreground tracking-tight mt-0.5">
                Orbital 工作台
              </h2>
            </div>

            {/* 导航列表 */}
            <div className="space-y-1">
              <Link
                href="/"
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all",
                  isPortalActive
                    ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="size-4 shrink-0" />
                  <span>MCP 门户</span>
                </div>
                <Badge
                  variant={isPortalActive ? "default" : "secondary"}
                  className={cn(
                    "text-[10px] h-4.5 px-2",
                    isPortalActive && "bg-white/20 text-white border-transparent"
                  )}
                >
                  飞书
                </Badge>
              </Link>

              <Link
                href="/tokens"
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all",
                  isTokensActive
                    ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Key className="size-4 shrink-0" />
                  <span>令牌管理</span>
                </div>
                {tokenCount > 0 && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] h-4.5 px-2",
                      isTokensActive && "bg-white/20 text-white border-transparent"
                    )}
                  >
                    {tokenCount}
                  </Badge>
                )}
              </Link>
            </div>

            {/* 生态能力快捷指标 (Category Accents) */}
            <div className="space-y-2 pt-2 border-t border-border/70">
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                生态协同能力
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose/40 border border-rose-foreground/15 text-[11px] text-foreground font-medium">
                  <Calendar className="size-3 text-rose-foreground" />
                  <span>日程服务</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-sky/40 border border-sky-foreground/15 text-[11px] text-foreground font-medium">
                  <CheckSquare className="size-3 text-sky-foreground" />
                  <span>任务清单</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber/40 border border-amber-foreground/15 text-[11px] text-foreground font-medium">
                  <Boxes className="size-3 text-amber-foreground" />
                  <span>应用集成</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-mint/40 border border-mint-foreground/15 text-[11px] text-foreground font-medium">
                  <FileText className="size-3 text-mint-foreground" />
                  <span>知识便签</span>
                </div>
              </div>
            </div>
          </div>

          {/* 底部状态徽章 */}
          <div className="p-3 rounded-xl border border-border bg-muted/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-secondary" />
                Streamable MCP
              </span>
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              {session?.user?.email || "已连接身份系统"}
            </p>
          </div>
        </aside>
      )}

      {/* 移动端侧滑全功能抽屉 */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col justify-between border-r border-border bg-card p-4 transition-transform duration-200 ease-in-out lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                <Radio className="size-4" />
              </div>
              <span className="font-bold text-sm text-foreground">danmi</span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onCloseMobile}
              className="text-muted-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="space-y-1">
            <Link
              href="/"
              onClick={onCloseMobile}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-medium",
                isPortalActive
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="size-4" />
                <span>MCP 门户</span>
              </div>
              <Badge variant="secondary" className="text-[10px] h-4.5 px-2">
                飞书
              </Badge>
            </Link>

            <Link
              href="/tokens"
              onClick={onCloseMobile}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-medium",
                isTokensActive
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Key className="size-4" />
                <span>令牌管理</span>
              </div>
              {tokenCount > 0 && (
                <Badge variant="outline" className="text-[10px] h-4.5 px-2">
                  {tokenCount}
                </Badge>
              )}
            </Link>
          </div>
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/40 border border-border">
            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {session?.user?.name || "用户"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate font-mono">
                {session?.user?.email}
              </p>
            </div>
            {onSignOut && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onSignOut}
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
