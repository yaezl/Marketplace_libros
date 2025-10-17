import { supabase } from '../supabaseClient.js';

// Elementos del DOM
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const alerta = document.getElementById('alerta');
const btnLoginTab = document.getElementById('btn-login-tab');
const btnRegisterTab = document.getElementById('btn-register-tab');

// Cambiar entre login / registro
btnLoginTab.addEventListener('click', () => {
  formLogin.classList.remove('d-none');
  formRegister.classList.add('d-none');
  btnLoginTab.classList.replace('btn-outline-dark', 'btn-dark');
  btnRegisterTab.classList.replace('btn-dark', 'btn-outline-dark');
});
btnRegisterTab.addEventListener('click', () => {
  formLogin.classList.add('d-none');
  formRegister.classList.remove('d-none');
  btnRegisterTab.classList.replace('btn-outline-dark', 'btn-dark');
  btnLoginTab.classList.replace('btn-dark', 'btn-outline-dark');
});

function mostrarAlerta(tipo, mensaje) {
  alerta.className = `alert alert-${tipo}`;
  alerta.textContent = mensaje;
  alerta.classList.remove('d-none');
}

// LOGIN
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return mostrarAlerta('danger', error.message);

  mostrarAlerta('success', 'Inicio de sesión exitoso. Redirigiendo...');
  setTimeout(() => window.location.href = 'indexx.html', 1000);
});

// REGISTRO
formRegister.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre = document.getElementById('reg-nombre').value.trim();
  const apellido = document.getElementById('reg-apellido').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const telefono = document.getElementById('reg-telefono').value.trim();
  const password = document.getElementById('reg-password').value;

  // Crear usuario en Supabase Auth
  // Crear usuario en Supabase Auth
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    // 🔹 datos adicionales de tu usuario
    data: { nombre, apellido, telefono },

    // 🔹 URL a la que Supabase redirige tras confirmar el correo
    emailRedirectTo: 'http://127.0.0.1:5500/indexx.html' // o 'indexx.html' si querés que vuelva al inicio
  }
});


  if (error) return mostrarAlerta('danger', error.message);

  mostrarAlerta('info', 'Cuenta creada correctamente. Revisá tu correo para confirmar el registro.');
});
