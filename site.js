// ---------- Sobre mim ----------
function renderSobre(){
  document.getElementById('hero-titulo').textContent = CONFIG.titulo;
  document.getElementById('hero-nome').textContent = CONFIG.nome;
  document.getElementById('hero-bio').textContent = CONFIG.bio;
  document.getElementById('nav-nome').textContent = CONFIG.nome;

  const texto = document.getElementById('sobre-texto');
  texto.innerHTML = (CONFIG.sobreMim || []).map(p => `<p>${p}</p>`).join('');
}

// ---------- Galeria ----------
function renderGaleria(){
  const grid = document.getElementById('galeria-grid');
  if(!GALERIA || !GALERIA.length){
    grid.innerHTML = '<p class="galeria-empty">Nenhuma foto ainda — adicione em galeria-data.js</p>';
    return;
  }
  grid.innerHTML = GALERIA.map((f, i) => `
    <div class="galeria-item" data-index="${i}">
      <img src="${f.arquivo}" alt="${f.legenda}" loading="lazy" onerror="this.parentElement.style.display='none'">
    </div>
  `).join('');

  grid.querySelectorAll('.galeria-item').forEach(item => {
    item.addEventListener('click', () => {
      const foto = GALERIA[item.dataset.index];
      document.getElementById('lightbox-img').src = foto.arquivo;
      document.getElementById('lightbox-img').alt = foto.legenda;
      document.getElementById('lightbox-legenda').textContent = foto.legenda;
      document.getElementById('lightbox').classList.add('open');
    });
  });

  const closeLightbox = () => document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', (e) => {
    if(e.target.id === 'lightbox') closeLightbox();
  });
}

// ---------- Estante (livros) ----------
const statusLabel = { "lido": "Lido", "lendo": "Lendo", "quero-ler": "Quero ler", "tcc": "TCC", "artigo": "Artigo", "ensaio": "Ensaio", "publicacao": "Publicação" };

function stars(nota){
  if(!nota) return '';
  const filled = '★'.repeat(nota);
  const empty = '<span class="off">' + '★'.repeat(5 - nota) + '</span>';
  return '<span class="stars">' + filled + empty + '</span>';
}

function formatDate(iso){
  if(!iso) return '—';
  const [y,m,d] = iso.split('-');
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${d} ${meses[parseInt(m,10)-1]} ${y}`;
}

function callNumber(prefix, num, idx){
  return `${prefix}-${String(num).slice(0,2)}.${idx+1}`;
}

function renderStats(){
  const lidos = BOOKS.filter(b => b.status === 'lido').length;
  const paginas = BOOKS.filter(b => b.status === 'lido').reduce((s,b) => s + b.paginas, 0);
  const lendo = BOOKS.filter(b => b.status === 'lendo').length;
  document.getElementById('stats').innerHTML = `
    <div><span class="n">${lidos}</span><span class="l">livros lidos</span></div>
    <div><span class="n">${paginas.toLocaleString('pt-BR')}</span><span class="l">páginas viradas</span></div>
    <div><span class="n">${lendo}</span><span class="l">em andamento</span></div>
  `;
}

// ---------- Capas automáticas (livros sem ISBN) ----------
async function buscarCapasFaltantes(){
  const semCapa = BOOKS.filter(b => !b.isbn);
  await Promise.all(semCapa.map(async (b) => {
    try{
      const q = encodeURIComponent(`${b.titulo} ${b.autor}`);
      const res = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=1&fields=cover_i,isbn`);
      if(!res.ok) return;
      const data = await res.json();
      const doc = data.docs && data.docs[0];
      if(doc && doc.cover_i){
        b._coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
      } else if(doc && doc.isbn && doc.isbn.length){
        b._coverUrl = `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-M.jpg`;
      }
    }catch(e){ /* sem capa, fica o fallback com a inicial */ }
  }));
}

function coverUrl(b){
  if(b.isbn) return `https://covers.openlibrary.org/b/isbn/${b.isbn}-M.jpg`;
  if(b._coverUrl) return b._coverUrl;
  return null;
}

