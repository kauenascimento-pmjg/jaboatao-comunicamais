import { auth, db, rtdb, storage, waitForAuthReady } from './firebase';
import { doc, setDoc, getDoc, collection, onSnapshot, addDoc, serverTimestamp, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref as rtdbRef, push, set, get, update, query as rtdbQuery, orderByChild, onValue } from 'firebase/database';
import { ref, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot, StorageError } from 'firebase/storage';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type Message = {
  id: string;
  text: string;
  senderName: string;
  senderId: string;
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  deliveredTo?: string[];
  readBy?: string[];
  isDeleted?: boolean;
  channelId?: string;
  dmId?: string;
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
  createdAt: { toDate: () => Date } | null;
  editedAt?: { toDate: () => Date } | null;
  deletedAt?: { toDate: () => Date } | null;
};

type MessageRecord = {
  text: string;
  senderName: string;
  senderId: string;
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  deliveredTo?: string[];
  readBy?: string[];
  isDeleted?: boolean;
  channelId?: string;
  dmId?: string;
  fileUrl?: string | null;
  fileType?: string | null;
  fileName?: string | null;
  createdAt?: number | null;
  editedAt?: number | null;
  deletedAt?: number | null;
};

export type Channel = {
  id: string;
  name: string;
  description?: string;
  type?: string;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  nome?: string;
  department?: string;
  role?: string;
  isOnline?: boolean;
  lastSeen?: { toDate: () => Date } | null;
  photoURL?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
};

// ─── STORAGE ──────────────────────────────────────────────────────────────────

const MESSAGE_ROOT = 'message_threads';

function toDateWrapper(timestamp?: number | null) {
  if (timestamp === null || timestamp === undefined) return null;
  return { toDate: () => new Date(timestamp) };
}

function normalizeMessage(id: string, record: MessageRecord): Message {
  return {
    id,
    text: record.text,
    senderName: record.senderName,
    senderId: record.senderId,
    replyTo: record.replyTo,
    deliveredTo: record.deliveredTo,
    readBy: record.readBy,
    isDeleted: record.isDeleted,
    channelId: record.channelId,
    dmId: record.dmId,
    fileUrl: record.fileUrl || undefined,
    fileType: record.fileType || undefined,
    fileName: record.fileName || undefined,
    createdAt: toDateWrapper(record.createdAt),
    editedAt: toDateWrapper(record.editedAt),
    deletedAt: toDateWrapper(record.deletedAt),
  };
}

function getMessageThreadPath(scope: 'channels' | 'direct_messages', threadId: string) {
  return `${MESSAGE_ROOT}/${scope}/${threadId}/messages`;
}

function sortMessages(messages: Message[]) {
  return messages.sort((a, b) => {
    const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return aTime - bTime;
  });
}

