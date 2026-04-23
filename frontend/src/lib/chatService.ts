import { db, storage } from './firebase';
import { doc, setDoc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot, StorageError } from 'firebase/storage';
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
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
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
  photoURL?: string;
  adUsername?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

// ─── STORAGE ──────────────────────────────────────────────────────────────────

/** Faz upload de um arquivo para o Firebase Storage com monitoramento */
export async function uploadFile(file: File, folder: string = 'chat_files'): Promise<{ url: string; type: string; name: string }> {
  return new Promise((resolve, reject) => {
    try {
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
    } catch (error) {
      console.error('Error in uploadFile initialization:', error);
      reject(error);
    }
  });
}

// ─── USER PROFILE ─────────────────────────────────────────────────────────────

/** Salva/atualiza o perfil do usuário no Firestore ao logar */
export async function syncUserToFirestore(user: User | ADUser): Promise<void> {
  try {
    const isAD = 'isAD' in user;
    const uid = user.uid; // Firebase UID
    const email = user.email || '';
    const displayName = user.displayName || '';
    const adUsername = isAD ? (user as ADUser).user : (email.split('@')[0]);

    if (!uid) return;

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
    if (snapshot.size > 0) return;

    for (const channel of DEFAULT_CHANNELS) {
      await addDoc(collection(db, 'channels'), {
        ...channel,
        createdAt: serverTimestamp(),
      });
    }
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

export async function sendMessage(
  channelId: string, 
  text: string, 
  senderName: string, 
  senderId: string,
  fileData?: { url: string; type: string; name: string }
) {
  await addDoc(collection(db, `channels/${channelId}/messages`), {
    text,
    senderName,
    senderId,
    channelId,
    ...(fileData && {
      fileUrl: fileData.url,
      fileType: fileData.type,
      fileName: fileData.name
    }),
    createdAt: serverTimestamp(),
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

export async function sendDmMessage(
  dmId: string, 
  text: string, 
  senderName: string, 
  senderId: string,
  fileData?: { url: string; type: string; name: string }
) {
  await addDoc(collection(db, `direct_messages/${dmId}/messages`), {
    text,
    senderName,
    senderId,
    dmId,
    ...(fileData && {
      fileUrl: fileData.url,
      fileType: fileData.type,
      fileName: fileData.name
    }),
    createdAt: serverTimestamp(),
  });
}
