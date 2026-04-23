import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { initFirebase, getFirestore } from './src/services/firebase';

dotenv.config();
initFirebase();

async function checkFirestore() {
  console.log('--- Firestore Connectivity Check ---');
  try {
    const db = getFirestore();
    console.log('Attempting to list users collection...');
    const snapshot = await db.collection('users').limit(1).get();
    console.log(`Success! Found ${snapshot.size} users.`);
    
    console.log('Attempting to check channels...');
    const channels = await db.collection('channels').limit(1).get();
    console.log(`Success! Found ${channels.size} channels.`);
  } catch (error) {
    console.error('Firestore connection failed!');
    console.error(error);
  }
}

checkFirestore();
