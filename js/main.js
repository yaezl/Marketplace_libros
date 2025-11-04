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

// card
function renderBookCard({ book, container, isOwner }) {
  const col = document.createElement("div");
  col.className = "col";

  // portada y “publicado por”
  const cover = book.cover_url || coverFromImages(book);
  const publisher =
    (book.profiles
      ? `${book.profiles?.nombre || ""} ${book.profiles?.apellido || ""}`.trim()
      : book.publisher) || "Usuario";

  col.innerHTML = `
    <div class="card h-100 shadow-sm border-0 rounded-3">
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
              <li><a class="dropdown-item" href="#" data-action="edit" data-id="${book.id}">
                <i class="bi bi-pencil-square me-2"></i>Editar</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item text-danger" href="#" data-action="delete" data-id="${book.id}">
                <i class="bi bi-trash3 me-2"></i>Eliminar</a></li>
            </ul>
          </div>
        </div>`
            : ""
        }
      </div>

      <div class="card-body p-2">
        <div class="fw-semibold text-truncate" title="${book.title}">${
    book.title
  }</div>
        <div class="small text-secondary text-truncate">${
          book.author ?? ""
        }</div>
        <div class="small text-muted">Publicado por <span class="fw-medium">${publisher}</span></div>

        <div class="price-row mt-2">
          <span class="badge text-bg-light">${humanize(book.condition)}</span>
          <span class="fw-semibold">${moneyAR(book.price)}</span>
        </div>

        <div class="d-flex gap-2 mt-2">
          <!-- ❤️ wishlist (a implementar) -->
          <button class="btn btn-sm btn-outline-secondary" disabled title="Guardar en wishlist (próximamente)">
            <i class="bi bi-heart"></i>
          </button>
          <!-- Ver más (a implementar) -->
          <button class="btn btn-sm btn-primary flex-grow-1" disabled data-view="${
            book.id
          }">
            Ver más
          </button>
        </div>
      </div>
    </div>
  `;

  // handlers editar/eliminar solo para el dueño
  if (isOwner) {
    col.querySelectorAll("[data-action]").forEach((a) => {
      a.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const id = a.getAttribute("data-id");
        const action = a.getAttribute("data-action");

        if (action === "edit") {
          alert("Editar aún no implementado 🙂");
          return;
        }
        if (action === "delete") {
          if (!confirm("¿Eliminar esta publicación?")) return;
          const { error } = await supabase.from("books").delete().eq("id", id);
          if (error) {
            alert("No se pudo eliminar: " + error.message);
            return;
          }
          col.remove();
        }
      });
    });
  }

  container.appendChild(col);
}

/* --------- Descubre: todos --------- */
async function loadDiscover() {
  const cont = document.getElementById("libros-lista");
  if (!cont) return;
  cont.innerHTML = "";

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
    .eq("status", "disponible") // opcional si usás ese estado
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

  data.forEach((row) =>
    renderBookCard({ book: row, container: cont, isOwner: false })
  );
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
