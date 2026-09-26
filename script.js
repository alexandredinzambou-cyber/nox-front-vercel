/* ============ PORTAIL DE CONNEXION — code d'accès via Telegram ============
   Le code est créé/distribué par le bot Telegram (/code : 3 jours, 1 mois,
   pour toujours). À CHAQUE chargement de page (et toutes les 5 min), la durée
   est revérifiée via /api/auth/check. Code invalide ou expiré → écran
   « Accès refusé — contactez l'admin ». */
const AUTH_KEY='nox_auth_code';
const AUTH_CHECK_MS=5*60*1000;   /* revérification périodique de session */
/* Les appels auth utilisent des chemins same-origin (/api/auth/*). */
const authFetchUrl=(p)=>p;

function authShow(step){
  const gate=document.getElementById('authGate');if(!gate)return;
  ['authStepLogin','authStepDenied','authStepOk'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  const target=document.getElementById(step);if(target)target.style.display='';
  gate.style.display='';
  document.body.classList.add('auth-locked');
  if(step==='authStepLogin'){const inp=document.getElementById('authCode');if(inp)setTimeout(()=>inp.focus(),120);}
}
function authUnlock(){
  const gate=document.getElementById('authGate');if(gate)gate.style.display='none';
  document.body.classList.remove('auth-locked');
}
function authFail(msg){
  const el=document.getElementById('authDeniedMsg');if(el&&msg)el.textContent=msg;
  authShow('authStepDenied');
}
/* Contre l'appui rapide sur Entrée pendant la vérification. */
let authBusy=false;
async function authVerify(rawCode){
  if(authBusy)return;
  authBusy=true;
  const btn=document.getElementById('authSubmit');const err=document.getElementById('authError');
  const inp=document.getElementById('authCode');
  if(btn){btn.disabled=true;btn.textContent='Vérification…';}
  if(err)err.style.display='none';
  try{
    const r=await fetch(authFetchUrl('/api/auth/verify'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:rawCode}),signal:AbortSignal.timeout(15000)});
    const d=await r.json().catch(()=>({ok:false,reason:'error'}));
    if(d&&d.ok){
      try{localStorage.setItem(AUTH_KEY,rawCode);}catch(e){}
      const okMsg=document.getElementById('authOkMsg');
      if(okMsg){
        const rest=d.exp?('Accès '+d.label+' — valable jusqu\'au '+new Date(d.exp).toLocaleDateString('fr-FR')):('Accès '+d.label+'.');
        okMsg.textContent=rest;
      }
      authShow('authStepOk');
      setTimeout(authUnlock,1100);
    }else{
      const reason=(d&&d.reason)||'invalid';
      if(inp){inp.classList.add('shake');setTimeout(()=>inp.classList.remove('shake'),450);}
      if(reason==='error'){
        /* Le serveur n'a pas pu être joint (réseau/proxy) : le code n'est ni
           validé ni effacé — on n'affiche PAS « invalide ». */
        if(err){err.textContent='Serveur injoignable — vérifie ta connexion puis réessaie.';err.style.display='';}
      }else{
        /* Code invalide/expiré → on efface la session locale + écran admin. */
        try{localStorage.removeItem(AUTH_KEY);}catch(e){}
        authFail(reason==='expired'?'Ce code a expiré.':'Ce code est invalide.');
      }
    }
  }catch(e){
    if(err){err.textContent='Serveur injoignable — réessaie dans un instant.';err.style.display='';}
  }finally{
    authBusy=false;
    if(btn){btn.disabled=false;btn.textContent='Se connecter';}
  }
}
/* Vérification de session : au chargement ET périodiquement (durée consommée ?). */
async function authCheck(){
  let code='';try{code=localStorage.getItem(AUTH_KEY)||'';}catch(e){}
  try{
    const r=await fetch(authFetchUrl('/api/auth/check?code='+encodeURIComponent(code)),{signal:AbortSignal.timeout(15000)});
    /* Route absente / serveur absent (front statique découplé, ex : Vercel +
       addon FrenchStream indépendant) : on déverrouille pour ne pas bloquer
       l'accès au contenu. Un vrai serveur d'auth répond toujours 200. */
    if(!r.ok){authUnlock();return true;}
    const d=await r.json().catch(()=>({ok:false,reason:'error'}));
    if(d&&d.ok){authUnlock();return true;}
    /* Erreur réseau (serveur injoignable) : on NE touche PAS à la session
       locale — le code pourrait être parfaitement valide. */
    if(d&&d.reason==='error')return false;
    /* Refus définitif du serveur : si un code était mémorisé → écran
       « contacter l'admin » ; sinon (première visite) → écran de saisie. */
    /* (Chemins conservés : une réintégration ultérieure d'un backend d'auth
       refonctionnera sans modification du front.) */
    try{localStorage.removeItem(AUTH_KEY);}catch(e){}
    if(code)authFail(d.reason==='expired'?'Ton code d\'accès a expiré.':'Ton code d\'accès n\'est plus valide.');
    else authShow('authStepLogin');
    return false;
  }catch(e){
    /* Échec réseau / route absente (front découplé du serveur d'auth
       Content-Nexora) : le portail est informatif — on déverrouille pour ne
       pas bloquer l'accès au contenu. */
    authUnlock();
    return true;
  }
}
/* Déconnexion : ferme la session CÔTÉ SERVEUR (sinon /api/auth/check
   périodique recréerait une session glissante), efface le code mémorisé
   localement puis réaffiche le portail de connexion. */
async function authLogout(){
  let code='';try{code=localStorage.getItem(AUTH_KEY)||'';}catch(e){}
  if(code){
    try{
      await fetch(authFetchUrl('/api/auth/logout'),{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({code:code}),signal:AbortSignal.timeout(8000)});
    }catch(e){}   /* même si le serveur est injoignable, on déconnecte localement */
  }
  try{localStorage.removeItem(AUTH_KEY);}catch(e){}
  const inp=document.getElementById('authCode');if(inp)inp.value='';
  if(typeof closeMobileMenu==='function')closeMobileMenu();
  authShow('authStepLogin');
}
(function initAuthGate(){
  const gate=document.getElementById('authGate');if(!gate)return;
  document.body.classList.add('auth-locked');
  authShow('authStepLogin');
  const form=document.getElementById('authForm');
  if(form)form.addEventListener('submit',e=>{e.preventDefault();const inp=document.getElementById('authCode');if(inp&&inp.value.trim())authVerify(inp.value.trim());});
  const retry=document.getElementById('authRetry');
  if(retry)retry.onclick=()=>{const inp=document.getElementById('authCode');if(inp)inp.value='';authShow('authStepLogin');};
  /* Normalisation de la saisie : majuscules + tirets automatiques. */
  const inp=document.getElementById('authCode');
  if(inp)inp.addEventListener('input',()=>{
    let v=inp.value.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,14);
    inp.value=v;
  });
  authCheck().then(ok=>{if(!ok)authShow('authStepLogin');});
  setInterval(authCheck,AUTH_CHECK_MS);
  /* Bouton(s) « Se déconnecter » : navbar, menu mobile, vue profil. */
  document.querySelectorAll('[data-logout]').forEach(el=>{el.addEventListener('click',e=>{e.preventDefault();authLogout();});});
})();

/* ============ NOX — Données & Interactions ============ */
const C = [
 {id:1,t:'Lumen',y:2025,k:'film',g:['SF','Thriller'],m:132,d:'Dans une cité où la lumière est devenue monnaie, une orpheline découvre qu\'elle peut voler les souvenirs codés dans les photons.',a:['Maeve Laurent','Ilias Kader','June Park']},
 {id:2,t:'Vertige',y:2024,k:'serie',g:['Drame','Mystère'],m:2,d:'Une alpiniste reprend la compétition après un accident et découvre que sa chute n\'était pas un accident.',a:['Chloé Amrani','Théo Vasseur','Lina Morel']},
 {id:3,t:'Nocturne',y:2025,k:'serie',g:['Fantastique','Action'],m:3,d:'Chaque nuit, la ville change de lois physiques. Deux détectives patrouillent entre les deux mondes.',a:['Adam Sorel','Nora Belaid','Viktor Hale']},
 {id:4,t:'Parallaxe',y:2024,k:'film',g:['Thriller','Espionnage'],m:118,d:'Un cartographe détecte un pays qui n\'existe sur aucune carte — et une agence veut le silence.',a:['Selma Ruys','Marc Duvall']},
 {id:5,t:'Éther',y:2023,k:'film',g:['Drame','SF'],m:104,d:'Un ingénieur du son capte une fréquence qui semble venir de lui-même, vingt ans plus tôt.',a:['Julien Ross','Anna Kessler']},
 {id:6,t:'Ombra',y:2025,k:'serie',g:['Policier','Noir'],m:1,d:'Inspectrice à Rome, elle chasse un tueur qui ne frappe que pendant les éclipses.',a:['Bianca Ferri','Luca Marino']},
 {id:7,t:'Axiome',y:2024,k:'film',g:['SF','Action'],m:127,d:'Si l\'univers est une simulation, qui a écrit la mise à jour de cette nuit ?',a:['Kai Tanaka','Emma Silva','Ray Okoye']},
 {id:8,t:'Mirage',y:2023,k:'serie',g:['Aventure','Mystère'],m:2,d:'Une expédition dans le désert découvre une cité mirage qui se souvient d\'eux.',a:['Yasmine Dridi','Paul Avern','Dita Kovac']},
 {id:9,t:'Quasar',y:2025,k:'film',g:['SF','Aventure'],m:141,d:'L\'équipage d\'un cargo suit un signal émis depuis le cœur d\'un quasar. Personne n\'aurait dû répondre.',a:['Nils Berg','Ola Chen','Sam Okonjo']},
 {id:10,t:'Résonance',y:2024,k:'serie',g:['Thriller','Drame'],m:2,d:'Une neurologue découvre que ses rêves sont partagés avec un inconnu.',a:['Iris Novak','Hugo Lambert']},
 {id:11,t:'Zénith',y:2025,k:'film',g:['Aventure','Drame'],m:112,d:'Le dernier vol d\'une légende de l\'aéronautique, à la verticale du soleil.',a:['Pierre Ansart','Maya Dupont']},
 {id:12,t:'Cryo',y:2023,k:'serie',g:['SF','Horreur'],m:1,d:'Réveillés 300 ans plus tôt, dix passagers comprennent que le vaisseau les a triés.',a:['Eva Lindqvist','Dario Fontaine']}
];
C.push(
 {id:13,t:'Polaris',y:2024,k:'film',g:['Drame','Aventure'],m:98,d:'Une guides polaires et un déserteur traversent la nuit blanche arctique.',a:['Frida Aas','Jonas Weil']},
 {id:14,t:'Spectra',y:2025,k:'serie',g:['Action','Fantastique'],m:2,d:'Des voleurs qui manipulent le spectre visible braquent des banques… invisibles.',a:['Zoé Marchal','Kenji Sato','Nadia Belt']},
 {id:15,t:'Onyx',y:2023,k:'film',g:['Noir','Policier'],m:121,d:'Un diamant noir, un flic suspendu, une nuit de 8 heures.',a:['Franck Ollier','Céleste Ngoy']},
 {id:16,t:'Halcyon',y:2025,k:'serie',g:['Drame','Romance'],m:1,d:'Deux pensionnaires d\'une résidence pour surdoués inventent un langage privé.',a:['Lou Berthier','Emre Aydin']},
 {id:17,t:'Volt',y:2024,k:'film',g:['Action','SF'],m:109,d:'Après une panne mondiale de 9 secondes, certains ont hérité d\'un pouvoir et d\'une dette.',a:['Chris Mbayo','Alba Ruiz']},
 {id:18,t:'Aurora',y:2025,k:'serie',g:['Drame','Famille'],m:3,d:'Sur trois générations, une famille suit les aurores boréales comme une carte du destin.',a:['Ingrid Halvorsen','Leo Tremblay']},
 {id:19,t:'Umbra',y:2023,k:'film',g:['Horreur','Mystère'],m:96,d:'L\'ombre d\'un enfant refuse de suivre la lumière du matin.',a:['Sarah Boone','Malik Osman']},
 {id:20,t:'Kairos',y:2024,k:'serie',g:['SF','Drame'],m:2,d:'Une scientifique peut rembobiner 30 secondes. Une seule fois par jour.',a:['Dana Sharif','Oscar Vidal','Ruth Eloy']},
 {id:21,t:'Silence',y:2025,k:'film',g:['Thriller','Horreur'],m:87,d:'Une chorale doit chanter en silence pour survivre à la nuit.',a:['Vera Klein','Tom Adeyemi']},
 {id:22,t:'Nébuleuse',y:2024,k:'serie',g:['SF','Aventure'],m:1,d:'Un orphelinat spatial entre deux nébuleuses, dirigé par une IA bienveillante… en apparence.',a:['Milou Faure','Iris Nakamura']},
 {id:23,t:'Helios',y:2023,k:'film',g:['Drame','SF'],m:133,d:'La dernière mission solaire emporte un passager clandestin : le concepteur du vaisseau.',a:['Anton Vega','Julia Marr']},
 {id:24,t:'Éclipse',y:2025,k:'serie',g:['Fantastique','Romance'],m:2,d:'Ils ne peuvent se rencontrer que durant les 4 minutes d\'une éclipse.',a:['Ava Morin','Silas Brandt']}
);
/* Affiches : URL directes (addon FS, metahub Cinemeta), repli picsum. */
const img=(id,w,h)=>{const x=byId(id);
  if(x&&x.p)return x.p;
  if(x&&x.b)return x.b;
  return `https://picsum.photos/seed/nox${id}/${w}/${h}`;};
const imgBg=id=>{const x=byId(id);return x&&x.b?x.b:img(id,1920,1080);};
/* Tolérant aux ids : numérique (films/séries/animés) ou chaîne Mongo (dramas). */
const byId=id=>C.find(x=>x.id==id);
const dur=x=>!x.m?'—':x.k==='serie'?`${x.m} saison${x.m>1?'s':''}`:`${Math.floor(x.m/60)} h ${String(x.m%60).padStart(2,'0')} min`;
/* ---- Réglages de lecture (page Profil) — helpers globaux ----
   Persistés dans localStorage (nox_settings). Définis ici en haut de fichier
   pour être utilisables partout (hero, lecteur, compte à rebours…). */
const SETTINGS_KEY='nox_settings';
function loadSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY))||{};}catch(e){return {};}}
function saveSettings(s){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));}catch(e){}}
function getSetting(key,dflt){const s=loadSettings();return (key in s)?s[key]:dflt;}
function setSetting(key,val){const s=loadSettings();s[key]=val;saveSettings(s);}
/* Badge « Nouveau » : sorti il y a moins de 30 jours (date exacte si connue,
   sinon repli sur l'année en cours pour les données sans rd). */
const NOUV_DAYS=30;
const isNewRelease=x=>{
  const d=String(x.rd||'').slice(0,10);
  if(d){
    const days=(Date.now()-Date.parse(d))/86400000;
    return days>=0&&days<NOUV_DAYS;
  }
  return String(x.y)===String(new Date().getFullYear());
};
const CARD=(x,o={})=>`<article class="card" data-id="${x.id}">
  <div class="card-poster">${isNewRelease(x)?'<span class="badge-new">Nouveau</span>':''}<img loading="lazy" src="${img(x.id,400,600)}" alt="${x.t}" onerror="noxFallbackPoster(this)"><div class="card-tint"></div>
    <button class="btn-play" aria-label="Lire ${x.t}"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
    <div class="card-info"><span class="match">94 %</span> <span class="card-meta" style="display:inline">${x.y||'—'} • ${dur(x)}</span>
    <div style="display:flex;gap:.35rem;margin-top:.45rem;flex-wrap:wrap">${(x.g||[]).slice(0,2).map(g=>`<span class="chip">${g}</span>`).join('')}</div></div>
    <div class="card-name">${x.t}</div>
    ${o.p!=null?`<div style="position:absolute;left:.85rem;right:.85rem;bottom:.55rem;z-index:3"><div class="progress"><i style="width:${o.p}%"></i></div></div>`:''}
  </div></article>`;
/* Fallback poster : en cas d'échec de chargement (cache disque corrompu du
   navigateur, ERR_CACHE_READ_FAILURE, réseau…), on remplace l'image par un
   dégradé + initiales du titre — pas de carte vide. */
function noxFallbackPoster(el){
  if(!el||el.dataset.fbk==='1')return;
  el.dataset.fbk='1';
  const card=el.closest('.card');
  const name=(el.alt||'').trim();
  const init=(name||'?').split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
  el.removeAttribute('src');
  el.style.opacity='0';
  const ph=document.createElement('div');
  ph.className='nx-ph';
  ph.innerHTML=`<span>${init||'▦'}</span><small>${name}</small>`;
  (card||el.parentElement).appendChild(ph);
}
/* Bouton « Tout voir » : data-view désigne la vue cible (voir le handler délégué
   ci-dessous qui résout aussi les ids de rangées sans vue dédiée). */
const SEEALL=(v='films')=>`<span class="see-all" data-view="${v}" role="button" tabindex="0" aria-label="Tout voir">Tout voir <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></span>`;
/* ---- Bandes-annonces désactivées ----
   Les aperçus au survol des CARDS et la bande-annonce automatique du hero
   sont retirés (conteneurs .card-trailer/#heroTrailer retirés des templates,
   délégations et fetch de clé supprimés). Le réglage Profil « Lecture
   automatique des bandes-annonces » (nox_settings.trailer) est conservé :
   désormais sans effet. */
const TRAILERS_ENABLED=()=>getSetting('trailer',true);
const row=(title,items,o={})=>{
  const skel='<div class="skel"></div>'.repeat(8);
  return `<section class="row-sec" ${o.id?`id="${o.id}"`:''}>
  <div class="row-head"><h2 class="sec-title">${title}</h2>${SEEALL(o.id)}</div>
  <div style="position:relative">
    <button class="chev l" data-dir="-1" aria-label="Précédent"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg></button>
    <div class="row-track">${o.skel?skel:items.map((x,i)=>CARD(x,{p:o.p?o.p[i%o.p.length]:null})).join('')}</div>
    <button class="chev r" data-dir="1" aria-label="Suivant"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></button>
  </div></section>`;
};
const top10=items=>`<section class="row-sec" id="top10">
  <div class="row-head"><h2 class="sec-title">Top 10 en France aujourd'hui</h2>${SEEALL('top10')}</div>
  <div class="top10-track">${items.map((x,i)=>`<div class="t10" data-id="${x.id}"><span class="num">${String(i+1).padStart(2,'0')}</span><div class="p"><img loading="lazy" src="${img(x.id,400,600)}" alt="${x.t}"></div></div>`).join('')}</div></section>`;
/* ---- Hero rotatif ---- */
const FEAT=[byId(1),byId(9),byId(3),byId(20)];
let fi=0,ftimer;
const heroBg=document.getElementById('heroBg'),heroT=document.getElementById('heroTitle'),
heroD=document.getElementById('heroDesc'),heroY=document.getElementById('heroYear'),
heroDu=document.getElementById('heroDur'),heroP=document.getElementById('heroPosterImg'),
dots=document.getElementById('heroDots'),heroK=document.getElementById('heroKicker');
dots.innerHTML=FEAT.map(()=>'<button aria-label="Contenu suivant"><i></i></button>').join('');
const fillDot=()=>{[...dots.children].forEach((b,i)=>{const bar=b.firstElementChild;bar.classList.remove('on');bar.style.animation='none';bar.offsetHeight;if(i===fi){bar.style.animationDuration='8s';bar.classList.add('on');}});};
/* Les helpers « Vu récemment » sont déclarés plus bas (section POS_KEY). */
function setHero(i){
  fi=i;const x=FEAT[i];
  heroBg.style.opacity=0;
  setTimeout(()=>{heroBg.style.backgroundImage=`url(${imgBg(x.id)})`;heroBg.style.opacity=1;},250);
  heroP.src=img(x.id,400,600);heroP.alt=x.t;
  heroT.textContent=x.t.toUpperCase();heroD.textContent=x.d;
  heroY.textContent=x.y||'—';heroDu.textContent=dur(x);heroK.textContent=x.k==='serie'?'Original NOX — Série':'Original NOX — Film';
  fillDot();clearInterval(ftimer);ftimer=setInterval(()=>setHero((fi+1)%FEAT.length),8000);
}
[...dots.children].forEach((b,i)=>b.onclick=()=>setHero(i));
heroBg.style.transition='opacity .5s ease';
/* ---- Rendu des rangées (skeletons puis contenu) ---- */
const rows=document.getElementById('rows');
rows.innerHTML=row('Tendances actuelles',[],{skel:true})
 +row('Continuer avec Alex',[],{skel:true})
 +top10(C.slice(0,10))
 +row('Recommandé pour vous',[],{skel:true})
 +row('Nouveautés',[],{skel:true})
 +row('Vu récemment',[],{skel:true,id:'row-vurecent'});
/* Rangée accueil « Nouveautés » : même tri par date réelle que la vue dédiée. */
const nouvSorted=()=>nouvPool().slice().sort((NOUV_SORTS.recent).fn);
const LISTS=()=>[
 {title:'Tendances actuelles',items:C.filter(x=>x.k==='film').slice(0,10).map(x=>x.id),id:'films'},
 {title:'Continuer avec Alex',items:C.filter(x=>x.k==='serie').slice(0,5).map(x=>x.id),p:[62,34,81,12,45],id:'reprendre'},
 {title:'Recommandé pour vous',items:C.filter(x=>x.k==='serie').slice(5,15).map(x=>x.id),id:'series'},
 {title:'Nouveautés',items:nouvSorted().slice(0,10).map(x=>x.id),id:'nouveautes'}];
function fillHomeRows(){
  const secs=[...document.querySelectorAll('.row-sec')];
  LISTS().forEach(l=>{const sec=secs.find(s=>s.querySelector('.sec-title')?.textContent===l.title);
    if(!sec)return;sec.outerHTML=row(l.title,l.items.map(byId).filter(Boolean),{p:l.p,id:l.id});});
  const t10=document.getElementById('top10');if(t10)t10.outerHTML=top10(C.filter(x=>x.k!=='anime').slice(0,10));
  const vrRow=document.getElementById('row-vurecent');if(vrRow){const vu=vuRecentPool().slice(0,10);vrRow.outerHTML=vu.length?row('Vu récemment',vu,{id:'row-vurecent'}):'';}
  bindRows();bindCards();
}
setTimeout(fillHomeRows,700);
/* ---- Navbar ---- */
const nav=document.getElementById('nav');
addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>24),{passive:true});
/* ---- Chevrons ---- */
function bindRows(){document.querySelectorAll('.row-sec').forEach(sec=>{
  const tr=sec.querySelector('.row-track,.top10-track');if(!tr)return;
  sec.querySelectorAll('.chev').forEach(ch=>ch.onclick=()=>tr.scrollBy({left:+ch.dataset.dir*tr.clientWidth*.85,behavior:'smooth'}));});}
/* ---- Toast ---- */
const toast=document.getElementById('toast'),toastTxt=document.getElementById('toastTxt');let tt;
function showToast(msg){toastTxt.textContent=msg;toast.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>toast.classList.remove('show'),2600);}
/* ---- Modal ---- */
const modal=document.getElementById('modal');let cur=null;
/* ---- Ma liste : persistée dans localStorage (nox_mylist) ----
   Un Set en mémoire serait perdu à chaque rechargement ; on persiste les ids. */
const MYLIST_KEY='nox_mylist';
const myList=new Set();
(function loadMyList(){
  try{for(const v of (JSON.parse(localStorage.getItem(MYLIST_KEY))||[]))myList.add(v);}catch(e){}
})();
function saveMyList(){try{localStorage.setItem(MYLIST_KEY,JSON.stringify([...myList]));}catch(e){}}
/* Stats de la page Profil, calculées depuis nox_watch_positions (réelles). */
function updateProfileStats(){
  const all=loadPositions();
  const vals=Object.values(all);
  const secs=vals.reduce((s,p)=>s+(Number(p.t)||0),0);
  const done=vals.filter(p=>p.done).length;
  const started=vals.length;
  const wEl=document.getElementById('statWatch');
  if(wEl)wEl.textContent=secs>=3600?(Math.floor(secs/3600)+' h '+(Math.round((secs%3600)/60)+' min').trim()):(Math.max(1,Math.round(secs/60))+' min');
  const dEl=document.getElementById('statDone');if(dEl)dEl.textContent=done;
  const sEl=document.getElementById('statStarted');if(sEl)sEl.textContent=started;
}
function updateListCount(){const el=document.getElementById('statListe');if(el)el.textContent=myList.size;updateProfileStats();}
function syncLike(){if(!cur)return;const on=myList.has(cur.id);
  [document.getElementById('mLike'),document.getElementById('heroLike')].forEach(b=>{
    b.style.background=on?'var(--accent-soft)':'';b.style.borderColor=on?'var(--accent)':'';});}
function simCardHTML(x){return `<div class="sim-card" data-id="${x.id}"><img src="${img(x.id,200,300)}" alt="${x.t}"><div><p style="font-weight:600;font-size:.92rem">${x.t}</p><p style="font-size:.75rem;color:var(--muted);margin-top:.25rem">${x.y||'—'} • ${dur(x)}</p><span class="match" style="font-size:.72rem">92 %</span></div></div>`;}
function bindSimClicks(host){host.querySelectorAll('.sim-card').forEach(c=>c.onclick=()=>{
  const x=byId(+c.dataset.id)||byId(c.dataset.id);if(!x)return;
  if(x.k==='anime'){closeModal();goToAnime(x.slug);return;}
  if(x.k==='drama'){closeModal();goToDrama(x.bookId);return;}
  if(x.k==='serie'){closeModal();goToSeries(x.id);}else openModal(x.id);
});}
function openModal(id){cur=byId(+id)||byId(id);if(!cur||cur.k==='serie'||cur.k==='anime'){if(cur){if(cur.k==='anime')goToAnime(cur.slug);else goToSeries(cur.id);}return;}
  document.getElementById('mHeroImg').src=imgBg(cur.id);document.getElementById('mTitle').textContent=cur.t;
  document.getElementById('mDesc').textContent=cur.d;
  document.getElementById('mMeta').innerHTML=`<span class="match">96 % pour vous</span><span>${cur.y||'—'}</span><span>•</span><span>${dur(cur)}</span><span>•</span><span class="chip">16+</span><span>•</span><span class="chip" style="border-color:rgba(255,255,255,.3)">Film</span><span>•</span>${cur.g.join(', ')}`;
  document.getElementById('mCast').innerHTML=cur.a.map(a=>`<span class="cast-chip">${a}</span>`).join('');
  const sim=C.filter(x=>x.id!==cur.id&&x.g.some(g=>cur.g.includes(g))).slice(0,4);
  document.getElementById('mSim').innerHTML=sim.map(simCardHTML).join('');
  modal.classList.add('open');document.body.style.overflow='hidden';syncLike();
  bindSimClicks(document.getElementById('mSim'));enrichDetails(cur,'modal');}
