// js/perfil.js
import { supabase } from "../supabaseClient.js";

/* ---------- DOM ---------- */
const nombre = document.getElementById("pf-nombre");
const apellido = document.getElementById("pf-apellido");
const phone = document.getElementById("pf-phone");
const residence = document.getElementById("pf-residence");
const email = document.getElementById("pf-email");
const verifiedBadge = document.getElementById("pf-verified-badge");
const btnSave = document.getElementById("pf-save");

/* ---------- Cargar perfil ---------- */
async function loadProfile() {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    alert("Debés iniciar sesión para acceder al perfil.");
    location.href = "/login.html";
    return;
  }
  const user = userData.user;

  // Correo desde auth
  if (email) email.value = user.email || "";

  // Traer fila de profiles
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("nombre, apellido, phone, residence, verified")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("loadProfile error:", error);
    showToast("Error al cargar tu perfil ", true);
    return;
  }

  if (profile) {
    if (nombre) nombre.value = profile.nombre || "";
    if (apellido) apellido.value = profile.apellido || "";
    if (phone) phone.value = profile.phone || "";
    if (residence) residence.value = profile.residence || "";
    if (verifiedBadge) {
      profile.verified
        ? verifiedBadge.classList.remove("d-none")
        : verifiedBadge.classList.add("d-none");
    }
  }
}

/* ---------- Guardar ---------- */
// 🔹 Guardar cambios con UPSERT directo
btnSave.addEventListener("click", async (e) => {
  e.preventDefault();

  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return showToast("Sesión no válida.", true);

    const payload = {
      id: userData.user.id,
      nombre: nombre?.value.trim() || null,
      apellido: apellido?.value.trim() || null,
      phone: phone?.value.trim() || null,
      residence: residence?.value.trim() || null,
    };

    // un solo upsert: crea si no hay fila o actualiza si ya existe
    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload)
      .select("id")
      .single();

    if (error) {
      console.error("Supabase upsert error:", error);
      return showToast(error.message || "Error al guardar los cambios ", true);
    }

    showToast("Perfil guardado correctamente");
  } catch (err) {
    console.error("Save exception:", err);
    showToast("No se pudo guardar. Revisá la consola.", true);
  }
});


/* ---------- Toast helper ---------- */
function showToast(message, isError = false) {
  const el = document.getElementById("bookea-toast");
  if (!el) return alert(message);
  el.querySelector(".toast-body").textContent = message;
  el.classList.remove("text-bg-success", "text-bg-danger");
  el.classList.add(isError ? "text-bg-danger" : "text-bg-success");
  if (window.bootstrap?.Toast) {
    new bootstrap.Toast(el, { autohide: true, delay: 2500 }).show();
  } else {
    alert(message);
  }
}
// --- AVATAR: referencias DOM ---
const avatarImg = document.getElementById("pf-avatar");
const avatarInput = document.getElementById("pf-avatar-file");
const avatarRemove = document.getElementById("pf-avatar-remove");

const DEFAULT_AVATAR = "/assets/img/bookealogo.png";
const BUCKET = "avatars";

// Helper ruta
const avatarPath = (uid) => `${uid}/avatar`;

// Cargar avatar desde storage
async function loadAvatar(uid) {
  try {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(avatarPath(uid));
    const url = data?.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null;

    if (!url) {
      avatarImg.src = DEFAULT_AVATAR;
      localStorage.setItem("avatarIsDefault", "1");
      return;
    }

    // Verificar si existe
    const exists = await fetch(url, { method: "HEAD" })
      .then((r) => r.ok)
      .catch(() => false);

    avatarImg.src = exists ? url : DEFAULT_AVATAR;
    localStorage.setItem("avatarIsDefault", exists ? "0" : "1");
  } catch {
    avatarImg.src = DEFAULT_AVATAR;
  }
}

// Ampliamos loadProfile: agregá esto dentro del tuyo
const _oldLoadProfile = loadProfile;
loadProfile = async function () {
  await _oldLoadProfile(); // ejecuta tu versión original
  const { data: userData } = await supabase.auth.getUser();
  if (userData?.user) await loadAvatar(userData.user.id);
};

// Subir nueva foto
avatarInput?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return showToast("Sesión no válida", true);

  if (!/^image\//.test(file.type))
    return showToast("Elegí una imagen válida", true);
  if (file.size > 2 * 1024 * 1024)
    return showToast("Máximo 2 MB", true);

  const path = avatarPath(userData.user.id);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    console.error("avatar upload error:", error);
    return showToast("No se pudo subir la foto ", true);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  avatarImg.src = `${data.publicUrl}?t=${Date.now()}`;
  localStorage.setItem("avatarVersion", String(Date.now())); // fuerza actualización global
  localStorage - setItem("avatarIsDefault", "0");

  // 2) Pintar INMEDIATO en header/sidebar (sin esperar nada)
  const newUrl = `${data.publicUrl}?t=${Date.now()}`;
  document.querySelectorAll('img[data-user-avatar]').forEach(img => { img.src = `${data.publicUrl}?t=${Date.now()}` });

  // 4) Toast compatible (usa el que tengas disponible)
  if (typeof toast === 'function') {
    toast("Foto actualizada correctamente", "success");
  } else if (typeof showToast === 'function') {
    showToast("Foto actualizada correctamente", "success");
  }
});

// Quitar foto
avatarRemove?.addEventListener("click", async () => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return;

  const path = avatarPath(userData.user.id);
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error("avatar remove error:", error);
    return showToast("No se pudo quitar la foto ", true);
  }

  avatarImg.src = DEFAULT_AVATAR;
  localStorage.setItem("avatarVersion", String(Date.now())); // fuerza volver al logo
  localStorage.setItem("avatarIsDefault", "1");
  // pintar INMEDIATO en header/sidebar
  document.querySelectorAll('img[data-user-avatar]').forEach(img => { img.src = DEFAULT_AVATAR; });

  if (window.paintGlobalAvatar) paintGlobalAvatar(); // refresca al instante

  if (typeof toast === 'function') {
    toast("La foto se quitó correctamente", "success");
  } else if (typeof showToast === 'function') {
    showToast("La foto se quitó correctamente", "success");
  }
});

/* ---------- init ---------- */
loadProfile();
