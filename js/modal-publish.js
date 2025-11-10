import { supabase } from "../supabaseClient.js";

/* ----------- helpers ------------ */
function humanize(s = "") {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toast(message, variant = "success") {
  const wrap = document.getElementById("toastArea");
  if (!wrap) return alert(message); // fallback si falta container

  const el = document.createElement("div");
  el.className = `toast align-items-center text-bg-${variant} border-0`;
  el.setAttribute("role", "alert");
  el.setAttribute("aria-live", "assertive");
  el.setAttribute("aria-atomic", "true");
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
    </div>
  `;
  wrap.appendChild(el);
  const t = new bootstrap.Toast(el, { delay: 2500 });
  t.show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

function finalizeMyBookCardCover(bookId, newUrl) {
  const col = document.querySelector(`.col[data-book-id="${bookId}"]`);
  if (!col) return;
  const img = col.querySelector("[data-cover]");
  if (img && newUrl) img.src = newUrl;
  const badge = col.querySelector(".badge.text-bg-warning");
  if (badge) badge.remove();
}

(() => {
  // ---------- Modal base ----------
  const modal = document.getElementById("bookModal");
  const dialog = modal?.querySelector(".ml-modal__dialog");
  const closeBtn = document.getElementById("closeModalBtn");
  const openers = document.querySelectorAll('[data-open="publish"]');
  const body = document.body;
  const ocMenu = document.getElementById("ocMenu");

  if (!modal || !dialog || !closeBtn) return;

  // offcanvas body flag
  if (ocMenu) {
    ocMenu.addEventListener("show.bs.offcanvas", () =>
      body.classList.add("offcanvas-open")
    );
    ocMenu.addEventListener("hidden.bs.offcanvas", () =>
      body.classList.remove("offcanvas-open")
    );
  }

  // Focus trap
  const focusSelectors = [
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  let lastFocused = null;
  const getFocusable = () =>
    Array.from(dialog.querySelectorAll(focusSelectors)).filter(
      (el) => el.offsetParent !== null || el === closeBtn
    );

  function openModal() {
    lastFocused = document.activeElement;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    body.classList.add("no-scroll");
    const first = getFocusable()[0];
    (first || dialog).focus();
    document.addEventListener("keydown", onKey);
    modal.addEventListener("click", onBackdrop);
  }
  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    body.classList.remove("no-scroll");
    document.removeEventListener("keydown", onKey);
    modal.removeEventListener("click", onBackdrop);
    // reset simple al cerrar
    const form = document.getElementById("bookForm");
    if (form) form.reset();
    if (lastFocused && typeof lastFocused.focus === "function")
      lastFocused.focus();
    // volver a paso 1 siempre
    setStep(1);
  }
  function onBackdrop(e) {
    if (e.target?.dataset?.close === "true") closeModal();
  }
  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key === "Tab") {
      const f = getFocusable();
      if (!f.length) return;
      const first = f[0],
        last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  openers.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (ocMenu?.classList.contains("show")) {
        const offc =
          bootstrap.Offcanvas.getInstance(ocMenu) ||
          new bootstrap.Offcanvas(ocMenu);
        offc.hide();
        ocMenu.addEventListener("hidden.bs.offcanvas", openModal, {
          once: true,
        });
      } else {
        openModal();
      }
    });
  });
  closeBtn.addEventListener("click", closeModal);

  // ---------- Wizard ----------
  const stepsEl = document.getElementById("wizardSteps");
  const stepPanels = Array.from(document.querySelectorAll(".wizard-step"));
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnSubmit = document.getElementById("btnSubmit");
  let currentStep = 1; // 1..3

  function setStep(n) {
    currentStep = Math.max(1, Math.min(3, n));
    stepPanels.forEach((sec) => {
      const isActive = Number(sec.dataset.step) === currentStep;
      sec.classList.toggle("d-none", !isActive);
      sec.setAttribute("aria-hidden", String(!isActive));
    });
    // stepper visual
    if (stepsEl) {
      stepsEl.querySelectorAll("li").forEach((li, idx) => {
        li.classList.toggle("active", idx === currentStep - 1);
      });
    }
    btnPrev.disabled = currentStep === 1;
    btnNext.classList.toggle("d-none", currentStep === 3);
    btnSubmit.classList.toggle("d-none", currentStep !== 3);
  }

  btnPrev.addEventListener("click", () => setStep(currentStep - 1));
  btnNext.addEventListener("click", () => {
    if (currentStep === 1) {
      // Paso 1: exigir título y autor (vengan de auto o manual)
      const title = document.getElementById("bookTitle")?.value?.trim() || "";
      const author = document.getElementById("bookAuthor")?.value?.trim() || "";
      if (!title || !author) {
        (title
          ? document.getElementById("bookAuthor")
          : document.getElementById("bookTitle")
        ).focus();
        return;
      }
    }

    if (currentStep === 2) {
      const cond = document.getElementById("bookCondition")?.value;
      const lang = document.getElementById("bookLanguage")?.value;
      const langO = document.getElementById("bookLanguageOther")?.value?.trim();
      const cover = document.getElementById("bookCover")?.value;
      const price = document.getElementById("bookPrice")?.value;

      const langOk = lang && (lang !== "otro" || !!langO);

      if (!cond || !langOk || !cover || !price) {
        (!cond
          ? document.getElementById("bookCondition")
          : !lang
          ? document.getElementById("bookLanguage")
          : lang === "otro" && !langO
          ? document.getElementById("bookLanguageOther")
          : !cover
          ? document.getElementById("bookCover")
          : document.getElementById("bookPrice")
        ).focus();
        return;
      }
    }

    setStep(currentStep + 1);
  });

  // ---------- Google Books ----------
  // Placeholder 50x70 para thumbnails del autocomplete (SVG inline)
  const PH_50x70 =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="50" height="70">
    <rect width="100%" height="100%" fill="#eee"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
          font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="8" fill="#888">
      Sin portada
    </text>
  </svg>`);

  const API_BASE = "https://www.googleapis.com/books/v1/volumes";
  const searchInput = document.getElementById("searchBook");
  const resultsDiv = document.getElementById("autocompleteResults");
  const manualBtn = document.getElementById("manualEntryBtn");
  let debounceTimer;
  let isManualMode = false;
  let abortController = null;

  function buildGoogleBooksQuery(searchText) {
    const text = searchText.trim();
    if (text.includes(",")) {
      const parts = text.split(",").map((s) => s.trim());
      const titlePart = parts[0];
      const authorPart = parts[1] || "";
      let query = `intitle:"${titlePart}"`;
      if (authorPart) query += `+inauthor:"${authorPart}"`;
      return query;
    }
    return `intitle:${text}`;
  }

  async function searchGoogleBooks(query) {
    if (abortController) abortController.abort();
    abortController = new AbortController();
    try {
      const searchQuery = buildGoogleBooksQuery(query);
      const url = `${API_BASE}?q=${encodeURIComponent(
        searchQuery
      )}&maxResults=10&orderBy=relevance&langRestrict=es`;
      const response = await fetch(url, { signal: abortController.signal });
      if (!response.ok) throw new Error("Error en la búsqueda");
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      if (error.name === "AbortError") return null;
      throw error;
    }
  }

  function formatBookResult(item) {
    const vi = item.volumeInfo || {};
    const title = vi.title || "Sin título";
    const authors = (vi.authors || ["Autor desconocido"]).join(", ");
    const year = vi.publishedDate ? vi.publishedDate.substring(0, 4) : "";
    const thumbnail =
      vi.imageLinks?.thumbnail || vi.imageLinks?.smallThumbnail || PH_50x70; // 👈 local / data-URI, sin dominios externos
    return { id: item.id, title, authors, year, thumbnail, volumeInfo: vi };
  }

  function displayGoogleBooksResults(items) {
    if (!items || items.length === 0) {
      resultsDiv.innerHTML =
        '<div class="p-2 small text-secondary">No se encontraron resultados</div>';
      return;
    }
    const formatted = items.map(formatBookResult);
    resultsDiv.innerHTML = formatted
      .map(
        (book) => `
    <div class="autocomplete-item" data-book-id="${book.id}">
      <img src="${book.thumbnail}" alt="${book.title}" class="book-cover" />
      <div class="book-info">
        <div class="book-title">${book.title}</div>
        <div class="book-author">${book.authors}${
          book.year ? " · " + book.year : ""
        }</div>
      </div>
    </div>
  `
      )
      .join("");
  }

  async function selectGoogleBook(bookId) {
    try {
      const response = await fetch(`${API_BASE}/${bookId}`);
      const data = await response.json();
      const volumeInfo = data.volumeInfo || {};

      document.getElementById("bookTitle").value = volumeInfo.title || "";
      document.getElementById("bookAuthor").value = (
        volumeInfo.authors || []
      ).join(", ");
      document.getElementById("bookGenre").value = (
        volumeInfo.categories || []
      ).join(", ");
      document.getElementById("bookDescription").value =
        volumeInfo.description || "";

      searchInput.value = volumeInfo.title || "";
      resultsDiv.style.display = "none";

      let badge = document.querySelector(".info-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "info-badge ms-2 small text-success fw-semibold";
        searchInput.parentElement.appendChild(badge);
      }
      badge.textContent =
        "✓ Información autocompletada desde Google Books. Revisá y continuá →";

      // quedarse en paso 1
      setStep(1);
      setTimeout(() => {
        const title = document.getElementById("bookTitle");
        title?.focus({ preventScroll: false });
        title?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    } catch (err) {
      console.error("Error al obtener detalles del libro:", err);
    }
  }

  // Botón carga manual
  manualBtn.addEventListener("click", function () {
    isManualMode = !isManualMode;

    const titleInput = document.getElementById("bookTitle");
    const authorInput = document.getElementById("bookAuthor");
    const genreInput = document.getElementById("bookGenre");
    const descInput = document.getElementById("bookDescription");

    if (isManualMode) {
      manualBtn.textContent = "🔍 Volver a búsqueda automática";
      manualBtn.classList.add("manual-mode");
      searchInput.disabled = true;
      searchInput.placeholder = "Modo manual activado";

      [titleInput, authorInput, genreInput, descInput].forEach((el) => {
        el.classList.remove("readonly-field");
        el.removeAttribute("readonly");
      });
      titleInput.placeholder = "Ingresa el título del libro";
      authorInput.placeholder = "Ingresa el/los autor(es)";
      genreInput.placeholder = "Ingresa el género (opcional)";
      descInput.placeholder = "Ingresa una descripción (opcional)";

      const badge = document.querySelector(".info-badge");
      if (badge) badge.remove();

      setStep(1);
      setTimeout(() => titleInput.focus(), 100);
    } else {
      manualBtn.textContent =
        "✏️ No encuentro mi libro, quiero cargarlo manualmente";
      manualBtn.classList.remove("manual-mode");
      searchInput.disabled = false;
      searchInput.placeholder =
        "Empieza a escribir el título o autor del libro...";
      searchInput.value = "";

      [titleInput, authorInput, genreInput, descInput].forEach((el) => {
        el.classList.add("readonly-field");
        el.setAttribute("readonly", "readonly");
        el.value = "";
      });
      titleInput.placeholder = "Se completará automáticamente";
      authorInput.placeholder = "Se completará automáticamente";
      genreInput.placeholder = "Se completará automáticamente";
      descInput.placeholder = "Se completará automáticamente";

      searchInput.focus();
      setStep(1);
    }
  });

  // Autocomplete en tiempo real
  searchInput.addEventListener("input", function (e) {
    if (isManualMode) return;
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();

    if (query.length < 3) {
      resultsDiv.style.display = "none";
      return;
    }
    resultsDiv.innerHTML =
      '<div class="p-2 small text-secondary">Buscando en Google Books...</div>';
    resultsDiv.style.display = "block";

    debounceTimer = setTimeout(async () => {
      try {
        const items = await searchGoogleBooks(query);
        if (items === null) return;
        displayGoogleBooksResults(items);
      } catch (error) {
        resultsDiv.innerHTML =
          '<div class="p-2 small text-danger">Error al buscar. Intentá de nuevo.</div>';
      }
    }, 400);
  });

  // Click en resultado
  resultsDiv.addEventListener("click", function (e) {
    const item = e.target.closest(".autocomplete-item");
    if (!item) return;
    const bookId = item.getAttribute("data-book-id");
    selectGoogleBook(bookId);
  });

  // Cerrar resultados al hacer click fuera
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".autocomplete-wrapper")) {
      resultsDiv.style.display = "none";
    }
  });

  // --- Idioma: manejar opción "Otro" ---
  const langSel = document.getElementById("bookLanguage");
  const langOther = document.getElementById("bookLanguageOther");
  const langHelp = document.getElementById("bookLanguageHelp");

  function syncLang() {
    const isOther = langSel.value === "otro";
    langOther.classList.toggle("d-none", !isOther);
    langHelp.classList.toggle("d-none", !isOther);
    langOther.required = isOther;
    if (!isOther) langOther.value = "";
  }
  syncLang();
  langSel.addEventListener("change", syncLang);

  // ===== IG-STYLE MULTI IMAGE UPLOADER =====
  const igStage = document.getElementById("igStage");
  const igEmpty = document.getElementById("igEmpty");
  const igMain = document.getElementById("igMain");
  const igTray = document.getElementById("igTray");
  const igAddBtn = document.getElementById("igAddBtn");
  const igPickBtn = document.getElementById("igPickBtn");
  const fileInputIG = document.getElementById("bookPhotos");
  const igUploader = document.getElementById("igUploader"); // <div class="ig-uploader" ...>
  // === Estado del uploader / edición (una sola vez) ===
  let igFiles = [];          // matriz con {kind:'new'|'existing', ...}
  let igCurrent = 0;
  let editingId = null;

  const MIN_PHOTOS = 3;
  const countKept = () =>
    igFiles.filter(it => !(it.kind === 'existing' && it.toDelete)).length;


