// js/avatar.js
import { supabase } from "../supabaseClient.js";

const BUCKET = "avatars";
const DEFAULT_AVATAR = "/assets/img/bookealogo.png";
const QSA = (sel) => Array.from(document.querySelectorAll(sel));

async function getAvatarUrl(uid) {
  // La subida la hicimos a <uid>/avatar (sin extensión).
  const path = `${uid}/avatar`;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) return null;

  // Verificamos que exista (si no existe, evitamos imagen rota).
  try {
    const ok = await fetch(`${url}?t=${Date.now()}`, { method: "HEAD" }).then(r => r.ok);
    return ok ? `${url}?t=${Date.now()}` : null;
  } catch {
    return null;
  }
}

async function applyGlobalAvatar() {
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return;

    const avatarUrl = await getAvatarUrl(uid);
    const finalUrl = avatarUrl || DEFAULT_AVATAR;

    QSA('img[data-user-avatar]').forEach(img => {
      // solo reemplazamos si cambió (evita reflows)
      if (img.src !== new URL(finalUrl, location.origin).href) {
        img.src = finalUrl;
      }
    });
  } catch (e) {
    // si algo falla dejamos el default
    console.warn("Avatar global: no se pudo aplicar", e);
  }
}

// Cargar al entrar y cuando cambia el estado de auth
document.addEventListener("DOMContentLoaded", applyGlobalAvatar);
supabase.auth.onAuthStateChange(() => applyGlobalAvatar());
