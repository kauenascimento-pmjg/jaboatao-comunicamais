import { db } from './firebase';
import { doc, setDoc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { ADUser } from './authStore';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type Message = {
  id: string;
  text: string;
  senderName: string;
  senderId: string;
  channelId?: string;
  dmId?: string;
  createdAt: { toDate: () => Date } | null;
};

export type Channel = {
  id: string;
  name: string;
  description?: string;
  type?: string;
};

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  department?: string;
  role?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

// ─── USER PROFILE ─────────────────────────────────────────────────────────────

/** Salva/atualiza o perfil do usuário no Firestore ao logar */
export async function syncUserToFirestore(user: User | ADUser): Promise<void> {
  try {
    const isAD = 'isAD' in user;
    const uid = user.uid; // Já deve vir como Firebase UID do handleLogin
    const email = user.email || '';
    const displayName = user.displayName || '';
    const adUsername = isAD ? (user as ADUser).user : (email.split('@')[0]);

    if (!uid) return;

    console.log('--- Syncing User to Firestore ---', { uid, adUsername, displayName });

    const ref = doc(db, 'users', uid);
    await setDoc(ref, {
      uid,
      adUsername,
      email,
      displayName,
      department: (user as ADUser).department || 'Geral',
      role: (user as ADUser).role || 'Servidor',
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    console.log('User synced to Firestore:', uid);
  } catch (error) {
    console.error('Error in syncUserToFirestore:', error);
  }
}

/** Busca todos os usuários do Firestore (diretório de servidores) */
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const users: UserProfile[] = [];
    snapshot.forEach(d => users.push({ uid: d.id, ...d.data() } as UserProfile));
    return users;
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    return [];
  }
}

// ─── CHANNELS ─────────────────────────────────────────────────────────────────

const DEFAULT_CHANNELS = [
  { name: 'Geral', description: 'Canal geral para todos os servidores', isOfficial: true, type: 'channel' },
  { name: 'Avisos RH', description: 'Comunicados oficiais de Recursos Humanos', isOfficial: true, type: 'channel' },
  { name: 'Suporte TI', description: 'Suporte técnico e TI da prefeitura', isOfficial: true, type: 'channel' },
  { name: 'Secretaria de Saúde', description: 'Canal da Secretaria Municipal de Saúde', isOfficial: true, type: 'channel' },
  { name: 'Secretaria de Educação', description: 'Canal da Secretaria Municipal de Educação', isOfficial: true, type: 'channel' },
  { name: 'SEGOP', description: 'Secretaria Executiva de Governo Digital e Processos Estratégicos', isOfficial: true, type: 'channel' },
];

/** Cria canais padrão no Firestore se não existirem */
export async function seedDefaultChannels(): Promise<void> {
  try {
    const snapshot = await getDocs(collection(db, 'channels'));
    if (snapshot.size > 0) return; // Já existem canais

    console.log('[Seed] Creating default channels...');
    for (const channel of DEFAULT_CHANNELS) {
      await addDoc(collection(db, 'channels'), {
        ...channel,
        createdAt: serverTimestamp(),
      });
    }
    console.log(`[Seed] ${DEFAULT_CHANNELS.length} channels created.`);
  } catch (error) {
    console.error('[Seed] Error creating default channels:', error);
  }
}

/** Busca todos os canais diretamente do Firestore */
export async function getChannels(): Promise<Channel[]> {
  try {
    const snapshot = await getDocs(collection(db, 'channels'));
    const channels: Channel[] = [];
    snapshot.forEach(d => channels.push({ id: d.id, ...d.data() } as Channel));
    return channels;
  } catch (error) {
    console.error('Error in getChannels:', error);
    return [];
  }
}

export function subscribeToMessages(channelId: string, callback: (messages: Message[]) => void) {
  const q = query(
    collection(db, `channels/${channelId}/messages`),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const msgs: Message[] = [];
    snapshot.forEach(d => msgs.push({ id: d.id, ...d.data() } as Message));
    callback(msgs);
  });
}

export async function sendMessage(channelId: string, text: string, senderName: string, senderId: string) {
  await addDoc(collection(db, `channels/${channelId}/messages`), {
    text,
    senderName,
    senderId,
    channelId,
    createdAt: serverTimestamp(),
  });
}

// ─── DIRECT MESSAGES ──────────────────────────────────────────────────────────

/** DM ID = ID menor + ID maior, alfabeticamente — garante unicidade */
export function getDmId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

/** Cria ou busca a sala de DM entre dois usuários */
export async function getOrCreateDm(uid1: string, uid2: string): Promise<string> {
  const dmId = getDmId(uid1, uid2);
  const dmRef = doc(db, 'direct_messages', dmId);
  const existing = await getDoc(dmRef);

  if (!existing.exists()) {
    await setDoc(dmRef, {
      members: [uid1, uid2],
      createdAt: serverTimestamp(),
    });
  }

  return dmId;
}

export function subscribeToDmMessages(dmId: string, callback: (messages: Message[]) => void) {
  const q = query(
    collection(db, `direct_messages/${dmId}/messages`),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const msgs: Message[] = [];
    snapshot.forEach(d => msgs.push({ id: d.id, ...d.data() } as Message));
    callback(msgs);
  });
}

export async function sendDmMessage(dmId: string, text: string, senderName: string, senderId: string) {
  await addDoc(collection(db, `direct_messages/${dmId}/messages`), {
    text,
    senderName,
    senderId,
    dmId,
    createdAt: serverTimestamp(),
  });
}
