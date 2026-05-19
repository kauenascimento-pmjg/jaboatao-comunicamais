'use client';

import { useAuthStore, AuthUser } from '@/lib/authStore';

/**
 * Hook para acessar dados de autenticação
 * Fornece acesso ao usuário atual, estado de carregamento e funções de logout
 */
export function useAuth() {
  const { user, loading, logout } = useAuthStore();

  return {
    user: user as AuthUser | null,
    isAuthenticated: !!user,
    isLoading: loading,
    logout,
  };
}

/**
 * Hook para verificar se usuário é autenticado
 */
export function useIsAuthenticated() {
  const { user } = useAuthStore();
  return !!user;
}

/**
 * Hook para obter o usuário atual
 */
export function useCurrentUser() {
  const { user } = useAuthStore();
  return user as AuthUser | null;
}
