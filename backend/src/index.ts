import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { initFirebase } from './services/firebase';
import { createOfficialChannel, listChannels } from './controllers/channels';
import { createUser, listFirestoreUsers, syncUserToFirestore } from './controllers/users';
import { seedDatabase, listUsers, syncUserProfile } from './controllers/admin';
import { authenticateWithAD } from './controllers/auth';

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

// Proxy Autenticação AD + Firebase Custom Token
app.post('/api/auth/ad', authenticateWithAD);

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
