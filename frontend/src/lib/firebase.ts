import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app, process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || 'comunica-mais');
export const rtdb = getDatabase(
  app,
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
);
export const storage = getStorage(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

/**
 * Aguarda o Firebase Auth restaurar a sessão atual antes de operações que dependem do token.
 */
export const waitForAuthReady = (): Promise<User | null> => {
  if (auth.currentUser !== null) {
    return Promise.resolve(auth.currentUser);
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

/**
 * Gera a URL de retorno usada pelo Firebase Auth (verify/reset links).
 * Em produção, prioriza NEXT_PUBLIC_APP_URL para evitar domínio não autorizado.
 */
export const getAuthActionUrl = (path = '/login'): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');

  if (configuredBaseUrl) {
    return `${configuredBaseUrl}${normalizedPath}`;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}${normalizedPath}`;
  }

  return `http://localhost:3000${normalizedPath}`;
};
