(function(){
"use strict";

/* =========================================================
   Utilidades
   ========================================================= */
const $ = s => document.querySelector(s);
// append nativo transforma null em texto "null"; aqui null/false são ignorados (conteúdo condicional)
{ const ap=Element.prototype.append; Element.prototype.append=function(...a){ return ap.apply(this, a.filter(x=>x!=null && x!==false)); };
  const rc=Element.prototype.replaceChildren; if(rc) Element.prototype.replaceChildren=function(...a){ return rc.apply(this, a.flat().filter(x=>x!=null && x!==false)); }; }
function h(tag, props, ...kids){
  const el = document.createElement(tag);
  if(props) for(const k in props){
    const v = props[k];
    if(v==null || v===false) continue;
    if(k==="class") el.className = v;
    else if(k==="text") el.textContent = v;
    else if(k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v===true ? "" : v);
  }
  for(const c of kids.flat()){
    if(c==null || c===false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}
const pad = n => String(n).padStart(2,"0");
const fmt = sec => { sec=Math.max(0,Math.ceil(sec)); return pad(Math.floor(sec/60))+":"+pad(sec%60); };
const isoDay = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const addDays = (iso,n) => { const [y,m,d]=iso.split("-").map(Number); const t=new Date(y,m-1,d+n); return isoDay(t); };
const brDate = iso => { const [y,m,d]=iso.split("-"); return d+"/"+m; };
const diffDays = (a,b) => Math.round((new Date(b+"T12:00")-new Date(a+"T12:00"))/864e5);
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random()*a.length)];
const clean = s => String(s).replace(/\|/g,"");
function slug(s){ return String(s).normalize("NFKD").replace(/[^\w\u3040-\u30ff\u4e00-\u9fff-]+/g,"-").replace(/-+/g,"-").slice(0,60).replace(/^-|-$/g,"") || "item"; }
const BLANK = /＿＿＿|___/;
const LS = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
const TODAY = isoDay(new Date());
const ICON = {
  play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  slow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" opacity=".55"/><rect x="3" y="5" width="2.4" height="14" rx="1"/></svg>'
};
/* depois de responder, o botão Continuar aparece na tela (no celular ele ficava abaixo da dobra) */
function reveal(el){ setTimeout(()=>{ try{ el.scrollIntoView({block:"center",behavior:"smooth"}); }catch(e){ try{ el.scrollIntoView(); }catch(_){} } },60); }
function autoNext(area,ms){ const snap=area.querySelector(".opts"); setTimeout(()=>{ const b=[...area.querySelectorAll("button.btn.wide")].find(x=>x.textContent==="Continuar"); if(b && b.isConnected && (!snap||snap.isConnected)) b.click(); }, ms||1100); }
function contBtn(onclick){ const b=h("button",{class:"btn primary wide",type:"button",text:"Continuar",onclick}); reveal(b); return b; }
function iconBtn(kind, label, onclick){ const b=h("button",{class:"iconbtn",type:"button","aria-label":label,title:label,onclick}); b.innerHTML=ICON[kind]; return b; }

/* =========================================================
   Conteúdo
   ========================================================= */
const JA_SETS=[LM_JA1,LM_JA2,LM_JA3,LM_JA4,LM_JA5], DE_SETS=[LM_DE,LM_DE2];
const C = {
  ja:{ units:JA_SETS.flatMap(s=>s.units), points:JA_SETS.flatMap(s=>s.points) },
  de:{ units:DE_SETS.flatMap(s=>s.units), points:DE_SETS.flatMap(s=>s.points) }
};
for(const l of ["ja","de"]){
  const c=C[l]; c.byId={}; c.unitById={};
  c.units.forEach(u=>{ c.unitById[u.id]=u; u.points=[]; });
  c.points.forEach((p,i)=>{ p.lang=l; p.idx=i; p.lvl=c.unitById[p.u].lvl; c.byId[p.id]=p; c.unitById[p.u].points.push(p);
    // "|" marca os blocos do exercício de ordenar; na tela e no áudio vira espaço (alemão) ou nada (japonês)
    p.x.forEach(x=>{ x.parts=x[0].split("|").map(t=>t.trim()); x[0]=x.parts.join(l==="de"?" ":""); });
  });
}
/* vocabulário e kanji */
function finishVocab(v, l){
  if(l==="ja"){ v.t=v.w; v.say=v.r; }
  else { const base=v.w.replace(/\s*\(sich\)/,""); v.say = v.w.includes("(sich)") ? "sich "+base : (v.a ? v.a+" "+v.w : v.w); v.t = v.a ? v.a+" "+v.w : v.w; }
}
for(const l of ["ja","de"]){
  const c=C[l]; c.vocab=[]; c.kanji=[]; c.kanjiByChar={};
  let lv="";
  const vsrc = l==="ja" ? [LM_VJA, LM_VJA2, LM_VJA3] : [LM_VDE, LM_VDE2, LM_VDE3];
  vsrc.join("\n").split("\n").forEach(line=>{
    line=line.trim(); if(!line) return; if(line[0]==="#"){ lv=line.slice(1); return; }
    const f=line.split("|"); if(f.length<6) return;
    const v = l==="ja" ? {kind:"vocab",lang:l,lvl:lv,w:f[0],r:f[1],m:f[2],ex:[f[3],f[4],f[5]]}
                       : {kind:"vocab",lang:l,lvl:lv,a:f[0],w:f[1],pl:f[2],m:f[3],ex:[f[4],"",f[5]]};
    finishVocab(v,l);
    v.id = "v-"+l+"-"+(l==="ja" ? v.w : slug(v.w)+"-"+(v.a||"x"));
    if(c.byId[v.id]) return;                       // a mesma palavra em duas listas entra uma vez só
    v.idx=c.vocab.length; c.vocab.push(v); c.byId[v.id]=v;
  });
  // ordem de estudo: níveis na ordem da trilha (a parte 2 de cada nível entra depois da parte 1)
  const lvOrder=[...new Set(c.units.map(u=>u.lvl))];
  c.vocab.sort((a,b)=> (lvOrder.indexOf(a.lvl)-lvOrder.indexOf(b.lvl)) || (a.idx-b.idx)).forEach((v,i)=>v.idx=i);
  if(l==="ja") [LM_KJA, LM_KJA2].join("\n").split("\n").forEach(line=>{
    line=line.trim(); if(!line) return; if(line[0]==="#"){ lv=line.slice(1); return; }
    const f=line.split("|"); if(f.length<5 || c.kanjiByChar[f[0]]) return;
    const k={kind:"kanji",lang:"ja",lvl:lv,k:f[0],on:f[1],kun:f[2],m:f[3],words:f[4].split(";").map(w=>w.split(":"))};
    k.t=k.k; k.say=k.words[0][1]; k.w=k.k; k.r=k.words[0][1]; k.ex=[k.words[0][0],k.words[0][1],k.words[0][2]];
    k.id="k-"+k.k; k.idx=c.kanji.length; c.kanji.push(k); c.byId[k.id]=k; c.kanjiByChar[k.k]=k;
  });
  c.readings=(window.LM_READ||[]).filter(r=>r.lang===l);
}
/* Blocos: cada unidade de gramática ganha sua fatia de palavras e kanji do mesmo nível,
   na ordem da lista. Bloco = 5 pontos de gramática + ~28 palavras (+ ~17 kanji no japonês). */
for(const l of ["ja","de"]){
  const c=C[l];
  c.units.forEach(u=>{ u.words=[]; u.kanjis=[]; });
  const lvls=[...new Set(c.units.map(u=>u.lvl))];
  lvls.forEach(lv=>{
    const us=c.units.filter(u=>u.lvl===lv), ws=c.vocab.filter(v=>v.lvl===lv), ks=c.kanji.filter(k=>k.lvl===lv);
    us.forEach((u,i)=>{
      u.words=ws.slice(Math.floor(i*ws.length/us.length), Math.floor((i+1)*ws.length/us.length));
      u.kanjis=ks.slice(Math.floor(i*ks.length/us.length), Math.floor((i+1)*ks.length/us.length));
      u.words.forEach(v=>v.u=u.id); u.kanjis.forEach(k=>k.u=u.id);
    });
  });
}
const LANGNAME = {ja:"japonês", de:"alemão"};
const DIFF = {N3:250, N2:340, A2:150, B1:250, B2:350};
const COMPS = {
  ja:[["vocabulario","Vocabulário"],["gramatica","Gramática"],["kanji","Kanji"],["leitura","Leitura"],["listening","Listening"],["escrita","Escrita"],["speaking","Fala"]],
  de:[["vocabulario","Vocabulário"],["gramatica","Gramática"],["leitura","Leitura"],["listening","Listening"],["escrita","Escrita"],["speaking","Fala"]]
};
const START = {ja:250, de:150};
const ESTADO = ["","Novo","Introduzido","Reconhece","Compreende","Produz com ajuda","Produz sozinho","Firme","Dominado"];
function fullSentence(q){ return q[0].replace(BLANK, q[1][0]); }

/* =========================================================
   Armazenamento (banco do app; se indisponível, este navegador)
   ========================================================= */
const store = { mode:"loading", root:null, items:{ja:{},de:{}}, erros:{}, sessoes:{}, perfil:{}, reportes:{}, vocabExtra:{}, dias:{}, listeners:[], loaded:{} };
const timers = {};
function changed(){ store.listeners.forEach(f=>{ try{ f(); }catch(e){} }); }
function localBlob(){ return LS.get("lm-local") || {itens:{}, erros:{}, sessoes:{}, perfil:{}}; }
function localSave(){ LS.set("lm-local", {itens:Object.assign({}, store.items.ja, store.items.de), erros:store.erros, sessoes:store.sessoes, perfil:store.perfil, reportes:store.reportes, vocabExtra:store.vocabExtra, dias:store.dias}); }
function loadLocal(){
  const b=localBlob();
  store.items={ja:{},de:{}};
  Object.values(b.itens||{}).forEach(it=>{ if(it && store.items[it.lang]) store.items[it.lang][it.id]=it; });
  store.erros=b.erros||{}; store.sessoes=b.sessoes||{}; store.perfil=b.perfil||{};
  store.reportes=b.reportes||{}; store.vocabExtra=b.vocabExtra||{}; store.dias=b.dias||{}; addExtraVocab(Object.values(store.vocabExtra));
  for(const l of ["ja","de"]) if(!store.perfil[l]) store.perfil[l]=newPerfil(l);
}
function newPerfil(l){ const comps={}; COMPS[l].forEach(([k])=>comps[k]={rating:START[l], margem:80, evidencias:0, tiposTarefa:[], ultima:null}); return {idioma:l, competencias:comps, atualizado:TODAY}; }
/* o banco só aceita ids com letras/números ASCII e _ - . ~ : @ + (máx. 200 bytes);
   palavras em japonês viram códigos (~7d4c…) e o id original fica no campo _k */
function fnv(s){ let x=0x811c9dc5; for(const ch of String(s)){ x^=ch.codePointAt(0); x=Math.imul(x,16777619)>>>0; } return x.toString(36); }
function safeId(id){
  let s=String(id).replace(/[^A-Za-z0-9_\-.~:@+]/g,c=>"~"+c.codePointAt(0).toString(16));
  if(s.length>150) s=s.slice(0,120)+"~h"+fnv(id);
  return (s==="."||s===".."||!s) ? "_"+s : s;
}
/* o banco entrega documentos congelados (somente leitura): tentar alterar um deles
   quebrava a resposta no meio (sem botão Continuar, sem salvar). Tudo que vem do banco
   é copiado antes de ser usado. */
function thaw(x){ return x==null ? x : JSON.parse(JSON.stringify(x)); }
let writeFails=0;
const pendingWrites={};
function write(col, id, data){
  if(store.mode==="loading"){ pendingWrites[col+"\u0000"+id]={col,id,data}; localSave(); return; }
  if(store.mode!=="db"){ localSave(); return; }
  clearTimeout(timers[col+id]);
  timers[col+id]=setTimeout(()=>{
    delete timers[col+id];
    try{
      store.root.collection(col).doc(safeId(id)).set(Object.assign({}, data, {_k:String(id)}))
        .then(()=>{ if(writeFails){ writeFails=0; banner(""); } })
        .catch(e=>{ writeFails++; console.warn("save",col,id,e); banner("Não consegui salvar ("+((e&&e.code)||"erro")+"). O progresso fica nesta aba; recarregue mais tarde."); });
    }catch(e){ writeFails++; console.warn("save",col,id,e); banner("Não consegui salvar um registro ("+col+"). Avise o Claude no chat."); }
  }, 500);
}
/* contadores do dia (acertos, erros, XP, revisões, produção, escuta…) — alimentam metas, sequência e nível */
function dayOf(l, iso){ return store.dias[l+"-"+(iso||TODAY)] || null; }
function addDay(l, inc){
  const id=l+"-"+TODAY, d=Object.assign({idioma:l, data:TODAY, ok:0, no:0}, store.dias[id]||{});
  for(const k in inc) d[k]=(d[k]||0)+inc[k];
  store.dias[id]=d; write("dias", id, d);
  if(inc.xp) addXP(l, inc.xp);
  goalsChanged();
}
function saveItem(it){ store.items[it.lang][it.id]=it; write("itens", it.id, it); }
function saveErro(id, e){ store.erros[id]=e; write("erros", id, e); }
function saveSessao(id, s){ store.sessoes[id]=s; write("sessoes", id, s); }
function savePerfil(l){ write("perfil", l, store.perfil[l]); }

let banTimer=null;
function banner(msg){ const b=$("#banner"); b.textContent=msg||""; b.hidden=!msg; }

async function initStore(){
  let db=null, user=null;
  try{ [db,user] = await Promise.all([claude.use("db"), claude.use("user")]); }catch(e){}
  if(!db || !user){ store.mode="local"; loadLocal(); banner("Salvando só neste navegador: abra o app pelo link do Claude para guardar o progresso na sua conta."); changed(); return; }
  let uid=null; try{ uid = await user.id(); }catch(e){}
  if(!uid){ store.mode="local"; loadLocal(); banner("Entre na sua conta Claude para guardar o progresso na nuvem. Por enquanto salvo neste navegador."); changed(); return; }
  store.root = db.doc("data/users/"+uid+"/app");
  try{
    const r = await store.root.get();
    if(!r.exists) await store.root.set({criadoEm:new Date().toISOString(), versao:"v2"});
    for(const l of ["ja","de"]){
      const s = await store.root.collection("perfil").doc(l).get();
      if(s.exists) store.perfil[l]=thaw(s.data()); else { store.perfil[l]=newPerfil(l); await store.root.collection("perfil").doc(l).set(store.perfil[l]); }
      COMPS[l].forEach(([k])=>{ if(!store.perfil[l].competencias[k]) store.perfil[l].competencias[k]={rating:START[l],margem:80,evidencias:0,tiposTarefa:[],ultima:null}; });
    }
    try{ const aj=await store.root.collection("perfil").doc("ajustes").get(); if(aj.exists){ const x=thaw(aj.data()); delete x._k; Object.assign(settings, x); LS.set("lm-settings", settings); } }catch(e){}
    store.mode="db";
    Object.values(pendingWrites).forEach(w=>write(w.col,w.id,w.data));
    store.root.collection("dias").orderBy("data","desc").limit(120).onSnapshot(q=>{
      q.docs.forEach(d=>{ const x=thaw(d.data()); const k=x._k||d.id; if(!timers["dias"+k]) store.dias[k]=x; }); changed();
    }, ()=>{});
    store.root.collection("reportes").limit(500).onSnapshot(q=>{
      q.docs.forEach(d=>{ const r=thaw(d.data()); if(r && r.chave) store.reportes[r.chave]=r; }); changed();
    }, ()=>{});
    store.root.collection("vocabExtra").limit(2000).onSnapshot(q=>{
      const docs=q.docs.map(d=>{ const x=thaw(d.data()); return Object.assign({}, x, {id:x.id||x._k||d.id}); }); docs.forEach(d=>store.vocabExtra[d.id]=d); addExtraVocab(docs); changed();
    }, ()=>{});
    store.root.collection("itens").limit(5000).onSnapshot(q=>{
      const next={ja:{},de:{}};
      q.docs.forEach(d=>{ const it=thaw(d.data()); if(!it || !next[it.lang]) return; const k=it.id||it._k||d.id; const prev=next[it.lang][k]; if(!prev || (it.mod||0)>=(prev.mod||0)) next[it.lang][k]=it; });
      // mantém versões locais mais novas ainda não gravadas
      for(const l of ["ja","de"]) for(const id in store.items[l]){ const a=store.items[l][id], b=next[l][id]; if(!b || (a.mod||0)>(b.mod||0)) next[l][id]=a; }
      store.items=next; store.loaded.itens=true; changed();
    }, ()=>{});
    store.root.collection("erros").orderBy("ultima","desc").limit(200).onSnapshot(q=>{
      const next={}; q.docs.forEach(d=>{ const x=thaw(d.data()); next[x._k||d.id]=x; }); store.erros=Object.assign(next, pendingOnly("erros")); changed();
    }, ()=>{});
    store.root.collection("sessoes").orderBy("data","desc").limit(120).onSnapshot(q=>{
      const next={}; q.docs.forEach(d=>{ const x=thaw(d.data()); next[x._k||d.id]=x; }); store.sessoes=Object.assign(next, pendingOnly("sessoes")); store.loaded.sessoes=true; changed();
    }, ()=>{});
    changed();
  }catch(e){
    store.mode="local"; loadLocal(); banner("Não consegui abrir o banco agora; salvando neste navegador. Recarregue mais tarde."); changed();
  }
}
function pendingOnly(col){ const out={}; for(const k in timers){ if(k.startsWith(col) && store[col][k.slice(col.length)]) out[k.slice(col.length)]=store[col][k.slice(col.length)]; } return out; }

/* =========================================================
   Aprendizagem: itens, repetição espaçada, perfil
   ========================================================= */
function getItem(p){ return store.items[p.lang][p.id] || null; }
function ensureItem(p){
  let it=getItem(p);
  if(!it) it={id:p.id, lang:p.lang, u:p.u||null, tipo:p.kind||"gramatica", estado:1, reps:0, ef:2.5, intervalo:0, vence:addDays(TODAY,1), acertos:0, erros:0, ultima:null, srsDia:null, prodDias:[], criado:TODAY, mod:Date.now()};
  return migrateItem(Object.assign({}, it));
}
function introduce(p){
  const it=ensureItem(p);
  const isNew=it.estado<2;
  if(isNew){ it.estado=2; it.vence=addDays(TODAY,1); it.criado=TODAY; }
  it.mod=Date.now(); saveItem(it);
  if(isNew) addDay(p.lang, {novos:1, xp:3});
}
function dueItems(l){
  return Object.values(store.items[l]).filter(it=>it.estado>=2 && it.vence<=TODAY && !it.suspenso && C[l].byId[it.id])
    .sort((a,b)=> a.vence<b.vence?-1: a.vence>b.vence?1: (b.erros||0)-(a.erros||0));
}
function learned(l){ return C[l].points.filter(p=>{ const it=getItem(p); return it && it.estado>=2; }); }
function nextNew(l){ return C[l].points.find(p=>{ const it=getItem(p); return !it || it.estado<2; }) || null; }
function eloUpdate(l, comp, d, ok, tipo){
  const pf=store.perfil[l]; if(!pf) return;
  const c=pf.competencias[comp]; if(!c) return;
  const exp=1/(1+Math.pow(10,(d-c.rating)/150));
  const K=Math.max(8, c.margem/3);
  c.rating=Math.max(0, Math.min(600, Math.round(c.rating + K*((ok?1:0)-exp))));
  c.margem=Math.max(20, Math.round(c.margem*0.97*10)/10);
  c.evidencias=(c.evidencias||0)+1;
  c.tiposTarefa=c.tiposTarefa||[]; if(!c.tiposTarefa.includes(tipo)) c.tiposTarefa.push(tipo);
  c.ultima=TODAY; pf.atualizado=TODAY;
  savePerfil(l);
}
const XP_OF = {mc:5, vmc:5, kmc:5, vouvir:6, order:8, ditado:8, vtyped:8, producao:12, feynman:15};
const COMP_OF = {feynman:"gramatica", mc:"gramatica", order:"gramatica", ditado:"listening", producao:"escrita", leitura:"leitura", vmc:"vocabulario", vouvir:"listening", vtyped:"vocabulario", kmc:"kanji"};

/* registra uma resposta */
function record(p, kind, ok, ms, opt){
  opt=opt||{};
  const it=ensureItem(p);
  if(it.estado<2) it.estado=2;
  const grade = opt.grade!=null ? opt.grade : (ok ? (ms<20000 ? 5 : 4) : 1);
  if(ok){
    it.acertos=(it.acertos||0)+1;
    if(kind==="mc"||kind==="vmc"||kind==="kmc") it.estado=Math.max(it.estado,3);
    if(kind==="order"||kind==="ditado"||kind==="vouvir"||kind==="feynman") it.estado=Math.max(it.estado,4);
    if(kind==="kmc" && (it.acertos||0)>=4) it.estado=Math.max(it.estado,5);
    if(kind==="producao"||kind==="vtyped"){
      it.prodDias=Array.from(new Set([...(it.prodDias||[]), TODAY]));
      it.estado=Math.max(it.estado, it.prodDias.length>=2 ? 6 : 5);
    }
    if(it.estado>=6 && (it.intervalo||0)>=14) it.estado=Math.max(it.estado,7);
    if(it.estado>=7 && (it.intervalo||0)>=30) it.estado=8;
  } else {
    it.erros=(it.erros||0)+1;
    if(it.estado>=5) it.estado-=1;
  }
  const wasDue = !!(it.S && it.vence<=TODAY && it.srsDia!==TODAY);
  if(it.srsDia!==TODAY){ schedule(it, ratingOf(kind, ok, grade)); it.srsDia=TODAY; }
  else if(!ok){ migrateItem(it); if(it.S) it.S=Math.round(clampS(fsrsShort(it.S,1))*100)/100; it.vence=addDays(TODAY,1); it.reps=0; it.intervalo=1; }
  it.ultima=TODAY; it.mod=Date.now();
  saveItem(it);
  eloUpdate(p.lang, COMP_OF[kind]||"gramatica", DIFF[p.lvl]||250, ok, kind);
  if(ok){
    // erro antigo deste ponto fica mais perto de "corrigido"
    for(const id in store.erros){ const e=store.erros[id];
      if(e.conteudo===p.id && !e.corrigido && e.ultima<TODAY){ e.acertosDepois=(e.acertosDepois||0)+1; if(e.acertosDepois>=3) e.corrigido=true; saveErro(id,e); } }
  } else if(opt.wrong!=null){
    const id=p.lang+"-"+(COMP_OF[kind]||"gramatica")+"-"+p.id+"-"+slug(opt.right).slice(0,30);
    const old=store.erros[id];
    const e = old ? Object.assign({}, old, {erro:opt.wrong, ocorrencias:(old.ocorrencias||1)+1, ultima:TODAY, corrigido:false, acertosDepois:0})
                  : {idioma:p.lang, competencia:COMP_OF[kind]||"gramatica", conteudo:p.id, ponto:p.t, erro:opt.wrong, correta:opt.right, causaProvavel:opt.why||"", ocorrencias:1, primeira:TODAY, ultima:TODAY, corrigido:false, acertosDepois:0};
    saveErro(id, e);
  }
  const xp = ok ? (XP_OF[kind]||5) : 2;
  const inc={xp}; inc[ok?"ok":"no"]=1; if(wasDue) inc.rev=1;
  if(kind==="producao"||kind==="feynman") inc.prod=1;
  if(kind==="ditado"||kind==="vouvir") inc.esc=1;
  addDay(p.lang, inc);
  if(S) { S.stats[ok?"ok":"no"]++; S.xp=(S.xp||0)+xp; if(!ok && opt.wrong!=null) S.errs.push({p, wrong:opt.wrong, right:opt.right}); if(!S.touched.includes(p.id)) S.touched.push(p.id); }
  updateBadge();
}

/* =========================================================
   Níveis, XP, metas do dia e sequência
   Nível do curso (N3/N2, A2/B1/B2) vem do domínio real dos itens (estabilidade no FSRS);
   o nível de XP (級 → 段) mede constância e esforço.
   ========================================================= */
const KNUM=["","一","二","三","四","五","六","七","八","九","十"];
const LVL_ORDER={ja:["N3","N2"], de:["A2","B1","B2"]};
function xpLevel(xp){ return Math.floor(Math.sqrt(Math.max(0,xp||0)/50))+1; }
function xpForLevel(n){ return 50*(n-1)*(n-1); }
function rankName(n){ if(n<10) return (10-n)+"級"; const d=n-9; return (d===1?"初":d<=10?KNUM[d]:String(d))+"段"; }
function addXP(l, n){
  const pf=store.perfil[l]; if(!pf || !n) return;
  const before=xpLevel(pf.xp||0);
  pf.xp=(pf.xp||0)+n; savePerfil(l);
  const after=xpLevel(pf.xp);
  if(after>before) toast("Subiu de nível: "+after+" · "+rankName(after)+". Continue assim.");
  scheduleUI();
}
/* domínio de um item: introduzido = 25 %; o resto cresce com a estabilidade até 21 dias */
function mastery(it){ if(!it || it.estado<2 || it.suspenso) return 0; return Math.min(1, 0.25 + 0.75*Math.min(1,(it.S||0)/21)); }
function unitItems(u){ return [...u.points, ...u.words, ...u.kanjis]; }
function unitProgress(u){
  const l=u.points[0] ? u.points[0].lang : state.lang;
  const pts=u.points.map(p=>mastery(getItem(p))), oth=[...u.words,...u.kanjis].map(v=>mastery(getItem(v)));
  const tot=pts.length*2+oth.length; if(!tot) return 0;
  return (pts.reduce((a,b)=>a+b,0)*2 + oth.reduce((a,b)=>a+b,0))/tot;
}
function unitDone(u){
  const l=u.points[0].lang, pf=store.perfil[l]||{};
  if(pf.blocos && pf.blocos[u.id] && pf.blocos[u.id].passou) return true;
  if(!u.points.every(p=>{ const it=getItem(p); return it && it.estado>=2; })) return false;
  return unitProgress(u)>=0.75;
}
function levelDone(l, lvl){
  const pf=store.perfil[l]||{};
  if(pf.marcos && pf.marcos[lvl] && pf.marcos[lvl].passou) return true;
  return C[l].units.filter(u=>u.lvl===lvl).every(unitDone);
}
function courseLevel(l){ return LVL_ORDER[l].find(lv=>!levelDone(l,lv)) || "concluído"; }
function levelProgress(l, lvl){
  const us=C[l].units.filter(u=>u.lvl===lvl); if(!us.length) return 0;
  if(levelDone(l,lvl)) return 1;
  return us.reduce((a,u)=>a+(unitDone(u)?1:unitProgress(u)),0)/us.length;
}
function courseProgress(l){ const lv=LVL_ORDER[l]; return lv.reduce((a,x)=>a+levelProgress(l,x),0)/lv.length; }

/* sequência: dia estudado = 10+ respostas ou um pomodoro em qualquer idioma.
   Um dia perdido por semana não quebra a sequência (proteção). */
function studiedOn(iso){
  for(const l of ["ja","de"]){ const d=store.dias[l+"-"+iso]; if(d && ((d.ok||0)+(d.no||0)>=10 || d.pomos)) return true; }
  return Object.values(store.sessoes).some(s=>s.data===iso);
}
function streakInfo(){
  let d=TODAY, streak=0, lastFreeze=null; const freezes=[];
  if(!studiedOn(d)) d=addDays(d,-1);
  for(let i=0;i<800;i++){
    if(studiedOn(d)){ streak++; }
    else if(streak>0 && (!lastFreeze || diffDays(d,lastFreeze)>=7) && studiedOn(addDays(d,-1))){ lastFreeze=d; freezes.push(d); }
    else break;
    d=addDays(d,-1);
  }
  const freezeFree = !freezes.length || diffDays(freezes[0],TODAY)>=7;
  return {streak, freezes, freezeFree};
}

/* metas do dia: 3 por idioma, escolhidas conforme o que está pendente */
const GOALDEF={
  pomo:{t:n=>n>1?"Concluir "+n+" pomodoros":"Concluir o pomodoro do dia", f:"pomos"},
  rev:{t:n=>"Fazer "+n+" revisões vencidas", f:"rev"},
  ok:{t:n=>"Acertar "+n+" questões", f:"ok"},
  prod:{t:n=>"Produzir "+n+" frases ou explicações suas", f:"prod"},
  esc:{t:n=>"Fazer "+n+" exercícios de escuta", f:"esc"},
  leit:{t:n=>n>1?"Ler "+n+" textos":"Ler 1 texto até o fim", f:"leit"},
  conv:{t:n=>"Trocar "+n+" falas na conversa", f:"conv"},
  novos:{t:n=>"Aprender "+n+" itens novos", f:"novos"}
};
function dayHash(s){ let x=0; for(const ch of s) x=(x*31+ch.codePointAt(0))>>>0; return x; }
function goalsFor(l){
  const pf=store.perfil[l]; if(!pf) return [];
  if(!pf.metas || pf.metas.data!==TODAY){
    const due=dueItems(l).length, list=[{id:"pomo", n:Math.max(1,Number(settings.metaPomos)||1)}];
    list.push(due>=5 ? {id:"rev", n:Math.min(due,40)} : {id:"ok", n:25});
    const pool=["prod","esc","leit","novos", ...(aiReady()?["conv"]:[])];
    const pick1=pool[dayHash(TODAY+l)%pool.length];
    list.push({id:pick1, n:{prod:3, esc:8, leit:1, novos:8, conv:6}[pick1]});
    pf.metas={data:TODAY, lista:list, pagas:[]}; savePerfil(l);
  }
  const d=dayOf(l)||{};
  return pf.metas.lista.map(g=>({...g, t:GOALDEF[g.id].t(g.n), v:Math.min(g.n, d[GOALDEF[g.id].f]||0)}));
}
let goalTimer=null;
function goalsChanged(){
  clearTimeout(goalTimer);
  goalTimer=setTimeout(()=>{
    for(const l of ["ja","de"]){
      const pf=store.perfil[l]; if(!pf || !pf.metas || pf.metas.data!==TODAY) continue;
      const gs=goalsFor(l); let paid=false;
      gs.forEach(g=>{ if(g.v>=g.n && !pf.metas.pagas.includes(g.id)){ pf.metas.pagas.push(g.id); paid=true; addXP(l,20); if(l===state.lang) toast("Meta cumprida: "+g.t+" (+20 XP)"); } });
      if(paid && gs.every(g=>g.v>=g.n) && !pf.metas.pagas.includes("todas")){ pf.metas.pagas.push("todas"); addXP(l,30); if(l===state.lang) toast("Todas as metas de hoje cumpridas (+30 XP). 見事!"); }
      if(paid) savePerfil(l);
    }
    scheduleUI();
  },150);
}

/* =========================================================
   Voz
   ========================================================= */
let voices=[], settings=Object.assign({voz:"texto", rate:0.9, retencao:0.9, metaPomos:1, rotacao:"rodizio", provaJa:"", provaDe:"", novasPalavras:"auto"}, LS.get("lm-settings")||{});
function saveSettings(){ LS.set("lm-settings", settings); if(store.mode==="db") write("perfil","ajustes",Object.assign({},settings)); }
function loadVoices(){ try{ voices=speechSynthesis.getVoices(); }catch(e){ voices=[]; } }
if("speechSynthesis" in window){ loadVoices(); speechSynthesis.onvoiceschanged=loadVoices; }
const TTS_LANG={ja:"ja-JP", de:"de-DE", pt:"pt-BR"};
function voiceFor(l){ const pre=l==="ja"?"ja":l==="de"?"de":"pt"; const vs=voices.filter(v=>v.lang && v.lang.toLowerCase().startsWith(pre)); return vs.find(v=>/google|natural|premium|enhanced/i.test(v.name)) || vs[0]; }
function speak(text, l, o){
  o=o||{};
  if(!("speechSynthesis" in window)){ o.onend && o.onend(false); return; }
  speechSynthesis.cancel();
  const v=voiceFor(l); let n=0; const times=o.times||1;
  const once=()=>{
    const u=new SpeechSynthesisUtterance(text);
    u.lang = TTS_LANG[l]||"de-DE"; if(v) u.voice=v; u.rate=o.rate||settings.rate;
    u.onend=()=>{ n++; o.onrep && o.onrep(n); if(n<times && !(o.stop && o.stop())) setTimeout(()=>{ if(!(o.stop && o.stop())) once(); }, o.gap||1400); else o.onend && o.onend(true); };
    u.onerror=()=>{ o.onend && o.onend(false); };
    speechSynthesis.speak(u);
  };
  once();
}
/* toca uma lista de falas em sequência; devolve uma função que interrompe */
function speakSeq(list, onDone){
  let i=0, stopped=false;
  const next=()=>{ if(stopped) return; if(i>=list.length){ onDone && onDone(); return; }
    const x=list[i++]; if(x.pause){ setTimeout(next, x.pause); return; }
    x.onstart && x.onstart();
    speak(x.text, x.l, {rate:x.rate, onend:()=>setTimeout(next, x.gap||500)}); };
  next();
  return ()=>{ stopped=true; try{ speechSynthesis.cancel(); }catch(e){} };
}
function sayOf(l, text, kana){ return (l==="ja" && settings.voz==="kana" && kana) ? kana : clean(text); }
function playBtns(l, text, kana){
  const t=sayOf(l,text,kana);
  return h("span",{class:"row",style:"gap:6px;flex-wrap:nowrap"},
    iconBtn("play","Ouvir", ()=>speak(t,l,{rate:1})),
    iconBtn("slow","Ouvir devagar", ()=>speak(t,l,{rate:0.7})));
}

/* =========================================================
   Claude dentro do app (capacidade sample)
   ========================================================= */
let sampleFn=null, aiOff=false, aiMsg="";
const aiHooks=[];
(async()=>{ try{ sampleFn = await claude.use("sample"); }catch(e){ sampleFn=null; } rerenderAIBits(); })();
function aiReady(){ return !!sampleFn && !aiOff; }
function aiError(e){
  const c=e && e.code;
  if(["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed"].includes(c)){ aiOff=true; aiMsg="O professor (Claude) não está liberado nesta visualização. Os exercícios prontos continuam funcionando."; rerenderAIBits(); return aiMsg; }
  if(c==="rate_limited") return "Muitas chamadas seguidas ou limite de uso atingido. Tente de novo em alguns minutos.";
  if(c==="session_expired") return "Sua sessão do Claude expirou. Entre de novo e tente outra vez.";
  if(c==="invalid_json") return "A resposta veio num formato que não consegui ler. Tente de novo.";
  if(c==="cancelled") return "";
  return "Não consegui falar com o professor agora. Tente de novo.";
}
function rerenderAIBits(){ aiHooks.forEach(f=>{ try{ f(); }catch(e){} }); }
function levelLine(l){
  const cur=courseLevel(l);
  if(l==="ja") return "nível JLPT "+(cur==="N3"?"N3 indo para N2 (já chegou ao N2 no passado)":"N2 (consolidando até o fim do N2)");
  return "nível CEFR "+(cur==="A2"?"A2 indo para B1":cur==="B1"?"B1 indo para B2":"B2");
}
function aiLevel(l){ const cur=courseLevel(l); return l==="ja" ? (cur==="N3"?"N3–N2":"N2") : (cur==="A2"?"A2–B1":cur==="B1"?"B1–B2":"B2"); }

/* =========================================================
   Comparação de texto (ditado)
   ========================================================= */
const kataToHira = s => s.replace(/[ァ-ヶ]/g, c=>String.fromCharCode(c.charCodeAt(0)-0x60));
function norm(l, s){
  s=String(s||"").normalize("NFKC");
  if(l==="ja") return kataToHira(s).replace(/[\s。、，．！？!?,.「」『』・〜～…]/g,"");
  return s.toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^\p{L}\p{N} ]/gu,"").replace(/\s+/g," ").trim();
}
function lev(a,b){ const m=a.length,n=b.length; if(!m) return n; if(!n) return m; let prev=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){ const cur=[i]; for(let j=1;j<=n;j++) cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+(a[i-1]===b[j-1]?0:1)); prev=cur; } return prev[n]; }
function similarity(l, input, targets){
  const x=norm(l,input); let best=0;
  for(const t of targets){ const y=norm(l,t); if(!y) continue; best=Math.max(best, 1-lev(x,y)/Math.max(x.length,y.length)); }
  return best;
}

