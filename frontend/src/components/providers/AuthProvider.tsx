'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/lib/authStore';
import { syncUserToFirestore } from '@/lib/chatService';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await syncUserToFirestore(user).catch(console.error);
      } else {
        // Obter estado atual para verificar se temos um usuário AD persistido
        const currentState = useAuthStore.getState().user;
        const isAD = currentState && 'isAD' in currentState;
        
        if (!isAD) {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  // Efeito adicional para sincronizar usuários AD quando o store mudar
  const userAccount = useAuthStore(state => state.user);
  
  useEffect(() => {
    if (userAccount && 'isAD' in userAccount) {
      syncUserToFirestore(userAccount).catch(console.error);
    }
  }, [userAccount]);

  return <>{children}</>;
}