function bookId(b){
  return 'livro-' + b.titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

// ---------- Idioma → cor (hash determinístico) ----------
const LANG_PALETTE_SIZE = 8;
function langColorIndex(tag){
  if(!tag) return null;
  let hash = 0;
  for(let i = 0; i < tag.length; i++){
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % LANG_PALETTE_SIZE;
}
function langClass(book){
  const lang = (book.tags || [])[0];
  const idx = langColorIndex(lang);
  return idx === null ? 'idioma-default' : `idioma-${idx}`;
}

function renderShelf(){
  const shelf = document.getElementById('shelf');
  shelf.innerHTML = BOOKS.map(b => {
    const height = Math.min(230, Math.max(115, 90 + (b.paginas || 100) / 6));
    const cover = coverUrl(b);
    return `
      <div class="spine ${langClass(b)} ${b.status === 'lendo' ? 'is-lendo' : ''}" style="height:${height}px" tabindex="0" role="button" data-target="${bookId(b)}" aria-label="${b.titulo}, de ${b.autor}">
        <span>${b.titulo}</span>
        <div class="spine-tooltip">
          ${cover ? `<img class="tt-cover" src="${cover}" alt="" loading="lazy">` : ''}
          <strong>${b.titulo}</strong>
          <em>${b.autor} · ${statusLabel[b.status]}</em>
          ${b.tags.length ? `<em>${b.tags.join(', ')}</em>` : ''}
          <span class="tt-date">${formatDate(b.dataLeitura)}</span>
        </div>
      </div>
    `;
  }).join('');

  shelf.querySelectorAll('.spine').forEach(spine => {
    spine.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelector('.filter-btn[data-filter="todos"]').classList.add('active');
      renderCatalog('todos');
      requestAnimationFrame(() => {
        const alvo = document.getElementById(spine.dataset.target);
        if(alvo){
          alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
          alvo.classList.add('card-highlight');
          setTimeout(() => alvo.classList.remove('card-highlight'), 1600);
        }
      });
    });
  });

  const legend = document.getElementById('shelf-legend');
  if(legend){
    const langs = [...new Set(BOOKS.map(b => (b.tags || [])[0]).filter(Boolean))];
    legend.innerHTML = langs.map(l => {
      const idx = langColorIndex(l);
      return `<span class="legend-item"><span class="legend-swatch idioma-${idx}"></span>${l}</span>`;
    }).join('');
  }
}

function renderCatalog(filter){
  const catalog = document.getElementById('catalog');
  const list = filter === 'todos' ? BOOKS : BOOKS.filter(b => b.status === filter);
  document.getElementById('count').textContent = `${list.length} título${list.length === 1 ? '' : 's'}`;

  if(!list.length){
    catalog.innerHTML = `<p class="catalog-empty">Nenhum livro nessa categoria ainda.</p>`;
    return;
  }

  if(filter === 'todos'){
    renderCatalogAgrupado(list, catalog);
    return;
  }

  catalog.innerHTML = `<div class="grupo-grid">${list.map((b, i) => cardHTML(b, i)).join('')}</div>`;
}