function closeModal(){modal.classList.remove('open');document.body.style.overflow='';}
document.getElementById('modalClose').onclick=closeModal;
document.getElementById('modalBack').onclick=closeModal;
addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeSearch();closePlayer();closeMobileMenu();}});
function bindCards(){document.querySelectorAll('.card,.t10').forEach(el=>el.addEventListener('click',e=>{
  const item=byId(+el.dataset.id)||byId(el.dataset.id);if(!item)return;
  if(e.target.closest('.btn-play')){openPlayer(item);return;}
  if(item.k==='anime'){goToAnime(item.slug);return;}
  if(item.k==='drama'){goToDrama(item.bookId);return;}
  if(item.k==='serie')goToSeries(item.id);else openModal(item.id);}));}
document.getElementById('mLike').onclick=()=>{const on=myList.has(cur.id);on?myList.delete(cur.id):myList.add(cur.id);saveMyList();showToast(on?'Retiré de Ma liste':'« '+cur.t+' » ajouté à Ma liste');syncLike();updateListCount();renderCat();};
document.getElementById('mPlay').onclick=()=>{if(cur)openPlayer(cur);};
document.getElementById('heroPlay').onclick=()=>openPlayer(FEAT[fi]);
document.getElementById('heroMore').onclick=()=>{const x=FEAT[fi];if(x.k==='serie')goToSeries(x.id);else openModal(x.id);};
document.getElementById('heroLike').onclick=()=>{const x=FEAT[fi];const on=myList.has(x.id);on?myList.delete(x.id):myList.add(x.id);saveMyList();showToast(on?'Retiré de Ma liste':'« '+x.t+' » ajouté à Ma liste');syncLike();updateListCount();renderCat();};
/* ---- Page détail série (séparée du modal film) ---- */
const EPISODE_BLURBS=[
 'Une découverte change la donne pour toute l\'équipe.',
 'Un secret du passé refait surface au pire moment.',
 'La confiance entre les personnages est mise à l\'épreuve.',
 'Une course contre la montre s\'engage avant l\'aube.',
 'Un allié inattendu change le cours de l\'enquête.',
 'Les conséquences de l\'épisode précédent rattrapent le groupe.',
 'Une révélation redistribue toutes les cartes.',
 'Le calme avant une confrontation décisive.'
];
function genEpisodes(x,season,last){
  const count=Math.max(1,Math.min(FS_EP_MAX,Number(last)||1));
  return Array.from({length:count},(_,i)=>{
    const n=i+1;
    return {n,title:`Épisode ${n}`,dur:45,desc:''};
  });
}
let curSeries=null,curSeason=1;
function renderSeriesPage(id){
  const x=byId(id);if(!x||x.k!=='serie')return false;
  curSeries=x;curSeason=1;
  document.getElementById('sdBg').style.backgroundImage=`url(${imgBg(x.id)})`;
  document.getElementById('sdPoster').src=img(x.id,500,750);document.getElementById('sdPoster').alt=x.t;
  document.getElementById('sdTitle').textContent=x.t;
  document.getElementById('sdDesc').textContent=x.d;
  document.getElementById('sdMeta').innerHTML=`<span class="match">96 % pour vous</span><span>${x.y||'—'}</span><span>•</span><span>${dur(x)}</span><span>•</span><span class="chip">16+</span><span>•</span>${x.g.join(', ')}`;
  document.getElementById('sdCast').innerHTML=x.a.map(a=>`<span class="cast-chip">${a}</span>`).join('');
  renderSeasonTabs(x);
  renderEpisodes(x,1);
  syncSeriesResume(x);
  const sim=C.filter(o=>o.id!==x.id&&o.g.some(g=>x.g.includes(g))).slice(0,4);
  document.getElementById('sdSim').innerHTML=sim.map(simCardHTML).join('');
  bindSimClicks(document.getElementById('sdSim'));
  syncSeriesLike();
  enrichDetails(x,'serie');
  nxHydrateSeriesDetails(x);
  return true;
}
/* Charge la fiche + les saisons/épisodes réels. Le catalogue FS expose une
   ENTRÉE PAR SAISON (id tt par saison) : les autres saisons éventuelles sont
   retrouvées via la recherche FS (une seule requête) ; les épisodes viennent
   de Cinemeta (id tt, liste S/E réelle). Un fs: pur retombe sur la sonde FS. */
async function nxHydrateSeriesDetails(x){
  if(!x||x.k!=='serie')return;
  const isTt=/^tt\d+$/.test(String(x.id));
  const d=isTt?await cinemetaMeta('series',x.id):await nxSeriesDetails(x.fsId);
  if(curSeries!==x)return;
  if(d){
    if(d.description&&!x.d)x.d=d.description;
    if((d.genres||d.genre)&&(!x.g||!x.g.length))x.g=frGenres(d.genres||d.genre);
    if(!x.y)x.y=Number(String(d.year||d.releaseInfo||'').match(/\d{4}/)?.[0])||0;
    if(d.runtime&&!x.m)x.m=parseInt(d.runtime)||0;
    if(Array.isArray(d.cast)&&!x.a.length)x.a=d.cast.slice(0,5);
    if(d.poster&&!x.p)x.p=d.poster;
    if(d.background&&!x.b)x.b=d.background;
    document.getElementById('sdBg').style.backgroundImage=`url(${imgBg(x.id)})`;
    document.getElementById('sdPoster').src=img(x.id,500,750);
    document.getElementById('sdDesc').textContent=x.d||'Synopsis non disponible.';
    document.getElementById('sdCast').innerHTML=(x.a||[]).map(a=>`<span class="cast-chip">${a}</span>`).join('');
    document.getElementById('sdMeta').innerHTML=`<span class="match">96 % pour vous</span><span>${x.y||'—'}</span><span>•</span><span>${dur(x)}</span><span>•</span><span class="chip">16+</span><span>•</span>${(x.g||[]).join(', ')}`;
    renderCat();
  }
  if(isTt){
    /* Autres saisons disponibles sur FS (entrées « Titre - Saison N ») ? */
    await nxDetectSeriesSeasons(x);
    if(curSeries!==x)return;
    const vids=Array.isArray(d&&d.videos)?d.videos:[];
    const bySeason=new Map();
    for(const v of vids){
      if(!v||!v.season||!v.episode||v.season<1)continue;   /* skip S0 (spéciaux) */
      if(!bySeason.has(v.season))bySeason.set(v.season,[]);
      bySeason.get(v.season).push(v);
    }
    if(bySeason.size){
      x.m=Math.max(...bySeason.keys());
      x._seasons=[...bySeason.entries()].map(([season,eps])=>({season,
        episodes:eps.sort((a,b)=>a.episode-b.episode).map(v=>({
          n:v.episode,title:v.name||v.title||`Épisode ${v.episode}`,
          dur:parseInt(v.duration)||45,desc:v.overview||v.description||'',
          img:v.thumb||null}))}));
      renderSeasonTabs(x);
      renderEpisodes(x,curSeason);
      return;
    }
    /* Série tt sans videos Cinemeta : repli sur la sonde FS. */
    x.m=Math.max(x.m||1,Object.keys(x._fsSeasonIds||{1:1}).length||1);
    renderSeasonTabs(x);
    renderEpisodes(x,curSeason);
    return;
  }
  /* fs: pur : pas de liste d'épisodes exposée → sonde FS. */
  x.m=Math.max(x.m||1,1);
  renderSeasonTabs(x);
  renderEpisodes(x,curSeason);
}
/* Recherche FS : autres entrées « Titre - Saison N » de la même série →
   {numéro de saison → id FS} pour la lecture S/E. Cache sur l'item.
   Inutile pour les id tt : TOUTES les saisons partagent le même tt (l'addon
   choisit la bonne page via le paramètre S du /stream). */
async function nxDetectSeriesSeasons(x){
  if(x._fsSeasonIds)return;
  const ids={};
  ids[x.saison||1]=x.fsId!=null?x.fsId:x.id;
  if(/^tt\d+$/.test(String(x.id))){x._fsSeasonIds=ids;return;}
  try{
    const r=await fsFetch(fsUrl(`/catalog/series/frenchstream-series/search=${encodeURIComponent(x.t)}.json`),{signal:AbortSignal.timeout(60000)});
    if(r.ok){
      const d=await r.json();
      for(const m of ((d&&d.metas)||[])){
        if(!m||typeof m.id!=='string')continue;
        const ses=fsSeasonOf(m.name);
        const base=ses?ses.base:String(m.name||'').trim();
        if(base.trim().toLowerCase()!==String(x.t).trim().toLowerCase())continue;
        const sn=ses?ses.s:1;
        if(sn>=1&&sn<=40&&!ids[sn])ids[sn]=m.id;
      }
    }
  }catch(e){}
  x._fsSeasonIds=ids;
}
function renderSeasonTabs(x){
  const host=document.getElementById('sdSeasons');
  host.innerHTML=Array.from({length:x.m||1},(_,i)=>`<button class="f-chip${i===0?' on':''}" data-season="${i+1}">Saison ${i+1}</button>`).join('');
  host.querySelectorAll('.f-chip').forEach(b=>b.onclick=()=>{host.querySelectorAll('.f-chip').forEach(c=>c.classList.remove('on'));b.classList.add('on');curSeason=+b.dataset.season;renderEpisodes(curSeries,curSeason);});
}
function renderEpisodes(x,season){
  const ss=x._seasons;
  const seasonData=ss&&ss.find(s=>s.season===season);
  if(seasonData&&seasonData.episodes&&seasonData.episodes.length){
    paintEpisodes(x,season,seasonData.episodes.map(e=>({
      n:e.n,title:e.title||`Épisode ${e.n}`,dur:e.dur||45,desc:e.desc||'',img:e.img||null})));
  }else if((x._fsSeasonIds&&x._fsSeasonIds[season])||x.fsId!=null){
    /* FrenchStream : la liste d'épisodes n'est pas exposée par l'addon —
       on peint d'abord 1..8 (réactivité), puis la sonde /stream affine 1..N
       en arrière-plan (échec = simple absent de la liste, aucun flux mort). */
    paintEpisodes(x,season,genEpisodes(x,season,8));
    fsDetectLastEpisode(x,season).then(last=>{
      if(curSeries!==x)return;
      paintEpisodes(x,season,genEpisodes(x,season,last));
    });
  }else{
    paintEpisodes(x,season,genEpisodes(x,season));
  }
}
/* Épingle le dernier épisode réel : probe /stream/series/ID:S:E.json (id tt ou
   fs: — l'addon sait résoudre les deux). Le premier E sans flux (échec
   d'extraction FS) marque la fin ; la liste reste à min 1..8. */
const FS_EP_MAX=60;
async function fsDetectLastEpisode(x,season){
  const cacheKey='s'+season;
  x._fsLastEp=x._fsLastEp||{};
  if(x._fsLastEp[cacheKey])return x._fsLastEp[cacheKey];
  const baseId=(x._fsSeasonIds&&x._fsSeasonIds[season])||x.id;
  const hasStream=async ep=>{
    try{
      /* Les « : » sont légaux dans le chemin : pas d'encodage (format Stremio). */
      const r=await fsFetch(fsUrl(`/stream/series/${baseId}:${season}:${ep}.json`),{signal:AbortSignal.timeout(30000)});
      if(!r.ok)return false;
      const d=await r.json();
      return Array.isArray(d&&d.streams)&&d.streams.length>0;
    }catch(e){return false;}
  };
  let last=1;
  for(let ep=2;ep<=FS_EP_MAX;ep++){
    if(await hasStream(ep))last=ep;
    else break;
  }
  x._fsLastEp[cacheKey]=last;
  return last;
}
/* Badge « vu » : point vert sur les épisodes terminés (> 95 %) — listes drama,
   série et animé. L'épisode en cours affiche une barre de progression. */
function epWatchedBadge(item,n){
  const p=loadPositions()[posId(item)];
  if(!p)return '';
  if(p.episode>n||(p.episode===n&&p.done))return '<span class="ep-seen" title="Épisode vu"></span>';
  if(p.episode===n&&p.t>5)return `<span class="ep-prog" title="Épisode en cours"><i style="width:${Math.max(5,p.pct||5)}%"></i></span>`;
  return '';
}
function paintEpisodes(x,season,eps){
  const host=document.getElementById('sdEpisodes');
  host.innerHTML=eps.map(e=>`<div class="ep-row" data-n="${e.n}">
    <div class="ep-thumb">${epWatchedBadge(x,e.n)}<img loading="lazy" src="${e.img||img('ep-'+x.id+'-'+season+'-'+e.n,320,180)}" alt="${e.title}"><button class="ep-play" aria-label="Lire ${e.title}"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button></div>
    <div class="ep-body"><div class="ep-head"><span class="ep-num">${e.n}</span><h4>${e.title}</h4><span class="ep-dur">${e.dur} min</span></div><p>${e.desc}</p></div>
  </div>`).join('');
  host.querySelectorAll('.ep-row').forEach(rowEl=>{const n=+rowEl.dataset.n;rowEl.onclick=()=>openPlayer(curSeries,{season,episode:n});});
}
function syncSeriesLike(){if(!curSeries)return;const on=myList.has(curSeries.id);const b=document.getElementById('sdLike');
  b.style.background=on?'var(--accent-soft)':'';b.style.borderColor=on?'var(--accent)':'';}
/* Bouton « Reprendre » (série) : reprend épisode + position exacte. */
function syncSeriesResume(x){
  const btn=document.getElementById('sdResume'),lbl=document.getElementById('sdResumeLbl');
  if(!btn)return;
  const p=getPos(x);
  if(p&&p.episode){btn.style.display='';lbl.textContent=`Reprendre ép. ${p.episode} · ${fmtTime(p.t)}`;}
  else btn.style.display='none';
}
document.getElementById('sdResume').onclick=()=>{
  if(!curSeries)return;
  const p=getPos(curSeries);
  if(p&&p.episode)openPlayer(curSeries,{season:p.season||1,episode:p.episode});
  else document.getElementById('sdResume').style.display='none';
};
document.getElementById('sdBack').onclick=()=>{setView('series');history.replaceState(null,'','#series');};
document.getElementById('sdPlay').onclick=()=>{if(curSeries)openPlayer(curSeries,{season:1,episode:1});};
document.getElementById('sdLike').onclick=()=>{if(!curSeries)return;const on=myList.has(curSeries.id);on?myList.delete(curSeries.id):myList.add(curSeries.id);saveMyList();showToast(on?'Retiré de Ma liste':'« '+curSeries.t+' » ajouté à Ma liste');syncSeriesLike();updateListCount();renderCat();};
/* ---- Recherche ---- */
const sWrap=document.getElementById('searchWrap'),sInput=document.getElementById('searchInput'),
sPanel=document.getElementById('searchPanel'),sRes=document.getElementById('srResults'),sLbl=document.getElementById('srLabel');
const SEARCH_HIST_KEY='nox_search_history';
const GENRE_QUICK=['SF','Thriller','Drame','Action','Aventure','Policier','Horreur','Romance'];
function getHistory(){try{return JSON.parse(localStorage.getItem(SEARCH_HIST_KEY))||[];}catch(e){return [];}}
function pushHistory(q){if(!q)return;let h=getHistory().filter(x=>x.toLowerCase()!==q.toLowerCase());h.unshift(q);h=h.slice(0,5);try{localStorage.setItem(SEARCH_HIST_KEY,JSON.stringify(h));}catch(e){}}
function clearHistory(){try{localStorage.removeItem(SEARCH_HIST_KEY);}catch(e){}renderIdleSearch();}
function closeSearch(){sWrap.classList.remove('open');sPanel.classList.remove('show');sInput.value='';sInput.blur();}
function renderIdleSearch(){
  const hist=getHistory();
  sLbl.textContent=hist.length?'Historique':'Suggestions';
  const cats=`<div class="sr-cats">${GENRE_QUICK.map(g=>`<button class="f-chip" data-genre="${g}">${g}</button>`).join('')}</div>`;
  const histHtml=hist.length?`<div class="sr-hist"><span style="font-size:.72rem;color:var(--muted)">Récent</span><button data-clear>Effacer</button></div>${hist.map(h=>`<div class="sr-item" data-q="${h}"><div class="icon-btn" style="width:2.6rem;height:3.6rem;background:rgba(255,255,255,.05)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg></div><div><p style="font-weight:600;font-size:.88rem">${h}</p><p style="font-size:.74rem;color:var(--muted)">Recherche récente</p></div></div>`).join('')}`:'';
  sRes.innerHTML=cats+histHtml+renderSearchList(C.slice(0,4).map(x=>x.id),false);
  sRes.querySelectorAll('[data-genre]').forEach(b=>b.onclick=()=>{sInput.value=b.dataset.genre;sInput.dispatchEvent(new Event('input'));sInput.focus();});
  sRes.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{sInput.value=b.dataset.q;sInput.dispatchEvent(new Event('input'));sInput.focus();});
  const clr=sRes.querySelector('[data-clear]');if(clr)clr.onclick=clearHistory;
  bindSearchItemClicks();
}
document.getElementById('searchToggle').onclick=e=>{e.stopPropagation();sWrap.classList.add('open');sPanel.classList.add('show');sInput.focus();
  if(!sInput.value)renderIdleSearch();};
function renderSearchList(ids,label=true){
  if(label)sLbl.textContent='Résultats';
  return ids.map((id,i)=>{const x=byId(id);if(!x)return '';
  const se=x.k==='serie'&&x._searchSE?` • S${x._searchSE.season} É${x._searchSE.episode}`:'';
  return `<div class="sr-item" data-id="${id}" style="animation:rise .4s var(--ease) both;animation-delay:${i*60}ms"><img src="${img(id,100,150)}" alt="${x.t}"><div><p style="font-weight:600;font-size:.88rem">${x.t}</p><p style="font-size:.74rem;color:var(--muted)">${x.y||'—'} • ${x.g.join(', ')}${se}</p></div></div>`;}).join('');
}
function bindSearchItemClicks(){sRes.querySelectorAll('.sr-item[data-id]').forEach(it=>it.onclick=()=>{const x=byId(+it.dataset.id)||byId(it.dataset.id);if(!x)return;pushHistory(x.t);closeSearch();if(x.k==='anime')goToAnime(x.slug);else if(x.k==='drama')goToDrama(x.bookId);else if(x.k==='serie'){const se=x._searchSE;if(se)openPlayer(x,{season:se.season,episode:se.episode});else goToSeries(x.id);}else openModal(x.id);});}
let sTimer=null,sSeq=0;
/* Indicateur « Chargement » du panneau de recherche.
   (Ces helpers étaient appelés mais non définis → ReferenceError à chaque
   frappe dans la barre de recherche, qui tuait doSearch.) */
function srLoadingShow(){const el=document.getElementById('srLoading');if(el)el.classList.add('show');}
function srLoadingHide(){const el=document.getElementById('srLoading');if(el)el.classList.remove('show');}
/* ---- Recherche distante (partagée navbar + vues catalogue) ----
   FS d'abord (films + séries), repli Cinemeta : tout id tt trouvé reste
   lisible via l'addon (/stream/movie/tt… ou /stream/series/tt…:S:E). */
async function fsSearchItems(type,qRaw,limit=8){
  try{
    const catId=type==='series'?'frenchstream-series':'frenchstream-films';
    const r=await fsFetch(fsUrl(`/catalog/${type}/${catId}/search=${encodeURIComponent(qRaw)}.json`),{signal:AbortSignal.timeout(60000)});
    if(!r.ok)return [];
    const d=await r.json();
    return ((d&&d.metas)||[]).slice(0,limit).map(m=>nxMapNodeItem(m,type==='series'?'serie':'film'));
  }catch(e){return [];}
}
async function cinemetaCatalogSearch(type,qRaw,limit=8){
  try{
    const r=await fetch(`${CINEMETA_BASE.catalog}/${type}/top/search=${encodeURIComponent(qRaw)}.json`,{signal:AbortSignal.timeout(15000)});
    if(!r.ok)return [];
    const d=await r.json();
    return ((d&&d.metas)||[]).slice(0,limit);
  }catch(e){return [];}
}
async function cinemetaSearchItems(qRaw,limit=8){
  const [fm,fs]=await Promise.all([
    cinemetaCatalogSearch('movie',qRaw,limit),
    cinemetaCatalogSearch('series',qRaw,limit)]);
  return [...fm.map(r=>nxMapNodeItem(r,'film')),...fs.map(r=>nxMapNodeItem(r,'serie'))].slice(0,limit);
}
/* Recherche distante des barres des vues Films / Séries / Nouveautés : la
   recherche locale ne voit que le catalogue déjà chargé — celle-ci interroge
   FS (repli Cinemeta) et fusionne les nouveaux titres dans la grille. */
const catSearchSeq={films:0,series:0,nouveautes:0};
const CAT_SEARCH_GRID={films:'gridFilms',series:'gridSeries',nouveautes:'gridNouv'};
async function catLiveSearch(viewKey,qRaw){
  if(!qRaw||qRaw.trim().length<2){catRemoteHits[viewKey].clear();return;}
  if(!apiState.online)return;
  const q=qRaw.trim();
  const seq=++catSearchSeq[viewKey];
  const gridId=CAT_SEARCH_GRID[viewKey];
  nxLoadingShow(gridId);                        /* squelettes pendant la recherche */
  try{
    const types=viewKey==='films'?['movie']:viewKey==='series'?['series']:['movie','series'];
    const res=await Promise.all(types.map(t=>fsSearchItems(t,q,20)));
    if(seq!==catSearchSeq[viewKey])return;
    let items=dedupeById(res.flat());
    if(!items.length){
      const cm=await Promise.all(types.map(async t=>
        (await cinemetaCatalogSearch(t,q,20)).map(r=>nxMapNodeItem(r,t==='series'?'serie':'film'))));
      if(seq!==catSearchSeq[viewKey])return;
      items=dedupeById(cm.flat());
    }
    const have=new Set(C.map(x=>x.id));
    const fresh=items.filter(x=>x.id&&!have.has(x.id));
    if(items.length){
      /* Les hits distants de CETTE vue passent le filtre texte local. */
      const hits=catRemoteHits[viewKey];hits.clear();
      items.forEach(x=>hits.add(x.id));
    }
    if(fresh.length){
      C.push(...fresh);
      renderCatGenres();renderCat();
      fsBackfillYears();          /* fiches (année, affiches) en arrière-plan */
    }
  }finally{
    nxLoadingHide(gridId);
  }
}
async function doSearch(){
  const qRaw=sInput.value.trim();
  if(!qRaw){renderIdleSearch();return;}
  const seq=++sSeq,q=qRaw.toLowerCase();
  /* Recherche S/E avancée : « titre S2E5 » (ou « titre saison 2 épisode 5 »)
     → la requête est nettoyée et les résultats séries portent S/E pré-remplis
     (le clic lance directement le bon épisode). */
  const seM=qRaw.match(/\b[Ss](\d{1,2})\s*[-–]?\s*[EÉé](\d{1,3})\b/)
    ||qRaw.match(/\bsaison\s*(\d{1,2})\s*[,\s]+\s*épisode\s*(\d{1,3})\b/i);
  const searchQ=seM?qRaw.slice(0,seM.index).trim()||qRaw:qRaw;
  const seSE=seM?{season:+seM[1],episode:+seM[2]}:null;
  if(apiState.online){
    srLoadingShow();sLbl.textContent='Recherche…';
    const [dm,ds,da,dd]=await Promise.all([
      fsSearchItems('movie',searchQ),
      fsSearchItems('series',searchQ),
      animeState.online?animeCatalog(searchQ,8):Promise.resolve([]),
      dramaState.online?dramaSearch(searchQ,8):Promise.resolve([])]);
    if(seq!==sSeq)return;
    let items=dedupeById([...dm,...ds,...(da||[]),...(dd||[])]).slice(0,8);
    /* Aucun résultat FS → repli Cinemeta (titres hors bibliothèque FS inclus). */
    if(!items.length)items=dedupeById(await cinemetaSearchItems(searchQ,8)).slice(0,8);
    if(seq!==sSeq)return;
    if(seSE)items.forEach(x=>{if(x.k==='serie')x._searchSE=seSE;});
    if(items.length){
      const known=new Set(C.map(x=>x.id));items.forEach(x=>{if(!known.has(x.id))C.push(x);});
      sLbl.textContent='Résultats';
      sRes.innerHTML=renderSearchList(items.map(x=>x.id),false);bindSearchItemClicks();
      /* Fiches des résultats (année, genres, affiches) en arrière-plan,
         puis re-rendu du panneau si la recherche n'a pas changé. */
      Promise.all(items.map(x=>fsHydrateItem(x))).then(()=>{
        if(seq===sSeq&&sInput.value.trim()===qRaw){
          sLbl.textContent='Résultats';
          sRes.innerHTML=renderSearchList(items.map(x=>x.id),false);bindSearchItemClicks();
        }
      });
      return;
    }
    sLbl.textContent='Aucun résultat';
    sRes.innerHTML='<p style="color:var(--muted);font-size:.85rem;padding:1rem 0;text-align:center">Aucun titre ne correspond à « '+qRaw+' ».<br><span style="font-size:.78rem;opacity:.7">Essayez un autre mot-clé ou un genre.</span></p>';
    return;
  }
const r=C.filter(x=>x.k!=='anime'&&x.k!=='drama'&&(x.t.toLowerCase().includes(q)||x.g.some(g=>g.toLowerCase().includes(q))||x.a.some(a=>a.toLowerCase().includes(q)))).slice(0,6);
  sLbl.textContent=r.length?'Résultats':'Aucun résultat';
  if(!r.length){sRes.innerHTML='<p style="color:var(--muted);font-size:.85rem;padding:1rem 0;text-align:center">Aucun titre ne correspond à « '+qRaw+' ».<br><span style="font-size:.78rem;opacity:.7">Essayez un autre mot-clé ou un genre.</span></p>';return;}
  sRes.innerHTML=renderSearchList(r.map(x=>x.id),false);bindSearchItemClicks();}
