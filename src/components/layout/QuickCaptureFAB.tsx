"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { QuickCaptureDrawer } from "@/components/ui/QuickCaptureDrawer";

export function QuickCaptureFAB() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
        <button
          className="w-14 h-14 bg-primary text-void rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform duration-100"
          aria-label="Quick Capture"
          onClick={() => setIsDrawerOpen(true)}
        >
          <Plus size={32} strokeWidth={2.5} />
        </button>
      </div>
      
      <QuickCaptureDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
      />
    </>
  );
}
