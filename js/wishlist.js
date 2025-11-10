// /js/wishlist.js
import { supabase } from '../supabaseClient.js';

/* ===================== DOM refs (con guardias) ===================== */
const grid  = document.getElementById('grid-quiero-leer');
const empty = document.getElementById('empty-quiero-leer');
const btnAdd = document.getElementById('btn-add-wishlist');

// Si no estoy en la página (no existe el grid o el botón), no inicializo
if (!grid || !btnAdd) {
  console.warn('[wishlist] No grid/btn in DOM. Skipping init.');
} else {

  /* ===================== Utils ===================== */
  const clamp = (t, n = 100) => (!t ? '' : t.length > n ? t.slice(0, n - 1) + '…' : t);
  const imgHttps = (u) => (u ? u.replace(/^http:\/\//i, 'https://') : '');
  // Cover HD directamente por volumeId (evita thumbnails pixelados)
  const gbooksCover = (volumeId, zoom = 2) =>
    volumeId ? `https://books.google.com/books/content?id=${volumeId}&printsec=frontcover&img=1&zoom=${zoom}` : null;

  /* ===================== Mini-picker Google Books ===================== */
  let modalEl, modal, input, resultsWrap;
  function ensurePicker() {
    if (modalEl) return;
    modalEl = document.createElement('div');
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Agregar libro a mi wishlist</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Buscar por título o autor</label>
              <input type="text" class="form-control" id="gbooks-q" placeholder="Ej: Cien años de soledad">
              <div class="form-text">Usamos Google Books para autocompletar.</div>
            </div>
            <div id="gbooks-results" class="list-group"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modalEl);
    modal = new bootstrap.Modal(modalEl);
    input = modalEl.querySelector('#gbooks-q');
    resultsWrap = modalEl.querySelector('#gbooks-results');

    let t;
    input.addEventListener('input', () => {
      clearTimeout(t);
      const q = input.value.trim();
      if (!q) { resultsWrap.innerHTML = ''; return; }
      t = setTimeout(() => searchGBooks(q), 350);
    });
  }

  async function searchGBooks(q) {
    resultsWrap.innerHTML = `<div class="list-group-item">Buscando…</div>`;
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12`);
      const json = await res.json();
      const items = Array.isArray(json.items) ? json.items : [];
      if (!items.length) {
        resultsWrap.innerHTML = `<div class="list-group-item">Sin resultados.</div>`;
        return;
      }
      resultsWrap.innerHTML = items.map(v => {
        const info = v.volumeInfo || {};
        const title = info.title || 'Sin título';
        const authors = (info.authors || []).join(', ');
        const cat = (info.categories || [])[0] || null;
        const thumb = imgHttps(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '');
        return `
          <div class="list-group-item d-flex align-items-center justify-content-between gap-3">
            <div class="d-flex align-items-center gap-3">
              <img src="${thumb}" alt="" width="44" height="64" style="object-fit:cover;border-radius:6px;background:#f6f6f6">
              <div>
                <div class="fw-semibold">${clamp(title, 90)}</div>
                <div class="text-secondary small">${clamp(authors || 'Autor desconocido', 90)}</div>
                ${cat ? `<div class="text-secondary small">${cat}</div>` : ''}
              </div>
            </div>
            <button class="btn btn-dark btn-sm" data-add="${v.id}">Agregar</button>
          </div>`;
      }).join('');

      // Bind “Agregar”
      resultsWrap.querySelectorAll('[data-add]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-add');
          const res = await fetch(`https://www.googleapis.com/books/v1/volumes/${id}`);
          const v = await res.json();
          await addToWishlistFromVolume(v);
        });
      });
    } catch (e) {
      resultsWrap.innerHTML = `<div class="list-group-item text-danger">Error consultando Google Books.</div>`;
      console.error(e);
    }
  }

  async function addToWishlistFromVolume(v) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('Necesitás iniciar sesión.'); return; }

    const info = v?.volumeInfo || {};
    const record = {
      user_id: user.id,
      gbook_id: v.id,
      title: info.title || 'Sin título',
      author: (info.authors || []).join(', ') || null,
      genre: (info.categories || [])[0] || null,
      // portada HD construida por volumeId (evita pixelado)
      cover_url: gbooksCover(v.id, 2),
      notify_if_appears: true
    };

    const { error } = await supabase.from('wish_wants').insert(record);
    if (error) { console.error(error); alert('No pudimos guardar el libro.'); return; }

    modal?.hide();
    input.value = '';
    resultsWrap.innerHTML = '';
    await loadWishlist();
  }

  /* ===================== Render ===================== */
  function cardTpl(item) {
    const id = item.id;
    const checked = item.notify_if_appears ? 'checked' : '';
    const cover = item.cover_url || 'https://via.placeholder.com/240x360?text=image+not+available';

    return `
      <div class="col">
        <article class="book-card h-100 p-2" data-id="${id}">
          <!-- Acciones (⋮) -->
          <div class="card-actions position-absolute top-0 end-0 p-2" style="z-index:2">
            <div class="dropdown">
              <button class="btn btn-light btn-sm rounded-5" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Más acciones">
                <i class="bi bi-three-dots-vertical"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <button class="dropdown-item text-danger" data-del="${id}">
                    <i class="bi bi-trash me-2"></i> Borrar de mi wishlist
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div class="ratio ratio-3x4 mb-2">
            <img class="obj-cover" src="${cover}" alt="${item.title || 'Portada'}" />
          </div>
          <div class="small text-secondary">${clamp(item.author || '', 100)}</div>
          <h3 class="fs-6 clamp-2 mb-2">${clamp(item.title || '', 140)}</h3>
          <div class="d-flex align-items-center justify-content-between">
            <div class="form-check form-switch m-0">
              <input class="form-check-input wishlist-notify" type="checkbox" id="notif-${id}" ${checked}>
              <label class="form-check-label small" for="notif-${id}">Notificar si aparece</label>
            </div>
          </div>
        </article>
      </div>`;
  }

  async function loadWishlist() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('d-none');
      return;
    }

    const { data, error } = await supabase
      .from('wish_wants')
      .select('id,title,author,cover_url,notify_if_appears')
      .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }

    if (!data || !data.length) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('d-none');
      return;
    }

    if (empty) empty.classList.add('d-none');
    grid.innerHTML = data.map(cardTpl).join('');

    // Toggle notificaciones
    grid.querySelectorAll('.wishlist-notify').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const article = e.target.closest('article[data-id]');
        const id = article?.dataset.id;
        if (!id) return;
        await supabase.from('wish_wants').update({ notify_if_appears: e.target.checked }).eq('id', id);
      });
    });

    // Borrar item
    grid.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-del');
        if (!id) return;
        const ok = confirm('¿Borrar este libro de tu wishlist?');
        if (!ok) return;
        const { error } = await supabase.from('wish_wants').delete().eq('id', id);
        if (error) { console.error(error); return; }
        await loadWishlist();
      });
    });
  }

  /* ===================== Boot ===================== */
  btnAdd.addEventListener('click', (e) => {
    e.preventDefault();
    ensurePicker();
    modal.show();
    input?.focus();
  });

  // Cargar al entrar
  loadWishlist();

  // Realtime (opcional)
  try {
    supabase
      .channel('wish-wants-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wish_wants' }, loadWishlist)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wish_wants' }, loadWishlist)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'wish_wants' }, loadWishlist)
      .subscribe();
  } catch (_) {}
}

