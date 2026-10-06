/* Simula window.claude (db, user, sample, downloads) para testar o app fora do Claude. */
(function(){
  const store = (window.__MOCKDB = window.__MOCKDB || {});   // caminho → dados
  const listeners = [];
  const clone = x => JSON.parse(JSON.stringify(x));
  function notify(){ listeners.forEach(f=>{ try{ f(); }catch(e){ console.error(e); } }); }
  function docRef(path){
    return {
      path,
      async get(){ const d=store[path]; return {exists: d!==undefined, id: path.split("/").pop(), data: ()=> d===undefined ? undefined : Object.freeze(clone(d))}; },
      async set(v){ if(JSON.stringify(v).length>900000) throw {code:"too_large"}; store[path]=clone(v); setTimeout(notify,0); },
      async update(v){ store[path]=Object.assign({}, store[path]||{}, clone(v)); setTimeout(notify,0); },
      async delete(){ delete store[path]; setTimeout(notify,0); },
      collection(name){ return colRef(path+"/"+name); }
    };
  }
  function colRef(path, opts){
    opts=opts||{};
    const q={
      doc(id){ if(!/^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(id)) throw new Error("bad id "+id); return docRef(path+"/"+id); },
      orderBy(f,dir){ return colRef(path, Object.assign({}, opts, {order:[f,dir]})); },
      limit(n){ return colRef(path, Object.assign({}, opts, {limit:n})); },
      where(){ return q; },
      snapshot(){
        let docs=Object.keys(store).filter(k=>k.startsWith(path+"/") && k.slice(path.length+1).indexOf("/")<0)
          .map(k=>({id:k.slice(path.length+1), data:()=>Object.freeze(clone(store[k]))}));
        if(opts.order){ const [f,dir]=opts.order; docs.sort((a,b)=>{ const x=a.data()[f], y=b.data()[f]; return (x<y?-1:x>y?1:0)*(dir==="desc"?-1:1); }); }
        if(opts.limit) docs=docs.slice(0,opts.limit);
        return {docs, size:docs.length};
      },
      async get(){ return q.snapshot(); },
      onSnapshot(cb, err){ const f=()=>cb(q.snapshot()); listeners.push(f); setTimeout(f,0); return ()=>{ const i=listeners.indexOf(f); if(i>=0) listeners.splice(i,1); }; }
    };
    return q;
  }
  const db = { doc: docRef, collection: colRef };
  const user = { id: async()=> "user_test_1", isOwner: ()=>true, canEdit: ()=>true, me: async()=>({id:"user_test_1"}) };

  function fakeJSON(prompt){
    const p = typeof prompt==="string" ? prompt : prompt.map(m=>m.content).join("\n");
    const ja = /japonês/.test(p) && !/alemão/.test(p.split("\n")[0]);
    window.__AI_CALLS = (window.__AI_CALLS||0)+1;
    if(/Responda SEMPRE só com JSON: \{"fala"/.test(p) || /"fala"/.test(p))
      return ja ? {fala:"いらっしゃいませ。何をお探しですか。", leitura:"いらっしゃいませ。 なにを おさがし ですか。", traducao:"Bem-vindo. O que procura?", correcao:{ok:false, corrigida:"お弁当はありますか。", explicacao:"Use ありますか para perguntar se tem."}, dica:"Pergunte se tem bentô."}
                : {fala:"Guten Tag! Was darf es sein?", leitura:"", traducao:"Bom dia! O que vai ser?", correcao:{ok:true, corrigida:"", explicacao:""}, dica:"Peça um pão."};
    if(/método da palavra-chave/.test(p)) return {chave:"neko = néctar", cena:"Um gato bebendo néctar de uma flor gigante.", partes:""};
    if(/a partir dos erros reais dele/.test(p)) return [{id: ja?"ja-yonisuru":"", s: ja?"毎日野菜を食べる＿＿＿。":"Ich ___ jeden Tag.", o: ja?["ようにしている","ようになっている","ことになっている","ことだ"]:["lerne","lernt","lernen","gelernt"], k:"", t:"teste", w:"porque sim"},{id:"", s: ja?"これは＿＿＿です。":"Das ist ___.", o: ja?["テスト","てすと","test","テスツ"]:["gut","guten","gutem","guter"], k:"", t:"teste", w:"porque sim"}];
    if(/Corrija o diário dele/.test(p)) return {frases:[{original: ja?"今日は仕事が忙しいでした。":"Heute ich war müde.", corrigida: ja?"今日は仕事が忙しかったです。":"Heute war ich müde.", leitura: ja?"きょうは しごとが いそがしかった です。":"", ok:false, erros:[{errado: ja?"忙しいでした":"ich war", certo: ja?"忙しかったです":"war ich", porque:"Adjetivo い no passado.", ponto:""}]},{original: ja?"晩ご飯を食べました。":"Ich habe gegessen.", corrigida: ja?"晩ご飯を食べました。":"Ich habe gegessen.", ok:true, erros:[]}], natural: ja?"今日は仕事が忙しかった。":"Heute war ich müde.", desafioOk:false, comentario:"Bom começo."};
    if(/Prepare uma leitura com glossário/.test(p) && /JÁ conhece/.test(p))
      return ja ? {titulo:"雨の日", frases:[{seg:[{s:"今日",r:"きょう",m:"hoje",b:"今日"},{s:"は"},{s:"豪雨",r:"ごうう",m:"chuva forte",b:"豪雨",novo:true},{s:"です"},{s:"。"}],t:"Hoje está chovendo forte."}], perguntas:[{q:"Como está o tempo?",o:["Chuvoso","Ensolarado","Nevando","Ventando"]}]}
                : {titulo:"Regen", frases:[{seg:[{s:"Heute",m:"hoje",b:"heute"},{s:"schüttet",m:"chove forte",b:"schütten",novo:true},{s:"es"},{s:"."}],t:"Hoje chove forte."}], perguntas:[{q:"Como está o tempo?",o:["Chuvoso","Ensolarado","Nevando","Ventando"]}]};
    if(/Prepare uma leitura com glossário/.test(p))
      return ja ? {titulo:"雨の日", frases:[{seg:[{s:"今日",r:"きょう",m:"hoje",b:"今日"},{s:"は"},{s:"雨",r:"あめ",m:"chuva",b:"雨"},{s:"です"},{s:"。"}],t:"Hoje está chovendo."}], perguntas:[{q:"Como está o tempo?",o:["Chuvoso","Ensolarado","Nevando","Ventando"]}]}
                : {titulo:"Regen", frases:[{seg:[{s:"Heute",m:"hoje",b:"heute"},{s:"regnet",m:"chove",b:"regnen"},{s:"es"},{s:"."}],t:"Hoje chove."}], perguntas:[{q:"Como está o tempo?",o:["Chuvoso","Ensolarado","Nevando","Ventando"]}]};
    if(/Avalie gramática, uso do ponto/.test(p)) return {ok:true, usouPonto:true, corrigida:"テストの文です。", leitura:"てすとの ぶん です。", traducao:"É uma frase de teste.", explicacao:"Correto."};
    if(/método Feynman/.test(p)) return {nota:3, claro:"Explicou bem o uso.", lacunas:["Faltou o contraste."], exemploOk:true, correcaoExemplo:"", pergunta:"Qual a diferença?", simples:"Explicação simples."};
    if(/Liste 10 kanji/.test(p)) return [{k:"覧",on:"ラン",kun:"—",m:"olhar; ver",words:[["一覧","いちらん","lista"],["観覧","かんらん","visita"]]},{k:"漢",on:"カン",kun:"—",m:"China; homem",words:[["漢字","かんじ","kanji"]]},{k:"x",on:"",kun:"",m:"inválido",words:[]}];
    if(/Liste 20 palavras/.test(p)) return ja ? [{w:"試験官",r:"しけんかん",m:"examinador",ex:"試験官が来た",exr:"しけんかんが きた",ext:"o examinador veio"}] : [{a:"der",w:"Prüfer",pl:"die Prüfer",m:"examinador",ex:"Der Prüfer kommt.",ext:"O examinador vem."}];
    if(/Para CADA ponto abaixo/.test(p)){ const ids=[...p.matchAll(/- id ([^:]+):/g)].map(m=>m[1]); const out={}; ids.forEach(id=>out[id]=[{s: ja?"これは＿＿＿です。":"Das ist ___.", o: ja?["テスト","てすと","test","テスツ"]:["gut","guten","gutem","guter"], k:"", t:"teste", w:"porque sim"}]); return out; }
    if(/exercícios de múltipla escolha/.test(p)) return [{s: ja?"これは＿＿＿です。":"Das ist ___.", o: ja?["テスト","てすと","test","テスツ"]:["gut","guten","gutem","guter"], k:"", t:"teste", w:"porque sim"}];
    if(/texto curto de leitura/.test(p)) return {titulo:"Teste", frases:[{f: ja?"今日は雨です。":"Heute regnet es.", k: ja?"きょうは あめ です。":"", t:"Hoje chove."}], perguntas:[{q:"Tempo?",o:["Chuva","Sol","Neve","Vento"]}]};
    return {};
  }
  const sample = async function(input, opts){ const t="Resposta de teste do professor."; if(opts&&opts.onText) opts.onText({text:t, delta:t}); return {text:t, truncated:false}; };
  sample.json = async function(input, opts){ await new Promise(r=>setTimeout(r,30)); return fakeJSON(input); };
  sample.limits = async ()=>({images:false});
  const downloads = { save: async ({filename, data})=>{ window.__DOWNLOAD={filename, size:String(data).length, data:String(data).slice(0,3000)}; return {status:"saved"}; } };
  const caps = { db, user, sample, downloads };
  window.claude = { use: async (name)=> { await new Promise(r=>setTimeout(r,20)); return window.__NOAI && name==="sample" ? null : (caps[name]||null); } };
})();