/* =========================================================
   Exercícios
   ========================================================= */
function exHeader(p, label, extra){
  // em palavras e kanji o título entregaria a resposta: só o tipo de exercício
  return h("div",{class:"ex-meta"}, h("span",{class:"chip s2",text:label}), p.kind?null:h("span",{lang:p.lang,text:p.t}), extra?h("span",{class:"spacer"}):null, extra||null);
}
function feedbackBox(ok, l, sentence, kana, pt, why, verdict){
  const box=h("div",{class:"feedback "+(ok?"ok":"no")},
    h("div",{class:"verdict",text: verdict || (ok?"Certo":"Não foi dessa vez")}),
    h("div",{class:"row",style:"flex-wrap:nowrap;align-items:flex-start"},
      h("div",{style:"flex:1;min-width:0"},
        h("div",{lang:l,style:"font-size:1.15rem;font-weight:500",text:clean(sentence)}),
        l==="ja"&&kana ? h("div",{class:"small muted",lang:"ja",text:kana}) : null,
        pt ? h("div",{class:"small",text:pt}) : null),
      playBtns(l, sentence, kana)),
    why ? h("div",{class:"small",text:why}) : null);
  return box;
}

/* múltipla escolha — q = [frase com lacuna, [correta,...], kana, tradução, por quê] */
function exMC(p, q, done, tag, onAnswer){
  const l=p.lang, t0=Date.now();
  const card=h("div",{class:"ex-card"});
  const [s, opts, kana, pt, why]=q;
  const parts=s.split(BLANK);
  const blank=h("span",{class:"blank",text:"？"});
  const qi=p.q.indexOf(q), key= qi>=0 ? p.id+"#q"+qi : "gen:"+s;
  card.append(exHeader(p, tag||"Escolha a forma", onAnswer?null:reportBtn(p,key,card,done)), h("div",{class:"prompt",lang:l}, parts[0], blank, parts[1]||""));
  const grid=h("div",{class:"opts"});
  shuffle(opts.map((o,i)=>i)).forEach(i=>{
    const b=h("button",{class:"opt",type:"button",lang:l,text:opts[i]});
    b.addEventListener("click",()=>{
      const ok=i===0;
      grid.querySelectorAll("button").forEach(x=>x.disabled=true);
      b.classList.add(ok?"right":"wrong");
      if(!ok) [...grid.children].find(x=>x.textContent===opts[0]).classList.add("right");
      blank.textContent=opts[0];
      const full=fullSentence(q);
      if(onAnswer) onAnswer(ok); else record(p,"mc",ok,Date.now()-t0, ok?{}:{wrong:s.replace(BLANK,opts[i]), right:full, why});
      card.append(feedbackBox(ok, l, full, kana, pt, why));
      if(!ok) speak(sayOf(l,full,kana), l, {rate:0.9});
      card.append(contBtn(()=>done(ok)));
    });
    b.dataset.k=grid.children.length+1; grid.append(b);
  });
  card.append(grid);
  return card;
}

/* montar a frase */
function exOrder(p, x, done){
  const l=p.lang, t0=Date.now();
  const parts=x.parts;
  let order=shuffle(parts.map((_,i)=>i)); let guard=0;
  while(order.every((v,i)=>v===i) && guard++<10) order=shuffle(order);
  const card=h("div",{class:"ex-card"});
  card.append(exHeader(p,"Monte a frase",reportBtn(p,p.id+"#x"+p.x.indexOf(x),card,done)), h("div",{class:"small",text:"Tradução: "+x[2]}));
  const built=h("div",{class:"built",lang:l,"aria-label":"Sua frase"});
  const pool=h("div",{class:"chips",lang:l});
  const chosen=[];
  const check=h("button",{class:"btn primary wide",type:"button",text:"Conferir",disabled:true});
  function redraw(){
    built.innerHTML="";
    if(!chosen.length) built.append(h("span",{class:"muted small",text:"Toque nos blocos na ordem certa"}));
    chosen.forEach((pi,k)=>built.append(h("button",{class:"tok",type:"button",text:parts[pi],onclick:()=>{ chosen.splice(k,1); pool.children[order.indexOf(pi)].disabled=false; redraw(); }})));
    check.disabled = chosen.length!==parts.length;
  }
  order.forEach(pi=>pool.append(h("button",{class:"tok",type:"button",text:parts[pi],onclick:e=>{ e.currentTarget.disabled=true; chosen.push(pi); redraw(); }})));
  check.addEventListener("click",()=>{
    const answer=chosen.map(i=>parts[i]).join(l==="de"?" ":"");
    const ok=orderOk(l, chosen, parts);
    check.remove(); pool.remove();
    built.querySelectorAll("button").forEach(b=>b.disabled=true);
    record(p,"order",ok,Date.now()-t0, ok?{}:{wrong:answer, right:clean(x[0])});
    const exact=chosen.every((v,k)=>v===k);
    card.append(feedbackBox(ok,l,x[0],x[1],x[2], ok&&!exact?"Sua ordem também funciona; esta é a do modelo.":null, ok?"Certo":"A ordem certa é:"));
    speak(sayOf(l,x[0],x[1]), l, {rate:0.9});
    card.append(contBtn(()=>done(ok)));
  });
  redraw();
  card.append(built, pool, check);
  return card;
}

/* aceita ordens alternativas corretas:
   japonês: o final da frase (predicado) fixo e o resto em qualquer ordem;
   alemão: troca do 1º bloco com o bloco depois do verbo (Gestern habe ich… / Ich habe gestern…) */
function orderOk(l, chosen, parts){
  const n=parts.length, txt=a=>norm(l,a.map(i=>parts[i]).join(" "));
  const ideal=parts.map((_,i)=>i);
  if(txt(chosen)===txt(ideal)) return true;
  if(l==="ja"){
    // blocos iniciais terminados em partícula (を, に, で, は…) podem trocar de lugar entre si; o resto fica fixo
    let k=0; while(k<n-1 && !/[、,]$/.test(parts[k]) && (k===0 || /(を|に|で|は|が|へ|と|も|から|まで|より)$/.test(parts[k]))) k++;
    if(k<2) return false;
    const head=chosen.slice(0,k).slice().sort((a,b)=>a-b);
    return head.every((v,j)=>v===j) && chosen.slice(k).every((v,j)=>v===k+j);
  }
  if(n>=3){ const inv=ideal.slice(); [inv[0],inv[2]]=[inv[2],inv[0]]; if(txt(chosen)===txt(inv) && !/[,?]/.test(parts[0]+parts[1]+parts[2])) return true; }
  return false;
}

/* ditado */
function exDictation(p, x, done){
  const l=p.lang, t0=Date.now(); let plays=0;
  const say=sayOf(l,x[0],x[1]);
  const card=h("div",{class:"ex-card"});
  const inp=h("textarea",{id:"dict-"+p.id,lang:l,placeholder: l==="ja"?"Digite o que ouviu (kana ou kanji)":"Schreib, was du hörst",rows:"2",autocomplete:"off",autocapitalize:"off",spellcheck:"false"});
  const play=r=>{ plays++; speak(say,l,{rate:r}); };
  card.append(exHeader(p,"Ditado",reportBtn(p,p.id+"#x"+p.x.indexOf(x),card,done)),
    h("p",{class:"small muted",text: l==="ja" ? "Ouça e escreva a frase. Pode digitar em hiragana; kanji não é obrigatório." : "Ouça e escreva a frase. Maiúsculas e pontuação não contam."}),
    h("div",{class:"row"}, h("button",{class:"btn primary",type:"button",text:"▶ Ouvir",onclick:()=>play(1)}), h("button",{class:"btn",type:"button",text:"Devagar",onclick:()=>play(0.7)})),
    inp);
  const btns=h("div",{class:"row"});
  const giveUp=h("button",{class:"btn ghost",type:"button",text:"Não entendi"});
  const check=h("button",{class:"btn primary",type:"button",text:"Conferir"});
  btns.append(check, giveUp); card.append(btns);
  function finish(input){
    const sim=input ? similarity(l,input,[x[0],x[1]]) : 0;
    const ok=sim>=0.8, near=ok && sim<0.95;
    btns.remove(); inp.disabled=true;
    record(p,"ditado",ok,Date.now()-t0,{grade: !ok?1 : near?3 : plays>2?4:5, wrong: ok?null:(input||"(em branco)"), right:clean(x[0])});
    card.append(feedbackBox(ok,l,x[0],x[1],x[2], near?"Quase perfeito: compare com a frase acima.":null, ok?(near?"Quase":"Certo"):"A frase era:"));
    card.append(contBtn(()=>done(ok)));
  }
  check.addEventListener("click",()=>{ if(!inp.value.trim()){ inp.focus(); return; } finish(inp.value); });
  giveUp.addEventListener("click",()=>finish(""));
  setTimeout(()=>play(settings.rate), 250);
  return card;
}

/* produção livre */
function exProduce(p, done){
  const l=p.lang, t0=Date.now();
  const card=h("div",{class:"ex-card"});
  const inp=h("textarea",{id:"prod-"+p.id,lang:l,rows:"3",placeholder: l==="ja"?"例：毎日日本語を勉強するようにしています。":"Beispiel: Ich lerne jeden Tag Deutsch, weil…"});
  card.append(exHeader(p,"Sua frase"),
    h("p",{text:"Escreva uma frase sua, sobre a sua vida, usando "}, h("b",{lang:l,text:p.t}), "."),
    h("p",{class:"small muted",text:"Frase sobre você fixa mais do que copiar o exemplo. Pode ser curta."}),
    inp);
  const out=h("div",{class:"stack"});
  const btns=h("div",{class:"row"});
  const aiBtn=h("button",{class:"btn primary",type:"button",text:"Corrigir com o professor"});
  const selfBtn=h("button",{class:"btn",type:"button",text:"Comparar com um exemplo"});
  const skip=h("button",{class:"btn ghost",type:"button",text:"Pular",onclick:()=>done(null)});
  btns.append(aiBtn, selfBtn, skip);
  card.append(btns, out);
  const hook=()=>{ aiBtn.hidden=!aiReady(); };
  aiHooks.push(hook); hook();
  selfBtn.addEventListener("click",()=>{
    if(!inp.value.trim()){ inp.focus(); return; }
    btns.remove(); inp.disabled=true;
    const x=pick(p.x);
    out.append(h("div",{class:"small muted",text:"Exemplo do ponto:"}), feedbackBox(true,l,x[0],x[1],x[2],null,"Compare a estrutura"),
      h("p",{class:"small",text:"A sua frase usa a mesma estrutura, na forma certa?"}),
      h("div",{class:"row"},
        h("button",{class:"btn primary",type:"button",text:"Sim, usei certo",onclick:()=>{ record(p,"producao",true,Date.now()-t0,{grade:3}); done(true); }}),
        h("button",{class:"btn",type:"button",text:"Errei",onclick:()=>{ record(p,"producao",false,Date.now()-t0,{wrong:inp.value.trim(), right:clean(x[0])}); done(false); }})));
  });
  aiBtn.addEventListener("click", async ()=>{
    const txt=inp.value.trim(); if(!txt){ inp.focus(); return; }
    aiBtn.disabled=true; selfBtn.disabled=true; inp.disabled=true;
    const wait=h("p",{class:"small muted",text:"O professor está lendo sua frase…"}); out.append(wait);
    const prompt=`Você é professor de ${LANGNAME[l]} de um aluno brasileiro, ${levelLine(l)}.
Ponto gramatical do dia: ${p.t} — ${p.m}. Formação: ${p.f}.
O aluno escreveu esta frase tentando usar o ponto:
"""${txt}"""
Avalie gramática, uso do ponto e naturalidade. Se a frase for natural e correta, ok = true (pequenos detalhes de estilo não reprovam).
Responda só com JSON neste formato:
{"ok":true,"usouPonto":true,"corrigida":"frase corrigida ou a própria frase se estiver certa","leitura":"${l==="ja"?"leitura da frase corrigida em hiragana, com espaços entre as palavras":""}","traducao":"tradução em português","explicacao":"de 1 a 3 frases curtas em português dizendo o que estava certo ou errado"}`;
    try{
      const r=await sampleFn.json(prompt,{cache:false});
      wait.remove();
      if(!r || typeof r.corrigida!=="string") throw {code:"invalid_json"};
      const ok=!!r.ok && r.usouPonto!==false;
      record(p,"producao",ok,Date.now()-t0, ok?{}:{wrong:txt, right:r.corrigida, why:r.explicacao});
      out.append(feedbackBox(ok,l,r.corrigida,r.leitura||"",r.traducao||"",r.explicacao||"", ok?"Frase aprovada":"Versão corrigida"));
      btns.remove();
      out.append(contBtn(()=>done(ok)));
    }catch(e){
      wait.remove(); const m=aiError(e); if(m) out.append(h("p",{class:"status warn",text:m}));
      aiBtn.disabled=false; selfBtn.disabled=false; inp.disabled=false; hook();
    }
  });
  return card;
}

/* exercícios novos gerados pelo Claude */
async function genMC(p, n){
  const l=p.lang;
  const existing=p.q.map(q=>q[0]).join(" / ");
  const prompt=`Crie ${n} exercícios de múltipla escolha de ${LANGNAME[l]} para um aluno brasileiro, ${levelLine(l)}.
Ponto: ${p.t} — ${p.m}. Formação: ${p.f}. Explicação: ${p.e}
Cada exercício é uma frase natural do cotidiano adulto com UMA lacuna escrita exatamente ${l==="ja"?"＿＿＿":"___"} no lugar da forma que o aluno deve escolher. Dê 4 opções curtas: a correta primeiro, depois 3 distratores plausíveis (estruturas parecidas do mesmo nível ou conjugação errada). Só uma opção pode estar certa.
Não repita estas frases: ${existing}
Responda só com um array JSON:
[{"s":"frase com a lacuna","o":["correta","errada","errada","errada"],"k":"${l==="ja"?"frase completa em hiragana, com espaços entre as palavras":""}","t":"tradução em português","w":"por que a correta está certa, 1 frase em português"}]`;
  const arr=await sampleFn.json(prompt,{cache:false});
  if(!Array.isArray(arr)) throw {code:"invalid_json"};
  return arr.filter(o=>o && typeof o.s==="string" && BLANK.test(o.s) && Array.isArray(o.o) && o.o.length===4 && o.o.every(x=>typeof x==="string"))
            .map(o=>[o.s, o.o, o.k||"", o.t||"", o.w||""]);
}

/* sequência de exercícios */
function runSeq(box, steps, onDone, opts){
  opts=opts||{};
  let i=0, ok=0, no=0; const requeued=new Set();
  const bar=h("div",{class:"progressline"},h("i"));
  const slot=h("div");
  box.append(bar, slot);
  function next(){
    bar.firstChild.style.width=(i/steps.length*100)+"%";
    slot.innerHTML="";
    if(i>=steps.length){ if(box.closest("#stage")) exBusy=false; onDone && onDone({ok,no,total:steps.length}); return; }
    const inStage=!!box.closest("#stage");
    const cur=steps[i];
    const el=cur(res=>{ if(res===true) ok++; else if(res===false) no++;
      // errou na revisão: o item volta 3 questões depois, em outro formato (reaprender enquanto a curva ainda está alta)
      if(res===false && opts.requeue && cur.item && !requeued.has(cur.item)){ requeued.add(cur.item); steps.splice(Math.min(steps.length,i+4),0,reviewStep(cur.item)); }
      i++;
      if(inStage){ exBusy=false; if(exBusyWarned){ exBusyWarned=false; shownBlock=-1; renderTimer(); return; } }
      next(); if(!opts.noScroll) box.scrollIntoView({block:"start",behavior:"smooth"}); });
    if(inStage) exBusy=true;
    slot.append(el);
  }
  next();
}
function exampleFor(p, want){ return pick(okXs(p,want)); }
function stepsForNew(p){
  const xo=exampleFor(p,true), xd=pick(p.x.filter(x=>x!==xo))||p.x[0];
  return [
    d=>exMC(p,p.q[0],d),
    d=>exFeynman(p,d),
    d=>exOrder(p,xo,d),
    d=>exMC(p,p.q[1],d),
    d=>exDictation(p,xd,d),
    d=>exProduce(p,d)
  ];
}
function okQs(p){ const qs=p.q.filter((q,i)=>!isReported(p.id+"#q"+i)); return qs.length?qs:p.q; }
function okXs(p, want){ let xs=p.x.filter((x,i)=>!isReported(p.id+"#x"+i)); if(!xs.length) xs=p.x; const w=xs.filter(x=>x.parts.length>=3); return want&&w.length?w:xs; }
/* questão de escolha: prefere frase nova gerada pelo Claude (contexto novo a cada revisão) */
function grammarMCStep(p, tag){
  return d=>{ const f=fresh[p.id]; if(f && f.length) return exMC(p,f.shift(),d,"Frase nova"); return exMC(p,pick(okQs(p)),d,tag||"Revisão"); };
}
function reviewStep(p){
  const f = p.kind ? vocabStep(p) : (d=>{
    const r=Math.random();
    if(feynmanDue(p) && r<0.2) return exFeynman(p,d,{again:true});
    if(r<0.5) return grammarMCStep(p)(d);
    if(r<0.78) return exOrder(p,pick(okXs(p,true)),d);
    return exDictation(p,pick(okXs(p)),d);
  });
  f.item=p;
  return f;
}

/* =========================================================
   Vocabulário e kanji
   ========================================================= */
