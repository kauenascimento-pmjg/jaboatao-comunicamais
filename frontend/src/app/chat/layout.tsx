'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/authStore';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-blue border-t-brand-red animate-spin" />
          <p className="font-display text-sm uppercase tracking-widest text-muted">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[var(--bg)] overflow-hidden">
      {children}
    </div>
  );
}