let igErrorEl = null;
function showPhotoError(msg) {
  if (!igErrorEl) {
    igErrorEl = document.createElement("div");
    igErrorEl.id = "igError";
    igErrorEl.setAttribute("role", "alert");
    igErrorEl.className = "mt-2";
    igErrorEl.style.background = "var(--brand-100)";      // #FAE1DA
    igErrorEl.style.border = "1px solid var(--brand-600)"; // #E47154
    igErrorEl.style.color = "var(--ml-neutral-900)";
    igErrorEl.style.borderRadius = "10px";
    igErrorEl.style.padding = "10px 12px";
    // Insertarlo inmediatamente debajo del uploader (después de las miniaturas)
    igUploader?.parentNode?.insertBefore(igErrorEl, igUploader.nextSibling);
  }
  igErrorEl.textContent = msg;
  igErrorEl.classList.remove("d-none");
}
function clearPhotoError() {
  if (igErrorEl) igErrorEl.classList.add("d-none");
}

// Helpers (uploader)
const isImage = (f) => f && f.type && f.type.startsWith("image/");

const readAsDataURL = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

// Devuelve la imagen a mostrar (dataURL si es File, o la URL si es existente)
async function getPreview(it) {
  if (it.file) return await readAsDataURL(it.file);
  return it.preview || it.url || "";
}