/** Faz upload de um arquivo para o Firebase Storage com monitoramento */
export async function uploadFile(file: File, folder: string = 'chat_files'): Promise<{ url: string; type: string; name: string }> {
  return new Promise((resolve, reject) => {
    try {
      void (async () => {
        const currentUser = await waitForAuthReady();
        if (!currentUser) {
          throw new Error('Faça login novamente antes de enviar arquivos.');
        }

        if (!auth.currentUser) {
          throw new Error('Sessão do Firebase ainda não foi restaurada. Tente novamente em alguns segundos.');
        }

      const timestamp = Date.now();
      const storageRef = ref(storage, `${folder}/${timestamp}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Timeout de 120 segundos (mais paciente para o primeiro upload)
      const timeout = setTimeout(() => {
        uploadTask.cancel();
        console.error('❌ Upload cancelado por timeout de 120s.');
        reject(new Error('Tempo limite excedido. Verifique se o Storage está ativo e se suas regras permitem gravação.'));
      }, 120000);

      uploadTask.on('state_changed', 
        (snapshot: UploadTaskSnapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`📤 Progresso: ${progress.toFixed(2)}%`);
        }, 
        (error: StorageError) => {
          clearTimeout(timeout);
          console.error('❌ Erro na tarefa de upload:', error.code, error.message);
          if (error.code === 'storage/unauthorized') {
            console.error('MOTIVO: Permissão negada. Verifique as Rules do Storage.');
          }
          reject(error);
        }, 
        async () => {
          clearTimeout(timeout);
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            url,
            type: file.type,
            name: file.name
          });
        }
      );
      })().catch((error: unknown) => {
        reject(error);
      });
    } catch (error) {
      console.error('Error in uploadFile initialization:', error);
      reject(error);
    }
  });
}

// ─── USER PROFILE ─────────────────────────────────────────────────────────────

/**
 * Busca todos os usuários do Firestore (diretório de servidores)
 * Nota: Sem depender de sincronização de autenticação
 */
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

export function subscribeToUsers(callback: (users: UserProfile[]) => void) {
  const usersCollection = collection(db, 'users');
  return onSnapshot(usersCollection, (snapshot) => {
    const users: UserProfile[] = [];
    snapshot.forEach((docSnap) => users.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile));
    callback(users);
  });
}

export async function setUserPresence(
  uid: string,
  isOnline: boolean,
  profile?: {
    displayName?: string;
    email?: string;
    photoURL?: string;
  }
) {
  if (!uid) return;

  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      isOnline,
      ...(profile?.displayName && { displayName: profile.displayName }),
      ...(profile?.email && { email: profile.email }),
      ...(profile?.photoURL && { photoURL: profile.photoURL }),
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Error updating user presence:', error);
  }
}

// ─── CHANNELS ─────────────────────────────────────────────────────────────────

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

export async function createChannel(name: string, createdBy: string, description?: string): Promise<string> {
  const channelRef = await addDoc(collection(db, 'channels'), {
    name: name.trim(),
    description: description?.trim() || '',
    type: 'channel',
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return channelRef.id;
}

export async function updateChannel(channelId: string, name: string, description?: string) {
  await updateDoc(doc(db, 'channels', channelId), {
    name: name.trim(),
    description: description?.trim() || '',
    updatedAt: serverTimestamp(),
  });
}

export async function deleteChannel(channelId: string) {
  await deleteDoc(doc(db, 'channels', channelId));
}

export async function clearAllChannels() {
  const snapshot = await getDocs(collection(db, 'channels'));
  await Promise.all(snapshot.docs.map((channelDoc) => deleteDoc(channelDoc.ref)));
}

export function subscribeToMessages(channelId: string, callback: (messages: Message[]) => void) {
  const messagesRef = rtdbQuery(rtdbRef(rtdb, getMessageThreadPath('channels', channelId)), orderByChild('createdAt'));
  return onValue(messagesRef, (snapshot) => {
    const raw = snapshot.val() as Record<string, MessageRecord> | null;
    if (!raw) {
      callback([]);
      return;
    }

    const msgs = Object.entries(raw).map(([id, record]) => normalizeMessage(id, record));
    callback(sortMessages(msgs));
  });
}

export async function sendMessage(
  channelId: string, 
  text: string, 
  senderName: string, 
  senderId: string,
  fileData?: { url: string; type: string; name: string },
  replyTo?: { id: string; text: string; senderName: string }
) {
  const currentUser = await waitForAuthReady();
  if (!currentUser) {
    throw new Error('Faça login novamente antes de enviar mensagens.');
  }

  const messagesRef = rtdbRef(rtdb, getMessageThreadPath('channels', channelId));
  const messageRef = push(messagesRef);

  await set(messageRef, {
    id: messageRef.key,
    text,
    senderName,
    senderId,
    channelId,
    ...(replyTo && { replyTo }),
    ...(fileData && {
      fileUrl: fileData.url,
      fileType: fileData.type,
      fileName: fileData.name
    }),
    createdAt: Date.now(),
    editedAt: null,
    deletedAt: null,
  });
}

export async function deleteChannelMessage(channelId: string, messageId: string) {
  try {
    await update(rtdbRef(rtdb, `${getMessageThreadPath('channels', channelId)}/${messageId}`), {
      isDeleted: true,
      text: 'Mensagem excluída',
      fileUrl: null,
      fileType: null,
      fileName: null,
      deletedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error deleting channel message:', error);
    throw error;
  }
}

export async function updateChannelMessage(channelId: string, messageId: string, text: string) {
  try {
    await update(rtdbRef(rtdb, `${getMessageThreadPath('channels', channelId)}/${messageId}`), {
      text,
      editedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error updating channel message:', error);
    throw error;
  }
}

export async function deleteDmMessage(dmId: string, messageId: string) {
  try {
    await update(rtdbRef(rtdb, `${getMessageThreadPath('direct_messages', dmId)}/${messageId}`), {
      isDeleted: true,
      text: 'Mensagem excluída',
      fileUrl: null,
      fileType: null,
      fileName: null,
      deletedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error deleting dm message:', error);
    throw error;
  }
}

export async function updateDmMessage(dmId: string, messageId: string, text: string) {
  try {
    await update(rtdbRef(rtdb, `${getMessageThreadPath('direct_messages', dmId)}/${messageId}`), {
      text,
      editedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error updating dm message:', error);
    throw error;
  }
}

export async function setTypingStatus(dmId: string, userId: string, isTyping: boolean) {
  try {
    await setDoc(doc(db, `direct_messages/${dmId}/typing`, userId), {
      userId,
      isTyping,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Error updating typing status:', error);
  }
}

export async function setChannelTypingStatus(channelId: string, userId: string, isTyping: boolean) {
  try {
    await setDoc(doc(db, `channels/${channelId}/typing`, userId), {
      userId,
      isTyping,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Error updating channel typing status:', error);
  }
}

export function subscribeToTypingStatus(dmId: string, callback: (typingUserIds: string[]) => void) {
  const typingCollection = collection(db, `direct_messages/${dmId}/typing`);
  return onSnapshot(typingCollection, (snapshot) => {
    const typingUsers: string[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as { userId: string; isTyping: boolean };
      if (data?.isTyping) typingUsers.push(data.userId);
    });
    callback(typingUsers);
  });
}

export function subscribeToChannelTypingStatus(channelId: string, callback: (typingUserIds: string[]) => void) {
  const typingCollection = collection(db, `channels/${channelId}/typing`);
  return onSnapshot(typingCollection, (snapshot) => {
    const typingUsers: string[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as { userId: string; isTyping: boolean };
      if (data?.isTyping) typingUsers.push(data.userId);
    });
    callback(typingUsers);
  });
}

// ─── DIRECT MESSAGES ──────────────────────────────────────────────────────────

export function getDmId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

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
  const messagesRef = rtdbQuery(rtdbRef(rtdb, getMessageThreadPath('direct_messages', dmId)), orderByChild('createdAt'));
  return onValue(messagesRef, (snapshot) => {
    const raw = snapshot.val() as Record<string, MessageRecord> | null;
    if (!raw) {
      callback([]);
      return;
    }

    const msgs = Object.entries(raw).map(([id, record]) => normalizeMessage(id, record));
    callback(sortMessages(msgs));
  });
}

export async function sendDmMessage(
  dmId: string, 
  text: string, 
  senderName: string, 
  senderId: string,
  fileData?: { url: string; type: string; name: string },
  replyTo?: { id: string; text: string; senderName: string }
) {
  const currentUser = await waitForAuthReady();
  if (!currentUser) {
    throw new Error('Faça login novamente antes de enviar mensagens.');
  }

  const messagesRef = rtdbRef(rtdb, getMessageThreadPath('direct_messages', dmId));
  const messageRef = push(messagesRef);

  await set(messageRef, {
    id: messageRef.key,
    text,
    senderName,
    senderId,
    dmId,
    ...(replyTo && { replyTo }),
    deliveredTo: [senderId],
    readBy: [senderId],
    ...(fileData && {
      fileUrl: fileData.url,
      fileType: fileData.type,
      fileName: fileData.name
    }),
    createdAt: Date.now(),
    editedAt: null,
    deletedAt: null,
  });
}

export async function updateDmMessagesStatus(
  dmId: string,
  messageIds: string[],
  userId: string,
  status: 'delivered' | 'read'
) {
  if (!messageIds.length) return;

  const fieldName = status === 'read' ? 'readBy' : 'deliveredTo';

  await Promise.all(
    messageIds.map(async (messageId) => {
      const messageRef = rtdbRef(rtdb, `${getMessageThreadPath('direct_messages', dmId)}/${messageId}`);
      const snapshot = await get(messageRef);

      if (!snapshot.exists()) return;

      const record = snapshot.val() as MessageRecord;
      const currentUsers = (record[fieldName as 'readBy' | 'deliveredTo'] ?? []) as string[];
      const nextUsers = Array.from(new Set([...currentUsers, userId]));

      await update(messageRef, {
        [fieldName]: nextUsers,
      });
    })
  );
}
