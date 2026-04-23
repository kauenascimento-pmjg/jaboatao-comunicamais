import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { initFirebase } from './services/firebase';
import { createOfficialChannel, listChannels } from './controllers/channels';
import { createUser, listFirestoreUsers, syncUserToFirestore } from './controllers/users';
import { seedDatabase, listUsers, syncUserProfile } from './controllers/admin';

const app = express();
const port = process.env.PORT || 4000;

// Middlewares
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicializa Firebase Admin SDK ANTES de qualquer rota
initFirebase();

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Comunica+ Backend is running' });
});

// Admin — Canais Oficiais
app.post('/api/admin/channels', createOfficialChannel);
app.get('/api/channels', listChannels);

// Admin — Gestão de Usuários
app.post('/api/admin/users', createUser);
app.get('/api/admin/users', listUsers);
app.post('/api/admin/users/:uid/sync', syncUserProfile);

// Usuários (Diretório)
app.get('/api/users', listFirestoreUsers);

// Admin — Database Seed (somente primeira vez)
app.post('/api/admin/seed', seedDatabase);

// Proxy Autenticação AD
app.post('/api/auth/ad', async (req, res) => {
  try {
    const { user, password } = req.body;
    const apiUrl = process.env.PYTHON_AUTH_API;

    console.log('--- AD Proxy Attempt (Backend) ---');
    console.log('User:', user);

    if (!apiUrl) {
      return res.status(500).json({ error: 'Python Auth API URL not configured in Backend' });
    }

    const basicAuth = Buffer.from(`${user}:${password}`).toString('base64');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        user, 
        usuario: user,
        username: user,
        senha: password, 
        password: password 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Python API Error:', errorText);
      return res.status(response.status).json({ error: 'Falha na autenticação AD', details: errorText });
    }

    const data = await response.json() as any;
    console.log('Login Success for:', user);

    // Extrair dados do usuário da resposta da API AD
    const apiUser = data.user || {};
    const uid = apiUser.username || apiUser.user || user;

    // Sync user to Firestore via backend (best effort)
    syncUserToFirestore({
      uid,
      email: apiUser.email || `${uid}@jaboatao.pe.gov.br`,
      displayName: apiUser.full_name || apiUser.nome_completo || apiUser.nome || uid,
      department: apiUser.department || 'Geral'
    }).catch(err => console.error('Failed to auto-sync user:', err));

    // Retorna dados do usuário — Frontend usa Anonymous Auth para sessão Firebase
    res.json({ success: true, user: apiUser, uid });
  } catch (error) {
    console.error('Backend Proxy Auth Error:', error);
    res.status(500).json({ error: 'Internal Server Error during AD auth proxy' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