// Render principal
async function renderStage() {
  if (!igFiles.length) {
    igEmpty.classList.remove("d-none");
    igMain.classList.add("d-none");
    igMain.src = "";
    return;
  }
  igEmpty.classList.add("d-none");
  igMain.classList.remove("d-none");
  const it = igFiles[igCurrent];
  igMain.src = await getPreview(it);
}

// Render miniaturas + drag & drop reordenable
async function renderTray() {
  igTray.innerHTML = "";
  for (let idx = 0; idx < igFiles.length; idx++) {
    const it = igFiles[idx];
    const url = await getPreview(it);
    const item = document.createElement("div");
    item.className = "ig-thumb" + (idx === igCurrent ? " active" : "") + (it.toDelete ? " opacity-50" : "");
    item.draggable = true;
    item.dataset.index = String(idx);
    item.innerHTML = `
      <img src="${url}" alt="miniatura ${idx + 1}" />
      <button type="button" class="ig-del" aria-label="Eliminar">&times;</button>
    `;

    // seleccionar
    item.addEventListener("click", (e) => {
      if (e.target.closest(".ig-del")) return;
      igCurrent = idx;
      renderStage();
      renderTray();
    });

    // eliminar / marcar para borrar
    item.querySelector(".ig-del").addEventListener("click", (e) => {
      e.stopPropagation();
      const current = igFiles[idx];
      if (current.kind === "existing") {
        current.toDelete = !current.toDelete; // toggle
      } else {
        igFiles.splice(idx, 1);
        if (igCurrent >= igFiles.length) igCurrent = Math.max(0, igFiles.length - 1);
      }
      // reindex positions visuales
      igFiles.forEach((f, i) => (f.position = i + 1));
      renderStage();
      renderTray();
    });

    // drag & drop reorden
    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", String(idx));
      item.style.opacity = 0.5;
    });
    item.addEventListener("dragend", () => (item.style.opacity = 1));
    item.addEventListener("dragover", (e) => e.preventDefault());
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      const to = idx;
      if (Number.isNaN(from)) return;
      const [moved] = igFiles.splice(from, 1);
      igFiles.splice(to, 0, moved);
      if (igCurrent === from) igCurrent = to;
      else if (from < igCurrent && to >= igCurrent) igCurrent--;
      else if (from > igCurrent && to <= igCurrent) igCurrent++;
      igFiles.forEach((f, i) => (f.position = i + 1));
      renderTray();
      renderStage();
    });

    igTray.appendChild(item);
  }
}

