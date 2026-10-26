// Conexión a Firebase compartida por /firmar y /crm (proyecto cdh-maker-portafolio, plan Spark).
// No hay secretos aquí: la configuración web es pública por diseño de Firebase y la seguridad
// la imponen firestore.rules (solo los correos administradores crean, listan y ensamblan).
// Pruebas locales: http://localhost:<puerto>/crm?emu usa los emuladores de Auth y Firestore.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

export const app = initializeApp({
  apiKey: 'AIzaSyCmeLzxeK_TUHkmKu3G81oKyW6Bg3B-iS0',
  authDomain: 'cdh-maker-portafolio.firebaseapp.com',
  projectId: 'cdh-maker-portafolio',
  messagingSenderId: '520629002740',
  appId: '1:520629002740:web:f923bb6cd535cb2e7519a1',
});
export const db = getFirestore(app);
export const auth = getAuth(app);

export const EMULADOR = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('emu');
if (EMULADOR) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
