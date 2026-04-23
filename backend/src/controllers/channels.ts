import { Request, Response } from 'express';
import { getFirestore } from '../services/firebase';

export async function createOfficialChannel(req: Request, res: Response): Promise<void> {
  const db = getFirestore();
  try {
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'O nome do canal é obrigatório' });
      return;
    }

    const docRef = await db.collection('channels').add({
      name,
      description: description || '',
      isOfficial: true,
      createdAt: new Date(),
    });

    res.status(201).json({ id: docRef.id, message: 'Canal oficial criado com sucesso.' });
  } catch (error) {
    console.error('Erro ao criar canal:', error);
    res.status(500).json({ error: 'Erro interno ao criar canal.' });
  }
}

export async function listChannels(req: Request, res: Response): Promise<void> {
  const db = getFirestore();
  
  // Mock data as fallback for development without credentials
  const mockChannels = [
    { id: 'mock-1', name: 'Geral', description: 'Canal geral para todos os servidores', isOfficial: true },
    { id: 'mock-2', name: 'Avisos RH', description: 'Comunicados oficiais de Recursos Humanos', isOfficial: true },
    { id: 'mock-3', name: 'Suporte TI', description: 'Suporte técnico e TI da prefeitura', isOfficial: true },
    { id: 'mock-4', name: 'SEGOP', description: 'Secretaria Executiva de Governo Digital e Processos Estratégicos', isOfficial: true },
  ];

  try {
    // Timeout check
    const channelsPromise = db.collection('channels').get();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firestore timeout')), 4000)
    );

    const snapshot = (await Promise.race([channelsPromise, timeoutPromise])) as FirebaseFirestore.QuerySnapshot;
    const channels: any[] = [];
    
    snapshot.forEach((doc) => {
      channels.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(channels.length > 0 ? channels : mockChannels);
  } catch (error) {
    res.status(200).json(mockChannels);
  }
}
