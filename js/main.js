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

// card
function renderBookCard({ book, container, isOwner, likedSet }) {
  const col = document.createElement("div");
  col.className = "col";

  const cover = book.cover_url || coverFromImages(book);
  const publisher =
    (book.profiles
      ? `${book.profiles?.nombre || ""} ${book.profiles?.apellido || ""}`.trim()
      : book.publisher) || "Usuario";

  const isLiked = !isOwner && likedSet?.has?.(book.id);

  col.innerHTML = `
  <div class="card h-100 shadow-sm border-0 rounded-3">
    <div class="position-relative">
      <div class="ratio ratio-3x4">
        <img src="${cover}" alt="${
    book.title
  }" class="w-100 h-100 object-fit-cover">
      </div>
      ${isOwner ? "" : ""}
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
          </button>
        `
            : ``
        }
        <a class="btn btn-sm btn-outline-primary" href="/template/libro.html?id=${
          book.id
        }">Ver más</a>
      </div>
    </div>
  </div>
`;

  // like toggle
  const likeBtn = col.querySelector("[data-like]");
  if (likeBtn) {
    likeBtn.addEventListener("click", async () => {
      const icon = likeBtn.querySelector("i");
      const bookId = likeBtn.getAttribute("data-like");
      await toggleLike(bookId, likedSet, icon);
    });
  }

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
    const isOwner = currentUserId && row.owner === currentUserId;
    renderBookCard({ book: row, container: cont, isOwner, likedSet });
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
      id, title, author, price, condition, created_at,
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
