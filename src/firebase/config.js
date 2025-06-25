import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';


const firebaseConfig = {
  apiKey: "AIzaSyChTG51ZFh3_B5eoBC9BFqOzR2hhGfgVaw",
  authDomain: "control-inventario-ventas.firebaseapp.com",
  projectId: "control-inventario-ventas",
  storageBucket: "control-inventario-ventas.firebasestorage.app",
  messagingSenderId: "8853244483",
  appId: "1:8853244483:web:017a85c47eb4ff90e962f6"
};

// Asegurarse de que la app solo se inicialice una vez
let app;
let firestoreDb;
let storageInstance;

try {
  app = initializeApp(firebaseConfig);
  firestoreDb = getFirestore(app);
  storageInstance = getStorage(app);
  console.log("✅ Firebase inicializado correctamente");
} catch (error) {
  console.error("❌ Error inicializando Firebase:", error);
  throw error;
}

export const db = firestoreDb;
export const storage = storageInstance;
