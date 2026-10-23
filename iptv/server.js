// IPTV caseiro: transforma arquivos, links e sinais de teste em canais HLS ao vivo.
// Sem dependências — só Node 18+ e ffmpeg instalados.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORTA = Number(process.env.PORT) || 8080;
const TOKEN = process.env.IPTV_TOKEN || ''; // se definido, toda requisição precisa de ?token=
const OCIOSO_MS = 60_000;                   // derruba o ffmpeg de um canal sem espectadores
const RAIZ = __dirname;
const HLS = path.join(RAIZ, 'hls');
const PUBLICO = path.join(RAIZ, 'public');

const canais = JSON.parse(fs.readFileSync(path.join(RAIZ, 'channels.json'), 'utf8'));
for (const c of canais) {
  if (!/^[a-z0-9_-]+$/.test(c.id)) throw new Error(`id inválido em channels.json: "${c.id}"`);
}
const porId = new Map(canais.map(c => [c.id, c]));
const rodando = new Map(); // id -> { proc, ultimoAcesso }

fs.rmSync(HLS, { recursive: true, force: true });
fs.mkdirSync(HLS, { recursive: true });

// ---------- ffmpeg ----------

function entrada(c) {
  if (c.tipo === 'teste') {
    return ['-re', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30',
            '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000'];
  }
  if (c.tipo === 'arquivo') {
    // -stream_loop -1 repete o arquivo para sempre; -re lê em tempo real (vira "ao vivo")
    return ['-re', '-stream_loop', '-1', '-i', path.resolve(RAIZ, c.origem)];
  }
  if (c.tipo === 'url') {
    const rede = /^https?:/.test(c.origem)
      ? ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5'] : [];
    return [...rede, '-i', c.origem];
  }
  throw new Error(`tipo desconhecido: ${c.tipo}`);
}

function codificacao(c) {
  if (c.copiar) return ['-c', 'copy']; // fonte já em H.264/AAC: quase zero CPU
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
          '-b:v', c.bitrate || '2500k', '-maxrate', c.bitrate || '2500k', '-bufsize', '5000k',
          '-g', '60', '-sc_threshold', '0', '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-b:a', '128k', '-ac', '2'];
}

function iniciar(c) {
  const dir = path.join(HLS, c.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const args = ['-hide_banner', '-loglevel', 'error', ...entrada(c),
    '-map', '0:v:0', '-map', c.tipo === 'teste' ? '1:a:0' : '0:a:0?', ...codificacao(c),
    '-f', 'hls', '-hls_time', '4', '-hls_list_size', '6',
    '-hls_flags', 'delete_segments+omit_endlist+independent_segments',
    '-hls_segment_filename', path.join(dir, 'seg_%05d.ts'),
    path.join(dir, 'index.m3u8')];
  const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  proc.stderr.on('data', d => process.stderr.write(`[${c.id}] ${d}`));
  proc.on('exit', code => {
    if (rodando.get(c.id)?.proc === proc) rodando.delete(c.id);
    console.log(`[${c.id}] ffmpeg encerrado (código ${code})`);
  });
  rodando.set(c.id, { proc, ultimoAcesso: Date.now() });
  console.log(`[${c.id}] ffmpeg iniciado`);
}

function garantirRodando(c) {
  const r = rodando.get(c.id);
  if (r) r.ultimoAcesso = Date.now();
  else iniciar(c);
}

setInterval(() => {
  for (const [id, r] of rodando) {
    if (Date.now() - r.ultimoAcesso > OCIOSO_MS) {
      console.log(`[${id}] sem espectadores, parando`);
      r.proc.kill('SIGTERM');
      rodando.delete(id);
    }
  }
}, 10_000);

async function esperarArquivo(id, arquivo, ms = 20_000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (fs.existsSync(arquivo)) return true;
    if (!rodando.has(id)) return false; // ffmpeg morreu (fonte fora do ar, arquivo inexistente…)
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

// ---------- playlist M3U e guia EPG (XMLTV) ----------

function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host}`;
}
const comToken = url => (TOKEN ? `${url}${url.includes('?') ? '&' : '?'}token=${TOKEN}` : url);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function playlistM3U(req) {
  const base = baseUrl(req);
  const linhas = [`#EXTM3U url-tvg="${comToken(`${base}/epg.xml`)}"`];
  for (const c of canais) {
    const logo = c.logo ? ` tvg-logo="${esc(c.logo)}"` : '';
    linhas.push(`#EXTINF:-1 tvg-id="${c.id}" tvg-name="${esc(c.nome)}"${logo} group-title="${esc(c.grupo || 'Geral')}",${c.nome}`);
    linhas.push(comToken(`${base}/hls/${c.id}/index.m3u8`));
  }
  return linhas.join('\n') + '\n';
}

