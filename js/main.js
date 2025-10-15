// js/main.js
import { supabase } from '../supabaseClient.js';

async function probarConexion() {
  // 1) Ping simple: pedir hora del servidor
  const { data: ping, error: pingError } = await supabase.rpc('now'); // si no existe, no pasa nada
  console.log('Ping (puede ser null si no hay RPC now):', ping, pingError || 'OK');

  // 2) Leer libros disponibles (vista v_books_card)
  const { data, error } = await supabase
    .from('v_books_card')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2);

  if (error) {
    console.error('Error al cargar libros:', error);
    document.getElementById('libros-lista').innerHTML =
      `<div class="alert alert-danger">No se pudieron cargar libros: ${error.message}</div>`;
    return;
  }

  console.log('Libros recibidos:', data);

  const cont = document.getElementById('libros-lista');
  cont.innerHTML = '';

  if (!data || data.length === 0) {
    cont.innerHTML = `<div class="alert alert-info">No hay publicaciones todavía.</div>`;
    return;
  }

  data.forEach(libro => {
    const card = document.createElement('div');
    card.className = 'card m-2';
    card.style.width = '18rem';
    card.innerHTML = `
      <img src="${libro.cover_url || 'assets/img/no-cover.png'}"
           class="card-img-top" alt="${libro.title || 'Libro'}">
      <div class="card-body">
        <h5 class="card-title">${libro.title ?? ''}</h5>
        <p class="card-text mb-1">${libro.author ?? ''}</p>
        <span class="badge text-bg-success">$${libro.price ?? ''}</span>
      </div>
    `;
    cont.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', probarConexion);
