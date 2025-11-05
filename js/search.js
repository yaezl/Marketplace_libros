// public/js/search.js
import { supabase } from "../supabaseClient.js";

/* ------------------ Constantes ------------------ */
const GENRES = [
  "Fantasía","Ciencia ficción","Romance","Misterio","Thriller","Histórico",
  "No ficción","Biografía","Autoayuda","Infantil","Juvenil","Poesía","Ensayo"
];

const MENDOZA_DEPARTAMENTOS = [
  "Capital","Godoy Cruz","Guaymallén","Las Heras","Luján de Cuyo","Maipú",
  "Lavalle","San Martín","Junín","Rivadavia","Santa Rosa","La Paz",
  "Tunuyán","Tupungato","San Carlos","San Rafael","General Alvear","Malargüe"
];

const $ = (sel) => document.querySelector(sel);
const suggestions = $("#suggestions");
const qInput = $("#q");
const officialBook = $("#officialBook");
const userListings = $("#userListings");

const titleInput = $("#titleInput");
const authorInput = $("#authorInput");
const genreSelect = $("#genreSelect");
const regionSelect = $("#regionSelect");
const searchBtn = $("#searchBtn");
const clearBtn = $("#clearBtn");

/* ------------------ Helpers ------------------ */
function debounce(fn, wait = 300) {
  let t; 
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
function moneyAR(n) {
  return Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}
function coverFromImages(book) {
  return (book.book_images || [])
    .sort((a,b) => (a.position ?? 0) - (b.position ?? 0))[0]?.url || "";
}

/* ------------------ Inicialización combos ------------------ */
function fillCombos() {
  if (!genreSelect || !regionSelect) return;
  GENRES.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g; opt.textContent = g;
    genreSelect.appendChild(opt);
  });
  MENDOZA_DEPARTAMENTOS.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r; opt.textContent = r;
    regionSelect.appendChild(opt);
  });
}