// XMLTV usa "YYYYMMDDHHMMSS +HHMM" no fuso local
function dataXmltv(d) {
  const p = n => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const fuso = `${off >= 0 ? '+' : '-'}${p(Math.floor(Math.abs(off) / 60))}${p(Math.abs(off) % 60)}`;
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}00 ${fuso}`;
}

function epgXML() {
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<tv generator-info-name="iptv-caseiro">'];
  for (const c of canais) {
    out.push(`  <channel id="${c.id}"><display-name>${esc(c.nome)}</display-name></channel>`);
  }
  // a programação em channels.json se repete todo dia; gera hoje e amanhã
  for (const c of canais) {
    for (const diaExtra of [0, 1]) {
      for (const p of c.programacao || []) {
        const dia = new Date(); dia.setHours(0, 0, 0, 0); dia.setDate(dia.getDate() + diaExtra);
        const hora = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(dia); d.setHours(h, m); return d; };
        out.push(`  <programme channel="${c.id}" start="${dataXmltv(hora(p.inicio))}" stop="${dataXmltv(hora(p.fim))}">` +
                 `<title>${esc(p.titulo)}</title>${p.descricao ? `<desc>${esc(p.descricao)}</desc>` : ''}</programme>`);
      }
    }
  }
  out.push('</tv>');
  return out.join('\n') + '\n';
}

// ---------- HTTP ----------

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t', '.png': 'image/png', '.svg': 'image/svg+xml' };

function enviar(res, status, corpo, tipo = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': tipo, 'Access-Control-Allow-Origin': '*', ...extra });
  res.end(corpo);
}

async function rotaHls(req, res, id, arquivo) {
  const c = porId.get(id);
  if (!c || !/^(index\.m3u8|seg_\d+\.ts)$/.test(arquivo)) return enviar(res, 404, 'não encontrado');
  garantirRodando(c);
  const caminho = path.join(HLS, id, arquivo);
  if (arquivo === 'index.m3u8') {
    if (!(await esperarArquivo(id, caminho))) return enviar(res, 503, 'canal iniciando, tente de novo');
    let m3u8 = fs.readFileSync(caminho, 'utf8');
    // segmentos são relativos e perderiam o ?token=; reescreve cada linha de mídia
    if (TOKEN) m3u8 = m3u8.split('\n').map(l => (l && !l.startsWith('#') ? comToken(l) : l)).join('\n');
    return enviar(res, 200, m3u8, TIPOS['.m3u8'], { 'Cache-Control': 'no-cache' });
  }
  fs.readFile(caminho, (err, dados) => err ? enviar(res, 404, 'segmento expirou') : enviar(res, 200, dados, TIPOS['.ts']));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (TOKEN && url.searchParams.get('token') !== TOKEN) return enviar(res, 401, 'token inválido');

  const hls = url.pathname.match(/^\/hls\/([a-z0-9_-]+)\/([^/]+)$/);
  if (hls) return rotaHls(req, res, hls[1], hls[2]);
  if (url.pathname === '/playlist.m3u') return enviar(res, 200, playlistM3U(req), 'audio/x-mpegurl; charset=utf-8');
  if (url.pathname === '/epg.xml') return enviar(res, 200, epgXML(), 'application/xml; charset=utf-8');
  if (url.pathname === '/api/canais') {
    const lista = canais.map(({ id, nome, grupo, logo }) => ({ id, nome, grupo, logo, aoVivo: rodando.has(id) }));
    return enviar(res, 200, JSON.stringify(lista), 'application/json');
  }

  // arquivos estáticos do player web
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const caminho = path.resolve(PUBLICO, rel);
  if (!caminho.startsWith(PUBLICO + path.sep)) return enviar(res, 403, 'proibido');
  fs.readFile(caminho, (err, dados) => err
    ? enviar(res, 404, 'não encontrado')
    : enviar(res, 200, dados, TIPOS[path.extname(caminho)] || 'application/octet-stream'));
}).listen(PORTA, () => {
  console.log(`IPTV no ar: http://localhost:${PORTA}`);
  console.log(`Playlist para apps (VLC, TiviMate, IPTV Smarters): http://SEU_IP:${PORTA}/playlist.m3u${TOKEN ? '?token=...' : ''}`);
});

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => { for (const r of rodando.values()) r.proc.kill('SIGTERM'); process.exit(0); });
}
