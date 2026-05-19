'use client';

import React from 'react';
import { AuthGuard } from '@/components/providers/AuthGuard';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="h-screen bg-[var(--bg)] overflow-hidden">
        {children}
      </div>
    </AuthGuard>
  );
}
