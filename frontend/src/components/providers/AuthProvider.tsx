'use client';

import { useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/lib/authStore';

/**
 * AuthProvider simplificado
 * Monitora estado do Firebase Auth e atualiza o Zustand store
 * Sem dependência de Firestore
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    console.log('[AuthProvider] Setting up Firebase Auth listener');

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        console.log('[AuthProvider] User authenticated:', firebaseUser.uid, firebaseUser.email);
        
        // Armazenar dados básicos do Firebase Auth no store
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
          emailVerified: firebaseUser.emailVerified,
          createdAt: firebaseUser.metadata.creationTime ? new Date(firebaseUser.metadata.creationTime) : null,
        });
      } else {
        console.log('[AuthProvider] User logged out');
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => {
      console.log('[AuthProvider] Cleaning up Firebase Auth listener');
      unsubscribe();
    };
  }, [setUser, setLoading]);

  return <>{children}</>;
}