function renderCatalogAgrupado(list, catalog){
  const grupos = {};
  list.forEach(b => {
    const lang = (b.tags || [])[0] || 'Sem idioma definido';
    if(!grupos[lang]) grupos[lang] = [];
    grupos[lang].push(b);
  });

  const idiomasOrdenados = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  catalog.innerHTML = idiomasOrdenados.map(lang => {
    const livros = grupos[lang].slice().sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
    const idx = langColorIndex(lang === 'Sem idioma definido' ? null : lang);
    const swatchClass = idx === null ? 'idioma-default' : `idioma-${idx}`;
    return `
      <div class="catalog-grupo">
        <div class="grupo-titulo"><span class="legend-swatch ${swatchClass}"></span>${lang}</div>
        <div class="grupo-grid">
          ${livros.map((b, i) => cardHTML(b, i)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function cardHTML(b, i){
  const cover = coverUrl(b);
  return `
    <article class="card ${b.status === 'lendo' ? 'card-lendo' : ''}" id="${bookId(b)}" style="animation-delay:${i * 0.03}s">
      <div class="card-body">
        ${cover
          ? `<img class="cover" loading="lazy" src="${cover}" alt="Capa de ${b.titulo}" onerror="this.outerHTML='<div class=&quot;cover-fallback&quot;>${b.titulo.charAt(0)}</div>'">`
          : `<div class="cover-fallback">${b.titulo.charAt(0)}</div>`
        }
        <div class="card-info">
          <div class="card-top">
            <div>
              <h3>${b.titulo}</h3>
              <div class="autor">${b.autor}</div>
            </div>
            <span class="status-badge status-${b.status}">${statusLabel[b.status]}</span>
          </div>
          ${stars(b.nota)}
          ${b.tags.length ? `<div class="tags">${b.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
        </div>
      </div>
      <p class="resenha ${b.resenha ? '' : 'empty'}">${b.resenha || 'Sem anotação ainda.'}</p>
      <div class="card-meta">
        <span>${b.editora ? b.editora : (b.paginas ? b.paginas + ' pág.' : '—')}</span>
        <span>${formatDate(b.dataLeitura)}</span>
      </div>
    </article>
  `;
}

// ---------- Publicações ----------
function renderPublicacoes(){
  const grid = document.getElementById('publicacoes-grid');
  grid.innerHTML = PUBLICACOES.map((p, i) => `
    <article class="card" style="animation-delay:${i * 0.03}s">
      <div class="card-top">
        <div>
          <h3>${p.titulo}</h3>
          <div class="autor">${p.instituicao}</div>
        </div>
        <span class="status-badge status-${p.tipo === 'tcc' ? 'tcc' : 'artigo'}">${statusLabel[p.tipo] || p.tipo}</span>
      </div>
      <p class="resenha">${p.resumo}</p>
      <div class="card-meta">
        <span>${p.ano}</span>
      </div>
      ${p.arquivo ? `<a class="card-link" href="${p.arquivo}" target="_blank" rel="noopener">Baixar PDF</a>` : (p.link ? `<a class="card-link" href="${p.link}" target="_blank" rel="noopener">Ler publicação</a>` : '')}
    </article>
  `).join('');
}

// ---------- Agora: Last.fm ----------
async function renderLastfm(){
  const el = document.getElementById('widget-lastfm');
  if(!CONFIG.lastfmApiKey || CONFIG.lastfmApiKey === 'COLE_SUA_CHAVE_AQUI'){
    el.innerHTML = '<p class="widget-error">Preencha "lastfmUsername" e "lastfmApiKey" em config.js</p>';
    return;
  }
  try{
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${CONFIG.lastfmUsername}&api_key=${CONFIG.lastfmApiKey}&format=json&limit=4`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('Falha na requisição');
    const data = await res.json();
    const tracks = data.recenttracks?.track || [];
    if(!tracks.length) throw new Error('Nenhuma faixa encontrada');
    el.innerHTML = `
      <div class="widget-label">Last.fm — últimas faixas</div>
      ${tracks.map(t => {
        const album = t.album && t.album['#text'] ? t.album['#text'] : '';
        const art = (t.image || []).find(img => img.size === 'medium')?.['#text'] || (t.image || []).slice(-1)[0]?.['#text'];
        return `
          <div class="lastfm-row">
            ${art ? `<img class="lastfm-art" src="${art}" alt="" loading="lazy">` : `<div class="lastfm-art lastfm-art-fallback">♪</div>`}
            <div class="lastfm-info">
              <span class="lastfm-track">${t.name}${t['@attr']?.nowplaying ? ' <em class="lastfm-now">tocando</em>' : ''}</span>
              <span class="lastfm-artist">${t.artist['#text']}</span>
              ${album ? `<span class="lastfm-album">${album}</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    `;
  }catch(err){
    el.innerHTML = `<div class="widget-label">Last.fm</div><p class="widget-error">Não consegui carregar: ${err.message}</p>`;
  }
}

// ---------- Agora: Last.fm — top 8 artistas de todos os tempos ----------
async function renderLastfmTop(){
  const el = document.getElementById('widget-lastfm-top');
  if(!CONFIG.lastfmApiKey || CONFIG.lastfmApiKey === 'COLE_SUA_CHAVE_AQUI'){
    el.innerHTML = '<p class="widget-error">Preencha "lastfmUsername" e "lastfmApiKey" em config.js</p>';
    return;
  }
  try{
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${CONFIG.lastfmUsername}&api_key=${CONFIG.lastfmApiKey}&format=json&period=overall&limit=8`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('Falha na requisição');
    const data = await res.json();
    const artistas = data.topartists?.artist || [];
    if(!artistas.length) throw new Error('Nenhum artista encontrado');
    el.innerHTML = `
      <div class="widget-label">Last.fm — top 8 artistas (geral)</div>
      <div class="top-artistas">
        ${artistas.map((a, i) => {
          const img = (a.image || []).find(im => im.size === 'large')?.['#text'] || (a.image || []).slice(-1)[0]?.['#text'];
          return `
            <a class="artista-item" href="${a.url}" target="_blank" rel="noopener">
              <span class="artista-pos">${i + 1}</span>
              ${img ? `<img class="artista-img" src="${img}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : ''}
              <span class="artista-img artista-img-fallback" style="${img ? 'display:none' : ''}">${a.name.charAt(0)}</span>
              <span class="artista-nome">${a.name}</span>
              <span class="artista-scrobbles">${Number(a.playcount).toLocaleString('pt-BR')} scrobbles</span>
            </a>
          `;
        }).join('')}
      </div>
    `;
  }catch(err){
    el.innerHTML = `<div class="widget-label">Top artistas</div><p class="widget-error">Não consegui carregar: ${err.message}</p>`;
  }
}

// ---------- Agora: YouTube ----------
async function renderYoutube(){
  const el = document.getElementById('widget-youtube');
  if(!CONFIG.youtubeApiKey || CONFIG.youtubeApiKey === 'COLE_SUA_CHAVE_AQUI'){
    el.innerHTML = '<p class="widget-error">Preencha "youtubeChannelId" e "youtubeApiKey" em config.js</p>';
    return;
  }
  try{
    const url = `https://www.googleapis.com/youtube/v3/search?key=${CONFIG.youtubeApiKey}&channelId=${CONFIG.youtubeChannelId}&part=snippet,id&order=date&maxResults=3&type=video`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('Falha na requisição');
    const data = await res.json();
    const videos = data.items || [];
    if(!videos.length) throw new Error('Nenhum vídeo encontrado');
    el.innerHTML = `
      <div class="widget-label">YouTube — últimos vídeos</div>
      ${videos.map(v => `
        <a href="https://www.youtube.com/watch?v=${v.id.videoId}" target="_blank" rel="noopener">
          <img class="yt-thumb" src="${v.snippet.thumbnails.medium.url}" alt="${v.snippet.title}">
          <div style="font-size:0.85rem; margin-bottom:0.6rem;">${v.snippet.title}</div>
        </a>
      `).join('')}
    `;
  }catch(err){
    el.innerHTML = `<div class="widget-label">YouTube</div><p class="widget-error">Não consegui carregar: ${err.message}</p>`;
  }
}

// ---------- init ----------
document.addEventListener('DOMContentLoaded', async () => {
  renderSobre();
  renderGaleria();
  renderPublicacoes();
  renderLastfm();
  renderLastfmTop();
  renderYoutube();

  await buscarCapasFaltantes();
  renderStats();
  renderShelf();
  renderCatalog('todos');

  document.getElementById('filters').addEventListener('click', (e) => {
    if(!e.target.classList.contains('filter-btn')) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    renderCatalog(e.target.dataset.filter);
  });
});
