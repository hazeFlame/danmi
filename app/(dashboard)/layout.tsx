"use client";

import React, { useEffect, useState } from "react";
import { authClient } from "@/src/auth/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tokenCount, setTokenCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const res = await authClient.getSession();
      if (!res?.data?.user) {
        window.location.href = "/login";
        return;
      }
      setSession(res.data);

      // Load token count for sidebar badge
      const keysRes = await authClient.apiKey.list().catch(() => null);
      if (keysRes) {
        const list = (keysRes?.data as any)?.apiKeys || keysRes?.data;
        if (Array.isArray(list)) {
          setTokenCount(list.length);
        }
      }
    } catch {
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground font-medium">正在加载 MCP 门户...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar Navigation */}
      <Sidebar
        session={session}
        tokenCount={tokenCount}
        onSignOut={handleSignOut}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
