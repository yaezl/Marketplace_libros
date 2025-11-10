// js/libro.js
import { supabase } from "../supabaseClient.js";

/* ---------- helpers ---------- */
const moneyAR = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS" });

const conditionLabel = (c) => ({
  nuevo: "Nuevo",
  como_nuevo: "Como nuevo",
  muy_bueno: "Muy bueno",
  bueno: "Bueno",
  usado: "Usado",
}[c] || "—");

function byPos(a, b) { return (a.position ?? 0) - (b.position ?? 0); }

/** Sanitiza HTML básico (permitimos etiquetas comunes y removemos scripts/handlers) */
function sanitizeBasic(html = "") {
  if (!html) return "";
  // eliminar scripts / iframes
  html = html.replace(/<\/?(script|iframe|embed|object)[^>]*>/gi, "");
  // eliminar on* handlers
  html = html.replace(/\son\w+="[^"]*"/gi, "").replace(/\son\w+='[^']*'/gi, "");
  return html;
}

function applyDynamicBreadcrumb() {
  // 1) query param tiene prioridad
  const src = new URLSearchParams(location.search).get("src");

  // 2) sino, inferí desde el referrer
  const ref = document.referrer || "";
  const from = (src || (
    ref.includes("publicacion_libro") ? "my" :
    ref.includes("wishlist") ? "wishlist" :
    ref.includes("/index") ? "discover" :
    ""
  )).toLowerCase();

  const crumb = document.querySelector('.breadcrumb .breadcrumb-item:first-child a');
  if (!crumb) return;

  switch (from) {
    case "my":
    case "mis":
    case "publicaciones":
      crumb.textContent = "Mis publicaciones";
      crumb.href = "/template/publicacion_libro.html";
      break;
    case "wishlist":
    case "wl":
      crumb.textContent = "Mi wishlist";
      crumb.href = "/template/wishlist.html";
      break;
    default:
      crumb.textContent = "Descubre";
      crumb.href = "/index.html";
  }
}


/* ---------- init (1 sola query con relaciones) ---------- */
(async function init() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return (location.href = "/index.html");

  const { data: book, error } = await supabase
    .from("books")
    .select(`
      id, owner, title, author, genre, language, cover_type, condition,
      details, description, price, is_tradable, location, created_at, contact_phone_override,
      book_images (url, position),
      seller:profiles!books_owner_fkey ( id, nombre, apellido, residence, phone, created_at )
    `)
    .eq("id", id)
    .single();

  if (error || !book) {
    console.error("Error book:", error);
    renderNotFound(error);
    return;
  }

  renderBook(book);
})();

/* ---------- render ---------- */
function renderNotFound(err) {
  document.getElementById("bookTitle").textContent = "Publicación no encontrada";
  document.getElementById("description").textContent =
    "El libro no existe, no es accesible por políticas o fue eliminado.";
  if (err) {
    // Mostrá el detalle en consola para debug
    console.debug("Detail:", err.message || err);
  }
}