const hasKanji = s => /[一-鿿]/.test(s||"");
const meaningKey = m => String(m||"").split(/[;(,]/)[0].trim().toLowerCase();
function vSay(v){ return v.say || v.r || v.w; }
function vocabItems(l){ return C[l].vocab.filter(v=>{ const it=getItem(v); return !(it && it.suspenso); }); }
function kanjiItems(l){ return (C[l].kanji||[]).filter(v=>{ const it=getItem(v); return !(it && it.suspenso); }); }
function nextNewOf(list, n){ return list.filter(v=>{ const it=getItem(v); return !it || it.estado<2; }).slice(0,n); }
function seenOf(list){ return list.filter(v=>{ const it=getItem(v); return it && it.estado>=2; }); }
function introducedToday(l, kind){ return Object.values(store.items[l]).filter(it=>it.criado===TODAY && it.estado>=2 && C[l].byId[it.id] && C[l].byId[it.id].kind===kind).length; }

/* Quantas palavras novas hoje. Regra (ver Progresso > Como o app decide):
   base 8 palavras + 2 kanji (japonês) ou 10 palavras (alemão), no máximo 20 por dia;
   metade se houver mais de 35 revisões vencidas ou se o acerto da sessão estiver abaixo de 70 %;
   zero se houver mais de 60 revisões vencidas (primeiro pôr a fila em dia). */
function newVocabPlan(l, s){
  const due=dueItems(l).length;
  let nw = l==="ja" ? 8 : 10, nk = l==="ja" ? 2 : 0, reason="";
  const tot=s ? s.stats.ok+s.stats.no : 0, acc= tot ? s.stats.ok/tot : 1;
  if(due>60){ nw=0; nk=0; reason="Há "+due+" revisões vencidas: hoje o foco é pôr a fila em dia."; }
  else if(due>35 || (tot>=8 && acc<0.7)){ nw=Math.ceil(nw/2); nk=Math.ceil(nk/2); reason= due>35 ? "Muitas revisões vencidas: metade das palavras novas hoje." : "Acerto abaixo de 70 % nesta sessão: metade das palavras novas para consolidar."; }
  const capW=Math.max(0,20-introducedToday(l,"vocab")), capK=Math.max(0,4-introducedToday(l,"kanji"));
  return {words: nextNewOf(vocabItems(l), Math.min(nw,capW)), kanji: nextNewOf(kanjiItems(l), Math.min(nk,capK)), reason, capped: capW===0};
}

/* ---------- relatório de erro no conteúdo ---------- */
function isReported(key){ return !!store.reportes[key]; }
function saveReport(p, key, motivo, text){
  const r={alvo:p.id, chave:key, idioma:p.lang, motivo, texto:String(text||"").slice(0,300), data:TODAY};
  store.reportes[key]=r;
  write("reportes", "r-"+fnv(key)+"-"+Date.now().toString(36), r);
  if(p.kind){ const it=ensureItem(p); it.suspenso=true; it.mod=Date.now(); saveItem(it); }
}
function reportBtn(p, key, card, done){
  const b=h("button",{class:"linkbtn",type:"button",title:"Reportar erro neste exercício",text:"⚑ Reportar"});
  b.addEventListener("click",()=>{
    if(card.querySelector(".report")) return;
    const box=h("div",{class:"report stack"}, h("div",{class:"small",text:"O que está errado neste exercício?"}));
    const row=h("div",{class:"row"});
    ["Frase ou palavra errada","Leitura ou áudio errado","Tradução errada","Mais de uma resposta certa","Outro"].forEach(m=>row.append(h("button",{class:"btn small",type:"button",text:m,onclick:()=>{
      const txt=(card.querySelector(".prompt")||card).textContent;
      saveReport(p,key,m,txt);
      box.replaceChildren(h("p",{class:"small",text:"Registrado. "+(p.kind?"Esta palavra":"Esta questão")+" saiu das suas revisões e fica anotada para correção."}),
        h("button",{class:"btn small primary",type:"button",text:"Pular",onclick:()=>done(null)}));
    }})));
    box.append(row, h("button",{class:"linkbtn",type:"button",text:"Cancelar",onclick:()=>box.remove()}));
    card.insertBefore(box, card.children[1]||null);
  });
  return b;
}

/* ---------- cartões ---------- */
function artChip(v){ return v.a ? h("span",{class:"art art-"+v.a,text:v.a}) : null; }
function kanjiChips(v){
  if(v.lang!=="ja") return null;
  const ks=[...new Set([...v.w].filter(ch=>C.ja.kanjiByChar[ch]))];
  if(!ks.length) return null;
  return h("div",{class:"chips small"}, ks.map(ch=>{ const k=C.ja.kanjiByChar[ch]; return h("span",{class:"kchip",lang:"ja"}, h("b",{text:ch})," "+meaningKey(k.m)); }));
}
function vocabFace(v, big){
  const l=v.lang;
  if(v.kind==="kanji") return h("div",{class:"stack",style:"gap:6px"},
    h("div",{class:"kanji-big",lang:"ja",text:v.k}),
    h("div",{class:"row small"}, h("span",{class:"chip",text:"on"}), h("span",{lang:"ja",text:v.on}), h("span",{class:"chip",text:"kun"}), h("span",{lang:"ja",text:v.kun})),
    h("div",{style:"font-size:1.1rem",text:v.m}));
  return h("div",{class:"stack",style:"gap:4px"},
    h("div",{class:"row",style:"align-items:baseline;gap:10px"}, artChip(v), h("span",{class:big?"word-big":"word",lang:l,text:v.w}), iconBtn("play","Ouvir",()=>speak(vSay(v),l,{rate:0.9}))),
    l==="ja" ? h("div",{class:"kana",lang:"ja",text:v.r}) : (v.pl && v.pl!=="—" ? h("div",{class:"small muted",lang:"de",text:v.pl}) : null),
    h("div",{style:"font-size:1.1rem",text:v.m}));
}
function exampleRows(v){
  const l=v.lang;
  if(v.kind==="kanji") return v.words.map(w=>h("div",{class:"ex"}, playBtns("ja",w[0],w[1]), h("div",{}, h("div",{class:"jp",lang:"ja",text:w[0]}), h("div",{class:"kana",lang:"ja",text:w[1]}), h("div",{class:"pt",text:w[2]}))));
  const x=v.ex;
  return [h("div",{class:"ex"}, playBtns(l,x[0],x[1]), h("div",{}, h("div",{class:"jp",lang:l,text:x[0]}), l==="ja"&&x[1]?h("div",{class:"kana",lang:"ja",text:x[1]}):null, h("div",{class:"pt",text:x[2]})))];
}
function vocabReveal(v, ok, verdict){
  return h("div",{class:"feedback "+(ok?"ok":"no")},
    h("div",{class:"verdict",text:verdict||(ok?"Certo":"A resposta era:")}),
    vocabFace(v,false), kanjiChips(v), ...exampleRows(v));
}

/* ---------- exercícios de palavra ---------- */
function distract(v, fieldFn, n, filterFn){
  const pool=(v.kind==="kanji"?kanjiItems(v.lang):vocabItems(v.lang)).filter(o=>o!==v && (!filterFn||filterFn(o)));
  const same=shuffle(pool.filter(o=>o.lvl===v.lvl)), rest=shuffle(pool.filter(o=>o.lvl!==v.lvl));
  const target=fieldFn(v), mk=meaningKey(v.m), out=[];
  for(const o of [...same,...rest]){
    const val=fieldFn(o);
    if(!val || val===target || out.includes(val) || meaningKey(o.m)===mk) continue;
    out.push(val); if(out.length>=n) break;
  }
  return out;
}
function exVChoice(v, cfg, done){
  const l=v.lang, t0=Date.now();
  const card=h("div",{class:"ex-card"});
  card.append(exHeader(v, cfg.tag, cfg.onAnswer?null:reportBtn(v, v.id, card, done)), cfg.prompt);
  const opts=[cfg.right, ...cfg.wrong].slice(0,4);
  const grid=h("div",{class:"opts"});
  shuffle(opts.map((o,i)=>i)).forEach(i=>{
    const b=h("button",{class:"opt",type:"button",lang:cfg.optLang||null,text:opts[i]});
    b.addEventListener("click",()=>{
      const ok=i===0;
      grid.querySelectorAll("button").forEach(x=>x.disabled=true);
      b.classList.add(ok?"right":"wrong");
      if(!ok) [...grid.children].find(x=>x.textContent===opts[0]).classList.add("right");
      if(cfg.onAnswer) cfg.onAnswer(ok); else record(v, cfg.kind, ok, Date.now()-t0, ok?{}:{wrong:(cfg.wrongLabel?cfg.wrongLabel(opts[i]):opts[i]), right:(cfg.rightLabel||opts[0])});
      card.append(vocabReveal(v, ok));
      speak(vSay(v), l, {rate:0.9});
      card.append(contBtn(()=>done(ok)));
    });
    b.dataset.k=grid.children.length+1; grid.append(b);
  });
  card.append(grid);
  return card;
}
const VEX = {
  meaning:(v,d)=>exVChoice(v,{tag:"O que significa?", kind:"vmc", prompt:h("div",{class:"prompt center"}, artChip(v), h("span",{class:"word-big",lang:v.lang,text:v.w})),
    right:v.m, wrong:distract(v,o=>o.m,3), rightLabel:v.t+" = "+v.m, wrongLabel:m=>v.t+" ≠ "+m},d),
  reading:(v,d)=>exVChoice(v,{tag:"Qual a leitura?", kind:"vmc", optLang:"ja", prompt:h("div",{class:"prompt center"}, h("span",{class:"word-big",lang:"ja",text:v.w})),
    right:v.r, wrong:(()=>{ const same=distract(v,o=>o.r,6,o=>Math.abs(o.r.length-v.r.length)<=1); return same.length>=3?same.slice(0,3):distract(v,o=>o.r,3); })(),
    rightLabel:v.w+" = "+v.r, wrongLabel:r=>v.w+" ≠ "+r},d),
  listen:(v,d)=>{ const el=exVChoice(v,{tag:"Ouça e escolha", kind:"vouvir", prompt:h("div",{class:"prompt center"}, h("button",{class:"btn primary",type:"button",text:"▶ Ouvir de novo",onclick:()=>speak(vSay(v),v.lang,{rate:0.85})})),
    right:v.m, wrong:distract(v,o=>o.m,3,o=>vSay(o)!==vSay(v)), rightLabel:v.t+" = "+v.m, wrongLabel:m=>"ouvi "+v.t+" e escolhi "+m},d);
    setTimeout(()=>speak(vSay(v),v.lang,{rate:0.85}),250); return el; },
  reverse:(v,d)=>exVChoice(v,{tag:"Qual palavra?", kind:"vmc", optLang:v.lang, prompt:h("div",{class:"prompt"}, h("div",{text:v.m}), h("div",{class:"small muted",text:v.ex[2]})),
    right:v.t, wrong:distract(v,o=>o.t,3), rightLabel:v.m+" = "+v.t, wrongLabel:t=>v.m+" ≠ "+t},d),
  article:(v,d)=>exVChoice(v,{tag:"Qual o artigo?", kind:"vmc", optLang:"de", prompt:h("div",{class:"prompt center"}, h("span",{class:"word-big",lang:"de",text:"___ "+v.w}), h("div",{class:"small muted",text:v.m})),
    right:v.a+" "+v.w, wrong:["der","die","das"].filter(a=>a!==v.a).map(a=>a+" "+v.w), rightLabel:v.a+" "+v.w, wrongLabel:x=>x},d),
  typed:(v,d)=>exVTyped(v,d,false),
  cloze:(v,d)=>exVTyped(v,d,true)
};
function clozeOk(v){ return v.kind==="vocab" && v.ex && v.ex[0] && v.ex[0].includes(v.w); }
function exVTyped(v, done, cloze){
  const l=v.lang, t0=Date.now();
  const card=h("div",{class:"ex-card"});
  const inp=h("input",{type:"text",id:"vt-"+v.idx,lang:l,autocomplete:"off",autocapitalize:"off",spellcheck:"false",
    placeholder: l==="ja" ? "Digite em hiragana (ou kanji)" : (v.a ? "Com artigo: der/die/das …" : "Digite a palavra")});
  const prompt = cloze
    ? h("div",{class:"prompt",lang:l}, v.ex[0].split(v.w)[0], h("span",{class:"blank",text:"？"}), v.ex[0].split(v.w).slice(1).join(v.w), h("div",{class:"small muted",style:"font-size:.9rem",text:v.ex[2]}))
    : h("div",{class:"prompt"}, h("div",{text:v.m}), h("div",{class:"small muted",style:"font-size:.9rem",text:"Ex.: "+v.ex[2]}));
  card.append(exHeader(v, cloze?"Complete a frase":"Lembre a palavra", reportBtn(v, v.id, card, done)), prompt, inp,
    h("p",{class:"small muted",text: cloze ? "Escreva a palavra que falta, na forma do exemplo." : "Tente lembrar antes de desistir: o esforço de lembrar é o que fixa."}));
  const btns=h("div",{class:"row"});
  const check=h("button",{class:"btn primary",type:"button",text:"Conferir"});
  const give=h("button",{class:"btn ghost",type:"button",text:"Não lembro"});
  btns.append(check, give); card.append(btns);
  function finish(val){
    btns.remove(); inp.disabled=true;
    let ok=false, msg=null;
    if(val){
      if(l==="ja") ok = norm("ja",val)===norm("ja",v.r) || norm("ja",val)===norm("ja",v.w);
      else {
        const target=(v.a && !cloze ? v.a+" " : "")+v.w.replace(/\s*\(sich\)/,"");
        const nv=norm("de",val).replace(/^sich /,""), nt=norm("de",target);
        ok = nv===nt || (v.w.includes("(sich)") && nv===norm("de",v.w.replace(/\s*\(sich\)/,"")));
        if(!ok && v.a && !cloze && nv.split(" ").slice(1).join(" ")===norm("de",v.w)) msg="Palavra certa, artigo errado: o artigo faz parte da palavra.";
        else if(!ok && similarity("de",val,[target])>=0.85){ ok=true; msg="Quase: confira a grafia."; }
      }
    }
    record(v,"vtyped",ok,Date.now()-t0,{grade: ok ? (msg?3:(Date.now()-t0<15000?5:4)) : (msg?2:1), wrong: ok?null:(val||"(não lembrou)"), right:v.t});
    card.append(vocabReveal(v, ok, ok?(msg?"Quase":"Certo"):(msg||"A palavra é:")));
    speak(vSay(v), l, {rate:0.9});
    card.append(contBtn(()=>done(ok)));
  }
  check.addEventListener("click",()=>{ if(!inp.value.trim()){ inp.focus(); return; } finish(inp.value.trim()); });
  inp.addEventListener("keydown",e=>{ if(e.isComposing || e.keyCode===229) return; if(e.key==="Enter" && inp.value.trim()){ e.preventDefault(); check.click(); } });
  give.addEventListener("click",()=>finish(""));
  setTimeout(()=>{ try{ inp.focus({preventScroll:true}); }catch(e){} },50);
  return card;
}
const KEX = {
  meaning:(k,d)=>exVChoice(k,{tag:"Kanji: significado", kind:"kmc", prompt:h("div",{class:"prompt center"}, h("span",{class:"kanji-big",lang:"ja",text:k.k})),
    right:k.m, wrong:distract(k,o=>o.m,3), rightLabel:k.k+" = "+k.m, wrongLabel:m=>k.k+" ≠ "+m},d),
  word:(k,d)=>{ const w=pick(k.words); return exVChoice(k,{tag:"Kanji: leitura da palavra", kind:"kmc", optLang:"ja", prompt:h("div",{class:"prompt center"}, h("span",{class:"word-big",lang:"ja",text:w[0]}), h("div",{class:"small muted",text:w[2]})),
    right:w[1], wrong:distract(k,o=>pick(o.words)[1],3), rightLabel:w[0]+" = "+w[1], wrongLabel:r=>w[0]+" ≠ "+r},d); },
  which:(k,d)=>exVChoice(k,{tag:"Kanji: qual é?", kind:"kmc", optLang:"ja", prompt:h("div",{class:"prompt"}, h("div",{text:k.m}), h("div",{class:"small muted",text:"on: "+k.on+" · kun: "+k.kun})),
    right:k.k, wrong:distract(k,o=>o.k,3), rightLabel:k.m+" = "+k.k, wrongLabel:x=>k.m+" ≠ "+x},d)
};
/* O formato fica mais exigente conforme o domínio: reconhecer → ouvir → lembrar sozinho
   (lembrar sem pistas fixa mais que reconhecer; Karpicke e Roediger, 2008). */
function vocabStep(v){
  return d=>{
    if(v.kind==="kanji") return KEX[pick(["meaning","word","word","which"])](v,d);
    const it=getItem(v), e=it?it.estado:2, ja=v.lang==="ja", noun=!!v.a;
    let opts;
    const rd = ja && hasKanji(v.w) && v.r && v.r!==v.w;
    if(e<=2) opts=["meaning", ...(rd?["reading"]:[]), "listen"];
    else if(e===3) opts=["listen","reverse", ...(rd?["reading"]:[]), ...(noun?["article"]:[])];
    else if(e===4) opts=["typed","listen", ...(noun?["article"]:[]), ...(clozeOk(v)?["cloze"]:[])];
    else opts=["typed", ...(clozeOk(v)?["cloze","cloze"]:[]), "reverse"];
    return VEX[pick(opts)](v,d);
  };
}

/* estudar → testar logo em seguida (duas rodadas intercaladas) */
function studyCards(box, list, onDone){
  let i=0;
  const slot=h("div");
  box.append(slot);
  function show(){
    slot.innerHTML="";
    const v=list[i];
    const card=h("div",{class:"card stack"},
      h("div",{class:"row"}, h("span",{class:"eyebrow",text:(v.kind==="kanji"?"Kanji novo ":"Palavra nova ")+(i+1)+" de "+list.length}), h("span",{class:"spacer"}), h("span",{class:"chip",text:v.lvl})),
      vocabFace(v,true), kanjiChips(v), ...exampleRows(v),
      h("p",{class:"small muted",text:"Leia, ouça e repita em voz alta. Em seguida vem um teste rápido."}),
      h("div",{class:"row"},
        i>0 ? h("button",{class:"btn",type:"button",text:"← Anterior",onclick:()=>{ i--; show(); }}) : null,
        h("button",{class:"btn primary",type:"button",text: i<list.length-1 ? "Próxima" : "Testar agora",onclick:()=>{ introduce(v); if(i<list.length-1){ i++; show(); } else { slot.remove(); onDone(); } }})));
    slot.append(card);
    speak(vSay(v), v.lang, {rate:0.85});
  }
  show();
}
function learnVocab(box, list, onDone){
  if(!list.length){ onDone && onDone({ok:0,no:0,total:0}); return; }
  if(S) S.newWords=(S.newWords||[]).concat(list);
  studyCards(box, list, ()=>{
    const r1=shuffle(list).map(v=>d=> v.kind==="kanji" ? KEX.meaning(v,d) : VEX.meaning(v,d));
    const r2=shuffle(list).map(v=>d=> v.kind==="kanji" ? KEX.word(v,d) : (v.lang==="ja"&&hasKanji(v.w)&&v.r&&v.r!==v.w ? VEX.reading(v,d) : (v.a ? VEX.article(v,d) : VEX.listen(v,d))));
    runSeq(box, [...r1, ...r2], onDone);
  });
}

/* ---------- palavras geradas pelo Claude ---------- */
function addExtraVocab(docs){
  docs.forEach(d=>{
    const l=d.lang; if(!C[l] || C[l].byId[d.id]) return;
    if(d.tipo==="kanji"){
      if(l!=="ja" || !d.k || C.ja.kanjiByChar[d.k] || !Array.isArray(d.words) || !d.words.length) return;
      const k={kind:"kanji",lang:"ja",lvl:d.lvl||"N2",k:d.k,on:d.on||"—",kun:d.kun||"—",m:d.m,words:d.words,gen:true};
      k.t=k.k; k.say=k.words[0][1]; k.w=k.k; k.r=k.words[0][1]; k.ex=[k.words[0][0],k.words[0][1],k.words[0][2]];
      k.id=d.id; k.idx=C.ja.kanji.length; C.ja.kanji.push(k); C.ja.byId[k.id]=k; C.ja.kanjiByChar[k.k]=k;
      return;
    }
    const v = l==="ja" ? {kind:"vocab",lang:"ja",lvl:d.lvl||"N2",w:d.w,r:d.r,m:d.m,ex:[d.ex||"",d.exr||"",d.ext||""],gen:true}
                       : {kind:"vocab",lang:"de",lvl:d.lvl||"B1",a:d.a||"",w:d.w,pl:d.pl||"",m:d.m,ex:[d.ex||"","",d.ext||""],gen:true};
    finishVocab(v, l); v.id=d.id; v.idx=C[l].vocab.length;
    C[l].vocab.push(v); C[l].byId[v.id]=v;
  });
}
let genMsg={};  // última mensagem de geração por trilha (sobrevive ao redesenho da lista)
function setGen(el, seg, cls, text){ genMsg[state.lang+"-"+seg]={cls,text}; const cur=document.querySelector("#genStatus")||el; cur.className="status "+cls; cur.textContent=text; }
/* kanji novos (N2) sugeridos pelo professor; cada um com leituras e duas palavras frequentes */
async function genKanji(statusEl){
  const known=C.ja.kanji.map(k=>k.k).join("");
  setGen(statusEl,"kanji","","O professor está escolhendo 10 kanji novos… (10 a 60 segundos)");
  const prompt=`Liste 10 kanji do nível JLPT N2 (ou N3 que falte) muito frequentes em notícias e trabalho, que NÃO estejam nesta lista: ${known}
Para cada um: leituras on (katakana) e kun (hiragana, com a parte em okurigana entre parênteses, ou "—"), significado curto em português e 2 palavras frequentes que usam o kanji.
Responda só com um array JSON: [{"k":"字","on":"ジ","kun":"あざ","m":"letra; caractere","words":[["文字","もじ","letra"],["漢字","かんじ","kanji"]]}]`;
  try{
    const arr=await sampleFn.json(prompt,{cache:false});
    if(!Array.isArray(arr)) throw {code:"invalid_json"};
    const docs=[];
    arr.forEach(o=>{
      if(!o || typeof o.k!=="string" || [...o.k].length!==1 || !/[一-鿿]/.test(o.k) || C.ja.kanjiByChar[o.k] || typeof o.m!=="string") return;
      const words=(Array.isArray(o.words)?o.words:[]).filter(w=>Array.isArray(w) && w.length>=3 && String(w[0]).includes(o.k) && /^[぀-ゟー]+$/.test(String(w[1]).replace(/\s/g,""))).map(w=>[String(w[0]),String(w[1]).replace(/\s/g,""),String(w[2])]).slice(0,2);
      if(!words.length || docs.find(d=>d.k===o.k)) return;
      docs.push({tipo:"kanji", lang:"ja", lvl:"N2", k:o.k, on:String(o.on||"—"), kun:String(o.kun||"—"), m:o.m, words, criado:TODAY, id:"kx-"+o.k});
    });
    docs.forEach(d=>{ store.vocabExtra[d.id]=d; write("vocabExtra", d.id, d); });
    addExtraVocab(docs);
    setGen(statusEl,"kanji","ok",docs.length+" kanji novos entraram no fim da sua fila (marcados como gerados; use ⚑ Reportar se algum estiver errado).");
    changed();
  }catch(e){ setGen(statusEl,"kanji","warn",aiError(e)||""); }
}
async function genVocab(l, statusEl){
  const lvl = courseLevel(l)==="N3" ? "N2" : courseLevel(l)==="A2" ? "B1" : (l==="ja" ? "N2" : "B2");
  const known = C[l].vocab.map(v=>v.w).join(l==="ja"?"、":", ");
  setGen(statusEl,"vocab","","O professor está escolhendo 20 palavras novas… (10 a 60 segundos)");
  const prompt = l==="ja"
    ? `Liste 20 palavras frequentes e úteis do nível JLPT ${lvl} para um adulto brasileiro, que NÃO estejam nesta lista: ${known}
Prefira palavras de notícias, trabalho e vida adulta. Significado curto em português. Exemplo = colocação curta e natural.
Responda só com um array JSON: [{"w":"palavra em kanji/kana","r":"leitura em hiragana","m":"significado em português","ex":"exemplo curto","exr":"leitura do exemplo em hiragana com espaços","ext":"tradução do exemplo"}]`
    : `Liste 20 palavras frequentes e úteis do nível ${lvl} (CEFR) de alemão para um adulto brasileiro, que NÃO estejam nesta lista: ${known}
Misture substantivos, verbos e adjetivos. Significado curto em português.
Responda só com um array JSON: [{"a":"der, die, das ou vazio se não for substantivo","w":"palavra (verbo no infinitivo; reflexivo como 'verb (sich)')","pl":"plural com artigo (substantivo) ou Perfekt como 'hat gemacht' (verbo) ou vazio","m":"significado em português","ex":"frase curta de exemplo","ext":"tradução do exemplo"}]`;
  try{
    const arr=await sampleFn.json(prompt,{cache:false});
    if(!Array.isArray(arr)) throw {code:"invalid_json"};
    const have=new Set(C[l].vocab.map(v=>v.w));
    const docs=[];
    arr.forEach(o=>{
      if(!o || typeof o.w!=="string" || typeof o.m!=="string" || !o.w.trim() || have.has(o.w.trim())) return;
      if(l==="ja" && (typeof o.r!=="string" || !/^[぀-ゟー]+$/.test(o.r.replace(/\s/g,"")))) return;
      if(l==="de" && o.a && !["der","die","das"].includes(o.a)) return;
      const w=o.w.trim(); have.add(w);
      const d = l==="ja" ? {lang:l,lvl,w,r:o.r.replace(/\s/g,""),m:o.m,ex:o.ex||"",exr:o.exr||"",ext:o.ext||"",criado:TODAY}
                         : {lang:l,lvl,a:o.a||"",w,pl:o.pl||"",m:o.m,ex:o.ex||"",ext:o.ext||"",criado:TODAY};
      d.id="vx-"+l+"-"+(l==="ja"?w:slug(w)+"-"+(d.a||"x"));
      docs.push(d);
    });
    docs.forEach(d=>{ store.vocabExtra[d.id]=d; write("vocabExtra", d.id, d); });
    addExtraVocab(docs);
    setGen(statusEl,"vocab","ok",docs.length+" palavras novas entraram no fim da sua fila (marcadas como geradas; use ⚑ Reportar se alguma estiver errada).");
    changed();
  }catch(e){ setGen(statusEl,"vocab","warn",aiError(e)||""); }
}

/* ---------- revisão: frases novas geradas pelo Claude ---------- */
const fresh={}; let freshLoading=false;
async function loadFresh(points){
  if(!aiReady() || freshLoading) return;
  const need=points.filter(p=>!p.kind && !(fresh[p.id]&&fresh[p.id].length)).slice(0,6);
  if(!need.length) return;
  freshLoading=true;
  const l=need[0].lang;
  const prompt=`Crie exercícios de múltipla escolha de ${LANGNAME[l]} para um aluno brasileiro, ${levelLine(l)}. Para CADA ponto abaixo, 2 frases NOVAS e naturais (cotidiano adulto, trabalho, notícias), cada uma com UMA lacuna escrita exatamente ${l==="ja"?"＿＿＿":"___"} onde entra a forma do ponto. 4 opções curtas, a correta primeiro, só uma correta.
Pontos:
${need.map(p=>`- id ${p.id}: ${p.t} — ${p.m}. Formação: ${p.f}`).join("\n")}
Responda só com JSON: {"<id>":[{"s":"frase com lacuna","o":["correta","errada","errada","errada"],"k":"${l==="ja"?"frase completa em hiragana com espaços":""}","t":"tradução","w":"por que a correta está certa, 1 frase"}]}`;
  try{
    const r=await sampleFn.json(prompt,{cache:false});
    if(r && typeof r==="object") for(const id in r){
      const p=C[l].byId[id]; if(!p || !Array.isArray(r[id])) continue;
      const qs=r[id].filter(o=>o && typeof o.s==="string" && BLANK.test(o.s) && Array.isArray(o.o) && o.o.length===4 && o.o.every(x=>typeof x==="string") && !isReported("gen:"+o.s))
        .map(o=>[o.s,o.o,o.k||"",o.t||"",o.w||""]);
      fresh[id]=(fresh[id]||[]).concat(qs);
    }
  }catch(e){ aiError(e); }
  freshLoading=false;
}

/* ---------- sequência de intervenção para erro recorrente ---------- */
function interventionFor(l){
  const since=addDays(TODAY,-14), count={}, last={};
  Object.values(store.erros).forEach(e=>{
    if(e.idioma!==l || e.corrigido || !e.ultima || e.ultima<since) return;
    const p=C[l].byId[e.conteudo]; if(!p || p.kind) return;
    count[p.id]=(count[p.id]||0)+(e.ocorrencias||1);
    if(!last[p.id] || e.ultima>last[p.id].ultima) last[p.id]=e;
  });
  const cand=Object.keys(count).filter(id=>count[id]>=3).map(id=>C[l].byId[id])
    .filter(p=>{ const it=getItem(p); return !it || !it.intervencao || diffDays(it.intervencao,TODAY)>=7; })
    .sort((a,b)=>count[b.id]-count[a.id]);
  return cand.length ? {p:cand[0], e:last[cand[0].id], n:count[cand[0].id]} : null;
}
function contrastCard(iv, done){
  const p=iv.p, l=p.lang, x=p.x[0];
  return h("div",{class:"ex-card"},
    h("div",{class:"ex-meta"}, h("span",{class:"chip s4",text:"Erro recorrente"}), h("span",{text:p.t})),
    h("p",{text:"Você errou este ponto "+iv.n+" vezes nas últimas 2 semanas. Vamos atacar direto: contraste, reconhecimento, montagem e uma frase sua."}),
    h("div",{class:"feedback no"}, h("div",{class:"small",text:"Você escreveu"}), h("div",{class:"wrong",lang:l,text:iv.e.erro})),
    h("div",{class:"feedback ok"}, h("div",{class:"small",text:"Forma certa"}), h("div",{class:"row",style:"flex-wrap:nowrap"}, h("div",{lang:l,style:"flex:1;font-size:1.1rem;font-weight:500",text:iv.e.correta}), playBtns(l,iv.e.correta,""))),
    h("div",{class:"formula"}, h("span",{class:"eyebrow",text:"Regra "}), h("br"), h("span",{lang:l,text:p.f})),
    h("p",{class:"tip small",text:p.c}),
    feedbackBox(true,l,x[0],x[1],x[2],null,"Exemplo"),
    h("button",{class:"btn primary wide",type:"button",text:"Entendi",onclick:()=>{ const it=ensureItem(p); it.intervencao=TODAY; it.mod=Date.now(); saveItem(it); done(null); }}));
}
function interventionSteps(iv){
  const p=iv.p;
  return [d=>contrastCard(iv,d), d=>exFeynman(p,d,{erro:iv.e}), grammarMCStep(p,"Reconheça a forma"), grammarMCStep(p,"Reconheça a forma"), d=>exOrder(p,exampleFor(p,true),d), d=>exProduce(p,d)];
}

/* ---------- fila de revisão intercalada ---------- */
/* Misturar tipos na mesma sessão (intercalar) ajuda a distinguir o que é parecido
   (Kornell e Bjork, 2008). */
function reviewQueue(l, maxG, maxV){
  const due=dueItems(l).map(it=>C[l].byId[it.id]).filter(Boolean);
  const g=due.filter(p=>!p.kind).slice(0,maxG), v=due.filter(p=>p.kind).slice(0,maxV);
  const out=[]; let gi=0;
  v.forEach((x,i)=>{ out.push(x); if(i%3===2 && gi<g.length) out.push(g[gi++]); });
  while(gi<g.length) out.push(g[gi++]);
  return out;
}

/* =========================================================
   Repetição espaçada: FSRS-6 (Free Spaced Repetition Scheduler)
   Cada item tem estabilidade S (dias até a chance de lembrar cair a 90 %) e
   dificuldade D (1–10). A lembrança cai numa curva de potência:
     R(t) = (1 + F·t/S)^(−w20),  com F = 0,9^(−1/w20) − 1.
   O item volta quando R chega à retenção desejada (padrão 90 %).
   Parâmetros padrão do py-fsrs (open-spaced-repetition), sem otimização individual.
   ========================================================= */
const W=[0.212,1.2931,2.3065,8.2956,6.4133,0.8334,3.0194,0.001,1.8722,0.1666,0.796,1.4835,0.0614,0.2629,1.6483,0.6014,1.8729,0.5425,0.0912,0.0658,0.1542];
const DECAY=-W[20], FACTOR=Math.pow(0.9,1/DECAY)-1, MAX_IVL=730;
const R_TARGET=0.9;
const clampD = d => Math.min(10, Math.max(1, d));
const clampS = x => Math.max(0.01, Math.min(36500, x));
function fsrsR(t, S){ return Math.pow(1 + FACTOR*t/S, DECAY); }
function fsrsD0(r){ return W[4] - Math.exp(W[5]*(r-1)) + 1; }
function fsrsNextD(D, r){ const d0easy=fsrsD0(4); const damp=D + (10-D)*(-W[6]*(r-3))/9; return clampD(W[7]*d0easy + (1-W[7])*damp); }
function fsrsRecall(S, D, R, r){ return S*(1 + Math.exp(W[8])*(11-D)*Math.pow(S,-W[9])*(Math.exp((1-R)*W[10])-1)*(r===2?W[15]:1)*(r===4?W[16]:1)); }
function fsrsForget(S, D, R){ return Math.min(W[11]*Math.pow(D,-W[12])*(Math.pow(S+1,W[13])-1)*Math.exp((1-R)*W[14]), S/Math.exp(W[17]*W[18])); }
function fsrsShort(S, r){ let inc=Math.exp(W[17]*(r-3+W[18]))*Math.pow(S,-W[19]); if(r>=3) inc=Math.max(inc,1); return S*inc; }
function desiredR(){ const r=Number(settings.retencao); return r>=0.8 && r<=0.97 ? r : R_TARGET; }
function fsrsInterval(S){ const r=desiredR(); return Math.min(MAX_IVL, Math.max(1, Math.round(S/FACTOR*(Math.pow(r,1/DECAY)-1)))); }
function retentionOf(it, day){
  if(!it || !it.S || !it.ultRev) return null;
  const t=Math.max(0, diffDays(it.ultRev, day||TODAY));
  return fsrsR(t, it.S);
}
/* itens salvos pelo agendador antigo ganham dificuldade e continuam da estabilidade que tinham */
function migrateItem(it){
  if(!it) return it;
  if(!it.S && it.estado>=2 && (it.reps>0 || it.srsDia)){
    it.S=Math.max(1, it.intervalo||1);
    it.ultRev = it.ultima || (it.vence ? addDays(it.vence, -(it.intervalo||1)) : TODAY);
  }
  if(it.S && !it.D){ it.D = clampD(5 + Math.min(3,(it.lapsos||0)) - ((it.acertos||0)>=6 ? 1 : 0)); }
  return it;
}
/* nota automática → 1 Errei, 2 Difícil, 3 Bom, 4 Fácil */
function ratingOf(kind, ok, grade){
  if(!ok) return 1;
  if(grade<=3) return 2;
  if(grade>=5 && ["vtyped","ditado","producao","order","feynman"].includes(kind)) return 4;
  return 3;
}
function schedule(it, rating){
  migrateItem(it);
  const r=Math.min(4,Math.max(1,rating|0));
  if(!it.S || !it.ultRev){                       // primeira revisão
    it.S=clampS(W[r-1]); it.D=clampD(fsrsD0(r));
  } else {
    const t=Math.max(0, diffDays(it.ultRev, TODAY));
    if(t<1) it.S=clampS(fsrsShort(it.S, r));
    else {
      const R=fsrsR(t, it.S);
      it.S=clampS(r===1 ? fsrsForget(it.S, it.D, R) : fsrsRecall(it.S, it.D, R, r));
    }
    it.D=fsrsNextD(it.D, r);
  }
  if(r===1){ it.lapsos=(it.lapsos||0)+1; it.reps=0; } else it.reps=(it.reps||0)+1;
  it.S=Math.round(it.S*100)/100; it.D=Math.round(it.D*100)/100;
  it.ultRev=TODAY;
  it.intervalo=fsrsInterval(it.S);
  it.vence=addDays(TODAY, it.intervalo);
  it.fsrs=6;
}
/* média prevista de retenção dos itens vistos, daqui a d dias sem estudar */
function forgettingSeries(l, days){
  const its=Object.values(store.items[l]).filter(it=>it.estado>=2 && !it.suspenso && C[l].byId[it.id]).map(it=>migrateItem(Object.assign({},it)));
  const out=[];
  for(let d=0; d<=days; d++){
    const day=addDays(TODAY,d);
    const rs=its.map(it=>retentionOf(it,day)).filter(r=>r!=null);
    out.push(rs.length ? rs.reduce((a,b)=>a+b,0)/rs.length : null);
  }
  return {mine:out, n:its.length, below: its.filter(it=>(retentionOf(it)??1)<R_TARGET+1e-9 && it.vence<=TODAY).length};
}
function forgettingChart(l){
  const days=30, CW=340, H=190, P={l:36,r:12,t:12,b:28};
  const {mine,n,below}=forgettingSeries(l,days);
  const novo=[...Array(days+1)].map((_,d)=>fsrsR(d, W[2]));
  const x=d=>P.l+(CW-P.l-P.r)*d/days, y=r=>P.t+(H-P.t-P.b)*(1-r);
  const path=arr=>arr.map((r,d)=>r==null?"":(d&&arr[d-1]!=null?"L":"M")+x(d).toFixed(1)+" "+y(r).toFixed(1)).join(" ");
  const ns="http://www.w3.org/2000/svg";
  const svg=document.createElementNS(ns,"svg");
  svg.setAttribute("viewBox",`0 0 ${CW} ${H}`); svg.setAttribute("class","fchart"); svg.setAttribute("role","img");
  svg.setAttribute("aria-label","Retenção prevista nos próximos 30 dias sem estudar");
  let g="";
  [0,0.25,0.5,0.75,1].forEach(r=>{ g+=`<line x1="${P.l}" x2="${CW-P.r}" y1="${y(r)}" y2="${y(r)}" class="grid"/><text x="${P.l-6}" y="${y(r)+4}" class="tick" text-anchor="end">${Math.round(r*100)}%</text>`; });
  [0,7,14,21,30].forEach(d=>{ g+=`<text x="${x(d)}" y="${H-8}" class="tick" text-anchor="middle">${d===0?"hoje":d+"d"}</text>`; });
  g+=`<line x1="${P.l}" x2="${CW-P.r}" y1="${y(desiredR())}" y2="${y(desiredR())}" class="target"/><text x="${CW-P.r}" y="${y(desiredR())-4}" class="tick" text-anchor="end">${Math.round(desiredR()*100)} %: dia de revisar</text>`;
  g+=`<path d="${path(novo)}" class="ref"/>`;
  if(n) g+=`<path d="${path(mine)}" class="mine"/><circle cx="${x(0)}" cy="${y(mine[0])}" r="4" class="mine-dot"/>`;
  g+=`<line class="cross" x1="0" x2="0" y1="${P.t}" y2="${H-P.b}" visibility="hidden"/><rect class="hit" x="${P.l}" y="${P.t}" width="${CW-P.l-P.r}" height="${H-P.t-P.b}" fill="transparent"/>`;
  svg.innerHTML=g;
  const tip=h("div",{class:"ftip",hidden:true});
  const wrap=h("div",{class:"fwrap"}, svg, tip);
  const hit=svg.querySelector(".hit"), cross=svg.querySelector(".cross");
  function move(ev){
    const r=svg.getBoundingClientRect(); const px=(ev.clientX-r.left)*CW/r.width;
    const d=Math.max(0,Math.min(days,Math.round((px-P.l)/(CW-P.l-P.r)*days)));
    cross.setAttribute("x1",x(d)); cross.setAttribute("x2",x(d)); cross.setAttribute("visibility","visible");
    tip.hidden=false; tip.style.left=Math.min(r.width-150, Math.max(0,(x(d)/CW)*r.width-60))+"px";
    tip.textContent=(d===0?"Hoje":"Em "+d+" dia"+(d>1?"s":""))+": "+(n&&mine[d]!=null?"seus itens "+Math.round(mine[d]*100)+"% · ":"")+"item novo sem revisão "+Math.round(novo[d]*100)+"%";
  }
  hit.addEventListener("pointermove",move); hit.addEventListener("pointerdown",move);
  hit.addEventListener("pointerleave",()=>{ tip.hidden=true; cross.setAttribute("visibility","hidden"); });
  const legend=h("div",{class:"row small",style:"gap:14px"},
    h("span",{}, h("span",{class:"lg lg-mine"}), " seus itens (média)"),
    h("span",{}, h("span",{class:"lg lg-ref"}), " item novo sem revisão"));
  const lead = n ? "Hoje você lembraria em média "+Math.round((mine[0]||0)*100)+"% dos "+n+" itens já estudados. "+(below?below+" chegaram ao ponto de revisão: são as revisões de hoje.":"Nenhum no ponto de revisão agora.")
                 : "Estude alguns itens para ver a sua curva.";
  return h("div",{class:"stack"}, h("p",{class:"small",text:lead}), wrap, legend,
    h("p",{class:"small muted",text:"Sem revisão, a lembrança cai rápido nos primeiros dias. Cada revisão feita no ponto certo deixa a curva mais achatada (a estabilidade cresce) e o intervalo seguinte fica maior."}));
}

/* =========================================================
   Método Feynman: explicar com as próprias palavras
   ========================================================= */
function feynmanDue(p){
  const it=getItem(p); if(!it || it.estado<4) return false;
  const last=it.feynman && it.feynman.data;
  return !last || diffDays(last,TODAY)>=14;
}
function exFeynman(p, done, o){
  o=o||{};
  const l=p.lang, t0=Date.now(), it=getItem(p);
  const card=h("div",{class:"ex-card"});
  const inp=h("textarea",{id:"fey-"+p.id,rows:"3",placeholder:"Em português. Ex.: \"Uso quando… Formo com… Não confundir com… porque…\""});
  const exIn=h("input",{type:"text",id:"feyx-"+p.id,lang:l,autocomplete:"off",spellcheck:"false",placeholder: l==="ja" ? "例：来月から大阪で働くことになりました。" : "Beispiel: Ich habe gestern…"});
  const textOf=()=>{ const a=inp.value.trim(), b=exIn.value.trim(); return (a?"Explicação: "+a:"")+(a&&b?"\n":"")+(b?"Exemplo: "+b:""); };
  const enough=()=> inp.value.trim().length>=12 && exIn.value.trim().length>=3;
  const need=h("p",{class:"small status warn",hidden:true,text:"Escreva as duas partes: a regra em português e uma frase sua no idioma."});
  const checks=[["quando","Quando usar (em que situação)"],["forma","Como formar (o que vem antes)"],["exemplo","Um exemplo meu, diferente dos da aula"],["contraste","A diferença para a estrutura parecida"]];
  card.append(exHeader(p, o.erro ? "Explique o erro" : "Explique como professor"),
    h("p",{text: o.erro
      ? "Sem olhar a regra: explique para um amigo por que \""+o.erro.erro+"\" está errado e como fica certo."
      : (o.again ? "Sem olhar a aula: explique de novo " : "Explique ")+"「"+p.t+"」 para um amigo que nunca estudou "+LANGNAME[l]+"."}),
    h("label",{class:"small",for:"fey-"+p.id}, h("b",{text:"1. A regra, com suas palavras (em português)"}), h("span",{class:"muted",text:" · quando usar, como formar e com o que não confundir"})),
    inp,
    h("label",{class:"small",for:"feyx-"+p.id}, h("b",{text:"2. Uma frase sua em "+LANGNAME[l]}), h("span",{class:"muted",text:" · sobre a sua vida, diferente dos exemplos da aula"})),
    exIn, need,
    h("p",{class:"small muted",text:"Onde você travar é exatamente o que falta aprender. Frases simples; sem olhar a aula."}));
  const out=h("div",{class:"stack"});
  const btns=h("div",{class:"row"});
  const aiBtn=h("button",{class:"btn primary",type:"button",text:"Avaliar com o professor"});
  const selfBtn=h("button",{class:"btn",type:"button",text:"Conferir sozinho"});
  btns.append(aiBtn, selfBtn, h("button",{class:"btn ghost",type:"button",text:"Pular",onclick:()=>done(null)}));
  card.append(btns, out);
  const hook=()=>{ aiBtn.hidden=!aiReady(); }; aiHooks.push(hook); hook();
  function save(txt, nota){
    const itx=ensureItem(p);
    itx.feynman={texto:txt.slice(0,1200), nota, data:TODAY};
    itx.mod=Date.now(); saveItem(itx);
  }
  function finish(ok, txt, nota){
    save(txt, nota);
    record(p,"feynman",ok,Date.now()-t0,{grade: ok ? (nota>=4?5:4) : 2});
    if(it && it.feynman && it.feynman.texto && !o.erro) out.append(h("details",{}, h("summary",{class:"small",text:"Sua explicação anterior ("+brDate(it.feynman.data)+")"}), h("p",{class:"small",text:it.feynman.texto})));
    out.append(contBtn(()=>done(ok)));
  }
  const ready=()=>{ if(enough()){ need.hidden=true; return true; } need.hidden=false; (inp.value.trim().length<12?inp:exIn).focus(); return false; };
  selfBtn.addEventListener("click",()=>{
    if(!ready()) return; const txt=textOf();
    btns.remove(); inp.disabled=true; exIn.disabled=true;
    const boxes=checks.map(c=>h("input",{type:"checkbox",id:"fc-"+c[0]+"-"+p.id}));
    out.append(h("div",{class:"feedback ok"},
      h("div",{class:"verdict",text:"Compare com a aula"}),
      h("div",{class:"formula"}, h("span",{class:"eyebrow",text:"Formação "}), h("br"), h("span",{lang:l,text:p.f})),
      h("p",{class:"small",text:p.e}), h("p",{class:"small tip",text:p.c})),
      h("p",{class:"small",text:"Marque o que a sua explicação cobriu corretamente:"}),
      h("div",{class:"stack",style:"gap:4px"}, checks.map((c,i)=>h("label",{class:"row small",style:"gap:8px"}, boxes[i], c[1]))),
      h("button",{class:"btn primary",type:"button",text:"Pronto",onclick:e=>{ e.currentTarget.remove(); const n=boxes.filter(b=>b.checked).length; out.append(h("p",{class:"small",text: n>=3 ? "Boa: explicação completa." : "Faltaram "+(4-n)+" partes. Releia a aula e tente de novo amanhã: é aí que a revisão vai focar."})); finish(n>=3, txt, n); }}));
  });
  aiBtn.addEventListener("click", async ()=>{
    if(!ready()) return; const txt=textOf();
    aiBtn.disabled=true; selfBtn.disabled=true; inp.disabled=true; exIn.disabled=true;
    const w=h("p",{class:"small muted",text:"O professor está lendo a sua explicação…"}); out.append(w);
    const prompt=`Você avalia a explicação de um aluno brasileiro (${levelLine(l)}) usando o método Feynman: ele deve explicar o ponto como se ensinasse alguém leigo.
Ponto: ${p.t} — ${p.m}. Formação correta: ${p.f}. Regra: ${p.e} Contraste: ${p.c}
${o.erro?`O aluno errou antes: escreveu "${o.erro.erro}" em vez de "${o.erro.correta}". Ele deve explicar por que está errado.`:""}
Resposta do aluno (explicação em português + uma frase de exemplo em ${LANGNAME[l]}):
"""${txt}"""
Critérios: quando usar, como formar, exemplo próprio correto, diferença para estrutura parecida. Aponte erros de conceito com precisão; não elogie à toa. Se o exemplo tiver erro de digitação (ex.: kana de meia largura, letra a mais), corrija em correcaoExemplo sem descontar nota por isso.
Responda só com JSON: {"nota":0-4,"claro":"o que ficou certo, 1 frase","lacunas":["lacuna ou erro, 1 frase cada"],"exemploOk":true,"correcaoExemplo":"exemplo corrigido se houver erro, senão vazio","pergunta":"1 pergunta curta que testa o ponto mais fraco","simples":"a explicação ideal em 2 ou 3 frases simples em português"}`;
    try{
      const r=await sampleFn.json(prompt,{cache:false}); w.remove();
      if(!r || typeof r.nota!=="number") throw {code:"invalid_json"};
      btns.remove();
      const ok=r.nota>=3;
      out.append(h("div",{class:"feedback "+(ok?"ok":"no")},
        h("div",{class:"verdict",text:"Nota "+r.nota+" de 4"}),
        r.claro ? h("p",{class:"small",text:"✔ "+r.claro}) : null,
        (r.lacunas||[]).length ? h("ul",{class:"small",style:"margin:0;padding-left:18px"}, r.lacunas.map(x=>h("li",{text:x}))) : null,
        r.correcaoExemplo ? h("p",{class:"small"}, "Exemplo corrigido: ", h("b",{lang:l,text:r.correcaoExemplo})) : null,
        r.simples ? h("div",{class:"small tip",text:"Versão simples: "+r.simples}) : null));
      if(r.pergunta){
        const a=h("textarea",{id:"feyq-"+p.id,rows:"2",placeholder:"Responda aqui (opcional)"});
        const ans=h("div",{class:"answer",hidden:true});
        const send=h("button",{class:"btn small",type:"button",text:"Responder"});
        send.addEventListener("click", async ()=>{
          if(!a.value.trim()) return; send.disabled=true; ans.hidden=false; ans.textContent="Pensando…";
          try{ await sampleFn(`Ponto: ${p.t} — ${p.m} (${p.f}). Pergunta feita ao aluno: ${r.pergunta}\nResposta do aluno: ${a.value.trim()}\nEm português, em até 3 frases: diga se está certo e corrija o que faltar.`,{cache:false,onText:({text})=>{ ans.textContent=text; }}); }
          catch(e){ ans.textContent=aiError(e)||""; }
        });
        out.append(h("div",{class:"stack"}, h("p",{class:"small"}, h("b",{text:"Pergunta do professor: "}), r.pergunta), a, h("div",{class:"row"},send), ans));
      }
      finish(ok, txt, r.nota);
    }catch(e){ w.remove(); const m=aiError(e); if(m) out.append(h("p",{class:"status warn",text:m})); aiBtn.disabled=false; selfBtn.disabled=false; inp.disabled=false; exIn.disabled=false; hook(); }
  });
  return card;
}

/* =========================================================
   Conversa com o professor (situações)
   ========================================================= */
const SCENES={
  ja:[["konbini","Na loja de conveniência (コンビニ)","Você é o atendente de uma コンビニ no Japão."],
      ["hospital","Recepção do hospital (病院の受付)","Você é a recepcionista de uma clínica; o aluno é um paciente novo."],
      ["joushi","Com o chefe (上司と) · keigo","Você é o 部長 do aluno; a conversa exige 敬語 do aluno."],
      ["douryou","Papo com colega (同僚と雑談)","Você é um colega de trabalho simpático, conversa informal (タメ口 permitido)."],
      ["mensetsu","Entrevista de emprego (面接)","Você é o entrevistador de uma empresa japonesa."],
      ["denwa","Reserva por telefone (電話で予約)","Você atende o telefone de um restaurante."],
      ["fudousan","Imobiliária (不動産屋)","Você é o corretor de uma imobiliária; o aluno procura apartamento."],
      ["livre","Conversa livre","Você é um amigo japonês curioso sobre a vida do aluno no Brasil."]],
  de:[["arzt","Beim Arzt","Du bist Arzthelferin in einer Praxis; der Schüler ist Patient."],
      ["baeckerei","In der Bäckerei","Du bist Verkäufer in einer Bäckerei."],
      ["wohnung","Wohnungssuche","Du bist Vermieter und zeigst eine Wohnung."],
      ["bewerbung","Vorstellungsgespräch","Du führst ein Vorstellungsgespräch."],
      ["kollegen","Mit Kollegen","Du bist ein freundlicher Kollege in der Kaffeepause."],
      ["amt","Beim Bürgeramt (Anmeldung)","Du arbeitest im Bürgeramt; der Schüler meldet seine Wohnung an."],
      ["restaurant","Im Restaurant","Du bist Kellner in einem Restaurant."],
      ["frei","Freies Gespräch","Du bist ein deutscher Freund, neugierig auf das Leben des Schülers in Brasilien."]]
};
function conversaView(l, onEnd){
  const wrap=h("div",{class:"stack"});
  if(!aiReady()){
    wrap.append(h("div",{class:"card"}, h("p",{text:"A conversa precisa do professor (Claude) liberado nesta visualização. Abra o app pelo link do Claude e permita o uso quando ele pedir."})));
    return wrap;
  }
  const pickCard=h("div",{class:"card stack"}, h("h3",{text:"Escolha a situação"}),
    h("p",{class:"small muted",text:"O professor faz o papel do outro lado. Depois de cada fala sua, ele mostra a versão correta e natural. Dica: use o microfone do teclado do celular para ditar suas falas e treinar a fala."}));
  const grid=h("div",{class:"opts"});
  SCENES[l].forEach(sc=>grid.append(h("button",{class:"opt",type:"button",text:sc[1],onclick:()=>start(sc)})));
  pickCard.append(grid); wrap.append(pickCard);
  function start(sc){
    wrap.innerHTML="";
    const turns=[], log=h("div",{class:"chat"}), corrections=[];
    let autoplay=true, busy=false;
    const RULES=`Você é um parceiro de conversa e professor de ${LANGNAME[l]} para um aluno brasileiro (${levelLine(l)}).
Cena: ${sc[2]}
Regras: fale SOMENTE ${l==="ja"?"japonês":"alemão"} na sua fala, no nível do aluno (frases curtas, ${aiLevel(l)}), uma ou duas frases por turno, e sempre termine com algo que peça resposta. Mantenha o papel.
Se a última fala do aluno tiver erro de gramática, vocabulário, registro (${l==="ja"?"敬語/丁寧語":"Sie/du"}) ou naturalidade, corrija. Se o aluno escrever em português, dê a versão em ${LANGNAME[l]} em "corrigida" e continue.
Responda SEMPRE só com JSON: {"fala":"sua fala","leitura":"${l==="ja"?"fala em hiragana com espaços":""}","traducao":"tradução da sua fala","correcao":{"ok":true,"corrigida":"versão correta e natural da fala do aluno (vazio no primeiro turno)","explicacao":"1 frase em português, vazio se ok"},"dica":"sugestão curta, em português, do que o aluno pode responder"}`;
    const head=h("div",{class:"row"}, h("h3",{text:sc[1]}), h("span",{class:"spacer"}),
      h("label",{class:"row small",style:"gap:6px"}, h("input",{type:"checkbox",id:"conv-auto",checked:true,onchange:e=>autoplay=e.target.checked}),"Voz automática"));
    const inp=h("textarea",{id:"conv-in",lang:l,rows:"2",placeholder: l==="ja"?"Sua fala em japonês (ou em português, se travar)":"Deine Antwort auf Deutsch (oder auf Portugiesisch)"});
    const send=h("button",{class:"btn primary",type:"button",text:"Enviar"});
    const endBtn=h("button",{class:"btn ghost",type:"button",text:"Encerrar"});
    const status=h("p",{class:"small muted"});
    wrap.append(h("div",{class:"card stack"}, head, log, status, inp, h("div",{class:"row"}, send, endBtn)));
    function bubbleProf(r){
      const tBox=h("div",{class:"small",hidden:true,text:r.traducao||""});
      const dica=r.dica ? h("details",{class:"small"}, h("summary",{text:"Dica"}), h("p",{text:r.dica})) : null;
      log.append(h("div",{class:"msg prof"},
        h("div",{class:"row",style:"flex-wrap:nowrap;align-items:flex-start"}, h("div",{style:"flex:1;min-width:0"},
          h("div",{lang:l,style:"font-size:1.1rem",text:r.fala}),
          l==="ja"&&r.leitura ? h("div",{class:"kana small",lang:"ja",text:r.leitura}) : null, tBox),
          playBtns(l, r.fala, r.leitura||"")),
        h("div",{class:"row"}, h("button",{class:"linkbtn",type:"button",text:"Tradução",onclick:()=>tBox.hidden=!tBox.hidden}), dica)));
      if(autoplay) speak(sayOf(l,r.fala,r.leitura||""), l, {rate:0.9});
      reveal(log.lastChild);
    }
    let ctl=null;
    const stopBtn=h("button",{class:"btn ghost",type:"button",text:"Parar",hidden:true,onclick:()=>{ ctl && ctl.abort(); }});
    send.after(stopBtn);
    function scrollEnd(el){ reveal(el); }
    async function turn(userText){
      if(busy) return; busy=true; send.disabled=true; stopBtn.hidden=false; status.textContent="";
      let mine=null;
      if(userText){ mine=h("div",{class:"msg me",lang:l,text:userText}); log.append(mine); }
      const typing=h("div",{class:"msg prof typing",text:"digitando…"}); log.append(typing); scrollEnd(typing);
      // histórico sempre alternado: regras (user) → fala do professor (assistant) → fala do aluno (user) …
      const hist=turns.slice(-14); while(hist.length && hist[0].role!=="assistant") hist.shift();
      const msgs=[{role:"user",content:RULES+"\n\nComece a cena agora com a sua primeira fala."}, ...hist];
      if(userText) msgs.push({role:"user",content:userText});
      ctl=new AbortController();
      try{
        const r=await sampleFn.json(msgs,{cache:false, signal:ctl.signal});
        const fala = r && (typeof r.fala==="string" ? r.fala : Array.isArray(r.fala) ? r.fala.join(" ") : null);
        if(!fala) throw {code:"invalid_json"};
        r.fala=fala;
        typing.remove();
        if(userText) turns.push({role:"user",content:userText});
        turns.push({role:"assistant",content:JSON.stringify({fala:r.fala, leitura:r.leitura||"", traducao:r.traducao||""})});
        const c=(r.correcao && typeof r.correcao==="object") ? r.correcao : {};
        if(userText){
          const corr = typeof c.corrigida==="string" ? c.corrigida.trim() : "";
          const ok = c.ok!==false || !corr;
          if(!ok){
            mine.classList.add("bad");
            mine.after(h("div",{class:"msg fix"}, h("div",{class:"small",text:"Mais natural:"}), h("div",{class:"row",style:"flex-wrap:nowrap"}, h("b",{lang:l,style:"flex:1",text:corr}), playBtns(l,corr,"")), c.explicacao?h("div",{class:"small",text:String(c.explicacao)}):null));
            corrections.push({wrong:userText, right:corr, why:String(c.explicacao||"")});
            try{ saveErro(l+"-conversa-"+fnv(corr), {idioma:l,competencia:"escrita",conteudo:"conversa",ponto:sc[1],erro:userText,correta:corr,causaProvavel:String(c.explicacao||""),ocorrencias:1,primeira:TODAY,ultima:TODAY,corrigido:false,acertosDepois:0}); }catch(e){}
          }
          try{ eloUpdate(l,"escrita",l==="ja"?300:200,ok,"conversa"); }catch(e){}
          if(S){ S.stats[ok?"ok":"no"]++; S.convTurns=(S.convTurns||0)+1; }
        }
        bubbleProf(r);
      }catch(e){
        typing.remove();
        const msg = (e && e.code==="cancelled") ? "Resposta interrompida." : (aiError(e) || "Não consegui a resposta do professor.");
        const retry=h("div",{class:"msg prof err"}, h("div",{class:"small",text:msg}),
          h("button",{class:"btn small",type:"button",text:"Tentar de novo",onclick:()=>{ retry.remove(); if(mine) mine.remove(); turn(userText); }}));
        log.append(retry); scrollEnd(retry);
      }
      busy=false; send.disabled=false; stopBtn.hidden=true; ctl=null;
    }
    send.addEventListener("click",()=>{ const t=inp.value.trim(); if(!t || busy) return; inp.value=""; turn(t); });
    inp.addEventListener("keydown",e=>{ if(e.isComposing || e.keyCode===229) return; if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send.click(); } });
    endBtn.addEventListener("click",()=>{
      wrap.innerHTML="";
      const n=turns.filter(t=>t.role==="user").length;
      wrap.append(h("div",{class:"card stack"}, h("h3",{text:"Conversa encerrada"}),
        h("p",{text:n+" fala"+(n!==1?"s":"")+" suas, "+corrections.length+" corrigida"+(corrections.length!==1?"s":"")+"."}),
        corrections.length ? h("ul",{class:"errlist"}, corrections.map(c=>h("li",{}, h("span",{class:"wrong",lang:l,text:c.wrong}), h("br"), h("strong",{lang:l,text:c.right}), c.why?h("div",{class:"small muted",text:c.why}):null))) : null,
        h("p",{class:"small muted",text:"As correções foram para o banco de erros. Leia cada versão correta em voz alta."}),
        h("button",{class:"btn",type:"button",text:"Outra situação",onclick:()=>{ const v=conversaView(l,onEnd); wrap.replaceWith(v); }})));
      onEnd && onEnd();
    });
    turn(null);
  }
  return wrap;
}

