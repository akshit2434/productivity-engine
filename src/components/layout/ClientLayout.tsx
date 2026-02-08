"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Navigation } from "@/components/layout/Navigation";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { initialSync } from "@/lib/sync";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const QuickCaptureFAB = dynamic(
  () => import("@/components/layout/QuickCaptureFAB").then((mod) => mod.QuickCaptureFAB),
  { ssr: false }
);

import QueryProvider from "@/providers/QueryProvider";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChat = pathname === "/chat";
  const isExport = pathname?.startsWith("/export");

  React.useEffect(() => {
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[PWA] Service Worker registered:', reg.scope))
        .catch((err) => console.error('[PWA] Service Worker registration failed:', err));
    }

    // Initial Data Sync from Supabase to Dexie
    initialSync().catch(err => console.error('[Sync] Initial sync error:', err));
  }, []);

  return (
    <QueryProvider>
      <SplashScreen />
      <main className={cn("min-h-screen", !isChat && !isExport && "pb-24")}>
        {children}
      </main>
      {!isChat && !isExport && <QuickCaptureFAB />}
      {!isChat && !isExport && <Navigation />}
    </QueryProvider>
  );
}
