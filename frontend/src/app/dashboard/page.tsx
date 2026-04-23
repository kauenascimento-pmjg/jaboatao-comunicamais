'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, Hash, MessageCircle, Users, Search, 
  X, ChevronRight, Menu, Sun, Moon, LogOut 
} from 'lucide-react';
import { useAuthStore } from '@/lib/authStore';
import { useTheme } from '@/components/providers/ThemeProvider';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import {
  getChannels, subscribeToMessages, sendMessage,
  getAllUsers, getOrCreateDm, subscribeToDmMessages, sendDmMessage,
  seedDefaultChannels,
  Channel, Message, UserProfile,
} from '@/lib/chatService';

type ActiveView = { type: 'channel'; id: string; name: string } | { type: 'dm'; id: string; name: string; otherUid: string };

export default function ChatDashboard() {
  const { user, setUser } = useAuthStore();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  
  const [channels, setChannels] = useState<Channel[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sidePanel, setSidePanel] = useState<'channels' | 'directory'>('channels');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load channels and users
  useEffect(() => {
    const loadData = async () => {
      // Seed default channels if Firestore is empty (first time)
      await seedDefaultChannels();
      
      const data = await getChannels();
      setChannels(data);
      if (data.length > 0 && !activeView) {
        setActiveView({ type: 'channel', id: data[0].id, name: data[0].name });
      }
      
      const usersList = await getAllUsers();
      setUsers(usersList);
    };
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to messages
  useEffect(() => {
    if (!activeView) return;
    setMessages([]);
    let unsubscribe: () => void;

    if (activeView.type === 'channel') {
      unsubscribe = subscribeToMessages(activeView.id, (msgs) => {
        setMessages(msgs);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
    } else {
      unsubscribe = subscribeToDmMessages(activeView.id, (msgs) => {
        setMessages(msgs);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
    }

    return () => unsubscribe?.();
  }, [activeView]);

  const openDm = useCallback(async (otherUser: UserProfile) => {
    if (!user) return;
    const dmId = await getOrCreateDm(user.uid, otherUser.uid);
    setActiveView({ type: 'dm', id: dmId, name: otherUser.displayName, otherUid: otherUser.uid });
    setIsMobileMenuOpen(false);
    inputRef.current?.focus();
  }, [user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeView || !user) return;
    const text = newMessage;
    setNewMessage('');
    const senderName = user.displayName || user.email?.split('@')[0] || 'Servidor';

    try {
      if (activeView.type === 'channel') {
        await sendMessage(activeView.id, text, senderName, user.uid);
      } else {
        await sendDmMessage(activeView.id, text, senderName, user.uid);
      }
    } catch (err) {
      console.error('Send error:', err);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null); // Limpa o estado persistente do Zustand
    router.push('/');
  };

  const initials = (user?.displayName || user?.email || 'U')[0].toUpperCase();
  const otherUsers = users.filter(u => u.uid !== user?.uid);
  const filteredUsers = otherUsers.filter(u =>
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--bg)] overflow-hidden relative">
      
      {/* Header Topo Jaboatão (Responsive) */}
      <header className="h-16 border-b-2 border-brand-blue/10 bg-[var(--surface)] flex items-center justify-between px-4 lg:px-6 shrink-0 z-40">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-brand-blue-text hover:bg-brand-blue/5 transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="w-8 h-8 bg-brand-blue flex items-center justify-center shadow-brutal-sm shadow-brand-gold">
            <span className="font-display font-extrabold text-white text-sm tracking-tighter">C+</span>
          </div>
          <div className="hidden sm:block">
             <h2 className="font-display font-extrabold text-brand-blue-text text-base leading-none">
               COMUNICA<span className="text-brand-gold">+</span>
             </h2>
             <span className="text-[8px] font-bold text-brand-green uppercase tracking-widest text-brand-blue-text/60">Prefeitura do Jaboatão</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={toggle} className="p-2 text-brand-blue-text/60 hover:text-brand-blue-text transition-colors">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <div className="h-8 w-px bg-brand-blue/10 mx-1 hidden sm:block" />
          
          <div className="flex items-center gap-3 pl-2">
            <div className="w-8 h-8 bg-brand-green flex items-center justify-center text-white font-display font-bold text-xs ring-2 ring-brand-blue/5">
              {initials}
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-bold text-brand-blue-text truncate max-w-[120px]">
                {user?.displayName || 'Carregando...'}
              </p>
              <button 
                onClick={logout}
                className="text-[9px] font-bold text-brand-red uppercase tracking-widest flex items-center gap-1 hover:underline"
              >
                <LogOut size={10} /> Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar (Mobile Overlay + Desktop Static) */}
        <aside className={`
          fixed inset-0 lg:relative lg:inset-auto z-50 lg:z-0
          lg:flex flex-col w-72 h-full bg-[var(--surface)] border-r-2 border-brand-blue/10
          transition-transform duration-300 transform
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* Mobile Overlay Header */}
          <div className="lg:hidden flex items-center justify-between p-4 border-b-2 border-brand-blue/5">
            <span className="font-display font-extrabold text-brand-blue-text uppercase text-xs">Menu de Navegação</span>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-brand-blue-text/40">
              <X size={18} />
            </button>
          </div>

          {/* Toggle Tab */}
          <div className="grid grid-cols-2 border-b-2 border-brand-blue/10">
            <button
              onClick={() => setSidePanel('channels')}
              className={`py-4 font-display font-bold text-[10px] uppercase tracking-[0.2em] transition-colors flex flex-col items-center gap-1 ${
                sidePanel === 'channels' ? 'bg-brand-blue text-white shadow-inner shadow-brand-gold/30' : 'text-brand-blue-text/40 hover:bg-brand-blue/5'
              }`}
            >
              <Hash size={14} /> Canais
            </button>
            <button
              onClick={() => setSidePanel('directory')}
              className={`py-4 font-display font-bold text-[10px] uppercase tracking-[0.2em] transition-colors flex flex-col items-center gap-1 ${
                sidePanel === 'directory' ? 'bg-brand-blue text-white shadow-inner shadow-brand-gold/30' : 'text-brand-blue-text/40 hover:bg-brand-blue/5'
              }`}
            >
              <Users size={14} /> Servidores
            </button>
          </div>

          {/* Buscador */}
          <div className="p-4 bg-[var(--bg)]/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-blue/30" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={sidePanel === 'channels' ? 'Buscar canal...' : 'Buscar servidor...'}
                className="w-full bg-[var(--surface)] border-2 border-brand-blue/10 pl-9 pr-3 py-2 text-xs font-sans focus:border-brand-blue outline-none transition-all"
              />
            </div>
          </div>

          {/* Lista Rolável */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scroll">
            {sidePanel === 'channels' ? (
              channels.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(channel => (
                <button
                  key={channel.id}
                  onClick={() => { setActiveView({ type: 'channel', id: channel.id, name: channel.name }); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-l-4 ${
                    activeView?.type === 'channel' && activeView.id === channel.id
                      ? 'bg-brand-blue/5 border-brand-blue text-brand-blue-text font-bold shadow-sm'
                      : 'border-transparent text-brand-blue-text/60 hover:bg-brand-blue/5 hover:border-brand-blue/20'
                  }`}
                >
                  <Hash size={14} className="opacity-60" />
                  <span className="text-xs font-bold uppercase tracking-wider truncate">{channel.name}</span>
                </button>
              ))
            ) : (
              filteredUsers.map(u => (
                <button
                  key={u.uid}
                  onClick={() => openDm(u)}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-all border-l-4 ${
                    activeView?.type === 'dm' && activeView.otherUid === u.uid
                      ? 'bg-brand-blue/5 border-brand-blue text-brand-blue-text font-bold shadow-sm'
                      : 'border-transparent text-brand-blue-text/60 hover:bg-brand-blue/5 hover:border-brand-blue/20'
                  }`}
                >
                  <div className="w-8 h-8 bg-brand-gold/20 flex items-center justify-center text-brand-blue-text font-display font-bold text-[10px]">
                    {(u.displayName || u.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{u.displayName || u.email}</p>
                    <p className="text-[10px] opacity-60 uppercase font-bold tracking-tighter">{u.department || 'Servidor'}</p>
                  </div>
                  <ChevronRight size={12} className="opacity-40" />
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Backdrop for Mobile */}
        {isMobileMenuOpen && (
           <div 
             onClick={() => setIsMobileMenuOpen(false)}
             className="lg:hidden fixed inset-0 bg-brand-blue/40 backdrop-blur-sm z-40" 
           />
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface)] z-0">
          
          {/* Título do Chat (Mobile Friendly) */}
          <div className="h-14 border-b border-brand-blue/5 flex items-center gap-3 px-6 shrink-0 bg-[var(--surface)]">
            <div className={`p-1.5 ${activeView?.type === 'channel' ? 'bg-brand-blue' : 'bg-brand-gold'}`}>
              {activeView?.type === 'channel' ? <Hash size={14} className="text-white" /> : <MessageCircle size={14} className="text-brand-blue" />}
            </div>
            <h3 className="font-display font-extrabold text-brand-blue-text text-sm uppercase tracking-widest truncate">
              {activeView?.name || 'Selecione uma conversa'}
            </h3>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 custom-scroll">
            {messages.length === 0 && activeView && (
              <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-20">
                <MessageCircle size={64} className="text-brand-blue mb-4" />
                <p className="font-display font-bold uppercase tracking-[0.2em] text-xs">Comece a conversa em {activeView.name}</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMine = msg.senderId === user?.uid;
              const time = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              
              return (
                <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[90%] lg:max-w-[70%] ${isMine ? 'ml-auto' : 'mr-auto'}`}>
                  {!isMine && (
                    <span className="text-[10px] font-bold text-brand-green uppercase tracking-widest mb-1 ml-1">{msg.senderName}</span>
                  )}
                  <div className={`
                    p-4 shadow-brutal-sm transition-all
                    ${isMine 
                      ? 'bg-brand-blue text-white shadow-brand-gold' 
                      : 'bg-[var(--bg)] border-2 border-brand-blue/20 text-brand-blue-text shadow-brand-blue/5'}
                  `}>
                    <p className="font-sans text-sm leading-relaxed">{msg.text}</p>
                  </div>
                  <span className="text-[8px] font-bold text-brand-blue/30 uppercase mt-1.5 px-1">{time}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Campo de Entrada */}
          <div className="p-4 border-t-2 border-brand-blue/10 bg-[var(--surface)]">
            <form onSubmit={handleSend} className="flex gap-2 max-w-5xl mx-auto">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Escreva sua mensagem oficial..."
                className="flex-1 bg-[var(--bg)] border-2 border-brand-blue/10 p-4 font-sans text-sm focus:border-brand-blue outline-none transition-all shadow-inner"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-brand-blue text-white w-14 lg:w-20 flex items-center justify-center shadow-brutal-sm shadow-brand-gold hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 disabled:opacity-30 transition-all"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
