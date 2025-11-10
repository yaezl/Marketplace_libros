// js/main.js
import { supabase } from "../supabaseClient.js";

// helpers
const moneyAR = (n) =>
  Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const coverFromImages = (book) => {
  const imgs = (book.book_images || []).sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );
  return imgs[0]?.url || "/assets/img/placeholder-3x4.png";
};
const humanize = (s = "") =>
  s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); // "como-nuevo" -> "Como Nuevo"

/* ===== Notifications API ===== */
async function fetchNotifications(limit = 20) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, payload, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) { console.error('[noti] select', error); return []; }

  return data || [];
}

async function markAllRead() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
}

async function markOneRead(id) {
  await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
}

function renderNotiList(listEl, emptyEl, items) {
  if (!listEl || !emptyEl) return;
  if (!items.length) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('d-none');
    return;
  }
  emptyEl.classList.add('d-none');
  listEl.innerHTML = items.map(n => {
    const p = n.payload || {};
    const title = p.title || 'Nueva publicación';
    const author = p.author ? ` · ${p.author}` : '';
    const when = new Date(n.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    const isUnread = !n.read_at;

    return `
      <a href="#" class="list-group-item list-group-item-action ${isUnread ? 'fw-semibold' : ''}"
         data-noti="${n.id}" data-book="${p.book_id || ''}">
        <div class="d-flex justify-content-between">
          <div class="me-2">
            <div>${title}${author}</div>
            <div class="text-secondary">${when}</div>
          </div>
          <i class="bi bi-chevron-right"></i>
        </div>
      </a>`;
  }).join('');
}

async function loadNotiInto(prefix) {
  const listEl  = document.getElementById(`notiList${prefix}`);
  const emptyEl = document.getElementById(`notiEmpty${prefix}`);
  const items = await fetchNotifications(30);
  renderNotiList(listEl, emptyEl, items);

  // click en cada item
  listEl?.querySelectorAll('[data-noti]').forEach(el => {
    el.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const id = el.getAttribute('data-noti');
      const bookId = el.getAttribute('data-book');

      if (!bookId) {
        toast('Notificación sin destino', 'warning');
        return;
      }

      // ¿sigue disponible?
      const { data: row, error } = await supabase
        .from('books')
        .select('status')
        .eq('id', bookId)
        .maybeSingle();

      await markOneRead(id);

      if (!error && row && row.status === 'disponible') {
        window.location.href = `/template/libro.html?id=${bookId}`;
      } else {
        toast('La publicación ya no está disponible', 'warning');
      }
    });
  });
}

// ganchos de dropdown: cuando se abre, cargo
document.addEventListener('DOMContentLoaded', () => {
  const ddDesktop = document.getElementById('btnNotiDesktop');
  ddDesktop?.addEventListener('show.bs.dropdown', () => loadNotiInto('Desktop'));
  document.getElementById('notiMarkAll')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await markAllRead();
    await loadNotiInto('Desktop');
  });

  const ddMobile = document.getElementById('btnNotiMobile');
  ddMobile?.addEventListener('show.bs.dropdown', () => loadNotiInto('Mobile'));
});


// ===== Likes (book_likes) =====
async function getMyLikedSet() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return new Set();
  const { data, error } = await supabase
    .from("book_likes")
    .select("book_id")
    .order("created_at", { ascending: false });
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.book_id));
}

async function toggleLike(bookId, likedSet, iconEl) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return alert("Necesitás iniciar sesión.");

  try {
    if (!likedSet.has(bookId)) {
      const { error } = await supabase
        .from("book_likes")
        .insert({ user_id: uid, book_id: bookId });
      if (error) throw error;
      likedSet.add(bookId);
      iconEl.className = "bi bi-heart-fill text-danger";
    } else {
      const { error } = await supabase
        .from("book_likes")
        .delete()
        .eq("book_id", bookId);
      if (error) throw error;
      likedSet.delete(bookId);
      iconEl.className = "bi bi-heart";
    }
  } catch (e) {
    console.error(e);
    alert("No pudimos actualizar tu “Me gustaron”.");
  }
}

