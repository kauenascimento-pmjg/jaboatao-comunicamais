'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

/**
 * AuthGuard - Componente para proteger rotas autenticadas
 * 
 * Uso:
 * ```tsx
 * <AuthGuard>
 *   <MeuComponenteProtegido />
 * </AuthGuard>
 * ```
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Se não está carregando e não está autenticado, redirecionar para login
    if (!isLoading && !isAuthenticated) {
      console.log('[AuthGuard] User not authenticated, redirecting to login');
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-blue border-t-brand-gold animate-spin" />
          <p className="font-display text-sm uppercase tracking-widest text-brand-blue/60">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  // Renderizar conteúdo protegido
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
