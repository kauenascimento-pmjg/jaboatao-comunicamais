'use client';

import React, { useState, useEffect } from 'react';
import { 
  isSignInWithEmailLink, 
  sendSignInLinkToEmail, 
  signInWithEmailLink,
  signInWithEmailAndPassword,
  updatePassword,
  fetchSignInMethodsForEmail,
  signOut
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useAuthStore, ADUser } from '@/lib/authStore';
import { AlertCircle, Moon, Sun, Mail, CheckCircle2, ArrowRight, Loader2, Lock, Eye, EyeOff, ShieldCheck, Check, X, UserCheck } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { syncUserToFirestore } from '@/lib/chatService';

export default function LoginPage() {
  const [step, setStep]         = useState<'email' | 'login' | 'verification' | 'password-setup'>('email');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const { theme, toggle }       = useTheme();
  const { setUser }             = useAuthStore();
  const router = useRouter();

  // Forçar e-mails em Português Brasileiro
  useEffect(() => {
    auth.languageCode = 'pt-br';
  }, []);

  // Requisitos da Senha
  const requirements = [
    { label: 'Mínimo 8 caracteres', test: (pw: string) => pw.length >= 8 },
    { label: 'Letra Maiúscula', test: (pw: string) => /[A-Z]/.test(pw) },
    { label: 'Letra Minúscula', test: (pw: string) => /[a-z]/.test(pw) },
    { label: 'Número', test: (pw: string) => /[0-9]/.test(pw) },
    { label: 'Caractere Especial (!@#$...)', test: (pw: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
  ];

  const allMet = requirements.every(r => r.test(password));

  // 1. Detectar retorno do Link Mágico
  useEffect(() => {
    const handleEmailLink = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        setLoading(true);
        let emailForSignIn = window.localStorage.getItem('emailForSignIn');
        
        if (!emailForSignIn) {
          emailForSignIn = window.prompt('Confirme seu e-mail para continuar:');
        }

        if (emailForSignIn) {
          try {
            await signInWithEmailLink(auth, emailForSignIn, window.location.href);
            setEmail(emailForSignIn);
            setStep('password-setup');
          } catch (err) {
            setError('O link expirou ou é inválido.');
          } finally {
            setLoading(false);
          }
        }
      }
    };
    handleEmailLink();
  }, []);

  // 2. Verificar se usuário existe ou enviar link
  const handleEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail.endsWith('@jaboatao.pe.gov.br')) {
      setError('Utilize seu e-mail institucional.');
      setLoading(false);
      return;
    }

    try {
      // Verifica se o e-mail já possui métodos de login (ex: senha)
      const methods = await fetchSignInMethodsForEmail(auth, targetEmail);
      
      if (methods.length > 0) {
        // Usuário já cadastrado -> Ir para tela de senha
        setStep('login');
      } else {
        // Primeiro acesso -> Enviar link mágico
        const actionCodeSettings = {
          url: window.location.origin + '/login',
          handleCodeInApp: true,
        };
        await sendSignInLinkToEmail(auth, targetEmail, actionCodeSettings);
        window.localStorage.setItem('emailForSignIn', targetEmail);
        setStep('verification');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else {
        setError('Ocorreu um erro. Tente novamente mais tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Login convencional (E-mail + Senha)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      const displayName = user.displayName || email.split('@')[0];
      const adUser: ADUser = {
        uid: user.uid,
        displayName,
        email: user.email!,
        nome_completo: displayName,
        user: email.split('@')[0],
        isAD: false,
        department: 'Geral',
      };

      await syncUserToFirestore(adUser);
      setUser(adUser);
      router.push('/chat');
    } catch (err: any) {
      setError('Senha incorreta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet) return;
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await updatePassword(user, password);
        
        const displayName = user.displayName || email.split('@')[0];
        const adUser: ADUser = {
          uid: user.uid,
          displayName,
          email: user.email!,
          nome_completo: displayName,
          user: email.split('@')[0],
          isAD: false,
          department: 'Geral',
        };

        await syncUserToFirestore(adUser);
        setUser(adUser);
        router.push('/chat');
      }
    } catch (err) {
      setError('Erro ao definir senha. Tente novamente.');
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
          <p className="text-[10px] font-bold text-brand-green uppercase tracking-[0.3em] mt-1">Prefeitura do Jaboatão dos Guararapes</p>
        </div>

        <div className="bg-[var(--surface)] border-4 border-brand-blue p-8 shadow-brutal-xl shadow-brand-blue relative">
          
          {step === 'email' && (
            <form onSubmit={handleEmailCheck} className="space-y-6 animate-fade-in">
              <div className="absolute top-0 right-0 py-1 px-3 bg-brand-blue text-white font-display font-bold text-[10px] uppercase tracking-widest">Acesso</div>
              <div className="space-y-2">
                <label className="block font-display font-bold text-xs uppercase tracking-widest text-brand-blue-text/60">E-mail Institucional</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-blue/30" size={18} />
                  <input
                    type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full bg-[var(--bg)] border-2 border-brand-blue/20 p-4 pl-12 font-sans text-sm focus:border-brand-blue outline-none transition-all"
                    placeholder="seu e-mail"
                  />
                </div>
              </div>
              {error && <div className="bg-brand-red/5 border-l-4 border-brand-red p-4 text-brand-red text-xs font-semibold flex gap-2"><AlertCircle size={14}/>{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-brand-blue text-white py-5 font-display font-bold text-sm uppercase tracking-widest shadow-brutal-md shadow-brand-gold hover:shadow-none transition-all flex items-center justify-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <>Continuar <ArrowRight size={18}/></>}
              </button>
            </form>
          )}

          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6 animate-fade-in">
              <div className="absolute top-0 right-0 py-1 px-3 bg-brand-green text-white font-display font-bold text-[10px] uppercase tracking-widest">Bem-vindo de volta</div>
              <div className="space-y-2 text-center mb-4">
                <p className="text-xs font-bold text-brand-blue-text/40 uppercase tracking-widest">Login com e-mail:</p>
                <p className="text-sm font-bold text-brand-blue-text">{email}</p>
              </div>
              <div className="space-y-2">
                <label className="block font-display font-bold text-xs uppercase tracking-widest text-brand-blue-text/60">Sua Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-blue/30" size={18} />
                  <input
                    type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full bg-[var(--bg)] border-2 border-brand-blue/20 p-4 pl-12 font-sans text-sm focus:border-brand-blue outline-none transition-all"
                    placeholder="SUA SENHA"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-blue/40">{showPw ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                </div>
              </div>
              {error && <div className="bg-brand-red/5 border-l-4 border-brand-red p-4 text-brand-red text-xs font-semibold flex gap-2"><AlertCircle size={14}/>{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-brand-blue text-white py-5 font-display font-bold text-sm uppercase tracking-widest shadow-brutal-md shadow-brand-gold hover:shadow-none transition-all">
                {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Entrar'}
              </button>
              <button type="button" onClick={() => setStep('email')} className="w-full text-xs font-bold text-brand-blue/50 uppercase tracking-widest hover:text-brand-blue transition-colors">Usar outro e-mail</button>
            </form>
          )}

          {step === 'verification' && (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-16 h-16 bg-brand-gold/10 text-brand-gold rounded-full flex items-center justify-center mx-auto mb-6"><Mail size={32} /></div>
              <h2 className="font-display font-extrabold text-xl text-brand-blue-text mb-2">Primeiro Acesso</h2>
              <p className="text-sm text-brand-blue-text/60 mb-8">Identificamos que você ainda não tem uma senha. Enviamos um link para <strong>{email}</strong> para validar seu e-mail institucional.</p>
              <div className="bg-brand-blue/5 p-4 border-l-4 border-brand-blue mb-8">
                <p className="text-[11px] font-bold text-brand-blue tracking-tight leading-relaxed">Verifique sua caixa de entrada e clique no link para definir sua senha.</p>
              </div>
              <button onClick={() => setStep('email')} className="text-xs font-bold text-brand-blue underline uppercase tracking-widest">Voltar</button>
            </div>
          )}

          {step === 'password-setup' && (
            <form onSubmit={handleFinishSetup} className="space-y-6 animate-fade-in">
              <div className="absolute top-0 right-0 py-1 px-3 bg-brand-gold text-brand-blue-text font-display font-bold text-[10px] uppercase tracking-widest">Definir Senha</div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block font-display font-bold text-xs uppercase tracking-widest text-brand-blue-text/60">Nova Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-blue/30" size={18} />
                    <input
                      type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full bg-[var(--bg)] border-2 border-brand-blue/20 p-4 pl-12 font-sans text-sm focus:border-brand-blue outline-none transition-all"
                      placeholder="SUA SENHA"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-blue/40">{showPw ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                  </div>
                </div>

                <div className="bg-[var(--bg)] border-2 border-brand-blue/10 p-4 space-y-2">
                  <p className="text-[10px] font-bold text-brand-blue-text/40 uppercase tracking-widest mb-2">Requisitos da Senha:</p>
                  {requirements.map((req, i) => {
                    const met = req.test(password);
                    return (
                      <div key={i} className={`flex items-center gap-2 text-[11px] font-semibold transition-colors ${met ? 'text-brand-green' : 'text-brand-blue-text/30'}`}>
                        {met ? <Check size={14} /> : <X size={14} />}
                        {req.label}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <label className="block font-display font-bold text-xs uppercase tracking-widest text-brand-blue-text/60">Confirmar Senha</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full bg-[var(--bg)] border-2 border-brand-blue/20 p-4 font-sans text-sm focus:border-brand-blue outline-none transition-all"
                      placeholder="REPETIR SENHA"
                    />
                  </div>
                </div>
              </div>

              {error && <div className="bg-brand-red/5 border-l-4 border-brand-red p-4 text-brand-red text-xs font-semibold flex gap-2"><AlertCircle size={14}/>{error}</div>}
              
              <button type="submit" disabled={loading || !allMet} className="w-full bg-brand-blue text-white py-5 font-display font-bold text-sm uppercase tracking-widest shadow-brutal-md shadow-brand-gold hover:shadow-none disabled:opacity-30 transition-all">
                {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Salvar e Entrar'}
              </button>
            </form>
          )}

        </div>
      </div>
    </main>
  );
}
