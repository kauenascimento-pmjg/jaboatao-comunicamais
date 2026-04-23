import { Request, Response } from 'express';
import { getAuth, getFirestore, canSignTokens } from '../services/firebase';

/**
 * List all users from Firestore (User Directory).
 * GET /api/users
 */
export async function listFirestoreUsers(req: Request, res: Response): Promise<void> {
  const db = getFirestore();
  
  const mockUsers = [
    { uid: 'mock-u1', displayName: 'Kauê Nascimento', email: 'kaue.nascimento@jaboatao.pe.gov.br', department: 'TI / SEGOP', role: 'Desenvolvedor' },
    { uid: 'mock-u2', displayName: 'Larissa Machado', email: 'larissa.machado@jaboatao.pe.gov.br', department: 'RH', role: 'Servidora' },
    { uid: 'mock-u3', displayName: 'João Silva', email: 'joao.silva@jaboatao.pe.gov.br', department: 'Saúde', role: 'Servidor' },
  ];

  try {
    // Timeout de 4 segundos para evitar que o servidor trave localmente sem credenciais
    const usersPromise = db.collection('users').get();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firestore timeout')), 4000)
    );

    const snapshot = (await Promise.race([usersPromise, timeoutPromise])) as FirebaseFirestore.QuerySnapshot;
    
    const users = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));

    res.status(200).json(users.length > 0 ? users : mockUsers);
  } catch (error) {
    res.status(200).json(mockUsers);
  }
}

/**
 * Sync a user profile to Firestore (Internal helper).
 */
export async function syncUserToFirestore(userData: {
  uid: string;
  email: string;
  displayName: string;
  department?: string;
  role?: string;
}): Promise<void> {
  // Se não temos credenciais de admin, o sync é responsabilidade do frontend
  if (!canSignTokens()) {
    return;
  }

  try {
    const db = getFirestore();
    const { uid, email, displayName, department, role } = userData;

    console.log(`[Users] Syncing user ${uid} to Firestore...`);

    await db.collection('users').doc(uid).set({
      uid,
      email,
      displayName,
      department: department || 'Geral',
      role: role || 'Servidor',
      updatedAt: new Date()
    }, { merge: true });

    console.log(`[Users] User ${uid} synced successfully.`);
  } catch (error) {
    console.error(`[Users] Failed to sync user ${userData.uid}:`, error);
  }
}

/**
 * Create the very first administrator user in Firebase Authentication.
 * SECURITY NOTE: This route should be protected or removed after first use.
 * In production, add an ADMIN_CREATION_SECRET ENV check before allowing user creation.
 */
export async function createUser(req: Request, res: Response): Promise<void> {
  const auth = getAuth();
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    const userRecord = await auth.createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0],
      emailVerified: true,
    });

    res.status(201).json({
      message: 'Usuário criado com sucesso.',
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
    });
  } catch (error: unknown) {
    const fbError = error as { code?: string; message?: string };
    if (fbError.code === 'auth/email-already-exists') {
      res.status(409).json({ error: 'Este e-mail já está cadastrado no sistema.' });
    } else {
      console.error('Erro ao criar usuário:', error);
      res.status(500).json({ error: 'Erro interno ao criar usuário.', detail: fbError.message });
    }
  }
}
