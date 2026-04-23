import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from 'firebase/auth';

export interface ADUser {
  uid: string;
  displayName: string;
  email: string;
  nome_completo: string;
  email_institucional?: string;
  user: string;
  isAD: boolean;
  department?: string;
  role?: string;
}

interface AuthState {
  user: User | ADUser | null;
  loading: boolean;
  setUser: (user: User | ADUser | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'comunica-plus-auth', // Nome da chave no localStorage
      // Como o objeto User do Firebase tem métodos circulares, 
      // o persist vai salvar apenas os dados básicos para o ADUser
      // Para o Firebase User, o onAuthStateChanged no AuthProvider cuidará da restauração real.
    }
  )
);
