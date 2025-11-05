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

/* ---------- init ---------- */
(async function init() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return (location.href = "/index.html");

  // 1) BOOK (sin joins)
  const { data: book, error: eBook } = await supabase
    .from("books")
    .select(`
      id, owner, title, author, genre, language, cover_type, condition,
      details, description, price, is_tradable, location, created_at, contact_phone_override
    `)
    .eq("id", id)
    .single();
    
  if (eBook || !book) {
    console.error("Error book:", eBook);
    renderNotFound(eBook);
    return;
  }

  // 2) IMAGES
  const { data: images, error: eImgs } = await supabase
    .from("book_images")
    .select("url, position")
    .eq("book_id", id)
    .order("position", { ascending: true });

  if (eImgs) console.warn("Warn images:", eImgs);

  // 3) SELLER PROFILE
  const { data: seller, error: eSeller } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, residence, phone, created_at")
    .eq("id", book.owner)
    .maybeSingle();

  if (eSeller) console.warn("Warn seller:", eSeller);

  renderBook({ ...book, _images: images ?? [], _seller: seller ?? null });
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

function renderBook(book) {
  const imgs = book._images.slice().sort(byPos);
  const main = document.getElementById("mainImage");
  const thumbs = document.getElementById("thumbs");

  // título / autor / breadcrumb
  document.getElementById("bookTitle").textContent = book.title || "Sin título";
  document.getElementById("crumbTitle").textContent = book.title || "Publicación";
  document.getElementById("bookAuthor").textContent = book.author || "—";

  // precio + estado
  document.getElementById("price").textContent = moneyAR(book.price);
  const cond = conditionLabel(book.condition);
  document.getElementById("detailCondition").textContent = cond;

   // ubicación: prioriza la del libro, sino la del vendedor
  const seller = book._seller || {};
  const sellerName =
    seller.nombre + " " + seller.apellido || "Usuario";
  const sellerLoc = seller.residence || "—"; 

  // detalles
  document.getElementById("detailDesc").textContent = book.description || "—";
  document.getElementById("detailGenre").textContent = book.genre || "—";
  document.getElementById("detailLang").textContent = book.language || "—";
  document.getElementById("detailCover").textContent = book.cover_type || "—";
  document.getElementById("detailTrade").textContent = book.is_tradable ? "Disponible" : "No disponible";
  document.getElementById("detailLoc").innerHTML = sellerLoc !== "—" ? `<i class="bi bi-geo-alt me-1"></i>${sellerLoc}` : "—";

  // Descripción larga (de Google Books, suele venir con HTML) -> render HTML
  const descLong = book.details || "";
  document.getElementById("description").innerHTML =
    descLong ? sanitizeBasic(descLong) : "Sin descripción.";

  // galería (con fallback)
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
    const phone = seller.phone || book.contact_phone_override || "";
    if (!phone) {
      alert("El vendedor aún no cargó un teléfono.");
      return;
    }
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
}