// Agregar archivos (desde input o drop) como 'new'
function addFiles(files) {
  const newOnes = Array.from(files).filter(isImage);
  if (!newOnes.length) return;
  const mapped = newOnes.map((file, i) => ({
    kind: "new",
    file,
    url: "",
    preview: URL.createObjectURL(file),
    position: igFiles.length + i + 1,
  }));
  igFiles.push(...mapped);
  if (igFiles.length === mapped.length) igCurrent = 0; // si fueron las primeras
  renderStage();
  renderTray();
  if (countKept() >= MIN_PHOTOS) clearPhotoError();
}


  // Handlers de UI
  igAddBtn.addEventListener("click", () => fileInputIG.click());
  igPickBtn.addEventListener("click", () => fileInputIG.click());
  fileInputIG.addEventListener("change", (e) => addFiles(e.target.files));

  // Arrastrar sobre el stage para agregar
  ["dragenter", "dragover"].forEach((ev) =>
    igStage.addEventListener(ev, (e) => {
      e.preventDefault();
      igStage.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    igStage.addEventListener(ev, (e) => {
      e.preventDefault();
      igStage.classList.remove("dragover");
    })
  );
  igStage.addEventListener("drop", (e) => {
    const files = e.dataTransfer?.files || [];
    addFiles(files);
  });

  // Teclas rápidas en el stage
  igStage.addEventListener("keydown", (e) => {
    if (!igFiles.length) return;
    if (e.key === "ArrowRight") {
      igCurrent = (igCurrent + 1) % igFiles.length;
      renderStage();
      renderTray();
    }
    if (e.key === "ArrowLeft") {
      igCurrent = (igCurrent - 1 + igFiles.length) % igFiles.length;
      renderStage();
      renderTray();
    }
  });

  // Inicial
  renderStage();
  renderTray();
if (igFiles.length >= MIN_PHOTOS) clearPhotoError();

  // ===== Conexión con Supabase =====
  const BUCKET_NAME = "bookea-images";

  function getFinalLanguage() {
    const sel = document.getElementById("bookLanguage");
    const other = document.getElementById("bookLanguageOther");
    return sel.value === "otro" ? other?.value?.trim() || "otro" : sel.value;
  }

  async function getCurrentProfileName() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "Usuario";
    const { data: profile } = await supabase
      .from("profiles")
      .select("nombre, apellido")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) return "Usuario";
    return (
      `${profile.nombre || ""} ${profile.apellido || ""}`.trim() || "Usuario"
    );
  }

  async function uploadBookImages(userId, bookId, files) {
    // Subimos en paralelo y mantenemos el orden por índice
    const BUCKET_NAME = "bookea-images";
    const tasks = Array.from(files).map((file, position) => {
      const ext = (file.type.split("/")[1] || "jpg").toLowerCase();
      const path = `${userId}/${bookId}/${position}.${ext}`;
      return supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, { upsert: false })
        .then(({ error }) => {
          if (error) throw error;
          const { data: pub } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(path);
          return { url: pub.publicUrl, position };
        });
    });

    // lanza todo junto
    const results = await Promise.all(tasks);
    // ya vienen ordenadas por position
    return results;
  }

  async function insertBookImages(bookId, urls) {
    if (!urls.length) return;
    const rows = urls.map((u) => ({
      book_id: bookId,
      url: u.url,
      position: u.position,
    }));
    const { error } = await supabase.from("book_images").insert(rows);
    if (error) throw error;
  }

  function renderMyBookCard({
    id,
    title,
    price,
    condition,
    cover_url,
    publisher,
    pending = false,
  }) {
    const grid = document.getElementById("myListingsGrid");
    if (!grid) return;

    const col = document.createElement("div");
    col.className = "col";
    col.dataset.bookId = String(id); // clave para luego actualizar la portada

    col.innerHTML = `
    <div class="card h-100 shadow-sm border-0 rounded-3 position-relative">
      ${
        pending
          ? `
        <span class="position-absolute top-0 start-0 m-2 badge text-bg-warning">Publicando…</span>
      `
          : ``
      }
      <div class="position-relative">
        <div class="ratio ratio-3x4">
          <img data-cover src="${
            cover_url || "/assets/img/placeholder-3x4.png"
          }" alt="${title}" class="w-100 h-100 object-fit-cover">
        </div>
        <div class="position-absolute top-0 end-0 p-1">
          <div class="dropdown">
            <button class="btn btn-light btn-sm rounded-circle border-0" data-bs-toggle="dropdown" aria-expanded="false">
              <i class="bi bi-three-dots"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><a class="dropdown-item" href="#" data-action="edit" data-id="${id}">
                <i class="bi bi-pencil-square me-2"></i>Editar</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item text-danger" href="#" data-action="delete" data-id="${id}">
                <i class="bi bi-trash3 me-2"></i>Eliminar</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div class="card-body p-2">
        <div class="fw-semibold text-truncate" title="${title}">${title}</div>
        <div class="small text-secondary">por ${publisher || "Vos"}</div>
        <div class="mt-2"><span class="badge text-bg-light">${humanize(
          condition
        )}</span></div>
        <div class="fw-semibold mt-2">${Number(price).toLocaleString("es-AR", {
          style: "currency",
          currency: "ARS",
        })}</div>
        <div class="d-flex gap-2 mt-2">
          <a class="btn btn-sm btn-outline-primary" href="/template/libro.html?id=${id}">Ver más</a>
        </div>
      </div>
    </div>
  `;

    grid.prepend(col);
  }

  function prefillFormFromBook(row) {
  document.getElementById("bookTitle").value = row.title || "";
  document.getElementById("bookAuthor").value = row.author || "";
  document.getElementById("bookGenre").value = row.genre || "";
  document.getElementById("bookDescription").value = row.details || "";
  document.getElementById("bookDescriptionManual").value = row.description || "";
  document.getElementById("bookCondition").value = row.condition || "nuevo";
  document.getElementById("bookLanguage").value = row.language || "es";
  document.getElementById("bookCover").value = row.cover_type || "blanda";
  document.getElementById("bookPrice").value = row.price ?? "";
  document.getElementById("bookExchange").value = row.is_tradable ? "si" : "no";

  // sincronizar UI de “idioma otro”
  const langSel = document.getElementById("bookLanguage");
  const langOther = document.getElementById("bookLanguageOther");
  const langHelp = document.getElementById("bookLanguageHelp");
  const isOther = langSel.value === "otro";
  langOther.classList.toggle("d-none", !isOther);
  langHelp.classList.toggle("d-none", !isOther);
  langOther.required = isOther;
  if (!isOther) langOther.value = "";
}

  // ===== Submit: crear book + subir imágenes + pintar la card =====
  const formEl = document.getElementById("bookForm");
  formEl.addEventListener("submit", onPublish);

  async function onPublish(e) {
    e.preventDefault();

    // Mínimo de fotos: 3 al CREAR. En edición no tocamos imágenes.
    // Validación mínima de fotos (aplica a crear y editar)
    const kept = countKept();
    if (kept < MIN_PHOTOS) {
      const faltan = MIN_PHOTOS - kept;
      setStep(3);
      showPhotoError(`Agregá al menos ${MIN_PHOTOS} fotos (te faltan ${faltan}).`);
      igUploader?.scrollIntoView({ behavior: "smooth", block: "center" });
      igStage?.focus();
      return;
    }



    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast("Tenés que iniciar sesión para publicar.", "warning");
      return;
    }

    // bloquear UI del submit
    btnSubmit.disabled = true;
    btnPrev.disabled = true;
    btnNext.disabled = true;
    const oldLabel = btnSubmit.innerHTML;
    btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Publicando...`;

    const book = {
      owner: user.id,
      title: document.getElementById("bookTitle")?.value?.trim() || "",
      author: document.getElementById("bookAuthor")?.value?.trim() || "",
      genre: document.getElementById("bookGenre")?.value?.trim() || null,
      details:
        document.getElementById("bookDescription")?.value?.trim() || null,
      description:
        document.getElementById("bookDescriptionManual")?.value?.trim() || null,
      condition: document.getElementById("bookCondition")?.value,
      language: getFinalLanguage(),
      cover_type: document.getElementById("bookCover")?.value,
      price: Number(document.getElementById("bookPrice")?.value),
      is_tradable: document.getElementById("bookExchange")?.value === "si",
    };

    try {
      // 1) Insert rápido del book
      let bookId;

      if (editingId) {
        // === UPDATE (no tocar imágenes) ===
        const changes = { ...book };
        // por seguridad, no tocar portada ni campos de imágenes desde la edición básica
        delete changes.cover_url;

        const { data: up, error: upErr } = await supabase
          .from('books')
          .update(changes)
          .eq('id', editingId)
          .select()
          .single();

        if (upErr) {
          console.error('[publish/update]', upErr);
          toast(`No se pudo guardar: ${upErr.message}`, 'danger');
          return;
        }

        bookId = up.id;

        // === IMÁGENES (edición) ===

        // 0) userId para subir nuevas
        const userId = user.id;

        // 1) Borrar las existentes marcadas
        const toDeleteIds = igFiles.filter(it => it.kind === 'existing' && it.toDelete).map(it => it.id);
        if (toDeleteIds.length) {
          const { error: delErr } = await supabase
            .from('book_images')
            .delete()
            .in('id', toDeleteIds);
          if (delErr) console.error('[images/delete]', delErr);
        }

        // 2) Calcular orden final (solo las que quedan)
        const keptAfter = igFiles.filter(it => !(it.kind === 'existing' && it.toDelete));

        // 3) Recorremos en orden y:
        //   - si es 'new' → subir + insertar
        //   - si es 'existing' → actualizar posición si cambió
        for (let i = 0; i < keptAfter.length; i++) {
          const it = keptAfter[i];
          const pos = i + 1;

          if (it.kind === 'new' && it.file) {
            try {
              const up = await uploadSingleImage(userId, bookId, it.file, pos);
              const { data: imgRow, error: insErr } = await supabase
                .from('book_images')
                .insert({ book_id: bookId, url: up.url, position: pos })
                .select('id, url')
                .single();
              if (!insErr) {
                // convertir el item 'new' a 'existing'
                it.kind = 'existing';
                it.id = imgRow.id;
                it.url = imgRow.url;
                it.preview = imgRow.url;
                delete it.file;
              }
            } catch (e) {
              console.error('[images/upload+insert]', e);
              toast('No se pudieron subir algunas imágenes', 'warning');
            }
          } else if (it.kind === 'existing') {
            // actualizar posición si cambió
            if (it.position !== pos) {
              await supabase.from('book_images').update({ position: pos }).eq('id', it.id);
              it.position = pos;
            }
          }
        }

        // 4) Portada = primera imagen que quedó
        const first = keptAfter[0];
        if (first?.url) {
          await supabase.from('books').update({ cover_url: first.url }).eq('id', bookId);
        }


        // refrescar card en “Mis publicaciones” si está en el DOM
        const col = document.querySelector(`.col[data-book-id="${bookId}"]`);
        if (col) {
          col.querySelector('.fw-semibold.text-truncate')?.replaceChildren(document.createTextNode(up.title || ""));
          col.querySelector('.badge') && (col.querySelector('.badge').textContent = humanize(up.condition || ""));
          const pe = col.querySelector('.fw-semibold.mt-2');
          if (pe) pe.textContent = Number(up.price).toLocaleString("es-AR", { style:"currency", currency:"ARS" });
        }

        toast('Cambios guardados', 'success');

        // reset edición
        editingId = null;
        igFiles = []; // no tocamos imágenes existentes
        renderStage(); renderTray();
        formEl.reset();
        setStep(1);
        closeModal?.();
        return;
      }

      // === INSERT (flujo original) ===
      const { data, error } = await supabase.from('books').insert(book).select().single();
      if (error) {
        console.error('[publish]', error);
        toast(`No se pudo publicar el libro: ${error.message}`, 'danger');
        return;
      }
      bookId = data.id;

      // (mantener lo que ya tenías: pintar card “Publicando…”, subir imágenes, etc.)


      // 2) Pintar card optimista con badge "Publicando…"
      const publisher = await getCurrentProfileName();
      renderMyBookCard({
        id: bookId,
        title: book.title,
        price: book.price,
        condition: book.condition,
        cover_url: null, // placeholder
        publisher,
        pending: true,
      });

      // 3) Subir imágenes en paralelo + guardar en book_images
      const uploaded = await uploadBookImages(
        user.id,
        bookId,
        igFiles.filter(it => it.kind === 'new').map(it => it.file)
      );
      if (uploaded.length) {
        const rows = uploaded.map((u) => ({
          book_id: bookId,
          url: u.url,
          position: u.position,
        }));
        const { error: imErr } = await supabase
          .from("book_images")
          .insert(rows);
        if (imErr) throw imErr;
        // actualizar portada y sacar badge
        finalizeMyBookCardCover(bookId, uploaded[0].url);
      }

      async function uploadSingleImage(userId, bookId, file, position) {
        const ext = (file.type.split("/")[1] || "jpg").toLowerCase();
        const path = `${userId}/${bookId}/${Date.now()}_${position}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
        return { url: pub.publicUrl, position };
      }


      toast("¡Libro publicado exitosamente!", "success");

      // reset UI
      igFiles = [];
      renderStage();
      renderTray();
      formEl.reset();
      setStep(1);
      closeModal?.();
    } catch (err) {
      console.error('[publish]', err);
    toast(`Error al publicar el libro: ${err.message || err}`, 'danger');
    } finally {
      // restaurar botones
      btnSubmit.disabled = false;
      btnPrev.disabled = currentStep === 1;
      btnNext.disabled = currentStep === 3;
      btnSubmit.innerHTML = oldLabel;
    }
  }

  // ---- Auto-open desde index / deep link ----
  async function autoOpenIfRequested() {
    const params = new URLSearchParams(window.location.search);
    const wantOpen =
      params.get("open") === "publish" ||
      sessionStorage.getItem("open-publish") === "1";

    if (!wantOpen) return;

    // si necesitás exigir login, podés validar acá
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // si no hay user, dejá el flag y delegá en tu guard de auth
        sessionStorage.setItem("open-publish", "1");
      } else {
        // cerrá offcanvas si estuviera abierto y abrí el modal
        if (ocMenu?.classList.contains("show")) {
          const offc =
            bootstrap.Offcanvas.getInstance(ocMenu) ||
            new bootstrap.Offcanvas(ocMenu);
          offc.hide();
          ocMenu.addEventListener(
            "hidden.bs.offcanvas",
            () => setTimeout(openModal, 20),
            { once: true }
          );
        } else {
          setTimeout(openModal, 10);
        }
        // limpieza: sacá el flag y la query
        sessionStorage.removeItem("open-publish");
        if (params.get("open")) {
          history.replaceState({}, document.title, window.location.pathname);
        }
      }
    } catch (_) {
      // no rompas el flujo si falla algo menor
    }
  }

  // ejecutá el auto-open después de montar todo
  document.addEventListener("DOMContentLoaded", autoOpenIfRequested);

  // Abrir modal en modo edición (escucha el CustomEvent disparado desde main.js)
