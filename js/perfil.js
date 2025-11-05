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
      return showToast(error.message || "Error al guardar los cambios 😕", true);
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

/* ---------- init ---------- */
loadProfile();
