import { supabase } from './supabaseClient.js';

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
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  btnLogout.addEventListener('click', async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    // Limpia la sesión y redirige al login
    window.location.href = 'login.html';
  });
}


document.addEventListener('DOMContentLoaded', verificarSesion);