/* ---------- render ---------- */
function renderBook(book) {
  const imgs = (book.book_images || []).slice().sort(byPos);
  const main = document.getElementById("mainImage");
  const thumbs = document.getElementById("thumbs");

  // título / autor / breadcrumb
  document.getElementById("bookTitle").textContent = book.title || "Sin título";
  document.getElementById("crumbTitle").textContent = book.title || "Publicación";
  document.getElementById("bookAuthor").textContent = book.author || "—";

  // precio + estado
  document.getElementById("price").textContent = moneyAR(book.price);
  document.getElementById("detailCondition").textContent = conditionLabel(book.condition);

  // vendedor / ubicación
  const seller = book.seller || {};
  const sellerName = `${seller.nombre || ""} ${seller.apellido || ""}`.trim() || "Usuario";
  const sellerLoc = book.location || seller.residence || "—";

  // detalles
  document.getElementById("detailDesc").textContent = book.description || "—";
  document.getElementById("detailGenre").textContent = book.genre || "—";
  document.getElementById("detailLang").textContent = book.language || "—";
  document.getElementById("detailCover").textContent = book.cover_type || "—";
  document.getElementById("detailTrade").textContent = book.is_tradable ? "Disponible" : "No disponible";
  document.getElementById("detailLoc").innerHTML =
    sellerLoc !== "—" ? `<i class="bi bi-geo-alt me-1"></i>${sellerLoc}` : "—";

  // descripción larga (sanitizada)
  const descLong = book.details || "";
  document.getElementById("description").innerHTML =
    descLong ? sanitizeBasic(descLong) : "Sin descripción.";

  // galería
  const firstSrc = imgs[0]?.url || "https://placehold.co/360x480?text=Sin+foto";
  main.src = firstSrc;
  thumbs.innerHTML = "";
  imgs.forEach((img, i) => {
    const d = document.createElement("div");
    d.className = "gallery-thumb" + (i === 0 ? " active" : "");
    d.innerHTML = `<img src="${img.url}" alt="Foto ${i + 1}" style="width:100%;height:100%;object-fit:cover">`;
    d.addEventListener("click", () => {
      main.src = img.url;
      [...thumbs.children].forEach((c, j) => c.classList.toggle("active", i === j));
    });
    thumbs.appendChild(d);
  });

  // vendedor (card)
  document.getElementById("sellerName").textContent = sellerName;
  const avatar = seller.avatar_url || "https://placehold.co/112x112?text=User";
  const imgEl = document.getElementById("sellerAvatar");
  imgEl.src = avatar;
  imgEl.alt = sellerName;

  // Contactar vendedor → WhatsApp
  document.getElementById("contactBtn").onclick = () => {
    const phone = book.contact_phone_override || seller.phone || "";
    if (!phone) return alert("El vendedor aún no cargó un teléfono.");
    const msg = `Hola ${sellerName}, vi "${book.title}" en Bookea. ¿Sigue disponible?`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // compartir
  document.getElementById("shareBtn").onclick = async () => {
    const url = location.href;
    if (navigator.share) {
      try { await navigator.share({ title: book.title, text: "Mirá este libro en Bookea", url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      alert("Enlace copiado al portapapeles");
    }
  };

  // breadcrumbs según origen (ver punto 3)
  applyDynamicBreadcrumb();
}

/* ---------- like en detalle ---------- */
(async function hookLikeInDetail() {
  const btn = document.getElementById('btn-like');
  if (!btn) return;

  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return;

  // estado inicial
  try {
    const { data, error } = await supabase.from('book_likes').select('book_id').eq('book_id', id).eq('user_id', auth.user.id).maybeSingle();
    if (!error && data) btn.innerHTML = '<i class="bi bi-heart-fill text-danger"></i>';
  } catch {}

  btn.addEventListener('click', async () => {
    const icon = btn.querySelector('i');
    await toggleLike(id, await getMyLikedSet(), icon); // reusa helpers de main.js si están globales
  });
})();

/* ---------- Like (book_likes) en detalle ---------- */
(async function attachDetailLike() {
  const btn = document.getElementById('btn-like');
  if (!btn) return; // si no existe en el HTML, no hacemos nada

  const bookId = new URLSearchParams(location.search).get('id');
  if (!bookId) return;

  // helpers locales (standalone)
  async function getUserId() {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  }
  async function isLiked(id) {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id || null;
    if (!uid) return false;

    const { data, error } = await supabase
      .from('book_likes')
      .select('book_id')
      .eq('book_id', id)
      .eq('user_id', uid)           // 👈 filtro por usuario
      .maybeSingle();
    if (error && error.code !== 'PGRST116') console.debug('[like] select error', error);
    return !!data;
  }

  async function setIcon(liked) {
    btn.innerHTML = liked ? '<i class="bi bi-heart-fill text-danger"></i>' : '<i class="bi bi-heart"></i>';
  }

  // 1) Estado inicial + ocultar si es tuyo
  const uid = await getUserId();
  // Si no hay sesión, mostramos vacío y, al click, pedimos login
  if (!uid) await setIcon(false);

  try {
    // Traemos el book para saber owner (ya lo tenés en renderBook, pero acá lo resolvemos sin depender del scope)
    const { data: bookRow } = await supabase.from('books').select('owner').eq('id', bookId).single();

    // Si es tuyo: ocultar botón y salir
    if (uid && bookRow && bookRow.owner === uid) {
      btn.classList.add('d-none');
      return;
    }

    // Estado inicial del corazón
    const liked = uid ? await isLiked(bookId) : false;
    await setIcon(liked);
  } catch (e) {
    console.debug('[like] init error', e);
  }

  // 2) Toggle
  btn.addEventListener('click', async () => {
    const userId = await getUserId();
    if (!userId) return alert('Necesitás iniciar sesión.');

    // mirar estado actual por el icono
    const isFill = !!btn.querySelector('.bi-heart-fill');

    try {
      if (!isFill) {
        const { error } = await supabase.from('book_likes').insert({ user_id: userId, book_id: bookId });
        if (error) throw error;
        await setIcon(true);
      } else {
        const { error } = await supabase
          .from('book_likes')
          .delete()
          .eq('book_id', bookId)
          .eq('user_id', userId);      // 👈 borra solo tu fila
        if (error) throw error;
        await setIcon(false);
      }

    } catch (e) {
      console.error('[like] toggle error', e);
      alert('No pudimos actualizar tu “Me gustaron”.');
    }
  });
})();

