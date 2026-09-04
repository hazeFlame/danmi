"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, KeyRound, ArrowLeft, Radio } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const pathname = usePathname();
  const isTokensPage = pathname === "/tokens";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/70 bg-card/80 backdrop-blur-md px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={onOpenMobileMenu}
          >
            <Menu className="size-5" />
            <span className="sr-only">打开菜单</span>
          </Button>
        )}

        <div>
          <h1 className="text-base font-bold text-foreground leading-tight tracking-tight">
            {isTokensPage ? "令牌管理" : "MCP 门户"}
          </h1>
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            {isTokensPage
              ? "管理客户端访问凭据与端点配置"
              : "飞书自建应用与 Model Context Protocol 连接平台"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Gateway health badge - Mint category accent */}
        <Badge
          variant="mint"
          className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 shadow-2xs"
        >
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          网关运行中
        </Badge>

        {isTokensPage ? (
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5 text-xs shadow-2xs"
            )}
          >
            <ArrowLeft className="size-3.5" />
            返回门户
          </Link>
        ) : (
          <Link
            href="/tokens"
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "gap-1.5 text-xs text-primary-foreground shadow-2xs"
            )}
          >
            <KeyRound className="size-3.5" />
            <span>令牌管理</span>
          </Link>
        )}
      </div>
    </header>
  );
}