/* =========================================================
   Leitura com glossário (tocar na palavra)
   ========================================================= */
const TEMAS=["cotidiano","trabalho","notícia leve","saúde","tecnologia","cultura e viagem"];
function readerView(l){
  const wrap=h("div",{class:"stack"});
  const lvlSel=h("select",{id:"rd-lvl"}, (l==="ja"?["N3","N2"]:["A2","B1","B2"]).map(v=>h("option",{value:v,text:v})));
  lvlSel.value = courseLevel(l)==="concluído" ? (l==="ja"?"N2":"B2") : courseLevel(l);
  const temaSel=h("select",{id:"rd-tema"}, TEMAS.map(t=>h("option",{value:t,text:t})));
  const own=h("textarea",{id:"rd-own",rows:"3",lang:l,placeholder:"Opcional: cole aqui um texto seu (ex.: notícia do bot de idiomas) para ler com glossário"});
  const gen=h("button",{class:"btn primary",type:"button",text:"Gerar leitura"});
  const st=h("p",{class:"small muted"});
  const out=h("div",{class:"stack"});
  if(!aiReady()){ wrap.append(h("div",{class:"card"},h("p",{text:"A leitura com glossário precisa do professor (Claude) liberado nesta visualização."}))); return wrap; }
  wrap.append(h("div",{class:"card stack"},
    h("p",{class:"small",text:"Toque em qualquer palavra para ver leitura e significado; a que você não souber vira item de revisão. Lendo bastante no seu nível, a leitura fica mais rápida (Nakanishi, 2015)."}),
    h("div",{class:"row"}, h("label",{class:"small",for:"rd-lvl",text:"Nível"}), lvlSel, h("label",{class:"small",for:"rd-tema",text:"Tema"}), temaSel),
    own, h("div",{class:"row"}, gen), st), out);
  gen.addEventListener("click", async ()=>{
    gen.disabled=true; out.innerHTML=""; st.textContent="Preparando o texto e o glossário… (20 a 60 segundos)";
    const lr=learned(l).slice(-6);
    const base = own.value.trim()
      ? `Use EXATAMENTE este texto (corrija só erros de digitação óbvios; se for longo, use as primeiras 8 frases):\n"""${own.value.trim().slice(0,2500)}"""`
      : `Escreva um texto original de 6 a 8 frases, nível ${lvlSel.value}, tema: ${temaSel.value}. ${lr.length?"Use naturalmente alguns destes pontos: "+lr.map(p=>p.t).join(", ")+".":""}`;
    const prompt=`Prepare uma leitura com glossário em ${LANGNAME[l]} para um aluno brasileiro (${levelLine(l)}).
${base}
Divida cada frase em segmentos na ordem original; juntando os "s" de uma frase, o texto dela deve sair idêntico. Palavras de conteúdo (substantivo, verbo, adjetivo, advérbio, expressões) têm "m" (significado em português no contexto) e "b" (forma de dicionário)${l==="ja"?' e "r" (leitura em hiragana do segmento)':""}; partículas e pontuação vêm só com "s".
Responda só com JSON: {"titulo":"...","frases":[{"seg":[{"s":"...","r":"...","m":"...","b":"..."}],"t":"tradução da frase"}],"perguntas":[{"q":"pergunta de compreensão em português","o":["certa","errada","errada","errada"]}]}. Faça 2 perguntas.`;
    try{
      const r=await sampleFn.json(prompt,{cache:false});
      if(!r || !Array.isArray(r.frases) || !r.frases.length) throw {code:"invalid_json"};
      st.textContent=""; renderReading(out, l, r);
    }catch(e){ st.textContent=aiError(e)||""; }
    gen.disabled=false;
  });
  return wrap;
}
function renderReading(out, l, r){
  let furi=false;
  const card=h("div",{class:"card stack reader"});
  const pop=h("div",{class:"wpop",hidden:true});
  const sents=[];
  const full=r.frases.map(f=>(f.seg||[]).map(s=>s.s||"").join("")).join(l==="ja"?"":" ");
  card.append(h("div",{class:"row"}, h("h3",{lang:l,text:r.titulo||"Leitura"}), h("span",{class:"spacer"}),
    h("button",{class:"btn small",type:"button",text:"▶ Tudo",onclick:()=>speak(full,l,{rate:0.9})})),
    l==="ja" ? h("label",{class:"row small",style:"gap:6px"}, h("input",{type:"checkbox",id:"rd-furi",onchange:e=>{ furi=e.target.checked; card.classList.toggle("furi",furi); }}),"Furigana") : null);
  r.frases.forEach((f,fi)=>{
    const segs=Array.isArray(f.seg)?f.seg:[];
    const text=segs.map(s=>s.s||"").join("");
    const line=h("p",{class:"rline",lang:l});
    segs.forEach(sg=>{
      if(!sg || !sg.s) return;
      if(!sg.m){ line.append(document.createTextNode(sg.s+(l==="de"&&/\w$/.test(sg.s)?" ":""))); return; }
      const el = (l==="ja" && sg.r && hasKanji(sg.s)) ? h("ruby",{}, sg.s, h("rt",{text:sg.r})) : document.createTextNode(sg.s);
      const w=h("button",{class:"tokw",type:"button"}, el);
      w.addEventListener("click",()=>showPop(sg, text, f.t||"", w));
      line.append(w); if(l==="de") line.append(document.createTextNode(" "));
    });
    const tr=h("div",{class:"small muted",hidden:true,text:f.t||""});
    card.append(h("div",{class:"rrow"}, line, h("div",{class:"row"}, iconBtn("play","Ouvir a frase",()=>speak(text,l,{rate:0.9})), h("button",{class:"linkbtn",type:"button",text:"tradução",onclick:()=>tr.hidden=!tr.hidden})), tr));
    sents.push(text);
  });
  card.append(pop);
  out.append(card);
  function showPop(sg, sentence, trad, anchor){
    const base=sg.b||sg.s, exists=C[l].vocab.find(v=>v.w===base || v.w===sg.s);
    const it=exists?getItem(exists):null;
    pop.hidden=false; pop.innerHTML="";
    const add=h("button",{class:"btn small primary",type:"button",text: exists ? (it&&it.estado>=2?"Já está nas suas palavras":"Estudar esta palavra") : "Adicionar às minhas palavras"});
    if(exists && it && it.estado>=2) add.disabled=true;
    add.addEventListener("click",()=>{
      let v=exists;
      if(!v){
        const isKana=/^[\u3040-\u30ffー]+$/.test(base);
        const d = l==="ja" ? {lang:l,lvl:"leitura",w:base,r:(base===sg.s ? (sg.r||"") : (isKana?base:"")),m:sg.m,ex:sentence,exr:"",ext:trad,criado:TODAY}
                           : {lang:l,lvl:"leitura",a:"",w:base,pl:"",m:sg.m,ex:sentence,ext:trad,criado:TODAY};
        d.id="vx-"+l+"-"+(l==="ja"?base:slug(base)+"-x");
        store.vocabExtra[d.id]=d; write("vocabExtra",d.id,d); addExtraVocab([d]); v=C[l].byId[d.id];
      }
      introduce(v); add.textContent="Adicionada: volta amanhã na revisão"; add.disabled=true;
      if(S) S.newWords=(S.newWords||[]).concat([v]);
    });
    pop.append(h("div",{class:"row",style:"align-items:baseline"}, h("b",{lang:l,style:"font-size:1.3rem",text:sg.s}),
        l==="ja"&&sg.r ? h("span",{class:"kana",lang:"ja",text:sg.r}) : null, h("span",{class:"spacer"}),
        iconBtn("play","Ouvir",()=>speak(l==="ja"?(sg.r||sg.s):sg.s,l,{rate:0.85})),
        h("button",{class:"linkbtn",type:"button",text:"fechar",onclick:()=>pop.hidden=true})),
      h("div",{text:sg.m}), sg.b && sg.b!==sg.s ? h("div",{class:"small muted",lang:l,text:"forma de dicionário: "+sg.b}) : null, add);
    anchor.closest(".rrow").after(pop);
  }
  const qs=(r.perguntas||[]).filter(q=>q && q.q && Array.isArray(q.o) && q.o.length>=2);
  let qsDone=0;
  qs.forEach(q=>{
    const c=h("div",{class:"ex-card"}, h("div",{class:"ex-meta"},h("span",{class:"chip s2",text:"Compreensão"})), h("p",{style:"font-weight:500",text:q.q}));
    const g=h("div",{class:"opts"});
    shuffle(q.o.map((o,i)=>i)).forEach(i=>{ const b=h("button",{class:"opt",type:"button",text:q.o[i],onclick:()=>{
      const ok=i===0; g.querySelectorAll("button").forEach(x=>x.disabled=true); b.classList.add(ok?"right":"wrong");
      if(!ok) [...g.children].find(x=>x.textContent===q.o[0]).classList.add("right");
      eloUpdate(l,"leitura",DIFF[courseLevel(l)]||300,ok,"leitura"); if(S) S.stats[ok?"ok":"no"]++;
      addDay(l,{[ok?"ok":"no"]:1, xp:ok?8:2}); if(++qsDone===qs.length) addDay(l,{leit:1, xp:10});
    }}); g.append(b); });
    c.append(g); out.append(c);
  });
}

/* =========================================================
   Teste de nível (adaptativo)
   ========================================================= */
function placementView(l, onDone){
  const wrap=h("div",{class:"stack"});
  const units=C[l].units;
  let lo=0, hi=units.length-1, placement=0;
  const gramLog=[], vocLog=[];
  wrap.append(h("div",{class:"card stack"}, h("h2",{text:"Teste de nível"}),
    h("p",{class:"small",text:"Cerca de 10 minutos. A gramática se adapta: acertou, sobe de unidade; errou, desce. Depois, uma amostra de palavras de cada nível. Use \"Não sei\" em vez de chutar: o resultado fica mais preciso."})));
  const area=h("div",{class:"stack"}); wrap.append(area);
  function gramRound(){
    if(lo>hi){ vocabPart(); return; }
    const mid=Math.floor((lo+hi)/2), u=units[mid];
    const pts=shuffle(u.points).slice(0,2);
    let right=0, k=0, tie=false;
    const next=()=>{
      // 1 de 2: uma terceira pergunta desempata (um deslize não derruba a unidade inteira)
      if(k>=pts.length && right===1 && pts.length===2 && !tie){ tie=true; const extra=shuffle(u.points.filter(x=>!pts.includes(x)))[0]; if(extra){ pts.push(extra); } }
      if(k>=pts.length){
        if(tie && right===2) right=pts.length;
        gramLog.push({u:u.id, right, n:pts.length});
        if(right===pts.length){ placement=Math.max(placement,mid+1); lo=mid+1; } else hi=mid-1;
        gramRound(); return;
      }
      const p=pts[k++];
      area.innerHTML="";
      area.append(h("p",{class:"small muted",text:"Gramática · unidade "+(mid+1)+" de "+units.length+" ("+u.lvl+")"}));
      const card=exMC(p, pick(p.q), ()=>next(), "Teste", ok=>{ if(ok) right++; eloUpdate(l,"gramatica",DIFF[p.lvl]||250,ok,"diagnostico"); });
      card.querySelector(".opts").append(h("button",{class:"opt idk",type:"button",text:"Não sei",onclick:()=>{ eloUpdate(l,"gramatica",DIFF[p.lvl]||250,false,"diagnostico"); next(); }}));
      area.append(card);
    };
    next();
  }
  function vocabPart(){
    const lvls=[...new Set(C[l].vocab.filter(v=>!v.gen).map(v=>v.lvl))];
    const sample=[]; lvls.forEach(lv=>shuffle(C[l].vocab.filter(v=>v.lvl===lv && !v.gen)).slice(0,8).forEach(v=>sample.push(v)));
    let i=0;
    const next=()=>{
      if(i>=sample.length){ finish(); return; }
      const v=sample[i++];
      area.innerHTML="";
      area.append(h("p",{class:"small muted",text:"Palavras · "+i+" de "+sample.length+" ("+v.lvl+")"}));
      const card=exVChoice(v,{tag:"Teste", kind:"vmc", prompt:h("div",{class:"prompt center"}, h("span",{class:"word-big",lang:l,text:v.w})),
        right:v.m, wrong:distract(v,o=>o.m,3), onAnswer:ok=>{ vocLog.push({v,ok,idk:false}); eloUpdate(l,"vocabulario",DIFF[v.lvl]||250,ok,"diagnostico"); }}, ()=>next());
      card.querySelector(".opts").append(h("button",{class:"opt idk",type:"button",text:"Não sei",onclick:()=>{ vocLog.push({v,ok:false,idk:true}); eloUpdate(l,"vocabulario",DIFF[v.lvl]||250,false,"diagnostico"); next(); }}));
      area.append(card);
    };
    next();
  }
  function finish(){
    // pontos das unidades dominadas entram como conhecidos, com revisões espalhadas em 3 semanas
    const known=units.slice(0,placement).flatMap(u=>u.points).filter(p=>{ const it=getItem(p); return !it || it.estado<2; });
    known.forEach((p,i)=>markKnown(p,4,Math.floor(i*17/Math.max(1,known.length))));
    const okWords=vocLog.filter(x=>x.ok).map(x=>x.v).filter(v=>{ const it=getItem(v); return !it || it.estado<2; });
    okWords.forEach((v,i)=>markKnown(v,3,i%7));
    const byLvl={}; vocLog.forEach(x=>{ const b=byLvl[x.v.lvl]=byLvl[x.v.lvl]||{ok:0,wrong:0,n:0}; b.n++; if(x.ok) b.ok++; else if(!x.idk) b.wrong++; });
    const est={}; Object.keys(byLvl).forEach(k=>{ const b=byLvl[k]; est[k]=Math.max(0,Math.round((b.ok - b.wrong/3)/b.n*100)); });  // correção de chute (4 opções)
    const pf=store.perfil[l]; if(pf){ pf.diagnostico={data:TODAY, unidade:placement, vocab:est}; savePerfil(l); }
    area.innerHTML="";
    const nextU=units[placement];
    area.append(h("div",{class:"card stack"}, h("h3",{text:"Resultado"}),
      h("p",{text: placement===0 ? "Vamos começar do início da trilha de gramática." : "Gramática: você domina até a unidade "+placement+" ("+units[placement-1].t+"). "+known.length+" pontos entraram direto na revisão, espalhados nas próximas 3 semanas."}),
      nextU ? h("p",{}, "Próxima aula: ", h("b",{text:nextU.lvl+" · "+nextU.t})) : h("p",{text:"Você passou por todas as unidades."}),
      h("p",{text:"Vocabulário (estimativa corrigida para chute): "+Object.entries(est).map(([k,v])=>k+" ≈ "+v+"%").join(" · ")+"."}),
      h("p",{class:"small muted",text:okWords.length+" palavras que você acertou ficaram como Reconhece. Para marcar mais palavras que você já sabe, use Trilha > Palavras > \"Já sei palavras deste nível\"."}),
      h("p",{class:"small muted",text:"Gramática estimada agora: "+levelText(l)+"."})));
    onDone && onDone();
  }
  gramRound();
  return wrap;
}

