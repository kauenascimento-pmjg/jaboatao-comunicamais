'use client';

import React, { useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useAuthStore, ADUser } from '@/lib/authStore';
import { Eye, EyeOff, AlertCircle, ShieldCheck, ArrowLeft, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { syncUserToFirestore } from '@/lib/chatService';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const { theme, toggle }       = useTheme();
  const { setUser }             = useAuthStore();
  const router = useRouter();

  const getBackendBaseUrl = () => {
    const configuredUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (configuredUrl && !/localhost|127\.0\.0\.1/i.test(configuredUrl)) return configuredUrl;
    if (typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:4000`;
    return configuredUrl || 'http://localhost:4000';
  };

  /** Login técnico no Firebase para não interferir com e-mails reais */
  const bridgeAuth = async (adUsername: string, adPassword: string, displayName: string) => {
    // Usamos um domínio interno falso para garantir zero interferência
    const techEmail = `${adUsername}.ad@comunicamais.internal`;
    const techPassword = `bridge_${adUsername}_pmjg_2025`;

    try {
      return await signInWithEmailAndPassword(auth, techEmail, techPassword);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        try {
          const cred = await createUserWithEmailAndPassword(auth, techEmail, techPassword);
          await updateProfile(cred.user, { displayName });
          return cred;
        } catch (createErr: any) {
          // Se ainda der erro de e-mail em uso (raro com domínio interno), tentamos logar com a senha digitada
          if (createErr.code === 'auth/email-already-in-use') {
             return await signInWithEmailAndPassword(auth, techEmail, techPassword);
          }
          throw createErr;
        }
      }
      throw err;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Validar via AD (Backend)
      const response = await fetch(`${getBackendBaseUrl()}/api/auth/ad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: username.trim(), password }),
      });

      if (!response.ok) {
        setError('Usuário ou senha incorretos.');
        return;
      }

      const userData = await response.json();
      const apiUser = userData.user || {};
      const adUsername = userData.uid || apiUser.username || username;
      const displayName = apiUser.full_name || apiUser.nome_completo || apiUser.nome || adUsername;

      // 2. Ponte Firebase (Silenciosa e sem e-mail real)
      const cred = await bridgeAuth(adUsername, password, displayName);
      
      // 3. Sucesso! Salvar e Redirecionar
      const adUser: ADUser = {
        uid: cred.user.uid,
        displayName,
        email: apiUser.email || `${adUsername}@jaboatao.pe.gov.br`,
        nome_completo: displayName,
        user: adUsername,
        isAD: true,
        department: apiUser.department || 'Geral',
      };

      await syncUserToFirestore(adUser);
      setUser(adUser);
      router.push('/chat');

    } catch (err) {
      console.error('Erro no login:', err);
      setError('Ocorreu um erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center p-4">
      <div className="fixed top-0 left-0 w-full h-1.5 bg-brand-gold z-50" />
      <div className="fixed top-[1.5px] left-0 w-full h-1.5 bg-brand-green z-50" />

      <button onClick={toggle} className="fixed top-8 right-8 p-3 bg-[var(--surface)] border-2 border-brand-blue text-brand-blue shadow-brutal-sm shadow-brand-blue hover:shadow-none transition-all">
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 bg-brand-blue flex items-center justify-center shadow-brutal-md shadow-brand-gold mb-6">
            <span className="font-display font-extrabold text-white text-3xl">C+</span>
          </div>
          <h1 className="font-display font-extrabold text-3xl text-brand-blue-text tracking-tighter uppercase">
            COMUNICA<span className="text-brand-gold">+</span>
          </h1>
          <p className="text-[10px] font-bold text-brand-green uppercase tracking-[0.3em] mt-1">
            Prefeitura do Jaboatão dos Guararapes
          </p>
        </div>

        <div className="bg-[var(--surface)] border-4 border-brand-blue p-8 shadow-brutal-xl shadow-brand-blue relative">
          <div className="absolute top-0 right-0 py-1 px-3 bg-brand-blue text-white font-display font-bold text-[10px] uppercase tracking-widest">
            Acesso AD
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block font-display font-bold text-xs uppercase tracking-widest text-brand-blue-text/60">
                Usuário Institucional
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-[var(--bg)] border-2 border-brand-blue/20 p-4 font-sans text-sm focus:border-brand-blue outline-none transition-all placeholder:opacity-30"
                placeholder="nome.sobrenome"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-display font-bold text-xs uppercase tracking-widest text-brand-blue-text/60">
                Senha do Computador
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-[var(--bg)] border-2 border-brand-blue/20 p-4 font-sans text-sm focus:border-brand-blue outline-none transition-all placeholder:opacity-30"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-blue/40 hover:text-brand-blue">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 bg-brand-red/5 border-l-4 border-brand-red p-4 text-brand-red">
                <AlertCircle size={18} />
                <p className="font-sans text-xs font-semibold">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-blue text-white py-5 font-display font-bold text-sm uppercase tracking-widest shadow-brutal-md shadow-brand-gold hover:shadow-none hover:translate-x-1 hover:translate-y-1 disabled:opacity-50 transition-all"
            >
              {loading ? 'Verificando...' : 'Entrar no Chat'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
