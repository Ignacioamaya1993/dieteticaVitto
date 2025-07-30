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

const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("togglePassword");
const errorEl = document.getElementById("loginError");
const toggleIcon = togglePasswordBtn.querySelector("i");

togglePasswordBtn.addEventListener("click", () => {
  const isPassword = passwordInput.getAttribute("type") === "password";
  passwordInput.setAttribute("type", isPassword ? "text" : "password");

  if (isPassword) {
    toggleIcon.classList.remove("fa-eye");
    toggleIcon.classList.add("fa-eye-slash");
    toggleIcon.style.color = "#000dff";
    togglePasswordBtn.setAttribute("aria-label", "Ocultar contraseña");
  } else {
    toggleIcon.classList.remove("fa-eye-slash");
    toggleIcon.classList.add("fa-eye");
    toggleIcon.style.color = "#999";
    togglePasswordBtn.setAttribute("aria-label", "Mostrar contraseña");
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const pass = passwordInput.value;

  errorEl.textContent = "";

  try {
    await setPersistence(auth, browserLocalPersistence);
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    // Verificar si es admin en Firestore
    const userDocRef = doc(db, "usuarios", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists() && userDocSnap.data().isAdmin === true) {
      window.location.href = "/pages/dashboard.html";
    } else {
      errorEl.textContent = "No tenés permisos para acceder.";
    }
  } catch (err) {
    console.error(err);
    errorEl.textContent = "Error de autenticación.";
  }
});