/* =========================================================
   Escuta, modo trajeto e textos embutidos
   ========================================================= */
/* frases para ouvir: exemplos dos pontos e palavras já vistos (ou do começo da trilha) */
function listenPool(l){
  const pool=[];
  const pts=learned(l); (pts.length?pts:C[l].points.slice(0,5)).forEach(p=>okXs(p).forEach(x=>pool.push({p, text:x[0], kana:x[1], pt:x[2]})));
  seenOf(vocabItems(l)).forEach(v=>{ if(v.ex && v.ex[0] && v.ex[2]) pool.push({p:v, text:v.ex[0], kana:v.ex[1], pt:v.ex[2]}); });
  return pool;
}
function compQuestion(l, q, onAnswer){
  const c=h("div",{class:"ex-card"}, h("div",{class:"ex-meta"},h("span",{class:"chip s2",text:"Compreensão"})), h("p",{style:"font-weight:500",text:q[0]}));
  const g=h("div",{class:"opts"}); const opts=q.slice(1);
  shuffle(opts.map((o,i)=>i)).forEach(i=>{ const b=h("button",{class:"opt",type:"button",text:opts[i],onclick:()=>{
    const ok=i===0; g.querySelectorAll("button").forEach(x=>x.disabled=true); b.classList.add(ok?"right":"wrong");
    if(!ok) [...g.children].find(x=>x.textContent===opts[0]).classList.add("right");
    onAnswer && onAnswer(ok);
  }}); b.dataset.k=g.children.length+1; g.append(b); });
  c.append(g); return c;
}
/* Ouça e escolha a tradução (sem ver o texto). Não mexe na agenda do item: é treino de ouvido. */
function exListen(l, item, pool, done){
  const card=h("div",{class:"ex-card"});
  const wrong=shuffle(pool.filter(o=>o.pt && o.pt!==item.pt)).map(o=>o.pt).filter((x,i,a)=>a.indexOf(x)===i).slice(0,3);
  const opts=[item.pt, ...wrong];
  let plays=0;
  const say=()=>{ plays++; speak(sayOf(l,item.text,item.kana), l, {rate: plays>2?0.75:settings.rate}); };
  card.append(h("div",{class:"ex-meta"}, h("span",{class:"chip s2",text:"Escuta"}), h("span",{text:"Ouça e escolha o que foi dito"})),
    h("div",{class:"prompt center"}, h("div",{class:"row"}, h("button",{class:"btn primary",type:"button",text:"▶ Ouvir",onclick:say}), h("button",{class:"btn",type:"button",text:"Devagar",onclick:()=>{ plays++; speak(sayOf(l,item.text,item.kana), l, {rate:0.7}); }}))));
  const grid=h("div",{class:"opts"});
  shuffle(opts.map((o,i)=>i)).forEach(i=>{
    const b=h("button",{class:"opt",type:"button",text:opts[i]});
    b.addEventListener("click",()=>{
      const ok=i===0;
      grid.querySelectorAll("button").forEach(x=>x.disabled=true);
      b.classList.add(ok?"right":"wrong");
      if(!ok) [...grid.children].find(x=>x.textContent===opts[0]).classList.add("right");
      addDay(l,{esc:1, xp: ok?6:2, [ok?"ok":"no"]:1});
      eloUpdate(l,"listening",DIFF[item.p.lvl]||250,ok,"escuta");
      if(S){ S.stats[ok?"ok":"no"]++; S.xp=(S.xp||0)+(ok?6:2); }
      card.append(feedbackBox(ok,l,item.text,item.kana,item.pt,null, ok?"Certo":"Era:"));
      card.append(contBtn(()=>done(ok)));
    });
    b.dataset.k=grid.children.length+1; grid.append(b);
  });
  card.append(grid);
  setTimeout(say,250);
  return card;
}
function listenSteps(l, n){
  const pool=listenPool(l); if(pool.length<4) return [];
  return shuffle(pool).slice(0,n).map(it=>d=>exListen(l,it,pool,d));
}
function blockEscuta(box){
  const l=S.lang, steps=listenSteps(l, 6);
  if(!steps.length){ box.append(h("div",{class:"card"},h("p",{text:"Ainda há poucas frases para ouvir. Faça uma aula primeiro."}))); return; }
  runSeq(box, steps, r=>{
    box.innerHTML="";
    const lvl=courseLevel(l), texts=C[l].readings.filter(t=>t.lvl===lvl||lvl==="concluído");
    const t=pick(texts.length?texts:C[l].readings);
    box.append(h("div",{class:"card stack"}, h("h3",{text:"Escuta feita"}), h("p",{text:r.ok+" certo(s), "+r.no+" erro(s)."}),
      t ? h("button",{class:"btn primary",type:"button",text:"Ouvir um texto: "+t.titulo,onclick:()=>{ box.innerHTML=""; box.append(textView(l,t,{listen:true})); }}) : null,
      h("button",{class:"btn ghost",type:"button",text:"Próximo bloco",onclick:skipBlock})));
  });
}

/* texto embutido: leitura (com kana e tradução) ou escuta (texto escondido até você pedir) */
function textView(l, t, o){
  o=o||{};
  const card=h("div",{class:"card stack reader"+(o.listen?" sh-hidden":"")});
  const all=t.frases.map(f=>sayOf(l,f[0],f[1])).join(l==="ja"?"":" ");
  let stop=null;
  const playAll=h("button",{class:"btn small primary",type:"button",text:"▶ Texto todo",onclick:()=>{ stop&&stop(); stop=speakSeq(t.frases.map(f=>({text:sayOf(l,f[0],f[1]), l, rate:settings.rate, gap:700}))); }});
  const body=h("div",{class:"hide-pt"+(l==="ja"?"":"")});
  t.frases.forEach(f=>body.append(h("div",{class:"ex"}, playBtns(l,f[0],f[1]), h("div",{}, h("div",{class:"jp sh-text",lang:l,text:f[0]}), l==="ja"?h("div",{class:"kana",lang:"ja",text:f[1]}):null, h("div",{class:"pt",text:f[2]})))));
  const tg=h("div",{class:"toggles"},
    o.listen ? h("label",{}, h("input",{type:"checkbox",id:"tv-show-"+t.id,onchange:e=>card.classList.toggle("sh-hidden",!e.target.checked)}),"Mostrar texto") : null,
    l==="ja" ? h("label",{}, h("input",{type:"checkbox",id:"tv-kana-"+t.id,checked:true,onchange:e=>body.classList.toggle("hide-kana",!e.target.checked)}),"Kana") : null,
    h("label",{}, h("input",{type:"checkbox",id:"tv-pt-"+t.id,onchange:e=>body.classList.toggle("hide-pt",!e.target.checked)}),"Tradução"));
  card.append(h("div",{class:"row"}, h("span",{class:"chip",text:t.lvl}), h("h3",{lang:l,text:t.titulo}), h("span",{class:"spacer"}), playAll), tg,
    h("p",{class:"small muted",text: o.listen ? "Ouça o texto todo (duas vezes, se precisar) e responda. Depois confira o texto." : "Leia primeiro sem tradução. Toque ▶ para ouvir cada frase e repita em voz alta."}), body);
  const out=h("div",{class:"stack"}, card);
  let answered=0, right=0;
  t.perguntas.forEach(q=>out.append(compQuestion(l,q,ok=>{
    answered++; if(ok) right++;
    eloUpdate(l, o.listen?"listening":"leitura", DIFF[t.lvl]||250, ok, o.listen?"escuta":"leitura");
    if(S) S.stats[ok?"ok":"no"]++;
    addDay(l, {[ok?"ok":"no"]:1, xp: ok?8:2, ...(o.listen?{esc:1}:{})});
    if(answered===t.perguntas.length){
      addDay(l, {leit:1, xp:10});
      const lidos=(store.perfil[l].textos=store.perfil[l].textos||{}); lidos[t.id]={data:TODAY, acertos:right, total:answered}; savePerfil(l);
      out.append(h("div",{class:"card stack"}, h("p",{text:"Texto concluído: "+right+" de "+answered+" certas."}),
        o.after ? h("button",{class:"btn",type:"button",text:"Voltar",onclick:o.after}) : null));
    }
  })));
  return out;
}
function textsView(l){
  const wrap=h("div",{class:"stack"});
  const lidos=(store.perfil[l]&&store.perfil[l].textos)||{};
  const list=h("div",{class:"textlist"});
  const area=h("div",{class:"stack"});
  const lvl=courseLevel(l);
  const texts=C[l].readings.slice().sort((a,b)=> (a.lvl===lvl?-1:0)-(b.lvl===lvl?-1:0));
  texts.forEach(t=>list.append(h("button",{type:"button",onclick:()=>{ area.innerHTML=""; area.append(textView(l,t,{listen:modeSel.value==="escuta", after:()=>{ area.innerHTML=""; window.scrollTo(0,0); }})); reveal(area.firstChild); }},
    h("span",{class:"row"}, h("span",{class:"chip",text:t.lvl}), lidos[t.id]?h("span",{class:"chip s6",text:"✓ "+lidos[t.id].acertos+"/"+lidos[t.id].total}):null),
    h("span",{class:"tt",lang:l,text:t.titulo}), h("span",{class:"small muted",text:t.frases.length+" frases · "+t.perguntas.length+" perguntas"}))));
  const modeSel=h("select",{id:"tx-mode"}, h("option",{value:"leitura",text:"Ler"}), h("option",{value:"escuta",text:"Só ouvir (texto escondido)"}));
  wrap.append(h("div",{class:"card stack"}, h("h3",{text:"Textos prontos"}),
    h("p",{class:"small muted",text:"Textos curtos do seu nível com áudio e perguntas. Funcionam mesmo sem o professor."+(aiReady()?" Para textos novos a cada dia, use \"Gerar leitura\" abaixo.":"")}),
    h("div",{class:"row"}, h("label",{class:"small",for:"tx-mode",text:"Modo"}), modeSel), list), area);
  return wrap;
}

/* Modo trajeto: mãos livres, para ônibus/Uber. Frase no idioma → pausa → tradução → frase de novo, devagar. */
function trajetoView(l){
  const wrap=h("div",{class:"stack"});
  let pool=shuffle(listenPool(l)), i=0, playing=false, stop=null, withPt=true, rate=0.9, count=0;
  const now=h("div",{class:"listen-now",lang:l,text:"—"}), nowK=h("div",{class:"kana small",lang:"ja"}), nowPt=h("div",{class:"small muted"});
  const status=h("div",{class:"small muted",text: pool.length ? pool.length+" frases na fila." : "Faça algumas aulas para encher a fila."});
  const playBtn=h("button",{class:"btn primary",type:"button",text:"▶ Começar"});
  const ptCb=h("input",{type:"checkbox",id:"tj-pt",checked:true,onchange:e=>withPt=e.target.checked});
  const speeds=h("div",{class:"speeds",role:"group","aria-label":"Velocidade"});
  [["0.75","0,75×"],["0.9","0,9×"],["1","1×"]].forEach(([v,t])=>speeds.append(h("button",{type:"button","aria-pressed":String(Number(v)===rate),text:t,onclick:e=>{ rate=Number(v); speeds.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===e.currentTarget))); }})));
  function playOne(){
    if(!playing || !pool.length) return;
    const it=pool[i%pool.length]; i++;
    now.textContent=clean(it.text); nowK.textContent= l==="ja" ? (it.kana||"") : ""; nowPt.textContent=it.pt;
    const seq=[{text:sayOf(l,it.text,it.kana), l, rate, gap:900}];
    if(withPt) seq.push({text:it.pt, l:"pt", rate:1.05, gap:700});
    seq.push({text:sayOf(l,it.text,it.kana), l, rate:Math.max(0.6,rate-0.15), gap:1400});
    stop=speakSeq(seq, ()=>{ count++; status.textContent=count+" frases ouvidas nesta sessão."; if(count%3===0) addDay(l,{esc:1, xp:3}); playOne(); });
  }
  playBtn.addEventListener("click",()=>{
    if(!pool.length) return;
    playing=!playing; playBtn.textContent=playing?"❚❚ Pausar":"▶ Continuar";
    if(playing){ keepAwake(true); playOne(); } else { stop&&stop(); if(!state.startedAt) keepAwake(false); }
  });
  wrap.append(h("div",{class:"card stack"},
    h("h3",{text:"Modo trajeto"}),
    h("p",{class:"small muted",text:"Mãos livres: a frase toca no idioma, depois em português e de novo mais devagar. Bom para o trajeto de ônibus ou Uber. Repita em voz baixa. Deixe a tela ligada."}),
    h("div",{class:"row"}, speeds, h("label",{class:"row small",style:"gap:6px"}, ptCb, "Com tradução falada")),
    h("div",{class:"row"}, playBtn, h("button",{class:"btn",type:"button",text:"Pular ⏭",onclick:()=>{ if(!playing) return; stop&&stop(); playOne(); }})),
    status),
    h("div",{class:"card stack"}, now, nowK, nowPt));
  return wrap;
}

/* =========================================================
   Aula
   ========================================================= */
function lessonView(p, o){
  o=o||{};
  const l=p.lang, u=C[l].unitById[p.u];
  const wrap=h("div",{class:"card stack"});
  const it=getItem(p);
  wrap.append(
    h("div",{class:"row"}, h("span",{class:"eyebrow",text:u.lvl+" · "+u.t}), h("span",{class:"spacer"}), h("span",{class:"chip s"+(it?it.estado:1),text:ESTADO[it?it.estado:1]})),
    h("div",{class:"lesson-title",lang:l,text:p.t}),
    h("p",{style:"font-size:1.1rem",text:p.m}),
    h("div",{class:"formula"}, h("span",{class:"eyebrow",text:"Formação "}), h("br"), h("span",{lang:l,text:p.f})),
    h("p",{text:p.e}),
    h("p",{class:"tip small",text:p.c}));
  const exBox=h("div");
  const toggles=h("div",{class:"toggles"},
    l==="ja" ? h("label",{}, h("input",{type:"checkbox",id:"tg-kana-"+p.id,checked:true,onchange:e=>exBox.classList.toggle("hide-kana",!e.target.checked)}),"Leitura em kana") : null,
    h("label",{}, h("input",{type:"checkbox",id:"tg-pt-"+p.id,checked:true,onchange:e=>exBox.classList.toggle("hide-pt",!e.target.checked)}),"Tradução"));
  p.x.forEach(x=>exBox.append(h("div",{class:"ex"},
    playBtns(l,x[0],x[1]),
    h("div",{}, h("div",{class:"jp",lang:l,text:clean(x[0])}), l==="ja"?h("div",{class:"kana",lang:"ja",text:x[1]}):null, h("div",{class:"pt",text:x[2]})))));
  wrap.append(h("div",{class:"row"}, h("h3",{text:"Exemplos"}), h("span",{class:"spacer"}), toggles), exBox);
  wrap.append(h("p",{class:"small muted",text:"Toque ▶ e repita em voz alta. A 2ª seta toca devagar."}));

  // Pergunte ao professor
  const ask=h("details",{class:"ask"});
  const q=h("textarea",{id:"ask-"+p.id,rows:"2",placeholder: l==="ja" ? "Ex.: qual a diferença para ことにする?" : "Ex.: quando uso Dativ aqui?"});
  const ans=h("div",{class:"answer",hidden:true});
  const askBtn=h("button",{class:"btn small",type:"button",text:"Perguntar"});
  ask.append(h("summary",{text:"Dúvida? Pergunte ao professor"}), h("div",{class:"stack",style:"margin-top:8px"}, q, h("div",{class:"row"},askBtn), ans));
  askBtn.addEventListener("click", async ()=>{
    const qq=q.value.trim(); if(!qq){ q.focus(); return; }
    askBtn.disabled=true; ans.hidden=false; ans.textContent="Pensando…";
    try{
      await sampleFn(`Você é professor de ${LANGNAME[l]} de um aluno brasileiro, ${levelLine(l)}. Ponto em estudo: ${p.t} — ${p.m}. Formação: ${p.f}.
Responda em português, em até 6 linhas, sem markdown. Se der exemplos, no máximo 2, cada um com ${l==="ja"?"leitura em hiragana e ":""}tradução.
Pergunta do aluno: ${qq}`,{cache:false, onText:({text})=>{ ans.textContent=text; }});
    }catch(e){ const m=aiError(e); ans.textContent=m||""; if(!m) ans.hidden=true; }
    askBtn.disabled=false;
  });
  const hook=()=>{ ask.hidden=!aiReady(); }; aiHooks.push(hook); hook();
  wrap.append(ask);

  if(o.onDone) wrap.append(h("button",{class:"btn primary wide",type:"button",text:o.doneLabel||"Entendi, vamos praticar",onclick:()=>{ introduce(p); o.onDone(); }}));
  if(o.onKnown && (!it || it.estado<4)){
    const quick=h("div",{class:"stack"});
    wrap.append(h("button",{class:"btn ghost wide",type:"button",text:"Já sei este ponto: teste rápido para pular",onclick:e=>{ e.currentTarget.remove(); quickKnown(p, quick, o.onKnown); reveal(quick); }}), quick);
  }
  return wrap;
}
/* Pular um ponto: 3 perguntas sem ajuda (2 de escolha em frases diferentes + montar a frase).
   Acertou tudo: o ponto entra como Compreende, com revisão em alguns dias para confirmar. */
function quickKnown(p, box, onKnown){
  const qs=shuffle(okQs(p)).slice(0,2), res=[];
  const steps=[...qs.map(q=>d=>exMC(p,q,d,"Teste rápido",ok=>res.push(ok))), d=>{ const c=exOrder(p,exampleFor(p,true),d); return c; }];
  let orderOk=null;
  runSeq(box, steps.map((f,k)=> k<2 ? f : (d=>f(ok=>{ orderOk=ok; d(ok); }))), ()=>{
    box.innerHTML="";
    const pass=res.length===2 && res.every(Boolean) && orderOk;
    if(pass){ markKnown(p,4,2); addDay(p.lang,{xp:10});
      box.append(h("div",{class:"feedback ok"}, h("div",{class:"verdict",text:"Ponto pulado"}), h("p",{class:"small",text:"Ele volta numa revisão em alguns dias para confirmar. Se errar lá, ele volta para estudo."}),
        h("button",{class:"btn primary",type:"button",text:"Seguir para o próximo",onclick:onKnown})));
    } else {
      box.append(h("div",{class:"feedback no"}, h("div",{class:"verdict",text:"Vale estudar este ponto"}), h("p",{class:"small",text:"Errou pelo menos uma. Leia a aula acima e faça a prática: é rápido e fixa melhor."})));
    }
  }, {noScroll:true});
}

/* =========================================================
   Pomodoro
   ========================================================= */
/* Planos de 25 min. O principal traz o ponto novo do dia; os extras alternam
   leitura, escuta e conversa para o estudo não ficar repetitivo. */
const PLANS = {
  main:[
    {id:"revisao",name:"Revisão",min:7},
    {id:"aula",name:"Aula",min:3},
    {id:"pratica",name:"Prática",min:6},
    {id:"vocab",name:"Palavras",min:5},
    {id:"shadow",name:"Shadowing",min:2},
    {id:"fecha",name:"Relâmpago",min:2}],
  mainB:[
    {id:"revisao",name:"Revisão",min:7},
    {id:"aula",name:"Aula",min:3},
    {id:"pratica",name:"Prática",min:6},
    {id:"vocab",name:"Palavras",min:5},
    {id:"escuta",name:"Escuta",min:2},
    {id:"fecha",name:"Relâmpago",min:2}],
  extraA:[
    {id:"pausa",name:"Pausa",min:5,rest:true},
    {id:"input",name:"Leitura",min:7},
    {id:"vocab",name:"Palavras",min:5},
    {id:"conversa",name:"Conversa",min:8},
    {id:"shadow",name:"Shadowing",min:2},
    {id:"fecha",name:"Relâmpago",min:3}],
  extraB:[
    {id:"pausa",name:"Pausa",min:5,rest:true},
    {id:"escuta",name:"Escuta",min:7},
    {id:"pratica2",name:"Prática mista",min:7},
    {id:"shadow",name:"Shadowing",min:3},
    {id:"fecha",name:"Relâmpago",min:3}],
  extraC:[
    {id:"pausa",name:"Pausa",min:5,rest:true},
    {id:"conversa",name:"Conversa",min:8},
    {id:"input",name:"Leitura",min:7},
    {id:"vocab",name:"Palavras",min:5}],
  curto:[
    {id:"revisao",name:"Revisão",min:5},
    {id:"vocab",name:"Palavras",min:3},
    {id:"fecha",name:"Relâmpago",min:2}]
};
const WHY = {
  revisao:["Revisão","Gramática, palavras e kanji que você já estudou voltam no dia certo (FSRS), misturados e com frases novas. A nota sai do seu acerto e do tempo, não de botão."],
  vocab:["Palavras","Palavras novas (e kanji, no japonês): você estuda o cartão com áudio e é testado logo em seguida. A quantidade se ajusta às suas revisões pendentes."],
  aula:["Aula","Um ponto novo da trilha: regra em português, contraste com o que confunde e 3 exemplos com áudio. Já sabe? Faça o teste rápido e pule."],
  pratica:["Prática","Exercícios do ponto de hoje: explicar a regra com suas palavras (método Feynman), montar a frase, ditado e uma frase sua corrigida."],
  shadow:["Shadowing","Repetir junto com a voz os exemplos do dia. Treina ouvido, ritmo e pronúncia."],
  escuta:["Escuta","Só áudio: você ouve frases e textos do seu nível e responde sem ver o texto."],
  fecha:["Revisão relâmpago","Teste rápido do que você aprendeu há 15 minutos: a primeira queda da curva do esquecimento é a mais forte, e lembrar agora já achata a curva. Depois, o resumo."],
  conversa:["Conversa","Diálogo com o professor numa situação real. Ele corrige cada fala sua com a versão natural."],
  pausa:["Pausa","Levante, beba água. Pode pular."],
  input:["Leitura","Um texto no seu nível: toque na palavra para ver leitura e significado; a que você não souber vira item de revisão."],
  pratica2:["Prática mista","Exercícios variados dos pontos que você já viu, sem esperar o dia da revisão."]
};
const MAX_POMOS=4;
function dayNum(){ return Math.floor(new Date(TODAY+"T12:00").getTime()/864e5); }
/* qual plano vale agora: o que acabou de terminar, a sessão curta escolhida,
   o pomodoro principal do dia (com aula) ou um extra, em rodízio */
function planKey(){
  if(state.finished && state.lastPlan && PLANS[state.lastPlan]) return state.lastPlan;
  if(state.short) return "curto";
  if(!state.mainDone) return dayNum()%2 ? "mainB" : "main";
  return ["extraA","extraB","extraC"][(dayNum()+state.done)%3];
}
function planFor(){ return PLANS[planKey()]; }
const isMainPlan = k => k==="main" || k==="mainB";
/* rodízio de idiomas: padrão japonês dom/seg/qua/sex e alemão ter/qui/sáb */
function langOfDay(d){
  const r=(typeof settings!=="undefined" && settings.rotacao)||"rodizio";
  if(r==="ja" || r==="ambos") return "ja";
  if(r==="de") return "de";
  return [0,1,3,5].includes(d.getDay()) ? "ja" : "de";
}
function isStudyDay(l, iso){
  const r=settings.rotacao||"rodizio"; if(r==="ambos") return true; if(r==="ja"||r==="de") return r===l;
  const wd=new Date(iso+"T12:00").getDay(); return l==="ja" ? [0,1,3,5].includes(wd) : [2,4,6].includes(wd);
}
let state = (()=>{ const s=LS.get("lm-timer"); if(s && s.day===TODAY) return s; return {day:TODAY, lang:langOfDay(new Date()), elapsed:0, startedAt:null, finished:false, done:0}; })();
if(typeof state.done!=="number") state.done = state.finished ? 1 : 0;
if(typeof state.mainDone!=="boolean") state.mainDone = state.done>0;   // estado salvo antes da sessão curta existir
if(state.startedAt){ state.elapsed += (Date.now()-state.startedAt)/1000; state.startedAt=Date.now(); }
let BLOCKS=planFor(), TOTAL=25*60, shownBlock=null, audioCtx=null, wakeLock=null, lastBlock=-1, trackKey="";
let S=null; // sessão do pomodoro atual
let exBusy=false, exBusyWarned=false; // há uma questão aberta no palco

function newSession(fresh){
  const l=state.lang, extra=!isMainPlan(planKey());
  if(fresh){ state.pointId=null; }
  let np=null;
  if(!extra){
    let hold=false;
    if(state.pointId && state.pointLang===l && C[l].byId[state.pointId]){ np=C[l].byId[state.pointId]; hold=!!state.hold; }
    else if(dueItems(l).length>60 && learned(l).length){ np=learned(l).slice(-1)[0]; hold=true; }   // fila atrasada: reforça o último ponto em vez de abrir outro
    else np=nextNew(l);
    state.pointId=np?np.id:null; state.pointLang=l; state.hold=hold; persist();
  }
  S={lang:l, newPoint:np, hold:!!state.hold && !extra, stats:{ok:0,no:0}, errs:[], touched:[], shadowReps:0, extra, newWords:[], xp:0};
}
function syncPlan(){
  const next = planFor();
  const key = next.map(b=>b.id).join(",");
  if(key!==trackKey){ BLOCKS=next; TOTAL=BLOCKS.reduce((s,b)=>s+b.min*60,0); trackKey=key; buildTrack(); }
}
/* marcas no ensō: onde cada bloco começa */
function buildTrack(){
  const g=$("#ticks"), lb=$("#seglabels"); g.innerHTML=""; lb.innerHTML="";
  let acc=0;
  BLOCKS.forEach((b,k)=>{
    if(k>0){ const a=acc/TOTAL*2*Math.PI, x1=60+44*Math.cos(a), y1=60+44*Math.sin(a), x2=60+56*Math.cos(a), y2=60+56*Math.sin(a);
      const ln=document.createElementNS("http://www.w3.org/2000/svg","line"); ln.setAttribute("class","tick");
      ln.setAttribute("x1",x1.toFixed(1)); ln.setAttribute("y1",y1.toFixed(1)); ln.setAttribute("x2",x2.toFixed(1)); ln.setAttribute("y2",y2.toFixed(1)); g.append(ln); }
    acc+=b.min*60;
    lb.append(h("span",{text:b.name+" "+b.min}));
  });
}
function elapsedNow(){ return state.elapsed + (state.startedAt ? (Date.now()-state.startedAt)/1000 : 0); }
function blockAt(t){ let acc=0; for(let i=0;i<BLOCKS.length;i++){ const len=BLOCKS[i].min*60; if(t<acc+len) return {i,left:acc+len-t,start:acc}; acc+=len; } return {i:BLOCKS.length-1,left:0,start:TOTAL-BLOCKS[BLOCKS.length-1].min*60}; }
function persist(){ LS.set("lm-timer", state); }

