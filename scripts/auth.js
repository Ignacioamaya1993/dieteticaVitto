import {
  getAuth,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

import { db, app } from "/scripts/firebaseConfig.js";

const auth = getAuth(app);

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  const errorEl = document.getElementById("loginError");

  try {
    await setPersistence(auth, browserLocalPersistence);
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    // Verificar si es admin en Firestore
    const userDocRef = doc(db, "usuarios", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists() && userDocSnap.data().isAdmin === true) {
      window.location.href = "./dashboard.html";
    } else {
      errorEl.textContent = "No tenés permisos para acceder.";
    }

  } catch (err) {
    console.error(err);
    errorEl.textContent = "Error de autenticación.";
  }
});