'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, Hash, MessageCircle, Users, Search, 
  X, ChevronRight, Menu, Sun, Moon, LogOut,
  Paperclip, Image as ImageIcon, FileText, Smile, Trash2, Check, CheckCheck, MoreVertical, Pencil, Plus
} from 'lucide-react';
import { useAuthStore } from '@/lib/authStore';
import { useTheme } from '@/components/providers/ThemeProvider';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
// Chat functionality for Communica+ Jaboatão
import {
  getChannels, subscribeToMessages, sendMessage,
  getOrCreateDm, subscribeToDmMessages, sendDmMessage,
  uploadFile,
  deleteChannelMessage, deleteDmMessage, updateChannelMessage, updateDmMessage, setTypingStatus, setChannelTypingStatus, subscribeToTypingStatus, subscribeToChannelTypingStatus, updateDmMessagesStatus, subscribeToUsers, setUserPresence,
  createChannel, updateChannel, deleteChannel, clearAllChannels,
  Channel, Message, UserProfile,
} from '@/lib/chatService';

type ActiveView = { type: 'channel'; id: string; name: string } | { type: 'dm'; id: string; name: string; otherUid: string };

export default function ChatPage() {
  const { user, setUser } = useAuthStore();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  
  const [channels, setChannels] = useState<Channel[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [channelNameInput, setChannelNameInput] = useState('');
  const [channelDescriptionInput, setChannelDescriptionInput] = useState('');
  const [openChannelMenuId, setOpenChannelMenuId] = useState<string | null>(null);
  const [pendingDeleteChannel, setPendingDeleteChannel] = useState<Channel | null>(null);
  const [isClearChannelsConfirmOpen, setIsClearChannelsConfirmOpen] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editingText, setEditingText] = useState('');
  const [pendingFileToSend, setPendingFileToSend] = useState<File | null>(null);
  const [chatNotice, setChatNotice] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [sidePanel, setSidePanel] = useState<'channels' | 'directory'>('channels');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const PRESENCE_STALE_MS = 45000;
  const MESSAGE_EDIT_DELETE_WINDOW_MS = 10 * 60 * 1000;
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

  const updatePresence = useCallback((isOnline: boolean) => {
    if (!user?.uid) return Promise.resolve();
    return setUserPresence(user.uid, isOnline, {
      displayName: user.displayName,
      email: user.email,
    }).catch(() => undefined);
  }, [user?.uid, user?.displayName, user?.email]);

  // Load channels and users
  useEffect(() => {
    if (!user) return; // Espera o usuário estar logado

    const loadData = async () => {
      try {
        const data = await getChannels();
        setChannels(data);
      } catch (err) {
        console.error('Falha ao carregar canais:', err);
      }
    };
    loadData();
  }, [user]); // Re-executa quando o usuário mudar (login/logout)

  useEffect(() => {
    if (channels.length === 0) {
      if (activeView?.type === 'channel') setActiveView(null);
      return;
    }

    if (!activeView) {
      setActiveView({ type: 'channel', id: channels[0].id, name: channels[0].name });
      return;
    }

    if (activeView.type === 'channel') {
      const stillExists = channels.some((channel) => channel.id === activeView.id);
      if (!stillExists) {
        setActiveView({ type: 'channel', id: channels[0].id, name: channels[0].name });
      }
    }
  }, [channels, activeView]);

  useEffect(() => {
    if (!user) return; // Guard

    const unsubscribe = subscribeToUsers((usersList) => {
      setUsers(usersList);
    });

    return () => unsubscribe?.();
  }, [user]);

  useEffect(() => {
    if (!user?.uid) return;

    updatePresence(true);

    const heartbeat = setInterval(() => {
      updatePresence(true);
    }, 30000);

    const handleVisibility = () => {
      updatePresence(!document.hidden);
    };

    const handleBeforeUnload = () => {
      updatePresence(false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updatePresence(false);
    };
  }, [updatePresence, user?.uid]);

  // Subscribe to messages and typing state for DMs
  useEffect(() => {
    if (!activeView) return;
    setMessages([]);
    setTypingUsers([]);
    let unsubscribe: () => void;
    let unsubscribeTyping: (() => void) | undefined;

    if (activeView.type === 'channel') {
      unsubscribe = subscribeToMessages(activeView.id, (msgs) => {
        setMessages(msgs);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });

      unsubscribeTyping = subscribeToChannelTypingStatus(activeView.id, (typingIds) => {
        setTypingUsers(typingIds.filter(id => id !== user?.uid));
      });
    } else {
      unsubscribe = subscribeToDmMessages(activeView.id, (msgs) => {
        setMessages(msgs);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });

      unsubscribeTyping = subscribeToTypingStatus(activeView.id, (typingIds) => {
        setTypingUsers(typingIds.filter(id => id !== user?.uid));
      });
    }

    return () => {
      unsubscribe?.();
      unsubscribeTyping?.();
      setTypingUsers([]);
      if (user) {
        if (activeView.type === 'dm') {
          setTypingStatus(activeView.id, user.uid, false).catch(() => undefined);
        } else {
          setChannelTypingStatus(activeView.id, user.uid, false).catch(() => undefined);
        }
      }
    };
  }, [activeView, user]);

  useEffect(() => {
    if (!activeView || activeView.type !== 'dm' || !user || messages.length === 0) return;

    const incomingMessages = messages.filter((msg) => msg.senderId !== user.uid);
    const toDeliver = incomingMessages
      .filter((msg) => !(msg.deliveredTo || []).includes(user.uid))
      .map((msg) => msg.id);
    const toRead = incomingMessages
      .filter((msg) => !(msg.readBy || []).includes(user.uid))
      .map((msg) => msg.id);

    if (toDeliver.length > 0) {
      updateDmMessagesStatus(activeView.id, toDeliver, user.uid, 'delivered').catch((err) => {
        console.error('Delivery status error:', err);
      });
    }

    if (toRead.length === 0) return;

    const timer = setTimeout(() => {
      updateDmMessagesStatus(activeView.id, toRead, user.uid, 'read').catch((err) => {
        console.error('Read status error:', err);
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [activeView, messages, user]);

  const openDm = useCallback(async (otherUser: UserProfile) => {
    if (!user) return;
    const dmId = await getOrCreateDm(user.uid, otherUser.uid);
    setActiveView({ type: 'dm', id: dmId, name: otherUser.displayName, otherUid: otherUser.uid });
    setIsMobileMenuOpen(false);
    inputRef.current?.focus();
  }, [user]);

  const updateTypingStatus = useCallback(async (typing: boolean) => {
    if (!user || !activeView) return;
    if (typing === isTypingRef.current) return;

    try {
      if (activeView.type === 'dm') {
        await setTypingStatus(activeView.id, user.uid, typing);
      } else {
        await setChannelTypingStatus(activeView.id, user.uid, typing);
      }
      isTypingRef.current = typing;
    } catch (err) {
      console.error('Typing status error:', err);
    }
  }, [activeView, user]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    updateTypingStatus(false);
  }, [updateTypingStatus]);

  const handleNewMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    if (activeView && user) {
      updateTypingStatus(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => updateTypingStatus(false), 1300);
    }
  };

  const handleReplyMessage = (msg: Message) => {
    setReplyingTo(msg);
    setOpenMessageMenuId(null);
    inputRef.current?.focus();
  };

  const openCreateChannelModal = () => {
    setEditingChannel(null);
    setChannelNameInput('');
    setChannelDescriptionInput('');
    setIsChannelModalOpen(true);
  };

  const openEditChannelModal = (channel: Channel) => {
    setEditingChannel(channel);
    setChannelNameInput(channel.name || '');
    setChannelDescriptionInput(channel.description || '');
    setOpenChannelMenuId(null);
    setIsChannelModalOpen(true);
  };

  const closeChannelModal = () => {
    setIsChannelModalOpen(false);
    setEditingChannel(null);
    setChannelNameInput('');
    setChannelDescriptionInput('');
  };

  const saveChannel = async () => {
    if (!user?.uid) return;

    const normalizedName = channelNameInput.trim();
    if (!normalizedName) {
      setChatNotice('Informe o nome do canal.');
      return;
    }

    try {
      if (editingChannel) {
        await updateChannel(editingChannel.id, normalizedName, channelDescriptionInput);
      } else {
        const channelId = await createChannel(normalizedName, user.uid, channelDescriptionInput);
        setActiveView({ type: 'channel', id: channelId, name: normalizedName });
      }

      const refreshedChannels = await getChannels();
      setChannels(refreshedChannels);
      closeChannelModal();
    } catch (err) {
      console.error('Channel save error:', err);
      setChatNotice('Não foi possível salvar o canal.');
    }
  };

  const askDeleteChannel = (channel: Channel) => {
    setPendingDeleteChannel(channel);
    setOpenChannelMenuId(null);
  };

  const confirmDeleteChannel = async () => {
    if (!pendingDeleteChannel) return;

    try {
      await deleteChannel(pendingDeleteChannel.id);
      setPendingDeleteChannel(null);
      const refreshedChannels = await getChannels();
      setChannels(refreshedChannels);
    } catch (err) {
      console.error('Delete channel error:', err);
      setChatNotice('Não foi possível excluir o canal.');
    }
  };

  const confirmClearChannels = async () => {
    try {
      await clearAllChannels();
      setChannels([]);
      setActiveView(null);
      setIsClearChannelsConfirmOpen(false);
      setChatNotice('Todos os canais foram removidos.');
    } catch (err) {
      console.error('Clear channels error:', err);
      setChatNotice('Não foi possível limpar os canais.');
    }
  };

  const handleDeleteMessage = async (msg: Message) => {
    if (!activeView || !user || msg.senderId !== user.uid) return;
    if (!canManageMessage(msg)) {
      setChatNotice('Você só pode editar/excluir mensagens enviadas há até 10 minutos.');
      return;
    }
    setPendingDeleteMessage(msg);
    setOpenMessageMenuId(null);
  };

  const confirmDeleteMessage = async () => {
    if (!activeView || !pendingDeleteMessage) return;

    try {
      if (activeView.type === 'channel') {
        await deleteChannelMessage(activeView.id, pendingDeleteMessage.id);
      } else {
        await deleteDmMessage(activeView.id, pendingDeleteMessage.id);
      }
      setPendingDeleteMessage(null);
    } catch (err) {
      console.error('Delete message error:', err);
      setChatNotice('Não foi possível excluir a mensagem. Tente novamente.');
    }
  };

  const handleEditMessage = (msg: Message) => {
    if (!activeView || !user || msg.senderId !== user.uid) return;
    if (!canManageMessage(msg)) {
      setChatNotice('Você só pode editar/excluir mensagens enviadas há até 10 minutos.');
      return;
    }
    setEditingMessage(msg);
    setEditingText(msg.text);
    setOpenMessageMenuId(null);
  };

  const validateFileSize = (file: File) => {
    if (file.type.startsWith('image/') && file.size > MAX_IMAGE_BYTES) {
      return 'Imagem excede o limite de 5MB.';
    }

    if (file.type.startsWith('video/') && file.size > MAX_VIDEO_BYTES) {
      return 'Vídeo excede o limite de 50MB.';
    }

    return null;
  };

  const confirmEditMessage = async () => {
    if (!activeView || !editingMessage) return;

    const normalizedText = editingText.trim();
    if (!normalizedText || normalizedText === editingMessage.text) {
      setEditingMessage(null);
      return;
    }

    try {
      if (activeView.type === 'channel') {
        await updateChannelMessage(activeView.id, editingMessage.id, normalizedText);
      } else {
        await updateDmMessage(activeView.id, editingMessage.id, normalizedText);
      }
      setEditingMessage(null);
      setEditingText('');
    } catch (err) {
      console.error('Edit message error:', err);
      setChatNotice('Não foi possível editar a mensagem. Tente novamente.');
    }
  };

  const sendUploadedFile = useCallback(async (file: File) => {
    if (!activeView || !user) return;

    try {
      setIsUploading(true);
      const fileData = await uploadFile(file);
      const senderName = user.displayName || 'Servidor';

      if (activeView.type === 'channel') {
        await sendMessage(activeView.id, `📎 Enviou um arquivo: ${file.name}`, senderName, user.uid, fileData, replyingTo ? {
          id: replyingTo.id,
          text: replyingTo.text,
          senderName: replyingTo.senderName,
        } : undefined);
      } else {
        await sendDmMessage(activeView.id, `📎 Enviou um arquivo: ${file.name}`, senderName, user.uid, fileData, replyingTo ? {
          id: replyingTo.id,
          text: replyingTo.text,
          senderName: replyingTo.senderName,
        } : undefined);
      }
      setReplyingTo(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'erro desconhecido';
      console.error('Upload error:', err);
      setChatNotice(`Falha ao enviar arquivo: ${message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [activeView, user, replyingTo]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeError = validateFileSize(file);
    if (sizeError) {
      setChatNotice(sizeError);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setPendingFileToSend(file);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (isUploading) return;

    const clipboardItems = Array.from(e.clipboardData.items || []);
    const imageItem = clipboardItems.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    const imageFile = imageItem.getAsFile();
    if (!imageFile) return;

    e.preventDefault();

    const ext = imageFile.type.split('/')[1] || 'png';
    const fileName = `print_${Date.now()}.${ext}`;
    const fileToUpload = new File([imageFile], fileName, { type: imageFile.type });

    const sizeError = validateFileSize(fileToUpload);
    if (sizeError) {
      setChatNotice(sizeError);
      return;
    }

    setPendingFileToSend(fileToUpload);
  };

  const confirmSendFile = async () => {
    if (!pendingFileToSend) return;
    const file = pendingFileToSend;
    setPendingFileToSend(null);
    await sendUploadedFile(file);
  };

  const addEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeView || !user) return;
    const text = newMessage;
    setNewMessage('');
    stopTyping();
    const senderName = user.displayName || user.email?.split('@')[0] || 'Servidor';

    try {
      if (activeView.type === 'channel') {
        await sendMessage(activeView.id, text, senderName, user.uid, undefined, replyingTo ? {
          id: replyingTo.id,
          text: replyingTo.text,
          senderName: replyingTo.senderName,
        } : undefined);
      } else {
        await sendDmMessage(activeView.id, text, senderName, user.uid, undefined, replyingTo ? {
          id: replyingTo.id,
          text: replyingTo.text,
          senderName: replyingTo.senderName,
        } : undefined);
      }
      setReplyingTo(null);
    } catch (err) {
      console.error('Send error:', err);
    }
  };

  const logout = async () => {
    if (user?.uid) {
      await updatePresence(false);
    }
    await signOut(auth);
    setUser(null);
    router.push('/');
  };

  const initials = (user?.displayName || user?.email || 'U')[0].toUpperCase();
  function getLastSeenDate(userProfile: UserProfile) {
    return userProfile.lastSeen?.toDate ? userProfile.lastSeen.toDate() : null;
  }

  function isUserActuallyOnline(userProfile: UserProfile) {
    const seenDate = getLastSeenDate(userProfile);
    if (!userProfile.isOnline || !seenDate) return false;
    return Date.now() - seenDate.getTime() <= PRESENCE_STALE_MS;
  }

  function formatLastSeen(userProfile: UserProfile) {
    if (isUserActuallyOnline(userProfile)) return 'online';
    const seenDate = getLastSeenDate(userProfile);
    if (!seenDate) return 'offline';

    const now = new Date();
    const isToday = seenDate.toDateString() === now.toDateString();
    
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = seenDate.toDateString() === yesterday.toDateString();

    const timeStr = seenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `visto hoje às ${timeStr}`;
    if (isYesterday) return `visto ontem às ${timeStr}`;
    
    const dateStr = seenDate.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    return `visto em ${dateStr} às ${timeStr}`;
  }

  const directoryUsers = [...users]
    .sort((a, b) => {
      const aOnline = isUserActuallyOnline(a);
      const bOnline = isUserActuallyOnline(b);

      if (aOnline !== bOnline) return aOnline ? -1 : 1;

      const aSeen = getLastSeenDate(a)?.getTime() ?? 0;
      const bSeen = getLastSeenDate(b)?.getTime() ?? 0;
      if (aSeen !== bSeen) return bSeen - aSeen;

      return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '', 'pt-BR');
    });

  const filteredUsers = directoryUsers.filter(u =>
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const onlineDirectoryUsers = filteredUsers.filter((userProfile) => isUserActuallyOnline(userProfile));
  const offlineDirectoryUsers = filteredUsers.filter((userProfile) => !isUserActuallyOnline(userProfile));

  const subtleTextClass = theme === 'dark' ? 'text-white/70' : 'text-brand-blue-text/60';
  const checkDefaultClass = theme === 'dark' ? 'text-white/70' : 'text-brand-blue-text/60';
  const menuButtonClass = theme === 'dark' ? 'text-white/75 hover:text-white' : 'text-brand-blue hover:text-brand-blue-text';

  const canManageMessage = (msg: Message) => {
    if (!msg.createdAt?.toDate) return false;
    const createdAt = msg.createdAt.toDate().getTime();
    return Date.now() - createdAt <= MESSAGE_EDIT_DELETE_WINDOW_MS;
  };

  const renderMessageStatus = (msg: Message, isMine: boolean) => {
    const time = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    if (!isMine || activeView?.type !== 'dm') {
      return <span className={`text-[8px] font-bold uppercase ${subtleTextClass}`}>{time}</span>;
    }

    const otherUid = activeView.otherUid;
    const isRead = (msg.readBy || []).includes(otherUid);
    const isDelivered = (msg.deliveredTo || []).includes(otherUid);

    return (
      <div className="flex items-center gap-1">
        <span className={`text-[8px] font-bold uppercase ${subtleTextClass}`}>{time}</span>
        {isRead ? (
          <CheckCheck size={12} className="text-sky-500" aria-label="Visualizada" />
        ) : isDelivered ? (
          <CheckCheck size={12} className={checkDefaultClass} aria-label="Recebida" />
        ) : (
          <Check size={12} className={checkDefaultClass} aria-label="Enviada" />
        )}
      </div>
    );
  };

  useEffect(() => {
    setOpenMessageMenuId(null);
    setReplyingTo(null);
  }, [activeView]);

  useEffect(() => {
    setOpenChannelMenuId(null);
  }, [sidePanel]);

  useEffect(() => {
    if (!chatNotice) return;
    const timer = setTimeout(() => setChatNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [chatNotice]);

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--bg)] overflow-hidden relative">
      
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
        
        <aside className={`
          fixed inset-0 lg:relative lg:inset-auto z-50 lg:z-0
          lg:flex flex-col w-72 h-full bg-[var(--surface)] border-r-2 border-brand-blue/10
          transition-transform duration-300 transform
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="lg:hidden flex items-center justify-between p-4 border-b-2 border-brand-blue/5">
            <span className="font-display font-extrabold text-brand-blue-text uppercase text-xs">Menu de Navegação</span>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-brand-blue-text/40">
              <X size={18} />
            </button>
          </div>

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

          <div className="p-4 bg-[var(--bg)]/50">
            {sidePanel === 'channels' && (
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={openCreateChannelModal}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest bg-brand-blue text-white hover:opacity-90"
                >
                  <Plus size={13} /> Novo canal
                </button>
                <button
                  type="button"
                  onClick={() => setIsClearChannelsConfirmOpen(true)}
                  className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-brand-red/30 text-brand-red hover:bg-brand-red/5"
                >
                  Limpar
                </button>
              </div>
            )}
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
            {sidePanel === 'directory' && (
              <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-blue-text/50 px-1">
                <span>Usuários que acessaram o sistema</span>
                <span>{filteredUsers.length} encontrados</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scroll">
            {sidePanel === 'channels' ? (
              channels
                .filter((channel) => channel.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((channel) => (
                  <div
                    key={channel.id}
                    className={`w-full flex items-center gap-2 px-2 py-2 transition-all border-l-4 ${
                      activeView?.type === 'channel' && activeView.id === channel.id
                        ? 'bg-brand-blue/5 border-brand-blue text-brand-blue-text font-bold shadow-sm'
                        : 'border-transparent text-brand-blue-text/60 hover:bg-brand-blue/5 hover:border-brand-blue/20'
                    }`}
                  >
                    <button
                      onClick={() => { setActiveView({ type: 'channel', id: channel.id, name: channel.name }); setIsMobileMenuOpen(false); }}
                      className="flex-1 min-w-0 flex items-center gap-3 px-2 py-1 text-left"
                    >
                      <Hash size={14} className="opacity-60 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider truncate">{channel.name}</span>
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenChannelMenuId((prev) => (prev === channel.id ? null : channel.id))}
                        className="p-1 rounded-full hover:bg-brand-blue/10"
                        aria-label="Gerenciar canal"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {openChannelMenuId === channel.id && (
                        <div className="absolute right-0 mt-1 w-36 bg-[var(--surface)] border border-brand-blue/20 shadow-brutal-sm shadow-brand-blue/30 z-20">
                          <button
                            type="button"
                            onClick={() => openEditChannelModal(channel)}
                            className="w-full px-3 py-2 flex items-center gap-2 text-xs text-brand-blue-text hover:bg-brand-blue/5"
                          >
                            <Pencil size={12} /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => askDeleteChannel(channel)}
                            className="w-full px-3 py-2 flex items-center gap-2 text-xs text-brand-red hover:bg-brand-red/5"
                          >
                            <Trash2 size={12} /> Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
            ) : filteredUsers.length === 0 ? (
              <div className="px-3 py-10 text-center text-brand-blue-text/40">
                <Users size={28} className="mx-auto mb-3 opacity-30" />
                <p className="text-xs font-bold uppercase tracking-widest">Nenhum usuário encontrado</p>
                <p className="mt-2 text-[10px] font-medium normal-case tracking-normal">
                  Os servidores aparecerão aqui assim que acessarem o chat.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {onlineDirectoryUsers.length > 0 && (
                  <div className="px-2 pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green/80">Online agora</p>
                  </div>
                )}

                {onlineDirectoryUsers.map((u) => (
                  <button
                    key={u.uid}
                    onClick={() => {
                      if (u.uid !== user?.uid) openDm(u);
                    }}
                    disabled={u.uid === user?.uid}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-all border-l-4 ${
                      activeView?.type === 'dm' && activeView.otherUid === u.uid
                        ? 'bg-brand-blue/5 border-brand-blue text-brand-blue-text font-bold shadow-sm'
                        : u.uid === user?.uid
                          ? 'border-transparent text-brand-blue-text/40 cursor-default bg-brand-blue/5'
                          : 'border-transparent text-brand-blue-text/60 hover:bg-brand-blue/5 hover:border-brand-blue/20'
                    }`}
                  >
                    <div className="w-8 h-8 bg-brand-gold/20 flex items-center justify-center text-brand-blue-text font-display font-bold text-[10px]">
                      {(u.displayName || u.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-xs font-bold truncate">{u.displayName || 'Servidor'}</p>
                        {u.uid === user?.uid && <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-brand-gold/20 text-brand-blue-text">Você</span>}
                      </div>
                      <p className="text-[10px] text-brand-blue-text/50 truncate">{u.email}</p>
                    </div>
                    <ChevronRight size={12} className="opacity-40" />
                  </button>
                ))}

                {offlineDirectoryUsers.length > 0 && onlineDirectoryUsers.length > 0 && (
                  <div className="px-2 pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue-text/35">Outros usuários</p>
                  </div>
                )}

                {offlineDirectoryUsers.map((u) => (
                  <button
                    key={u.uid}
                    onClick={() => {
                      if (u.uid !== user?.uid) openDm(u);
                    }}
                    disabled={u.uid === user?.uid}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-all border-l-4 ${
                      activeView?.type === 'dm' && activeView.otherUid === u.uid
                        ? 'bg-brand-blue/5 border-brand-blue text-brand-blue-text font-bold shadow-sm'
                        : u.uid === user?.uid
                          ? 'border-transparent text-brand-blue-text/40 cursor-default bg-brand-blue/5'
                          : 'border-transparent text-brand-blue-text/60 hover:bg-brand-blue/5 hover:border-brand-blue/20'
                    }`}
                  >
                    <div className="w-8 h-8 bg-brand-gold/20 flex items-center justify-center text-brand-blue-text font-display font-bold text-[10px]">
                      {(u.displayName || u.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-xs font-bold truncate">{u.displayName || 'Servidor'}</p>
                        {u.uid === user?.uid && <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-brand-gold/20 text-brand-blue-text">Você</span>}
                      </div>
                      <p className="text-[10px] text-brand-blue-text/50 truncate">{u.email}</p>
                      <p className="mt-1 text-[10px] font-bold tracking-tighter text-brand-blue-text/50">
                        {formatLastSeen(u)}
                      </p>
                    </div>
                    <ChevronRight size={12} className="opacity-40" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {isMobileMenuOpen && (
           <div onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden fixed inset-0 bg-brand-blue/40 backdrop-blur-sm z-40" />
        )}

        <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface)] z-0">
          
          <div className="h-14 border-b border-brand-blue/5 flex items-center gap-3 px-6 shrink-0 bg-[var(--surface)]">
            <div className={`p-1.5 ${activeView?.type === 'channel' ? 'bg-brand-blue' : 'bg-brand-gold'}`}>
              {activeView?.type === 'channel' ? <Hash size={14} className="text-white" /> : <MessageCircle size={14} className="text-brand-blue" />}
            </div>
            <h3 className="font-display font-extrabold text-brand-blue-text text-sm uppercase tracking-widest truncate">
              {activeView?.name || 'Selecione uma conversa'}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 custom-scroll">
            {messages.length === 0 && activeView && (
              <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-20">
                <MessageCircle size={64} className="text-brand-blue mb-4" />
                <p className="font-display font-bold uppercase tracking-[0.2em] text-xs">Comece a conversa em {activeView.name}</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMine = msg.senderId === user?.uid;
              const isDeleted = Boolean(msg.isDeleted);
              const isEdited = Boolean(msg.editedAt) && !isDeleted;
              const canManage = canManageMessage(msg);
              
              return (
                <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[90%] lg:max-w-[70%] ${isMine ? 'ml-auto' : 'mr-auto'}`}>
                  {!isMine && (
                    <span className="text-[10px] font-bold text-brand-green uppercase tracking-widest mb-1 ml-1">{msg.senderName}</span>
                  )}
                  <div className="relative">
                    <div className={`
                      p-4 shadow-brutal-sm transition-all
                      ${isMine 
                        ? 'bg-brand-blue text-white shadow-brand-gold' 
                        : 'bg-[var(--bg)] border-2 border-brand-blue/20 text-brand-blue-text shadow-brand-blue/5'}
                    `}>
                      {/* Renderização de Media */}
                      {!isDeleted && msg.fileUrl && (
                        <div className="mb-3 rounded overflow-hidden bg-black/5 dark:bg-white/5 p-1 max-w-sm">
                          {msg.fileType?.startsWith('image/') ? (
                            <Image 
                              src={msg.fileUrl} 
                              alt={msg.fileName || 'Imagem'} 
                              width={400}
                              height={300}
                              className="max-w-full h-auto rounded block cursor-pointer hover:opacity-90" 
                              onClick={() => window.open(msg.fileUrl, '_blank')} 
                            />
                          ) : msg.fileType?.startsWith('video/') ? (
                            <video src={msg.fileUrl} controls className="max-w-full rounded" />
                          ) : (
                            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-brand-blue/5 hover:bg-brand-blue/10 transition-colors rounded">
                              <FileText size={24} className="text-brand-blue" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">{msg.fileName}</p>
                                <p className="text-[9px] uppercase tracking-tighter opacity-60 italic text-brand-blue">Baixar anexo</p>
                              </div>
                            </a>
                          )}
                        </div>
                      )}
                      <p className={`font-sans text-sm leading-relaxed whitespace-pre-wrap ${isDeleted ? 'italic opacity-80' : ''}`}>
                        {isDeleted ? 'Mensagem excluída' : msg.text}
                      </p>
                      {msg.replyTo && !isDeleted && (
                        <div className="mt-2 border-l-2 border-brand-gold/70 pl-2 py-1 bg-black/5">
                          <p className="text-[10px] font-bold uppercase opacity-70">Resposta para {msg.replyTo.senderName}</p>
                          <p className="text-[11px] opacity-80 truncate">{msg.replyTo.text}</p>
                        </div>
                      )}
                      {isEdited && (
                        <p className={`mt-1 text-[10px] italic ${subtleTextClass}`}>mensagem editada</p>
                      )}
                    </div>
                  </div>
                  <div className={`mt-1.5 px-1 flex items-center gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                    {renderMessageStatus(msg, isMine)}

                    {!isDeleted && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMessageMenuId((prev) => (prev === msg.id ? null : msg.id))}
                          className={`p-1 rounded-full transition-colors ${menuButtonClass}`}
                          aria-label="Mais opções da mensagem"
                        >
                          <MoreVertical size={14} />
                        </button>

                        {openMessageMenuId === msg.id && (
                          <div className={`bottom-full mb-1 w-36 bg-[var(--surface)] border border-brand-blue/20 shadow-brutal-sm shadow-brand-blue/30 z-20 ${
                            isMine ? 'absolute right-0' : 'absolute left-0'
                          }`}>
                            <button
                              type="button"
                              onClick={() => handleReplyMessage(msg)}
                              className="w-full px-3 py-2 flex items-center gap-2 text-xs text-brand-blue-text hover:bg-brand-blue/5"
                            >
                              <MessageCircle size={12} /> Responder
                            </button>
                            {isMine && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEditMessage(msg)}
                                  disabled={!canManage}
                                  className="w-full px-3 py-2 flex items-center gap-2 text-xs text-brand-blue-text hover:bg-brand-blue/5 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Pencil size={12} /> {canManage ? 'Editar' : 'Editar (10 min)'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(msg)}
                                  disabled={!canManage}
                                  className="w-full px-3 py-2 flex items-center gap-2 text-xs text-brand-red hover:bg-brand-red/5 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Trash2 size={12} /> {canManage ? 'Excluir' : 'Excluir (10 min)'}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-brand-blue-text/70">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map(dot => (
                    <span
                      key={dot}
                      className="h-2 w-2 rounded-full bg-brand-blue animate-pulse"
                      style={{ animationDelay: `${dot * 150}ms` }}
                    />
                  ))}
                </div>
                <span>
                  {typingUsers
                    .map((uid) => users.find((u) => u.uid === uid)?.displayName || 'Usuário')
                    .slice(0, 2)
                    .join(', ')}
                  {typingUsers.length > 2 ? ' e outros' : ''} digitando...
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t-2 border-brand-blue/10 bg-[var(--surface)] relative">
            {replyingTo && (
              <div className="max-w-5xl mx-auto mb-3 p-2 border-l-2 border-brand-gold bg-brand-blue/5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-brand-blue-text/70">Respondendo {replyingTo.senderName}</p>
                  <p className="text-xs text-brand-blue-text truncate">{replyingTo.text}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="text-brand-blue-text/50 hover:text-brand-red"
                  aria-label="Cancelar resposta"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            
            {showEmojiPicker && (
              <div className="absolute bottom-full left-4 mb-2 bg-[var(--surface)] border-2 border-brand-blue p-2 shadow-brutal-md shadow-brand-gold grid grid-cols-8 gap-1 z-50">
                {['😊','😂','❤️','👍','🙌','🔥','👏','🚀','✨','🎉','📢','✅','⚠️','🤝','💼','📅'].map(emoji => (
                  <button key={emoji} onClick={() => addEmoji(emoji)} className="p-2 hover:bg-brand-blue/5 text-xl transition-transform hover:scale-125">
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className="flex gap-2 max-w-5xl mx-auto items-end">
              <div className="flex-1 bg-[var(--bg)] border-2 border-brand-blue/10 flex flex-col shadow-inner focus-within:border-brand-blue transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={handleNewMessageChange}
                  onPaste={handlePaste}
                  onBlur={stopTyping}
                  placeholder={isUploading ? 'Enviando...' : 'Escreva sua mensagem...'}
                  disabled={isUploading}
                  className="w-full bg-transparent p-4 font-sans text-sm outline-none"
                />
                
                <div className="flex items-center gap-1 px-2 pb-2 opacity-60 hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 hover:bg-brand-blue/5 rounded text-brand-blue">
                    <Smile size={18} />
                  </button>
                  <label className="p-2 hover:bg-brand-blue/5 rounded text-brand-blue cursor-pointer">
                    <Paperclip size={18} />
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                  </label>
                  <button type="button" className="p-2 hover:bg-brand-blue/5 rounded text-brand-blue" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon size={18} />
                  </button>
                  {isUploading && (
                    <span className="text-[9px] font-bold text-brand-gold uppercase animate-pulse ml-2">Enviando...</span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={(!newMessage.trim() && !isUploading) || isUploading}
                className="bg-brand-blue text-white w-14 lg:w-20 h-[58px] flex items-center justify-center shadow-brutal-sm shadow-brand-gold hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 disabled:opacity-30 transition-all flex-shrink-0"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {chatNotice && (
        <div className="fixed bottom-5 right-5 z-[70] bg-brand-red text-white px-4 py-3 text-xs font-bold shadow-brutal-sm shadow-brand-blue max-w-xs">
          {chatNotice}
        </div>
      )}

      {pendingFileToSend && (
        <div className="fixed inset-0 z-[80] bg-brand-blue/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--surface)] border-2 border-brand-blue shadow-brutal-md shadow-brand-gold p-5">
            <h4 className="font-display font-bold uppercase text-sm text-brand-blue-text">Enviar anexo?</h4>
            <p className="mt-2 text-xs text-brand-blue-text/80 break-all">
              {pendingFileToSend.name}
            </p>
            <p className="mt-1 text-[11px] text-brand-blue-text/60">Tipo: {pendingFileToSend.type || 'arquivo'}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingFileToSend(null)}
                className="px-3 py-2 text-xs font-bold border border-brand-blue/20 text-brand-blue-text hover:bg-brand-blue/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSendFile}
                className="px-3 py-2 text-xs font-bold bg-brand-blue text-white hover:opacity-90"
              >
                Confirmar envio
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteMessage && (
        <div className="fixed inset-0 z-[80] bg-brand-blue/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--surface)] border-2 border-brand-blue shadow-brutal-md shadow-brand-gold p-5">
            <h4 className="font-display font-bold uppercase text-sm text-brand-blue-text">Excluir mensagem?</h4>
            <p className="mt-2 text-xs text-brand-blue-text/80">Ela continuará no histórico como “Mensagem excluída”.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteMessage(null)}
                className="px-3 py-2 text-xs font-bold border border-brand-blue/20 text-brand-blue-text hover:bg-brand-blue/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteMessage}
                className="px-3 py-2 text-xs font-bold bg-brand-red text-white hover:opacity-90"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteChannel && (
        <div className="fixed inset-0 z-[80] bg-brand-blue/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--surface)] border-2 border-brand-blue shadow-brutal-md shadow-brand-gold p-5">
            <h4 className="font-display font-bold uppercase text-sm text-brand-blue-text">Excluir canal?</h4>
            <p className="mt-2 text-xs text-brand-blue-text/80">Canal: {pendingDeleteChannel.name}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteChannel(null)}
                className="px-3 py-2 text-xs font-bold border border-brand-blue/20 text-brand-blue-text hover:bg-brand-blue/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteChannel}
                className="px-3 py-2 text-xs font-bold bg-brand-red text-white hover:opacity-90"
              >
                Excluir canal
              </button>
            </div>
          </div>
        </div>
      )}

      {isClearChannelsConfirmOpen && (
        <div className="fixed inset-0 z-[80] bg-brand-blue/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--surface)] border-2 border-brand-blue shadow-brutal-md shadow-brand-gold p-5">
            <h4 className="font-display font-bold uppercase text-sm text-brand-blue-text">Limpar todos os canais?</h4>
            <p className="mt-2 text-xs text-brand-blue-text/80">Esta ação remove todos os canais existentes.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsClearChannelsConfirmOpen(false)}
                className="px-3 py-2 text-xs font-bold border border-brand-blue/20 text-brand-blue-text hover:bg-brand-blue/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmClearChannels}
                className="px-3 py-2 text-xs font-bold bg-brand-red text-white hover:opacity-90"
              >
                Limpar canais
              </button>
            </div>
          </div>
        </div>
      )}

      {isChannelModalOpen && (
        <div className="fixed inset-0 z-[80] bg-brand-blue/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[var(--surface)] border-2 border-brand-blue shadow-brutal-md shadow-brand-gold p-5">
            <h4 className="font-display font-bold uppercase text-sm text-brand-blue-text">
              {editingChannel ? 'Editar canal' : 'Novo canal'}
            </h4>

            <div className="mt-3 space-y-3">
              <input
                value={channelNameInput}
                onChange={(e) => setChannelNameInput(e.target.value)}
                placeholder="Nome do canal"
                className="w-full bg-[var(--bg)] border-2 border-brand-blue/20 p-3 text-sm text-brand-blue-text outline-none focus:border-brand-blue"
              />
              <textarea
                value={channelDescriptionInput}
                onChange={(e) => setChannelDescriptionInput(e.target.value)}
                placeholder="Descrição (opcional)"
                className="w-full min-h-[96px] bg-[var(--bg)] border-2 border-brand-blue/20 p-3 text-sm text-brand-blue-text outline-none focus:border-brand-blue"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeChannelModal}
                className="px-3 py-2 text-xs font-bold border border-brand-blue/20 text-brand-blue-text hover:bg-brand-blue/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveChannel}
                className="px-3 py-2 text-xs font-bold bg-brand-blue text-white hover:opacity-90"
              >
                {editingChannel ? 'Salvar canal' : 'Criar canal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingMessage && (
        <div className="fixed inset-0 z-[80] bg-brand-blue/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[var(--surface)] border-2 border-brand-blue shadow-brutal-md shadow-brand-gold p-5">
            <h4 className="font-display font-bold uppercase text-sm text-brand-blue-text">Editar mensagem</h4>
            <textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              className="mt-3 w-full min-h-[120px] bg-[var(--bg)] border-2 border-brand-blue/20 p-3 text-sm text-brand-blue-text outline-none focus:border-brand-blue"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setEditingMessage(null); setEditingText(''); }}
                className="px-3 py-2 text-xs font-bold border border-brand-blue/20 text-brand-blue-text hover:bg-brand-blue/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmEditMessage}
                className="px-3 py-2 text-xs font-bold bg-brand-blue text-white hover:opacity-90"
              >
                Salvar edição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