function renderTimer(){
  syncPlan();
  const t=Math.min(elapsedNow(), TOTAL), {i,left}=blockAt(t), b=BLOCKS[i];
  const key=planKey(), short=key==="curto", extra=!short && !isMainPlan(key) && !state.finished, running=!!state.startedAt, started=t>0||running;
  const nome = short ? "Sessão curta" : extra ? "Pomodoro extra" : "Pomodoro";
  $("#pomo").classList.toggle("compact", started && !state.finished);
  document.body.classList.toggle("running", started && !state.finished);
  $("#blockname").textContent = state.finished ? (short?"Sessão curta concluída":state.done>1?state.done+" sessões hoje":"Pomodoro concluído") : started ? (b.name+" · bloco "+(i+1)+" de "+BLOCKS.length) : nome+" de "+LANGNAME[state.lang];
  $("#clock").textContent = state.finished ? "済" : fmt(started?left:TOTAL);
  $("#total").textContent = state.finished ? "Hoje: "+minutesToday()+" min de estudo" : (started? fmt(TOTAL-t)+" restantes" : Math.round(TOTAL/60)+" min · "+BLOCKS.filter(b=>!b.rest).length+" blocos");
  const frac = state.finished ? 1 : t/TOTAL;
  $("#ring").setAttribute("stroke-dashoffset", String(100-100*frac));
  [...$("#seglabels").children].forEach((x,k)=>{ x.classList.toggle("now", started && k===i && !state.finished); x.classList.toggle("done", state.finished || (started && k<i)); });
  const podeMais=state.done<MAX_POMOS;
  $("#startBtn").textContent = state.finished ? (podeMais?(state.mainDone?"Mais um pomodoro":"Fazer o pomodoro completo"):"Concluído hoje") : running ? "Pausar" : (t>0?"Continuar":(short?"Começar sessão curta":extra?"Começar pomodoro extra":"Começar pomodoro"));
  $("#startBtn").disabled = state.finished && !podeMais;
  $("#skipBtn").disabled = state.finished || !started;
  $("#resetBtn").disabled = state.finished || !started;
  document.title = running ? fmt(left)+" · "+b.name : "Language Master";
  if(running && lastBlock!==-1 && i!==lastBlock) chime();
  lastBlock = running ? i : -1;
  // palco
  if(state.finished){ if(shownBlock!=="done"){ if(exBusy) exBusyWarned=true; else showDone(); } }
  else if(started){ if(shownBlock!==i){ const auto = shownBlock!==null && typeof shownBlock==="number";
      if(auto && exBusy && !manualSkip){ if(!exBusyWarned){ exBusyWarned=true; toast("Tempo do bloco acabou. Termine esta questão e toque em Continuar."); } }
      else { exBusyWarned=false; showBlock(i, auto); } } }
  else if(shownBlock!=="idle") showIdle();
}
function chime(){
  if(!audioCtx) return;
  try{ const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type="sine"; o.frequency.value=880; o.connect(g); g.connect(audioCtx.destination);
    const n=audioCtx.currentTime; g.gain.setValueAtTime(0.0001,n); g.gain.exponentialRampToValueAtTime(0.3,n+0.02); g.gain.exponentialRampToValueAtTime(0.0001,n+0.9); o.start(n); o.stop(n+0.95); }catch(e){}
  if(navigator.vibrate) try{ navigator.vibrate([200,100,200]); }catch(e){}
}
async function keepAwake(on){ try{ if(on && "wakeLock" in navigator && !wakeLock){ wakeLock=await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release",()=>{wakeLock=null;}); } if(!on && wakeLock){ await wakeLock.release(); wakeLock=null; } }catch(e){} }
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible" && state.startedAt) keepAwake(true); });

$("#startBtn").addEventListener("click",()=>{
  if(!audioCtx){ try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
  if(state.finished){
    if(state.done>=MAX_POMOS) return;
    if(settings.rotacao==="ambos") setLang(state.done%2 ? "ja" : "de", false);
    state.finished=false; state.short=false; state.lastPlan=null; state.elapsed=0; state.startedAt=Date.now(); keepAwake(true); syncPlan(); lastBlock=0; newSession(true); shownBlock=null;
  } else if(state.startedAt){ state.elapsed=elapsedNow(); state.startedAt=null; keepAwake(false); }
  else { if(!S || elapsedNow()===0) newSession(elapsedNow()===0); state.startedAt=Date.now(); keepAwake(true); lastBlock=blockAt(state.elapsed).i; }
  persist(); renderTimer();
});
let manualSkip=false;
function skipBlock(){
  const {i,start}=blockAt(elapsedNow());
  manualSkip=true;
  if(!state.startedAt && elapsedNow()===0) return;
  state.elapsed=Math.min(start+BLOCKS[i].min*60, TOTAL); if(state.startedAt) state.startedAt=Date.now();
  persist(); tick();
}
$("#skipBtn").addEventListener("click", skipBlock);
$("#resetBtn").addEventListener("click",()=>{ $("#resetConfirm").hidden=false; });
$("#resetNo").addEventListener("click",()=>{ $("#resetConfirm").hidden=true; });
$("#resetYes").addEventListener("click",()=>{
  $("#resetConfirm").hidden=true;
  state.elapsed=0; state.startedAt=null; state.finished=false; keepAwake(false); persist(); S=null; shownBlock=null; renderTimer();
});
function tick(){
  if(!state.finished && elapsedNow()>=TOTAL){
    const key=planKey();
    state.elapsed=TOTAL; state.startedAt=null; state.finished=true; state.done++; state.lastPlan=key; if(isMainPlan(key)) state.mainDone=true;
    keepAwake(false); chime(); persist(); finishSession(key);
    addDay(state.lang, key==="curto" ? {curtas:1, xp:15} : {pomos:1, xp:30});
  }
  renderTimer();
}
setInterval(tick, 250);
/* atalhos no computador: 1–4 escolhem a opção, Enter confere/continua */
document.addEventListener("keydown",e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.isComposing||e.keyCode===229) return;
  const tag=(e.target.tagName||"").toLowerCase(); const typing = tag==="textarea" || tag==="input" || tag==="select";
  const scope=[...document.querySelectorAll("section.stack:not([hidden]) .ex-card")].pop(); if(!scope) return;
  if(!typing && /^[1-5]$/.test(e.key)){ const opts=[...scope.querySelectorAll(".opts .opt:not([disabled])")]; const b=opts[Number(e.key)-1]; if(b){ e.preventDefault(); b.click(); } return; }
  if(e.key==="Enter" && !typing){ const c=[...scope.querySelectorAll("button.btn.primary.wide")].pop(); if(c){ e.preventDefault(); c.click(); } }
});
/* virou o dia com o app aberto: as datas de revisão mudam */
setInterval(()=>{ if(isoDay(new Date())!==TODAY && !state.startedAt) banner("Começou um novo dia: recarregue a página para ver as revisões de hoje."); }, 60000);

function minutesToday(){ return Object.values(store.sessoes).filter(s=>s.data===TODAY).reduce((a,s)=>a+(Number(s.minutos)||0),0); }
function finishSession(key){
  const n=state.done;
  const s=S||{stats:{ok:0,no:0},touched:[],errs:[]};
  saveSessao(TODAY+"-"+n, {data:TODAY, idioma:state.lang, minutos:Math.round(TOTAL/60), numero:n, extra:!isMainPlan(key), curta:key==="curto",
    blocos:BLOCKS.filter(b=>!b.rest).map(b=>({bloco:b.id,minutos:b.min})),
    acertos:s.stats.ok, erros:s.stats.no, pontos:s.touched, palavrasNovas:(s.newWords||[]).map(v=>v.id), pontoNovo:s.newPoint?s.newPoint.id:null, shadowing:s.shadowReps||0,
    concluidaEm:new Date().toISOString()});
}

/* ---------- palco (o que fazer em cada bloco) ---------- */
function toast(msg){ const t=$("#gtoast"); if(!t) return; t.textContent=msg||""; t.hidden=!msg; clearTimeout(toast.t); if(msg) toast.t=setTimeout(()=>t.hidden=true, 5000); }
function stageSet(...els){ const st=$("#stage"); st.innerHTML=""; exBusy=false; els.forEach(e=>e&&st.append(e)); }

/* dias desde o último dia estudado (qualquer idioma); null se nunca estudou */
function daysAway(){
  if(studiedOn(TODAY)) return 0;
  for(let k=1;k<=120;k++) if(studiedOn(addDays(TODAY,-k))) return k;
  return null;
}
function showIdle(){
  shownBlock="idle"; S=null;
  const l=state.lang, key=planKey(), short=key==="curto", main=isMainPlan(key);
  const np=main?nextNew(l):null, due=dueItems(l).length, plan=planFor();
  const away=daysAway(), first=!Object.keys(store.sessoes).length;
  const other=l==="ja"?"de":"ja", dueOther=dueItems(other).length;
  const pl=newVocabPlan(l,null), nNew=pl.words.length+pl.kanji.length;
  const toggleShort=on=>{ state.short=on; persist(); syncPlan(); renderTimer(); showIdle(); };
  const card=h("div",{class:"card stack"},
    h("div",{class:"row"}, h("span",{class:"eyebrow",text: short ? "Sessão curta · 10 min" : main ? "Seu pomodoro de hoje" : "Próximo pomodoro"}), h("span",{class:"spacer"}),
      state.finished ? null : h("button",{class:"linkbtn",type:"button",text: short ? "Prefiro o pomodoro completo" : "Só tenho 10 min",onclick:()=>toggleShort(!short)})),
    away!=null && away>=3 ? h("div",{class:"tip small"}, h("b",{text:"Bem-vindo de volta. "}), "Faz "+away+" dias. Sem problema: a revisão de hoje vem limitada e os itens mais antigos primeiro"+(due>35?"; palavras novas ficam em pausa até a fila baixar":"")+". "+(short?"":"Se o dia estiver corrido, a sessão curta de 10 min já conta para a sequência.")) : null,
    np ? h("div",{}, h("div",{class:"small muted",text:"Ponto novo de hoje"}), h("div",{class:"lesson-title",lang:l,style:"font-size:1.5rem",text:np.t}), h("div",{text:np.m}))
       : short ? h("p",{text:"Revisão, algumas palavras novas e um teste relâmpago. Sem aula nova: ela fica para o pomodoro completo."})
       : !main ? h("p",{text:"Pomodoro extra: sem ponto novo. Leitura, escuta, conversa e prática com o que você já viu."})
       : h("p",{text:"Você já viu todos os pontos da trilha. Os pomodoros agora focam em revisão, leitura e produção."}),
    h("div",{class:"row small"},
      h("span",{class:"chip"+(due?" s2":""),text: due ? due+" revis"+(due>1?"ões":"ão") : "sem revisões vencidas"}),
      h("span",{class:"chip",text: nNew ? nNew+" ite"+(nNew>1?"ns":"m")+" novo"+(nNew>1?"s":"") : "sem palavras novas hoje"})),
    (!learned(l).length && !(store.perfil[l]&&store.perfil[l].diagnostico)) ? h("div",{class:"tip small"}, "Primeira vez em "+LANGNAME[l]+"? Faça antes o ", h("button",{class:"linkbtn",type:"button",text:"teste de nível",onclick:()=>{ selectTab("progresso"); setTimeout(()=>{ const b=[...document.querySelectorAll("#tab-progresso button")].find(x=>/teste de nível/i.test(x.textContent)); b&&b.click(); window.scrollTo(0,0); },50); }}), " (10 min) para pular o que você já sabe.") : null,
    h("details",{open:first||null}, h("summary",{class:"small",text:"O que acontece em cada bloco"}),
      h("ul",{class:"plan"}, plan.map(b=>h("li",{}, h("span",{class:"min",text:b.min+" min"}), h("span",{}, h("b",{text:WHY[b.id][0]}), h("span",{class:"small muted",text:WHY[b.id][1]}))))),
      h("p",{class:"small muted",text:"Cada bloco abre a atividade certa aqui embaixo e o tempo muda de bloco sozinho; se terminar antes, use Próximo bloco."})),
    dueOther && !state.startedAt ? h("div",{class:"row small muted"}, h("span",{lang:other,text:(other==="ja"?"日本語":"Deutsch")+": "+dueOther+" revis"+(dueOther>1?"ões":"ão")+" esperando."}),
      h("button",{class:"linkbtn",type:"button",text:"Revisar agora",onclick:()=>{ setLang(other,true); selectTab("revisar"); window.scrollTo(0,0); }})) : null);
  stageSet(card);
}
function showDone(){
  shownBlock="done";
  const short=state.lastPlan==="curto";
  const card=h("div",{class:"card stack"},
    h("h2",{text: short ? "Sessão curta concluída" : "Pomodoro concluído"}),
    summaryView(S),
    h("p",{class:"small muted",text: state.done>=MAX_POMOS ? "Limite de "+MAX_POMOS+" sessões por dia. O que você estudou fixa melhor com intervalo."
      : short ? "Já conta para a sequência. Se sobrar tempo hoje, o pomodoro completo traz a aula nova." : "Quer mais? O próximo pomodoro tem leitura, escuta ou conversa com o que você já viu."}));
  stageSet(card);
}
function showBlock(i, auto){
  shownBlock=i;
  if(!S) newSession();
  const b=BLOCKS[i];
  if(auto && !manualSkip) toast("Tempo do bloco acabou. Agora: "+b.name+"."); else toast("");
  manualSkip=false;
  const head=h("div",{class:"row"}, h("h2",{text:WHY[b.id][0]}), h("span",{class:"spacer"}), h("span",{class:"small muted",text:b.min+" min"}));
  const intro=h("p",{class:"small muted",text:WHY[b.id][1]});
  const body=h("div",{class:"stack"});
  stageSet(head, intro, body);
  ({revisao:blockReview, aula:blockLesson, pratica:blockPractice, vocab:blockVocab, shadow:blockShadow, escuta:blockEscuta, fecha:blockClose, pausa:blockPause, input:blockReading, pratica2:blockMixed, conversa:blockConversa})[b.id](body);
}

function blockVocab(box){
  const l=S.lang, plan=newVocabPlan(l,S), list=[...plan.words, ...plan.kanji];
  if(plan.reason) box.append(h("p",{class:"small",text:plan.reason}));
  if(!list.length){
    const recent=seenOf(vocabItems(l)).slice(-12);
    box.append(h("div",{class:"card stack"},
      h("p",{text: plan.capped ? "Você já atingiu o limite de 20 palavras novas hoje: mais que isso costuma virar revisão atrasada amanhã." : (vocabItems(l).length && !nextNewOf(vocabItems(l),1).length ? "Você já viu todas as palavras da lista. Gere mais na aba Trilha > Palavras." : "Sem palavras novas agora.")}),
      recent.length ? h("button",{class:"btn primary",type:"button",text:"Praticar palavras recentes",onclick:()=>{ box.innerHTML=""; runSeq(box, shuffle(recent).map(vocabStep), r=>afterSeq(box,r,"Palavras praticadas")); }}) : null));
    return;
  }
  box.append(h("p",{class:"small muted",text:"Hoje: "+plan.words.length+" palavra"+(plan.words.length!==1?"s":"")+(plan.kanji.length?" e "+plan.kanji.length+" kanji":"")+"."}));
  learnVocab(box, list, r=>afterSeq(box,r,"Palavras de hoje aprendidas", true));
}
function blockPause(box){ box.append(h("div",{class:"card"}, h("p",{text:"Pausa de 5 minutos. Levante, alongue, beba água. Para começar já, toque em Próximo bloco."}))); }

function blockReview(box){
  const l=S.lang, due=reviewQueue(l, 8, 30);
  const iv=interventionFor(l);
  loadFresh(due.filter(p=>!p.kind));
  if(iv){
    box.append(h("p",{class:"small",text:"Primeiro: um ponto que você vem errando. Depois, as revisões do dia."}));
    runSeq(box, [...interventionSteps(iv), ...due.map(reviewStep)], r=>afterSeq(box,r,"Revisões do dia feitas", true), {requeue:true});
    return;
  }
  if(!due.length){
    const lr=learned(l);
    box.append(h("div",{class:"card stack"},
      h("p",{text: lr.length ? "Nenhuma revisão vencida hoje. Aproveite para praticar os pontos mais recentes ou adiante a aula." : "Ainda não há nada para revisar: o que você estudar hoje aparece aqui a partir de amanhã. Vá direto para a aula."}),
      h("div",{class:"row"},
        lr.length ? h("button",{class:"btn primary",type:"button",text:"Praticar pontos recentes",onclick:()=>{ box.innerHTML=""; runSeq(box, shuffle(lr.slice(-6)).map(reviewStep), r=>afterSeq(box,r,"Revisão feita")); }}) : null,
        h("button",{class:lr.length?"btn":"btn primary",type:"button",text:"Ir para a aula",onclick:skipBlock}))));
    return;
  }
  const nG=due.filter(p=>!p.kind).length, nV=due.length-nG, rest=dueItems(l).length-due.length;
  box.append(h("p",{class:"small",text:nG+" de gramática e "+nV+" de palavras/kanji, misturados."+(rest>0?" Outros "+rest+" ficam para a aba Revisar.":"")}));
  runSeq(box, due.map(reviewStep), r=>afterSeq(box,r,"Revisões do dia feitas", true), {requeue:true});
}
function afterSeq(box, r, title, offerNext){
  box.innerHTML="";
  box.append(h("div",{class:"card stack"},
    h("h3",{text:title}),
    h("p",{text:r.ok+" certo"+(r.ok!==1?"s":"")+" e "+r.no+" erro"+(r.no!==1?"s":"")+"."}),
    offerNext ? h("button",{class:"btn primary",type:"button",text:"Próximo bloco",onclick:skipBlock}) : h("p",{class:"small muted",text:"Pode seguir para o próximo bloco quando quiser."})));
}
function blockLesson(box){
  const p=S.newPoint;
  if(!p){ box.append(h("div",{class:"card"},h("p",{text:"Trilha concluída. Use este tempo para a prática mista."}))); blockMixed(box); return; }
  if(S.hold) box.append(h("p",{class:"small tip",text:"Hoje sem ponto novo: há mais de 60 revisões vencidas. A aula e a prática reforçam o último ponto; o próximo entra quando a fila baixar."}));
  box.append(lessonView(p,{onDone:()=>{ skipBlock(); }, doneLabel:"Entendi → Prática", onKnown:()=>{
    const np=nextNew(S.lang); S.newPoint=np; S.hold=false; state.pointId=np?np.id:null; state.hold=false; persist();
    box.innerHTML=""; blockLesson(box); window.scrollTo(0,0); }}));
}
function blockPractice(box){
  const p=S.newPoint;
  if(!p){ blockMixed(box); return; }
  introduce(p);
  runSeq(box, stepsForNew(p), r=>{
    box.innerHTML="";
    const more=h("div",{class:"stack"});
    box.append(h("div",{class:"card stack"},
      h("h3",{text:"Prática do ponto feita"}),
      h("p",{text:r.ok+" certo"+(r.ok!==1?"s":"")+", "+r.no+" erro"+(r.no!==1?"s":"")+"."}),
      h("div",{class:"row"},
        aiReady() ? h("button",{class:"btn primary",type:"button",text:"Mais exercícios (Claude)",onclick:()=>moreMC(p, more)}) : null,
        h("button",{class:"btn",type:"button",text:"Revisar a aula",onclick:()=>{ more.innerHTML=""; more.append(lessonView(p)); }}),
        h("button",{class:"btn ghost",type:"button",text:"Próximo bloco",onclick:skipBlock}))), more);
  });
}
async function moreMC(p, box){
  box.innerHTML=""; const w=h("p",{class:"small muted",text:"O professor está preparando exercícios novos…"}); box.append(w);
  try{
    const qs=await genMC(p,4); w.remove();
    if(!qs.length) throw {code:"invalid_json"};
    runSeq(box, qs.map(q=>d=>exMC(p,q,d,"Gerado pelo Claude")), r=>{ box.innerHTML=""; box.append(h("div",{class:"card"},h("p",{text:"Mais "+r.ok+" certo(s) e "+r.no+" erro(s)."}), h("div",{class:"row",style:"margin-top:8px"}, h("button",{class:"btn",type:"button",text:"Outra rodada",onclick:()=>moreMC(p,box)})))); });
  }catch(e){ w.textContent=aiError(e)||""; }
}
function shadowList(){
  const l=S.lang, list=[];
  if(S.newPoint) S.newPoint.x.forEach(x=>list.push({p:S.newPoint,x}));
  learned(l).filter(p=>!S.newPoint || p.id!==S.newPoint.id).slice(-3).reverse().forEach(p=>list.push({p,x:pick(p.x)}));
  (S.newWords||[]).filter(v=>v.kind==="vocab").slice(0,2).forEach(v=>list.push({p:v,x:v.ex}));
  if(!list.length) C[l].points.slice(0,2).forEach(p=>list.push({p,x:p.x[0]}));
  return list;
}
function blockShadow(box){
  const l=S.lang;
  let rate=0.8, hidden=false;
  const counter=h("b",{text:"0"});
  const speeds=h("div",{class:"speeds",role:"group","aria-label":"Velocidade"});
  [["0.7","0,7×"],["0.8","0,8×"],["1","1×"]].forEach(([v,t])=>speeds.append(h("button",{type:"button","aria-pressed":String(Number(v)===rate),text:t,onclick:e=>{ rate=Number(v); speeds.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===e.currentTarget))); }})));
  const listBox=h("div",{class:"card"});
  const hideCb=h("input",{type:"checkbox",id:"sh-hide",onchange:e=>{ hidden=e.target.checked; listBox.classList.toggle("sh-hidden",hidden); }});
  box.append(h("div",{class:"card stack"},
    h("p",{class:"small",text:"Toque em ×5: a frase toca 5 vezes com pausa. Fale junto, colado na voz, sem esperar terminar. Na 2ª rodada, esconda o texto."}),
    h("div",{class:"row"}, speeds, h("label",{class:"row small",style:"gap:6px"}, hideCb, "Esconder texto"), h("span",{class:"spacer"}), h("span",{class:"small"},"Repetições: ",counter))));
  let shId=0;
  shadowList().forEach(({p,x})=>{
    const say=sayOf(l,x[0],x[1]);
    const status=h("span",{class:"small muted"});
    listBox.append(h("div",{class:"sh-item"},
      h("div",{class:"sh-text",lang:l,text:clean(x[0])}),
      l==="ja" ? h("div",{class:"kana small",lang:"ja",text:x[1]}) : null,
      h("div",{class:"pt small",text:x[2]}),
      h("div",{class:"row"},
        h("button",{class:"btn small",type:"button",text:"▶ 1×",onclick:()=>{ const my=++shId; speak(say,l,{rate,stop:()=>my!==shId,onrep:()=>{ if(my!==shId) return; S.shadowReps++; counter.textContent=S.shadowReps; }}); }}),
        h("button",{class:"btn small primary",type:"button",text:"× 5",onclick:()=>{ const my=++shId; speak(say,l,{rate,times:5,gap:1600,stop:()=>my!==shId,onrep:n=>{ if(my!==shId) return; S.shadowReps++; counter.textContent=S.shadowReps; status.textContent=n+"/5"; }}); }}),
        h("button",{class:"btn small ghost",type:"button",text:"Parar",onclick:()=>{ shId++; status.textContent=""; try{ speechSynthesis.cancel(); }catch(e){} }}),
        status)));
  });
  box.append(listBox, h("p",{class:"small muted",text:"Gravar a própria voz não funciona dentro do Claude (o navegador bloqueia o microfone aqui). Para se ouvir, use o gravador do celular em paralelo."}));
}
function summaryView(s){
  if(!s) return h("p",{class:"muted",text:"Sessão registrada."});
  const l=s.lang;
  const box=h("div",{class:"stack"});
  box.append(h("div",{class:"stats"},
    h("div",{class:"stat"},h("b",{text:s.stats.ok}),h("span",{text:"acertos"})),
    h("div",{class:"stat"},h("b",{text:s.stats.no}),h("span",{text:"erros"})),
    h("div",{class:"stat"},h("b",{text:s.shadowReps||0}),h("span",{text:"repetições de shadowing"}))));
  if(s.newPoint){ const it=getItem(s.newPoint); box.append(h("p",{}, "Ponto novo: ", h("b",{lang:l,text:s.newPoint.t}), it ? " · volta em "+brDate(it.vence) : "")); }
  if(s.newWords && s.newWords.length) box.append(h("p",{}, "Palavras novas: ", h("span",{lang:l,text:s.newWords.map(v=>v.t).join(l==="ja"?"、":", ")})));
  if(s.errs.length){
    box.append(h("h3",{text:"Erros de hoje (voltam na revisão)"}));
    const ul=h("ul",{class:"errlist"});
    s.errs.slice(-6).forEach(e=>ul.append(h("li",{}, h("span",{class:"wrong",lang:l,text:e.wrong}), h("br"), h("strong",{lang:l,text:e.right}), h("div",{class:"small muted",text:e.p.t}))));
    box.append(ul);
  } else if(s.stats.ok) box.append(h("p",{class:"small",text:"Nenhum erro registrado nesta sessão."}));
  const tomorrow=Object.values(store.items[l]).filter(it=>it.vence===addDays(TODAY,1)).length;
  box.append(h("p",{class:"small muted",text:"Amanhã: "+tomorrow+" ite"+(tomorrow!==1?"ns":"m")+" para revisar."}));
  return box;
}
function blockClose(box){
  const items=[...(S.newPoint && getItem(S.newPoint) ? [S.newPoint] : []), ...(S.newWords||[])].slice(0,10);
  const summary=()=>{ box.innerHTML=""; box.append(h("div",{class:"card stack"}, summaryView(S), h("p",{class:"small muted",text:"Leia os erros em voz alta na forma certa. A sessão é salva sozinha quando o tempo acabar."}))); };
  if(!items.length){ summary(); return; }
  box.append(h("p",{class:"small",text:items.length+" ite"+(items.length>1?"ns":"m")+" de hoje, uma pergunta cada."}));
  runSeq(box, shuffle(items).map(p=> p.kind ? (d=> p.kind==="kanji" ? KEX.meaning(p,d) : (Math.random()<0.5 ? VEX.listen(p,d) : VEX.reverse(p,d))) : grammarMCStep(p,"Relâmpago")), summary);
}
function blockConversa(box){ box.append(conversaView(S.lang)); }
function blockMixed(box){
  const l=S.lang, lr=learned(l);
  if(!lr.length){ box.append(h("div",{class:"card"},h("p",{text:"Ainda não há pontos estudados para misturar. Faça primeiro um pomodoro com aula."}))); return; }
  const pool=shuffle(lr).slice(0,8);
  runSeq(box, pool.map(reviewStep), r=>afterSeq(box,r,"Prática mista feita"));
}
function blockReading(box){
  const l=S.lang, lvl=courseLevel(l), lidos=(store.perfil[l].textos)||{};
  const cand=C[l].readings.filter(t=>!lidos[t.id]);
  const t=cand.find(t=>t.lvl===lvl) || cand[0];
  if(t){ box.append(textView(l,t,{})); }
  if(aiReady()){ box.append(h("h3",{text: t ? "Ou gere um texto novo" : "Texto novo do dia"}), readerView(l)); }
  else if(!t){ box.append(textsView(l)); }
}

/* =========================================================
   Aba Trilha
   ========================================================= */
let trilhaView=null; // {pointId} ou {testUnit}
let trilhaSeg="gram";
function segControl(l){
  const segs=[["gram","Blocos"],["vocab","Palavras"], ...(l==="ja"?[["kanji","Kanji"]]:[])];
  if(!segs.find(x=>x[0]===trilhaSeg)) trilhaSeg="gram";
  const bar=h("div",{class:"segctl",role:"tablist","aria-label":"Trilhas"});
  segs.forEach(([k,t])=>bar.append(h("button",{type:"button",role:"tab","aria-selected":String(trilhaSeg===k),text:t,onclick:()=>{ trilhaSeg=k; renderTrilha(); }})));
  return bar;
}
function renderTrilha(){
  const box=$("#tab-trilha"); box.innerHTML="";
  const l=state.lang;
  if(trilhaView && trilhaView.pointId){ renderPointPage(box, C[l].byId[trilhaView.pointId]); return; }
  if(trilhaView && trilhaView.testUnit){ renderUnitTest(box, C[l].unitById[trilhaView.testUnit]); return; }
  if(trilhaView && trilhaView.learn){ renderLearnPage(box, l, trilhaView.learn); return; }
  if(trilhaView && trilhaView.wordTest){ renderWordTest(box, l, trilhaView.wordTest.seg, trilhaView.wordTest.lvl); return; }
  if(trilhaView && trilhaView.marco){ renderMarco(box, l, trilhaView.marco); return; }
  box.append(h("div",{class:"sechead"}, h("h1",{text:"Trilha"}), h("span",{class:"jp",text:"道"})), segControl(l));
  if(trilhaSeg!=="gram"){ renderWordTrack(box, l, trilhaSeg); return; }
  const tot=C[l].points.length, seen=learned(l).length, cur=courseLevel(l);
  box.append(h("div",{class:"card stack"},
    h("h2",{text: l==="ja" ? "N3 (revisão) → fim do N2" : "A2 → B1 → B2"}),
    h("p",{class:"small",text:"Cada bloco tem 5 pontos de gramática e as palavras"+(l==="ja"?" e kanji":"")+" do mesmo nível. Um bloco fica concluído quando os pontos foram vistos e o conjunto chega a 75 % de domínio (memória estável por cerca de 3 semanas). Já sabe? Teste o bloco ou o nível inteiro e pule."}),
    h("div",{class:"small muted",text:seen+" de "+tot+" pontos de gramática já vistos · nível atual: "+cur})));
  const np=nextNew(l);
  LVL_ORDER[l].forEach(lvl=>{
    const us=C[l].units.filter(u=>u.lvl===lvl), done=levelDone(l,lvl), pr=levelProgress(l,lvl);
    const mc=(store.perfil[l].marcos||{})[lvl];
    const list=h("div",{class:"card"});
    list.append(h("div",{class:"levelhead"}, h("span",{class:"lv",text:lvl}),
      h("div",{style:"flex:1;min-width:0"}, h("div",{class:"bar"}, h("i",{style:`width:${pr*100}%;background:var(--accent)`})), h("div",{class:"small muted num",style:"margin-top:4px",text:Math.round(pr*100)+"% do nível · "+us.filter(unitDone).length+" de "+us.length+" blocos concluídos"})),
      done ? h("span",{class:"stamp",title:"Nível concluído",text:"合格"}) : null),
      h("div",{class:"row",style:"margin:8px 0 12px"},
        h("button",{class:"btn small"+(lvl===cur?" primary":""),type:"button",text: mc&&mc.passou ? "Refazer exame "+lvl : "Exame do nível "+lvl+" (pular o nível)",onclick:()=>{ trilhaView={marco:lvl}; renderTrilha(); window.scrollTo(0,0); }}),
        mc ? h("span",{class:"small muted",text:"Último exame: "+mc.nota+"% em "+brDate(mc.data)}) : null));
    us.forEach(u=>{
      const ui=C[l].units.indexOf(u), bi=blockInfo(u), isCur=np && np.u===u.id, ud=unitDone(u), up=unitProgress(u);
      const started=u.points.some(p=>{ const it=getItem(p); return it && it.estado>=2; });
      const meter=(label,a,n)=> n ? h("div",{class:"bmeter"}, h("span",{class:"small",text:label}), h("div",{class:"bar"}, h("i",{style:`width:${a/n*100}%;background:var(--ok)`})), h("span",{class:"small muted",text:a+"/"+n})) : null;
      const ul=h("ul",{class:"points"});
      u.points.forEach(p=>{ const it=getItem(p), e=it?it.estado:1;
        ul.append(h("li",{}, h("button",{type:"button",onclick:()=>{ trilhaView={pointId:p.id}; renderTrilha(); window.scrollTo(0,0); }},
          h("span",{class:"pt-name"}, h("span",{lang:l,text:p.t}), h("small",{text:p.m})),
          h("span",{class:"chip s"+e,text:ESTADO[e]})))); });
      const wl=h("div",{class:"chips small",lang:l}, u.words.map(v=>{ const it=getItem(v), e=it?it.estado:1; return h("span",{class:"wchip s"+e,title:v.m+" · "+ESTADO[e],text:v.t}); }));
      const kl=u.kanjis.length ? h("div",{class:"chips",lang:"ja"}, u.kanjis.map(v=>{ const it=getItem(v), e=it?it.estado:1; return h("span",{class:"wchip s"+e,title:v.m+" · "+ESTADO[e],text:v.k}); })) : null;
      list.append(h("div",{class:"unit"+(isCur?" current":"")+(ud?" done":started?" started":"")},
        h("div",{class:"unit-head"}, h("span",{class:"dot",text:ud?"✓":String(ui+1)}),
          h("div",{style:"flex:1;min-width:0"}, h("h3",{text:u.t}), h("div",{class:"small muted",lang:l,text:u.d})),
          h("span",{class:"small muted num",text:Math.round(up*100)+"%"})),
        h("div",{style:"margin:8px 0 0 52px"},
          meter("Gramática",bi.g,u.points.length), meter("Palavras",bi.w,u.words.length), meter("Kanji",bi.k,u.kanjis.length),
          ud ? null : h("button",{class:"btn small"+(isCur?" primary":""),type:"button",style:"margin:8px 0 4px",text:"Testar o bloco ("+u.points.length+" gramática + "+Math.min(5,u.words.length)+" palavras"+(u.kanjis.length?" + "+Math.min(3,u.kanjis.length)+" kanji":"")+")",onclick:()=>{ trilhaView={testUnit:u.id}; renderTrilha(); window.scrollTo(0,0); }}),
          h("details",{}, h("summary",{class:"small",text:"Ver conteúdo do bloco"}), ul,
            h("div",{class:"small muted",style:"margin:8px 0 4px",text:"Palavras (cor = já reconhecida)"}), wl,
            kl ? h("div",{class:"small muted",style:"margin:8px 0 4px",text:"Kanji"}) : null, kl))));
    });
    box.append(list);
  });
}
/* Exame do nível: 20 pontos de gramática sorteados + 10 palavras (+ 5 kanji) + 3 de escuta.
   Passou com 85 %: o nível fica concluído e os pontos entram na revisão espaçados em 4 semanas. */
