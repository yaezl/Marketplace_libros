import { supabase } from '../supabaseClient.js';

async function verificarSesion() {
  const { data: { session } } = await supabase.auth.getSession();

  const elementosPrivados = document.querySelectorAll('.solo-logueado');
  const elementosPublicos = document.querySelectorAll('.solo-publico');

  if (session) {
    elementosPrivados.forEach(el => el.classList.remove('d-none'));
    elementosPublicos.forEach(el => el.classList.add('d-none'));

    // Mostrar nombre en el saludo
    const userData = session.user.user_metadata;
    const saludo = document.getElementById('saludo-usuario');
    if (saludo && userData?.nombre) {
      saludo.textContent = `Hola, ${userData.nombre}`;
    }
  } else {
    elementosPrivados.forEach(el => el.classList.add('d-none'));
    elementosPublicos.forEach(el => el.classList.remove('d-none'));
  }
}
// LOGOUT
// --- LOGOUT ---
document.addEventListener('DOMContentLoaded', () => {
  const btnLogout = document.getElementById('btn-logout');

  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();

      // 1. Cierra la sesión en Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error al cerrar sesión:', error.message);
        return;
      }

      // 2. Redirige al inicio (modo invitado)
      window.location.href = 'indexx.html';
    });
  }
});



document.addEventListener('DOMContentLoaded', verificarSesion);
// GATEO: si no hay sesión, pedir login en acciones protegidas
document.addEventListener('click', async (e) => {
  // Obtenemos sesión actual
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return; // logueada: dejar pasar

  // Buscar si el click fue en algo que requiera auth (o sus padres)
  const target = e.target.closest('[data-auth-required]');
  const clicEnLista = e.target.closest('#libros-lista');

  if (target || clicEnLista) {
    e.preventDefault();
    // Opcional: guardar a dónde quería ir (para volver luego del login)
    // localStorage.setItem('postLoginRedirect', window.location.href);
    window.location.href = 'login.html';
  }
});
// --- Navegación directa desde los botones de la barra pública ---
document.addEventListener('DOMContentLoaded', () => {
  const btnLogin = document.getElementById('btn-login');
  const btnRegister = document.getElementById('btn-register');

  if (btnLogin) {
    btnLogin.addEventListener('click', (e) => {
      e.preventDefault();
      // podés usar el query para mostrar la vista "login" por defecto
      window.location.href = 'login.html?mode=login';
    });
  }

  if (btnRegister) {
    btnRegister.addEventListener('click', (e) => {
      e.preventDefault();
      // podés usar el query para mostrar la vista "registro" por defecto
      window.location.href = 'login.html?mode=register';
    });
  }
});
