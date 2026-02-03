"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Navigation } from "@/components/layout/Navigation";
import { QuickCaptureFAB } from "@/components/layout/QuickCaptureFAB";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { cn } from "@/lib/utils";

import QueryProvider from "@/providers/QueryProvider";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChat = pathname === '/chat';

  return (
    <QueryProvider>
      <SplashScreen />
      <main className={cn("min-h-screen", !isChat && "pb-24")}>
        {children}
      </main>
      {!isChat && <QuickCaptureFAB />}
      <Navigation />
    </QueryProvider>
  );
}
