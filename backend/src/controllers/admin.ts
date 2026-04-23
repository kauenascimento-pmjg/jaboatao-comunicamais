import { Request, Response } from 'express';
import { getFirestore, getAuth } from '../services/firebase';

/**
 * Seed the Firestore database with the initial official channels.
 * POST /api/admin/seed
 * Only call this once on a new project.
 */
export async function seedDatabase(req: Request, res: Response): Promise<void> {
  const db = getFirestore();
  
  const defaultChannels = [
    { name: 'Geral', description: 'Canal geral para todos os servidores', isOfficial: true, type: 'channel' },
    { name: 'Avisos RH', description: 'Comunicados oficiais de Recursos Humanos', isOfficial: true, type: 'channel' },
    { name: 'Suporte TI', description: 'Suporte técnico e TI da prefeitura', isOfficial: true, type: 'channel' },
    { name: 'Secretaria de Saúde', description: 'Canal da Secretaria Municipal de Saúde', isOfficial: true, type: 'channel' },
    { name: 'Secretaria de Educação', description: 'Canal da Secretaria Municipal de Educação', isOfficial: true, type: 'channel' },
    { name: 'SEGOP', description: 'Secretaria Executiva de Governo Digital e Processos Estratégicos', isOfficial: true, type: 'channel' },
  ];

  try {
    const batch = db.batch();
    
    for (const channel of defaultChannels) {
      const ref = db.collection('channels').doc();
      batch.set(ref, { ...channel, createdAt: new Date() });
    }

    await batch.commit();
    res.status(201).json({ message: `${defaultChannels.length} canais criados com sucesso.` });
  } catch (error) {
    console.error('Erro no seed:', error);
    res.status(500).json({ error: 'Erro ao criar canais padrão.' });
  }
}

/**
 * List all users from Firebase Auth.
 * GET /api/admin/users
 */
export async function listUsers(req: Request, res: Response): Promise<void> {
  const auth = getAuth();
  try {
    const listResult = await auth.listUsers(100);
    const users = listResult.users.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      photoURL: u.photoURL,
    }));
    res.status(200).json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
}

/**
 * Sync a user profile to Firestore users collection.
 * POST /api/admin/users/:uid/sync
 */
export async function syncUserProfile(req: Request, res: Response): Promise<void> {
  const db = getFirestore();
  const auth = getAuth();
  const uid = req.params.uid as string;

  try {
    const userRecord = await auth.getUser(uid);
    await db.collection('users').doc(uid).set({
      uid,
      email: userRecord.email,
      displayName: userRecord.displayName || userRecord.email?.split('@')[0],
      department: req.body.department || 'Geral',
      role: req.body.role || 'Servidor',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });

    res.status(200).json({ message: 'Perfil sincronizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao sincronizar perfil:', error);
    res.status(500).json({ error: 'Erro ao sincronizar perfil.' });
  }
}
