import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

let canSign = false;
let isInitialized = false;

export function initFirebase() {
  if (isInitialized) return;

  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const projectId = process.env.FIREBASE_PROJECT_ID || 'pmjg-apps-hmol';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    // Identificar se estamos em ambiente Cloud (GCP/Vercel/etc)
    const isCloudEnv = !!(process.env.K_SERVICE || process.env.GAE_INSTANCE || process.env.GOOGLE_APPLICATION_CREDENTIALS);

    if (projectId && clientEmail && privateKey) {
      // Opção 1: Credenciais explícitas via ENV (Ideal para dev e produção sem arquivo JSON)
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      canSign = true;
      console.log('✅ Firebase Admin: Inicializado com Chave Privada (assinatura ativada).');
    } else if (serviceAccountPath && fs.existsSync(path.resolve(serviceAccountPath))) {
      // Opção 2: Arquivo JSON local
      const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(serviceAccountPath), 'utf-8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      canSign = true;
      console.log('✅ Firebase Admin: Inicializado via arquivo JSON (assinatura ativada).');
    } else if (isCloudEnv) {
      // Opção 3: Tentar ADC apenas se houver indício de ambiente Cloud
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
      canSign = true; 
      console.log('✅ Firebase Admin: Inicializado via Application Default Credentials.');
    } else {
      // Local sem credenciais — Usar apenas o Project ID
      admin.initializeApp({
        projectId,
      });
      canSign = false;
      console.log('🔗 Firebase: Conectado ao projeto', projectId);
    }

    isInitialized = true;
  } catch (error) {
    console.error('❌ Firebase Admin: Erro de inicialização:', error);
    // Não encerra o processo se falhar, apenas marca como não-assinável
    canSign = false;
    isInitialized = true;
  }
}

// Lazy getters
export const getFirestore = () => {
  const dbId = process.env.FIREBASE_DATABASE_ID || 'comunica-mais';
  return admin.firestore(dbId);
};
export const getAuth = () => admin.auth();
export const canSignTokens = () => canSign;
