import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Usuário de autenticação simplificado (apenas Firebase Auth)
 * Sem dados de Firestore
 */
export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: Date | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

/**
 * Zustand Auth Store com persistência local
 * Dados são salvos no localStorage para recuperar entre abas
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      
      setUser: (user) => {
        console.log('[AuthStore] Setting user:', user?.uid || 'null');
        set({ user });
      },
      
      setLoading: (loading) => set({ loading }),
      
      logout: () => {
        console.log('[AuthStore] Clearing user state');
        set({ user: null });
      },
    }),
    {
      name: 'comunica-plus-auth-v2',
      partialize: (state) => {
        // Salvar apenas dados não sensíveis no localStorage
        return {
          user: state.user ? {
            uid: state.user.uid,
            email: state.user.email,
            displayName: state.user.displayName,
            emailVerified: state.user.emailVerified,
            createdAt: state.user.createdAt ? state.user.createdAt.toISOString() : null,
          } : null,
        };
      },
    }
  )
);