function renderMarco(box, l, lvl){
  box.append(backBtn());
  const pts=shuffle(C[l].points.filter(p=>p.lvl===lvl)).slice(0,20);
  const ws=shuffle(vocabItems(l).filter(v=>v.lvl===lvl && !v.gen)).slice(0,10);
  const ks=l==="ja" ? shuffle(kanjiItems(l).filter(k=>k.lvl===lvl)).slice(0,5) : [];
  const pool=[]; C[l].points.filter(p=>p.lvl===lvl).forEach(p=>p.x.forEach(x=>pool.push({p,text:x[0],kana:x[1],pt:x[2]})));
  const ls=shuffle(pool).slice(0,3);
  const total=pts.length+ws.length+ks.length+ls.length;
  box.append(h("div",{class:"card stack"}, h("h2",{text:"Exame do nível "+lvl}),
    h("p",{class:"small",text:total+" questões: gramática, palavras"+(ks.length?", kanji":"")+" e escuta. Passando com 85 %, o nível inteiro fica concluído e os pontos entram na revisão aos poucos para confirmar. Use \"Não sei\" em vez de chutar."})));
  const area=h("div",{class:"stack"}); box.append(area);
  let ok=0, n=0; const gOk=new Set(), wOk=new Set();
  const tag=()=>"Exame "+lvl+" · "+Math.min(++n,total)+" de "+total;
  const idk=(card,done,comp,d)=>{ card.querySelector(".opts").append(h("button",{class:"opt idk",type:"button",text:"Não sei",onclick:()=>{ eloUpdate(l,comp,d,false,"exame"); done(false); }})); return card; };
  const steps=[
    ...pts.map(p=>done=>idk(exMC(p,pick(okQs(p)),done,tag(),r=>{ eloUpdate(l,"gramatica",DIFF[lvl]||250,r,"exame"); if(r){ ok++; gOk.add(p.id); autoNext(area); } }),done,"gramatica",DIFF[lvl])),
    ...[...ws,...ks].map(v=>done=>idk(exVChoice(v,{tag:tag(), kind:v.kind==="kanji"?"kmc":"vmc", prompt: v.kind==="kanji" ? h("div",{class:"prompt center"}, h("span",{class:"kanji-big",lang:"ja",text:v.k})) : h("div",{class:"prompt center"}, artChip(v), h("span",{class:"word-big",lang:l,text:v.w})),
      right:v.m, wrong:distract(v,o=>o.m,3), onAnswer:r=>{ eloUpdate(l,v.kind==="kanji"?"kanji":"vocabulario",DIFF[lvl]||250,r,"exame"); if(r){ ok++; wOk.add(v.id); autoNext(area); } }},done),done,"vocabulario",DIFF[lvl])),
    ...ls.map(it=>done=>{ tag(); return exListen(l,it,pool,r=>{ if(r) ok++; done(r); }); })
  ];
  runSeq(area, steps, ()=>{
    const pct=Math.round(ok/total*100), pass=pct>=85;
    const pf=store.perfil[l]; pf.marcos=pf.marcos||{}; pf.marcos[lvl]={data:TODAY, nota:pct, passou: pass || !!(pf.marcos[lvl]&&pf.marcos[lvl].passou)}; savePerfil(l);
    let marked=0;
    if(pass){
      const all=C[l].points.filter(p=>p.lvl===lvl);
      all.forEach((p,i)=>{ if(markKnown(p, gOk.has(p.id)?4:3, Math.floor(i*27/Math.max(1,all.length)))) marked++; });
      ws.forEach((v,i)=>{ if(wOk.has(v.id)) markKnown(v,3,i%7); });
      addXP(l,150);
    }
    area.innerHTML="";
    area.append(h("div",{class:"card stack"},
      h("div",{class:"row"}, pass?h("span",{class:"stamp",text:"合格"}):null, h("h3",{text: pass ? "Nível "+lvl+" concluído" : "Ainda não foi desta vez"})),
      h("p",{text:"Resultado: "+pct+"% ("+ok+" de "+total+")."}),
      h("p",{class:"small",text: pass ? marked+" pontos de gramática entraram na revisão, espaçados nas próximas 4 semanas. Se algum não estiver firme, a revisão devolve ele para estudo. +150 XP." : "Para passar são 85 %. Siga a trilha normalmente; o que você acertou já ajuda a estimar seu nível."}),
      backBtn()));
    reveal(area.firstChild);
  });
}
function renderWordTrack(box, l, seg){
  const list = seg==="kanji" ? kanjiItems(l) : vocabItems(l);
  const seen=seenOf(list), firm=list.filter(v=>{ const it=getItem(v); return it && it.estado>=6; });
  const gm=genMsg[l+"-"+seg];
  const st=h("div",{class:"status"+(gm?" "+gm.cls:""),role:"status",id:"genStatus",text:gm?gm.text:""});
  const head=h("div",{class:"card stack"},
    h("h2",{text: seg==="kanji" ? "Kanji N3 → N2" : (l==="ja"?"Vocabulário N3 → N2":"Vocabulário A2 → B1")}),
    h("p",{class:"small",text: seg==="kanji"
      ? "Cada kanji com leituras on e kun, significado e duas palavras frequentes. Kanji entram junto com as palavras no bloco Palavras do pomodoro (2 por dia)."
      : "Palavras em ordem de utilidade, cada uma com leitura, exemplo e áudio"+(l==="de"?", artigo por cor e plural (ou Perfekt, nos verbos)":"")+". O pomodoro traz de 8 a 10 por dia; o exercício fica mais difícil conforme você acerta: reconhecer, ouvir e, por fim, lembrar sem pista."}),
    h("div",{class:"small muted",text:seen.length+" de "+list.length+" vistos · "+firm.length+" firmes"}),
    h("div",{class:"row"},
      h("button",{class:"btn primary",type:"button",text:"Estudar próximas agora",onclick:()=>{ trilhaView={learn:seg}; renderTrilha(); window.scrollTo(0,0); }}),
      seg!=="kanji" && aiReady() ? h("button",{class:"btn",type:"button",text:"Gerar mais 20 palavras (Claude)",onclick:e=>{ e.currentTarget.disabled=true; genVocab(l, st); }}) : null,
      seg==="kanji" && aiReady() ? h("button",{class:"btn",type:"button",text:"Gerar mais 10 kanji (Claude)",onclick:e=>{ e.currentTarget.disabled=true; genKanji(st); }}) : null),
    st);
  box.append(head);
  const byLvl={}; list.forEach(v=>(byLvl[v.lvl]=byLvl[v.lvl]||[]).push(v));
  const card=h("div",{class:"card"});
  Object.keys(byLvl).forEach(lvl=>{
    const vs=byLvl[lvl], n=vs.length, c=[0,0,0];
    vs.forEach(v=>{ const e=(getItem(v)||{estado:1}).estado; if(e>=6) c[0]++; else if(e>=4) c[1]++; else if(e>=2) c[2]++; });
    const ul=h("ul",{class:"points"});
    vs.forEach(v=>{ const it=getItem(v), e=it?it.estado:1;
      ul.append(h("li",{}, h("div",{class:"wrow"},
        h("span",{class:"pt-name"}, h("span",{lang:l}, artChip(v), " ", v.kind==="kanji"?v.k:v.w, v.gen?h("small",{style:"display:inline;margin-left:6px",text:"· gerada"}):null),
          h("small",{lang:l,text:(v.kind==="kanji" ? v.on+" · "+v.kun+" — " : (l==="ja" ? v.r+" — " : ""))+v.m})),
        iconBtn("play","Ouvir",()=>speak(vSay(v),l,{rate:0.9})),
        h("span",{class:"chip s"+e,text:ESTADO[e]})))); });
    card.append(h("div",{class:"unit"},
      h("div",{class:"unit-head"}, h("span",{class:"lvl",text:lvl}), h("h3",{text:(c[0]+c[1]+c[2])+" de "+n+" vistos"})),
      h("div",{class:"bar",style:"margin-top:6px"}, h("i",{style:`width:${c[0]/n*100}%;background:var(--ok)`}), h("i",{style:`width:${c[1]/n*100}%;background:var(--accent)`}), h("i",{style:`width:${c[2]/n*100}%;background:var(--accent-soft)`})),
      h("details",{}, h("summary",{class:"small",text:"Ver lista ("+n+")"}), ul),
      (n-(c[0]+c[1]+c[2])) ? h("button",{class:"btn small",type:"button",style:"margin-top:6px",text:"Já sei "+(seg==="kanji"?"kanji":"palavras")+" deste nível: testar 20",onclick:()=>{ trilhaView={wordTest:{seg,lvl}}; renderTrilha(); window.scrollTo(0,0); }}) : null));
  });
  box.append(card);
}
function renderLearnPage(box, l, seg){
  box.append(backBtn());
  const list = seg==="kanji" ? nextNewOf(kanjiItems(l),4) : nextNewOf(vocabItems(l),8);
  const area=h("div",{class:"stack"}); box.append(area);
  if(!list.length){ area.append(h("div",{class:"card"},h("p",{text:"Nada novo nesta trilha. "+(seg!=="kanji"?"Gere mais palavras na tela anterior.":"")}))); return; }
  learnVocab(area, list, r=>{ area.innerHTML=""; area.append(h("div",{class:"card stack"}, h("h3",{text:"Feito"}), h("p",{text:r.ok+" certo(s), "+r.no+" erro(s). Elas voltam na revisão de amanhã."}), backBtn())); });
}
function backBtn(){ return h("button",{class:"btn small ghost",type:"button",style:"align-self:flex-start",text:"← Trilha",onclick:()=>{ trilhaView=null; renderTrilha(); }}); }
function renderPointPage(box, p){
  box.append(backBtn());
  const practice=h("div",{class:"stack"});
  box.append(lessonView(p,{onDone:()=>{
    practice.innerHTML="";
    runSeq(practice, stepsForNew(p), r=>{ practice.innerHTML=""; practice.append(h("div",{class:"card stack"}, h("h3",{text:"Prática feita"}), h("p",{text:r.ok+" certo(s), "+r.no+" erro(s)."}), h("div",{class:"row"}, backBtn(), aiReady()?h("button",{class:"btn",type:"button",text:"Mais exercícios (Claude)",onclick:()=>moreMC(p,practice)}):null))); });
  }, doneLabel:"Praticar este ponto", onKnown:()=>{ const n=nextNew(p.lang); trilhaView= n?{pointId:n.id}:null; renderTrilha(); window.scrollTo(0,0); }}), practice);
}
/* Marca como já sabido sem nunca rebaixar: se o item já está num estado igual ou
   maior, nada muda (nem a curva nem a data de revisão). */
function markKnown(p, level, offset){
  const it=ensureItem(p);
  if(it.estado>=level && it.S) return false;
  const fresh = it.estado<2 || !it.S;
  it.estado=Math.max(it.estado, level);
  if(fresh){
    it.S = level>=4 ? 5 : 2.5; it.D = it.D || 5; it.fsrs=6; it.ultRev=TODAY; it.reps=Math.max(it.reps||0,1);
    it.intervalo=Math.max(1, Math.round(it.S)+(offset||0)); it.vence=addDays(TODAY, it.intervalo);
  }
  it.mod=Date.now(); saveItem(it);
  return true;
}
const TEST_LABEL={4:["s4","Compreende · revisão em alguns dias"],3:["s3","Reconhece · revisão em 2 dias"],0:["s2","será ensinado"],keep:["s6","já estava mais avançado"]};
function blockInfo(u){
  const known=list=>list.filter(v=>{ const it=getItem(v); return it && it.estado>=3; }).length;
  const seen=list=>list.filter(v=>{ const it=getItem(v); return it && it.estado>=2; }).length;
  const st=(store.perfil[state.lang]&&store.perfil[state.lang].blocos||{})[u.id];
  return {g:known(u.points), gs:seen(u.points), w:known(u.words), ws:seen(u.words), k:known(u.kanjis), ks:seen(u.kanjis), passou: !!(st&&st.passou), teste: st||null};
}
/* Teste do bloco: 5 gramática (com segunda chance) + 5 palavras (+ 3 kanji).
   Passou (≥ 4/5 na gramática, ≥ 4/5 nas palavras, ≥ 2/3 nos kanji): o bloco inteiro fica como
   já sabido — gramática como Compreende, palavras e kanji como Reconhece, com revisões espalhadas
   em 3 semanas para confirmar. Não passou: só o que você acertou é marcado.
   Cada resposta é salva na hora e nada que você já tinha é rebaixado. */
function renderUnitTest(box, u){
  const l=state.lang, idx=C[l].units.indexOf(u);
  const pickSome=(list,n)=>{ const fresh=list.filter(v=>{ const it=getItem(v); return !it || it.estado<3; }); return shuffle(fresh.length>=n?fresh:list).slice(0,n); };
  const words=pickSome(u.words,5), kanjis=l==="ja"?pickSome(u.kanjis,3):[];
  box.append(backBtn(), h("div",{class:"card stack"},
    h("h2",{text:"Teste do bloco "+(idx+1)+": "+u.t}),
    h("p",{class:"small",text:u.points.length+" perguntas de gramática, "+words.length+" palavras"+(kanjis.length?" e "+kanjis.length+" kanji":"")+". Passando (4 de 5 em cada parte"+(kanjis.length?", 2 de 3 nos kanji":"")+"), o bloco inteiro fica marcado como já sabido e entra na revisão aos poucos. Não sabe? Toque em \"Não sei\" em vez de chutar. Cada resposta é salva na hora."})));
  const area=h("div",{class:"stack"}); box.append(area);
  const g={}, w={}, k={};
  const total=()=>u.points.length+words.length+kanjis.length;
  let asked=0;
  const tag=()=>"Teste · "+Math.min(++asked,total())+" de "+total();
  const steps=[];
  u.points.forEach((p,i)=>{
    const q1=pick(okQs(p));
    const f=done=>{
      const card=exMC(p,q1,done,tag(),ok=>{
        eloUpdate(l,"gramatica",DIFF[p.lvl]||250,ok,"teste");
        if(ok){ g[p.id]=4; markKnown(p,4,i%4); autoNext(area); return; }
        const others=okQs(p).filter(q=>q!==q1);
        const f2=d2=>exMC(p,pick(others.length?others:p.q),d2,"Segunda chance",ok2=>{
          eloUpdate(l,"gramatica",DIFF[p.lvl]||250,ok2,"teste");
          if(ok2){ g[p.id]=3; markKnown(p,3); autoNext(area); } else g[p.id]=0;
        });
        steps.splice(steps.indexOf(f)+1,0,f2);
      });
      card.querySelector(".opts").append(h("button",{class:"opt idk",type:"button",text:"Não sei",onclick:()=>{ g[p.id]=0; eloUpdate(l,"gramatica",DIFF[p.lvl]||250,false,"teste"); done(false); }}));
      return card;
    };
    steps.push(f);
  });
  const vocabStepT=(v,store_,kind,comp)=>done=>{
    const prompt = v.kind==="kanji" ? h("div",{class:"prompt center"}, h("span",{class:"kanji-big",lang:"ja",text:v.k}))
                                    : h("div",{class:"prompt center"}, artChip(v), h("span",{class:"word-big",lang:l,text:v.w}));
    const card=exVChoice(v,{tag:tag(), kind, prompt, right:v.m, wrong:distract(v,o=>o.m,3),
      onAnswer:ok=>{ store_[v.id]=ok; eloUpdate(l,comp,DIFF[v.lvl]||250,ok,"teste"); if(ok){ markKnown(v,3,Math.floor(Math.random()*5)); autoNext(area); } }}, done);
    card.querySelector(".opts").append(h("button",{class:"opt idk",type:"button",text:"Não sei",onclick:()=>{ store_[v.id]=false; eloUpdate(l,comp,DIFF[v.lvl]||250,false,"teste"); done(false); }}));
    return card;
  };
  words.forEach(v=>steps.push(vocabStepT(v,w,"vmc","vocabulario")));
  kanjis.forEach(v=>steps.push(vocabStepT(v,k,"kmc","kanji")));
  runSeq(area, steps, ()=>{
    const gOk=u.points.filter(p=>g[p.id]>0).length, wOk=words.filter(v=>w[v.id]).length, kOk=kanjis.filter(v=>k[v.id]).length;
    const pass = gOk>=Math.ceil(u.points.length*0.8) && wOk>=Math.ceil(words.length*0.8) && (!kanjis.length || kOk>=kanjis.length-1);
    let extraW=0, extraK=0;
    if(pass){
      u.words.forEach((v,i)=>{ if(w[v.id]===false) return; if(markKnown(v,3,2+Math.floor(i*18/Math.max(1,u.words.length)))) extraW++; });
      u.kanjis.forEach((v,i)=>{ if(k[v.id]===false) return; if(markKnown(v,3,2+Math.floor(i*18/Math.max(1,u.kanjis.length)))) extraK++; });
    }
    const pf=store.perfil[l]; if(pf){ pf.blocos=pf.blocos||{}; pf.blocos[u.id]={data:TODAY, passou:pass, gramatica:gOk+"/"+u.points.length, palavras:wOk+"/"+words.length, kanji:kOk+"/"+kanjis.length}; savePerfil(l); }
    area.innerHTML="";
    const lab=v=> v===4?["s4","Compreende"]: v===3?["s3","Reconhece"]:["s2","será ensinado"];
    const next=C[l].units[idx+1];
    area.append(h("div",{class:"card stack"},
      h("h3",{text: pass ? "✓ Bloco reconhecido" : "Bloco ainda não reconhecido"}),
      h("p",{text:"Gramática "+gOk+"/"+u.points.length+" · palavras "+wOk+"/"+words.length+(kanjis.length?" · kanji "+kOk+"/"+kanjis.length:"")+"."}),
      pass ? h("p",{class:"small",text:"Marquei como já sabido o bloco inteiro: "+u.points.length+" pontos de gramática, "+(extraW)+" palavras"+(kanjis.length?" e "+extraK+" kanji":"")+" a mais do que você respondeu. Eles voltam na revisão espalhados nas próximas 3 semanas; se algum não estiver firme, a revisão devolve ele para estudo."})
           : h("p",{class:"small",text:"Só o que você acertou foi marcado. O resto entra pela aula e pelo bloco Palavras do pomodoro."}),
      h("ul",{class:"errlist"}, u.points.map(p=>{ const lb=lab(g[p.id]); return h("li",{}, h("span",{lang:l,text:p.t}), " ", h("span",{class:"chip "+lb[0],text:lb[1]})); })),
      h("div",{class:"row"},
        next ? h("button",{class:"btn primary",type:"button",text:"Testar o bloco "+(idx+2),onclick:()=>{ trilhaView={testUnit:next.id}; renderTrilha(); window.scrollTo(0,0); }}) : null,
        backBtn())));
    reveal(area.firstChild);
  });
}
/* teste rápido de palavras / kanji: próximo bloco de itens ainda novos de um nível */
function renderWordTest(box, l, seg, lvl){
  box.append(backBtn());
  const pool=(seg==="kanji"?kanjiItems(l):vocabItems(l)).filter(v=>v.lvl===lvl);
  const list=pool.filter(v=>{ const it=getItem(v); return !it || it.estado<2; }).slice(0,20);
  const head=h("div",{class:"card stack"},
    h("h2",{text:"Já sei estas "+(seg==="kanji"?"kanji":"palavras")+" · "+lvl}),
    h("p",{class:"small",text:"Até 20 itens ainda novos, na ordem da trilha. Acertou: o item fica como Reconhece e entra na revisão (lá ele é cobrado de formas mais difíceis). Não sabe: toque em \"Não sei\" em vez de chutar; ele continua como novo. Cada resposta é salva na hora."}));
  box.append(head);
  const area=h("div",{class:"stack"}); box.append(area);
  if(!list.length){ area.append(h("div",{class:"card"},h("p",{text:"Não há mais itens novos neste nível."}))); return; }
  let ok=0, i=0;
  const steps=list.map((v,k)=>done=>{
    i=k+1;
    const card = v.kind==="kanji"
      ? exVChoice(v,{tag:"Teste · "+i+" de "+list.length, kind:"kmc", prompt:h("div",{class:"prompt center"}, h("span",{class:"kanji-big",lang:"ja",text:v.k})), right:v.m, wrong:distract(v,o=>o.m,3), onAnswer:r=>{ eloUpdate(l,"kanji",DIFF[v.lvl]||250,r,"teste"); if(r){ ok++; markKnown(v,3,k%5); autoNext(area); } }}, done)
      : exVChoice(v,{tag:"Teste · "+i+" de "+list.length, kind:"vmc", prompt:h("div",{class:"prompt center"}, artChip(v), h("span",{class:"word-big",lang:l,text:v.w})), right:v.m, wrong:distract(v,o=>o.m,3), onAnswer:r=>{ eloUpdate(l,"vocabulario",DIFF[v.lvl]||250,r,"teste"); if(r){ ok++; markKnown(v,3,k%5); autoNext(area); } }}, done);
    card.querySelector(".opts").append(h("button",{class:"opt idk",type:"button",text:"Não sei",onclick:()=>{ eloUpdate(l,seg==="kanji"?"kanji":"vocabulario",DIFF[v.lvl]||250,false,"teste"); done(false); }}));
    return card;
  });
  runSeq(area, steps, ()=>{
    area.innerHTML="";
    area.append(h("div",{class:"card stack"}, h("h3",{text:ok+" de "+list.length+" marcados como Reconhece"}),
      h("p",{class:"small muted",text:"Os demais continuam como novos e entram no bloco Palavras, 8 a 10 por dia."}),
      h("div",{class:"row"}, h("button",{class:"btn primary",type:"button",text:"Testar mais 20",onclick:()=>{ trilhaView={wordTest:{seg,lvl}}; renderTrilha(); window.scrollTo(0,0); }}), backBtn())));
  });
}

/* =========================================================
   Aba Praticar (conversa e leitura)
   ========================================================= */
let praticarSeg="leitura"; const praticarCache={};
function renderPraticar(){
  const box=$("#tab-praticar"), l=state.lang;
  box.innerHTML="";
  box.append(h("div",{class:"sechead"}, h("h1",{text:"Praticar"}), h("span",{class:"jp",text:"稽古"})));
  const bar=h("div",{class:"segctl",role:"tablist","aria-label":"Praticar"});
  [["leitura","Leitura"],["poemas","Poemas"],["escuta","Escuta"],["trajeto","Trajeto"],["conversa","Conversa"]].forEach(([k,t])=>bar.append(h("button",{type:"button",role:"tab","aria-selected":String(praticarSeg===k),text:t,onclick:()=>{ praticarSeg=k; renderPraticar(); }})));
  box.append(bar);
  const key=l+"-"+praticarSeg+"-"+(aiReady()?1:0);
  if(!praticarCache[key]){
    if(praticarSeg==="conversa") praticarCache[key]=conversaView(l);
    else if(praticarSeg==="leitura"){ const w=h("div",{class:"stack"}, textsView(l)); if(aiReady()) w.append(h("h3",{text:"Leitura nova com glossário (professor)"}), readerView(l)); praticarCache[key]=w; }
    else if(praticarSeg==="escuta"){
      const w=h("div",{class:"stack"}), run=h("div",{class:"stack"});
      const start=()=>{ run.innerHTML=""; const st=listenSteps(l,10); if(!st.length){ run.append(h("p",{class:"small",text:"Faça algumas aulas para ter frases para ouvir."})); return; }
        runSeq(run, st, r=>{ run.innerHTML=""; run.append(h("div",{class:"card stack"}, h("p",{text:"Feito: "+r.ok+" certo(s), "+r.no+" erro(s)."}), h("button",{class:"btn primary",type:"button",text:"Mais 10",onclick:start}))); }); };
      w.append(h("div",{class:"card stack"}, h("h3",{text:"Ouça e entenda"}),
        h("p",{class:"small muted",text:"10 frases dos pontos e palavras que você já estudou, sem texto na tela. Toque em Devagar se precisar. Para textos inteiros, use Leitura > Só ouvir."}),
        h("button",{class:"btn primary",type:"button",text:"Começar",onclick:start})), run);
      praticarCache[key]=w;
    }
    else if(praticarSeg==="poemas") praticarCache[key]=poemsView(l);
    else praticarCache[key]=trajetoView(l);
  }
  box.append(praticarCache[key]);
}
aiHooks.push(()=>{ if(tab==="praticar") renderPraticar(); });

/* =========================================================
   Poemas: ler, ouvir, decorar, ordenar e entender
   ========================================================= */
