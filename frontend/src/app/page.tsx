'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Moon, Sun } from 'lucide-react';
import { useAuthStore } from '@/lib/authStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { theme, toggle } = useTheme();
  const { user } = useAuthStore();
  const router = useRouter();

  // Redirecionar para o dashboard se já estiver logado (evita ficar preso na home em produção)
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col relative overflow-hidden">
      
      {/* Faixa de destaque Jaboatão (Gold) */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-gold z-50" />
      
      {/* Fundo Geométrico Oficial */}
      <div className="absolute top-0 right-0 w-full lg:w-1/2 h-full bg-brand-blue/5 -skew-x-6 translate-x-12 z-0" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 lg:px-20 py-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-brand-blue flex items-center justify-center shadow-brutal-sm shadow-brand-gold">
            <span className="font-display font-extrabold text-white text-xl">C+</span>
          </div>
          <div className="flex flex-col">
            <h1 className="font-display font-extrabold text-xl lg:text-2xl text-brand-blue-text leading-none tracking-tighter">
              COMUNICA<span className="text-brand-gold">+</span>
            </h1>
            <span className="text-[10px] uppercase tracking-widest font-bold text-brand-green">Jaboatão dos Guararapes</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={toggle}
            className="p-3 bg-[var(--surface)] border-2 border-brand-blue shadow-brutal-sm shadow-brand-gold hover:shadow-none transition-all"
            aria-label="Alternar Tema"
          >
            {theme === 'light' ? <Moon size={18} className="text-brand-blue-text" /> : <Sun size={18} className="text-brand-gold" />}
          </button>
          
          <Link 
            href="/login" 
            className="bg-brand-blue text-white font-display font-bold text-xs uppercase tracking-widest px-6 py-3 shadow-brutal-sm shadow-brand-gold hover:shadow-none translate-y-[-2px] hover:translate-y-0 transition-all"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 lg:px-20 py-12 lg:py-20 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="space-y-10 text-center lg:text-left animate-slide-up">
            <div className="inline-block border-l-4 border-brand-green pl-4 bg-brand-green/5 py-2 pr-6">
              <p className="text-brand-green font-display font-bold text-xs uppercase tracking-widest">
                Sistema Oficial de Comunicação Interna
              </p>
            </div>

            <h2 className="font-display text-5xl md:text-7xl lg:text-8xl font-extrabold text-brand-blue-text leading-[0.9] tracking-tighter">
              A FORÇA DA NOSSA<br />
              <span className="bg-brand-gold text-brand-blue-text inline-block px-4">GENTE.</span>
            </h2>

            <p className="font-sans text-base lg:text-xl text-[var(--muted)] max-w-xl leading-relaxed">
              Plataforma segura para servidores municipais. Mensagens em tempo real, 
              canais oficiais e integração total com as secretarias de Jaboatão.
            </p>

            <div className="flex flex-col sm:flex-row gap-5 justify-center lg:justify-start">
              <Link
                href="/login"
                className="bg-brand-blue text-white px-10 py-5 font-display font-bold text-sm uppercase tracking-widest shadow-brutal-md shadow-brand-green hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
              >
                Acessar Portal
              </Link>
              <a 
                href="https://jaboatao.pe.gov.br" 
                target="_blank" 
                rel="noopener noreferrer"
                className="border-4 border-brand-blue text-brand-blue-text px-10 py-5 font-display font-bold text-sm uppercase tracking-widest hover:bg-brand-blue/5 transition-all flex items-center justify-center"
              >
                Conhecer Projeto
              </a>
            </div>

            {/* Tags representativas */}
            <div className="flex flex-wrap gap-4 pt-4 justify-center lg:justify-start">
              {['Tempo Real', 'Segurança', 'Oficial', 'Jaboatão'].map(tag => (
                <span key={tag} className="text-[10px] uppercase tracking-widest font-bold border border-brand-blue/20 px-3 py-1 text-brand-blue-text/60">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Visual Element / Mockup */}
          <div className="relative hidden lg:block">
            <div className="w-full aspect-square bg-brand-gold rounded-full absolute -top-10 -right-10 opacity-20 blur-3xl" />
            
            <div className="relative z-10 bg-[var(--surface)] border-4 border-brand-blue p-8 shadow-brutal-xl shadow-brand-blue">
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-brand-blue rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 bg-brand-blue/10 w-1/2" />
                    <div className="h-2 bg-brand-blue/5 w-1/3" />
                  </div>
               </div>
               
               <div className="space-y-6">
                 <div className="bg-brand-blue text-white p-4 ml-12">
                   <p className="text-sm font-sans">Bom dia, equipe! O relatório da Secretaria de Saúde já está disponível no canal oficial.</p>
                 </div>
                 <div className="bg-brand-gold/10 border-2 border-brand-gold p-4 mr-12">
                    <p className="text-sm font-sans text-brand-blue-text font-semibold">Recebido! Vamos analisar agora mesmo. #ComunicaJaboatão</p>
                 </div>
               </div>

               <div className="mt-12 flex gap-3">
                  <div className="flex-1 h-12 border-2 border-brand-blue/20" />
                  <div className="w-12 h-12 bg-brand-blue" />
               </div>
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border-color)] px-6 lg:px-20 py-8 bg-[var(--surface)]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-6 h-6 bg-brand-green" />
            <p className="text-xs font-bold text-brand-blue-text uppercase tracking-widest">
              © {new Date().getFullYear()} Prefeitura do Jaboatão dos Guararapes
            </p>
          </div>
          <p className="text-[10px] text-[var(--muted)] text-center md:text-right uppercase tracking-[0.2em]">
            Desenvolvimento: Secretaria de Tecnologia e Inovação
          </p>
        </div>
      </footer>
    </main>
  );
}
