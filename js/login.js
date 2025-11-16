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

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      let msg = 'Ocurrió un error al iniciar sesión.';

      // Mensajes en español
      if (error.message.includes('Invalid login credentials')) {
        msg = 'Correo o contraseña incorrectos.';
      } else if (error.message.includes('Email not confirmed')) {
        msg = 'Tenés que confirmar tu correo antes de ingresar.';
      } else if (error.message.includes('network')) {
        msg = 'Error de conexión. Verificá tu internet.';
      }

      mostrarAlerta('danger', msg);
      return;
    }

    mostrarAlerta('success', 'Inicio de sesión exitoso. Redirigiendo...');
    setTimeout(() => (window.location.href = 'index.html'), 1000);
  } catch (err) {
    console.error(err);
    mostrarAlerta('danger', 'Hubo un error inesperado. Intentá nuevamente.');
  }
});


// REGISTRO
formRegister.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre = document.getElementById('reg-nombre').value.trim();
  const apellido = document.getElementById('reg-apellido').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const telefono = document.getElementById('reg-telefono').value.trim();
  const password = document.getElementById('reg-password').value;
  const residencia = document.getElementById('reg-residencia').value.trim();

  // Crear usuario en Supabase Auth
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    // 🔹 datos adicionales de tu usuario
    data: { nombre, apellido, telefono, residencia },

    // 🔹 URL a la que Supabase redirige tras confirmar el correo
    emailRedirectTo: `${window.location.origin}/index.html`
  }
});


  if (error) return mostrarAlerta('danger', error.message);

  mostrarAlerta('info', 'Cuenta creada correctamente. Revisá tu correo para confirmar el registro.');
});
// ----- Olvidé mi contraseña -----
const forgotLink = document.getElementById('link-forgot');
if (forgotLink) {
  forgotLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('login-email').value || '').trim();

    if (!email) {
      return mostrarAlerta('warning', 'Ingresá tu correo y después hacé clic en “¿Olvidaste tu contraseña?”.');
    }

    try {
      const redirectTo = `${location.origin}/password-reset.html`; 
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      mostrarAlerta('info', 'Te enviamos un correo para restablecer tu contraseña. Revisá tu bandeja de entrada o spam.');
    } catch (err) {
      console.error(err);
      mostrarAlerta('danger', 'No pudimos enviar el correo de recuperación. Verificá el email.');
    }
  });
}