document.addEventListener('bookea:edit', async (ev) => {
  const id = ev.detail?.id;
  if (!id) return;

  try {
    const { data: row, error } = await supabase
      .from("books")
      .select("id, title, author, genre, details, description, condition, language, cover_type, price, is_tradable")
      .eq("id", id)
      .maybeSingle();

    if (error || !row) {
      console.error("[edit] select", error);
      return toast("No se pudo abrir la edición", "danger");
    }

    editingId = row.id;
    prefillFormFromBook(row);

    // Traer imágenes existentes y precargar el uploader
const { data: imgs, error: imgErr } = await supabase
  .from("book_images")
  .select("id, url, position")
  .eq("book_id", row.id)
  .order("position");

if (imgErr) {
  console.error("[edit] images", imgErr);
  toast("No se pudieron cargar las imágenes", "warning");
} else {
  igFiles = (imgs || []).map((it) => ({
    kind: "existing",
    id: it.id,
    book_id: row.id,
    file: null,
    url: it.url,
    preview: it.url,
    position: it.position,
    toDelete: false,
  }));
  igCurrent = 0;
  await renderStage();
  await renderTray();
  setStep(3); // te llevo directo a Fotos para que veas lo que hay
}


    // Cambiar UI del modal
    const btnSubmit = document.getElementById("btnSubmit");
    btnSubmit.textContent = "Guardar cambios";
    setStep(1);

    // Abrir modal (respetando offcanvas)
    const ocMenu = document.getElementById("ocMenu");
    if (ocMenu?.classList.contains("show")) {
      const offc = bootstrap.Offcanvas.getInstance(ocMenu) || new bootstrap.Offcanvas(ocMenu);
      offc.hide();
      ocMenu.addEventListener("hidden.bs.offcanvas", () => setTimeout(openModal, 20), { once: true });
    } else {
      openModal();
    }
  } catch (err) {
    console.error("[edit] open", err);
    toast("No se pudo abrir la edición", "danger");
  }
});


  // init
  setStep(1);
})();