sInput.addEventListener('input',()=>{clearTimeout(sTimer);sTimer=setTimeout(()=>{srLoadingShow();Promise.resolve(doSearch()).finally(srLoadingHide);},350);});
sInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&sInput.value.trim())pushHistory(sInput.value.trim());});
sPanel.addEventListener('click',e=>e.stopPropagation());
document.addEventListener('click',e=>{if(!e.target.closest('#searchWrap,#searchPanel')&&sWrap.classList.contains('open'))closeSearch();});
/* ---- Tilt 3D + parallaxe souris (desktop) ---- */
const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
if(fine){
  const hp=document.getElementById('heroPoster'),hb=document.getElementById('heroBg');
  addEventListener('mousemove',e=>{const rx=(e.clientY/innerHeight-.5)*-6,ry=(e.clientX/innerWidth-.5)*10;
    hp.style.transform=`perspective(1100px) rotateY(${-9+ry}deg) rotateX(${2+rx}deg)`;
    hb.style.translate=`${(e.clientX/innerWidth-.5)*-14}px ${(e.clientY/innerHeight-.5)*-8}px`;});
  document.addEventListener('mouseover',e=>{const c=e.target.closest?.('.card');if(!c)return;
    const r=c.getBoundingClientRect(),px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;
    c.style.transform=`scale(1.15) translateY(-10px) rotateY(${px*7}deg) rotateX(${-py*7}deg)`;});
  document.addEventListener('mouseout',e=>{const c=e.target.closest?.('.card');if(c)c.style.transform='';});
}
/* ---- Menu mobile ---- */
const mMenu=document.getElementById('mobileMenu');
function openMobileMenu(){mMenu.classList.add('open');document.getElementById('mobileMenuBtn').setAttribute('aria-expanded','true');document.body.style.overflow='hidden';}
function closeMobileMenu(){mMenu.classList.remove('open');document.getElementById('mobileMenuBtn').setAttribute('aria-expanded','false');document.body.style.overflow='';}
document.getElementById('mobileMenuBtn').onclick=openMobileMenu;
document.getElementById('mobileMenuClose').onclick=closeMobileMenu;
document.getElementById('mobileMenuBack').onclick=closeMobileMenu;
/* ---- Connexion API FrenchStream (addon indépendant, port 7000) ----
   Films & séries uniquement : catalogue, métadonnées et flux proviennent de
   l'addon Stremio FrenchStream. Les animés (anime-sama) et dramas (ReelShort)
   gardent leurs propres API et ne sont PAS touchés. */
const FS_CFG_KEY='nox_fs_api';
function loadApiCfg(){try{return JSON.parse(localStorage.getItem(FS_CFG_KEY))||{};}catch(e){return {};}}
function saveApiCfg(c){try{localStorage.setItem(FS_CFG_KEY,JSON.stringify(c));}catch(e){}}
/* Déploiement Railway de l'API FrenchStream (REST + protocole Stremio, CORS
   ouvert) : alimente le front en films/séries par défaut, sans réglage. */
const FS_DEFAULT_PROD='https://noxcontent-production.up.railway.app';
function fsBase(){
  const b=(loadApiCfg().base||'').trim().replace(/\/+$/,'');
  /* Base explicite (Profil) : prioritaire. En local (file:// ou serveur statique
     sur localhost) : addon direct http://localhost:7000. En production : l'API
     Railway (peut être remplacée par '' si le front est servi derrière le
     rewrite same-origin /api/fs/* de vercel.json). */
  if(b)return b;
  if(typeof location==='undefined')return FS_DEFAULT_PROD;
  if(location.protocol==='file:')return 'http://localhost:7000';
  if(/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))return 'http://localhost:7000';
  return FS_DEFAULT_PROD;
}
function fsUrl(p){const b=fsBase();return b?b+p:p;}
/* Requêtes catalogue/flux : même origine (proxy Vercel /api/fs/*) → pas de CORS.
   Base personnalisée (Profil) : accès direct à l'addon, qui autorise CORS. */
function fsFetch(url,init){return fetch(url,init);}
const apiState={online:false,providers:0,service:'FrenchStream',reason:null};
/* ---- Wrapper fetch authentifié : injecte le code d'accès (X-NOX-Code) ----
   Conservé pour les routes /api/* restantes (anime, drama, auth). */
function noxAuthHeaders(){
  const h={};
  try{const c=localStorage.getItem(AUTH_KEY);if(c)h['X-NOX-Code']=c;}catch(e){}
  return h;
}
function nxFetch(url,init){
  init=init||{};
  init.headers=Object.assign({},noxAuthHeaders(),init.headers||{});
  return fetch(url,init);
}
/* ---- Connexion API Anime-Sama (animés) ---- */
const ANIME_CFG_KEY='nox_anime_api';
function animeBase(){
  /* Same-origin par défaut : le serveur NOX relaie /api/anime/* vers l'API anime (5001).
     Si une base personnalisée est configurée dans le Profil, on l'utilise. */
  const b=(loadApiCfg().animeBase||'').trim().replace(/\/+$/,'');
  return b||'';
}
function animeUrl(p){const b=animeBase();return b?b+p:'/api/anime'+p;}
const animeState={online:false,count:0};
function updateAnimeBadge(){const el=document.getElementById('animeCount');if(!el)return;
  const uniq=new Set(C.filter(x=>x.k==='anime').map(x=>x.slug)).size;
  el.textContent=animeState.online?(uniq?`${uniq} animés`:'anime-sama · en ligne'):'anime-sama · hors ligne';}
