import { supabase } from '../supabaseClient.js';

async function verificarSesion() {
  const { data: { session } } = await supabase.auth.getSession();

  const elementosPrivados = document.querySelectorAll('.solo-logueado');
  const elementosPublicos = document.querySelectorAll('.solo-publico');

  if (session) {
    elementosPrivados.forEach(el => el.classList.remove('d-none'));
    elementosPublicos.forEach(el => el.classList.add('d-none'));

    const userData = session.user.user_metadata;
    const saludo = document.getElementById('saludo-usuario');
    if (saludo && userData?.nombre) {
      saludo.textContent = `Hola, ${userData.nombre}`;
    }
  } else {
    elementosPrivados.forEach(el => el.classList.add('d-none'));
    elementosPublicos.forEach(el => el.classList.remove('d-none'));
  }

  // 🔑 Ya resolvimos auth: sacar el estado "desconocido"
  document.documentElement.classList.remove('auth-unknown');
}


// --- LOGOUT ---
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-auth-logout]');
  if (!btn) return;

  e.preventDefault();

  try {
    // Cierra sesión en Supabase (todas las pestañas si querés)
    await supabase.auth.signOut({ scope: 'global' });
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
    // seguimos igual con la redirección
  }

  // Si el offcanvas está abierto en mobile, ocultalo (Bootstrap 5 expone window.bootstrap)
  try {
    const oc = document.querySelector('.offcanvas.show');
    if (oc && window.bootstrap?.Offcanvas) {
      window.bootstrap.Offcanvas.getInstance(oc)?.hide();
    }
  } catch (_) {}

  // Limpiezas opcionales (si guardás algo propio)
  localStorage.removeItem('bookea:session');
  sessionStorage.removeItem('bookea:session');

  // Redirigir (elegí el destino que uses: login o home “invitado”)
  window.location.href = '/index.html';
});




document.addEventListener('DOMContentLoaded', verificarSesion);

// 🔁 Mantener la UI sincronizada si cambia la sesión en runtime (otra pestaña, logout, etc.)
supabase.auth.onAuthStateChange((_event, _session) => {
  verificarSesion();
});

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
    window.location.href = '/login.html';
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
      window.location.href = '/login.html?mode=login';
    });
  }

  if (btnRegister) {
    btnRegister.addEventListener('click', (e) => {
      e.preventDefault();
      // podés usar el query para mostrar la vista "registro" por defecto
      window.location.href = '/login.html?mode=register';
    });
  }
});
