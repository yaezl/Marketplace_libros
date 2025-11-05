import { supabase } from "../supabaseClient.js";

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
    const volumeInfo = item.volumeInfo || {};
    const title = volumeInfo.title || "Sin título";
    const authors = (volumeInfo.authors || ["Autor desconocido"]).join(", ");
    const year = volumeInfo.publishedDate
      ? volumeInfo.publishedDate.substring(0, 4)
      : "";
    const thumbnail =
      volumeInfo.imageLinks?.thumbnail ||
      volumeInfo.imageLinks?.smallThumbnail ||
      "https://via.placeholder.com/50x70?text=Sin+portada";
    return { id: item.id, title, authors, year, thumbnail, volumeInfo };
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
        <img src="${book.thumbnail}" alt="${book.title}"
             class="book-cover" onerror="this.src='https://via.placeholder.com/50x70?text=Sin+portada'">
        <div class="book-info">
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.authors}${
          book.year ? " · " + book.year : ""
        }</div>
        </div>
      </div>`
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

  let igFiles = []; // Array<File>
  let igCurrent = 0; // índice de imagen activa

  // Helpers (uploader)
  const isImage = (f) => f && f.type && f.type.startsWith("image/");
  const readAsDataURL = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  // Render principal
  async function renderStage() {
    if (igFiles.length === 0) {
      igEmpty.classList.remove("d-none");
      igMain.classList.add("d-none");
      igMain.src = "";
      return;
    }
    igEmpty.classList.add("d-none");
    igMain.classList.remove("d-none");
    const file = igFiles[igCurrent];
    igMain.src = await readAsDataURL(file);
  }

  // Render miniaturas + drag & drop reordenable
  async function renderTray() {
    igTray.innerHTML = "";
    igFiles.forEach(async (file, idx) => {
      const url = await readAsDataURL(file);
      const item = document.createElement("div");
      item.className = "ig-thumb" + (idx === igCurrent ? " active" : "");
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

      // eliminar
      item.querySelector(".ig-del").addEventListener("click", (e) => {
        e.stopPropagation();
        igFiles.splice(idx, 1);
        if (igCurrent >= igFiles.length)
          igCurrent = Math.max(0, igFiles.length - 1);
        renderStage();
        renderTray();
      });

      // drag & drop reorden
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", String(idx));
        item.style.opacity = 0.5;
      });
      item.addEventListener("dragend", () => {
        item.style.opacity = 1;
      });
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
        renderTray();
        renderStage();
      });

      igTray.appendChild(item);
    });
  }

  // Agregar archivos (desde input o drop)
  function addFiles(files) {
    const newOnes = Array.from(files).filter(isImage);
    if (!newOnes.length) return;
    igFiles.push(...newOnes);
    if (igFiles.length === newOnes.length) igCurrent = 0; // si fueron las primeras
    renderStage();
    renderTray();
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
    const uploaded = [];
    let position = 0;

    for (const file of files) {
      const ext = (file.type.split("/")[1] || "jpg").toLowerCase();
      const path = `${userId}/${bookId}/${position}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(path);
      uploaded.push({ url: pub.publicUrl, position });
      position++;
    }
    return uploaded;
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
  }) {
    const grid = document.getElementById("myListingsGrid");
    if (!grid) return; // si no está en esta vista, no hacemos nada

    const col = document.createElement("div");
    col.className = "col-6 col-md-4 col-lg-3";

    col.innerHTML = `
      <div class="book-card p-2 h-100 border rounded-3 shadow-sm">
        <div class="ratio ratio-3x4 mb-2" style="border-radius:12px; overflow:hidden;">
          <img src="${cover_url || "/assets/img/placeholder-3x4.png"}"
               alt="${title}" class="w-100 h-100 object-fit-cover">
        </div>
        <div class="fw-semibold text-truncate" title="${title}">${title}</div>
        <div class="small text-secondary">por ${publisher}</div>
        <div class="small mt-1 text-capitalize">${condition}</div>
        <div class="fw-semibold mt-2">
          ${Number(price).toLocaleString("es-AR", {
            style: "currency",
            currency: "ARS",
          })}
        </div>
        <!-- ❤️ Wishlist (pendiente; usar table book_likes) -->
        <!--
        <button class="btn btn-sm btn-outline-secondary rounded-circle mt-1"
                data-like="${id}" title="Guardar en wishlist">
          <i class="bi bi-heart"></i>
        </button>
        -->
      </div>`;
    grid.prepend(col);
  }

  // ===== Submit: crear book + subir imágenes + pintar la card =====
  const formEl = document.getElementById("bookForm");
  formEl.addEventListener("submit", onPublish);

  async function onPublish(e) {
    e.preventDefault();

    if (igFiles.length === 0) {
      alert("Subí al menos una foto del ejemplar 😊");
      setStep(3);
      igStage.focus();
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert("Tenés que iniciar sesión para publicar.");
      return;
    }

    const book = {
  owner: user.id,
  title: document.getElementById("bookTitle").value.trim(),
  author: document.getElementById("bookAuthor").value.trim(),
  genre: document.getElementById("bookGenre").value.trim() || null,

  // esto ya lo usabas para la descripción que viene de Google/Manual del paso 1
  details: document.getElementById("bookDescription").value.trim() || null,

  // NUEVO: descripción manual del Paso 2 -> columna books.description
  description: document.getElementById("bookDescriptionManual")?.value.trim() || null,

  condition: document.getElementById("bookCondition").value,
  language: getFinalLanguage(),
  cover_type: document.getElementById("bookCover").value,
  price: Number(document.getElementById("bookPrice").value),
  is_tradable: document.getElementById("bookExchange").value === "si",
  // currency, status, created_at: defaults del schema
};


    try {
      // 1) Insert en books
      const { data: inserted, error: insErr } = await supabase
        .from("books")
        .insert(book)
        .select("id")
        .single();
      if (insErr) throw insErr;
      const bookId = inserted.id;

      // 2) Upload imágenes al Storage
      const uploaded = await uploadBookImages(user.id, bookId, igFiles);

      // 3) Guardar filas en book_images
      await insertBookImages(bookId, uploaded);

      // 4) Renderizar card (usando la primera imagen como portada visual)
      const publisher = await getCurrentProfileName();
      renderMyBookCard({
        id: bookId,
        title: book.title,
        price: book.price,
        condition: book.condition,
        cover_url: uploaded[0]?.url || null,
        publisher,
      });

      alert("¡Libro publicado exitosamente!");
      // reset mínimos
      igFiles = [];
      renderStage();
      renderTray();
      formEl.reset();
      setStep(1);
      closeModal();
    } catch (err) {
      console.error(err);
      alert("Error al publicar el libro. Intentá de nuevo.");
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

  // init
  setStep(1);
})();
