// js/search.js
// Filtra las cards ya renderizadas en #libros-lista por título, autor o “Publicado por …”.
// No toca Supabase. Solo show/hide.

const $grid  = document.querySelector("#libros-lista");
const $input = document.querySelector("#search-input");

// --- helpers ---
const norm = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// Devuelve todos los ítems que contengan una card (independiente de clases)
function getCardItems() {
  if (!$grid) return [];
  // hijos directos que tengan .card, y también nietos por si vienen envueltos
  const direct = Array.from($grid.children).filter((n) =>
    n.nodeType === 1 && n.querySelector(".card-body")
  );
  if (direct.length) return direct;

  // fallback: buscar cualquier elemento con .card dentro del grid
  return Array.from($grid.querySelectorAll(":scope *"))
    .filter((n) => n.querySelector && n.querySelector(".card-body"));
}

// Reemplazá COMPLETO extractSearchText por esta versión
function extractSearchText(item) {
  const body = item.querySelector(".card-body");
  if (!body) return "";

  const parts = [];

  // 1) Intentar encontrar el título en varios selectores comunes
  const titleEl =
    body.querySelector("[data-book-title]") ||
    body.querySelector(".card-title") ||
    body.querySelector("h6, h5") ||
    body.querySelector("a.stretched-link, a[href*='libro']") ||
    body.querySelector(".fw-semibold");
  const title = titleEl?.textContent?.trim() || "";
  if (title) parts.push(title);

  // 2) Autor: primer texto "muted"
  const author =
    body.querySelector(".small, .text-muted, small")?.textContent?.trim() || "";
  if (author) parts.push(author);

  // 3) “Publicado por …” si existe
  const muteds = body.querySelectorAll(".small, .text-muted, small");
  for (const el of muteds) {
    const txt = el.textContent || "";
    if (/publicado por/i.test(txt)) {
      parts.push(txt.trim());
      break;
    }
  }

  // 4) Alt de la imagen (muchas portadas incluyen el título aquí)
  const imgAlt = item.querySelector(".ratio img[alt]")?.getAttribute("alt") || "";
  if (imgAlt) parts.push(imgAlt);

  // 5) Fallback: todo el texto del body (por si el título está en otro nodo)
  if (!parts.length) {
    parts.push(body.textContent || "");
  }

  return norm(parts.join(" "));
}


function indexCards(items = getCardItems()) {
  items.forEach((el) => {
    el.dataset.search = extractSearchText(el);
    // Aseguro que el ítem pueda ocultarse/mostrarse
    el.classList.remove("d-none");
  });
}

function applyFilter(term) {
  const q = norm(term);
  const items = getCardItems();

  if (!q) {
    items.forEach((el) => el.classList.remove("d-none"));
    return;
  }

  items.forEach((el) => {
    // si aún no tiene index, lo genero ahora
    if (!el.dataset.search) el.dataset.search = extractSearchText(el);
    const hay = (el.dataset.search || "").includes(q);
    el.classList.toggle("d-none", !hay);
  });

  toggleNoResults();
}

// Mostrar mensaje si no quedan cards visibles
function toggleNoResults() {
  const $msg = document.querySelector("#no-results");
  if (!$msg) return;
  const visible = Array.from(getCardItems()).some(
    (el) => !el.classList.contains("d-none")
  );
  $msg.classList.toggle("d-none", visible);
}


function debounce(fn, ms = 250) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// --- init ---
indexCards();

// Si main.js agrega/repinta, reindexamos automáticamente
if ($grid) {
  const obs = new MutationObserver((muts) => {
    const added = [];
    muts.forEach((m) => {
      m.addedNodes.forEach((n) => {
        if (n.nodeType === 1) {
          if (n.querySelector?.(".card-body")) added.push(n);
          n.querySelectorAll?.(".card-body")?.forEach?.(() => added.push(n));
        }
      });
    });
    if (added.length) indexCards(getCardItems());
  });
  obs.observe($grid, { childList: true, subtree: true });
}

// Inputs de búsqueda: desktop + móvil
const $inputDesktop = document.querySelector("#search-input");
const $inputMobile  = document.querySelector("#search-input-mobile");

// Función común de filtrado (con debounce)
const handleSearch = debounce((value) => applyFilter(value || ""), 250);

// Escuchar ambos y sincronizar valores entre sí
[$inputDesktop, $inputMobile].forEach((inp) => {
  if (!inp) return;
  inp.addEventListener("input", (e) => {
    const val = e.target.value;
    // sincronizamos ambos campos
    [$inputDesktop, $inputMobile].forEach((other) => {
      if (other && other !== inp) other.value = val;
    });
    handleSearch(val);
  });
});
