import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBXlm5Lm0dfRhY0yHcwzm95-K9LqlYkIo8",
  authDomain: "dietvitto.firebaseapp.com",
  projectId: "dietvitto",
  storageBucket: "dietvitto.firebasestorage.app",
  messagingSenderId: "292156418283",
  appId: "1:292156418283:web:657b64e229a3c4c507f6ae"
};

// ✅ Inicializa Firebase y luego exporta
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ Habilitar caché local (opcional, para offline)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Otra pestaña está abierta, no se habilitó la persistencia.");
  } else if (err.code === "unimplemented") {
    console.warn("El navegador no soporta persistencia local.");
  }
});

// ✅ Exportar después de definir
export { db, app };