/* ------------------ Google Books ------------------ */
async function googleBooksSuggest(q) {
  if (!q?.trim()) return [];
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=6&printType=books&langRestrict=es`;
  const res = await fetch(url);
  const json = await res.json();
  return json.items || [];
}

function tmplSuggestion(item) {
  const vol = item.volumeInfo || {};
  const title = vol.title ?? "Sin título";
  const author = (vol.authors && vol.authors[0]) || "Autor desconocido";
  const thumb = vol.imageLinks?.thumbnail || "";
  return `
    <a href="#" class="list-group-item list-group-item-action d-flex align-items-center gap-2" 
       data-volume='${encodeURIComponent(JSON.stringify(item))}'>
      ${thumb ? `<img src="${thumb}" width="32" height="48" alt="">` : ""}
      <div>
        <div class="fw-semibold">${title}</div>
        <div class="text-muted small">${author}</div>
      </div>
    </a>`;
}

async function renderOfficial(item) {
  officialBook.innerHTML = "";
  if (!item) return;

  const vol = item.volumeInfo || {};
  const title = vol.title ?? "Sin título";
  const author = (vol.authors && vol.authors.join(", ")) || "Autor desconocido";
  const desc = vol.description ? vol.description.slice(0, 260)+"…" : "";
  const cover = vol.imageLinks?.thumbnail || vol.imageLinks?.smallThumbnail || "";
  const googleId = item.id;

  const html = `
    <div class="card">
      <div class="card-body d-flex gap-3">
        ${cover ? `<img src="${cover}" alt="${title}" width="96" class="rounded">` : ""}
        <div class="flex-grow-1">
          <h5 class="mb-1">${title}</h5>
          <div class="text-muted mb-2">${author}</div>
          <p class="mb-2 small">${desc}</p>
          <button id="addToWishlist" class="btn btn-sm btn-success">
            <i class="bi bi-plus-lg"></i> Agregar a Wishlist
          </button>
        </div>
      </div>
    </div>
  `;
  officialBook.innerHTML = html;

  $("#addToWishlist")?.addEventListener("click", async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Tenés que iniciar sesión para usar la Wishlist.");
      return;
    }
    const payload = {
      user_id: user.id,
      google_volume_id: googleId,
      title,
      author,
      cover_url: cover
    };
    const { error } = await supabase.from("wishlist").insert(payload);
    if (error) {
      console.error(error);
      alert("No se pudo agregar a la wishlist.");
    } else {
      alert("¡Agregado a tu wishlist!");
    }
  });
}

/* ------------------ Publicaciones (Supabase) ------------------ */
async function fetchUserListings({ q, title, author, genre, region }) {
  const t = (title || "").trim();
  const a = (author || "").trim();
  const search = (t || a || q || "").trim();

  let query = supabase
    .from("books") // tabla de publicaciones
    .select(`
      id, title, author, genre, region, price, condition, created_at,
      profiles:profiles!books_user_id_fkey(username, avatar_url),
      book_images(url, position)
    `)
    .order("created_at", { ascending: false })
    .limit(40);

  if (t) query = query.ilike("title", `%${t}%`);
  if (a) query = query.ilike("author", `%${a}%`);
  if (!t && !a && search) {
    query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
  }
  if (genre) query = query.eq("genre", genre);
  if (region) query = query.eq("region", region);

  const { data, error } = await query;
  if (error) { console.error(error); return []; }

  return (data || []).map(b => ({ ...b, cover: coverFromImages(b) }));
}

function renderListings(rows) {
  userListings.innerHTML = "";
  if (!rows.length) {
    userListings.innerHTML = `<div class="text-muted small">No hay publicaciones para esta búsqueda.</div>`;
    return;
  }
  const cards = rows.map(b => `
    <div class="col-12 col-md-6 col-lg-4">
      <div class="card h-100">
        ${b.cover ? `<img src="${b.cover}" class="card-img-top" alt="${b.title}">` : ""}
        <div class="card-body d-flex flex-column">
          <h6 class="mb-1">${b.title}</h6>
          <div class="text-muted small mb-2">${b.author || ""}</div>
          <div class="mt-auto d-flex justify-content-between align-items-center">
            <span class="fw-semibold">${b.price != null ? moneyAR(b.price) : "—"}</span>
            <a href="/publicacion/${b.id}" class="btn btn-sm btn-outline-primary">Ver</a>
          </div>
        </div>
      </div>
    </div>
  `).join("");
  userListings.innerHTML = cards;
}

/* ------------------ Interacciones ------------------ */
const runSuggest = debounce(async () => {
  if (!qInput) return;
  const q = qInput.value.trim();
  if (!q) { suggestions.style.display = "none"; suggestions.innerHTML = ""; return; }
  const items = await googleBooksSuggest(q);
  if (!items.length) { suggestions.style.display = "none"; suggestions.innerHTML = ""; return; }
  suggestions.innerHTML = items.map(tmplSuggestion).join("");
  suggestions.style.display = "block";
}, 300);

qInput?.addEventListener("input", runSuggest);

// Selección de sugerencia
suggestions?.addEventListener("click", async (ev) => {
  const a = ev.target.closest("a.list-group-item");
  if (!a) return;
  ev.preventDefault();
  suggestions.style.display = "none";
  const item = JSON.parse(decodeURIComponent(a.getAttribute("data-volume")));
  qInput.value = item.volumeInfo?.title || qInput.value;

  await renderOfficial(item);
  const rows = await fetchUserListings({
    q: item.volumeInfo?.title || qInput.value,
    title: titleInput?.value,
    author: authorInput?.value,
    genre: genreSelect?.value,
    region: regionSelect?.value
  });
  renderListings(rows);
});

// Botones Buscar / Cancelar
searchBtn?.addEventListener("click", async () => {
  suggestions.style.display = "none";
  officialBook.innerHTML = ""; // si no se eligió sugerencia
  const rows = await fetchUserListings({
    q: qInput?.value,
    title: titleInput?.value,
    author: authorInput?.value,
    genre: genreSelect?.value,
    region: regionSelect?.value
  });
  renderListings(rows);
});

clearBtn?.addEventListener("click", () => {
  if (qInput) qInput.value = "";
  if (titleInput) titleInput.value = "";
  if (authorInput) authorInput.value = "";
  if (genreSelect) genreSelect.value = "";
  if (regionSelect) regionSelect.value = "";
  suggestions.style.display = "none";
  suggestions.innerHTML = "";
  officialBook.innerHTML = "";
  userListings.innerHTML = "";
});

/* ------------------ Init ------------------ */
fillCombos();
