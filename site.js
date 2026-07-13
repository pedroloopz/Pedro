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
    return `
      <div class="spine ${langClass(b)}" style="height:${height}px" tabindex="0" role="button" aria-label="${b.titulo}, de ${b.autor}">
        <span>${b.titulo}</span>
        <div class="spine-tooltip">
          <strong>${b.titulo}</strong>
          <em>${b.autor} · ${statusLabel[b.status]}</em>
          ${b.tags.length ? `<em>${b.tags.join(', ')}</em>` : ''}
          <span class="tt-date">${formatDate(b.dataLeitura)}</span>
        </div>
      </div>
    `;
  }).join('');

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

  catalog.innerHTML = list.map((b, i) => `
    <article class="card" style="animation-delay:${i * 0.03}s">
      <div class="card-body">
        ${b.isbn
          ? `<img class="cover" loading="lazy" src="https://covers.openlibrary.org/b/isbn/${b.isbn}-M.jpg" alt="Capa de ${b.titulo}" onerror="this.outerHTML='<div class=&quot;cover-fallback&quot;>${b.titulo.charAt(0)}</div>'">`
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
        <span>${b.paginas ? b.paginas + ' pág.' : '—'}</span>
        <span>${formatDate(b.dataLeitura)}</span>
      </div>
    </article>
  `).join('');
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
      ${tracks.map(t => `
        <div class="widget-row">
          <span>${t.name} — <em style="color:var(--muted)">${t.artist['#text']}</em></span>
          ${t['@attr']?.nowplaying ? '<strong style="color:var(--gold)">tocando</strong>' : ''}
        </div>
      `).join('')}
    `;
  }catch(err){
    el.innerHTML = `<div class="widget-label">Last.fm</div><p class="widget-error">Não consegui carregar: ${err.message}</p>`;
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
document.addEventListener('DOMContentLoaded', () => {
  renderSobre();
  renderGaleria();
  renderStats();
  renderShelf();
  renderCatalog('todos');
  renderPublicacoes();
  renderLastfm();
  renderYoutube();

  document.getElementById('filters').addEventListener('click', (e) => {
    if(!e.target.classList.contains('filter-btn')) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    renderCatalog(e.target.dataset.filter);
  });
});
