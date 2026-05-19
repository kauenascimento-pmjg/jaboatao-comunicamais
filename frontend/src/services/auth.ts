import { 
  setPersistence, 
  browserLocalPersistence, 
  sendSignInLinkToEmail, 
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  createUserWithEmailAndPassword,
  User
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

/**
 * Define a persistência local (usuário se mantém logado ao fechar a aba/navegador)
 * Usando Firebase Auth natively
 */
export const initAuthPersistence = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    console.log('[Auth Service] Persistence initialized: browserLocalPersistence');
  } catch (error) {
    console.error('[Auth Service] Error setting persistence:', error);
  }
};

/**
 * Valida se o e-mail pertence ao domínio institucional permitido.
 */
export const isInstitutionalEmail = (email: string): boolean => {
  return email.trim().toLowerCase().endsWith('@jaboatao.pe.gov.br');
};

/**
 * Envia o link mágico para o primeiro acesso (sem Firestore)
 * O usuário ainda não existe no Firebase Auth - apenas envia link
 */
export const sendFirstAccessLink = async (email: string, redirectUrl: string) => {
  const actionCodeSettings = {
    url: redirectUrl,
    handleCodeInApp: true,
  };
  
  console.log('[Auth Service] Sending first access link to:', email);
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  
  // Armazenar e-mail no localStorage para recuperar depois
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('emailForSignIn', email);
  }
};

/**
 * Envia link para redefinição de senha (válido apenas se usuário existe)
 */
export const sendRecoveryLink = async (email: string) => {
  console.log('[Auth Service] Sending password reset link to:', email);
  await sendPasswordResetEmail(auth, email);
};

/**
 * Verifica se o usuário JÁ TEM uma conta no Firebase Auth
 * Sem depender do Firestore
 */
export const checkUserHasPassword = async (email: string): Promise<boolean> => {
  try {
    console.log('[Auth Service] Checking if user exists:', email);
    const methods = await fetchSignInMethodsForEmail(auth, email);
    
    if (methods.length > 0) {
      console.log('[Auth Service] User found with methods:', methods);
      return true;
    }

    console.log('[Auth Service] User not found in Firebase Auth');
    return false;
  } catch (error) {
    console.error('[Auth Service] Error checking user:', error);
    // Se houver erro na verificação, assumir que não existe
    return false;
  }
};

/**
 * Cria um usuário anônimo temporário no Firebase Auth
 * Será convertido em usuário com email/senha quando a senha for definida
 * NOTA: Agora usamos createUserWithEmailAndPassword + updatePassword em vez de Magic Link
 */
export const createAnonUserForPasswordSetup = async (email: string): Promise<User> => {
  try {
    console.log('[Auth Service] Creating temp user for:', email);
    // Criar com senha temporária aleatória
    const tempPassword = Math.random().toString(36).slice(-16);
    const userCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
    console.log('[Auth Service] Temp user created:', userCredential.user.uid);
    return userCredential.user;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('[Auth Service] User already exists');
      throw new Error('Este e-mail já está cadastrado no sistema.');
    }
    throw error;
  }
};
