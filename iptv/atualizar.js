// Baixa as listas públicas do iptv-org (github.com/iptv-org/iptv), testa cada
// stream e grava os que estão no ar em externos.json.
// Uso direto: node atualizar.js   (o server.js também chama isto sozinho todo dia)
const fs = require('fs');
const path = require('path');

const RAIZ = __dirname;
const CONFIG = path.join(RAIZ, 'fontes.json');
const SAIDA = path.join(RAIZ, 'externos.json');

function lerConfig() {
  return {
    atualizarACadaHoras: 24,
    listas: [],
    excluirGrupos: [],
    excluirNaoVinteQuatroHoras: false,
    testarStreams: true,
    timeoutTesteMs: 8000,
    simultaneos: 20,
    epgExterno: [],
    ...JSON.parse(fs.readFileSync(CONFIG, 'utf8')),
  };
}

// iptv-org.github.io às vezes é bloqueado por rede/firewall; o mesmo arquivo
// existe no branch gh-pages do repositório
function espelho(url) {
  const m = url.match(/^https:\/\/iptv-org\.github\.io\/(iptv|api)\/(.+)$/);
  return m ? `https://raw.githubusercontent.com/iptv-org/${m[1]}/gh-pages/${m[2]}` : null;
}

async function baixarTexto(url) {
  for (const u of [url, espelho(url)].filter(Boolean)) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(60_000) });
      if (r.ok) return await r.text();
      console.warn(`  ${u}: HTTP ${r.status}`);
    } catch (e) {
      console.warn(`  ${u}: ${e.cause?.code || e.message}`);
    }
  }
  throw new Error(`não consegui baixar ${url}`);
}

function lerM3U(texto) {
  const itens = [];
  let atual = null;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (linha.startsWith('#EXTINF')) {
      const attrs = {};
      for (const [, k, v] of linha.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[k] = v;
      atual = { attrs, nome: linha.slice(linha.lastIndexOf(',') + 1).trim() };
    } else if (linha.startsWith('#EXTVLCOPT:') && atual) {
      const [k, ...v] = linha.slice(11).split('=');
      if (k === 'http-user-agent') atual.userAgent = v.join('=');
      if (k === 'http-referrer') atual.referrer = v.join('=');
    } else if (linha && !linha.startsWith('#') && atual) {
      itens.push({ ...atual, url: linha });
      atual = null;
    }
  }
  return itens;
}

function cabecalhos(c) {
  const h = { 'User-Agent': c.userAgent || 'Mozilla/5.0 (iptv-caseiro)' };
  if (c.referrer) h.Referer = c.referrer;
  return h;
}

async function estaNoAr(c, timeoutMs) {
  try {
    const r = await fetch(c.url, { headers: cabecalhos(c), signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return false;
    // lê só o começo: playlist HLS tem que começar com #EXTM3U; outros formatos basta responder
    const leitor = r.body.getReader();
    const { value } = await leitor.read();
    leitor.cancel().catch(() => {});
    const inicio = Buffer.from(value || []).toString('utf8', 0, 7);
    return /\.m3u8(\?|$)/.test(c.url) ? inicio === '#EXTM3U' : true;
  } catch {
    return false;
  }
}

async function emParalelo(itens, limite, fn) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      resultados[i] = await fn(itens[i]);
    }
  }));
  return resultados;
}

const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'canal';

async function atualizar() {
  const cfg = lerConfig();
  const inicio = Date.now();
  console.log(`[atualizar] baixando ${cfg.listas.length} lista(s)…`);

  let brutos = [];
  for (const url of cfg.listas) {
    try {
      const itens = lerM3U(await baixarTexto(url));
      console.log(`  ${url}: ${itens.length} canais`);
      brutos.push(...itens);
    } catch (e) {
      console.warn(`  ${e.message}`);
    }
  }
  if (!brutos.length) throw new Error('nenhuma lista baixada; externos.json mantido como estava');

  const excluir = new Set(cfg.excluirGrupos.map(g => g.toLowerCase()));
  const vistos = new Set();
  const candidatos = brutos.filter(c => {
    if (vistos.has(c.url)) return false; // a mesma URL aparece na lista do país e na do idioma
    vistos.add(c.url);
    const grupos = (c.attrs['group-title'] || '').split(';').map(g => g.toLowerCase());
    if (grupos.some(g => excluir.has(g))) return false;
    if (cfg.excluirNaoVinteQuatroHoras && /\[Not 24\/7\]/i.test(c.nome)) return false;
    return true;
  });

  let noAr = candidatos;
  if (cfg.testarStreams) {
    console.log(`[atualizar] testando ${candidatos.length} streams (${cfg.simultaneos} por vez)…`);
    const ok = await emParalelo(candidatos, cfg.simultaneos, c => estaNoAr(c, cfg.timeoutTesteMs));
    noAr = candidatos.filter((_, i) => ok[i]);
  }

  // o mesmo canal pode vir em várias qualidades; fica a primeira que respondeu
  const porCanal = new Map();
  for (const c of noAr) {
    const chave = c.attrs['tvg-id'] || c.nome;
    if (!porCanal.has(chave)) porCanal.set(chave, c);
  }

  const ids = new Set();
  const canais = [...porCanal.values()].map(c => {
    let id = `x-${slug(c.attrs['tvg-id'] || c.nome)}`;
    for (let n = 2; ids.has(id); n++) id = `x-${slug(c.attrs['tvg-id'] || c.nome)}-${n}`;
    ids.add(id);
    const grupo = (c.attrs['group-title'] || '').split(';')[0];
    return {
      id,
      nome: c.nome.replace(/\s*\[Not 24\/7\]/i, '').trim(),
      grupo: !grupo || grupo === 'Undefined' ? 'Outros' : grupo,
      logo: c.attrs['tvg-logo'] || undefined,
      tvgId: c.attrs['tvg-id'] || undefined,
      tipo: 'direto',
      origem: c.url,
      userAgent: c.userAgent,
      referrer: c.referrer,
    };
  }).sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nome.localeCompare(b.nome));

  const saida = { atualizadoEm: new Date().toISOString(), epgExterno: cfg.epgExterno, canais };
  fs.writeFileSync(SAIDA + '.tmp', JSON.stringify(saida, null, 1));
  fs.renameSync(SAIDA + '.tmp', SAIDA); // troca atômica: o servidor nunca lê arquivo pela metade
  console.log(`[atualizar] ${canais.length} canais ${cfg.testarStreams ? `no ar de ${candidatos.length} testados` : '(sem teste)'} ` +
              `(${Math.round((Date.now() - inicio) / 1000)} s) → externos.json`);
  return saida;
}

function precisaAtualizar() {
  const horas = lerConfig().atualizarACadaHoras;
  try {
    return Date.now() - fs.statSync(SAIDA).mtimeMs > horas * 3600_000;
  } catch {
    return true; // ainda não existe
  }
}

module.exports = { atualizar, precisaAtualizar, lerM3U, SAIDA };

if (require.main === module) {
  atualizar().catch(e => { console.error(`[atualizar] erro: ${e.message}`); process.exit(1); });
}
