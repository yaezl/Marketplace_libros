// js/perfil.js
import { supabase } from "../supabaseClient.js";

// Elementos del DOM
const nombre = document.getElementById("pf-nombre");
const apellido = document.getElementById("pf-apellido");
const phone = document.getElementById("pf-phone");
const residence = document.getElementById("pf-residence");
const email = document.getElementById("pf-email");
//const verifiedBadge = document.getElementById("pf-verified-badge");
//const idDoc = document.getElementById("pf-id-doc");
const btnSave = document.getElementById("pf-save");

// 🔹 Cargar perfil
async function loadProfile() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    alert("Debés iniciar sesión para acceder al perfil.");
    location.href = "/login.html";
    return;
  }

  const user = userData.user;
  const userId = user.id;

  // Mostrar correo (auth)
  email.value = user.email || "";

  // Traer datos de la tabla profiles
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("nombre, apellido, phone, residence")
    .eq("id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error(error);
    alert("Error al cargar tu perfil");
    return;
  }

  if (profile) {
    nombre.value = profile.nombre || "";
    apellido.value = profile.apellido || "";
    phone.value = profile.phone || "";
    residence.value = profile.residence || "";
   // idDoc.value = profile.id_doc_url || "";

    if (profile.verified) verifiedBadge.classList.remove("d-none");
    else verifiedBadge.classList.add("d-none");
  }
}

// 🔹 Guardar cambios (con toast)
btnSave.addEventListener("click", async (e) => {
  e.preventDefault();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return showToast("Sesión no válida.", true);

  const updates = {
    id: userData.user.id,
    nombre: nombre.value.trim(),
    apellido: apellido.value.trim(),
    phone: phone.value.trim(),
    residence: residence.value.trim(),
    //id_doc_url: idDoc.value.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("profiles").upsert(updates);

  if (error) {
    console.error(error);
    showToast("Error al guardar los cambios 😕", true);
  } else {
    showToast("Perfil actualizado correctamente ✅");
  }
});

// 🔹 Toast helper
function showToast(message, isError = false) {
  const toastEl = document.getElementById("bookea-toast");
  if (!toastEl) return alert(message); // fallback por si falta el div
  const toastBody = toastEl.querySelector(".toast-body");
  toastBody.textContent = message;

  // Cambiar color según tipo
  if (isError) {
    toastEl.classList.remove("text-bg-success");
    toastEl.classList.add("text-bg-danger");
  } else {
    toastEl.classList.remove("text-bg-danger");
    toastEl.classList.add("text-bg-success");
  }

  const toast = new bootstrap.Toast(toastEl);
  toast.show();
}

// Ejecutar al cargar
loadProfile();
