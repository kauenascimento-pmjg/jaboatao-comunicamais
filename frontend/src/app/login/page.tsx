'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { 
  applyActionCode,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
  confirmPasswordReset,
  AuthError
} from 'firebase/auth';
import { auth, getAuthActionUrl } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Moon, Sun, Mail, ArrowRight, Loader2, Lock, Eye, EyeOff, Check, X } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { sendRecoveryLink } from '@/services/auth';

type Step = 'email' | 'login' | 'register' | 'verification' | 'forgot-password' | 'recovery-sent' | 'reset-password';

/**
 * Página de Login Simplificada
 * Usa APENAS Firebase Authentication (sem Firestore)
 * 
 * Fluxo:
 * 1. Cadastro com e-mail + senha
 * 2. Confirmação via link enviado por e-mail
 * 3. Login com e-mail + senha após confirmar e-mail
 * 4. Recuperação de senha
 */
function LoginContent() {
  const [step, setStep]         = useState<Step>('email');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [notice, setNotice]     = useState<string | null>(null);
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
   * Processar links de ação (confirmação de e-mail e redefinição de senha)
   */
  useEffect(() => {
    const processActionLinks = async () => {
      const mode = searchParams.get('mode');
      const code = searchParams.get('oobCode');

      if (mode === 'verifyEmail' && code) {
        console.log('[Auth] Processing email verification link');
        setLoading(true);
        setError(null);
        try {
          await applyActionCode(auth, code);
          const pendingEmail = window.localStorage.getItem('pendingVerificationEmail');
          if (pendingEmail) {
            setEmail(pendingEmail);
          }
          setNotice('✅ E-mail confirmado com sucesso! Faça login com sua senha.');
          setStep('login');
        } catch (err) {
          console.error('[Auth] Invalid verification code:', err);
          setError('❌ O link de confirmação expirou ou é inválido.');
          setStep('email');
        } finally {
          setLoading(false);
        }
        return;
      }

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
    };

    processActionLinks();
  }, [searchParams]);

  /**
   * Verificar e-mail institucional e seguir para login
   */
  const handleEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const targetEmail = email.trim().toLowerCase();
    
    // Validar domínio institucional
    if (!targetEmail.endsWith('@jaboatao.pe.gov.br')) {
      setError('⚠️ Utilize seu e-mail institucional (@jaboatao.pe.gov.br).');
      return;
    }

    setStep('login');
    setPassword('');
    setConfirmPassword('');
  };

  /**
   * Login padrão: email + senha (apenas Firebase Auth)
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const targetEmail = email.trim().toLowerCase();
    const actionUrl = getAuthActionUrl('/login');

    try {
      console.log('[Auth] Attempting login for:', targetEmail);
      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);

      if (!userCredential.user.emailVerified) {
        await sendEmailVerification(userCredential.user, {
          url: actionUrl,
          handleCodeInApp: true,
        });
        window.localStorage.setItem('pendingVerificationEmail', targetEmail);
        await signOut(auth);
        setStep('verification');
        setError('❌ E-mail ainda não confirmado. Enviamos um novo link de confirmação.');
        return;
      }
      
      console.log('[Auth] Login successful:', userCredential.user.uid);
      router.push('/chat');
    } catch (err) {
      const authError = err as AuthError;
      
      if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found') {
        setError('❌ E-mail ou senha inválidos.');
      } else if (authError.code === 'auth/too-many-requests') {
        setError('⏱️ Muitas tentativas de login. Tente novamente mais tarde.');
      } else if (authError.code === 'auth/unauthorized-continue-uri') {
        setError('❌ Domínio não autorizado para confirmação de e-mail. Contate o suporte.');
      } else if (authError.code === 'auth/invalid-continue-uri') {
        setError('❌ URL de confirmação inválida. Contate o suporte.');
      } else {
        setError('❌ Erro ao fazer login. Tente novamente.');
      }
      console.error('[Auth] Login error:', {
        code: authError.code,
        message: authError.message,
        actionUrl,
        err,
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cadastro com e-mail + senha e envio de confirmação
   */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordMeetsRequirements) {
      setError('❌ A senha não atende a todos os requisitos.');
      return;
    }

    if (password !== confirmPassword) {
      setError('❌ As senhas não coincidem.');
      return;
    }

    const targetEmail = email.trim().toLowerCase();
    const actionUrl = getAuthActionUrl('/login');

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, password);

      await sendEmailVerification(userCredential.user, {
        url: actionUrl,
        handleCodeInApp: true,
      });

      window.localStorage.setItem('pendingVerificationEmail', targetEmail);
      await signOut(auth);

      setPassword('');
      setConfirmPassword('');
      setStep('verification');
      setNotice('✅ Cadastro realizado! Enviamos o link de confirmação para seu e-mail.');
    } catch (err) {
      const authError = err as AuthError;

      if (authError.code === 'auth/email-already-in-use') {
        setError(null);
        setNotice('✅ Este e-mail já está cadastrado. Digite sua senha para entrar.');
        setPassword('');
        setConfirmPassword('');
        setStep('login');
      } else if (authError.code === 'auth/weak-password') {
        setError('❌ A senha é muito fraca. Use uma combinação mais segura.');
      } else if (authError.code === 'auth/unauthorized-continue-uri') {
        setError('❌ Domínio não autorizado para confirmação de e-mail. Contate o suporte.');
      } else if (authError.code === 'auth/invalid-continue-uri') {
        setError('❌ URL de confirmação inválida. Contate o suporte.');
      } else {
        setError('❌ Erro ao criar conta. Tente novamente.');
      }
      console.error('[Auth] Register error:', {
        code: authError.code,
        message: authError.message,
        actionUrl,
        err,
      });
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
    setNotice(null);

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
    setNotice(null);

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

      {notice && (
        <div className="bg-brand-green/5 border-l-4 border-brand-green p-4 text-brand-green text-xs font-semibold">
          <span>{notice}</span>
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

              {notice && (
                <div className="bg-brand-green/5 border-l-4 border-brand-green p-4 text-brand-green text-xs font-semibold">
                  <span>{notice}</span>
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

              {notice && (
                <div className="bg-brand-green/5 border-l-4 border-brand-green p-4 text-brand-green text-xs font-semibold">
                  <span>{notice}</span>
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
                onClick={() => { setStep('email'); setPassword(''); setError(null); setNotice(null); }} 
                className="w-full text-xs font-bold text-brand-blue/50 uppercase tracking-widest hover:text-brand-blue transition-colors"
              >
                Usar outro e-mail
              </button>

              <button
                type="button"
                onClick={() => { setStep('register'); setError(null); setNotice(null); setConfirmPassword(''); }}
                className="w-full text-xs font-bold text-brand-blue uppercase tracking-widest hover:underline"
              >
                Não tem cadastro? Criar conta
              </button>
            </form>
          )}

          {/* PASSO 3: Cadastro */}
          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-6 animate-fade-in">
              <div className="absolute top-0 right-0 py-1 px-3 bg-brand-gold text-brand-blue-text font-display font-bold text-[10px] uppercase tracking-widest">Criar Conta</div>

              <div className="space-y-2 text-center mb-4">
                <p className="text-xs font-bold text-brand-blue-text/40 uppercase tracking-widest">Cadastro para:</p>
                <p className="text-sm font-bold text-brand-blue-text">{email}</p>
              </div>

              <div className="space-y-2">
                <label className="block font-display font-bold text-xs uppercase tracking-widest text-brand-blue-text/60">Crie sua Senha</label>
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

              {error && (
                <div className="bg-brand-red/5 border-l-4 border-brand-red p-4 text-brand-red text-xs font-semibold flex gap-2">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              {notice && (
                <div className="bg-brand-green/5 border-l-4 border-brand-green p-4 text-brand-green text-xs font-semibold">
                  <span>{notice}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !passwordMeetsRequirements}
                className="w-full bg-brand-blue text-white py-5 font-display font-bold text-sm uppercase tracking-widest shadow-brutal-md shadow-brand-gold hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Cadastrar e Enviar Confirmação'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setPassword(''); setConfirmPassword(''); setError(null); setNotice(null); }}
                className="w-full text-xs font-bold text-brand-blue/50 uppercase tracking-widest hover:text-brand-blue transition-colors"
              >
                Voltar
              </button>
            </form>
          )}

          {/* PASSO 4: Verificação (Link Enviado) */}
          {step === 'verification' && (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-16 h-16 bg-brand-gold/10 text-brand-gold rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail size={32} />
              </div>
              <h2 className="font-display font-extrabold text-xl text-brand-blue-text mb-2">Confirme seu e-mail</h2>
              <p className="text-sm text-brand-blue-text/60 mb-8">
                Enviamos um link para <strong>{email}</strong>. Você precisa confirmar o e-mail antes de entrar.
              </p>
              <div className="bg-brand-blue/5 p-4 border-l-4 border-brand-blue mb-8">
                <p className="text-[11px] font-bold text-brand-blue tracking-tight leading-relaxed">
                  ✓ Abra o e-mail recebido<br/>
                  ✓ Clique no link de confirmação<br/>
                  ✓ Volte e faça login com e-mail e senha
                </p>
              </div>
              {error && (
                <div className="bg-brand-red/5 border-l-4 border-brand-red p-4 text-brand-red text-xs font-semibold mb-6">
                  <span>{error}</span>
                </div>
              )}
              {notice && (
                <div className="bg-brand-green/5 border-l-4 border-brand-green p-4 text-brand-green text-xs font-semibold mb-6">
                  <span>{notice}</span>
                </div>
              )}
              <button 
                onClick={() => { setStep('login'); setError(null); }} 
                className="w-full bg-brand-blue text-white py-5 font-display font-bold text-sm uppercase tracking-widest shadow-brutal-md shadow-brand-gold hover:shadow-none transition-all mb-3"
              >
                Já confirmei, ir para login
              </button>
              <button 
                onClick={() => { setStep('email'); setEmail(''); setPassword(''); setConfirmPassword(''); setError(null); setNotice(null); }} 
                className="text-xs font-bold text-brand-blue underline uppercase tracking-widest hover:no-underline"
              >
                Voltar
              </button>
            </div>
          )}

          {/* PASSO 5: Esqueci Minha Senha */}
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

              {notice && (
                <div className="bg-brand-green/5 border-l-4 border-brand-green p-4 text-brand-green text-xs font-semibold">
                  <span>{notice}</span>
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
                onClick={() => { setStep('login'); setPassword(''); setError(null); setNotice(null); }} 
                className="w-full text-xs font-bold text-brand-blue/50 uppercase tracking-widest hover:text-brand-blue transition-colors"
              >
                Voltar ao Login
              </button>
            </form>
          )}

          {/* PASSO 6: Link de Recuperação Enviado */}
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
                onClick={() => { setStep('login'); setPassword(''); setError(null); setNotice(null); }} 
                className="w-full bg-brand-blue text-white py-5 font-display font-bold text-sm uppercase tracking-widest shadow-brutal-md shadow-brand-gold hover:shadow-none transition-all"
              >
                Voltar ao Login
              </button>
            </div>
          )}

          {/* PASSO 7: Redefinir Senha */}
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