const POEMS={ja:[],de:[]}; (window.LM_POEM||[]).forEach(p=>{ if(POEMS[p.lang]) POEMS[p.lang].push(p); });
function poemSay(l, v){ return l==="ja" ? String(v[1]||v[0]).replace(/\s+/g,"") : clean(v[0]); }
function poemLog(l){ const pf=store.perfil[l]; if(!pf.poemas) pf.poemas={}; return pf.poemas; }
function poemMark(l, p, k, val){ const g=poemLog(l); g[p.id]=Object.assign({}, g[p.id]||{}, {[k]:val, data:TODAY}); savePerfil(l); }
function poemPlayAll(l, p, rate){ return speakSeq(p.versos.map(v=>({text:poemSay(l,v), l, rate:rate||0.8, gap:l==="ja"?900:600}))); }
function poemFace(l, p){
  const face=h("div",{class:"poem-face "+(l==="ja"?"tate":"yoko"),lang:l});
  p.versos.forEach((v,i)=>{ face.append(h("span",{class:"pv",text:v[0]})); if((p.quebras||[]).includes(i+1)) face.append(h("span",{class:"pgap","aria-hidden":"true"})); });
  return h("div",{class:"poem-wrap"}, face);
}
function poemsView(l){
  const wrap=h("div",{class:"stack"}), area=h("div",{class:"stack"}), list=h("div",{class:"textlist"});
  const log=poemLog(l);
  POEMS[l].forEach(p=>{ const g=log[p.id]||{};
    list.append(h("button",{type:"button",onclick:()=>{ area.innerHTML=""; area.append(poemView(l,p,()=>{ area.innerHTML=""; window.scrollTo(0,0); })); reveal(area.firstChild); }},
      h("span",{class:"row"}, h("span",{class:"chip",text:p.lvl}), g.decorado ? h("span",{class:"chip s6",text:"✓ decorado"}) : g.lido ? h("span",{class:"chip s2",text:"lido"}) : null),
      h("span",{class:"tt",lang:l,text:p.titulo}), h("span",{class:"small muted",text:p.forma+" · "+p.autor+", "+p.ano})));
  });
  wrap.append(h("div",{class:"card stack"}, h("h3",{text:"Poemas"}),
    h("p",{class:"small muted",text: l==="ja"
      ? "Haiku, tanka e poesia clássica com leitura em kana, tradução e notas de gramática clássica. Ouça, leia, decore e coloque os versos em ordem."
      : "Poesia alemã clássica e romântica com tradução e notas. Ouça, leia, decore e coloque os versos em ordem."}), list), area);
  return wrap;
}
function poemView(l, p, after){
  const out=h("div",{class:"stack"}), seg=h("div",{class:"segctl",role:"tablist","aria-label":"Estudo do poema"}), body=h("div",{class:"stack"});
  let mode="ler";
  const quiet=()=>{ try{ speechSynthesis.cancel(); }catch(e){} };
  const modes=[["ler","Ler"],["decorar","Decorar"],["ordenar","Ordenar"]];
  if(p.perguntas && p.perguntas.length) modes.push(["entender","Entender"]);
  const draw=()=>{ quiet(); body.innerHTML="";
    seg.querySelectorAll("button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.m===mode)));
    body.append(mode==="ler" ? poemRead(l,p) : mode==="decorar" ? poemMemo(l,p) : mode==="ordenar" ? poemOrder(l,p) : poemQuiz(l,p));
  };
  modes.forEach(([k,t])=>seg.append(h("button",{type:"button",role:"tab","data-m":k,text:t,onclick:()=>{ mode=k; draw(); }})));
  out.append(h("div",{class:"card stack"},
      h("div",{class:"row"}, h("span",{class:"chip",text:p.forma}), h("span",{class:"small muted",text:p.autor+", "+p.ano}), h("span",{class:"spacer"}),
        after ? h("button",{class:"linkbtn",type:"button",text:"fechar",onclick:()=>{ quiet(); after(); }}) : null),
      h("h2",{lang:l,text:p.titulo}), poemFace(l,p), p.contexto ? h("p",{class:"small tip",text:p.contexto}) : null),
    seg, body);
  draw();
  return out;
}
function poemRead(l, p){
  const card=h("div",{class:"card stack"}), body=h("div",{class:"hide-pt"});
  let stop=null;
  const playAll=h("button",{class:"btn small primary",type:"button",text:"▶ Poema todo",onclick:()=>{ stop&&stop(); stop=poemPlayAll(l,p,0.8); }});
  p.versos.forEach(v=>{ const t=poemSay(l,v);
    body.append(h("div",{class:"ex"},
      h("span",{class:"row",style:"gap:6px;flex-wrap:nowrap"}, iconBtn("play","Ouvir",()=>speak(t,l,{rate:0.9})), iconBtn("slow","Ouvir devagar",()=>speak(t,l,{rate:0.65}))),
      h("div",{}, h("div",{class:"jp",lang:l,text:v[0]}), l==="ja"&&v[1] ? h("div",{class:"kana",lang:"ja",text:v[1]}) : null, h("div",{class:"pt",text:v[2]})))); });
  const tg=h("div",{class:"toggles"},
    l==="ja" ? h("label",{}, h("input",{type:"checkbox",id:"pm-kana-"+p.id,checked:true,onchange:e=>body.classList.toggle("hide-kana",!e.target.checked)}),"Kana") : null,
    h("label",{}, h("input",{type:"checkbox",id:"pm-pt-"+p.id,onchange:e=>body.classList.toggle("hide-pt",!e.target.checked)}),"Tradução"));
  const done=h("button",{class:"btn",type:"button",text:"Marcar como lido"});
  const isRead=()=>!!(poemLog(l)[p.id]||{}).lido;
  if(isRead()){ done.disabled=true; done.textContent="Lido"; }
  done.addEventListener("click",()=>{ if(!isRead()){ addDay(l,{leit:1, xp:10}); poemMark(l,p,"lido",true); } done.disabled=true; done.textContent="Lido"; });
  card.append(h("div",{class:"row"}, playAll, h("span",{class:"spacer"}), tg),
    h("p",{class:"small muted",text:"Leia primeiro sem tradução. Ouça cada verso e repita em voz alta, no ritmo do áudio."}), body,
    (p.notas&&p.notas.length) ? h("div",{class:"stack"}, h("h3",{text:"Notas"}), p.notas.map(n=>h("div",{class:"pnote"}, h("b",{lang:l,text:n[0]}), h("span",{text:n[1]})))) : null,
    h("div",{class:"row"}, done));
  const wrap=h("div",{class:"stack"}, card);
  if(aiReady()) wrap.append(poemAsk(l,p));
  return wrap;
}
function poemAsk(l, p){
  const a=h("textarea",{id:"pmq-"+p.id,rows:"2",placeholder: l==="ja" ? "Ex.: por que けり e não た? Como ficaria em japonês moderno?" : "Ex.: por que hätt' e não hat? Como ficaria em alemão moderno?"});
  const ans=h("div",{class:"answer",hidden:true}), send=h("button",{class:"btn small",type:"button",text:"Perguntar"});
  send.addEventListener("click", async ()=>{
    const q=a.value.trim(); if(!q) return; send.disabled=true; ans.hidden=false; ans.textContent="Pensando…";
    const txt=p.versos.map(v=>v[0]).join("\n");
    try{ await sampleFn(`Você é professor de ${LANGNAME[l]} de um aluno brasileiro, ${levelLine(l)}. Ele está estudando este poema (${p.titulo}, de ${p.autor}, ${p.ano}):\n${txt}\nPergunta do aluno: ${q}\nResponda em português, em até 6 frases, direto ao ponto. ${l==="ja"?"Todo exemplo em japonês vem com leitura em kana entre parênteses e tradução.":"Todo exemplo em alemão vem com tradução."}`,
      {cache:false, onText:({text})=>{ ans.textContent=text; }}); }
    catch(e){ ans.textContent=aiError(e)||""; }
    send.disabled=false;
  });
  return h("div",{class:"card stack"}, h("h3",{text:"Perguntar ao professor sobre o poema"}), a, h("div",{class:"row"}, send), ans);
}
function poemMemo(l, p){
  const card=h("div",{class:"card stack"});
  const steps=["Leia o poema em voz alta duas vezes, junto com o áudio.",
    "Metade de cada verso sumiu. Recite o poema todo; toque num verso só se travar.",
    "Só sobrou o começo de cada verso. Recite de novo.",
    "Agora de cor. Recite tudo e depois confira."];
  let r=0, stop=null;
  const hint=(t,lv)=>{ if(lv===0) return t; if(lv===3) return "";
    if(l==="de"){ const w=t.split(" "); return w.slice(0, lv===1 ? Math.ceil(w.length/2) : 1).join(" "); }
    const ch=[...t]; return ch.slice(0, lv===1 ? Math.ceil(ch.length/2) : Math.min(2,ch.length)).join(""); };
  const listen=()=>h("button",{class:"btn small",type:"button",text:"▶ Ouvir",onclick:()=>{ stop&&stop(); stop=poemPlayAll(l,p,0.8); }});
  const draw=()=>{ card.innerHTML="";
    const list=h("div",{class:"memo",lang:l});
    p.versos.forEach((v,i)=>{ const hv=hint(v[0],r), full=hv===v[0];
      const line=h("button",{type:"button",class:"mline"+(full?" full":""),disabled:full||null,"aria-label":full?null:"Mostrar verso "+(i+1)}, h("span",{text:hv}), full ? null : h("span",{class:"mgap",text:"……"}));
      if(!full) line.addEventListener("click",()=>{ line.replaceChildren(h("span",{text:v[0]})); line.classList.add("peek"); line.disabled=true; });
      list.append(line);
      if((p.quebras||[]).includes(i+1)) list.append(h("div",{class:"pgap-h"}));
    });
    card.append(h("div",{class:"row"}, h("span",{class:"chip s2",text:"Etapa "+(r+1)+" de 4"}), h("span",{class:"spacer"}), listen()),
      h("p",{text:steps[r]}), list,
      h("div",{class:"row"}, h("button",{class:"btn primary",type:"button",text: r<3 ? "Próxima etapa" : "Conferir",onclick:()=>{ stop&&stop(); if(r<3){ r++; draw(); } else finish(); }})));
  };
  const finish=()=>{ card.innerHTML="";
    const list=h("div",{class:"memo",lang:l}); p.versos.forEach(v=>list.append(h("div",{class:"mline full",text:v[0]})));
    card.append(h("h3",{text:"Confira"}), list, h("p",{class:"small muted",text:"Recitou tudo sem travar?"}),
      h("div",{class:"row"},
        h("button",{class:"btn primary",type:"button",text:"Sim, decorei",onclick:()=>{
          eloUpdate(l,"speaking",DIFF[p.lvl]||250,true,"poema"); if(S) S.stats.ok++; addDay(l,{ok:1, xp:20}); poemMark(l,p,"decorado",true);
          card.innerHTML=""; card.append(h("p",{text:"Poema decorado. Recite de novo amanhã, sem olhar, para fixar."}), listen()); }}),
        h("button",{class:"btn",type:"button",text:"Ainda não",onclick:()=>{ addDay(l,{xp:5}); r=1; draw(); }})));
  };
  draw();
  return card;
}
function poemOrder(l, p){
  const card=h("div",{class:"card stack"});
  const start=()=>{ card.innerHTML="";
    const n=p.versos.length, picked=[], ans=h("div",{class:"memo",lang:l}), pool=h("div",{class:"stack",lang:l});
    let order=shuffle(p.versos.map((_,i)=>i)), errs=0;
    for(let k=0; n>1 && k<5 && order.every((x,i)=>x===i); k++) order=shuffle(order);
    const end=()=>{ const ok=errs===0;
      eloUpdate(l,"leitura",DIFF[p.lvl]||250,ok,"poema"); if(S) S.stats[ok?"ok":"no"]++; addDay(l,{[ok?"ok":"no"]:1, xp: ok?12:4});
      card.append(h("p",{text: ok ? "Ordem perfeita." : "Concluído com "+errs+" erro(s)."}), h("div",{class:"row"}, h("button",{class:"btn",type:"button",text:"De novo",onclick:start}))); };
    order.forEach(i=>{ const b=h("button",{type:"button",class:"opt",text:p.versos[i][0]});
      b.addEventListener("click",()=>{ const want=picked.length;
        if(i===want || p.versos[i][0]===p.versos[want][0]){ picked.push(i); b.remove(); ans.append(h("div",{class:"mline full",text:p.versos[want][0]})); speak(poemSay(l,p.versos[want]),l,{rate:0.9}); if(picked.length===n) end(); }
        else { errs++; b.classList.add("wrong"); setTimeout(()=>b.classList.remove("wrong"),600); } });
      pool.append(b); });
    card.append(h("p",{text:"Toque nos versos na ordem do poema."}), ans, pool);
  };
  start();
  return card;
}
function poemQuiz(l, p){
  const out=h("div",{class:"stack"}); let n=0, right=0;
  p.perguntas.forEach(q=>out.append(compQuestion(l,q,ok=>{ n++; if(ok) right++;
    eloUpdate(l,"leitura",DIFF[p.lvl]||250,ok,"poema"); if(S) S.stats[ok?"ok":"no"]++; addDay(l,{[ok?"ok":"no"]:1, xp: ok?8:2});
    if(n===p.perguntas.length) out.append(h("p",{class:"small",text:right+" de "+n+" certas."})); })));
  return out;
}

/* =========================================================
   Aba Revisar
   ========================================================= */
function forecast(l, days){
  const its=Object.values(store.items[l]).filter(it=>it.estado>=2 && !it.suspenso && C[l].byId[it.id]);
  return [...Array(days)].map((_,d)=>{ const day=addDays(TODAY,d); return {day, n: its.filter(it=> d===0 ? it.vence<=day : it.vence===day).length}; });
}
function accuracy(l, days){
  let ok=0,no=0; for(let d=0; d<days; d++){ const x=store.dias[l+"-"+addDays(TODAY,-d)]; if(x){ ok+=x.ok; no+=x.no; } }
  return {ok,no,pct: ok+no ? Math.round(ok/(ok+no)*100) : null};
}
function forecastView(l){
  const f=forecast(l,7), max=Math.max(1,...f.map(x=>x.n));
  const wd=["dom","seg","ter","qua","qui","sex","sáb"];
  return h("div",{class:"fcast"}, f.map((x,i)=>{ const dt=new Date(x.day+"T12:00"), on=isStudyDay(l,x.day);
    return h("div",{class:"fc"+(on?"":" off"),title:brDate(x.day)+": "+x.n+" revisões"}, h("span",{class:"fc-n",text:x.n}), h("i",{style:`height:${Math.max(3,x.n/max*48)}px`}), h("span",{class:"fc-d",text:i===0?"hoje":wd[dt.getDay()]})); }));
}
function renderRevisar(){
  const box=$("#tab-revisar"); box.innerHTML="";
  const l=state.lang, due=dueItems(l);
  const run=h("div",{class:"stack"});
  box.append(h("div",{class:"sechead"}, h("h1",{text:"Revisar"}), h("span",{class:"jp",text:"復習"})), h("div",{class:"card stack"},
    h("h2",{text:"Revisões de hoje"}),
    h("p",{text: due.length ? due.length+" ite"+(due.length>1?"ns":"m")+" de "+LANGNAME[l]+" vencido"+(due.length>1?"s":"")+" ("+due.filter(it=>C[l].byId[it.id] && !C[l].byId[it.id].kind).length+" de gramática)." : "Nada vencido em "+LANGNAME[l]+" hoje."}),
    h("div",{class:"row"},
      due.length ? h("button",{class:"btn primary",type:"button",text:"Revisar agora",onclick:()=>{ run.innerHTML=""; loadFresh(due.map(it=>C[l].byId[it.id]).filter(p=>p&&!p.kind)); runSeq(run, reviewQueue(l, 40, 200).map(reviewStep), r=>{ renderRevisar(); const res=h("div",{class:"card"},h("p",{text:"Revisão feita: "+r.ok+" certo(s), "+r.no+" erro(s)."})); const tr=$("#tab-revisar"); tr.insertBefore(res, tr.children[1]||null); }, {requeue:true}); }}) : null,
      learned(l).length ? h("button",{class:"btn",type:"button",text:"Prática mista",onclick:()=>{ run.innerHTML=""; runSeq(run, shuffle(learned(l)).slice(0,8).map(reviewStep), r=>{ run.innerHTML=""; run.append(h("div",{class:"card"},h("p",{text:"Feito: "+r.ok+" certo(s), "+r.no+" erro(s)."}))); }); }}) : null)), run);
  const acc=accuracy(l,7);
  box.append(h("div",{class:"card stack"}, h("h3",{text:"Próximos 7 dias"}), forecastView(l),
    h("p",{class:"small muted",text:"Dias apagados não são dias de "+LANGNAME[l]+" no seu rodízio (mude em Progresso > Ajustes). Revisar um dia depois quase não muda a memória no FSRS, mas fila grande cansa: use o trajeto para esvaziar a fila aqui."}),
    h("p",{class:"small",text: acc.pct==null ? "Acerto dos últimos 7 dias: sem dados ainda." : "Acerto dos últimos 7 dias: "+acc.pct+"% ("+(acc.ok+acc.no)+" respostas). "+(acc.pct>95?"Muito fácil: pode aumentar o ritmo de palavras novas.":acc.pct<75?"Abaixo do ideal: o app já reduz as palavras novas até você firmar o que viu.":"Na faixa boa (75–95%): difícil o bastante para fixar, fácil o bastante para não desanimar.")})));
  const listBox=h("div",{class:"card stack"}); box.append(listBox);
  renderRevisarList(listBox);
}
function renderRevisarList(listBox){
  const l=state.lang; listBox.innerHTML="";
  const errs=Object.entries(store.erros).filter(([,e])=>e.idioma===l && !e.corrigido).sort((a,b)=>a[1].ultima<b[1].ultima?1:-1);
  listBox.append(h("h3",{text:"Banco de erros"}),
    h("p",{class:"small muted",text:"Cada erro sai daqui depois de 3 acertos do mesmo item em dias seguintes. Um ponto errado 3 vezes em 2 semanas ganha uma sequência de correção no início da próxima revisão."}));
  if(!errs.length){ listBox.append(h("p",{class:"small",text:"Nenhum erro em aberto."})); return; }
  const ul=h("ul",{class:"errlist"});
  errs.slice(0,30).forEach(([id,e])=>{
    const p=e.conteudo && C[l].byId[e.conteudo];
    const gram=p && !p.kind;
    ul.append(h("li",{}, h("span",{class:"wrong",lang:l,text:e.erro}), h("br"), h("strong",{lang:l,text:e.correta}),
      h("div",{class:"row small muted"}, h("span",{text:(p?p.t+" · ":"")+(e.ocorrencias>1?e.ocorrencias+" vezes · ":"")+"última em "+brDate(e.ultima)}),
        gram ? h("button",{class:"btn small",type:"button",text:"Praticar",onclick:()=>{ selectTab("trilha"); trilhaSeg="gram"; trilhaView={pointId:p.id}; renderTrilha(); }}) : null)));
  });
  listBox.append(ul);
}

/* =========================================================
   Aba Progresso
   ========================================================= */
function levelText(l){
  const pf=store.perfil[l]; if(!pf) return "";
  const r=pf.competencias.gramatica.rating;
  const band = l==="ja" ? (r<100?"N5":r<200?"N4":r<300?"N3":r<400?"N2":"N1") : (r<100?"A1":r<200?"A2":r<300?"B1":r<400?"B2":"C1");
  const pos = (r%100)<34?"baixo":(r%100)<67?"médio":"alto";
  return band+" "+pos;
}
function renderProgresso(){
  const box=$("#tab-progresso"); box.innerHTML="";
  const l=state.lang, pts=C[l].points, pf=store.perfil[l]||{};
  const its=pts.map(p=>getItem(p));
  const intro=its.filter(it=>it&&it.estado>=2).length, firm=its.filter(it=>it&&(it.S||0)>=21).length;
  const st=streakInfo(), xp=pf.xp||0, lv=xpLevel(xp);
  const vw=vocabItems(l), vk=kanjiItems(l);
  box.append(h("div",{class:"sechead"}, h("h1",{text:"Progresso"}), h("span",{class:"jp",text:"成長"})));
  box.append(h("div",{class:"stats"},
    h("div",{class:"stat"},h("b",{text:lv+" · "+rankName(lv)}),h("span",{text:xp.toLocaleString("pt-BR")+" XP em "+LANGNAME[l]})),
    h("div",{class:"stat"},h("b",{text:st.streak}),h("span",{text:"dias seguidos"+(st.freezeFree?" · proteção disponível":" · proteção usada")})),
    h("div",{class:"stat"},h("b",{text:intro+"/"+pts.length}),h("span",{text:"pontos vistos · "+firm+" firmes"})),
    h("div",{class:"stat"},h("b",{text:seenOf(vw).length+"/"+vw.length}),h("span",{text:"palavras vistas"})),
    l==="ja" ? h("div",{class:"stat"},h("b",{text:seenOf(vk).length+"/"+vk.length}),h("span",{text:"kanji vistos"})) : null));
  { const sg=box.lastChild; if(sg.children.length%2) sg.firstChild.classList.add("wide"); }
  // objetivo do curso
  const goal=h("div",{class:"card stack"}, h("h3",{text:"Objetivo: "+(l==="ja"?"concluir o N2":"chegar ao B2")}),
    ...LVL_ORDER[l].map(x=>{ const pr=levelProgress(l,x); return h("div",{class:"lvlmeter"}, h("b",{text:x}), h("div",{class:"bar"}, h("i",{style:`width:${pr*100}%;background:${levelDone(l,x)?"var(--ok)":"var(--accent)"}`})), h("span",{class:"v",text:levelDone(l,x)?"concluído":Math.round(pr*100)+"%"})); }),
    h("p",{class:"small muted",text:"O nível só conta como concluído com domínio real (itens com memória estável) ou com o exame do nível na Trilha. Assim o número não sobe só por clicar."}));
  const prova = l==="ja" ? settings.provaJa : settings.provaDe;
  if(prova){ const dd=diffDays(TODAY,prova); if(dd>=0) goal.append(h("p",{}, h("span",{class:"countdown",text:dd+" dias"}), " até a prova em "+brDate(prova)+"/"+prova.slice(0,4)+".")); }
  box.append(goal);
  // últimos 14 dias
  const days=h("div",{class:"days","aria-label":"Últimos 14 dias"});
  for(let k=13;k>=0;k--){ const iso=addDays(TODAY,-k); const dj=dayOf("ja",iso), dd=dayOf("de",iso);
    const on=x=>x && ((x.ok||0)+(x.no||0)>=10 || x.pomos || x.curtas);
    // sessões salvas também contam (inclusive as de antes dos contadores diários)
    const ses=lg=>Object.values(store.sessoes).some(x=>x && x.data===iso && x.idioma===lg);
    const oj=on(dj)||ses("ja"), od=on(dd)||ses("de");
    const cls = oj&&od ? "both" : oj ? "ja" : od ? "de" : (st.freezes.includes(iso)?"freeze":"");
    days.append(h("div",{class:"day "+cls,title:brDate(iso)})); }
  box.append(h("div",{class:"card"}, h("h3",{text:"Últimos 14 dias"}), days,
    h("div",{class:"row small muted",style:"margin-top:8px;gap:14px"}, h("span",{}, h("span",{style:"color:var(--ja)",text:"■"})," japonês"), h("span",{}, h("span",{style:"color:var(--de)",text:"■"})," alemão"), h("span",{text:"▢ dia protegido"})),
    h("p",{class:"small muted",style:"margin-top:6px",text:"Dia estudado = 10 respostas, uma sessão curta ou um pomodoro. Um dia perdido por semana não quebra a sequência."})));
  box.append(h("div",{class:"card stack"}, h("h3",{text:"Sua curva do esquecimento (FSRS)"}), forgettingChart(l)));
  const diag=pf.diagnostico;
  const dg=h("div",{class:"card stack"}, h("h3",{text:"Teste de nível"}),
    h("p",{class:"small",text: diag ? "Último teste em "+brDate(diag.data)+": gramática até a unidade "+diag.unidade+"; vocabulário "+Object.entries(diag.vocab||{}).map(([k,v])=>k+" ≈ "+v+"%").join(" · ")+"." : "Cerca de 10 minutos. Coloca você no ponto certo da trilha e marca como conhecido o que você já domina."}),
    h("button",{class:"btn "+(diag?"":"primary"),type:"button",style:"align-self:flex-start",text: diag?"Refazer teste":"Fazer teste de nível",onclick:()=>{ placementActive=true; dg.replaceWith(placementView(l,()=>updateBadge())); }}));
  box.append(dg);
  // competências
  if(pf.competencias){
    const cp=h("div",{class:"card stack"}, h("h3",{text:"Estimativa por competência"}),
      h("p",{class:"small",text:"Gramática: "+levelText(l)+" (estimativa, escala interna 0–600)."}));
    const marks = l==="ja" ? ["N5","N4","N3","N2","N1","+"] : ["A1","A2","B1","B2","C1","C2"];
    COMPS[l].forEach(([k,name])=>{
      const c=pf.competencias[k]; if(!c) return;
      const ev=c.evidencias||0;
      const lo=Math.max(0,c.rating-c.margem), hi=Math.min(600,c.rating+c.margem);
      cp.append(h("div",{class:"comp"}, h("span",{text:name}),
        h("div",{class:"scale"}, h("i",{style:`left:${lo/6}%;width:${(hi-lo)/6}%`}), ev?h("b",{style:`left:${c.rating/6}%`}):null),
        h("span",{class:"val",text: ev ? marks[Math.min(5,Math.floor(c.rating/100))]+" · "+c.rating : "não avaliado"})));
    });
    cp.append(h("p",{class:"small muted",text:"A faixa clara é a margem de erro: ela encolhe a cada resposta. Fala é estimada pela conversa escrita (o microfone é bloqueado dentro do Claude)."}));
    box.append(cp);
  }
  box.append(h("details",{class:"card"}, h("summary",{text:"Como o app decide o que você estuda (e por quê)"}),
    h("ul",{class:"small",style:"padding-left:18px;margin:8px 0 0;display:flex;flex-direction:column;gap:6px"},
      h("li",{}, "Repetição espaçada com FSRS-6: cada item tem estabilidade S e dificuldade D; a lembrança cai numa curva de potência e o item volta quando a chance prevista chega à sua retenção-alvo (padrão 90 %). Parâmetros padrão do ", h("a",{href:"https://github.com/open-spaced-repetition/py-fsrs",target:"_blank",rel:"noopener",text:"py-fsrs"}), "; algoritmo descrito por ", h("a",{href:"https://doi.org/10.1145/3534678.3539081",target:"_blank",rel:"noopener",text:"Ye, Su e Cao (2022)"}), "."),
      h("li",{}, "Espaçar é melhor que concentrar: ", h("a",{href:"https://doi.org/10.1037/0033-2909.132.3.354",target:"_blank",rel:"noopener",text:"Cepeda et al. (2006)"}), ", metanálise de prática distribuída."),
      h("li",{}, "Lembrar sem pista fixa mais que reler (efeito de testagem): ", h("a",{href:"https://doi.org/10.1126/science.1152408",target:"_blank",rel:"noopener",text:"Karpicke e Roediger (2008)"}), ". Por isso o formato vai de reconhecer → ouvir → escrever sem ajuda."),
      h("li",{}, "Misturar tipos na mesma sessão ajuda a distinguir o que é parecido: ", h("a",{href:"https://doi.org/10.1111/j.1467-9280.2008.02127.x",target:"_blank",rel:"noopener",text:"Kornell e Bjork (2008)"}), "."),
      h("li",{}, "Ler bastante no seu nível melhora a leitura: ", h("a",{href:"https://doi.org/10.1002/tesq.157",target:"_blank",rel:"noopener",text:"Nakanishi (2015)"}), ", metanálise de leitura extensiva."),
      h("li",{}, "Correção logo depois da sua produção tem efeito duradouro, maior em respostas livres: ", h("a",{href:"https://doi.org/10.1017/S0272263109990520",target:"_blank",rel:"noopener",text:"Lyster e Saito (2010)"}), ". É o que a conversa e a \"frase sua\" fazem."),
      h("li",{}, "Metas, XP e níveis têm efeito pequeno mas real na motivação e no aprendizado: ", h("a",{href:"https://doi.org/10.1007/s10648-019-09498-w",target:"_blank",rel:"noopener",text:"Sailer e Homner (2020)"}), ". Aqui o nível do curso depende do domínio, não do XP, para o jogo não substituir o estudo."),
      h("li",{text:"Erro recorrente (3 vezes em 2 semanas) abre uma sequência de correção: contraste, reconhecimento, montagem e produção."}),
      h("li",{text:"Carga controlada: 8–10 palavras novas por dia (máx. 20), metade se houver mais de 35 revisões vencidas ou acerto abaixo de 70 %, zero acima de 60 vencidas. Esses números são escolhas de desenho, não resultados de pesquisa."}))));
  // ajustes
  const vs=h("div",{class:"status",role:"status"}), bs=h("div",{class:"status",role:"status"});
  const sel=(id,label,val,opts,onch)=>{ const s=h("select",{id,onchange:e=>{ onch(e.target.value); saveSettings(); scheduleUI(); }}, opts.map(([v,t])=>h("option",{value:v,text:t}))); s.value=String(val); return h("label",{class:"stack",style:"gap:4px"}, h("span",{class:"small",text:label}), s); };
  const provaInp=h("input",{type:"date",id:"provaData",value:(l==="ja"?settings.provaJa:settings.provaDe)||"",onchange:e=>{ if(l==="ja") settings.provaJa=e.target.value; else settings.provaDe=e.target.value; saveSettings(); scheduleUI(); }});
  box.append(h("div",{class:"card stack"}, h("h3",{text:"Ajustes"}),
    sel("rotSel","Idioma de cada dia",settings.rotacao,[["rodizio","Rodízio: japonês dom/seg/qua/sex, alemão ter/qui/sáb"],["ambos","Os dois todo dia (1º pomodoro japonês, 2º alemão)"],["ja","Só japonês"],["de","Só alemão"]],v=>{ settings.rotacao=v; }),
    sel("metaSel","Meta de pomodoros por dia",settings.metaPomos,[["1","1 pomodoro (25 min)"],["2","2 pomodoros"],["3","3 pomodoros"]],v=>{ settings.metaPomos=Number(v); for(const x of ["ja","de"]) if(store.perfil[x]) store.perfil[x].metas=null; }),
    sel("retSel","Retenção-alvo das revisões",settings.retencao,[["0.85","85 % (menos revisões, mais esquecimento)"],["0.9","90 % (recomendado)"],["0.95","95 % (mais revisões, para véspera de prova)"]],v=>{ settings.retencao=Number(v); }),
    h("label",{class:"stack",style:"gap:4px"}, h("span",{class:"small",text:"Data da prova de "+LANGNAME[l]+" (opcional: mostra a contagem regressiva)"}), provaInp),
    h("p",{class:"small muted",text:"Datas de JLPT e Goethe mudam a cada ano: confira no site oficial antes de marcar."}),
    sel("vozSel","Voz do japonês",settings.voz,[["texto","Ler a frase com kanji (padrão)"],["kana","Ler pela leitura em kana"]],v=>{ settings.voz=v; }),
    h("p",{class:"small muted",text:"Se a voz ler algum kanji errado, troque para kana. A leitura em kana pode errar a partícula は."}),
    h("div",{class:"row"},
      h("button",{class:"btn small",type:"button",text:"Testar japonês",onclick:()=>testVoice("ja",vs)}),
      h("button",{class:"btn small",type:"button",text:"Testar alemão",onclick:()=>testVoice("de",vs)}),
      h("button",{class:"btn small",type:"button",text:"Testar português",onclick:()=>testVoice("pt",vs)})), vs,
    h("details",{}, h("summary",{text:"Backup"}),
      h("p",{class:"small muted",text:"Exporte uma vez por semana. Importar substitui os registros de mesmo nome."}),
      h("div",{class:"row"}, h("button",{class:"btn small",type:"button",text:"Exportar backup",onclick:()=>exportBackup(bs)}),
        h("label",{class:"btn small"},"Importar backup", h("input",{type:"file",id:"importFile",accept:"application/json,.json",hidden:true,onchange:e=>importBackup(e,bs)}))), bs),
    h("p",{class:"small muted",text: store.mode==="db" ? "Progresso salvo na sua conta." : store.mode==="local" ? "Progresso salvo só neste navegador." : "Carregando…"})));
}
function testVoice(l, st){
  const v=voiceFor(l);
  if(!("speechSynthesis" in window)){ st.className="status warn"; st.textContent="Este navegador não tem voz sintetizada. Abra o link no Chrome."; return; }
  st.className="status"; st.textContent= v ? "Tocando com "+v.name+"…" : "Tocando com a voz padrão…";
  speak(l==="ja"?"今日は日本語を勉強します。":l==="de"?"Heute lerne ich Deutsch.":"Hoje eu estudo idiomas.", l, {onend:ok=>{ st.className=ok?"status ok":"status warn"; st.textContent= ok ? (v?"Voz ok: "+v.name+".":"Tocou, mas sem voz própria do idioma; o sotaque pode sair errado.") : "Não tocou aqui. Abra o link do app no Chrome."; }});
}
async function exportBackup(st){
  st.className="status"; st.textContent="Juntando os dados…";
  try{
    const out={app:"language-master", versao:"v2", exportadoEm:new Date().toISOString(), colecoes:{itens:Object.assign({},store.items.ja,store.items.de), erros:store.erros, sessoes:store.sessoes, perfil:store.perfil, reportes:store.reportes, vocabExtra:store.vocabExtra}};
    const dl=await claude.use("downloads");
    if(!dl){ st.className="status warn"; st.textContent="Download indisponível nesta visualização. Abra pelo link do app."; return; }
    const r=await dl.save({filename:"language-master-backup-"+TODAY+".json", data:JSON.stringify(out,null,2)});
    st.className="status ok"; st.textContent= r && r.status==="saved" ? "Backup salvo." : "Backup enviado.";
  }catch(e){ st.className="status warn"; st.textContent= e && e.code==="declined" ? "Download cancelado." : "Não consegui gerar o backup."; }
}
async function importBackup(ev, st){
  const f=ev.target.files[0]; ev.target.value=""; if(!f) return;
  try{
    const data=JSON.parse(await f.text());
    if(data.app!=="language-master" || !data.colecoes) throw new Error("Este arquivo não é um backup do Language Master.");
    const c=data.colecoes; let n=0;
    Object.values(c.itens||{}).forEach(it=>{ if(it && it.lang){ saveItem(it); n++; } });
    Object.entries(c.erros||{}).forEach(([id,e])=>{ saveErro(id,e); n++; });
    Object.entries(c.sessoes||{}).forEach(([id,s])=>{ saveSessao(id,s); n++; });
    Object.entries(c.perfil||{}).forEach(([l,p])=>{ if(p && p.competencias){ store.perfil[l]=p; savePerfil(l); n++; } });
    Object.entries(c.vocabExtra||{}).forEach(([id,d])=>{ store.vocabExtra[id]=d; write("vocabExtra",id,d); n++; }); addExtraVocab(Object.values(c.vocabExtra||{}));
    Object.values(c.reportes||{}).forEach(r=>{ if(r && r.chave){ store.reportes[r.chave]=r; write("reportes",slug(r.chave)+"-imp",r); n++; } });
    st.className="status ok"; st.textContent="Backup restaurado: "+n+" registros."; changed();
  }catch(e){ st.className="status warn"; st.textContent=e.message||"Arquivo inválido."; }
}

/* =========================================================
   Abas, idioma e início
   ========================================================= */
let tab="hoje", placementActive=false;
const TABS=["hoje","trilha","praticar","revisar","progresso"];
function selectTab(t){
  if(!TABS.includes(t)) t="hoje";
  tab=t; placementActive=false;
  document.querySelectorAll("[role=tab][data-tab]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===t)));
  TABS.forEach(x=>$("#tab-"+x).hidden = x!==t);
  if(t==="trilha") renderTrilha();
  if(t==="praticar") renderPraticar();
  if(t==="revisar") renderRevisar();
  if(t==="progresso") renderProgresso();
  if(t==="hoje") renderHello();
  try{ sessionStorage.setItem("lm-tab",t); }catch(e){}
}
document.querySelectorAll("[role=tab][data-tab]").forEach(b=>b.addEventListener("click",()=>{ if(b.dataset.tab==="trilha") trilhaView=null; selectTab(b.dataset.tab); window.scrollTo(0,0); }));
function updateBadge(){ const n=dueItems(state.lang).length; document.querySelectorAll(".dueBadge").forEach(b=>{ b.textContent=n>99?"99+":n; b.hidden=!n; }); }
function setLang(l, user){
  if(user && state.startedAt){ toast("Pause o pomodoro para trocar de idioma."); return; }
  state.lang=l; document.body.className="lang-"+l;
  document.querySelectorAll(".switch button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.lang===l)));
  if(user){ persist(); S=null; if(!state.finished && elapsedNow()>0) newSession(); shownBlock=null; trilhaView=null; }
  updateBadge(); renderTimer(); renderUI();
  if(tab!=="hoje") selectTab(tab);
}
document.querySelectorAll(".switch button").forEach(b=>b.addEventListener("click",()=>setLang(b.dataset.lang,true)));
const hojeTxt=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"2-digit"});
$("#today").textContent=hojeTxt; $("#todaySide").textContent=hojeTxt;

/* ---------- selo de nível, metas, cabeçalho do dia ---------- */
function sealEl(l){ const cur=courseLevel(l), lv=xpLevel((store.perfil[l]||{}).xp||0);
  return h("div",{class:"seal",title:"Nível do curso "+cur+" · nível "+lv+" ("+rankName(lv)+")"}, h("b",{text:cur==="concluído"?"極":cur}), h("i",{text:rankName(lv)})); }
function renderRank(){
  const l=state.lang, pf=store.perfil[l]||{}, xp=pf.xp||0, lv=xpLevel(xp), a=xpForLevel(lv), b=xpForLevel(lv+1);
  const box=document.querySelector(".rankbox");
  box.replaceChildren(sealEl(l), h("div",{class:"rank-txt"}, h("div",{class:"t",text:"Nível "+lv+" · "+rankName(lv)}), h("div",{class:"s num",text:xp.toLocaleString("pt-BR")+" XP · faltam "+(b-xp).toLocaleString("pt-BR")}), h("div",{class:"xpbar"}, h("i",{style:`width:${(xp-a)/(b-a)*100}%`}))));
  document.querySelector(".rankmini").replaceChildren(sealEl(l));
  const st=streakInfo();
  document.querySelector(".streakbox").replaceChildren(h("span",{}, h("b",{text:st.streak})," dias seguidos"), h("span",{}, h("b",{text:(dayOf(l)||{}).xp||0})," XP hoje"));
}
function renderGoals(){
  const l=state.lang, gs=goalsFor(l), card=$("#goals"); if(!card) return;
  const d=dayOf(l)||{};
  card.replaceChildren(h("div",{class:"row"}, h("h3",{text:"Metas de hoje"}), h("span",{class:"spacer"}), h("span",{class:"small muted num",text:gs.filter(g=>g.v>=g.n).length+"/"+gs.length})),
    h("div",{class:"goals"}, gs.map(g=>{ const done=g.v>=g.n; return h("div",{class:"goal"+(done?" done":"")}, h("span",{class:"mark",text:done?"✓":""}), h("span",{class:"gt",text:g.t}), h("span",{class:"gp",text:g.v+"/"+g.n}), h("div",{class:"gbar"}, h("i",{style:`width:${g.v/g.n*100}%`}))); })),
    h("div",{class:"xpline"}, h("span",{text:"Cada meta: +20 XP · todas: +30"}), h("span",{class:"num",text:(d.xp||0)+" XP hoje"})));
}
function renderHello(){
  const l=state.lang, el=$("#hello"); if(!el) return;
  const hr=new Date().getHours();
  const hi = l==="ja" ? (hr<11?"おはようございます":hr<18?"こんにちは":"こんばんは") : (hr<11?"Guten Morgen":hr<18?"Guten Tag":"Guten Abend");
  const hiPt = hr<11?"Bom dia":hr<18?"Boa tarde":"Boa noite";
  const cur=courseLevel(l), pr=courseProgress(l), due=dueItems(l).length;
  const prova = l==="ja" ? settings.provaJa : settings.provaDe, dd = prova ? diffDays(TODAY,prova) : null;
  el.replaceChildren(h("h1",{lang:l,text:hi}),
    h("div",{class:"sub"}, hiPt+". Hoje: "+LANGNAME[l]+(isStudyDay(l,TODAY)?"":" (fora do rodízio)")+" · "+(cur==="concluído"?"trilha concluída":"nível "+cur)+" · "+Math.round(pr*100)+"% do objetivo"+(due?" · "+due+" revisões":"")),
    dd!=null && dd>=0 ? h("div",{}, h("span",{class:"countdown",text:dd+" dias"}), h("span",{class:"small muted",text:" até a prova ("+brDate(prova)+")"})) : null);
}
function renderRail(){
  const l=state.lang, box=$("#railExtra"); if(!box) return;
  box.replaceChildren(h("h3",{text:"Próximos 7 dias"}), forecastView(l),
    h("div",{class:"small muted",text:"Revisões previstas por dia (FSRS)."}),
    h("h3",{text:"Objetivo"}),
    ...LVL_ORDER[l].map(x=>{ const pr=levelProgress(l,x); return h("div",{class:"lvlmeter"}, h("b",{text:x}), h("div",{class:"bar"}, h("i",{style:`width:${pr*100}%;background:${levelDone(l,x)?"var(--ok)":"var(--accent)"}`})), h("span",{class:"v",text:levelDone(l,x)?"✓":Math.round(pr*100)+"%"})); }));
}
/* XP pelo que foi estudado antes de existir XP (versões anteriores a 28/09/2026).
   Roda uma vez por idioma, quando os dados da conta já carregaram. */
const XP_SINCE="2026-09-28";
function backfillXP(){
  if(!(store.mode==="local" || (store.mode==="db" && store.loaded.itens && store.loaded.sessoes))) return;
  for(const l of ["ja","de"]){
    const pf=store.perfil[l]; if(!pf || pf.xpRetro) continue;
    let xp=0;
    Object.values(store.items[l]).forEach(it=>{ if(!it || (it.criado||"")>=XP_SINCE) return; if(it.estado>=2) xp+=3; xp+=(it.acertos||0)*5+(it.erros||0)*2; });
    Object.values(pf.blocos||{}).forEach(b=>{ if(b && b.passou && (b.data||"")<XP_SINCE) xp+=20; });
    Object.values(store.sessoes).forEach(x=>{ if(x && x.idioma===l && (x.data||"")<XP_SINCE) xp+=30; });
    pf.xpRetro=TODAY;
    if(xp>0){ pf.xp=(pf.xp||0)+xp; if(l===state.lang) toast("+"+xp+" XP pelo que você já tinha estudado em "+LANGNAME[l]+"."); }
    savePerfil(l);
  }
}
function renderUI(){ try{ backfillXP(); renderRank(); renderGoals(); renderHello(); renderRail(); }catch(e){ console.warn("ui",e); } }
let uiTimer=null;
function scheduleUI(){ clearTimeout(uiTimer); uiTimer=setTimeout(renderUI,120); }
/* o mesmo relógio e as mesmas metas mudam de lugar: coluna direita no computador, dentro de Hoje no celular */
const wide=window.matchMedia("(min-width: 980px)");
function placePanels(){
  const pomo=$("#pomo"), goals=$("#goals");
  if(wide.matches){ $("#slotPomoRail").append(pomo); $("#slotGoalsRail").append(goals); }
  else { $("#slotPomoMain").append(pomo); $("#slotGoalsMain").append(goals); }
}
try{ wide.addEventListener("change", placePanels); }catch(e){ try{ wide.addListener(placePanels); }catch(_){} }
placePanels();

store.listeners.push(()=>{
  updateBadge(); scheduleUI();
  if(shownBlock==="idle") showIdle();
  const act=document.activeElement, inProg=act && $("#tab-progresso").contains(act) && /select|input/i.test(act.tagName);
  if(tab==="progresso" && !placementActive && !inProg) renderProgresso();
  if(tab==="trilha" && !trilhaView) renderTrilha();
});
loadLocal(); // mostra algo já, antes do banco responder
store.mode="loading";
setLang(state.lang,false);
if(state.startedAt) keepAwake(true);
try{ const t=sessionStorage.getItem("lm-tab"); if(t && t!=="hoje") selectTab(t); }catch(e){}
initStore();
})();