async function animeHealth(){
  try{
    const r=await nxFetch(animeUrl('/health'),{signal:AbortSignal.timeout(6000)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();
    animeState.online=!!(d&&(d.status==='ok'||d.ok===true));
  }catch(e){animeState.online=false;}
  updateAnimeBadge();
  return animeState.online;
}
function updateApiBadge(){
  const badge=document.getElementById('apiBadge'),txt=document.getElementById('apiBadgeTxt');
  if(!badge)return;
  badge.classList.toggle('on',apiState.online);
  const svc=apiState.service||'FrenchStream';
  /* Offline : affiche la cause détectée (401/404 → mauvais serveur ou version
     obsolète) pour distinguer « API en panne » de « mauvaise config ». */
  const offlineMsg=apiState.reason?(' · '+apiState.reason):'';
  txt.textContent=apiState.online?`${svc} · en ligne`:`${svc} · hors ligne${offlineMsg}`;
}
async function nxHealth(){
  /* Addon FrenchStream : le /manifest.json sert de health-check.
     Same-origin → /api/fs/manifest.json (rewrite Vercel, pas de CORS) ;
     base personnalisée (Profil) → accès direct à l'addon (CORS autorisé). */
  try{
    const r=await fsFetch(fsUrl('/manifest.json'),{signal:AbortSignal.timeout(8000)});
    if(!r.ok){
      apiState.online=false;apiState.providers=0;
      apiState.reason=r.status===404?'mauvais serveur (cf. Profil)':'HTTP '+r.status;
      updateApiBadge();
      throw new Error('HTTP '+r.status);
    }
    const d=await r.json();
    apiState.online=!!(d&&d.id==='org.frenchstream.addon');
    apiState.providers=(d&&Array.isArray(d.catalogs))?d.catalogs.length:0;
    if(apiState.online)apiState.reason=null;
    else apiState.reason='serveur inconnu';
  }catch(e){apiState.online=false;apiState.providers=0;if(!apiState.reason)apiState.reason='injoignable';}
  updateApiBadge();
  return apiState.online;
}
/* ---- Flux FrenchStream : /stream/{movie|series}/{id}.json de l'addon ----
   L'addon renvoie des URL directes (m3u8/mp4) résolues côté addon — pas de
   résolution d'embed côté front. */
function nxLangLabel(lang){
  const k=String(lang||'').toLowerCase();
  if(!k||k==='fr'||k==='vf')return 'fr';
  if(k==='vostfr'||k==='vost')return k;
  return k;
}
function nxPlayerToStream(s,lang){
  const name=(s&&(s.name||s.title))||'FrenchStream';
  return {url:(s&&(s.url||s.externalUrl))||'',type:(s&&/\.m3u8(?:[?#]|$)/i.test(String(s.url||'')))?'hls':null,
    quality:null,language:nxLangLabel(s&&(s.lang||lang)),
    providerName:name,provider:'frenchstream',fsId:s&&(s.fsId||null)};
}
async function nxStreams(item,opts={}){
  /* Catalogue anime-sama : les lecteurs VF/VOSTFR sont des embeds distants lus en iframe. */
  if(item&&item.k==='anime')return animeEpisodeStreams(item,opts);
  if(item&&item.k==='drama')return dramaEpisodeStreams(item,opts);
  if(!item||!item.k)return [];
  /* L'addon FS résout les id « tt… » (majoritaires dans son catalogue) et « fs:… ». */
  const isTt=/^tt\d+$/.test(String(item.id));
  const isFs=item.fsId!=null;
  if(!isTt&&!isFs)return [];
  const type=item.k==='serie'?'series':'movie';
  /* Séries FS : une entrée par saison (« Titre - Saison N », id tt ou fs:) ;
     _fsSeasonIds[S] est rempli à l'ouverture de la fiche, sinon id de l'item. */
  const season=Number(opts.season||1),episode=Number(opts.episode||1);
  const baseId=(type==='series'&&item._fsSeasonIds&&item._fsSeasonIds[season])||item.id;
  let sid=String(baseId);
  if(type==='series')sid+=':'+season+':'+episode;
  try{
    /* Les « : » de l'id Stremio (fs:5:1:2) sont légaux dans le chemin : pas d'encodage. */
    const r=await fsFetch(fsUrl(`/stream/${type}/${sid}.json`),{signal:AbortSignal.timeout(120000)});
    if(!r.ok)return [];
    const d=await r.json();
    return ((d&&d.streams)||[]).map(nxPlayerToStream).filter(s=>s&&s.url);
  }catch(e){return [];}
}
function nxQualityRank(q){const m=String(q||'').match(/(\d{3,4})/);if(!m)return 0;const n=+m[1];return n>=2160?6:n>=1080?5:n>=720?4:n>=480?3:2;}
/* Détecte les flux "page HTML" (embeds non résolus) — à lire en iframe, jamais via le proxy vidéo */
const NX_EMBED_HOSTS=['vidmoly','uqload','oneupload','sendvid','sibnet','streamtape','dood.','ds2play','voe.','myvi.','younetu','netu.','vidoza','filemoon','moonplayer','luluvdo','fsvid.','vidzy','up4fun.','vidhsareup','hgcloud','weneverbeenfree','maryspecialwatch','charlestoughrace','sandratableother','bigwar5','getvid.club','vidstream','vidcdn','lecteurvideo','down-paradise','kokoflix','kakaflix','doood','dsvplay','d000d','doodstream'];
function nxIsEmbedStream(s){
  if(!s)return false;
  if(s.type==='iframe'||s.type==='embed')return true;      /* classification serveur */
  if(s.type==='hls'||s.type==='file'||s.type==='direct')return false;
  const u=String(s.url||'').toLowerCase();
  if(!u)return false;
  if(/\.(m3u8|mpd|mp4|m4v|webm|mkv|ts)(?:[?#]|$)/.test(u))return false;
  if(/\.html?(?:[?#]|$)/.test(u))return true;
  if(/\.(?:php|go)(?:\?|#|$)/.test(u)&&/(_go\.php|newplayer\.php|player\.php|download\.php)/.test(u))return true;
  if(/\/embed(\/|-|\?|$)|\/e\/[\w-]+|\/player(\/|\?|$)|\/download\/|\/d\/[\w-]+/.test(u))return true;
  return NX_EMBED_HOSTS.some(h=>u.includes(h));
}
/* Tri des flux : ordre de l'addon conservé (qualité non annoncée par FS). */
function nxSortStreams(streams){
  return [...(streams||[])].sort((a,b)=>nxQualityRank(b.quality)-nxQualityRank(a.quality));
}
/* URL jouable : l'addon FrenchStream renvoie des flux DIRECTS (m3u8/mp4) —
   plus de proxy vidéo (Content-Nexora retiré). */
function nxStreamUrl(stream){return stream&&stream.url?stream.url:null;}
/* Re-résolution d'embed : supprimée avec Content-Nexora (FS fournit des URL
   directes). No-op conservé pour neutraliser l'appel existant du lecteur. */
async function nxRetryResolveEmbed(stream){return null;}
/* ---- Catalogue réel (films & séries) via l'API FrenchStream ----
   L'addon renvoie des metas LÉGÈRES : id « tt… » (résolu IMDB, majoritaire) ou
   « fs:… », description = label qualité (« HD - VF+VOSTFR »), pas d'année ni
   de genres. Les fiches (année, genres, synopsis, images) sont complétées
   paresseusement par Cinemeta (public, CORS *). Les séries du catalogue FS
   sont une ENTRÉE PAR SAISON (« Titre - Saison 2 ») : fusionnées ici. */
const FR_GENRE_MAP={'Action':'Action','Adventure':'Aventure','Animation':'Animation','Biography':'Biopic','Comedy':'Comédie','Crime':'Policier','Documentary':'Documentaire','Drama':'Drame','Family':'Famille','Fantasy':'Fantastique','History':'Histoire','Horror':'Horreur','Music':'Musique','Musical':'Musique','Mystery':'Mystère','Romance':'Romance','Sci-Fi':'SF','Science Fiction':'SF','Short':'Court-métrage','Sport':'Sport','Thriller':'Thriller','War':'Guerre','Western':'Western','Reality-TV':'Réalité','Talk-Show':'Talk-show','News':'Actualités','Game-Show':'Jeu'};
const frGenres=arr=>(Array.isArray(arr)?arr:[]).map(g=>FR_GENRE_MAP[g]||g).slice(0,4);
/* « American Horror Story - Saison 13 » → {base:'American Horror Story',s:13}. */
function fsSeasonOf(name){
  const t=String(name||'');
  const m=t.match(/^(.*?)\s*[-–—]?\s*[Ss]aison\s*(\d{1,2})\s*$/)
    ||t.match(/^(.*?)\s*[-–—]\s*S(\d{1,2})\s*$/);
  return m?{base:m[1].trim(),s:+m[2]}:null;
}
function nxMapNodeItem(r,k){
  /* Item addon FS : metas Stremio légères. Les champs riches (année, genres,
     synopsis, images) sont hydratés depuis Cinemeta en arrière-plan. */
  const isFs=typeof r.id==='string'&&r.id.indexOf('fs:')===0;
  if(isFs||/^tt\d+$/.test(String(r.id||''))){
    const fsId=isFs?r.id.slice(3):null;
    const poster=(r.poster&&/^https?:/i.test(r.poster))?r.poster:null;
    const ri=String(r.releaseInfo||'').match(/(\d{4})/);
    let title=(r.name||'Sans titre').trim();
    /* Résultats de recherche FS : « UNABOMBER (2026) » → année extraite. */
    const ym=title.match(/\s*\((\d{4})\)\s*$/);
    if(ym){title=title.slice(0,ym.index).trim();}
    const ses=fsSeasonOf(title);
    return {id:String(r.id),fsId,t:ses?ses.base:title,saison:ses?ses.s:null,
      y:ri?+ri[1]:(ym?+ym[1]:0),k,rd:'',g:frGenres(r.genre),m:0,
      d:'',a:[],p:poster,b:null,note:0,pop:0};
  }
  /* Item Cinemeta (« Voir plus » / recherche) : fiche complète, id tt. */
  const id=/^tt\d+$/.test(String(r.id||''))?r.id:0;
  const title=(r.name||r.title)||'Sans titre';
  const released=r.released||r.releaseDate||'';
  return {id,fsId:null,t:title,y:released?new Date(released).getFullYear():Number(r.year)||0,k,
    rd:released?String(released).slice(0,10):'',g:frGenres(r.genres||r.genre),
    m:0,d:r.description||'Synopsis non disponible.',a:[],
    p:r.poster||null,b:r.background||null,
    note:Number(r.imdbRating)||0,pop:0};
}
function dedupeById(list){
  const seen=new Set();const out=[];
  for(const x of list){if(!x||x.id==null||seen.has(x.id))continue;seen.add(x.id);out.push(x);}
  return out;
}
/* Catalogue + détails de série : addon FrenchStream et Cinemeta. */
async function nxCatalogItems(type,catId,skip=0){
  try{
    const r=await fsFetch(fsUrl(`/catalog/${type}/${catId}/skip=${skip}.json`),{signal:AbortSignal.timeout(60000)});
    if(!r.ok)return [];
    const d=await r.json();
    return (d&&d.metas)||[];
  }catch(e){return [];}
}
const CINEMETA_SKIP_STEP=100;        /* pages Cinemeta après épuisement de la pagination FS */
let nxMoreState={films:{skip:0,page:1,done:false,loading:false},series:{skip:0,page:1,done:false,loading:false},nouveautes:{skip:0,page:1,done:false,loading:false}};
/* Cinemeta : le redirecteur v3-cinemeta.strem.io route parfois vers des
   instances SANS en-têtes CORS → ERR_FAILED côté navigateur. On appelle
   directement les hosts finaux (ACAO:* vérifié avec Origin). */
const CINEMETA_BASE={catalog:'https://cinemeta-catalogs.strem.io/top/catalog',meta:'https://cinemeta-live.strem.io/meta'};
async function nxCinemetaCatalog(type,skip){
  try{
    const r=await fetch(`${CINEMETA_BASE.catalog}/${type}/top/skip=${skip}.json`,{signal:AbortSignal.timeout(30000)});
    if(!r.ok)return [];
    const d=await r.json();
    return (d&&d.metas)||[];
  }catch(e){return [];}
}
const cinemetaCache=new Map();
async function cinemetaMeta(type,imdbId){
  const key=type+':'+imdbId;
  if(cinemetaCache.has(key))return cinemetaCache.get(key);
  let meta=null;
  try{
    const r=await fetch(`${CINEMETA_BASE.meta}/${type}/${encodeURIComponent(imdbId)}.json`,{signal:AbortSignal.timeout(15000)});
    if(r.ok){const d=await r.json();meta=(d&&d.meta)||null;}
  }catch(e){}
  cinemetaCache.set(key,meta);
  return meta;
}
/* Fiche de série : Cinemeta (id tt) = fiche complète + épisodes réels.
   En secours pour un fs: pur, /meta de l'addon (souvent vide). */
async function nxSeriesDetails(fsId){
  if(fsId==null)return null;
  const key='series:'+fsId;
  if(cinemetaCache.has(key))return cinemetaCache.get(key);
  let meta=null;
  if(/^tt\d+$/.test(String(fsId))){
    meta=await cinemetaMeta('series',fsId);
  }else{
    try{
      const r=await fsFetch(fsUrl(`/meta/series/fs:${fsId}.json`),{signal:AbortSignal.timeout(30000)});
      if(r.ok){const d=await r.json();meta=(d&&d.meta)||null;}
    }catch(e){}
  }
  cinemetaCache.set(key,meta);
  return meta;
}
/* Hydratation arrière-plan des fiches FS (année, genres, synopsis, affiches,
   casting, note). La description d'un item catalogue FS est un label qualité
   (« HD - VF+VOSTFR ») : conservée telle quelle si Cinemeta ne connaît pas le
   titre (utile à l'affiche/qualité). */
const fsHydrated=new Set();
let fsHydRenderT=0;
function fsHydScheduleRender(){clearTimeout(fsHydRenderT);fsHydRenderT=setTimeout(()=>{renderCatGenres();renderCat();fillHomeRows();},600);}
async function cinemetaSearchMeta(x){
  try{
    const type=x.k==='serie'?'series':'movie';
    const r=await fetch(`${CINEMETA_BASE.catalog}/${type}/top/search=${encodeURIComponent(x.t)}.json`,{signal:AbortSignal.timeout(15000)});
    if(!r.ok)return null;
    const d=await r.json();
    const metas=(d&&d.metas)||[];
    return metas.find(v=>String(v.name||'').toLowerCase()===String(x.t).toLowerCase())||metas[0]||null;
  }catch(e){return null;}
}
async function fsHydrateItem(x){
  if(!x||fsHydrated.has(x.id))return;
  fsHydrated.add(x.id);
  try{
    let m=null;
    if(/^tt\d+$/.test(String(x.id))){
      m=await cinemetaMeta(x.k==='serie'?'series':'movie',x.id);
    }
    if(!m)m=await cinemetaSearchMeta(x);
    if(!m)return;
    x.y=x.y||Number(String(m.year||'').match(/\d{4}/)?.[0])||0;
    x.rd=x.rd||(m.released?String(m.released).slice(0,10):'');
    x.g=x.g&&x.g.length?x.g:frGenres(m.genres||m.genre);
    x.note=x.note||Number(m.imdbRating)||0;
    x.p=x.p||(m.poster||null);
    x.b=x.b||(m.background||null);
    if(!x.d)x.d=m.description||'';
    if(!x.a&&Array.isArray(m.cast))x.a=m.cast.slice(0,5);
    if(!x.m&&m.runtime&&x.k!=='serie')x.m=parseInt(m.runtime)||0;
    fsHydScheduleRender();
  }catch(e){}
}
/* File d'hydratation : 6 simultanées max, déclenchée après catalogue/recherche. */
let fsHydRunning=false;
async function fsBackfillYears(){
  if(fsHydRunning)return;
  fsHydRunning=true;
  try{
    const todo=C.filter(x=>(x.k==='film'||x.k==='serie')&&!fsHydrated.has(x.id));
    let idx=0;
    const worker=async()=>{
      while(idx<todo.length){
        const x=todo[idx++];
        await fsHydrateItem(x);
      }
    };
    await Promise.all(Array.from({length:6},worker));
  }finally{fsHydRunning=false;}
}
let hydrateRetryTimer=0;
/* Deep-link de test/e2e : #play-film=<id> ou #play-serie=<id>:<S>:<E> → lance
   la lecture une fois le catalogue hydraté. Sans effet pour l'utilisateur. */
function fsTryPlayDeepLink(){
  const h=location.hash||'';
  const mf=h.match(/^#play-film=(\w+(?::\w+)?)/);
  const ms=h.match(/^#play-serie=([^:]+):(\d+):(\d+)/);
  const id=mf?mf[1]:(ms?ms[1]:null);
  if(!id)return;
  const x=byId(id);if(!x)return;
  if(ms)setTimeout(()=>openPlayer(x,{season:+ms[2],episode:+ms[3]}),600);
  else setTimeout(()=>openPlayer(x),600);
}
async function hydrateCatalog(){
  if(!apiState.online){
    /* Le check au démarrage peut échouer (addon encore en cours de résolution
       du domaine FS) : retenter ici, sinon une panne passante laisserait le
       catalogue en données démo pour toute la session. */
    const ok=await nxHealth();
    if(!ok)return;
  }
  try{
    const [movies,series]=await Promise.all([
      nxCatalogItems('movie','frenchstream-films',0),
      nxCatalogItems('series','frenchstream-series',0)]);
    /* Les animés (API anime-sama) sont chargés en parallèle : les conserver. */
    const animeItems=C.filter(x=>x.k==='anime');
    const all=dedupeById([
      ...((movies||[]).map(r=>nxMapNodeItem(r,'film'))),
      ...((series||[]).map(r=>nxMapNodeItem(r,'serie')))]);
    if(all.length<6){
      /* Amont FS injoignable ou vide → retenter une fois, sinon données démo. */
      await new Promise(r=>setTimeout(r,2000));
      const [movies2,series2]=await Promise.all([
        nxCatalogItems('movie','frenchstream-films',0),
        nxCatalogItems('series','frenchstream-series',0)]);
      all.push(...dedupeById([
        ...((movies2||[]).map(r=>nxMapNodeItem(r,'film'))),
        ...((series2||[]).map(r=>nxMapNodeItem(r,'serie')))]));
      if(all.length<6){
        console.log('[NOX] Données API insuffisantes ('+all.length+'), nouvelle tentative dans 15 s');
        showToast('Catalogue FrenchStream indisponible — données démo utilisées');
        clearTimeout(hydrateRetryTimer);hydrateRetryTimer=setTimeout(hydrateCatalog,15000);
        return;
      }
    }
    // L'API a renvoyé des données valides : les utiliser à la place des données démo
    C.length=0;C.push(...all);
    pushAnimeItems(animeItems);
    FEAT.splice(0,FEAT.length,all[0],all[1],all[2],all[3]);
    setHero(0);
    fillHomeRows();
    renderCatGenres();renderCat();
    setView(location.hash.slice(1)||'accueil');
    fsTryPlayDeepLink();
    showToast(`Catalogue FrenchStream : ${all.length} titres réels chargés`);
    fsBackfillYears();
  }catch(e){console.error('[NOX] hydrateCatalog a échoué :',e);}
}
/* Genres par vue : calculés depuis le catalogue réel, triés par nombre de
   titres (le plus fourni en premier), affichés avec compteurs. */
const genreCounts=items=>{const m=new Map();for(const x of items)for(const g of (x.g||[]))m.set(g,(m.get(g)||0)+1);return m;};
function topGenres(items,max=14){
  return [...genreCounts(items).entries()].filter(([g,n])=>n>=4).sort((a,b)=>b[1]-a[1]).slice(0,max).map(([g])=>g);
}
const GENRES_F=['Tous'];
const GENRES_S=['Tous'];
/* Enrichissement fiche : le catalogue FrenchStream fournit titre, affiche et
   résumé ; rien de plus à charger ici. */
async function enrichDetails(x,where){}
/* ---- Catalogue Animés (API anime-sama via /api/anime/*, proxy → 5001) ---- */
const ANIME_IDS=new Map();let animeSeq=0;
function animeIdFor(slug){if(!ANIME_IDS.has(slug))ANIME_IDS.set(slug,900000000+(++animeSeq));return ANIME_IDS.get(slug);}
function animeSlugFromUrl(u){const m=String(u||'').match(/\/catalogue\/([^/]+)/);return m?m[1]:'';}
function nxMapAnimeItem(r){
  const slug=animeSlugFromUrl(r.url)||String(r.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const id=animeIdFor(slug);
  const existing=byId(id);
  if(existing){if(r.image_url&&!existing.p)existing.p=r.image_url;return existing;}
  const langs=(r.languages||[]).map(l=>String(l).toUpperCase());
  return {id,anime:1,slug,url:r.url||'',t:String(r.name||'Sans titre').trim(),y:0,k:'anime',
    g:Array.isArray(r.genres)?r.genres.slice(0,3):[],m:0,d:'',a:[],
    p:r.image_url||null,b:null,langs,alts:Array.isArray(r.alternative_names)?r.alternative_names:[]};
}
function pushAnimeItems(items){let added=0;
  for(const it of (items||[])){if(!it)continue;if(!byId(it.id)){C.push(it);added++;}}
  return added;}
function byAnimeSlug(slug){return C.find(x=>x.k==='anime'&&x.slug===slug);}
async function animeCatalog(q,limit=48,page=1,all=false){
  try{
    const r=await nxFetch(animeUrl('/api/v1/catalogues?q='+encodeURIComponent(q)+'&limit='+limit+'&page='+page+(all?'&all=1':'')),{signal:AbortSignal.timeout(120000)});
    if(!r.ok)return[];
    const d=await r.json();
    return ((d&&d.data)||[]).map(nxMapAnimeItem).filter(Boolean);
  }catch(e){return[];}
}
let animeQuery='';const animeSearchIds=new Set();
function animeGridItems(max){
  const q=animeQuery.trim().toLowerCase();
  /* Un animé peut exister en deux entrées (catalogue + simulcast) : garder la plus riche */
  const byslug=new Map();
  for(const x of C){if(x.k!=='anime')continue;const prev=byslug.get(x.slug);
    if(!prev||((x.g&&x.g.length)>(prev.g&&prev.g.length||0)))byslug.set(x.slug,x);}
  let items=[...byslug.values()];
  if(q)items=items.filter(x=>animeSearchIds.has(x.id)||x.t.toLowerCase().includes(q)||(x.alts||[]).some(a=>String(a).toLowerCase().includes(q)));
  return max>0?items.slice(0,max):items;
}
const ANIME_PAGE_SIZE=60;
let animeLimit=ANIME_PAGE_SIZE;
function renderAnimeGrid(){
  const host=document.getElementById('gridAnimes');if(!host)return;
  if(!animeQuery.trim())animeSearchIds.clear();
  fillGrid(host,animeGridItems(animeLimit),animeState.online?'Aucun animé ne correspond à cette recherche.':'Catalogue animés indisponible — lancez l\'API anime-sama (API-ANIME, port 5001).');
  updateAnimeBadge();
  nxInfiniteClear('gridAnimes');
  if(document.querySelector('#view-animes.active')){
    const total=animeGridItems(0).length;
    if(animeLimit<total){
      nxInfiniteWatch('gridAnimes',()=>{animeLimit+=ANIME_PAGE_SIZE;renderAnimeGrid();});
      /* Préchargement : si la page suivante est presque atteinte, va la chercher. */
      if(total-animeLimit<=ANIME_PAGE_SIZE&&!animeLoadingNext&&animePrefetchMiss<2)animePrefetchNext();
    }
  }
}
let animeLoadingNext=false,animePrefetchPage=3,animePrefetchMiss=0;
async function animePrefetchNext(){
  if(!animeState.online||animeLoadingNext||animeQuery.trim())return;
  /* 2 préchargements infructueux de suite → l'amont est épuisé, on arrête. */
  if(animePrefetchMiss>=2)return;
  animeLoadingNext=true;
  nxLoadingShow('gridAnimes');
  const before=new Set(C.filter(x=>x.k==='anime').map(x=>x.id));
  const next=animePrefetchPage++;
  try{
    const results=await animeCatalog('',120,next,false);
    pushAnimeItems(results);
    const added=C.filter(x=>x.k==='anime'&&before.has(x.id)===false&&x.id).length;
    animePrefetchMiss=added?0:animePrefetchMiss+1;
  }catch(e){animePrefetchMiss++;}
  animeLoadingNext=false;
  nxLoadingHide('gridAnimes');
  updateAnimeBadge();
}
let animeHydrated=false;
async function hydrateAnimeCatalog(){
  if(!animeState.online||animeHydrated)return;
  animeHydrated=true;
  /* Catalogue complet : le mode all=1 fait balayer toute la pagination du site
     (~2400 titres) côté API, qui renvoie le catalogue en une réponse. */
  const all=await animeCatalog('',1000,1,true);
  if(!pushAnimeItems(all)){animeHydrated=false;return;}
  renderAnimeGrid();
  /* Deep-link #anime-<slug> ouvert avant l'hydratation : résoudre le slug via une
     recherche ciblée si l'item n'est pas dans la première page du catalogue. */
  if(location.hash.indexOf('#anime-')===0&&!document.getElementById('view-animedetail').classList.contains('active')){
    const slug=location.hash.slice(7);
    if(!byAnimeSlug(slug)&&slug){
      const found=await animeCatalog(slug.replace(/-/g,' '),8);
      pushAnimeItems(found);
    }
    if(byAnimeSlug(slug))setView(location.hash.slice(1));
  }
  /* Rangée Simulcast : derniers épisodes sortis (/v1/new-episodes) */
  try{
    const r=await nxFetch(animeUrl('/api/v1/new-episodes'),{signal:AbortSignal.timeout(30000)});
    if(!r.ok)return;
    const d=await r.json();
    const sim=((d&&d.data)||[]).slice(0,12).map(rel=>{
      const slug=animeSlugFromUrl(rel.page_url);if(!slug)return null;
      const parts=String(rel.page_url||'').split('/').filter(Boolean);
      const seg=parts.length>2?parts[parts.length-1]:'';
      const id=animeIdFor(slug+'~'+seg);
      return {id,anime:1,slug,seasonSeg:seg,t:rel.serie_name||'Sans titre',y:0,k:'anime',
        g:[],m:0,d:rel.descriptive||'',a:[],p:rel.image_url||null,b:null,
        langs:[rel.language||'VOSTFR'],alts:[]};
    }).filter(Boolean);
    if(!pushAnimeItems(sim))return;
    renderSimulcastRow(sim);
  }catch(e){}
}
function renderSimulcastRow(items){
  const rowsEl=document.getElementById('rows');if(!rowsEl)return;
  const prev=document.getElementById('simulcast');if(prev)prev.remove();
  rowsEl.insertAdjacentHTML('beforeend',row('Simulcast — Derniers épisodes',items,{id:'simulcast'}));
  bindRows();bindCards();
}
/* ---- Page détail animé ---- */
let curAnime=null,curAnimeSeason=0,pendingAnimeSeason='';
function goToAnime(slug,seg){pendingAnimeSeason=seg||'';setView('anime-'+slug);}
function renderAnimePage(item){
  if(!item||item.k!=='anime')return false;
  curAnime=item;curAnimeSeason=0;
  document.getElementById('adBg').style.backgroundImage=`url(${imgBg(item.id)})`;
  const poster=document.getElementById('adPoster');poster.src=img(item.id,500,750);poster.alt=item.t;
  document.getElementById('adTitle').textContent=item.t;
  document.getElementById('adDesc').textContent=item.d||'Synopsis en cours de chargement…';
  document.getElementById('adMeta').innerHTML=`<span class="chip">${(item.langs&&item.langs.length)?item.langs.join(' • '):'VOSTFR'}</span>`+((item.alts&&item.alts.length)?`<span>${item.alts.slice(0,2).join(' • ')}</span>`:'');
  document.getElementById('adTags').innerHTML=(item.g||[]).map(g=>`<span class="cast-chip">${g}</span>`).join('');
  document.getElementById('adSeasons').innerHTML='<span style="color:var(--muted);font-size:.8rem">Chargement des saisons…</span>';
  document.getElementById('adEpisodes').innerHTML='';
  syncAnimeResume(item);
  syncAnimeLike();
  nxHydrateAnimeDetails(item);
  return true;
}
async function nxHydrateAnimeDetails(item){
  if(curAnime!==item)return;
  try{
    const r=await nxFetch(animeUrl('/api/v1/catalogue/'+encodeURIComponent(item.slug)),{signal:AbortSignal.timeout(30000)});
    if(r.ok){
      const d=await r.json();const c=(d&&d.data)||{};
      if(curAnime!==item)return;
      if(c.synopsis)item.d=c.synopsis;
      if(Array.isArray(c.genres)&&c.genres.length)item.g=c.genres.slice(0,4);
      if(c.image_url&&!item.p)item.p=c.image_url;
      document.getElementById('adDesc').textContent=item.d||'Synopsis non disponible.';
      document.getElementById('adTags').innerHTML=(item.g||[]).map(g=>`<span class="cast-chip">${g}</span>`).join('');
    }
  }catch(e){}
  try{
    const r2=await nxFetch(animeUrl('/api/v1/catalogue/'+encodeURIComponent(item.slug)+'/seasons'),{signal:AbortSignal.timeout(30000)});
    if(!r2.ok)return;
    const d2=await r2.json();
    if(curAnime!==item)return;
    const seasons=((d2&&d2.data)||[]).map(s=>{const parts=String(s.url||'').split('/').filter(Boolean);const seg=parts[parts.length-1]||'';return {name:s.name||seg,seg};}).filter(s=>s.seg);
    item._animeSeasons=seasons;
    const pi=seasons.findIndex(s=>s.seg===pendingAnimeSeason);
    if(pi>=0){pendingAnimeSeason='';curAnimeSeason=pi;}
    renderAnimeSeasonTabs(item);
    if(seasons.length)selectAnimeSeason(item,curAnimeSeason);
  }catch(e){
    if(curAnime===item)document.getElementById('adSeasons').innerHTML='<span style="color:var(--muted);font-size:.8rem">Saisons indisponibles</span>';
  }
}
function renderAnimeSeasonTabs(item){
  const host=document.getElementById('adSeasons');
  const seasons=item._animeSeasons||[];
  if(!seasons.length){host.innerHTML='<span style="color:var(--muted);font-size:.8rem">Aucune saison trouvée</span>';return;}
  host.innerHTML=seasons.map((s,i)=>`<button class="f-chip${i===curAnimeSeason?' on':''}" data-i="${i}">${s.name}</button>`).join('');
  host.querySelectorAll('.f-chip').forEach(b=>b.onclick=()=>{host.querySelectorAll('.f-chip').forEach(c=>c.classList.remove('on'));b.classList.add('on');curAnimeSeason=+b.dataset.i;selectAnimeSeason(item,curAnimeSeason);});
}
async function selectAnimeSeason(item,idx){
  const seasons=item._animeSeasons||[];const s=seasons[idx];if(!s)return;
  const host=document.getElementById('adEpisodes');
  host.innerHTML='<div class="skel"></div>'.repeat(4);
  try{
    const r=await nxFetch(animeUrl(`/api/v1/catalogue/${encodeURIComponent(item.slug)}/seasons/${encodeURIComponent(s.seg)}/episodes`),{signal:AbortSignal.timeout(60000)});
    const d=r.ok?await r.json():null;
    if(curAnime!==item)return;
    const eps=((d&&d.data)||[]).map(e=>({n:Number(e.index)||0,title:e.name||('Épisode '+(e.index||'?')),langs:Object.keys(e.languages||{})}));
    if(!eps.length){host.innerHTML='<div class="empty"><div class="big">▦</div><p>Aucun épisode listé pour cette saison.</p></div>';return;}
    host.innerHTML=eps.map(e=>{
      const langs=(e.langs||[]).map(l=>`<span class="chip">${String(l).toUpperCase()}</span>`).join(' ');
      return `<div class="ep-row" data-n="${e.n}">
        <div class="ep-thumb">${epWatchedBadge(item,e.n)}<img loading="lazy" src="${item.p||img(item.id,320,180)}" alt="${e.title}"><button class="ep-play" aria-label="Lire ${e.title}"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button></div>
        <div class="ep-body"><div class="ep-head"><span class="ep-num">${e.n}</span><h4>${e.title}</h4><span class="ep-dur">${langs||'VOSTFR'}</span></div><p>${item.t} — épisode ${e.n}</p></div>
      </div>`;}).join('');
    host.querySelectorAll('.ep-row').forEach(rowEl=>{const n=+rowEl.dataset.n;rowEl.onclick=()=>openPlayer(item,{season:idx+1,animeSeason:s.seg,episode:n});});
  }catch(e){
    if(curAnime===item)host.innerHTML='<div class="empty"><div class="big">▦</div><p>Impossible de charger les épisodes — API anime injoignable.</p></div>';
  }
}
function syncAnimeLike(){if(!curAnime)return;const on=myList.has(curAnime.id);const b=document.getElementById('adLike');
  b.style.background=on?'var(--accent-soft)':'';b.style.borderColor=on?'var(--accent)':'';}
/* Bouton « Reprendre » (animé). */
function syncAnimeResume(item){
  const btn=document.getElementById('adResume'),lbl=document.getElementById('adResumeLbl');
  if(!btn)return;
  const p=getPos(item);
  if(p&&p.episode){btn.style.display='';lbl.textContent=`Reprendre ép. ${p.episode} · ${fmtTime(p.t)}`;}
  else btn.style.display='none';
}
document.getElementById('adResume').onclick=()=>{
  if(!curAnime)return;
  const p=getPos(curAnime);
  if(p&&p.episode)openPlayer(curAnime,{episode:p.episode,animeSeason:p.animeSeason||curAnime._animeSeasons?.[0]?.seg});
  else document.getElementById('adResume').style.display='none';
};
document.getElementById('adBack').onclick=()=>{setView('animes');history.replaceState(null,'','#animes');};
document.getElementById('adPlay').onclick=()=>{if(!curAnime)return;const seasons=curAnime._animeSeasons||[];const s=seasons[curAnimeSeason];openPlayer(curAnime,{season:curAnimeSeason+1,animeSeason:s?s.seg:undefined,episode:1});};
document.getElementById('adLike').onclick=()=>{if(!curAnime)return;const on=myList.has(curAnime.id);on?myList.delete(curAnime.id):myList.add(curAnime.id);saveMyList();showToast(on?'Retiré de Ma liste':'« '+curAnime.t+' » ajouté à Ma liste');syncAnimeLike();updateListCount();renderCat();};
/* Flux épisode anime : lecteurs VF/VOSTFR exposés par l'API (embeds distants lus en iframe). */
async function animeEpisodeStreams(item,opts){
  const seg=opts.animeSeason||('saison-'+(opts.season||1));
  try{
    const r=await nxFetch(animeUrl(`/api/v1/catalogue/${encodeURIComponent(item.slug)}/seasons/${encodeURIComponent(seg)}/episodes`),{signal:AbortSignal.timeout(60000)});
    if(!r.ok)return[];
    const d=await r.json();
    const eps=(d&&d.data)||[];
    const ep=eps.find(e=>Number(e.index)===Number(opts.episode||1))||eps[0];
    if(!ep)return[];
    const out=[];const langs=(ep&&ep.languages)||{};
    for(const lang of Object.keys(langs)){
      for(const url of (langs[lang]||[])){
        if(!url)continue;
        out.push({url,type:'iframe',language:String(lang).toLowerCase()==='vf'?'fr':String(lang).toLowerCase(),
          providerName:'anime-sama ('+lang+')',provider:'anime-sama',quality:null});
      }
    }
    return out;
  }catch(e){return[];}
}
/* ---- Catalogue Dramas (API drama via /api/drama/*, proxy → 5002) ---- */
const DRAMA_CFG_KEY='nox_drama_api';
/* État dramas déclaré DÈS LE DÉBUT du bloc : les deep-links #drama-… déclenchent
   setView → renderDramaGrid dès le chargement du DOM (sinon TDZ). */
const DRAMA_PAGE_SIZE=24;
const DRAMA_MAX_SEARCH_PAGE=6; /* pages de recherche exploitées par mot-clé (2→6) */
let dramaQuery='';const dramaSearchIds=new Set();
let dramaShelf='tout',dramaLimit=DRAMA_PAGE_SIZE,dramaHydrated=false,dramaLoadingMore=false;
/* Filtres enrichis : thème (chips à bascule Genres/Années) + tri. L'ordre de
   catalogue est l'ordre d'arrivée API — stable pour « Recommandés ». */
let dramaTheme='Tous',dramaYear='Tous',dramaChipSet='theme',dramaSort='reco';
const DRAMA_THEMES=['Tous','Romance','Werewolf','Billionaire','Mafia','Vengeance','Grossesse','Secondes chances','Identité secrète','Tabou','Asiatique','École','Médecine','Fantasy','Action','Cadeau','Contrat','Royal'];
const DRAMA_THEME_PAT={'Romance':/\b(love|romance|romantic|crush|soulmate|attraction|amour|cœur|coeur)\b/i,'Werewolf':/\b(werewolf|luna|alpha|wolf|mate|full moon|loup)\b/i,'Billionaire':/\b(billionaire|millionaire|ceo|boss|rich|wealthy|milliardaire)\b/i,'Mafia':/\b(mafia|gangster|mob|don|cartel)\b/i,'Vengeance':/\b(revenge|payback|vengeance|reprisal|betray)\b/i,'Grossesse':/\b(pregnanc|pregnant|baby|babies|twins|grossesse|bébé|bebe)\b/i,'Secondes chances':/\b(second chance|divorce|ex[- ]?(husband|wife)|remarry|regret|reunion)\b/i,'Identité secrète':/\b(secret identity|hidden (heir|identity)|disguise|heir|secretly)\b/i,'Tabou':/\b(forbidden|taboo|affair|step[- ]?(mom|dad|sister|brother)|temptation)\b/i,'Asiatique':/\b(asian|thai|philippine|indonesian|korean|japanese|chinese|asie)\b/i,'École':/\b(campus|school|college|high school|classmate|lycée|lycee|école|ecole)\b/i,'Médecine':/\b(doctor|surgeon|nurse|hospital|médecin|medecin)\b/i,'Fantasy':/\b(vampire|witch|dragon|magic|demon|immortal|fantasy|sorcier)\b/i,'Action':/\b(bodyguard|soldier|assassin|spy|agent|mission)\b/i,'Cadeau':/\b(gift|wish|surprise)\b/i,'Contrat':/\b(contract|arranged|fake|pretend|deal|mariage|fiance|betrothed)\b/i,'Royal':/\b(royal|prince|princess|king|queen|crown|throne|roi|reine|princesse)\b/i};
let dramaExpandMiss=0,dramaExpandPaused=false; /* salves vides consécutives + pause anti-tempête */
const DRAMA_SEEDS=['love','alpha','billionaire','werewolf','revenge','secret','boss','contract','marriage','baby','CEO','mafia','pregnant','second chance','enemy','guardian','soldier','vampire','witch','drama','her','wife','husband','ex','beach','sweet','captive','payback','soulmate','knight','pampered','mate','obsessed','heir','rejection','triplet','love triangle','arranged','roommate','neighbor','one night','cold ceo','baby daddy','replaced bride','first love','divorce','bodyguard','professor','royal','prince','princess','crush','desire','forbidden','engaged','hero','mission'];
const DRAMA_SHELF_SEEDS={'Loups-garous':['werewolf','alpha wolf','luna','mate','full moon','wolf king','fated','rejection','alpha king','beta','beast','hybrid'],'Identité cachée':['secret identity','hidden heir','billionaire','disguise','secretly','truth','reveal','unknown','masked','poor girl','true identity','hidden fortune'],'Relation taboue':['forbidden love','secret affair','step','betrayal','cheating','affair','temptation','stepbrother','stepsister','forbidden desire','secret crush'],'Histoires d’Asie':['asian drama','thai drama','philippines','indonesia','chinese drama','korean drama','japanese','thai','manila','jakarta','seoul','tokyo'],'Recommandés':['billionaire','CEO','revenge','boss','sweet','romance','popular','trending','featured','must watch','hot'],'Nouveautés':['new','latest','new release','fresh','recent','2024','2025','2026','hot release','just added'],'Classement':['top','best','trending','ranking','hot','popular','award','rank','chart','most watched','weekly top'],'VF doublés':['dubbed','dubbed drama','french','vf','doublage','français','french version','doublé'],'Bébés & Grossesse':['pregnancy','baby','billionaire baby','pregnant','mom','twins','surrogate','triplet','secret baby','baby daddy','quadruplet'],'Coup de foudre':['love at first sight','crush','romance','first love','sweet love','attraction','wedding','bride','proposal','sweetheart'],'Secondes chances':['second chance','divorce','ex husband','ex wife','remarry','regret','reunion','reconcile','broken marriage','ex back'],'Pour hommes':['mafia','revenge','millionaire','gangster','bodyguard','soldier','power','kingpin','underdog','empire','rise'],'Originaux':['reelshort','original','interactive','talk show','game show','reelshort original']};
/* Mots-clés par THÈME (chips Thèmes) : le scroll infini d'un thème actif puise
   dans cette liste pour ramener du contenu cohérent avec le filtre. */
const DRAMA_THEME_SEEDS={'Romance':['love','romance','crush','soulmate','sweet love','date','kiss','wedding'],'Werewolf':['werewolf','alpha','luna','mate','wolf','full moon','beast'],'Billionaire':['billionaire','millionaire','ceo','boss','rich','tycoon','wealthy'],'Mafia':['mafia','gangster','mob','cartel','crime lord'],'Vengeance':['revenge','payback','betray','vengeance','betrayal'],'Grossesse':['pregnant','pregnancy','baby','twins','surrogate','baby daddy'],'Secondes chances':['second chance','divorce','ex husband','ex wife','remarry','regret','reunion'],'Identité secrète':['secret identity','hidden heir','disguise','secretly','masked','true identity'],'Tabou':['forbidden','affair','stepmom','stepbrother','stepsister','temptation'],'Asiatique':['thai drama','philippines','indonesia','korean drama','chinese drama','japanese drama','asian'],'École':['campus','school','college','classmate','high school','student'],'Médecine':['doctor','surgeon','nurse','hospital','medical'],'Fantasy':['vampire','witch','dragon','magic','demon','immortal'],'Action':['bodyguard','soldier','assassin','spy','agent','mission'],'Cadeau':['gift','wish','surprise'],'Contrat':['contract marriage','arranged marriage','fake marriage','contract','pretend','betrothed'],'Royal':['royal','prince','princess','king','queen','crown','throne']};
/* Locales ReelShort fusionnées pour élargir le catalogue : chaque locale expose des
   étagères différentes (~10 livres/shelf), la fusion ×6 ≈ 600 dramas uniques. */
const DRAMA_LANGS=['fr','en','es','pt','id','de'];
let dramaMoreSeed=0,dramaMorePage=2;
function dramaBase(){
  /* Same-origin par défaut : le serveur NOX relaie /api/drama/* vers l'API drama (5002).
     Si une base personnalisée est configurée dans le Profil, on l'utilise. */
  const b=(loadApiCfg().dramaBase||'').trim().replace(/\/+$/,'');
  return b||'';
}
function dramaUrl(p){const b=dramaBase();return b?b+p:'/api/drama'+p;}
const dramaState={online:false,count:0};
function updateDramaBadge(){const el=document.getElementById('dramaCount');if(!el)return;
  const uniq=new Set(C.filter(x=>x.k==='drama').map(x=>x.bookId)).size;
  el.textContent=dramaState.online?(uniq?`${uniq} dramas`:'reelshort · en ligne'):'reelshort · hors ligne';
  const btn=document.getElementById('dramaMore');if(btn)updateDramaMore();}
async function dramaHealth(){
  try{
    const r=await nxFetch(dramaUrl('/health'),{signal:AbortSignal.timeout(6000)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();
    dramaState.online=!!(d&&(d.status==='ok'||d.ok===true));
  }catch(e){dramaState.online=false;}
  updateDramaBadge();
  return dramaState.online;
}
/* Chaque drama porte un id numérique éphémère (clé unique dans C) ; le book_id ReelShort
   (chaîne Mongo) et le slug filtered_title sont conservés à part pour les appels API. */
const DRAMA_IDS=new Map();let dramaSeq=0;
function dramaIdFor(bid){if(!DRAMA_IDS.has(bid))DRAMA_IDS.set(bid,950000000+(++dramaSeq));return DRAMA_IDS.get(bid);}
function nxMapDramaItem(r){
  const bid=String(r.book_id||r.bookId||'');if(!bid)return null;
  const id=dramaIdFor(bid);
  const existing=byId(id);
  if(existing){if((r.book_pic||r.cover)&&!existing.p)existing.p=r.book_pic||r.cover;return existing;}
  return {id,bookId:bid,filteredTitle:r.filtered_title||'',drama:1,
    t:String(r.book_title||r.name||'Sans titre').trim(),y:0,k:'drama',
    g:[],m:0,d:r.special_desc||r.introduction||'',a:[],
    p:r.book_pic||r.cover||null,b:null,note:0,pop:0,
    chapterCount:r.chapter_count||null,alts:[]};
}
function pushDramaItems(items){let added=0;
  for(const it of (items||[])){if(!it)continue;if(!byId(it.id)){C.push(it);added++;}}
  return added;}
function byDramaBookId(bid){return C.find(x=>x.k==='drama'&&x.bookId===String(bid));}
/* Catalogue : toutes les bookshelves ReelShort en une requête (recommandations,
   nouveautés, doublées, loups-garous, asia, tabou…). Chaque item mémorise sa
   catégorie pour les filtres (dramaShelf). */
/* Libellés normalisés (fr) — préfixes des étagères de TOUTES les locales fusionnées. */
const DRAMA_SHELF_LABELS={'Recommandation':'Recommandés','Nouvelles':'Nouveautés','Série Doublée':'VF doublés','Histoires':'Histoires d’Asie','Identité':'Identité cachée','Relation':'Relation taboue','Loups':'Loups-garous','CLASSEMENT':'Classement','Rilis':'Nouveautés','Lebih':'Recommandés','Drama dengan':'VF doublés',
  /* en */ 'New Release':'Nouveautés','TOP':'Classement','Reel Original':'Originaux','More Recommended':'Recommandés','Pregnancy':'Bébés & Grossesse','Love at First Sight':'Coup de foudre','Second Chance':'Secondes chances','Young Love':'Coup de foudre','Hidden Identity':'Identité cachée','ReelShort Interactives':'Originaux','ReelTalk':'Originaux',
  /* es */ 'Nuevos Lanzamientos':'Nouveautés','CLASIFICACIÓN':'Classement','Serie Doblada':'VF doublés','Identidad Oculta':'Identité cachée','Relación Tabú':'Relation taboue','Bebés y Embarazos':'Bébés & Grossesse','Amor a Primera Vista':'Coup de foudre','Género Masculino':'Pour hommes','Hombre Lobo':'Loups-garous','Historias de Asia':'Histoires d’Asie','Más Recomendados':'Recommandés',
  /* pt */ 'Novo Lançamento':'Nouveautés','Mais Tendência':'Classement','Série Dublada':'VF doublés','Bebês e Gravidezes':'Bébés & Grossesse','Identidade Escondida':'Identité cachée','Amor à Primeira Vista':'Coup de foudre','Homem-lobo':'Loups-garous','Histórias da Ásia':'Histoires d’Asie','Mais Recomendado':'Recommandés','Relacionamento Tabu':'Relation taboue','Gênero Masculino':'Pour hommes',
  /* id */ 'Rilis Video':'Nouveautés','Video Terbaru':'Nouveautés','Peringkat':'Classement','Seri Dub':'VF doublés','Drama Dub':'VF doublés','Identitas Tersembunyi':'Identité cachée','Hubungan Terlarang':'Relation taboue','Cerita Asia':'Histoires d’Asie','Yang Direkomendasikan':'Recommandés','Direkomendasikan':'Recommandés','Kehamilan':'Bébés & Grossesse','Cinta Pandangan Pertama':'Coup de foudre','Kesempatan Kedua':'Secondes chances','Gaya Pria':'Pour hommes','Pria':'Pour hommes',
  /* de */ 'Neu':'Nouveautés','Neuerscheinungen':'Nouveautés','Rangliste':'Classement','Top-Charts':'Classement','Charts':'Classement','Top 10':'Classement','Synchronisierte':'VF doublés','Deutsche':'VF doublés','Verborgene Identität':'Identité cachée','Verbotene Liebe':'Relation taboue','Asiatische':'Histoires d’Asie','Empfohlen':'Recommandés','Schwangere':'Bébés & Grossesse','Liebe auf den ersten Blick':'Coup de foudre','Zweite Chance':'Secondes chances','Für Männer':'Pour hommes','Werwolf':'Loups-garous'};
function dramaShelfLabel(name){
  for(const k in DRAMA_SHELF_LABELS){if((name||'').startsWith(k))return DRAMA_SHELF_LABELS[k];}
  return name||'Autres';
}
async function dramaCatalog(){
  try{
    /* Fusion multi-locales (fr + en + es + pt) : ~4× plus de dramas et des
       catégories élargies (chaque locale a ses propres étagères). */
    const rs=await Promise.allSettled(DRAMA_LANGS.map(l=>
      nxFetch(dramaUrl('/bookshelves?lang='+l),{signal:AbortSignal.timeout(90000)}).then(r=>r.ok?r.json():null)));
    const out=[];const seen=new Set();
    for(const rs2 of rs){
      if(rs2.status!=='fulfilled'||!rs2.value)continue;        for(const shelf of ((rs2.value&&rs2.value.bookshelves)||[])){
        const label=dramaShelfLabel(shelf.bookshelf_name);
        for(const b of (shelf.books||[])){
          const m=nxMapDramaItem(b);if(!m)continue;
          /* Multi-appartenance : le drama est rattaché à CHAQUE étagère qui le
             référence (toutes locales) → filtres «Tout» et par catégorie élargis. */
          if(!m.shelves)m.shelves=new Set();
          m.shelves.add(label);
          if(m.shelves.size===1)m.shelf=label; /* compat affichage : 1re catégorie */
          if(!seen.has(m.bookId)){seen.add(m.bookId);out.push(m);}
        }
      }
    }
    /* Fallback : si l'endpoint agrégé échoue, on tente les 3 shelves historiques. */
    if(!out.length){
      const rs=await Promise.allSettled(
        ['recommend','newrelease','dramadub'].map(s=>
          nxFetch(dramaUrl('/'+s),{signal:AbortSignal.timeout(90000)}).then(r2=>r2.ok?r2.json():null)));
      for(const rs2 of rs){
        if(rs2.status!=='fulfilled'||!rs2.value)continue;
        const label=dramaShelfLabel(rs2.value.bookshelf_name);
        for(const b of ((rs2.value&&rs2.value.books)||[])){
          const m=nxMapDramaItem(b);if(!m)continue;
          if(!m.shelves)m.shelves=new Set();
          m.shelves.add(label);
          if(!m.shelf)m.shelf=label; /* compat affichage : 1re catégorie */
          if(!seen.has(m.bookId)){seen.add(m.bookId);out.push(m);}
        }
      }
    }
    return out;
  }catch(e){return[];}
}
/* Triers dramas : reco = ordre d'arrivée API (catalogue stable), le reste sur
   champs connus (épisodes, A→Z). */
const DRAMA_SORTS={
  reco:(a,b)=>0,
  /* Derniers ajoutés : les ids dramas (950000000+seq) croissent à chaque
     arrivée API → tri décroissant = derniers titres découverts d'abord. */
  recent:(a,b)=>(b.id||0)-(a.id||0),
  az:(a,b)=>String(a.t).localeCompare(String(b.t),'fr'),
  ep:(a,b)=>(b.chapterCount||0)-(a.chapterCount||0)};
/* Chips à bascule Thèmes/Années (mode de calcul : hors ligne pour rester fluide). */
const dramaThemeOf=x=>{
  /* Rattachement explicite : un titre ramené par les mots-clés d'un thème porte
     la pseudo-étagère « Thème : X » → il compte pour ce thème même si son titre
     ne matche aucun motif. */
  if(x.shelves){for(const th in DRAMA_THEME_PAT){if(x.shelves.has('Thème : '+th))return th;}}
  const t=`${x.t||''} ${x.d||''} ${(x.g||[]).join(' ')}`;
  for(const th in DRAMA_THEME_PAT){if(DRAMA_THEME_PAT[th].test(t))return th;}
  return null;};
const dramaYearOf=x=>{if(x._dramaEps&&x._dramaEps.length)return String(new Date().getFullYear());return x.y?String(x.y):null;};
function dramaYears(){const s=new Set();for(const x of C.filter(x=>x.k==='drama')){const yr=dramaYearOf(x);if(yr)s.add(yr);}return ['Tous',...[...s].sort().reverse()];}
function renderDramaThemeFilters(){
  const host=document.getElementById('dramaThemeFilters');if(!host)return;
  const pool=C.filter(x=>x.k==='drama');
  if(!pool.length){host.innerHTML='';return;}
  const set=dramaChipSet;
  const active=set==='theme'?dramaTheme:dramaYear;
  const list=set==='theme'?DRAMA_THEMES:dramaYears();
  const counts=new Map();
  if(set==='theme'){for(const x of pool){const th=dramaThemeOf(x);if(th)counts.set(th,(counts.get(th)||0)+1);}}
  else{for(const x of pool){const yr=dramaYearOf(x);if(yr)counts.set(yr,(counts.get(yr)||0)+1);}}
  host.innerHTML=`<span class="chip-set">`
    +`<button class="f-chip${set==='theme'?' on':''}" data-dset="theme">Thèmes</button>`
    +`<button class="f-chip${set==='annee'?' on':''}" data-dset="annee">Années</button></span>`
    +list.map(t=>`<button class="f-chip${active===t?' on':''}" data-df="${t}">${t}${t!=='Tous'?`<span class="cnt">${counts.get(t)||0}</span>`:''}</button>`).join('');
  host.querySelectorAll('[data-dset]').forEach(b=>b.onclick=()=>{dramaChipSet=b.dataset.dset;renderDramaThemeFilters();});
  host.querySelectorAll('[data-df]').forEach(c=>c.onclick=()=>{
    if(set==='theme')dramaTheme=c.dataset.df;else dramaYear=c.dataset.df;
    dramaLimit=DRAMA_PAGE_SIZE;dramaExpandMiss=0;dramaExpandPaused=false;
    renderDramaThemeFilters();renderDramaGrid();});
}
function renderDramaGrid(){
  const host=document.getElementById('gridDramas');if(!host)return;
  if(!dramaQuery.trim())dramaSearchIds.clear();
  fillGrid(host,dramaGridItems(),dramaState.online?'Aucun drama ne correspond à cette recherche.':'Catalogue dramas indisponible — lancez l\'API ReelShort (reelshort-api, port 5002).');
  updateDramaBadge();
  renderDramaThemeFilters();
  nxInfiniteClear('gridDramas');
  if(document.querySelector('#view-dramas.active')&&dramaState.online){
    nxInfiniteWatch('gridDramas',()=>dramaLoadMore());
    /* Scroll infini dans TOUTES les catégories (étagères ET thèmes) : quand on
       approche de la fin de ce qui est affiché, on précharge en amont (jamais
       pendant une expansion en cours — dramaLoadingMore protège ; les salves
       vides déclenchent la pause anti-tempête). À la fin : rafraîchit filtres +
       grille et réactive « Voir plus ». */
    if(dramaGridAll().length-dramaLimit<=DRAMA_PAGE_SIZE&&!dramaLoadingMore&&!dramaExpandPaused&&dramaExpandable())dramaExpandCatalog().then(added=>{
      if(added>0){renderDramaFilters();renderDramaGrid();}
      updateDramaMore();
    });
  }
}
/* ---- Filtres par catégorie + pagination « Voir plus » ---- */
function dramaShelves(){
  const counts={};
  /* Multi-appartenance : chaque drama compte dans TOUTES ses catégories.
     Les pseudo-étagères « Thème : X » (rattachement scroll infini) ne sont pas
     des catégories : elles ne s'affichent pas dans la barre. */
  for(const x of C){if(x.k!=='drama')continue;
    if(x.shelves){for(const s of x.shelves){if(s.indexOf('Thème : ')===0)continue;counts[s]=(counts[s]||0)+1;}}
    else if(x.shelf)counts[x.shelf]=(counts[x.shelf]||0)+1;}
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
}
function renderDramaFilters(){
  const host=document.getElementById('dramaShelfFilters');if(!host)return;
  const shelves=dramaShelves();
  if(!shelves.length){host.innerHTML='';return;}
  const total=C.filter(x=>x.k==='drama').length;
  const btn=(v,label,n)=>`<button class="f-chip${dramaShelf===v?' on':''}" data-shelf="${v}">${label}<span class="cnt">${n}</span></button>`;
  host.innerHTML=btn('tout','Tout',total)+shelves.map(([s,n])=>btn(s,s,n)).join('');
  host.querySelectorAll('.f-chip').forEach(b=>b.onclick=()=>{
    dramaShelf=b.dataset.shelf;dramaLimit=DRAMA_PAGE_SIZE;
    dramaExpandMiss=0;dramaExpandPaused=false; /* nouvel amont pour cette catégorie */
    host.querySelectorAll('.f-chip').forEach(c=>c.classList.remove('on'));b.classList.add('on');
    renderDramaGrid();
  });
}
function updateDramaMore(){
  const btn=document.getElementById('dramaMore');if(!btn)return;
  const n=dramaGridAll().length;
  const more=n>dramaLimit;
  const cat=dramaShelf!=='tout'?` ${dramaShelf}`:(dramaChipSet==='theme'&&dramaTheme!=='Tous'?` ${dramaTheme}`:'');
  if(dramaExpandPaused&&!dramaLoadingMore&&!more){
    /* Tout est affiché et l'amont est en pause → relance manuelle. */
    btn.style.display='';btn.textContent=`Réessayer${cat}`;btn.disabled=false;return;
  }
  btn.style.display=more?'':'none';
  btn.textContent=more?`Voir plus${cat} (${n-dramaLimit} restants)`:`Voir plus${cat}`;
  btn.disabled=dramaLoadingMore;
}
/* L'expansion amont tourne dans TOUTES les catégories (étagères ET thèmes) :
   exceptions : recherche active, tri « Derniers ajoutés » et filtre Année. */
const dramaExpandable=()=>!dramaQuery.trim()&&dramaSort!=='recent'&&!(dramaChipSet==='annee'&&dramaYear!=='Tous');
/* Recherche élargie paginée : arrose plusieurs mots-clés × plusieurs pages ×
   plusieurs locales (le backend ReelShort limite chaque shelf à ~10 livres, la
   recherche est le seul levier vraiment illimité). Dans une catégorie active,
   utilise des mots-clés thématiques et affecte les nouveaux titres à cette
   catégorie. Retourne le nb d'items NOUVEAUX. */
async function dramaExpandCatalog(){
  if(dramaLoadingMore||!dramaState.online)return 0;
  /* Recherche, tri « Derniers ajoutés » ou filtre Année → pas d'expansion amont.
     Garde AVANT tout effet de bord (flag + squelette). */
  if(!dramaExpandable())return 0;
  dramaLoadingMore=true;updateDramaMore();
  nxLoadingShow('gridDramas');
  /* Repère les titres DÉJÀ VISIBLES (filtres actifs compris) : une salve ne
     « compte » que si elle apporte de nouveaux titres affichables. */
  const before=new Set(dramaGridAll().map(x=>x.bookId));
  const shelfSeeds=!dramaQuery.trim()&&dramaShelf!=='tout'?(DRAMA_SHELF_SEEDS[dramaShelf]||[]):null;
  const themeSeeds=dramaChipSet==='theme'&&dramaTheme!=='Tous'?(DRAMA_THEME_SEEDS[dramaTheme]||[]):null;
  try{
    /* Salve de 6 requêtes : 6 mots-clés consécutifs (pages 1/N alternées),
       chacun sur une locale différente (rotation fr→en→es→pt→id→de). */
    const seeds=(shelfSeeds&&shelfSeeds.length?shelfSeeds:(themeSeeds&&themeSeeds.length?themeSeeds:DRAMA_SEEDS));
    const pick=(i)=>seeds[(dramaMoreSeed+i)%seeds.length];
    const langAt=(i)=>DRAMA_LANGS[(dramaMoreSeed+i)%DRAMA_LANGS.length];
    const jobs=[
      dramaSearchPaged(pick(0),dramaMorePage,langAt(0)),
      dramaSearchPaged(pick(1),1,langAt(1)),
      dramaSearchPaged(pick(2),dramaMorePage,langAt(2)),
      dramaSearchPaged(pick(3),1,langAt(3)),
      dramaSearchPaged(pick(4),dramaMorePage,langAt(4)),
      dramaSearchPaged(pick(5),1,langAt(5)),
    ];
    dramaMoreSeed+=6; /* = nb de requêtes de la salve : couvre tous les mots-clés */
    if(dramaMorePage>=DRAMA_MAX_SEARCH_PAGE){dramaMorePage=2;dramaMoreSeed+=1;}else dramaMorePage+=1;
    const rs=await Promise.allSettled(jobs);
    for(const rs2 of rs){
      if(rs2.status!=='fulfilled')continue;
      for(const it of rs2.value){
        if(shelfSeeds||themeSeeds){if(!it.shelves)it.shelves=new Set();if(shelfSeeds)it.shelves.add(dramaShelf);if(themeSeeds)it.shelves.add('Thème : '+dramaTheme);if(!it.shelf)it.shelf=shelfSeeds?dramaShelf:('Thème : '+dramaTheme);} /* thématique → catégorie active */
        pushDramaItems([it]);
      }
    }
  }finally{
    dramaLoadingMore=false;
    nxLoadingHide('gridDramas');
  }
  const added=dramaGridAll().filter(x=>!before.has(x.bookId)).length;
  /* Pause anti-tempête après 3 salves vides consécutives : le scroll infini
     cesse de redéclencher l'expansion en boucle ; « Voir plus » devient
     « Réessayer » pour repartir manuellement. */
  if(!added){dramaExpandMiss++;if(dramaExpandMiss>=3)dramaExpandPaused=true;}
  else{dramaExpandMiss=0;dramaExpandPaused=false;}
  return added;
}
/* Rotation de locales : la recherche s'appuie sur toutes les langues ReelShort. */
async function dramaSearchPaged(kw,page,lang){
  try{
    const l=(lang||DRAMA_LANGS[0]);
    const r=await nxFetch(dramaUrl('/search?keywords='+encodeURIComponent(kw)+'&page='+page+'&lang='+l),{signal:AbortSignal.timeout(60000)});
    if(!r.ok)return[];
    const d=await r.json();
    return ((d&&d.results)||[]).map(nxMapDramaItem).filter(Boolean);
  }catch(e){return[];}
}
async function dramaLoadMore(){
  dramaLimit+=DRAMA_PAGE_SIZE;renderDramaGrid();updateDramaMore();
  /* Tout est affiché + API en ligne → on va chercher de nouveaux dramas en amont
     (recherche paginée multi-locales, mots-clés thématiques si une catégorie
     est active). Les salves infructueuses sont tolérées (locales épuisées) et
     la rotation continue sans limite : scroll infini. */
  if(dramaGridAll().length<=dramaLimit&&dramaState.online&&!dramaExpandPaused&&dramaExpandable()){
    const added=await dramaExpandCatalog();
    if(added>0)renderDramaFilters();
    renderDramaGrid();updateDramaMore();
  }else updateDramaMore();
}
async function hydrateDramaCatalog(){
  if(!dramaState.online||dramaHydrated)return;
  dramaHydrated=true;
  const all=await dramaCatalog();
  if(!pushDramaItems(all)){dramaHydrated=false;return;}
  renderDramaFilters();
  renderDramaGrid();
  /* Deep-link #drama-<bookId> : résolu depuis le catalogue déjà chargé (ReelShort
     n'expose pas de fiche par id) ; sinon retour à la vue dramas. */
  if(location.hash.indexOf('#drama-')===0&&!document.getElementById('view-dramadetail').classList.contains('active')){
    const bid=location.hash.slice(7);
    if(byDramaBookId(bid))setView(location.hash.slice(1));
  }
}
/* ---- Page détail drama ---- */
let curDrama=null;
function goToDrama(bookId){setView('drama-'+bookId);}
function renderDramaPage(item){
  if(!item||item.k!=='drama')return false;
  curDrama=item;
  document.getElementById('ddBg').style.backgroundImage=`url(${item.p||''})`;
  const poster=document.getElementById('ddPoster');poster.src=item.p||'';poster.alt=item.t;
  document.getElementById('ddTitle').textContent=item.t;
  document.getElementById('ddDesc').textContent=item.d||'Synopsis en cours de chargement…';
  document.getElementById('ddMeta').innerHTML=`<span class="chip">ReelShort</span>${item.chapterCount?`<span>${item.chapterCount} épisodes</span>`:''}`;
  document.getElementById('ddTags').innerHTML=(item.g||[]).map(g=>`<span class="cast-chip">${g}</span>`).join('');
  document.getElementById('ddEpisodes').innerHTML='<div class="skel"></div>'.repeat(4);
  document.getElementById('ddCount').textContent='';
  /* Bouton « Reprendre » : position sauvegardée (épisode + temps) ? */
  syncDramaResume(item);
  syncDramaLike();
  hydrateDramaDetails(item);
  return true;
}
async function hydrateDramaDetails(item){
  if(curDrama!==item)return;
  try{
    const r=await nxFetch(dramaUrl('/episodes/'+encodeURIComponent(item.bookId)+'?filtered_title='+encodeURIComponent(item.filteredTitle||'')),{signal:AbortSignal.timeout(60000)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();
    if(curDrama!==item)return;
    const eps=((d&&d.episodes)||[]).map(e=>({n:Number(e.episode)||0,chapterId:e.chapter_id||''}));
    /* L'upstream ReelShort peut renvoyer une liste vide lors d'un buildId expiré :
       on retente une fois avant d'afficher l'état vide. */
    if(!eps.length&&!item._dramaRetry){item._dramaRetry=true;setTimeout(()=>{if(curDrama===item)hydrateDramaDetails(item);},2000);return;}
    item._dramaEps=eps;
    document.getElementById('ddCount').textContent=eps.length?`${eps.length} épisodes disponibles`:'Aucun épisode';
    renderDramaEpisodes(item);
  }catch(e){
    console.error('[drama] hydrateDramaDetails échec :',e&&e.message||e);
    if(curDrama===item)document.getElementById('ddEpisodes').innerHTML='<div class="empty"><div class="big">▦</div><p>Impossible de charger les épisodes — API ReelShort injoignable.</p></div>';
  }
}
function renderDramaEpisodes(item){
  const host=document.getElementById('ddEpisodes');
  const eps=item._dramaEps||[];
  if(!eps.length){host.innerHTML='<div class="empty"><div class="big">▦</div><p>Aucun épisode listé pour ce drama.</p></div>';return;}
  host.innerHTML=eps.map(e=>{
    const locked=!e.chapterId;
    return `<div class="ep-row" data-n="${e.n}">
      <div class="ep-thumb">${epWatchedBadge(item,e.n)}<img loading="lazy" src="${item.p||''}" alt="Épisode ${e.n}"><button class="ep-play" aria-label="Lire l'épisode ${e.n}" ${locked?'disabled':''}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button></div>
      <div class="ep-body"><div class="ep-head"><span class="ep-num">${e.n}</span><h4>Épisode ${e.n}</h4></div><p>${item.t} — épisode ${e.n}</p></div>
    </div>`;}).join('');
  host.querySelectorAll('.ep-row').forEach(rowEl=>{const n=+rowEl.dataset.n;rowEl.onclick=()=>{if(!rowEl.querySelector('.ep-play').disabled)openPlayer(item,{dramaEpisode:n});};});
}
function syncDramaLike(){if(!curDrama)return;const on=myList.has(curDrama.id);const b=document.getElementById('ddLike');
  b.style.background=on?'var(--accent-soft)':'';b.style.borderColor=on?'var(--accent)':'';}
/* Affiche « Reprendre ép. X · mm:ss » si une position est mémorisée. */
function syncDramaResume(item){
  const btn=document.getElementById('ddResume'),lbl=document.getElementById('ddResumeLbl');
  if(!btn)return;
  const pos=getDramaPos(item);
  if(pos){btn.style.display='';lbl.textContent=`Reprendre ép. ${pos.episode} · ${fmtTime(pos.t)}`;}
  else btn.style.display='none';
}
document.getElementById('ddResume').onclick=()=>{
  if(!curDrama)return;
  const pos=getDramaPos(curDrama);
  if(pos)openPlayer(curDrama,{dramaEpisode:pos.episode});
  else document.getElementById('ddResume').style.display='none';
};
document.getElementById('ddBack').onclick=()=>{setView('dramas');history.replaceState(null,'','#dramas');};
document.getElementById('ddPlay').onclick=()=>{if(!curDrama)return;openPlayer(curDrama,{dramaEpisode:1});};
document.getElementById('ddLike').onclick=()=>{if(!curDrama)return;const on=myList.has(curDrama.id);on?myList.delete(curDrama.id):myList.add(curDrama.id);saveMyList();showToast(on?'Retiré de Ma liste':'« '+curDrama.t+' » ajouté à Ma liste');syncDramaLike();updateListCount();renderCat();};
/* Flux épisode drama : résolution en 2 temps (episodes → video). Les m3u8 ReelShort
   passent par le proxy vidéo NOX (le CDN ne renvoie pas toujours les en-têtes CORS). */
async function dramaEpisodeStreams(item,opts){
  try{
    let eps=item._dramaEps;
    if(!eps){
      const r=await nxFetch(dramaUrl('/episodes/'+encodeURIComponent(item.bookId)+'?filtered_title='+encodeURIComponent(item.filteredTitle||'')),{signal:AbortSignal.timeout(60000)});
      if(!r.ok)return[];
      const d=await r.json();
      eps=((d&&d.episodes)||[]).map(e=>({n:Number(e.episode)||0,chapterId:e.chapter_id||''}));
      item._dramaEps=eps;
    }
    const n=Number(opts.dramaEpisode||1);
    const ep=eps.find(e=>e.n===n)||eps[0];
    if(!ep||!ep.chapterId)return[];
    const vr=await nxFetch(dramaUrl(`/video/${encodeURIComponent(item.bookId)}/${ep.n}?filtered_title=${encodeURIComponent(item.filteredTitle||'')}&chapter_id=${encodeURIComponent(ep.chapterId)}`),{signal:AbortSignal.timeout(60000)});
    if(!vr.ok)return[];
    const vd=await vr.json();
    const url=(vd&&vd.video_url)||'';
    if(!url)return[];
    return [{url,type:/\.m3u8([?#]|$)/i.test(url)?'hls':'file',language:'vf',
      providerName:'ReelShort',provider:'reelshort',quality:'HD'}];
  }catch(e){return[];}
}
/* ---- Routeur SPA ---- */
const VIEWS=['accueil','films','series','animes','dramas','nouveautes','vurecent','maliste','profil'];
function goToSeries(id){setView('serie-'+id);}
function setView(v){
  closePlayer();closeMobileMenu();
  if(v&&v.indexOf('anime-')===0){
    const item=byAnimeSlug(v.slice(6));
    const ok=item?renderAnimePage(item):false;
    if(ok){
      document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
      document.getElementById('view-animedetail').classList.add('active');
      document.querySelectorAll('#navMenu .nav-link,.mobile-link').forEach(a=>a.classList.remove('active'));
      history.replaceState(null,'','#'+v);
      scrollTo({top:0,behavior:'instant'});
      return;
    }
    v='animes';
  }
  if(v&&v.indexOf('drama-')===0){
    const item=byDramaBookId(v.slice(6));
    const ok=item?renderDramaPage(item):false;
    if(ok){
      document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
      document.getElementById('view-dramadetail').classList.add('active');
      document.querySelectorAll('#navMenu .nav-link,.mobile-link').forEach(a=>a.classList.remove('active'));
      history.replaceState(null,'','#'+v);
      scrollTo({top:0,behavior:'instant'});
      return;
    }
    v='dramas';
  }
  if(v&&v.indexOf('serie-')===0){
    const ok=renderSeriesPage(v.slice(6));
    if(ok){
      document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
      document.getElementById('view-seriedetail').classList.add('active');
      document.querySelectorAll('#navMenu .nav-link,.mobile-link').forEach(a=>a.classList.remove('active'));
      history.replaceState(null,'','#'+v);
      scrollTo({top:0,behavior:'instant'});
      return;
    }
    v='series';
  }
  if(!VIEWS.includes(v))v='accueil';
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('view-'+v);if(el)el.classList.add('active');
  document.querySelectorAll('#navMenu .nav-link').forEach(a=>a.classList.toggle('active',a.dataset.view===v));
  document.querySelectorAll('.mobile-link').forEach(a=>a.classList.toggle('active',a.dataset.view===v));
  renderCat();
  if(v==='profil'){updateProfileStats();updateListCount();}
  if(v==='vurecent')renderVuRecent();
  if(v==='animes'){renderAnimeGrid();if(animeState.online&&!animeHydrated)hydrateAnimeCatalog();}
  if(v==='dramas'){renderDramaGrid();if(dramaState.online&&!dramaHydrated)hydrateDramaCatalog();}
  scrollTo({top:0,behavior:'instant'});
}
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-view]');if(!el)return;
  e.preventDefault();
  /* Les rangées d'accueil n'ont pas toujours une vue dédiée : mapper leur id. */
  const v={top10:'films',reprendre:'maliste',simulcast:'animes','row-vurecent':'vurecent'}[el.dataset.view]||el.dataset.view;
  setView(v);history.replaceState(null,'','#'+v);});
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ')return;
  const el=e.target.closest('[data-view]');if(!el||el.tagName==='A')return;
  e.preventDefault();el.click();});
addEventListener('hashchange',()=>setView(location.hash.slice(1)));
/* ---- Catalogues ---- */
function chips(host,list,itemsForCounts,viewKey){
  const counts=genreCounts(itemsForCounts||[]);
  host.innerHTML=list.map((g,i)=>`<button class="f-chip${i===0?' on':''}" data-g="${g}">${g}${g!=='Tous'?`<span class="cnt">${counts.get(g)||0}</span>`:''}</button>`).join('');
  host.querySelectorAll('.f-chip').forEach(c=>c.onclick=()=>{
    host.querySelectorAll('.f-chip').forEach(x=>x.classList.remove('on'));c.classList.add('on');
    if(viewKey)catState[viewKey].genre=c.dataset.g||'Tous';
    renderCat();});}
function fillGrid(host,items,emptyMsg){
  if(!items.length){host.innerHTML=`<div class="empty"><div class="big">▦</div><p>${emptyMsg}</p></div>`;return;}
  host.innerHTML=items.map(x=>CARD(x)).join('');bindCards();}
const byGenre=(g,items)=>g==='Tous'?items:items.filter(x=>x.g.includes(g));
/* Recherche texte + genre + tri par vue catalogue. */
const catState={films:{q:'',genre:'Tous',sort:'populaire'},series:{q:'',genre:'Tous',sort:'populaire'},nouveautes:{q:'',genre:'Tous',year:'Tous',chipSet:'genre',sort:'recent'},maliste:{q:'',genre:'Tous',sort:'populaire'}};
/* Comparateur « plus récents d'abord » partagé (Films, Séries, Nouveautés) :
   date de sortie exacte (champ rd de l'API), repli année puis popularité
   (données démo sans rd). */
const byReleaseDateDesc=(a,b)=>{
  const da=String(a.rd||'').slice(0,10),db=String(b.rd||'').slice(0,10);
  if(da&&db&&da!==db)return da<db?1:-1;
  return (b.y||0)-(a.y||0)||(b.pop||0)-(a.pop||0);
};
/* Ordres de tri : défaut = popularité de l'API ; sinon note, date réelle, A→Z. */
const CAT_SORTS={
  populaire:(a,b)=>(b.pop||0)-(a.pop||0),
  note:(a,b)=>(b.note||0)-(a.note||0),
  recent:byReleaseDateDesc,
  az:(a,b)=>String(a.t).localeCompare(String(b.t),'fr')};
/* ---- Vue Nouveautés : tri dédié (date de sortie réelle) + chips à bascule ---- */
const NOUV_SORTS={
  /* Tri « Plus récentes » : même comparateur date réelle que Films/Séries. */
  recent:{label:'Tri : Plus récentes',fn:byReleaseDateDesc},
  populaire:{label:'Tri : Populaires',fn:(a,b)=>(b.pop||0)-(a.pop||0)},
  note:{label:'Tri : Mieux notés',fn:(a,b)=>(b.note||0)-(a.note||0)||(b.pop||0)-(a.pop||0)},
  az:{label:'Tri : A→Z',fn:(a,b)=>String(a.t).localeCompare(String(b.t),'fr')}};
const nouvPool=()=>C.filter(x=>(x.k==='film'||x.k==='serie')&&x.y>=2024);
function nouvYears(){
  const s=new Set();for(const x of nouvPool())s.add(String(x.y));
  return ['Tous',...[...s].sort().reverse()];
}
function nouvChipsRender(host){
  if(!host)return;
  const set=catState.nouveautes.chipSet||'genre';
  const active=set==='genre'?(catState.nouveautes.genre||'Tous'):(catState.nouveautes.year||'Tous');
  const list=set==='genre'?GENRES_NOUV:nouvYears();
  const counts=new Map();
  if(set==='genre'){for(const x of nouvPool())for(const g of (x.g||[]))counts.set(g,(counts.get(g)||0)+1);}
  else{for(const x of nouvPool())counts.set(String(x.y),(counts.get(String(x.y))||0)+1);}
  host.innerHTML=`<span class="nouv-set" style="display:inline-flex;gap:.35rem;margin-right:.6rem">`
    +`<button class="f-chip${set==='genre'?' on':''}" data-nset="genre">Genres</button>`
    +`<button class="f-chip${set==='annee'?' on':''}" data-nset="annee">Années</button></span>`
    +list.map(g=>`<button class="f-chip${active===g?' on':''}" data-ng="${g}">${g}${g!=='Tous'?`<span class="cnt">${counts.get(g)||0}</span>`:''}</button>`).join('');
  host.querySelectorAll('[data-nset]').forEach(b=>b.onclick=()=>{catState.nouveautes.chipSet=b.dataset.nset;nouvChipsRender(host);});
  host.querySelectorAll('[data-ng]').forEach(c=>c.onclick=()=>{
    if(set==='genre')catState.nouveautes.genre=c.dataset.ng;else catState.nouveautes.year=c.dataset.ng;
    nouvChipsRender(host);renderCat();});
}
const nouvChips=host=>nouvChipsRender(host);
function catToolbar(hostId,viewKey,placeholder){
  const host=document.getElementById(hostId);if(!host)return;
  const bar=document.createElement('div');bar.className='cat-toolbar';
  bar.innerHTML=`<input class="cat-search" type="search" placeholder="${placeholder}" autocomplete="off">
    <span class="cat-count" data-count></span>`;
  /* Insérée AVANT la rangée de chips pour ne pas être écrasée par chips(). */
  host.insertAdjacentElement('beforebegin',bar);
  if(viewKey==='films'||viewKey==='series'||viewKey==='nouveautes'){
    /* Tri : pour Nouveautés « Plus récentes » est le défaut (date réelle) ;
       pour films/séries Populaire reste le défaut. */
    const sel=document.createElement('select');sel.className='cat-sort';
    const opts=viewKey==='nouveautes'
      ?NOUV_SORT_ORDER.map(v=>[v,NOUV_SORTS[v].label])
      :['populaire','note','recent','az'].map(v=>[v,v==='populaire'?'Tri : Populaire':v==='note'?'Tri : Mieux notés':v==='recent'?'Tri : Plus récents':'Tri : A→Z']);
    sel.innerHTML=opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    sel.value=catState[viewKey].sort||(viewKey==='nouveautes'?'recent':'populaire');
    sel.addEventListener('change',()=>{catState[viewKey].sort=sel.value;renderCat();});
    bar.appendChild(sel);
  }
  const input=bar.querySelector('.cat-search');
  input.value=catState[viewKey].q;
  input.addEventListener('input',()=>{clearTimeout(input._t);input._t=setTimeout(()=>{
    catState[viewKey].q=input.value;renderCat();
    catLiveSearch(viewKey,input.value);   /* recherche FS/Cinemeta à distance */
  },200);});
  /* ---- Historique cliquable (partagé avec la navbar : nox_search_history) ----
     Focus → panneau « Récent » ; clic → relance la recherche (locale + distante) ;
     Enter enregistre la requête, comme dans la navbar. */
  bar.style.position=bar.style.position||'relative';
  const hpanel=document.createElement('div');hpanel.className='cat-hist';
  hpanel.style.cssText='position:absolute;top:100%;left:0;margin-top:.45rem;min-width:min(22rem,80vw);background:rgba(12,13,20,.96);border:1px solid var(--line);border-radius:12px;padding:.45rem;z-index:40;display:none;backdrop-filter:blur(10px);box-shadow:0 18px 40px -12px rgba(0,0,0,.6)';
  bar.appendChild(hpanel);
  const hideHist=()=>{hpanel.style.display='none';};
  input.addEventListener('focus',()=>{
    const hist=getHistory();
    if(!hist.length){hideHist();return;}
    hpanel.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;padding:.25rem .5rem .45rem">`
      +`<span style="font-size:.68rem;letter-spacing:.15em;text-transform:uppercase;color:var(--muted)">Récent</span>`
      +`<button type="button" data-chclear style="background:none;border:0;color:var(--muted);cursor:pointer;font-size:.72rem">Effacer</button></div>`
      +hist.map(h=>`<button type="button" data-chq="${escapeHtml(h)}" style="display:flex;width:100%;align-items:center;gap:.6rem;padding:.5rem;border:0;background:none;color:var(--txt);cursor:pointer;border-radius:8px;text-align:left">`
        +`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`
        +`<span style="font-size:.85rem">${escapeHtml(h)}</span></button>`).join('');
    hpanel.style.display='';
    hpanel.querySelectorAll('[data-chq]').forEach(b=>{
      b.addEventListener('mousedown',e=>e.preventDefault());   /* garde le focus */
      b.addEventListener('click',()=>{
        const q=b.dataset.chq||'';
        input.value=q;catState[viewKey].q=q;
        pushHistory(q);                     /* remonte en tête de l'historique */
        renderCat();catLiveSearch(viewKey,q);
        hideHist();
      });
    });
    const clr=hpanel.querySelector('[data-chclear]');
    if(clr)clr.onclick=()=>{clearHistory();hideHist();};
  });
  input.addEventListener('blur',()=>setTimeout(hideHist,150));
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&input.value.trim())pushHistory(input.value.trim());
    if(e.key==='Escape')hideHist();
  });
}
/* Titres trouvés à distance (FS/Cinemeta) par vue : passent le filtre texte
   local même si la requête ne matche pas le titre (orthographe, accents…). */
const catRemoteHits={films:new Set(),series:new Set(),nouveautes:new Set()};
const matchesCat=(x,st)=>{
  if(st.genre!=='Tous'&&!(x.g||[]).includes(st.genre))return false;
  const q=(st.q||'').trim().toLowerCase();
  if(!q)return true;
  return catRemoteHits._accept(x)||x.t.toLowerCase().includes(q)||(x.alts||[]).some(a=>String(a).toLowerCase().includes(q))||(x.g||[]).some(g=>g.toLowerCase().includes(q));
};
/* Vue d'acceptation associée à chaque état de vue (films/series/nouveautes). */
catRemoteHits._accept=x=>(catRemoteHits.films.has(x.id)&&catState.films.q.trim())
  ||(catRemoteHits.series.has(x.id)&&catState.series.q.trim())
  ||(catRemoteHits.nouveautes.has(x.id)&&catState.nouveautes.q.trim());
function renderCat(){
  /* Pool « Nouveautés » élargi : TOUS les films et séries récents du catalogue
     (plus de slice(0,20)), triés par date de sortie réelle ; la page s'enrichit
     via « Voir plus » / scroll infini. */
  const F=C.filter(x=>x.k==='film'),S=C.filter(x=>x.k==='serie');
  const NOUV_POOL=nouvPool();
  const sf=CAT_SORTS[catState.films.sort]||CAT_SORTS.populaire;
  const ssrt=CAT_SORTS[catState.series.sort]||CAT_SORTS.populaire;
  const ff=F.filter(x=>matchesCat(x,catState.films)).sort(sf);
  const ss=S.filter(x=>matchesCat(x,catState.series)).sort(ssrt);
  /* Nouveautés : recherche + genre (via catState) + chip année + tri dédié. */
  const chipY=catState.nouveautes.year||'Tous';
  let nn=NOUV_POOL.filter(x=>matchesCat(x,catState.nouveautes));
  if(chipY!=='Tous')nn=nn.filter(x=>String(x.y)===chipY);
  nn=nn.slice().sort((NOUV_SORTS[catState.nouveautes.sort]||NOUV_SORTS.recent).fn);
  const ll=[...myList].map(byId).filter(Boolean).filter(x=>matchesCat(x,catState.maliste));
  fillGrid(document.getElementById('gridFilms'),ff,'Aucun film ne correspond à ces filtres.');
  fillGrid(document.getElementById('gridSeries'),ss,'Aucune série ne correspond à ces filtres.');
  fillGrid(document.getElementById('gridNouv'),nn,'Aucune nouveauté pour ces filtres.');
  fillGrid(document.getElementById('gridVuRecent'),vuRecentPool(),'« Vu récemment » est vide.<br><span style="font-size:.85rem;opacity:.7">Les films et séries commencés apparaîtront ici — reprenez là où vous vous êtes arrêté.</span>');
  fillGrid(document.getElementById('gridListe'),ll,'Ma liste est vide.<br><span style="font-size:.85rem;opacity:.7">Survolez un titre et enregistrez-le — il apparaîtra ici.</span>');
  /* Compteurs « X titres » à côté de la recherche. */
  const setCount=(viewSel,n)=>{const el=document.querySelector(viewSel+' .cat-count');if(el)el.textContent=n+' titre'+(n>1?'s':'');};
  setCount('#view-films',ff.length);setCount('#view-series',ss.length);
  setCount('#view-nouveautes',nn.length);setCount('#view-maliste',ll.length);
  /* Bouton « Voir plus » en fin de catalogue (uniquement sur la vue active). */
  removeMoreButtons();
  if(document.querySelector('#view-films.active')){nxInfiniteClear('gridFilms');moreButton('films','gridFilms');nxInfiniteWatch('gridFilms',()=>nxAutoMoreFor('films'));}
  if(document.querySelector('#view-series.active')){nxInfiniteClear('gridSeries');moreButton('series','gridSeries');nxInfiniteWatch('gridSeries',()=>nxAutoMoreFor('series'));}
  if(document.querySelector('#view-nouveautes.active')){nxInfiniteClear('gridNouv');moreButton('nouveautes','gridNouv');nxInfiniteWatch('gridNouv',()=>nxAutoMoreFor('nouveautes'));}
}
function renderCatGenres(){
  const F=C.filter(x=>x.k==='film'),S=C.filter(x=>x.k==='serie');
  GENRES_F.length=0;GENRES_F.push('Tous',...topGenres(F));
  GENRES_S.length=0;GENRES_S.push('Tous',...topGenres(S));
  /* Genres du pool Nouveautés (plus fournis que le vieux pool de 20 titres). */
  GENRES_NOUV.length=0;GENRES_NOUV.push('Tous',...topGenres(nouvPool()));
  chips(document.getElementById('fFilms'),GENRES_F,F,'films');
  chips(document.getElementById('fSeries'),GENRES_S,S,'series');
  nouvChips(document.getElementById('fNouv'));
}
/* ---- Bouton « Voir plus » : pages suivantes de l'addon FrenchStream, puis
   relais Cinemeta (top popularité) quand la pagination FS est épuisée. ---- */
const MORE_PAGE=2;
const MORE_STATE={films:{idx:0,explicit:0,loading:false,done:false},series:{idx:0,explicit:0,loading:false,done:false},nouveautes:{idx:0,explicit:0,loading:false,done:false}};
const MORE_LABEL={films:'Voir plus de films',series:'Voir plus de séries',nouveautes:'Voir plus de nouveautés'};
const NOUV_SORT_ORDER=['recent','populaire','note','az'];
const GENRES_NOUV=['Tous'];
function removeMoreButtons(){document.querySelectorAll('.more-btn,.more-wrap').forEach(el=>el.remove());}
function moreButton(kind,grid){
  const host=document.getElementById(grid);if(!host)return;
  const st=MORE_STATE[kind],suffix={films:'Films',series:'Series',nouveautes:'Nouv'}[kind]||kind;
  if(st.loading){host.insertAdjacentHTML('beforeend','<div class="more-wrap" id="moreWrap'+suffix+'"><span class="more-loading">Chargement…</span></div>');return;}
  if(st.done)return;
  host.insertAdjacentHTML('beforeend','<button class="more-btn" id="more'+suffix+'">'+MORE_LABEL[kind]+'</button>');
  document.getElementById('more'+suffix).onclick=()=>loadMore(kind,false);
}
/* Un lot « Voir plus » : pages suivantes de l'addon FS, puis relais Cinemeta
   (top popularité) quand la pagination FS est épuisée (~600 titres par type). */
async function nxMoreBatch(kind){
  const st=nxMoreState[kind];
  const catId=kind==='series'?'frenchstream-series':'frenchstream-films';
  const type=kind==='series'?'series':'movie';
  if(!st.done){
    const skips=[st.skip,st.skip+18];
    const pages=await Promise.all(skips.map(s=>nxCatalogItems(type,catId,s)));
    st.skip+=36;
    const flat=pages.flat();
    if(flat.length)return flat.map(r=>nxMapNodeItem(r,kind==='series'?'serie':'film'));
    st.done=true;
  }
  const skips=[st.page*CINEMETA_SKIP_STEP,(st.page+1)*CINEMETA_SKIP_STEP];
  st.page+=2;
  const pages=await Promise.all(skips.map(s=>nxCinemetaCatalog(type,s)));
  return pages.flat().map(r=>nxMapNodeItem(r,kind==='series'?'serie':'film'));
}
async function loadMore(kind,silent){
  const st=MORE_STATE[kind];if(st.loading||st.done)return;
  st.loading=true;renderCat();
  const fs=nxMoreState[kind];
  const mapped=await nxMoreBatch(kind);
  /* Fini quand FS est épuisé ET Cinemeta renvoie moins de 2 pages vides. */
  if(!mapped.length&&fs.done&&fs.page>=14)st.done=true;
  /* N'ajouter que du neuf (catalogue FS, pages FS ou Cinemeta qui se chevauchent). */
  const have=new Set(C.map(x=>x.id));
  const fresh=mapped.filter(x=>x.id&&x.t&&x.t!=='Sans titre'&&!have.has(x.id));
  if(fresh.length){C.push(...fresh);fillHomeRows();fsBackfillYears();}
  st.loading=false;
  renderCatGenres();renderCat();
  if(!silent)showToast(fresh.length?fresh.length+' nouveau'+(fresh.length>1?'x':'')+' titre'+(fresh.length>1?'s':'')+' chargé'+(fresh.length>1?'s':''):'Tout le catalogue est déjà chargé');
}
/* ---- Scroll infini : chaque vue paginée installe une sentinelle en fin de
   grille ; quand elle devient visible, la page suivante est préchargée. ---- */
const nxInfinite={obs:null,sentinels:new WeakMap()};
function nxInfiniteWatch(gridId,onNearEnd){
  const grid=document.getElementById(gridId);if(!grid)return;
  const sin=document.createElement('div');sin.className='nx-infinite-sentinel';
  sin.style.cssText='grid-column:1/-1;height:2px;';
  grid.appendChild(sin);
  if(!nxInfinite.obs){
    nxInfinite.obs=new IntersectionObserver(es=>{
      for(const e of es){
        if(!e.isIntersecting)continue;
        const fn=nxInfinite.sentinels.get(e.target);
        if(fn){nxInfinite.sentinels.delete(e.target);fn();}
      }
    },{rootMargin:'600px 0px'});
  }
  nxInfinite.sentinels.set(sin,onNearEnd);
  nxInfinite.obs.observe(sin);
}
function nxInfiniteClear(gridId){
  /* Ciblé : ne retire que les sentinelles d'une grille (sinon toutes). */
  const sel=gridId?'#'+gridId+' .nx-infinite-sentinel':'.nx-infinite-sentinel';
  document.querySelectorAll(sel).forEach(el=>el.remove());
}
/* Squelettes de préchargement : rangée de cartes fantômes en bas de grille. */
function nxLoadingShow(gridId){
  const grid=document.getElementById(gridId);if(!grid)return;
  nxLoadingHide(gridId);
  const wrap=document.createElement('div');wrap.className='nx-skelwrap';wrap.id='nxLoading-'+gridId;
  wrap.innerHTML='<div class="skel"></div>'.repeat(6);
  grid.appendChild(wrap);
}
function nxLoadingHide(gridId){
  document.getElementById('nxLoading-'+gridId)?.remove();
}
/* Vue films/séries : la sentinelle déclenche le même chargement que « Voir plus »,
   en mode silencieux, si la séquence n'est pas déjà épuisée. */
function nxAutoMoreFor(kind){
  const st=MORE_STATE[kind];
  if(st.done||st.loading)return;
  loadMore(kind,true);
}
/* ---- Profil : réglages & sélection de profil ---- */
/* SETTINGS_KEY/loadSettings/saveSettings/getSetting/setSetting : définis en
   haut de fichier (bloc config) pour être disponibles partout. */
function applyNightMode(on){document.body.classList.toggle('night-mode',on);}
(function initSettings(){
  const saved=loadSettings();
  document.querySelectorAll('.toggle[data-set]').forEach(btn=>{
    const key=btn.dataset.set;
    const on=key in saved?saved[key]:btn.classList.contains('on');
    btn.classList.toggle('on',on);
    if(key==='night')applyNightMode(on);
    btn.onclick=()=>{
      const now=!btn.classList.contains('on');btn.classList.toggle('on',now);
      const s=loadSettings();s[key]=now;saveSettings(s);
      if(key==='night')applyNightMode(now);
      showToast(now?'Réglage activé':'Réglage désactivé');
    };
  });
})();
/* ---- Profil : compte modifiable ---- */
const PROFILE_KEY='nox_profile';
const DEFAULT_PROFILE={name:'Alex Rivière',email:'alex.riviere@nox.tv'};
function loadProfile(){try{return {...DEFAULT_PROFILE,...(JSON.parse(localStorage.getItem(PROFILE_KEY))||{})};}catch(e){return {...DEFAULT_PROFILE};}}
function saveProfileData(p){try{localStorage.setItem(PROFILE_KEY,JSON.stringify(p));}catch(e){}}
function applyProfile(p){
  document.getElementById('profName').textContent=p.name;
  document.getElementById('profEmail').textContent=p.email+' • Abonnement Premium 4K';
  const av=document.getElementById('profAvatar');
  av.textContent=(p.name.trim()[0]||'A').toUpperCase();
  av.style.background='linear-gradient(135deg,var(--accent),var(--accent2))';
}
(function initProfileEdit(){
  applyProfile(loadProfile());
  const view=document.getElementById('profView'),edit=document.getElementById('profEdit'),
  viewActions=document.getElementById('profViewActions'),editActions=document.getElementById('profEditActions'),
  nameInput=document.getElementById('profNameInput'),emailInput=document.getElementById('profEmailInput');
  function closeEdit(){view.style.display='';edit.style.display='none';viewActions.style.display='';editActions.style.display='none';}
  document.getElementById('profEditBtn').onclick=()=>{
    const cur=loadProfile();nameInput.value=cur.name;emailInput.value=cur.email;
    view.style.display='none';edit.style.display='flex';viewActions.style.display='none';editActions.style.display='flex';
    nameInput.focus();
  };
  document.getElementById('profCancelBtn').onclick=closeEdit;
  document.getElementById('profSaveBtn').onclick=()=>{
    const p={name:nameInput.value.trim()||DEFAULT_PROFILE.name,email:emailInput.value.trim()||DEFAULT_PROFILE.email};
    saveProfileData(p);applyProfile(p);closeEdit();showToast('Profil mis à jour');
  };
})();/* ---- Profils du compte : liste dynamique persistée (nox_profiles) ----
   Le premier profil (« principal ») reste le compte éditable du haut de page.
   Les suivants sont créés via la tuile « + », sélectionnables, supprimables. */
const PROFILES_KEY='nox_profiles';
const PROFILES_MAX=5;
const PCHIP_COLORS=['linear-gradient(135deg,var(--accent2),#2A7DB8)','linear-gradient(135deg,var(--gold),#B8860B)','linear-gradient(135deg,#E05252,#8B1E3F)','linear-gradient(135deg,#3DDC84,#1B6B45)','linear-gradient(135deg,#5B3FD6,var(--accent))'];
function loadProfiles(){try{return JSON.parse(localStorage.getItem(PROFILES_KEY))||[];}catch(e){return [];}}
function saveProfiles(l){try{localStorage.setItem(PROFILES_KEY,JSON.stringify(l.slice(0,PROFILES_MAX-1)));}catch(e){}}
function activeProfileIdx(){const i=loadSettings().activeProfile;return Number.isInteger(i)?i:0;}
function setActiveProfileIdx(i){const s=loadSettings();s.activeProfile=i;saveSettings(s);}
function renderProfiles(){
  const host=document.querySelector('.pcard .pchip')?.parentElement;if(!host)return;
  const profiles=loadProfiles();const act=activeProfileIdx();
  let html='<button class="pchip" data-pi="0"><div class="pav" id="profAvatar0" style="background:linear-gradient(135deg,var(--accent),var(--accent2))">'+(loadProfile().name.trim()[0]||'A').toUpperCase()+'</div><span style="color:var(--txt)">'+escapeHtml(loadProfile().name.split(' ')[0])+'</span></button>';
  profiles.forEach((p,i)=>{
    const pi=i+1;
    html+='<button class="pchip" data-pi="'+pi+'"><div class="pav" style="background:'+p.bg+'">'+escapeHtml(p.letter)+'</div><span'+(act===pi?' style="color:var(--txt)"':'')+'>'+escapeHtml(p.name)+'</span></button>';
  });
  if(profiles.length<PROFILES_MAX-1){
    html+='<button class="pchip" data-add="1"><div class="pav" style="background:rgba(255,255,255,.08);border:1px dashed var(--line)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div><span>Ajouter</span></button>';
  }
  host.innerHTML=html;
  host.querySelectorAll('.pchip').forEach(btn=>{
    const pi=btn.dataset.pi!=null?+btn.dataset.pi:null;
    btn.classList.toggle('active',pi===act);
    btn.onclick=()=>{
      if(btn.dataset.add){
        const name=(prompt('Nom du nouveau profil :')||'').trim();
        if(!name)return;
        const list=loadProfiles();
        list.push({name,letter:(name[0]||'?').toUpperCase(),bg:PCHIP_COLORS[list.length%PCHIP_COLORS.length]});
        saveProfiles(list);
        setActiveProfileIdx(list.length);   /* le nouveau profil devient actif */
        applyActiveProfile();renderProfiles();
        showToast('Profil « '+name+' » créé');
        return;
      }
      setActiveProfileIdx(pi);applyActiveProfile();renderProfiles();
      showToast('Profil actif : '+(pi===0?loadProfile().name.split(' ')[0]:loadProfiles()[pi-1].name));
    };
    /* Suppression : double-clic sur un profil secondaire. */
    if(pi&&pi>0)btn.ondblclick=()=>{
      const p=loadProfiles()[pi-1];
      if(!confirm('Supprimer le profil « '+p.name+' » ?'))return;
      const list=loadProfiles();list.splice(pi-1,1);saveProfiles(list);
      if(activeProfileIdx()===pi)setActiveProfileIdx(0);
      else if(activeProfileIdx()>pi)setActiveProfileIdx(activeProfileIdx()-1);
      applyActiveProfile();renderProfiles();showToast('Profil supprimé');
    };
  });
}
/* Applique le profil actif à l'en-tête de la page Profil (avatar + nom).
   Le profil 0 (principal) est le compte éditable ; les autres sont lecture seule. */
function applyActiveProfile(){
  const act=activeProfileIdx();
  const av=document.getElementById('profAvatar'),nm=document.getElementById('profName');
  if(!av||!nm)return;
  if(act===0){applyProfile(loadProfile());return;}
  const p=loadProfiles()[act-1];
  if(!p){applyProfile(loadProfile());return;}
  av.textContent=p.letter;av.style.background=p.bg;
  nm.textContent=p.name;
  const em=document.getElementById('profEmail');
  if(em)em.textContent='Profil '+(act)+' • Abonnement Premium 4K';
}
function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
/* Premier rendu de la liste de profils ; re-rendu aussi après chaque édition
   du profil principal (la tuile reprend l'initiale et le prénom). */
renderProfiles();applyActiveProfile();
document.getElementById('profSaveBtn').addEventListener('click',()=>{renderProfiles();applyActiveProfile();});
/* ---- Écran de lecture ---- */
const plEl=document.getElementById('player'),plUi=document.getElementById('plUi'),plBg=document.getElementById('plBg'),
plTitle=document.getElementById('plTitle'),plSub=document.getElementById('plSub'),plMatch=document.getElementById('plMatch'),
plFill=document.getElementById('plFill'),plKnob=document.getElementById('plKnob'),plBar=document.getElementById('plBar'),
plTime=document.getElementById('plTime'),plPlayIcon=document.getElementById('plPlayIcon'),plBigIcon=document.getElementById('plBigIcon'),
plVolBtn=document.getElementById('plVol'),plVideo=document.getElementById('plVideo'),plIframe=document.getElementById('plIframe');
const ICON_PLAY='<path d="M8 5v14l11-7z"/>';
const ICON_PAUSE='<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>';
const ICON_VOL='<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/>';
const ICON_MUTE='<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/>';
let plState={item:null,opts:{},mode:'sim',simDuration:0,duration:0,current:0,playing:false,muted:false,streams:[],streamIdx:-1,metaReady:false,searching:false};
let plWatchdog=null;
function plClearWatchdog(){if(plWatchdog){clearTimeout(plWatchdog);plWatchdog=null;}}
let plTimer=null,plHideTimer=null;
/* ---- Qualité maximale & sous-titres (réglages Profil appliqués au lecteur) ----
   max : 2160=4K, 1080=FHD, 720=HD, 480=SD, 0=auto. Cycle via le badge du
   lecteur ; persisté dans nox_settings.quality. Les sous-titres FR sont
   activés dès que hls.js expose une piste (réglage subs, défaut ON). */
const QUALITY_STEPS=[{v:2160,l:'4K'},{v:1080,l:'FHD'},{v:720,l:'HD'},{v:480,l:'SD'},{v:0,l:'AUTO'}];
function qualityLabel(v){const s=QUALITY_STEPS.find(q=>q.v===v);return s?s.l:'AUTO';}
function plQualityLabel(){return qualityLabel(getSetting('quality',0));}
function plApplyQuality(){
  const btn=document.getElementById('plQualityBtn');if(btn)btn.textContent=plQualityLabel();
  if(!plHls||!plHls.levels||!plHls.levels.length)return;
  const max=getSetting('quality',0);
  if(!max){plHls.currentLevel=-1;plHls.autoLevelCapping=-1;return;}
  /* Cap les niveaux au-dessus du seuil ; hls.js choisit le meilleur niveau ≤ cap. */
  const ok=plHls.levels.map((l,i)=>({i,h:(l.height||0)})).filter(x=>x.h>0&&x.h<=max);
  const cap=ok.length?Math.max(...ok.map(x=>x.i)):-1;
  plHls.autoLevelCapping=cap;
  plHls.currentLevel=cap;      /* départ sur le meilleur niveau autorisé */
}
function plApplySubs(){
  const on=getSetting('subs',true);
  const btn=document.getElementById('plSubsBtn');
  if(btn){btn.classList.toggle('on',on);btn.style.borderColor=on?'var(--accent)':'';}
  if(plVideo.textTracks){
    [...plVideo.textTracks].forEach(t=>{t.mode=on&&/fr|french/i.test(t.language||t.label||'')?'showing':'disabled';});
  }
}
function plCycleQuality(){
  const cur=getSetting('quality',0);
  const idx=QUALITY_STEPS.findIndex(q=>q.v===cur);
  const next=QUALITY_STEPS[(idx+1)%QUALITY_STEPS.length];
  setSetting('quality',next.v);
  plApplyQuality();showToast('Qualité max : '+next.l);
}
document.getElementById('plQualityBtn').onclick=e=>{e.stopPropagation();plCycleQuality();plResetHide();};
document.getElementById('plSubsBtn').onclick=e=>{e.stopPropagation();
  const on=!getSetting('subs',true);setSetting('subs',on);plApplySubs();
  showToast(on?'Sous-titres FR activés':'Sous-titres désactivés');plResetHide();};
/* État initial des badges qualité / sous-titres du lecteur. */
(function initPlBadges(){
  const qb=document.getElementById('plQualityBtn');if(qb)qb.textContent=plQualityLabel();
  plApplySubs();
})();
function fmtTime(s){s=Math.max(0,Math.floor(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;
  return h>0?`${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:`${m}:${String(ss).padStart(2,'0')}`;}
function plRender(){
  const pct=plState.duration?Math.min(100,plState.current/plState.duration*100):0;
  plFill.style.width=pct+'%';plKnob.style.left=pct+'%';
  plTime.textContent=`${fmtTime(plState.current)} / ${fmtTime(plState.duration)}`;
}
function plTick(){plState.current+=1;if(plState.current>=plState.duration){plState.current=plState.duration;plSetPlaying(false);showToast('Fin de la lecture');
  const it=plState.item;
  if(it){const ep=it.k==='drama'?(plState.opts.dramaEpisode||1):(plState.opts.episode||1);setPos(it,ep,0);markDone(it);if(it.k==='drama')syncDramaResume(it);}
  if(plHasNextEpisode())plShowNextCountdown();}plRender();}
function plSetPlaying(on){
  plState.playing=on;
  plPlayIcon.innerHTML=on?ICON_PAUSE:ICON_PLAY;
  plBigIcon.innerHTML=on?ICON_PAUSE:ICON_PLAY;
  clearInterval(plTimer);
  if(plState.mode==='live'){
    /* En live (HLS/vidéo), la pause est déléguée au média réel : le timer de
       simulation ne doit pas tourner (sinon la barre avance toute seule et le
       temps affiché ne correspond plus à la vidéo). */
    if(on){
      /* si hls.js pilote le flux, la lecture passe par le média attaché */
      const p=plHls&&!plHls.media?Promise.resolve():plVideo.play();
      Promise.resolve(p).catch(()=>{
        /* Autoplay bloqué par le navigateur : nouvelle tentative en sourdine */
        plState.muted=true;plVideo.muted=true;
        plVolBtn.querySelector('svg').innerHTML=ICON_MUTE;plVolBtn.classList.add('muted');
        plVideo.play().catch(()=>{});
      });
    }else plVideo.pause();
    return;
  }
  if(on)plTimer=setInterval(plTick,1000);
}
async function openPlayer(item,opts={}){
  if(!item)return;
  /* La plupart des titres TMDB n'ont pas de durée fiable (m:0) → 1 h 50 min par défaut */
  const mins=item.m||110;
  const simDuration=(item.k==='serie'?42:mins)*60;
  plState={item,opts,mode:'sim',simDuration,duration:simDuration,current:0,playing:true,muted:false,streams:[],streamIdx:-1,metaReady:false,searching:false};
  plClearWatchdog();
  plStopVideo();
  plEl.classList.remove('iframe-mode');plEl.classList.remove('live-video');
  plVideo.style.display='none';plBg.style.display='';
  plBg.style.backgroundImage=`url(${imgBg(item.id)})`;
  plTitle.textContent=item.t;
  plSub.textContent=item.k==='anime'?`${item.t} — Épisode ${opts.episode||1}${opts.animeSeason?' ('+opts.animeSeason+')':''}`:item.k==='serie'?`${item.t} • Saison ${opts.season||1}, Épisode ${opts.episode||1}`:item.g.join(' • ');
  plMatch.textContent='Recherche de flux via FrenchStream…';
  plVolBtn.querySelector('svg').innerHTML=ICON_VOL;plVolBtn.classList.remove('muted');
  plSourcesBtn.style.display='';plSourcesCount.textContent='0';plSourcesEl.classList.remove('folded');
  plRetryBtn.style.display='none';
  plRender();plSetPlaying(true);
  plEl.classList.add('open');document.body.style.overflow='hidden';
  plResetHide();
  plPosStart();                                        /* reprise : sauvegarde périodique */
  /* — Connexion FrenchStream : tentative de flux réels — */
  plSearchStreams();
}
/* Relance (ou lance) la recherche des flux via FrenchStream puis injecte le premier flux lisible.
   La section Sources reste visible pendant toute la recherche (spinner), puis affiche la liste
   des flux sélectionnables ou un état « aucun flux » avec bouton de relance. */
let plSearchSeq=0,plEmbedRetrySeq=0;
async function plSearchStreams(){
  const item=plState.item,opts=plState.opts,seq=++plSearchSeq;
  if(!item||!plEl.classList.contains('open'))return;
  plState.searching=true;
  plState.streams=[];plState.streamIdx=-1;
  plSourcesCount.textContent='0';
  plSourcesBtn.style.display='';
  plRetryBtn.style.display='none';
  showSources();
  const streams=nxSortStreams(await nxStreams(item,opts));
  plState.searching=false;
  if(seq!==plSearchSeq||plState.item!==item||!plEl.classList.contains('open'))return;
  plState.streams=streams;plState.streamIdx=-1;
  plSourcesCount.textContent=String(streams.length);
  plSourcesBtn.style.display='';
  if(streams.length){
    plRetryBtn.style.display='none';
    startLiveStream(streams,0,item);
  }else{
    plRetryBtn.style.display='';
    plMatch.textContent='Aucun flux trouvé par FrenchStream — lecture simulée en cours';
    if(apiState.online)showToast('Aucun flux trouvé pour ce titre — lecture simulée');
  }
  showSources();
}
function startLiveStream(streams,idx,item){
  if(plState.item!==item)return;
  const stream=streams[idx];
  const url=nxStreamUrl(stream);
  if(!stream||!url){tryNextStream(streams,idx,item);return;}
  plClearWatchdog();
  plState.mode='live';plState.streams=streams;plState.streamIdx=idx;
  plState.duration=0;plState.current=0;
  plSourcesCount.textContent=String(streams.length);plSourcesBtn.style.display='';plRetryBtn.style.display='none';
  const isIframe=nxIsEmbedStream(stream);
  plEl.classList.toggle('live-video',!isIframe);
  plStopVideo();
  plEl.classList.toggle('iframe-mode',isIframe);
  plBg.style.display='none';
  plBar.style.visibility=isIframe?'hidden':'';
  document.getElementById('plPlay').style.visibility=isIframe?'hidden':'';
  plVolBtn.style.visibility=isIframe?'hidden':'';
  plTime.style.visibility=isIframe?'hidden':'';
  document.getElementById('plBig').style.display=isIframe?'none':'';
  document.getElementById('plBack10').style.visibility=isIframe?'hidden':'';
  document.getElementById('plFwd10').style.visibility=isIframe?'hidden':'';
  // ── BOUTON OUVERTURE ONGLET : afficher si iframe, masquer si HLS ──
  const openTabBtn=document.getElementById('plOpenTab');
  if(openTabBtn)openTabBtn.style.display=isIframe?'':'none';
  if(isIframe){
    /* Page HTML / lecteur distant : iframe plein écran (jamais via le proxy vidéo).
       Un watchdog bascule sur la source suivante si la page est bloquée (XFO/CSP) ou vide.
       Un embed n'est PAS contrôlable (ni reprise ni compte à rebours) : on retente
       l'extraction HLS en arrière-plan et on simule une progression indicative. */
    plVideo.style.display='none';
    plIframe.style.display='block';
    plIframe.src=stream.url;
    clearInterval(plTimer);plState.playing=true;
    plMatch.textContent='Lecteur distant chargé — utilisez ses contrôles intégrés';
    /* Progression indicative : la durée estimée du titre sert d'horloge pour
       sauvegarder une position (utile pour l'ordre « vu » des épisodes). */
    if(!plState.simDuration)plState.simDuration=(item.k==='serie'||item.k==='anime'?42:(item.m||110))*60;
    plState.duration=plState.duration||plState.simDuration;
    plState.current=0;
    plTimer=setInterval(()=>{plState.current+=1;plRender();},1000);
    /* Re-résolution en arrière-plan SANS bascule automatique : si un flux natif
       est extrait, il est ajouté à SOURCES — l'utilisateur bascule s'il veut
       (pause/seek/reprise ne marchent que sur le flux natif). */
    const retrySeq=++plEmbedRetrySeq;
    setTimeout(()=>{
      if(retrySeq!==plEmbedRetrySeq||plState.item!==item||!plEl.classList.contains('open'))return;
      nxRetryResolveEmbed(stream).then(better=>{
        if(better&&retrySeq===plEmbedRetrySeq&&plState.item===item&&plEl.classList.contains('open')){
          renderSources();
          showToast('Flux natif extrait — disponible dans SOURCES');
        }
      });
    },15000);
    /* Aucun timer d'éjection ici : l'embed reste affiché tant que l'utilisateur
       ne change pas lui-même de source (watchdog désactivé). */
    plArmWatchdog(streams,idx,item,12000,()=>true);
  }else{
    plIframe.style.display='none';
    plVideo.style.display='block';
    plVideo.muted=plState.muted;
    const isHls=/\.m3u8(?:[?#]|$)/i.test(String(stream.url||''))||stream.type==='hls';
    const HlsOK=typeof Hls!=='undefined'&&Hls&&typeof Hls.isSupported==='function'&&Hls.isSupported();
    if(isHls&&HlsOK){
      /* Les CDNs FS (fsvid, filemoon, vidzy…) peuvent être très lents (10-45 s
         par segment selon la route) : timeouts généreux pour laisser le tampon
         se constituer, sinon hls.js abandonne des flux qui marchent. */
      plHls=new Hls({maxBufferLength:30,fragLoadingTimeOut:60000,fragLoadingMaxRetry:8,
        manifestLoadingTimeOut:30000,levelLoadingTimeOut:30000,manifestLoadingMaxRetry:6,
        levelLoadingMaxRetry:6,fragLoadingMaxRetryTimeout:120000,startLevel:-1});
      plHls.on(Hls.Events.MANIFEST_PARSED,()=>{plClearWatchdog();plApplyQuality();plSetPlaying(true);});
      /* Sous-titres FR par défaut (réglage Profil) dès que hls.js expose les pistes. */
      plHls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED,()=>{plApplySubs();});
      plHls.on(Hls.Events.ERROR,(_,data)=>{
        if(data&&data.fatal){
          /* Récupération standard avant de changer de source */
          if(data.type===Hls.ErrorTypes.NETWORK_ERROR&&data.details!==Hls.ErrorDetails.MANIFEST_LOAD_ERROR){plHls.startLoad();return;}
          if(data.type===Hls.ErrorTypes.MEDIA_ERROR){plHls.recoverMediaError();return;}
          try{plHls.destroy();}catch(e){}plHls=null;
          tryNextStream(streams,idx,item,'flux HLS indisponible');
        }
      });
      plHls.loadSource(url);plHls.attachMedia(plVideo);
    }else{
      plVideo.src=url;
    }
    plSetPlaying(true);
    /* 60 s : un démarrage FS lent peut prendre ~40 s (manifest 9 s + 1er segment 30 s). */
    plArmWatchdog(streams,idx,item,60000,()=>plVideo.readyState>=2);
  }
  const lbl=[stream.providerName||stream.provider,stream.quality||null,stream.language?(stream.language==='fr'?'VF':String(stream.language).toUpperCase()):null].filter(Boolean).join(' • ');
  plMatch.textContent=`Flux : ${lbl}${streams.length>1?` (${idx+1}/${streams.length})`:''}`;
  plSourcesBtn.style.display='';plSourcesCount.textContent=String(streams.length);plRetryBtn.style.display='none';
  renderSources();
  plRender();plResetHide();
}
/* Si un flux ne démarre pas (timeout / erreur), on enchaîne automatiquement sur le suivant */
function tryNextStream(streams,idx,item,reason){
  if(plState.item!==item||plState.mode!=='live')return;
  if(reason)console.warn('[NOX] Flux échoué ('+reason+') — source '+(idx+1)+'/'+(streams?streams.length:0));
  if(streams&&idx+1<streams.length){startLiveStream(streams,idx+1,item);return;}
  fallbackSim(reason);
}
/* WATCHDOG : les CDNs FS peuvent être très lents — si le flux ne démarre pas
   (aucun octet décodé) après un délai long, on passe à la source suivante.
   Dès que la lecture a démarré (readyCheck OK), le flux en cours est conservé :
   les lenteurs ultérieures sont absorbées par le tampon hls.js, et les vraies
   erreurs passent par les handlers (hls.js / <video>). */
function plArmWatchdog(streams,idx,item,ms,readyCheck){
  plClearWatchdog();
  plWatchdog=setTimeout(()=>{
    if(plState.item!==item||plState.mode!=='live')return;
    if(readyCheck&&readyCheck())return;                 /* lecture OK → laisser courir */
    tryNextStream(streams,idx,item,'démarrage trop lent');
  },ms);
}
function fallbackSim(reason){
  plClearWatchdog();
  plState.mode='sim';
  plEl.classList.remove('iframe-mode');
  plEl.classList.remove('live-video');
  plStopVideo();
  plVideo.style.display='none';plBg.style.display='';
  plBar.style.visibility='';
  document.getElementById('plPlay').style.visibility='';
  plVolBtn.style.visibility='';
  plTime.style.visibility='';
  document.getElementById('plBig').style.display='';
  document.getElementById('plBack10').style.visibility='';
  document.getElementById('plFwd10').style.visibility='';
  plState.duration=plState.simDuration||((plState.item.k==='serie'?42:plState.item.m)*60);
  plState.streamIdx=-1;
  /* Les sources restent accessibles : l'utilisateur peut choisir manuellement un flux ou relancer la recherche */
  if(plState.streams.length){plSourcesBtn.style.display='';plSourcesCount.textContent=String(plState.streams.length);}
  else plSourcesBtn.style.display='none';
  plRetryBtn.style.display='';
  // Afficher le bouton "ouvrir dans onglet" si des sources embed sont disponibles
  const openTabBtn=document.getElementById('plOpenTab');
  if(openTabBtn&&plState.streams.some(s=>nxIsEmbedStream(s)))openTabBtn.style.display='';
  else if(openTabBtn)openTabBtn.style.display='none';
  plMatch.textContent='Flux indisponibles'+(reason?' — '+reason:'')+' — lecture simulée. Choisissez une source ou relancez la recherche.';
  plSetPlaying(true);
  showToast('Flux indisponible'+(reason?' — '+reason:'')+' — lecture simulée');
  showSources();
}
function closePlayer(){
  if(!plEl.classList.contains('open'))return;
  plEl.classList.remove('open');document.body.style.overflow='';
  clearInterval(plTimer);clearTimeout(plHideTimer);plClearWatchdog();plUi.classList.remove('hide');
  plPosSave();plPosStop();                             /* reprise : dernière sauvegarde */
  plHideNextCountdown();plNextHint.style.display='none';
  plStopVideo();plState.mode='sim';plState.searching=false;plSearchSeq++;plEl.classList.remove('iframe-mode');plEl.classList.remove('live-video');hideSources();
  plRetryBtn.style.display='none';
  plBar.style.visibility='';
  document.getElementById('plPlay').style.visibility='';
  plVolBtn.style.visibility='';
  plTime.style.visibility='';
  document.getElementById('plBig').style.display='';
  document.getElementById('plBack10').style.visibility='';
  document.getElementById('plFwd10').style.visibility='';
}
function plResetHide(){clearTimeout(plHideTimer);plUi.classList.remove('hide');
  plHideTimer=setTimeout(()=>{if(plState.playing)plUi.classList.add('hide');},3000);}
plEl.addEventListener('mousemove',plResetHide);
plEl.addEventListener('mouseleave',()=>{if(plState.playing)plUi.classList.add('hide');});
document.getElementById('plBack').onclick=closePlayer;
document.getElementById('plPlay').onclick=()=>{plSetPlaying(!plState.playing);plResetHide();};
document.getElementById('plBig').onclick=()=>{plSetPlaying(!plState.playing);plResetHide();};
/* Avance/recul 10 s : en live, la vidéo HLS avance réellement (sinon le lecteur
   semble figé — le drama ne peut « pas avancer ») ; en sim, on décale le temps simulé. */
document.getElementById('plBack10').onclick=()=>{
  if(plState.mode==='live'&&plVideo&&isFinite(plVideo.duration)&&plVideo.duration>0){
    const t=Math.max(0,(plVideo.currentTime||0)-10);
    try{plVideo.fastSeek?t.fastSeek(t):plVideo.currentTime=t;}catch(e){plVideo.currentTime=t;}
    plState.current=plVideo.currentTime||0;
  }else{plState.current=Math.max(0,plState.current-10);}
  plRender();plResetHide();
};
document.getElementById('plFwd10').onclick=()=>{
  if(plState.mode==='live'&&plVideo&&isFinite(plVideo.duration)&&plVideo.duration>0){
    const t=Math.min(plVideo.duration-0.5,(plVideo.currentTime||0)+10);
    try{plVideo.fastSeek?t.fastSeek(t):plVideo.currentTime=t;}catch(e){plVideo.currentTime=t;}
    plState.current=plVideo.currentTime||0;
  }else{plState.current=Math.min(plState.duration,plState.current+10);}
  plRender();plResetHide();
};
document.getElementById('plNext').onclick=()=>{
  /* Séries/dramas/animés : enchaîner le VRAI épisode suivant (et non changer
     de flux ou rejouer l'épisode courant). */
  if(plHasNextEpisode()){plNextEpisodeGo();plResetHide();return;}
  if(plState.mode==='live'&&plState.streams.length>1&&plState.streamIdx<plState.streams.length-1){startLiveStream(plState.streams,plState.streamIdx+1,plState.item);}
  else{
    if(plState.mode==='live')showToast('Dernier flux disponible');
    else{showToast(plState.item&&plState.item.k==='serie'?'Épisode suivant':'Titre suivant');plState.current=0;plRender();}
  }
  plResetHide();};
document.getElementById('plVol').onclick=()=>{plState.muted=plState.mode==='live'?!plVideo.muted:!plState.muted;if(plState.mode==='live')plVideo.muted=plState.muted;plVolBtn.querySelector('svg').innerHTML=plState.muted?ICON_MUTE:ICON_VOL;plVolBtn.classList.toggle('muted',plState.muted);plResetHide();};
document.getElementById('plFull').onclick=()=>{
  if(!document.fullscreenElement)plEl.requestFullscreen?.().catch(()=>{});
  else document.exitFullscreen?.().catch(()=>{});
  plResetHide();
};
// ── Bouton ouvrir dans nouvel onglet ──
function plUpdateOpenTabBtn(){
  const btn=document.getElementById('plOpenTab');
  if(!btn)return;
  const isIframe=plState.mode==='live'&&plState.streams&&plState.streams.length&&nxIsEmbedStream(plState.streams[plState.streamIdx]);
  btn.style.display=isIframe?'':'none';
}
document.getElementById('plOpenTab').onclick=()=>{
  // Ouvre un flux dans un nouvel onglet — fonctionne en mode live (iframe)
  // et en mode sim (avec sources embed disponibles)
  const curMode=plState?plState.mode:null;
  if(curMode!=='live'&&curMode!=='sim'){showToast('Aucun flux à ouvrir');return;}
  const curStreams=plState&&plState.streams||[];
  if(!curStreams.length){showToast('Aucun flux à ouvrir');return;}
  // En mode live : prendre le flux courant ; en mode sim : prendre le premier embed
  let s=null;
  if(curMode==='live'&&plState) s=plState.streams[plState.streamIdx];
  else s=curStreams.find(s=>nxIsEmbedStream(s))||curStreams[0];
  if(!s||!s.url){showToast('Aucune URL disponible');return;}
  if(nxIsEmbedStream(s)){
    const url=s.url;
    if(url){
      const a=document.createElement('a');
      a.href=url;a.target='_blank';a.rel='noopener';
      a.click();
      showToast('Ouverture dans nouvel onglet…');
    }
  }else{
    showToast('Ce flux nécessite le player NOX — utilisez l\'iframe ou copiez l\'URL dans la section Sources');
  }
  plResetHide();
};
function seekFromEvent(e){
  const r=plBar.getBoundingClientRect();const x=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
  const ratio=Math.min(1,Math.max(0,x/r.width));
  /* Seek réel sur la vidéo HLS (sinon la barre ne « prend » pas et la lecture
     reste bloquée à la position de départ). */
  if(plState.mode==='live'&&plVideo&&isFinite(plVideo.duration)&&plVideo.duration>0){
    const t=ratio*plVideo.duration;
    try{plVideo.fastSeek?plVideo.fastSeek(t):plVideo.currentTime=t;}catch(err){try{plVideo.currentTime=t;}catch(e2){}}
    plState.current=plVideo.currentTime||t;
  }
  plState.current=ratio*plState.duration;plRender();
}
let seeking=false;
plBar.addEventListener('mousedown',e=>{seeking=true;seekFromEvent(e);plResetHide();});
addEventListener('mousemove',e=>{if(seeking)seekFromEvent(e);});
addEventListener('mouseup',()=>seeking=false);
plBar.addEventListener('touchstart',e=>{seeking=true;seekFromEvent(e);},{passive:true});
plBar.addEventListener('touchmove',e=>{if(seeking)seekFromEvent(e);},{passive:true});
addEventListener('touchend',()=>seeking=false);
/* ---- FrenchStream : lecture réelle & sélection de source ---- */
let plHls=null,plTearingDown=false;
function plStopVideo(){
  if(plHls){try{plHls.destroy();}catch(e){}plHls=null;}
  plTearingDown=true;
  try{plVideo.pause();plVideo.removeAttribute('src');plVideo.load();}catch(e){}
  setTimeout(()=>{plTearingDown=false;},0);
  if(plIframe){plIframe.src=''; plIframe.style.display='none';}
}
plVideo.addEventListener('loadedmetadata',()=>{plClearWatchdog();if(plState.mode==='live'){plState.duration=plVideo.duration||0;plRender();}});
plVideo.addEventListener('playing',()=>{if(plState.mode==='live')plClearWatchdog();});
plVideo.addEventListener('timeupdate',()=>{if(plState.mode!=='live')return;plState.current=plVideo.currentTime||0;plState.duration=plVideo.duration||0;plRender();if(plVideo.currentTime>0&&plVideo.duration){plClearWatchdog();plArmWatchdog(plState.streams,plState.streamIdx,plState.item,30000,()=>plVideo.readyState>=2);}});
plVideo.addEventListener('ended',()=>{
  plSetPlaying(false);showToast('Fin de la lecture');
  /* Épisode terminé : marquer « vu » (base de la reprise et des badges). */
  const it=plState.item;
  if(it){
    const ep=it.k==='drama'?(plState.opts.dramaEpisode||1):(plState.opts.episode||1);
    setPos(it,ep,0);markDone(it);
    if(it.k==='drama')syncDramaResume(it);
  }
  if(plHasNextEpisode())plShowNextCountdown();
});
plVideo.addEventListener('error',()=>{
  if(plTearingDown||plState.mode!=='live')return;
  if(!plVideo.currentSrc&&!plVideo.getAttribute('src'))return;
  tryNextStream(plState.streams,plState.streamIdx,plState.item,'erreur vidéo');
});
const plSourcesEl=document.getElementById('plSources'),plSourcesBtn=document.getElementById('plSourcesBtn'),
plSourcesCount=document.getElementById('plSourcesCount'),plRetryBtn=document.getElementById('plRetryBtn');
const SRC_TYPE_LBL={hls:'HLS',file:'Fichier',iframe:'Embed',direct:'Direct',embed:'Embed',mp4:'MP4',m3u8:'HLS'};
function plSourceLabel(s){
  const type=s.type&&SRC_TYPE_LBL[s.type]?SRC_TYPE_LBL[s.type]:null;
  return [s.quality,type,s.language?(s.language==='fr'?'VF':String(s.language).toUpperCase()):null].filter(Boolean).join(' • ')||'Auto';
}
/* Bouton réduire/déplier la section Sources : la liste se replie, l'en-tête
   reste visible (l'état survit aux re-rendus). */
function bindSourcesToggle(){
  const folded=plSourcesEl.classList.contains('folded');
  plSourcesEl.querySelectorAll('.pl-src-toggle').forEach(b=>{
    b.textContent=folded?'+':'−';b.title=folded?'Déplier la section':'Réduire la section';b.setAttribute('aria-label',b.title);
    b.onclick=e=>{e.stopPropagation();plSourcesCollapse();};
  });
}
function plSourcesCollapse(){
  const folded=!plSourcesEl.classList.contains('folded');
  plSourcesEl.classList.toggle('folded',folded);
  bindSourcesToggle();
}
function renderSources(){
  const L=plState.streams||[];
  if(plState.searching){
    plSourcesEl.innerHTML=`<div class="pl-src-head"><b>Sources</b><span style="display:inline-flex;align-items:center;gap:.5rem"><span class="pl-src-spin"></span><button class="pl-src-toggle" type="button" title="Réduire la section" aria-label="Réduire la section">−</button></span></div>
      <div class="pl-src-empty">Recherche de flux via FrenchStream…</div>`;
    bindSourcesToggle();
    return;
  }
  const retryBtn='<button class="pl-src-retry">Relancer la recherche</button>';
  if(!L.length){
    plSourcesEl.innerHTML=`<div class="pl-src-head"><b>Sources</b><span style="display:inline-flex;align-items:center;gap:.5rem">0<button class="pl-src-toggle" type="button" title="Réduire la section" aria-label="Réduire la section">−</button></span></div>
      <div class="pl-src-empty">Aucun flux retourné par FrenchStream pour ce titre.<br><span style="opacity:.7">Relancez la recherche pour réessayer.</span></div>${retryBtn}`;
    plSourcesEl.querySelectorAll('.pl-src-retry').forEach(b=>b.onclick=()=>{hideSources();plSearchStreams();});
    bindSourcesToggle();
    return;
  }
  plSourcesEl.innerHTML=`<div class="pl-src-head"><b>Sources disponibles</b><span style="display:inline-flex;align-items:center;gap:.5rem">${L.length}<button class="pl-src-toggle" type="button" title="Réduire la section" aria-label="Réduire la section">−</button></span></div>`+
    L.map((s,i)=>{
      const on=i===plState.streamIdx&&plState.mode==='live';
      const isEmbed=nxIsEmbedStream(s);
      return `<div class="pl-src-row">
        <button class="pl-src${on?' on':''}" data-i="${i}" title="Lire cette source">
          <b>${on?'● ':''}${s.providerName||s.provider||'Source'}</b>
          <span>${plSourceLabel(s)}${isEmbed?' • Lecteur distant':''}</span>
        </button>
        ${isEmbed?'<button class="pl-open-tab-src pl-mini" data-i="'+i+'" title="Ouvrir dans nouvel onglet"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>':''}
      </div>`;
    }).join('')+
    retryBtn;
  plSourcesEl.querySelectorAll('.pl-src').forEach(b=>b.onclick=()=>{hideSources();startLiveStream(plState.streams,+b.dataset.i,plState.item);});
  plSourcesEl.querySelectorAll('.pl-src-retry').forEach(b=>b.onclick=()=>{hideSources();plSearchStreams();});
  bindSourcesToggle();
  // Bouton ouvrir dans onglet pour chaque source embed
  plSourcesEl.querySelectorAll('.pl-open-tab-src').forEach(b=>b.onclick=()=>{
    hideSources();
    const idx=+b.dataset.i, s=plState.streams[idx];
    if(!s||!s.url){showToast('Aucune URL disponible');return;}
    const a=document.createElement('a');
    a.href=s.url;a.target='_blank';a.rel='noopener';
    a.click();
    showToast('Ouverture dans nouvel onglet…');
  });
}
function showSources(){renderSources();plSourcesEl.classList.add('show');}
function hideSources(){plSourcesEl.classList.remove('show');}
function toggleSources(){plSourcesEl.classList.contains('show')?hideSources():showSources();}
plSourcesBtn.onclick=e=>{e.stopPropagation();toggleSources();};
plRetryBtn.onclick=e=>{e.stopPropagation();plSearchStreams();};
/* ---- Reprise de lecture (tous contenus) : position exacte (épisode + temps) ----
   La position est sauvegardée toutes les 5 s et à la pause/fermeture dans
   localStorage (clé par type + id). Au retour, « Reprendre » rouvre le bon
   épisode et seek à la seconde enregistrée ; les épisodes vus à plus de 95 %
   sont marqués « vu » (badge vert dans les listes d'épisodes). */
/* ---- Vu récemment : miroir dérivé de nox_watch_positions ----
   Chaque sauvegarde de position de lecture alimente aussi la liste « Vu
   récemment » (films, séries, animés et dramas), avec reprise (épisode +
   progression), suppression individuelle et purge totale. */
const REC_KEY='nox_watch_recents';
function loadRecents(){try{return JSON.parse(localStorage.getItem(REC_KEY))||[];}catch(e){return [];}}
function saveRecents(l){try{localStorage.setItem(REC_KEY,JSON.stringify(l.slice(0,300)));}catch(e){}}
/* Suppression « Vu récemment » : la liste est le miroir de nox_watch_positions.
   Il faut donc AUSSI supprimer la (les) position(s) sous-jacente(s), sinon la
   prochaine sauvegarde de lecture (savePositions → saveRecentsFromPositions)
   régénère la liste et les titres « effacés » réapparaissent. */
function deletePositionsFor(rec){
  if(!rec)return;
  const all=loadPositions();
  let changed=false;
  Object.keys(all).forEach(k=>{
    const p=all[k];if(!p)return;
    const hit=k===rec.key
      ||(rec.id!=null&&String(p.id)===String(rec.id))
      ||(rec.slug!=null&&String(p.slug)===String(rec.slug))
      ||(rec.bookId!=null&&String(p.bookId)===String(rec.bookId));
    if(hit){delete all[k];changed=true;}
  });
  if(changed)savePositions(all);
}
function removeRecentRec(rec){
  if(!rec)return;
  saveRecents(loadRecents().filter(r=>r.key!==rec.key));
  deletePositionsFor(rec);
  refreshVuRecent();
}
function removeRecent(id){
  const idS=String(id);
  const rec=loadRecents().find(r=>String(r.id)===idS);
  if(rec)removeRecentRec(rec);
  else{saveRecents(loadRecents().filter(r=>String(r.id)!==idS));refreshVuRecent();}
}
function clearAllRecents(){
  const recs=loadRecents();
  saveRecents([]);
  recs.forEach(deletePositionsFor);
  refreshVuRecent();
  showToast('Historique « Vu récemment » effacé');
}
function saveRecentsFromPositions(all){
  const list=Object.values(all||{})
    .filter(p=>p&&p.title&&(Number(p.t)>5||p.done||Number(p.pct)>0))
    .sort((a,b)=>(b.at||0)-(a.at||0))
    .map(p=>({id:p.bookId||p.slug||p.id,key:String(p.k||'x')+'-'+String(p.bookId||p.slug||p.id),
      kind:p.k,bookId:p.bookId||null,slug:p.slug||null,tmdbId:p.tmdbId||null,title:p.title,
      episode:p.episode||1,season:p.season||1,animeSeason:p.animeSeason||null,t:p.t,pct:p.pct,at:p.at||0}));
  saveRecents(list);
}
function vuRecentPool(){
  const out=[];
  for(const r of loadRecents()){
    let x=byId(r.id);
    if(!x&&r.slug!=null&&r.kind==='anime')x=byAnimeSlug(r.slug);
    if(!x&&r.bookId!=null&&r.kind==='drama')x=byDramaBookId(r.bookId);
    if(x&&!out.some(o=>o.id===x.id))out.push(x);
  }
  return out;
}
function refreshVuRecent(){renderVuRecent();fillHomeRows();}
function renderVuRecent(){
  const pool=vuRecentPool();
  const btn=document.getElementById('clearAllWatched');
  if(btn){btn.style.display=pool.length?'':'none';if(!btn.dataset.bound){btn.dataset.bound='1';btn.onclick=clearAllRecents;}}
  const host=document.getElementById('gridVuRecent');
  if(host){
    if(!pool.length)host.innerHTML='<div class="empty"><div class="big">▦</div><p>« Vu récemment » est vide.<br><span style="font-size:.85rem;opacity:.7">Les films et séries commencés apparaîtront ici — reprenez là où vous vous êtes arrêté.</span></p></div>';
    else{
      host.innerHTML=pool.map(x=>CARD(x)).join('');
      host.querySelectorAll('.card').forEach((card,i)=>{
        const b=document.createElement('button');
        b.className='vu-remove';b.type='button';b.title='Retirer de « Vu récemment »';b.setAttribute('aria-label','Retirer de Vu récemment');
        b.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
        /* Match par clé de position (posId) : les recs animés/dramas portent un
           id slug/bookId, différent de l'id numérique de la carte. */
        const x=pool[i];
        const rec=loadRecents().find(r=>r.key===posId(x)
          ||String(r.id)===String(x.id)
          ||(x.slug&&r.slug===x.slug)
          ||(x.bookId!=null&&String(r.bookId)===String(x.bookId)));
        b.onclick=e=>{e.stopPropagation();removeRecentRec(rec);showToast('Titre retiré de « Vu récemment »');};
        card.appendChild(b);
      });
      bindCards();
    }
  }
}
const POS_KEY='nox_watch_positions';
function loadPositions(){try{return JSON.parse(localStorage.getItem(POS_KEY))||{};}catch(e){return {};}}
function savePositions(p){try{localStorage.setItem(POS_KEY,JSON.stringify(p));saveRecentsFromPositions(p);}catch(e){}}
function posId(item){return (item.k||'x')+'-'+(item.bookId||item.slug||item.id);}
function getPos(item){
  const p=loadPositions()[posId(item)];
  return (p&&p.t>5)?p:null;                          /* < 5 s : pas de reprise utile */
}
function setPos(item,episode,t,pct){
  if(!item)return;
  const all=loadPositions();
  const prev=all[posId(item)];
  all[posId(item)]={k:item.k,bookId:item.bookId,slug:item.slug,id:item.id,title:item.t,
    episode:episode!=null?Number(episode):(prev?prev.episode:1),
    season:(plState&&plState.opts&&plState.opts.season)||1,
    animeSeason:(plState&&plState.opts&&plState.opts.animeSeason)||null,
    tmdbId:item.tmdbId,
    t:Math.max(0,Math.floor(t||0)),          /* position en secondes */
    pct:Math.max(0,Math.min(95,Math.round(pct||0))),
    at:Date.now()};
  /* Garde-fou : 300 titres max (les plus récents d'abord). */
  const entries=Object.entries(all).sort((a,b)=>(b[1].at||0)-(a[1].at||0));
  if(entries.length>300)entries.slice(300).forEach(([k])=>delete all[k]);
  savePositions(all);
}
function clearPos(item){
  const all=loadPositions();delete all[posId(item)];savePositions(all);
}
/* API compat drama (utilisée par la fiche drama). */
const getDramaPos=getPos;
function epWasWatched(item,n){
  const p=loadPositions()[posId(item)];
  if(!p)return false;
  /* « vu » : l'épisode enregistré est dépassé, ou celui-là terminé puis vidé */
  if(p.episode>n)return true;
  if(p.episode===n)return p.done===true;
  return false;
}
/* Sauvegarde périodique pendant la lecture (dramas, séries, animés, films). */
let plPosTimer=null;
function plPosSave(){
  const it=plState.item;
  if(!it||!plEl.classList.contains('open'))return;
  const ep=it.k==='drama'?(plState.opts.dramaEpisode||1):(plState.opts.episode||null);
  if(plState.mode==='live'&&plVideo&&isFinite(plVideo.duration)&&plVideo.duration>0){
    const ratio=plVideo.currentTime/plVideo.duration;
    if(ratio>0.97){setPos(it,ep,0,100);markDone(it);}
    else setPos(it,ep,plVideo.currentTime||0,ratio*100);
  }else if(plState.mode==='sim'&&plState.duration>0){
    const ratio=plState.current/plState.duration;
    if(ratio>0.97){setPos(it,ep,0,100);markDone(it);}
    else setPos(it,ep,plState.current||0,ratio*100);
  }
}
function markDone(item){
  const all=loadPositions();const p=all[posId(item)];
  if(p){p.done=true;savePositions(all);}
}
function plPosStart(){
  clearInterval(plPosTimer);
  plPosTimer=setInterval(plPosSave,5000);
}
function plPosStop(){clearInterval(plPosTimer);plPosTimer=null;}
const plDramaPosSave=plPosSave,plDramaPosStart=plPosStart,plDramaPosStop=plPosStop; /* compat */
/* Seek initial : applique la position sauvée dès que la durée est connue. */
plVideo.addEventListener('loadedmetadata',()=>{
  const it=plState.item;
  if(plState.mode!=='live'||!it)return;
  const resume=getPos(it);
  if(!resume||resume.done)return;
  /* Reprise uniquement sur l'épisode mémorisé (drama : n° d'épisode). */
  const curEp=it.k==='drama'?Number(plState.opts.dramaEpisode||1):(plState.opts.episode||1);
  const savedEp=it.k==='drama'?Number(resume.episode||1):null;
  if(it.k==='drama'&&savedEp!==curEp)return;
  if(plVideo.duration>0){
    const t=Math.min(resume.t,Math.max(0,plVideo.duration-3));
    try{plVideo.currentTime=t;}catch(e){}
    plState.current=t;plRender();
    showToast('Reprise à '+fmtTime(t));
  }
},{once:false});
/* ---- Compte à rebours « épisode suivant » ----
   Dramas/séries/animés : à la fin d'un épisode (ou du timer simulé), un compte à
   rebours de 8 s propose l'épisode suivant.
   • Sans action → l'épisode suivant se lance automatiquement.
   • « Annuler » → le compte à rebours s'arrête, la vidéo reste sur l'épisode
     courant (terminé) ; le hint rappelle que ▶ relance la lecture. */
const NEXT_EP_SECONDS=8;
let plNextTimer=null,plNextLeft=0,plNextCancelled=false;
const plNextWrap=document.getElementById('plNextWrap'),plNextRing=document.getElementById('plNextRing'),
plNextCount=document.getElementById('plNextCount'),plNextSecs=document.getElementById('plNextSecs'),
plNextTitle=document.getElementById('plNextTitle'),plNextLabel=document.getElementById('plNextLabel'),
plNextHint=document.getElementById('plNextHint');
function plHasNextEpisode(){
  const it=plState.item;if(!it)return false;
  if(it.k==='drama'){
    const eps=it._dramaEps||[];const cur=Number(plState.opts.dramaEpisode||1);
    return eps.some(e=>e.n===cur+1)&&eps.find(e=>e.n===cur+1).chapterId;
  }
  if(it.k==='serie')return true;                       /* la série a toujours un ép. suivant (paginé) */
  if(it.k==='anime')return true;
  return false;
}
function plNextEpisodeLabel(){
  const it=plState.item,cur=Number(plState.opts.dramaEpisode||plState.opts.episode||1);
  if(it.k==='drama')return `${it.t} — Épisode ${cur+1}`;
  if(it.k==='serie')return `${it.t} — S${plState.opts.season||1} É${(plState.opts.episode||1)+1}`;
  return `${it.t} — Épisode ${(plState.opts.episode||1)+1}`;
}
function plOpenNextEpisode(){
  const it=plState.item;if(!it)return;
  if(it.k==='drama'){
    const cur=Number(plState.opts.dramaEpisode||1);
    openPlayer(it,{dramaEpisode:cur+1});
  }else if(it.k==='serie'){
    openPlayer(it,{season:plState.opts.season||1,episode:(plState.opts.episode||1)+1});
  }else if(it.k==='anime'){
    openPlayer(it,{episode:(plState.opts.episode||1)+1,animeSeason:plState.opts.animeSeason});
  }
}
function plShowNextCountdown(){
  if(!plHasNextEpisode()){plHideNextCountdown();return;}
  clearInterval(plNextTimer);
  plNextLeft=NEXT_EP_SECONDS;plNextCancelled=false;
  plNextTitle.textContent=plNextEpisodeLabel();
  plNextLabel.innerHTML='Épisode suivant dans <b>'+plNextLeft+'</b> s';
  plNextCount.textContent=plNextLeft;plNextSecs.textContent=plNextLeft;
  plNextRing.style.strokeDashoffset='0';
  plNextHint.style.display='none';
  plNextWrap.style.display='flex';
  const total=NEXT_EP_SECONDS;
  plNextTimer=setInterval(()=>{
    plNextLeft--;
    /* Réglage Profil « Épisode suivant automatique » : sinon le compte à
       rebours s'affiche mais ne lance rien — l'utilisateur choisit. */
    if(plNextLeft<=0){plHideNextCountdown();if(getSetting('autoplay',true))plOpenNextEpisode();return;}
    plNextCount.textContent=plNextLeft;plNextSecs.textContent=plNextLeft;
    plNextLabel.innerHTML='Épisode suivant dans <b>'+plNextLeft+'</b> s';
    plNextRing.style.strokeDashoffset=String(113*(1-plNextLeft/total));
  },1000);
  plResetHide();
}
function plHideNextCountdown(){
  clearInterval(plNextTimer);plNextTimer=null;
  plNextWrap.style.display='none';
}
function plCancelNextCountdown(){
  clearInterval(plNextTimer);plNextTimer=null;
  plNextCancelled=true;
  plNextWrap.style.display='none';
  /* La lecture est finie : on ne relance pas le média (il resterait bloqué à 100 %).
     Le hint s'affiche : l'utilisateur peut relancer avec ▶ ou choisir un épisode. */
  plSetPlaying(false);
  plNextHint.style.display='block';
  showToast('Épisode suivant annulé');
}
document.getElementById('plNextCancel').onclick=e=>{e.stopPropagation();plCancelNextCountdown();};
document.getElementById('plNextNow').onclick=e=>{e.stopPropagation();plHideNextCountdown();plOpenNextEpisode();};
/* Le bouton ▶ du lecteur relance la lecture de l'épisode courant (l'UI reste,
   le hint disparaît). */
document.getElementById('plPlay').addEventListener('click',()=>{plNextHint.style.display='none';plState.current=0;plRender();plResetHide();});
/* ---- Réglages API (vue Profil) — connexion FrenchStream ---- */
(function initApiSettings(){
  const baseIn=document.getElementById('apiBaseInput'),stOut=document.getElementById('apiStatus');
  if(!baseIn)return;
  const cfg=loadApiCfg();
  baseIn.value=cfg.base||'';
  const persist=()=>saveApiCfg({base:baseIn.value.trim(),animeBase:(loadApiCfg().animeBase||'')});
  document.getElementById('apiSaveBtn').onclick=()=>{persist();showToast('Paramètres API enregistrés');nxHealth();animeHealth();};
  document.getElementById('apiTestBtn').onclick=async()=>{
    persist();stOut.textContent='Test de connexion en cours…';
    const ok=await nxHealth();
    if(ok)hydrateCatalog();
    const aok=await animeHealth();
    if(aok)hydrateAnimeCatalog().then(renderAnimeGrid);
    stOut.textContent=(ok?'Connecté à FrenchStream.':'API FrenchStream injoignable (port 7000).')+(aok?' Anime-sama connecté.':' API anime injoignable (port 5001).');
  };
})();
/* ---- Initialisation ---- */
renderCatGenres();
/* Barres de recherche des vues catalogue (une seule fois). */
catToolbar('fFilms','films','Rechercher un film…');
catToolbar('fSeries','series','Rechercher une série…');
catToolbar('fNouv','nouveautes','Rechercher dans les nouveautés…');
updateListCount();
nxHealth().then(ok=>{
  if(ok){
    hydrateCatalog();
  }else{
    // API hors ligne → données démo intégrées (déjà présentes dans C)
    console.log('[NOX] API FrenchStream hors ligne, données démo utilisées');
    showToast('FrenchStream hors ligne — données démo utilisées');
    renderCat();
  }
});
animeHealth().then(ok=>{if(ok)hydrateAnimeCatalog();});
dramaHealth().then(ok=>{if(ok)hydrateDramaCatalog();});
setView(location.hash.slice(1)||'accueil');
/* ---- Recherche live du catalogue animés (API anime-sama) ---- */
let animeSearchTimer=null,animeSearchSeq=0;
async function animeLiveSearch(){
  const q=animeQuery.trim();
  const host=document.getElementById('gridAnimes');
  if(!q){animeSearchIds.clear();renderAnimeGrid();return;}
  const seq=++animeSearchSeq;
  if(host)host.innerHTML='<div class="skel"></div>'.repeat(8);
  const results=await animeCatalog(q,60);
  if(seq!==animeSearchSeq)return;
  animeSearchIds.clear();
  results.forEach(x=>animeSearchIds.add(x.id));
  pushAnimeItems(results);
  animeLimit=ANIME_PAGE_SIZE;
  renderAnimeGrid();
}
(function initAnimeSearch(){
  const inp=document.getElementById('animeSearch');if(!inp)return;
  let t=null;
  inp.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{animeQuery=inp.value;animeLimit=ANIME_PAGE_SIZE;animeLiveSearch();},350);});
})();
/* ---- Recherche live du catalogue dramas (API drama) ---- */
/* Filtres enrichis appliqués : catégorie + thème/année + recherche multi-mots.
   Recherche : chaque mot doit matcher titre/genres ou appartenir aux résultats
   d'une recherche live (dramaSearchIds). */
function dramaMatches(x,q){
  if(!q)return true;
  if(dramaSearchIds.has(x.id))return true;
  const hay=`${x.t||''} ${(x.g||[]).join(' ')}`.toLowerCase();
  return q.split(/\s+/).every(w=>hay.includes(w));
}
function dramaFilterAll(){
  const q=dramaQuery.trim().toLowerCase();
  let items=C.filter(x=>x.k==='drama');
  if(dramaShelf!=='tout')items=items.filter(x=>x.shelves?x.shelves.has(dramaShelf):x.shelf===dramaShelf);
  if(dramaChipSet==='theme'&&dramaTheme!=='Tous')items=items.filter(x=>dramaThemeOf(x)===dramaTheme);
  if(dramaChipSet==='annee'&&dramaYear!=='Tous')items=items.filter(x=>dramaYearOf(x)===dramaYear);
  if(q)items=items.filter(x=>dramaMatches(x,q));
  const fn=DRAMA_SORTS[dramaSort]||DRAMA_SORTS.reco;
  return items.slice().sort(fn);
}
function dramaGridItems(){return dramaFilterAll().slice(0,dramaLimit);}
function dramaGridAll(){return dramaFilterAll();}
async function dramaSearch(qRaw,limit=8){
  try{
    const r=await nxFetch(dramaUrl('/search?keywords='+encodeURIComponent(qRaw)),{signal:AbortSignal.timeout(60000)});
    if(!r.ok)return[];
    const d=await r.json();
    return ((d&&d.results)||[]).slice(0,limit).map(nxMapDramaItem).filter(Boolean);
  }catch(e){return[];}
}
let dramaSearchTimer=null,dramaSearchSeq=0;
async function dramaLiveSearch(){
  const q=dramaQuery.trim();
  const host=document.getElementById('gridDramas');
  if(!q){dramaSearchIds.clear();renderDramaGrid();return;}
  const seq=++dramaSearchSeq;
  if(host)host.innerHTML='<div class="skel"></div>'.repeat(8);
  const results=await dramaSearch(q,60);
  if(seq!==dramaSearchSeq)return;
  dramaSearchIds.clear();
  results.forEach(x=>dramaSearchIds.add(x.id));
  pushDramaItems(results);
  dramaLimit=DRAMA_PAGE_SIZE;
  /* Les résultats de recherche n'ont pas de catégorie : on réinitialise le filtre. */
  if(dramaShelf!=='tout'){dramaShelf='tout';renderDramaFilters();}
  renderDramaGrid();
}
(function initDramaSearch(){
  const inp=document.getElementById('dramaSearch');if(!inp)return;
  /* Tri dramas : SELECT #dramaSort (champ naturel : nb d'épisodes ; A→Z ; …). */
  const sortSel=document.getElementById('dramaSort');
  if(sortSel){sortSel.value=dramaSort;sortSel.addEventListener('change',()=>{dramaSort=sortSel.value;dramaLimit=DRAMA_PAGE_SIZE;renderDramaGrid();});}
  let t=null;
  inp.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{dramaQuery=inp.value;dramaLimit=DRAMA_PAGE_SIZE;dramaLiveSearch();},350);});
  const more=document.getElementById('dramaMore');
  if(more)more.onclick=()=>{if(dramaExpandPaused){dramaExpandMiss=0;dramaExpandPaused=false;}dramaLoadMore();};
  /* Scroll infini : les sentinelles sont réinstallées à chaque rendu de grille
     (nxInfiniteClear dans renderDramaGrid) ; ce clear global supprime les
     résidus entre vues. */
  nxInfiniteClear();
})();
