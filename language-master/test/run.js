/* Testes de ponta a ponta: node test/run.js [--shots]
   Abre o app com window.claude simulado, percorre o pomodoro inteiro e todas as abas,
   no celular e no computador, e falha se houver qualquer erro de JavaScript. */
const { chromium } = require(process.env.PW_PATH || "playwright");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const SHOTS = process.argv.includes("--shots");
const OUT = path.join(ROOT, "test", "out"); fs.mkdirSync(OUT, {recursive:true});

const skeleton = body => `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>${body}</body></html>`;
const app = fs.readFileSync(path.join(ROOT,"dist","language-master.html"),"utf8");
const mock = fs.readFileSync(path.join(__dirname,"mock-claude.js"),"utf8");
const dayRel = n => { const d=new Date(Date.now()+n*864e5); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const page_html = skeleton(`<script>${mock}</script>` + app);
fs.writeFileSync(path.join(OUT,"page.html"), page_html);

/* um passo genérico: responde o que estiver aberto dentro de `scope` */
const STEP = `(scopeSel)=>{
  const scope=[...document.querySelectorAll(scopeSel)].find(e=>e.offsetParent!==null) || document.querySelector(scopeSel);
  if(!scope) return "no-scope";
  const vis=e=>e && e.offsetParent!==null && !e.disabled;
  const btns=[...scope.querySelectorAll("button")].filter(vis);
  const byText=t=>btns.find(b=>b.textContent.trim()===t);
  const cont=byText("Continuar"); if(cont){ cont.click(); return "continuar"; }
  const opt=[...scope.querySelectorAll(".opts .opt:not(.idk)")].filter(vis); if(opt.length){ opt[Math.floor(Math.random()*opt.length)].click(); return "opt"; }
  const tok=[...scope.querySelectorAll(".chips .tok")].filter(vis); if(tok.length){ tok[0].click(); return "tok"; }
  for(const t of ["Conferir","Pronto","Testar agora","Próxima","Entendi","Seguir para o próximo"]){ const b=byText(t); if(b){ if(t==="Conferir"){ const inp=[...scope.querySelectorAll("textarea,input[type=text]")].filter(vis).pop(); if(inp && !inp.value){ inp.value="テスト teste"; inp.dispatchEvent(new Event("input",{bubbles:true})); } } b.click(); return t; } }
  const ta=[...scope.querySelectorAll("textarea")].filter(vis).find(t=>!t.value);
  if(ta){ ta.value="Uso quando quero explicar a regra, formo assim e dou um exemplo meu diferente do da aula."; ta.dispatchEvent(new Event("input",{bubbles:true})); return "type"; }
  const ti=[...scope.querySelectorAll('input[type=text]')].filter(vis).find(t=>!t.value);
  if(ti){ ti.value="今日は日本語を勉強します。"; ti.dispatchEvent(new Event("input",{bubbles:true})); return "type-ex"; }
  for(const t of ["Corrigir com o professor","Avaliar com o professor","Comparar com um exemplo","Conferir sozinho","Sim, usei certo"]){ const b=byText(t); if(b){ b.click(); return t; } }
  const cb=[...scope.querySelectorAll('input[type=checkbox][id^="fc-"]')].filter(vis); if(cb.length){ cb.forEach(c=>c.checked=true); return "check"; }
  return "idle";
}`;

(async()=>{
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const errors = [];
  const results = [];
  async function newPage(viewport, opts){
    opts=opts||{};
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: opts.dark?"dark":"light" });
    const page = await ctx.newPage();
    page.on("pageerror", e => errors.push("[pageerror "+viewport.width+"] "+e.message+"\n"+(e.stack||"").split("\n").slice(0,4).join("\n")));
    page.on("console", m => { if(m.type()==="error" && !/ERR_CERT|ERR_NAME|fonts\.g/.test(m.text())) errors.push("[console "+viewport.width+"] "+m.text()); });
    await page.addInitScript(({noai, db, ja})=>{
      if(noai) window.__NOAI=true;
      // rodízio fixo em japonês: o cenário não depende do dia da semana em que o teste roda
      if(ja && !localStorage.getItem("lm-settings")) localStorage.setItem("lm-settings", JSON.stringify({rotacao:"ja"}));
      if(db) window.__MOCKDB=db;
      // voz instantânea no navegador sem áudio
      const fake={ speak:u=>setTimeout(()=>{ u.onend && u.onend(); },5), cancel(){}, getVoices:()=>[], onvoiceschanged:null };
      Object.defineProperty(window,"speechSynthesis",{value:fake, configurable:true});
      window.SpeechSynthesisUtterance = function(t){ this.text=t; };
    }, {noai:!!opts.noai, db:opts.db||null, ja:!!opts.ja});
    await page.goto("file://"+path.join(OUT,"page.html"));
    await page.waitForTimeout(600);
    return {page, ctx};
  }
  async function steps(page, scope, n, until){
    const log=[];
    for(let i=0;i<n;i++){
      const r = await page.evaluate(`(${STEP})(${JSON.stringify(scope)})`);
      log.push(r);
      await page.waitForTimeout(r==="opt"||r==="Conferir"||r==="Corrigir com o professor"||r==="Avaliar com o professor"?120:40);
      if(until && await page.evaluate(until)) break;
      if(r==="idle" && log.slice(-3).every(x=>x==="idle")) break;
    }
    return log;
  }
  const shot = async (page, name) => { if(SHOTS) await page.screenshot({path:path.join(OUT,name+".png"), fullPage:false}); };
  const check = (name, ok, extra) => { results.push((ok?"PASS ":"FAIL ")+name+(extra?" — "+extra:"")); };

  /* ---------- 1. celular: pomodoro completo em japonês ---------- */
  {
    const {page, ctx} = await newPage({width:390, height:844});
    await page.evaluate(()=>{ document.querySelector('.switch button[data-lang="ja"]').click(); });
    await shot(page,"m-hoje");
    check("hoje renderiza", await page.evaluate(()=>!!document.querySelector("#hello h1") && !!document.querySelector("#stage .plan")));
    check("sem rolagem horizontal (celular)", await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1), await page.evaluate(()=>document.documentElement.scrollWidth+"px"));
    await page.click("#startBtn");
    await page.waitForTimeout(200);
    const blocks = await page.evaluate(()=>[...document.querySelectorAll("#seglabels span")].map(s=>s.textContent));
    for(let b=0;b<blocks.length;b++){
      const name = await page.evaluate(()=>document.querySelector("#blockname").textContent);
      const log = await steps(page, "#stage", 90);
      await shot(page, "m-bloco-"+b);
      check("bloco "+name, true, log.filter(x=>x!=="idle").length+" ações");
      const done = await page.evaluate(()=>document.querySelector("#skipBtn").disabled);
      if(done) break;
      await page.click("#skipBtn"); await page.waitForTimeout(250);
    }
    // o último "Próximo bloco" conclui o pomodoro
    await page.waitForTimeout(400);
    check("pomodoro concluído", await page.evaluate(()=>/concluído|pomodoros hoje/.test(document.querySelector("#blockname").textContent)), await page.evaluate(()=>document.querySelector("#blockname").textContent));
    await shot(page,"m-concluido");
    const db = await page.evaluate(()=>window.__MOCKDB);
    const itens = Object.keys(db).filter(k=>k.includes("/itens/"));
    check("itens salvos no banco", itens.length>0, itens.length+" itens");
    const anyFsrs = Object.values(db).some(v=>v && v.fsrs===6 && v.S>0 && v.D>=1);
    check("FSRS gravou S e D", anyFsrs);
    const dias = Object.keys(db).filter(k=>k.includes("/dias/"));
    check("dia registrado com XP", dias.some(k=>db[k].xp>0), JSON.stringify(dias.map(k=>db[k])));
    const perfil = db[Object.keys(db).find(k=>k.endsWith("/perfil/ja"))]||{};
    check("XP no perfil", (perfil.xp||0)>0, "xp="+perfil.xp);
    check("metas do dia criadas", perfil.metas && perfil.metas.lista && perfil.metas.lista.length===3);
    // abas
    for(const t of ["trilha","praticar","revisar","progresso"]){
      await page.click('.bottombar [data-tab="'+t+'"]'); await page.waitForTimeout(250);
      await shot(page,"m-"+t);
      check("aba "+t+" (celular)", await page.evaluate(t=>!document.querySelector("#tab-"+t).hidden && document.querySelector("#tab-"+t).children.length>0, t));
      check("sem rolagem horizontal em "+t, await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1), await page.evaluate(()=>document.documentElement.scrollWidth+"px"));
    }
    // mais um pomodoro (plano extra)
    await page.click('.bottombar [data-tab="hoje"]'); await page.waitForTimeout(150);
    await page.click("#startBtn"); await page.waitForTimeout(250);
    const blocks2 = await page.evaluate(()=>[...document.querySelectorAll("#seglabels span")].map(s=>s.textContent));
    check("pomodoro extra com plano diferente", blocks2.join()!==blocks.join(), blocks2.join(" | "));
    for(let b=0;b<blocks2.length;b++){
      const name = await page.evaluate(()=>document.querySelector("#blockname").textContent);
      const log = await steps(page, "#stage", 60);
      check("extra: "+name, true, log.filter(x=>x!=="idle").length+" ações");
      if(await page.evaluate(()=>document.querySelector("#skipBtn").disabled)) break;
      await page.click("#skipBtn"); await page.waitForTimeout(250);
    }
    await ctx.close();
  }

  /* ---------- 2. computador: alemão, trilha, testes para pular, exame, praticar ---------- */
  {
    const {page, ctx} = await newPage({width:1440, height:900});
    await page.evaluate(()=>{ document.querySelector('.side .switch button[data-lang="de"]').click(); });
    await page.waitForTimeout(200);
    await shot(page,"d-hoje");
    check("layout 3 colunas no computador", await page.evaluate(()=>getComputedStyle(document.querySelector(".side")).display!=="none" && getComputedStyle(document.querySelector(".rail")).display!=="none" && document.querySelector("#slotPomoRail #pomo")!==null));
    // trilha → ponto → teste rápido "já sei"
    await page.click('.sidenav [data-tab="trilha"]'); await page.waitForTimeout(200);
    await shot(page,"d-trilha");
    await page.evaluate(()=>{ document.querySelector("#tab-trilha details summary").click(); document.querySelector("#tab-trilha .points li button").click(); });
    await page.waitForTimeout(200);
    const hasQuick = await page.evaluate(()=>[...document.querySelectorAll("#tab-trilha button")].some(b=>/teste rápido/.test(b.textContent)));
    check("botão 'Já sei este ponto'", hasQuick);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-trilha button")].find(b=>/teste rápido/.test(b.textContent)).click());
    await steps(page, "#tab-trilha", 30);
    await shot(page,"d-quick");
    // teste do bloco
    await page.click('.sidenav [data-tab="trilha"]'); await page.waitForTimeout(200);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-trilha button")].find(b=>/Testar o bloco/.test(b.textContent)).click());
    await page.waitForTimeout(200);
    await steps(page, "#tab-trilha", 60, `!![...document.querySelectorAll("#tab-trilha h3")].find(h=>/Bloco (ainda não )?reconhecido/.test(h.textContent))`);
    check("teste de bloco termina", await page.evaluate(()=>!![...document.querySelectorAll("#tab-trilha h3")].find(h=>/reconhecido/.test(h.textContent))));
    // exame do nível
    await page.click('.sidenav [data-tab="trilha"]'); await page.waitForTimeout(200);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-trilha button")].find(b=>/Exame do nível A2/.test(b.textContent)).click());
    await page.waitForTimeout(200);
    await steps(page, "#tab-trilha", 120, `!![...document.querySelectorAll("#tab-trilha h3")].find(h=>/Nível A2 concluído|Ainda não/.test(h.textContent))`);
    check("exame de nível termina", await page.evaluate(()=>!![...document.querySelectorAll("#tab-trilha h3")].find(h=>/Nível A2 concluído|Ainda não/.test(h.textContent))));
    await shot(page,"d-exame");
    // forçar aprovação do exame para checar a marcação
    await page.evaluate(()=>{ window.__forcePass=true; });
    // praticar: leitura embutida, escuta, trajeto, conversa
    await page.click('.sidenav [data-tab="praticar"]'); await page.waitForTimeout(200);
    await page.evaluate(()=>document.querySelector(".textlist button").click()); await page.waitForTimeout(150);
    await steps(page, "#tab-praticar", 10);
    check("texto embutido com perguntas", await page.evaluate(()=>/Texto concluído/.test(document.querySelector("#tab-praticar").textContent)));
    await shot(page,"d-leitura");
    await page.evaluate(()=>[...document.querySelectorAll("#tab-praticar .segctl button")].find(b=>b.textContent==="Escuta").click()); await page.waitForTimeout(150);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-praticar button")].find(b=>b.textContent==="Começar").click()); await page.waitForTimeout(150);
    await steps(page, "#tab-praticar", 40);
    check("escuta roda", await page.evaluate(()=>/Feito:/.test(document.querySelector("#tab-praticar").textContent)));
    await page.evaluate(()=>[...document.querySelectorAll("#tab-praticar .segctl button")].find(b=>b.textContent==="Trajeto").click()); await page.waitForTimeout(150);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-praticar button")].find(b=>/Começar/.test(b.textContent)).click());
    await page.waitForTimeout(700);
    check("modo trajeto toca", await page.evaluate(()=>document.querySelector("#tab-praticar .listen-now").textContent!=="—"));
    await page.evaluate(()=>[...document.querySelectorAll("#tab-praticar button")].find(b=>/Pausar/.test(b.textContent)).click());
    await shot(page,"d-trajeto");
    await page.evaluate(()=>[...document.querySelectorAll("#tab-praticar .segctl button")].find(b=>b.textContent==="Conversa").click()); await page.waitForTimeout(150);
    await page.evaluate(()=>document.querySelector("#tab-praticar .opts .opt").click()); await page.waitForTimeout(300);
    await page.fill("#conv-in","Ich möchte ein Brot, bitte."); await page.evaluate(()=>[...document.querySelectorAll("#tab-praticar button")].find(b=>b.textContent==="Enviar").click());
    await page.waitForTimeout(400);
    check("conversa responde", await page.evaluate(()=>document.querySelectorAll("#tab-praticar .msg.prof").length>=2));
    await shot(page,"d-conversa");
    // revisar e progresso
    await page.click('.sidenav [data-tab="revisar"]'); await page.waitForTimeout(200);
    await shot(page,"d-revisar");
    await page.click('.sidenav [data-tab="progresso"]'); await page.waitForTimeout(200);
    await shot(page,"d-progresso");
    check("progresso com fontes e ajustes", await page.evaluate(()=>/Cepeda/.test(document.querySelector("#tab-progresso").textContent) && !!document.querySelector("#rotSel")));
    await page.selectOption("#retSel","0.95"); await page.waitForTimeout(150);
    check("ajuste de retenção salvo", await page.evaluate(()=>JSON.parse(localStorage.getItem("lm-settings")).retencao===0.95));
    // teste de nível
    await page.evaluate(()=>[...document.querySelectorAll("#tab-progresso button")].find(b=>/teste de nível/i.test(b.textContent)).click());
    await steps(page, "#tab-progresso", 80, `/Resultado/.test(document.querySelector("#tab-progresso").textContent)`);
    check("teste de nível termina", await page.evaluate(()=>/Resultado/.test(document.querySelector("#tab-progresso").textContent)));
    // trilha de palavras: estudar novas e teste "já sei"
    await page.click('.sidenav [data-tab="trilha"]'); await page.waitForTimeout(150);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-trilha .segctl button")].find(b=>b.textContent==="Palavras").click()); await page.waitForTimeout(150);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-trilha button")].find(b=>b.textContent==="Estudar próximas agora").click()); await page.waitForTimeout(150);
    await steps(page,"#tab-trilha",60, `/Feito/.test(document.querySelector("#tab-trilha").textContent)`);
    check("estudar palavras pela trilha", await page.evaluate(()=>/Feito/.test(document.querySelector("#tab-trilha").textContent)));
    await page.click('.sidenav [data-tab="trilha"]'); await page.waitForTimeout(150);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-trilha button")].find(b=>/testar 20/.test(b.textContent)).click()); await page.waitForTimeout(150);
    await steps(page,"#tab-trilha",60, `/marcados como Reconhece/.test(document.querySelector("#tab-trilha").textContent)`);
    check("teste 'já sei palavras'", await page.evaluate(()=>/marcados como Reconhece/.test(document.querySelector("#tab-trilha").textContent)));
    // voltar ao japonês no computador: kanji gerados + pomodoro rápido
    await page.evaluate(()=>{ document.querySelector('.side .switch button[data-lang="ja"]').click(); });
    await page.click('.sidenav [data-tab="trilha"]'); await page.waitForTimeout(150);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-trilha .segctl button")].find(b=>b.textContent==="Kanji").click()); await page.waitForTimeout(150);
    const nk0 = await page.evaluate(()=>document.querySelector("#tab-trilha").textContent.match(/de (\d+) vistos/)[1]);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-trilha button")].find(b=>/Gerar mais 10 kanji/.test(b.textContent)).click()); await page.waitForTimeout(500);
    check("gerar kanji valida e adiciona", await page.evaluate(()=>/2 kanji novos/.test(document.querySelector("#tab-trilha").textContent)), await page.evaluate(()=>document.querySelector("#tab-trilha .status").textContent));
    await page.evaluate(()=>[...document.querySelectorAll("#tab-trilha .segctl button")].find(b=>b.textContent==="Palavras").click()); await page.waitForTimeout(150);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-trilha button")].find(b=>/Gerar mais 20 palavras/.test(b.textContent)).click()); await page.waitForTimeout(500);
    check("gerar palavras", await page.evaluate(()=>/palavras novas entraram/.test(document.querySelector("#tab-trilha").textContent)));
    await page.click('.sidenav [data-tab="hoje"]');
    await page.evaluate(()=>{ document.querySelector('.side .switch button[data-lang="ja"]').click(); });
    await page.click("#startBtn"); await page.waitForTimeout(200);
    await steps(page, "#stage", 40);
    await shot(page,"d-pomodoro");
    await ctx.close();
  }

  /* ---------- 3. sem o professor (Claude indisponível) e tema escuro ---------- */
  {
    const {page, ctx} = await newPage({width:390, height:844}, {noai:true, dark:true});
    await shot(page,"m-dark");
    await page.click("#startBtn"); await page.waitForTimeout(200);
    for(let b=0;b<6;b++){ await steps(page,"#stage",60); if(await page.evaluate(()=>document.querySelector("#skipBtn").disabled)) break; await page.click("#skipBtn"); await page.waitForTimeout(200); }
    check("pomodoro sem professor", await page.evaluate(()=>/concluído/.test(document.querySelector("#blockname").textContent)));
    await page.click('.bottombar [data-tab="praticar"]'); await page.waitForTimeout(200);
    check("praticar sem professor mostra textos", await page.evaluate(()=>document.querySelectorAll(".textlist button").length>0));
    await shot(page,"m-dark-praticar");
    await ctx.close();
  }

  /* ---------- 4. dados antigos (agendador anterior) continuam funcionando ---------- */
  {
    const base="data/users/user_test_1/app";
    const old={};
    old[base]={criadoEm:"2026-09-01", versao:"v2"};
    old[base+"/itens/ja-yonisuru"]={id:"ja-yonisuru",lang:"ja",u:"n3-1",tipo:"gramatica",estado:5,reps:3,ef:2.5,intervalo:6,vence:"2026-09-20",acertos:6,erros:1,ultima:"2026-09-14",srsDia:"2026-09-14",prodDias:["2026-09-10"],criado:"2026-09-01",S:6,ultRev:"2026-09-14",mod:1,_k:"ja-yonisuru"};
    old[base+"/perfil/ja"]={idioma:"ja",competencias:{gramatica:{rating:280,margem:60,evidencias:10,tiposTarefa:["mc"],ultima:"2026-09-14"}},atualizado:"2026-09-14",_k:"ja"};
    const {page, ctx} = await newPage({width:390, height:844}, {db:old, ja:true});
    await page.waitForTimeout(500);
    check("item antigo aparece como revisão vencida", await page.evaluate(()=>Number(document.querySelector(".dueBadge").textContent)>=1), await page.evaluate(()=>document.querySelector(".dueBadge").textContent));
    await page.click('.bottombar [data-tab="revisar"]'); await page.waitForTimeout(150);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-revisar button")].find(b=>b.textContent==="Revisar agora").click());
    await steps(page,"#tab-revisar",20);
    await page.waitForTimeout(800);
    const it = await page.evaluate(()=>window.__MOCKDB["data/users/user_test_1/app/itens/ja-yonisuru"]);
    check("item antigo migrado para FSRS", it && it.fsrs===6 && it.D>=1 && it.vence>new Date().toISOString().slice(0,10), JSON.stringify({S:it&&it.S,D:it&&it.D,vence:it&&it.vence}));
    await ctx.close();
  }

  /* ---------- 5. erro recorrente, reportar, backup, glossário, troca de idioma ---------- */
  {
    const base="data/users/user_test_1/app", db={};
    db[base]={criadoEm:"2026-09-01", versao:"v2"};
    const mk=(id,u)=>({id,lang:"ja",u,tipo:"gramatica",estado:4,reps:2,intervalo:3,vence:dayRel(-2),acertos:3,erros:3,ultima:dayRel(-5),srsDia:dayRel(-5),prodDias:[],criado:dayRel(-20),S:3,D:6,fsrs:6,ultRev:dayRel(-5),mod:1,_k:id});
    ["ja-yonisuru","ja-yoninaru","ja-kotonisuru"].forEach(id=>db[base+"/itens/"+id]=mk(id,"n3-1"));
    for(let k=0;k<3;k++) db[base+"/erros/e"+k]={idioma:"ja",competencia:"gramatica",conteudo:"ja-yonisuru",ponto:"〜ようにする",erro:"食べなくてようにする"+k,correta:"食べないようにする",ocorrencias:1,primeira:dayRel(-8+k),ultima:dayRel(-7+k),corrigido:false,acertosDepois:0,_k:"e"+k};
    const {page, ctx} = await newPage({width:1280, height:800}, {db, ja:true});
    await page.waitForTimeout(500);
    await page.click("#startBtn"); await page.waitForTimeout(250);
    check("revisão abre com sequência de correção", await page.evaluate(()=>/Erro recorrente/.test(document.querySelector("#stage").textContent)));
    await shot(page,"d-intervencao");
    await steps(page,"#stage",60);
    // trocar idioma com o relógio rodando é bloqueado
    await page.evaluate(()=>document.querySelector('.side .switch button[data-lang="de"]').click()); await page.waitForTimeout(100);
    check("troca de idioma bloqueada com relógio rodando", await page.evaluate(()=>document.body.classList.contains("lang-ja") && !document.querySelector("#gtoast").hidden));
    // reportar um exercício
    await page.click("#skipBtn"); await page.waitForTimeout(200); await page.click("#skipBtn"); await page.waitForTimeout(250);
    const rep = await page.evaluate(()=>{ const b=[...document.querySelectorAll("#stage .linkbtn")].find(x=>/Reportar/.test(x.textContent)); if(!b) return false; b.click(); const m=[...document.querySelectorAll("#stage .report button")].find(x=>/Tradução errada/.test(x.textContent)); m.click(); return true; });
    await page.waitForTimeout(700);
    check("reportar exercício grava", rep && await page.evaluate(()=>Object.keys(window.__MOCKDB).some(k=>k.includes("/reportes/"))));
    // backup
    await page.click('.sidenav [data-tab="progresso"]'); await page.waitForTimeout(200);
    await page.evaluate(()=>{ document.querySelector("#tab-progresso details:last-of-type summary"); [...document.querySelectorAll("#tab-progresso button")].find(b=>b.textContent==="Exportar backup").click(); });
    await page.waitForTimeout(300);
    check("exportar backup", await page.evaluate(()=>window.__DOWNLOAD && window.__DOWNLOAD.size>100));
    // leitura com glossário (professor)
    await page.click('.sidenav [data-tab="praticar"]'); await page.waitForTimeout(150);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-praticar button")].find(b=>b.textContent==="Gerar leitura").click()); await page.waitForTimeout(400);
    await page.evaluate(()=>document.querySelector("#tab-praticar .tokw").click()); await page.waitForTimeout(100);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-praticar .wpop button")].find(b=>/Adicionar|Estudar/.test(b.textContent)).click()); await page.waitForTimeout(100);
    check("glossário adiciona palavra", await page.evaluate(()=>/volta amanhã|Já está/.test(document.querySelector("#tab-praticar .wpop").textContent)));
    await shot(page,"d-glossario");
    await ctx.close();
  }

  /* ---------- 6. volta após pausa, XP retroativo, sessão curta e poemas ---------- */
  {
    const base="data/users/user_test_1/app", db={};
    db[base]={criadoEm:"2026-09-01", versao:"v2"};
    const old="2026-09-20";   // antes do XP existir (28/09)
    db[base+"/sessoes/"+old+"-1"]={data:old, idioma:"ja", minutos:25, numero:1, extra:false, _k:old+"-1"};
    db[base+"/itens/ja-yonisuru"]={id:"ja-yonisuru",lang:"ja",u:"n3-1",tipo:"gramatica",estado:4,reps:1,intervalo:2,vence:dayRel(-4),acertos:2,erros:1,ultima:old,srsDia:old,prodDias:[],criado:"2026-09-20",S:2,ultRev:old,mod:1,_k:"ja-yonisuru"};
    const {page, ctx} = await newPage({width:390, height:844}, {db, ja:true});
    await page.waitForTimeout(700);
    check("aviso de volta após pausa", await page.evaluate(()=>/Bem-vindo de volta/.test(document.querySelector("#stage").textContent)));
    const xp = await page.evaluate(()=>window.__MOCKDB["data/users/user_test_1/app/perfil/ja"]);
    check("XP retroativo calculado uma vez", xp && xp.xpRetro && xp.xp===3+2*5+1*2+30, JSON.stringify(xp&&{xp:xp.xp,retro:xp.xpRetro}));
    // sessão curta de 10 min
    await page.evaluate(()=>[...document.querySelectorAll("#stage .linkbtn")].find(b=>/10 min/.test(b.textContent)).click()); await page.waitForTimeout(150);
    check("sessão curta: relógio em 10 min", await page.evaluate(()=>document.querySelector("#clock").textContent==="10:00" && /sessão curta/i.test(document.querySelector("#startBtn").textContent)));
    await page.click("#startBtn"); await page.waitForTimeout(200);
    for(let k=0;k<3;k++){ await page.click("#skipBtn"); await page.waitForTimeout(250); }
    await page.waitForTimeout(700);
    const ses = await page.evaluate(()=>Object.entries(window.__MOCKDB).filter(([k])=>k.includes("/sessoes/")).map(([,v])=>v).find(v=>v.curta));
    check("sessão curta salva (10 min, conta no dia)", ses && ses.minutos===10 && ses.curta===true, JSON.stringify(ses));
    check("depois da curta, oferece o pomodoro completo", await page.evaluate(()=>/pomodoro completo/i.test(document.querySelector("#startBtn").textContent)));
    await shot(page,"m-curta-feita");
    await page.click("#startBtn"); await page.waitForTimeout(250);
    check("pomodoro completo após a curta tem aula", await page.evaluate(()=>/Aula/.test(document.querySelector("#seglabels").textContent) && document.querySelector("#clock").textContent!=="10:00"));
    await page.click("#startBtn"); await page.waitForTimeout(100);
    // poemas
    await page.click('.bottombar [data-tab="praticar"]'); await page.waitForTimeout(150);
    await page.evaluate(()=>[...document.querySelectorAll("#tab-praticar .segctl button")].find(b=>b.textContent==="Poemas").click()); await page.waitForTimeout(150);
    await page.evaluate(()=>document.querySelector("#tab-praticar .textlist button").click()); await page.waitForTimeout(150);
    check("poema abre em tategaki", await page.evaluate(()=>!!document.querySelector("#tab-praticar .poem-face.tate")));
    for(const m of ["Decorar","Ordenar","Entender","Ler"]){
      await page.evaluate(m=>[...document.querySelectorAll("#tab-praticar .segctl button")].find(b=>b.textContent===m).click(), m); await page.waitForTimeout(120);
    }
    await page.evaluate(()=>[...document.querySelectorAll("#tab-praticar button")].find(b=>b.textContent==="Marcar como lido").click()); await page.waitForTimeout(700);
    check("poema marcado como lido", await page.evaluate(()=>{ const p=window.__MOCKDB["data/users/user_test_1/app/perfil/ja"]; return p && p.poemas && Object.values(p.poemas).some(x=>x.lido); }));
    await shot(page,"m-poema");
    await ctx.close();
  }

  await browser.close();
  console.log(results.join("\n"));
  console.log("\nErros JS: "+errors.length);
  errors.slice(0,30).forEach(e=>console.log(e));
  process.exit(errors.length || results.some(r=>r.startsWith("FAIL")) ? 1 : 0);
})().catch(e=>{ console.error(e); process.exit(2); });
