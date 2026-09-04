"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Layers,
  Key,
  LogOut,
  Radio,
  X,
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

  const isPortalActive = pathname === "/";
  const isTokensActive = pathname === "/tokens";

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex w-60 flex-col border-r bg-card transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b">
          <Link href="/" className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
              <Radio className="size-5 text-primary-foreground animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
                danmi
                <span className="size-2 rounded-full bg-emerald-500 inline-block" />
              </span>
              <span className="text-[11px] text-muted-foreground">飞书连接</span>
            </div>
          </Link>
          {isMobileOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden size-8"
              onClick={onCloseMobile}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        {/* Main Menu: 仅保留一个「MCP 门户」 */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            菜单
          </div>

          <Link
            href="/"
            onClick={onCloseMobile}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left",
              isPortalActive
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Layers
                className={cn(
                  "size-4 shrink-0",
                  isPortalActive ? "text-primary-foreground" : "text-muted-foreground"
                )}
              />
              <span>MCP 门户</span>
            </div>

            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] px-1.5 py-0 h-4.5 font-normal",
                isPortalActive && "bg-primary-foreground/20 text-primary-foreground border-transparent"
              )}
            >
              飞书
            </Badge>
          </Link>
        </div>

        {/* Bottom Section (左下角): 令牌管理 + 用户状态 */}
        <div className="p-3 border-t bg-muted/10 space-y-2">
          {/* 左下角「令牌管理」入口 */}
          <Link
            href="/tokens"
            onClick={onCloseMobile}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left",
              isTokensActive
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent hover:border-border"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Key
                className={cn(
                  "size-4 shrink-0",
                  isTokensActive ? "text-primary-foreground" : "text-muted-foreground"
                )}
              />
              <span>令牌管理</span>
            </div>

            {tokenCount > 0 && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0 h-4.5 font-normal",
                  isTokensActive && "bg-primary-foreground/20 text-primary-foreground border-transparent"
                )}
              >
                {tokenCount}
              </Badge>
            )}
          </Link>

          {/* 用户信息与退出登录 */}
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-background border shadow-2xs">
            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              {(session?.user?.name || session?.user?.email || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {session?.user?.name || "用户"}
              </p>
              {session?.user?.email && (
                <p className="text-[10px] text-muted-foreground truncate font-mono">
                  {session.user.email}
                </p>
              )}
            </div>
            {onSignOut && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSignOut}
                className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                title="退出登录"
              >
                <LogOut className="size-3" />
              </Button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