/* ===================== Me gustaron ===================== */
const gridLiked  = document.getElementById('grid-me-gustaron');
const emptyLiked = document.getElementById('empty-me-gustaron');

function likedCardTpl(item) {
  const cover = item.cover || '/assets/img/placeholder-3x4.png';
  return `
    <div class="col">
      <article class="book-card h-100 p-2">
        <div class="ratio ratio-3x4 mb-2">
          <img class="obj-cover" src="${cover}" alt="${item.title || 'Portada'}" />
        </div>
        <div class="small text-secondary">${item.author || ''}</div>
        <h3 class="fs-6 clamp-2 mb-2">${item.title || ''}</h3>
        <div class="d-flex align-items-center justify-content-between">
          <a class="btn btn-sm btn-outline-primary" href="/template/libro.html?id=${item.id}">Ver más</a>
          <button class="btn btn-sm btn-outline-secondary" data-unlike="${item.id}" title="Quitar de Me gustaron">
            <i class="bi bi-heartbreak"></i>
          </button>
        </div>
      </article>
    </div>`;
}

async function loadLiked() {
  if (!gridLiked) return;

  const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  gridLiked.innerHTML = '';
  emptyLiked?.classList.remove('d-none');
  return;
}

const { data, error } = await supabase
  .from('book_likes')
  .select(`
    book:books (
      id, title, author,
      book_images (url, position)
    )
  `)
  .eq('user_id', user.id)               // 👈 solo mis likes
  .order('created_at', { ascending: false });


  if (error) { console.error(error); return; }

  const items = (data || []).map(r => {
    const b = r.book;
    if (!b) return null;
    const imgs = (b.book_images || []).slice().sort((a,b)=>(a.position??0)-(b.position??0));
    return { id: b.id, title: b.title, author: b.author, cover: imgs[0]?.url || null };
  }).filter(Boolean);

  if (!items.length) {
    gridLiked.innerHTML = '';
    emptyLiked?.classList.remove('d-none');
    return;
  }

  emptyLiked?.classList.add('d-none');
  gridLiked.innerHTML = items.map(likedCardTpl).join('');

  // quitar like
  gridLiked.querySelectorAll('[data-unlike]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-unlike');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert('Necesitás iniciar sesión.');
      const { error } = await supabase
        .from('book_likes')
        .delete()
        .eq('book_id', id)
        .eq('user_id', user.id);     // 👈 borra solo tu like
      if (error) { alert('No se pudo quitar.'); return; }
      await loadLiked();
    });
  });
}

// Cargar al mostrar la pestaña
document.getElementById('tab-me-gustaron')?.addEventListener('shown.bs.tab', loadLiked);

