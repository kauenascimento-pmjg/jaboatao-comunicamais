'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { 
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
  confirmPasswordReset,
  AuthError
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Moon, Sun, Mail, ArrowRight, Loader2, Lock, Eye, EyeOff, Check, X } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { checkUserHasPassword, sendRecoveryLink, sendFirstAccessLink } from '@/services/auth';

type Step = 'email' | 'login' | 'verification' | 'forgot-password' | 'recovery-sent' | 'reset-password';

/**
 * Página de Login Simplificada
 * Usa APENAS Firebase Authentication (sem Firestore)
 * 
 * Fluxo:
 * 1. Primeiro acesso: email → link mágico → login direto
 * 2. Login: email + senha → signInWithEmailAndPassword
 * 3. Recuperação: email → link → redefine senha
 */
function LoginContent() {
  const [step, setStep]         = useState<Step>('email');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [oobCode, setOobCode]   = useState<string | null>(null);
  
  const { theme, toggle }       = useTheme();
  const router                  = useRouter();
  const searchParams            = useSearchParams();

  useEffect(() => {
    auth.languageCode = 'pt-br';
  }, []);

  // Requisitos de senha forte
  const requirements = [
    { label: 'Mínimo 8 caracteres', test: (pw: string) => pw.length >= 8 },
    { label: 'Letra Maiúscula', test: (pw: string) => /[A-Z]/.test(pw) },
    { label: 'Letra Minúscula', test: (pw: string) => /[a-z]/.test(pw) },
    { label: 'Número', test: (pw: string) => /[0-9]/.test(pw) },
    { label: 'Caractere Especial (!@#$...)', test: (pw: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
  ];
  const passwordMeetsRequirements = requirements.every(r => r.test(password));

  /**
   * Processar links de ação (Redefinição de Senha ou Primeiro Acesso)
   */
  useEffect(() => {
    const processActionLinks = async () => {
      const mode = searchParams.get('mode');
      const code = searchParams.get('oobCode');

      // Fluxo de redefinição de senha
      if (mode === 'resetPassword' && code) {
        console.log('[Auth] Processing password reset link');
        setLoading(true);
        try {
          const resetEmail = await verifyPasswordResetCode(auth, code);
          setEmail(resetEmail);
          setOobCode(code);
          setStep('reset-password');
        } catch (err) {
          console.error('[Auth] Invalid reset code:', err);
          setError('O link de redefinição expirou ou é inválido.');
        } finally {
          setLoading(false);
        }
        return;
      }

      if (isSignInWithEmailLink(auth, window.location.href)) {
        console.log('[Auth] Processing first access sign-in link');
        setLoading(true);

        let emailForSignIn = window.localStorage.getItem('emailForSignIn');

        if (!emailForSignIn) {
          emailForSignIn = window.prompt('Confirme seu e-mail para continuar:') ?? '';
        }

        if (!emailForSignIn) {
          setError('Confirme seu e-mail para concluir o acesso.');
          setLoading(false);
          return;
        }

        try {
          await signInWithEmailLink(auth, emailForSignIn, window.location.href);
          window.localStorage.removeItem('emailForSignIn');
          router.push('/chat');
        } catch (err) {
          console.error('[Auth] Magic link error:', err);
          setError('O link expirou ou é inválido. Solicite um novo acesso.');
        } finally {
          setLoading(false);
        }
      }
    };

    processActionLinks();
  }, [searchParams]);

  /**
   * Verificar e-mail institucional e validar se usuário existe
   */
  const handleEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const targetEmail = email.trim().toLowerCase();
    
    // Validar domínio institucional
    if (!targetEmail.endsWith('@jaboatao.pe.gov.br')) {
      setError('⚠️ Utilize seu e-mail institucional (@jaboatao.pe.gov.br).');
      setLoading(false);
      return;
    }

    try {
      const userExists = await checkUserHasPassword(targetEmail);

      if (userExists) {
        setStep('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        console.log('[Auth] No account found, sending first access link');
        const actionUrl = window.location.origin + '/login';
        await sendFirstAccessLink(targetEmail, actionUrl);
        setStep('verification');
      }
    } catch (err) {
      console.error('[Auth] Error checking user:', err);
      setError('❌ Erro ao verificar e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Login padrão: email + senha (apenas Firebase Auth)
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const targetEmail = email.trim().toLowerCase();

    try {
      console.log('[Auth] Attempting login for:', targetEmail);
      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
      
      console.log('[Auth] Login successful:', userCredential.user.uid);
      // O AuthProvider já cuida de atualizar o store automaticamente
      // Apenas redirecionar
      router.push('/chat');
    } catch (err) {
      const authError = err as AuthError;
      
      if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found') {
        setError('❌ E-mail ou senha inválidos.');
      } else if (authError.code === 'auth/too-many-requests') {
        setError('⏱️ Muitas tentativas de login. Tente novamente mais tarde.');
      } else {
        setError('❌ Erro ao fazer login. Tente novamente.');
      }
      console.error('[Auth] Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Solicitar link de recuperação de senha
   */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('[Auth] Sending password reset link to:', email);
      await sendRecoveryLink(email);
      setStep('recovery-sent');
    } catch (err) {
      const authError = err as AuthError;
      
      if (authError.code === 'auth/user-not-found') {
        // Não revelar se o usuário existe ou não (segurança)
        setStep('recovery-sent');
      } else {
        setError('❌ Erro ao enviar e-mail de recuperação. Tente novamente.');
        console.error('[Auth] Forgot password error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Redefinir senha (recuperação)
   */
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordMeetsRequirements) {
      setError('❌ A senha não atende a todos os requisitos.');
      return;
    }

    if (password !== confirmPassword) {
      setError('❌ As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (step === 'reset-password' && oobCode) {
        console.log('[Auth] Confirming password reset for:', email);
        await confirmPasswordReset(auth, oobCode, password);
        
        try {
          await signInWithEmailAndPassword(auth, email, password);
          console.log('[Auth] Auto-login after password reset successful');
          router.push('/chat');
          return;
        } catch (loginErr) {
          console.log('[Auth] Auto-login failed, redirecting to login form', loginErr);
          setStep('login');
          setPassword('');
          setConfirmPassword('');
          setError('Senha redefinida com sucesso! Faça login com sua nova senha.');
        }
      }
    } catch (err) {
      const authError = err as AuthError;
      
      if (authError.code === 'auth/weak-password') {
        setError('❌ A senha é muito fraca. Use uma combinação segura.');
      } else if (authError.code === 'auth/requires-recent-login') {
        setError('❌ Sua sessão expirou. Tente novamente.');
      } else {
        setError('❌ Erro ao salvar senha. Tente novamente.');
      }
      console.error('[Auth] Password submission error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Componente Reutilizável: Formulário de Senha
   */
  const PasswordForm = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <form onSubmit={handlePasswordSubmit} className="space-y-6 animate-fade-in">
      <div className="absolute top-0 right-0 py-1 px-3 bg-brand-gold text-brand-blue-text font-display font-bold text-[10px] uppercase tracking-widest">{title}</div>
      {subtitle && <p className="text-xs font-bold text-brand-blue-text/60">{subtitle}</p>}
      
      <div className="space-y-4">
        {/* Nova Senha */}
        <div className="space-y-2">
          <label className="block font-display font-bold text-xs uppercase tracking-widest text-brand-blue-text/60">Nova Senha</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-blue/30" size={18} />
            <input 
              type={showPw ? 'text' : 'password'} 
              required 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[var(--bg)] border-2 border-brand-blue/20 p-4 pl-12 font-sans text-sm focus:border-brand-blue outline-none transition-all"
              placeholder="SUA SENHA" 
            />
            <button 
              type="button" 
              onClick={() => setShowPw(!showPw)} 
              className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-blue/40 hover:text-brand-blue"
            >
              {showPw ? <EyeOff size={18}/> : <Eye size={18}/>}
            </button>
          </div>
        </div>

        {/* Checklist de Requisitos */}
        <div className="bg-[var(--bg)] border-2 border-brand-blue/10 p-4 space-y-2">
          <p className="text-[10px] font-bold text-brand-blue-text/40 uppercase tracking-widest mb-2">Requisitos da Senha:</p>
          {requirements.map((req, i) => {
            const met = req.test(password);
            return (
              <div key={i} className={`flex items-center gap-2 text-[11px] font-semibold transition-colors ${met ? 'text-brand-green' : 'text-brand-blue-text/30'}`}>
                {met ? <Check size={14} /> : <X size={14} />} {req.label}
              </div>
            );
          })}
        </div>

        {/* Confirmar Senha */}
        <div className="space-y-2">
          <label className="block font-display font-bold text-xs uppercase tracking-widest text-brand-blue-text/60">Confirmar Senha</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-blue/30" size={18} />
            <input 
              type={showPw ? 'text' : 'password'} 
              required 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-[var(--bg)] border-2 border-brand-blue/20 p-4 pl-12 font-sans text-sm focus:border-brand-blue outline-none transition-all"
              placeholder="REPETIR SENHA" 
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-brand-red/5 border-l-4 border-brand-red p-4 text-brand-red text-xs font-semibold flex gap-2">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>
          <span>{error}</span>
        </div>
      )}

      <button 
        type="submit" 
        disabled={loading || !passwordMeetsRequirements} 
        className="w-full bg-brand-blue text-white py-5 font-display font-bold text-sm uppercase tracking-widest shadow-brutal-md shadow-brand-gold hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Salvar e Entrar'}
      </button>
    </form>
  );

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center p-4">
      {/* Barras decorativas */}
      <div className="fixed top-0 left-0 w-full h-1.5 bg-brand-gold z-50" />
      <div className="fixed top-[1.5px] left-0 w-full h-1.5 bg-brand-green z-50" />

      {/* Botão tema */}
      <button 
        onClick={toggle} 
        className="fixed top-8 right-8 p-3 bg-[var(--surface)] border-2 border-brand-blue text-brand-blue shadow-brutal-sm shadow-brand-blue hover:shadow-none transition-all"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      
      <div className="w-full max-w-md animate-fade-up">
        {/* Header */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 bg-brand-blue flex items-center justify-center shadow-brutal-md shadow-brand-gold mb-6">
            <span className="font-display font-extrabold text-white text-3xl">C+</span>
          </div>
          <h1 className="font-display font-extrabold text-3xl text-brand-blue-text tracking-tighter uppercase">
            COMUNICA<span className="text-brand-gold">+</span>
          </h1>
          <p className="text-[10px] font-bold text-brand-green uppercase tracking-[0.3em] mt-1">Prefeitura do Jaboatão dos Guararapes</p>
        </div>

        {/* Card Principal */}
        <div className="bg-[var(--surface)] border-4 border-brand-blue p-8 shadow-brutal-xl shadow-brand-blue relative">
          
          {/* PASSO 1: Entrada de E-mail */}
          {step === 'email' && (
            <form onSubmit={handleEmailCheck} className="space-y-6 animate-fade-in">
              <div className="absolute top-0 right-0 py-1 px-3 bg-brand-blue text-white font-display font-bold text-[10px] uppercase tracking-widest">Acesso</div>
              
              <div className="space-y-2">
                <label className="block font-display font-bold text-xs uppercase tracking-widest text-brand-blue-text/60">E-mail Institucional</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-blue/30" size={18} />
                  <input 
                    type="email" 
                    required 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-[var(--bg)] border-2 border-brand-blue/20 p-4 pl-12 font-sans text-sm focus:border-brand-blue outline-none transition-all"
                    placeholder="seu@email.com" 
                  />
                </div>
              </div>

              {error && (
                <div className="bg-brand-red/5 border-l-4 border-brand-red p-4 text-brand-red text-xs font-semibold flex gap-2">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-brand-blue text-white py-5 font-display font-bold text-sm uppercase tracking-widest shadow-brutal-md shadow-brand-gold hover:shadow-none disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <>Continuar <ArrowRight size={18}/></>}
              </button>
            </form>
          )}

          {/* PASSO 2: Login Normal */}
          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6 animate-fade-in">
              <div className="absolute top-0 right-0 py-1 px-3 bg-brand-green text-white font-display font-bold text-[10px] uppercase tracking-widest">Bem-vindo de volta</div>
              
              <div className="space-y-2 text-center mb-4">
                <p className="text-xs font-bold text-brand-blue-text/40 uppercase tracking-widest">Acessando como:</p>
                <p className="text-sm font-bold text-brand-blue-text">{email}</p>
              </div>

              <div className="space-y-2">
                <label className="block font-display font-bold text-xs uppercase tracking-widest text-brand-blue-text/60">Sua Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-blue/30" size={18} />
                  <input 
                    type={showPw ? 'text' : 'password'} 
                    required 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-[var(--bg)] border-2 border-brand-blue/20 p-4 pl-12 font-sans text-sm focus:border-brand-blue outline-none transition-all"
                    placeholder="SUA SENHA" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPw(!showPw)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-blue/40 hover:text-brand-blue"
                  >
                    {showPw ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>

                <div className="flex justify-end mt-2">
                  <button 
                    type="button" 
                    onClick={() => setStep('forgot-password')} 
                    className="text-[10px] font-bold text-brand-blue uppercase tracking-widest hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-brand-red/5 border-l-4 border-brand-red p-4 text-brand-red text-xs font-semibold flex gap-2">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-brand-blue text-white py-5 font-display font-bold text-sm uppercase tracking-widest shadow-brutal-md shadow-brand-gold hover:shadow-none disabled:opacity-50 transition-all"
              >
                {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Entrar'}
              </button>

              <button 
                type="button" 
                onClick={() => { setStep('email'); setPassword(''); setError(null); }} 
                className="w-full text-xs font-bold text-brand-blue/50 uppercase tracking-widest hover:text-brand-blue transition-colors"
              >
                Usar outro e-mail
              </button>
            </form>
          )}

          {/* PASSO 3: Verificação (Link Enviado) */}
          {step === 'verification' && (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-16 h-16 bg-brand-gold/10 text-brand-gold rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail size={32} />
              </div>
              <h2 className="font-display font-extrabold text-xl text-brand-blue-text mb-2">Primeiro acesso</h2>
              <p className="text-sm text-brand-blue-text/60 mb-8">
                Enviamos um link para <strong>{email}</strong> para entrar direto, sem criar senha agora.
              </p>
              <div className="bg-brand-blue/5 p-4 border-l-4 border-brand-blue mb-8">
                <p className="text-[11px] font-bold text-brand-blue tracking-tight leading-relaxed">
                  ✓ Abra o e-mail recebido<br/>
                  ✓ Clique no link de acesso<br/>
                  ✓ Você será redirecionado automaticamente
                </p>
              </div>
              <button 
                onClick={() => { setStep('email'); setEmail(''); setError(null); }} 
                className="text-xs font-bold text-brand-blue underline uppercase tracking-widest hover:no-underline"
              >
                Voltar
              </button>
            </div>
          )}

          {/* PASSO 4: Esqueci Minha Senha */}
          {step === 'forgot-password' && (
            <form onSubmit={handleForgotPassword} className="space-y-6 animate-fade-in">
              <div className="absolute top-0 right-0 py-1 px-3 bg-brand-red text-white font-display font-bold text-[10px] uppercase tracking-widest">Recuperação</div>
              
              <div className="text-center mb-6">
                <p className="text-sm text-brand-blue-text/60">
                  Iremos enviar um link de redefinição de senha para seu e-mail institucional.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block font-display font-bold text-xs uppercase tracking-widest text-brand-blue-text/60">E-mail Institucional</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-blue/30" size={18} />
                  <input 
                    type="email" 
                    required 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-[var(--bg)] border-2 border-brand-blue/20 p-4 pl-12 font-sans text-sm focus:border-brand-blue outline-none transition-all"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-brand-red/5 border-l-4 border-brand-red p-4 text-brand-red text-xs font-semibold flex gap-2">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-brand-blue text-white py-5 font-display font-bold text-sm uppercase tracking-widest shadow-brutal-md shadow-brand-gold hover:shadow-none disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <>Enviar Link <ArrowRight size={18}/></>}
              </button>

              <button 
                type="button" 
                onClick={() => { setStep('login'); setPassword(''); setError(null); }} 
                className="w-full text-xs font-bold text-brand-blue/50 uppercase tracking-widest hover:text-brand-blue transition-colors"
              >
                Voltar ao Login
              </button>
            </form>
          )}

          {/* PASSO 5: Link de Recuperação Enviado */}
          {step === 'recovery-sent' && (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-16 h-16 bg-brand-green/10 text-brand-green rounded-full flex items-center justify-center mx-auto mb-6">
                <Check size={32} />
              </div>
              <h2 className="font-display font-extrabold text-xl text-brand-blue-text mb-2">E-mail Enviado!</h2>
              <p className="text-sm text-brand-blue-text/60 mb-8">
                Verifique a caixa de entrada do e-mail <strong>{email}</strong> e clique no link para redefinir sua senha.
              </p>
              <button 
                onClick={() => { setStep('login'); setPassword(''); setError(null); }} 
                className="w-full bg-brand-blue text-white py-5 font-display font-bold text-sm uppercase tracking-widest shadow-brutal-md shadow-brand-gold hover:shadow-none transition-all"
              >
                Voltar ao Login
              </button>
            </div>
          )}

          {/* PASSO 5: Redefinir Senha */}
          {step === 'reset-password' && (
            <PasswordForm 
              title="Nova Senha" 
              subtitle={`Redefinindo senha para ${email}`} 
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)]" />}>
      <LoginContent />
    </Suspense>
  );
}