function toast(message, variant = "success") {
  let wrap = document.getElementById("toastArea");
  if (!wrap) {
    // auto-crear si no existe (evita caer a alert)
    wrap = document.createElement("div");
    wrap.id = "toastArea";
    wrap.className = "toast-container position-fixed top-0 end-0 p-3";
    wrap.style.zIndex = "1080";
    document.body.appendChild(wrap);
  }
  const el = document.createElement("div");
  el.className = `toast align-items-center text-bg-${variant} border-0`;
  el.setAttribute("role", "alert");
  el.setAttribute("aria-live", "assertive");
  el.setAttribute("aria-atomic", "true");
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
    </div>`;
  wrap.appendChild(el);
  const t = new bootstrap.Toast(el, { delay: 2500 });
  t.show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

// card
function renderBookCard({ book, container, isOwner, likedSet }) {
  const col = document.createElement("div");
  col.className = "col";
  col.dataset.bookId = String(book.id);
  if (book.status) col.dataset.status = book.status; // para el toggle

  const cover = book.cover_url || coverFromImages(book);
  const publisher =
    (book.profiles
      ? `${book.profiles?.nombre || ""} ${book.profiles?.apellido || ""}`.trim()
      : book.publisher) || "Usuario";

  const isLiked = !isOwner && likedSet?.has?.(book.id);

  col.innerHTML = `
  <div class="card h-100 shadow-sm border-0 rounded-3 position-relative">
    <div class="position-relative">
      <div class="ratio ratio-3x4">
        <img src="${cover}" alt="${
    book.title
  }" class="w-100 h-100 object-fit-cover">
      </div>

      ${
        isOwner
          ? `
      <div class="position-absolute top-0 end-0 p-1">
        <div class="dropdown">
          <button class="btn btn-light btn-sm rounded-circle border-0" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="bi bi-three-dots"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li>
              <a class="dropdown-item" href="#" data-action="edit" data-id="${
                book.id
              }">
                <i class="bi bi-pencil-square me-2"></i>Editar
              </a>
            </li>
            <li>
              <a class="dropdown-item" href="#" data-action="toggle" data-id="${
                book.id
              }">
                <i class="bi bi-eye-slash me-2"></i><span data-vis-label>${
                  (book.status || "disponible") === "vendido"
                    ? "Hacer pública"
                    : "Ocultar (privado)"
                }</span>
              </a>
            </li>
            <li><hr class="dropdown-divider"></li>
            <li>
              <a class="dropdown-item text-danger" href="#" data-action="delete" data-id="${
                book.id
              }">
                <i class="bi bi-trash3 me-2"></i>Eliminar
              </a>
            </li>
          </ul>
        </div>
      </div>`
          : ``
      }
    </div>

    <div class="card-body p-2">
      <div class="fw-semibold text-truncate" title="${book.title}">${
    book.title
  }</div>
      <div class="small text-secondary text-truncate">${book.author ?? ""}</div>
      <div class="small text-muted">Publicado por <span class="fw-medium">${
        isOwner ? "Vos" : publisher
      }</span></div>

      <div class="mt-2"><span class="badge text-bg-light">${humanize(
        book.condition
      )}</span></div>
      <div class="fw-semibold mt-2">${moneyAR(book.price)}</div>

      <div class="d-flex gap-2 mt-2">
        ${
          !isOwner
            ? `
          <button class="btn btn-sm btn-outline-secondary" title="Guardar en wishlist" data-like="${
            book.id
          }">
            <i class="bi ${
              isLiked ? "bi-heart-fill text-danger" : "bi-heart"
            }"></i>
          </button>`
            : ``
        }
        <a class="btn btn-sm btn-outline-primary" href="/template/libro.html?id=${
          book.id
        }">Ver más</a>
      </div>
    </div>
  </div>`;

  // like toggle (para cards de otros)
  const likeBtn = col.querySelector("[data-like]");
  if (likeBtn) {
    likeBtn.addEventListener("click", async () => {
      const icon = likeBtn.querySelector("i");
      const bookId = likeBtn.getAttribute("data-like");
      await toggleLike(bookId, likedSet, icon);
    });
  }

  // owner actions (⋯)
  col.querySelectorAll("[data-action]").forEach((a) => {
    a.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const id = a.getAttribute("data-id");
      const action = a.getAttribute("data-action");

      if (action === "edit") {
        document.dispatchEvent(new CustomEvent('bookea:edit', { detail: { id } }));
        return;
      }

      if (action === "toggle") {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id || null;

        const current = col.dataset.status || "disponible";
        const next = current === "vendido" ? "disponible" : "vendido";

        const { error } = await supabase
          .from("books")
          .update({ status: next })
          .eq("id", id)
          .eq("owner", uid);

        if (error) {
          console.error("[books.toggle visibility] error:", error);
          return toast("No se pudo cambiar la visibilidad", "danger");
        }

        col.dataset.status = next;

        // actualizar label del menú
        const lbl = col.querySelector("[data-vis-label]");
        if (lbl)
          lbl.textContent =
            next === "vendido" ? "Hacer pública" : "Ocultar (privado)";

        // Si estoy en Descubre (grid #libros-lista) y lo oculto, quito la card sin recargar
        const inDiscover = !!col.closest("#libros-lista");
        if (inDiscover && next === "vendido") {
          col.remove();
          toast("Publicación ocultada", "success");
          return;
        }

        // Si estoy en "Mis publicaciones", dejo la card y muestro toast
        toast(
          next === "vendido" ? "Publicación ocultada" : "Publicación publicada",
          "success"
        );
        return;
      }

      if (action === "delete") {
        const { error } = await supabase.from("books").delete().eq("id", id);
        if (error) return toast("No se pudo eliminar la publicación", "danger");
        col.remove();
        toast("Publicación eliminada", "success");
      }
    });
  });

  container.appendChild(col);
}

/* --------- Descubre: todos --------- */
async function loadDiscover() {
  const cont = document.getElementById("libros-lista");
  if (!cont) return;
  cont.innerHTML = "";

  const likedSet = await getMyLikedSet();

  const { data, error } = await supabase
    .from("books")
    .select(
      `
      id, title, author, price, condition, created_at,
      owner,
      profiles:owner (nombre, apellido),
      book_images (url, position)
    `
    )
    .eq("status", "disponible")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    cont.innerHTML = `<div class="alert alert-danger">No se pudieron cargar publicaciones.</div>`;
    return;
  }
  if (!data?.length) {
    cont.innerHTML = `<div class="alert alert-info">No hay publicaciones todavía.</div>`;
    return;
  }
  const { data: auth } = await supabase.auth.getUser();
  const currentUserId = auth?.user?.id || null;

  data.forEach((row) => {
     renderBookCard({ book: row, container: cont, isOwner: false, likedSet });
  });
}

/* --------- Mis publicaciones: solo del usuario --------- */
async function loadMyListings() {
  const cont = document.getElementById("myListingsGrid");
  if (!cont) return;
  cont.innerHTML = "";

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    cont.innerHTML = `<div class="alert alert-warning">Iniciá sesión para ver tus publicaciones.</div>`;
    return;
  }

  const { data, error } = await supabase
    .from("books")
    .select(
      `
    id, title, author, price, condition, status, created_at,
    book_images ( url, position )
  `
    )
    .eq("owner", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    cont.innerHTML = `<div class="alert alert-danger">No se pudieron cargar tus publicaciones.</div>`;
    return;
  }

  if (!data?.length) {
    cont.innerHTML = `<div class="alert alert-info">Aún no publicaste libros.</div>`;
    return;
  }

  data.forEach((book) =>
    renderBookCard({ book, container: cont, isOwner: true })
  );
}

/* --------- init --------- */
document.addEventListener("DOMContentLoaded", () => {
  loadDiscover();
  loadMyListings();
});
