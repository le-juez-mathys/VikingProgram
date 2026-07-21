/* =========================================================
   SAGA DU VIKING — logique partagée entre toutes les pages
   ========================================================= */

const STORAGE_KEY = "vikingSagaCharacter_v2";

let currentUser = null;

/* ---------- Connexion & synchronisation (Firebase Auth + Firestore) ----------
   Une fois connecté avec Google sur un appareil, Firebase garde la session
   ouverte automatiquement (comme n'importe quelle appli) : rien à retaper,
   rien à copier. Se connecter avec le même compte Google sur un autre
   appareil retrouve automatiquement la même progression. */

function isCloudConfigured(){
  return typeof firebase !== "undefined" && typeof db !== "undefined" && !!db;
}

function waitForAuthReady(){
  return new Promise(resolve => {
    if(!isCloudConfigured()){ resolve(null); return; }
    const unsubscribe = firebase.auth().onAuthStateChanged(user => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function signInWithProvider(providerName){
  if(!isCloudConfigured()){
    alert("La synchronisation n'est pas encore configurée (assets/firebase-config.js).");
    return;
  }
  try{
    let provider;
    if(providerName === "google"){
      provider = new firebase.auth.GoogleAuthProvider();
    } else if(providerName === "microsoft"){
      provider = new firebase.auth.OAuthProvider("microsoft.com");
    } else {
      return;
    }
    await firebase.auth().signInWithPopup(provider);
    location.reload();
  }catch(e){
    console.error("Connexion impossible :", e);
    alert("La connexion a échoué. Réessaie, ou vérifie que le domaine du site est bien autorisé dans Firebase (Authentication > Settings > Authorized domains).");
  }
}

function signInWithGoogle(){ return signInWithProvider("google"); }
function signInWithMicrosoft(){ return signInWithProvider("microsoft"); }

async function signOutUser(){
  if(confirm("Se déconnecter ? Ta progression reste sauvegardée en ligne, tu pourras te reconnecter avec le même compte à tout moment.")){
    await firebase.auth().signOut();
    location.reload();
  }
}

/* ---------- Synchronisation cloud (Firestore) ----------
   Chaque sauvegarde locale est aussi poussée en ligne, sous le document
   characters/{uid}, où uid est l'identifiant unique du compte Google
   connecté. Sans connexion (ou sans configuration Firebase), le site
   continue de fonctionner uniquement en local (IndexedDB), de façon
   transparente. */

async function cloudGet(uid){
  if(!isCloudConfigured()) return null;
  try{
    const snap = await db.collection("characters").doc(uid).get();
    return snap.exists ? snap.data().state : null;
  }catch(e){
    console.warn("Synchronisation cloud indisponible (lecture) :", e);
    return null;
  }
}

async function cloudSet(uid, stateObj){
  if(!isCloudConfigured()) return false;
  try{
    await db.collection("characters").doc(uid).set({
      state: stateObj,
      updatedAt: new Date().toISOString()
    });
    return true;
  }catch(e){
    console.warn("Synchronisation cloud indisponible (écriture) :", e);
    return false;
  }
}
const DB_NAME = "vikingSagaDB";
const DB_STORE = "kv";
const DB_VERSION = 1;

/* ---------- Couche de stockage persistant (IndexedDB) ----------
   Remplace le localStorage brut par IndexedDB : plus de capacité,
   plus robuste, et strictement transparent pour le reste du code —
   loadState()/saveState() gardent la même fonction, juste en asynchrone. */

let _dbPromise = null;
function openDB(){
  if(_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if(!("indexedDB" in window)){ reject(new Error("IndexedDB indisponible")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return _dbPromise;
}

async function idbGet(key){
  try{
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }catch(e){
    return undefined;
  }
}

async function idbSet(key, value){
  try{
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const req = tx.objectStore(DB_STORE).put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }catch(e){
    console.error("Impossible d'enregistrer la progression :", e);
    return false;
  }
}

/* ---------- Programme d'entraînement ---------- */
const PROGRAM = {
  push: {
    title: "Poussée I",
    exos: [
      ["Développé couché (barre ou haltères)", "4", "8-10", "Allongé sur un banc, tu pousses la charge au-dessus de la poitrine. L'exercice de base pour les pectoraux, en sollicitant aussi épaules et triceps."],
      ["Développé militaire haltères", "3", "8-10", "Debout ou assis, tu pousses les haltères au-dessus de la tête. Construit des épaules larges et rondes."],
      ["Écarté couché ou pec deck", "3", "12-15", "Bras légèrement fléchis, tu rapproches les charges devant la poitrine en arc de cercle. Isole les pectoraux sans trop solliciter les triceps."],
      ["Élévations latérales", "3", "12-15", "Haltères le long du corps, tu lèves les bras sur les côtés jusqu'à l'horizontale. Cible le faisceau latéral de l'épaule pour des épaules plus larges."],
      ["Extensions triceps poulie", "3", "12-15", "Coudes fixes au corps, tu pousses la barre ou corde vers le bas. Finit le travail des triceps en fin de séance."],
    ]
  },
  push2: {
    title: "Poussée II",
    exos: [
      ["Développé incliné haltères", "4", "8-10", "Sur un banc incliné à 30-45°, tu pousses les haltères vers le haut. Cible davantage le haut des pectoraux que le développé plat."],
      ["Dips (lestés si possible)", "3", "8-12", "En appui sur des barres parallèles, tu descends puis remontes le corps en fléchissant les bras. Excellent pour pectoraux bas et triceps."],
      ["Élévations latérales + frontales", "3", "12-15", "Alterne élévations sur le côté et devant toi pour travailler l'ensemble des faisceaux de l'épaule."],
      ["Développé Arnold", "3", "10-12", "Variante du développé militaire où tu tournes les paumes de face vers l'avant en poussant. Sollicite l'épaule sous plusieurs angles."],
      ["Extensions triceps nuque", "3", "12-15", "Haltère tenu à deux mains derrière la tête, tu tends les bras vers le haut. Étire bien le triceps en profondeur."],
    ]
  },
  pull: {
    title: "Tirage I",
    exos: [
      ["Tractions ou tirage vertical", "4", "6-10", "Tu tires ton corps (ou une barre) vers le haut, bras en pronation. La base pour construire la largeur du dos."],
      ["Rowing barre ou haltère", "4", "8-10", "Buste penché en avant, tu tires la charge vers le nombril. Construit l'épaisseur du dos."],
      ["Tirage horizontal poulie basse", "3", "10-12", "Assis, tu tires la poignée vers le buste en gardant le dos droit. Bon complément pour le milieu du dos."],
      ["Face pull", "3", "12-15", "Tu tires une corde à hauteur du visage en écartant les mains. Renforce l'arrière d'épaule et corrige la posture."],
      ["Curl biceps barre EZ", "3", "10-12", "Coudes fixes, tu fléchis les avant-bras pour remonter la barre. Isole le biceps en fin de séance."],
    ]
  },
  pull2: {
    title: "Tirage II",
    exos: [
      ["Rowing unilatéral haltère", "4", "8-10", "Un genou et une main posés sur un banc, tu tires l'haltère vers la hanche d'un seul côté. Permet de corriger les déséquilibres gauche-droite."],
      ["Tirage vertical prise large", "3", "10-12", "Barre tirée devant la poitrine avec une prise large. Accentue le travail en largeur du dos."],
      ["Pull-over haltère", "3", "12-15", "Allongé, tu descends puis remontes un haltère tenu à deux mains au-dessus de la tête. Étire le dos et sollicite aussi les pectoraux."],
      ["Curl marteau", "3", "10-12", "Curl réalisé paumes face à face (prise neutre). Cible le biceps et l'avant-bras différemment du curl classique."],
      ["Shrugs trapèzes", "3", "12-15", "Haltères le long du corps, tu hausses simplement les épaules vers les oreilles. Développe le haut des trapèzes."],
    ]
  },
  legs: {
    title: "Jambes",
    exos: [
      ["Squat (barre ou gobelet)", "4", "8-10", "Tu descends les hanches vers l'arrière puis remontes en poussant sur les jambes. Le mouvement roi pour quadriceps, fessiers et gainage."],
      ["Soulevé de terre roumain", "3", "8-10", "Jambes presque tendues, tu descends la charge le long des jambes en poussant les hanches en arrière. Cible ischio-jambiers et fessiers."],
      ["Fentes marchées", "3", "10-12", "Tu avances en fente, alternant les jambes à chaque pas. Travaille quadriceps et fessiers avec un aspect fonctionnel et l'équilibre."],
      ["Leg curl ou pont fessier", "3", "12-15", "Leg curl : tu fléchis les genoux contre une résistance pour cibler les ischio-jambiers. Pont fessier : allongé, tu montes le bassin pour cibler les fessiers."],
      ["Mollets debout", "4", "15-20", "Debout, tu montes sur la pointe des pieds contre une charge. Isole le mollet (gastrocnémien)."],
    ]
  },
  cardio: {
    title: "Cardio & Abdos",
    exos: [
      ["Marche rapide, vélo ou rameur (30-40 min)", "1", "30-40 min", "Activité cardio à intensité modérée et continue. C'est le principal levier pour brûler des graisses et faire fondre le tour de ventre."],
      ["Crunch classique", "3", "15-20", "Allongé, tu enroules le buste vers les genoux en contractant les abdominaux. L'exercice de base pour le grand droit de l'abdomen."],
      ["Relevé de jambes suspendu ou au sol", "3", "12-15", "Tu remontes les jambes tendues ou fléchies vers la poitrine. Cible surtout le bas des abdominaux."],
      ["Gainage planche + variantes", "3", "40s", "En appui sur les avant-bras et les pieds, tu maintiens le corps aligné et gainé. Renforce toute la sangle abdominale en statique."],
      ["Mountain climbers", "3", "30s", "En position de planche, tu ramènes rapidement les genoux vers la poitrine en alternance. Combine gainage et travail cardio."],
    ]
  },
  mobility: {
    title: "Repos actif / Mobilité",
    exos: [
      ["Marche légère (20-30 min)", "1", "20-30 min", "Une marche à allure tranquille pour favoriser la récupération sans fatiguer davantage le corps."],
      ["Étirements complets", "1", "10-15 min", "Étire les principaux groupes musculaires sollicités dans la semaine pour préserver la souplesse et réduire les tensions."],
      ["Mobilité hanches / épaules", "1", "10 min", "Mouvements circulaires et amplitudes contrôlées pour entretenir la mobilité articulaire de ces zones souvent raides."],
      ["Respiration / relâchement", "1", "5 min", "Quelques minutes de respiration profonde et de relâchement musculaire pour faire baisser le stress et améliorer la récupération."],
    ]
  }
};

const CATEGORY_META = {
  push:      { label: "Poussée",         stat: "force",      page: "push.html" },
  push2:     { label: "Poussée",         stat: "force",      page: "push.html" },
  pull:      { label: "Tirage",          stat: "force",      page: "pull.html" },
  pull2:     { label: "Tirage",          stat: "force",      page: "pull.html" },
  legs:      { label: "Jambes",          stat: "force",      page: "legs.html" },
  cardio:    { label: "Cardio & Abdos",  stat: "endurance",  page: "cardio.html" },
  mobility:  { label: "Mobilité",        stat: "vitalite",   page: "mobility.html" },
  nutrition: { label: "Provisions",      stat: "vitalite",   page: "nutrition.html" }
};

const DASHBOARD_CARDS = [
  { key: "push",      label: "Poussée",         page: "push.html",      tag: "Pecs · Épaules · Triceps" },
  { key: "pull",       label: "Tirage",          page: "pull.html",      tag: "Dos · Biceps" },
  { key: "legs",       label: "Jambes",          page: "legs.html",      tag: "Bas du corps" },
  { key: "cardio",     label: "Cardio & Abdos",  page: "cardio.html",    tag: "Endurance" },
  { key: "mobility",   label: "Mobilité",        page: "mobility.html",  tag: "Récupération" },
  { key: "nutrition",  label: "Provisions",      page: "nutrition.html", tag: "Nutrition" }
];

const NAV_PAGES = [
  { key: "index",     label: "Tableau",     page: "index.html" },
  { key: "push",      label: "Poussée",     page: "push.html" },
  { key: "pull",      label: "Tirage",      page: "pull.html" },
  { key: "legs",      label: "Jambes",      page: "legs.html" },
  { key: "cardio",    label: "Cardio",      page: "cardio.html" },
  { key: "mobility",  label: "Mobilité",    page: "mobility.html" },
  { key: "corps",     label: "Corps",       page: "corps.html" },
  { key: "nutrition", label: "Provisions",  page: "nutrition.html" }
];

/* ---------- État du personnage ---------- */
let state = null;

function defaultState(){
  return {
    level: 1,
    xp: 0,
    stats: { force: 0, endurance: 0, vitalite: 0, discipline: 0 },
    totalSessions: 0,
    streak: 0,
    lastSessionDate: null,
    firstLogDate: null,
    totalXPEarned: 0,
    records: {},
    log: [],
    updatedAt: new Date().toISOString()
  };
}

async function loadState(){
  try{
    currentUser = await waitForAuthReady();

    const local = await idbGet(STORAGE_KEY);
    let cloud = null;
    if(currentUser){
      cloud = await cloudGet(currentUser.uid);
    }

    let saved = null;
    if(cloud && local){
      // Ni l'un ni l'autre n'est automatiquement prioritaire : on garde la
      // version la plus récente pour éviter qu'une écriture cloud en échec
      // silencieux (ex: juste après une réinitialisation) n'écrase une
      // version locale plus fraîche.
      const cloudTime = cloud.updatedAt ? new Date(cloud.updatedAt).getTime() : 0;
      const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      saved = cloudTime >= localTime ? cloud : local;
    } else if(cloud){
      saved = cloud;
    } else if(local){
      saved = local;
    }

    if(!saved){
      // Migration silencieuse d'une éventuelle ancienne sauvegarde localStorage —
      // totalement transparente pour la personne : sa progression n'est pas perdue.
      const legacyRaw = window.localStorage.getItem(STORAGE_KEY);
      if(legacyRaw){
        try{ saved = JSON.parse(legacyRaw); }catch(e){ saved = null; }
      }
    }

    state = saved || defaultState();
    if(!state.records) state.records = {};
    if(state.firstLogDate === undefined) state.firstLogDate = null;
    if(state.totalXPEarned === undefined) state.totalXPEarned = 0;
    if(!state.updatedAt) state.updatedAt = new Date().toISOString();

    // Garde le cache local et le cloud alignés l'un sur l'autre, quelle que
    // soit la source retenue ci-dessus.
    await idbSet(STORAGE_KEY, state);
    if(currentUser) cloudSet(currentUser.uid, state);
  }catch(e){
    state = defaultState();
  }
}

async function saveState(){
  state.updatedAt = new Date().toISOString();
  await idbSet(STORAGE_KEY, state);
  if(currentUser) cloudSet(currentUser.uid, state); // en arrière-plan, transparent pour l'utilisateur
}

function xpNeededFor(level){ return 100 + (level - 1) * 60; }

function rankFor(level){
  if(level >= 20) return "VIKING LÉGENDAIRE";
  if(level >= 15) return "JARL — seigneur de guerre";
  if(level >= 10) return "HOUSECARL — garde d'élite";
  if(level >= 6) return "BERSERKER";
  if(level >= 3) return "KARL — homme libre";
  return "THRALL — apprenti";
}

function statCap(){ return 100; }

function slugify(str){
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeCategory(key){ return key.replace(/2$/, ""); }

function statGainsFor(categoryKey){
  const base = normalizeCategory(categoryKey);
  switch(base){
    case "push": return { force: 3, endurance: 1, vitalite: 0, discipline: 1 };
    case "pull": return { force: 3, endurance: 1, vitalite: 0, discipline: 1 };
    case "legs": return { force: 4, endurance: 2, vitalite: 0, discipline: 1 };
    case "cardio": return { force: 0, endurance: 4, vitalite: 1, discipline: 1 };
    case "mobility": return { force: 0, endurance: 1, vitalite: 2, discipline: 1 };
    case "nutrition": return { force: 0, endurance: 0, vitalite: 3, discipline: 2 };
    default: return { force: 1, endurance: 1, vitalite: 1, discipline: 1 };
  }
}

function daysBetween(d1, d2){
  const oneDay = 24 * 60 * 60 * 1000;
  const a = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const b = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((b - a) / oneDay);
}

function updateStreak(){
  const today = new Date();
  if(state.lastSessionDate){
    const last = new Date(state.lastSessionDate);
    const diff = daysBetween(last, today);
    if(diff === 0){ /* déjà loggé aujourd'hui, streak inchangée */ }
    else if(diff === 1){ state.streak += 1; }
    else { state.streak = 1; }
  } else {
    state.streak = 1;
  }
  state.lastSessionDate = today.toISOString();
}

function applyXP(xp){
  if(!state.firstLogDate) state.firstLogDate = new Date().toISOString();
  state.totalXPEarned += xp;
  state.xp += xp;
  let leveledUp = false;
  let needed = xpNeededFor(state.level);
  while(state.xp >= needed){
    state.xp -= needed;
    state.level += 1;
    leveledUp = true;
    needed = xpNeededFor(state.level);
  }
  return leveledUp;
}

/* ---------- Log générique d'une quête d'exercices ---------- */
// exerciseEntries: [{ slug, name, weight (kg|null), reps (int|null), done (bool) }]
function logCategorySession(categoryKey, exerciseEntries, effort){
  const total = exerciseEntries.length;
  const doneCount = exerciseEntries.filter(e => e.done).length;
  const completionRatio = total ? doneCount / total : 0;
  const meta = CATEGORY_META[categoryKey];

  let prCount = 0;
  exerciseEntries.forEach(e => {
    if(!e.done || !e.weight) return;
    const rec = state.records[e.slug];
    if(!rec || e.weight > rec.weight){
      state.records[e.slug] = { name: e.name, weight: e.weight, reps: e.reps || null, date: new Date().toISOString() };
      prCount++;
    }
  });

  const baseXP = 20;
  const complMult = completionRatio >= 0.9 ? 1.5 : completionRatio >= 0.5 ? 1.15 : 0.7;
  const effortMult = effort === 3 ? 1.3 : effort === 2 ? 1.1 : 1;
  const xpGain = Math.round(baseXP * complMult * effortMult) + prCount * 8;

  const gains = statGainsFor(categoryKey);
  Object.keys(gains).forEach(k => {
    state.stats[k] = Math.min(statCap(), state.stats[k] + Math.round(gains[k] * complMult));
  });
  if(prCount > 0){
    state.stats.force = Math.min(statCap(), state.stats.force + prCount * 2);
  }

  updateStreak();
  const leveledUp = applyXP(xpGain);
  state.totalSessions += 1;

  const prNote = prCount > 0 ? ` · ${prCount} nouveau${prCount>1?"x":""} record${prCount>1?"s":""} !` : "";
  state.log.push({
    category: categoryKey,
    label: `${meta.label} — ${doneCount}/${total} exercices${prNote}`,
    date: new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }),
    xp: xpGain
  });

  saveState();
  return { xpGain, prCount, leveledUp, doneCount, total };
}

// Journée nutrition / check-in simple (pas d'exercices)
function logNutritionDay(objectifRespecte, proteinesRespectees, eauLitres){
  const checks = [objectifRespecte, proteinesRespectees].filter(Boolean).length;
  const completionRatio = checks / 2;
  const complMult = completionRatio >= 1 ? 1.5 : completionRatio >= 0.5 ? 1.15 : 0.7;

  const gains = statGainsFor("nutrition");
  Object.keys(gains).forEach(k => {
    state.stats[k] = Math.min(statCap(), state.stats[k] + Math.round(gains[k] * complMult));
  });
  if(eauLitres >= 1.5){
    state.stats.vitalite = Math.min(statCap(), state.stats.vitalite + 1);
  }

  const baseXP = 18;
  const xpGain = Math.round(baseXP * complMult);

  updateStreak();
  const leveledUp = applyXP(xpGain);
  state.totalSessions += 1;

  state.log.push({
    category: "nutrition",
    label: `Provisions — ${checks}/2 objectifs, ${eauLitres}L d'eau`,
    date: new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }),
    xp: xpGain
  });

  saveState();
  return { xpGain, leveledUp };
}

async function resetCharacter(){
  if(confirm("Effacer toute la progression de ce personnage ? Cette action est irréversible.")){
    state = defaultState();
    await saveState();
    location.reload();
  }
}

/* ---------- Rendu : nav + mini-barre de personnage ---------- */
function renderNav(activeKey){
  const links = NAV_PAGES.map(p =>
    `<a href="${p.page}" class="${p.key === activeKey ? 'active' : ''}">${p.label}</a>`
  ).join("");

  let accountHtml;
  if(!isCloudConfigured()){
    accountHtml = `<div class="account-chip" title="Configure assets/firebase-config.js pour activer la synchronisation">Local uniquement</div>`;
  } else if(currentUser){
    const name = currentUser.displayName || currentUser.email || "Guerrier connecté";
    accountHtml = `
      <div class="account-chip" title="Synchronisé en ligne avec ce compte">
        <span class="account-code">${name}</span>
        <button class="chip-btn" onclick="signOutUser()">Déconnexion</button>
      </div>`;
  } else {
    accountHtml = `
      <div class="account-chip" title="Connecte-toi pour synchroniser ta progression sur tous tes appareils">
        <button class="chip-btn" onclick="signInWithGoogle()">Google</button>
        <button class="chip-btn" onclick="signInWithMicrosoft()">Microsoft</button>
      </div>`;
  }

  return `
    <div class="topnav">
      <div class="topnav-inner">
        <a class="brand" href="index.html">⚔ SAGA DU VIKING</a>
        <div class="navlinks">${links}</div>
        ${accountHtml}
      </div>
    </div>
  `;
}

function renderMiniBar(){
  const needed = xpNeededFor(state.level);
  const pct = Math.min(100, Math.round((state.xp / needed) * 100));
  return `
    <div class="minibar">
      <div>
        <div class="mb-rank">${rankFor(state.level)}</div>
        <div class="mb-name">Niveau ${state.level}</div>
      </div>
      <div class="mb-xpwrap">
        <div class="mb-xptrack"><div class="mb-xpfill" style="width:${pct}%"></div></div>
        <div class="mb-xplabel"><span>${state.xp} XP</span><span>${needed} XP pour le niveau suivant</span></div>
      </div>
      <div class="mb-streak">Séquence : <b>${state.streak}${state.streak===1?" jour":" jours"}</b></div>
    </div>
  `;
}

async function initPage(activeKey){
  await loadState();
  const navEl = document.getElementById("nav-container");
  if(navEl) navEl.innerHTML = renderNav(activeKey);
  const barEl = document.getElementById("minibar-container");
  if(barEl) barEl.innerHTML = renderMiniBar();
  injectToast();
}

function injectToast(){
  if(document.getElementById("levelup-toast")) return;
  const div = document.createElement("div");
  div.id = "levelup-toast";
  div.textContent = "⚔ Niveau supérieur !";
  document.body.appendChild(div);
}

function showLevelUpToast(){
  const toast = document.getElementById("levelup-toast");
  toast.textContent = `⚔ Niveau supérieur ! Tu es maintenant ${rankFor(state.level)} — Niveau ${state.level}`;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3400);
}

function showSimpleToast(msg){
  const toast = document.getElementById("levelup-toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

/* ---------- Aide pour construire une table d'exercices avec inputs ---------- */
function buildExerciseInputs(containerId, categoryKey){
  const container = document.getElementById(containerId);
  const program = PROGRAM[categoryKey];
  container.innerHTML = program.exos.map(([name, sets, reps, desc]) => {
    const slug = categoryKey + "__" + slugify(name);
    const rec = state.records[slug];
    const prText = rec ? `Record : ${rec.weight}kg${rec.reps ? ' x '+rec.reps : ''}` : "Pas encore de record";
    return `
      <div class="exo-card" data-slug="${slug}">
        <div class="exo-head">
          <div>
            <div class="exo-name">${name}</div>
            <div class="exo-target">Objectif : ${sets} séries x ${reps}</div>
            ${desc ? `<div class="exo-desc">${desc}</div>` : ""}
          </div>
          <div class="exo-pr">${prText}</div>
        </div>
        <div class="exo-inputs">
          <div class="field">
            <label>Poids (kg)</label>
            <input type="number" min="0" step="0.5" class="exo-weight" placeholder="ex: 40">
          </div>
          <div class="field">
            <label>Reps réalisées</label>
            <input type="number" min="0" step="1" class="exo-reps" placeholder="ex: 10">
          </div>
          <div class="exo-done">
            <input type="checkbox" class="exo-check" id="chk-${slug}">
            <label for="chk-${slug}">Faite</label>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function collectExerciseEntries(containerId, categoryKey){
  const program = PROGRAM[categoryKey];
  const cards = document.querySelectorAll(`#${containerId} .exo-card`);
  const entries = [];
  cards.forEach((card, i) => {
    const name = program.exos[i][0];
    const slug = card.getAttribute("data-slug");
    const weight = parseFloat(card.querySelector(".exo-weight").value) || null;
    const reps = parseInt(card.querySelector(".exo-reps").value, 10) || null;
    const done = card.querySelector(".exo-check").checked;
    entries.push({ slug, name, weight, reps, done });
  });
  return entries;
}

/* ---------- Rendu complet (tableau de bord) ---------- */
function renderFullSheet(elId){
  const el = document.getElementById(elId);
  const needed = xpNeededFor(state.level);
  const pct = Math.min(100, Math.round((state.xp / needed) * 100));
  el.innerHTML = `
    <div class="sheet-top">
      <div class="title-block">
        <div class="rank">${rankFor(state.level)}</div>
        <div class="name">Ton personnage</div>
      </div>
      <div class="level-badge">NIVEAU ${state.level}</div>
    </div>
    <div class="xp-track"><div class="xp-fill" style="width:${pct}%"></div></div>
    <div class="xp-label"><span>${state.xp} XP</span><span>${needed} XP pour le niveau suivant</span></div>
    <div class="stat-grid">
      ${["force","endurance","vitalite","discipline"].map(k => `
        <div class="stat" data-k="${k}">
          <div class="stat-name">${k.charAt(0).toUpperCase()+k.slice(1)} <b>${state.stats[k]}</b></div>
          <div class="stat-bar"><i style="width:${Math.min(100,(state.stats[k]/statCap())*100)}%"></i></div>
        </div>
      `).join("")}
    </div>
    <div class="streak-row">
      <span>Séquence actuelle : <b>${state.streak}${state.streak===1?" jour":" jours"}</b></span>
      <span>Quêtes accomplies : <b>${state.totalSessions}</b></span>
    </div>
  `;
}

function lastLogDateForCategories(keys){
  const entries = state.log.filter(e => keys.includes(e.category));
  if(entries.length === 0) return null;
  return entries[entries.length - 1].date;
}

function renderDashboardCards(elId){
  const el = document.getElementById(elId);
  el.innerHTML = DASHBOARD_CARDS.map(card => {
    const keys = card.key === "push" ? ["push","push2"] : card.key === "pull" ? ["pull","pull2"] : [card.key];
    const lastDate = lastLogDateForCategories(keys);
    const statKey = CATEGORY_META[card.key].stat;
    const statVal = state.stats[statKey];
    return `
      <a class="cat-card" href="${card.page}">
        <div class="cc-top">
          <div class="cc-label">${card.label}</div>
          <div class="cc-arrow">→</div>
        </div>
        <div class="exo-target" style="margin-top:2px;">${card.tag}</div>
        <div class="cc-last">${lastDate ? "Dernière quête : " + lastDate : "Pas encore tentée"}</div>
        <div class="cc-bar"><i style="width:${Math.min(100,(statVal/statCap())*100)}%"></i></div>
      </a>
    `;
  }).join("");
}

function renderChronicle(elId){
  const el = document.getElementById(elId);
  if(state.log.length === 0){
    el.innerHTML = '<div class="empty-note">Aucune quête gravée pour l\'instant. Pars à l\'aventure depuis le tableau de bord.</div>';
    return;
  }
  const startIndex = Math.max(0, state.log.length - 50);
  el.innerHTML = state.log.slice(startIndex).map((entry, i) => {
    const realIndex = startIndex + i;
    return `
    <div class="chronicle-entry">
      <div class="c-left">${entry.label}<span class="c-date">${entry.date}</span></div>
      <div class="c-xp">+${entry.xp} XP</div>
      <button class="c-delete" title="Supprimer cette quête de la chronique" onclick="deleteLogEntry(${realIndex}, '${elId}')">✕</button>
    </div>
  `;
  }).join("");
}

function deleteLogEntry(index, elId){
  if(!confirm("Supprimer cette quête de la chronique ? L'XP et les stats déjà gagnées restent acquises — seule l'entrée d'historique disparaît.")) return;
  state.log.splice(index, 1);
  saveState();
  renderChronicle(elId);
}

/* =========================================================
   MENUS HEBDOMADAIRES, LISTE DE COURSES, FRINGALES
   ========================================================= */

const INGREDIENT_INFO = {
  "flocons d'avoine": { cat: "Épicerie" },
  "skyr": { cat: "Produits laitiers", alt: "fromage blanc 0% ou yaourt grec nature" },
  "myrtilles": { cat: "Fruits & légumes", alt: "fruits rouges surgelés" },
  "amandes": { cat: "Épicerie", alt: "noix ou noisettes" },
  "cannelle": { cat: "Épicerie" },
  "oeufs": { cat: "Produits laitiers" },
  "pain complet": { cat: "Épicerie", alt: "pain aux céréales" },
  "avocat": { cat: "Fruits & légumes" },
  "tomates cerises": { cat: "Fruits & légumes" },
  "whey ou lait": { cat: "Produits laitiers", alt: "lait demi-écrémé ou boisson végétale enrichie" },
  "banane": { cat: "Fruits & légumes" },
  "cacao non sucré": { cat: "Épicerie" },
  "champignons": { cat: "Fruits & légumes" },
  "fromage frais léger": { cat: "Produits laitiers", alt: "cottage cheese" },
  "ciboulette": { cat: "Fruits & légumes" },
  "yaourt grec": { cat: "Produits laitiers", alt: "skyr" },
  "granola": { cat: "Épicerie", alt: "flocons d'avoine grillés au four" },
  "fruits rouges": { cat: "Fruits & légumes", alt: "surgelés hors saison" },
  "miel": { cat: "Épicerie" },
  "fromage blanc": { cat: "Produits laitiers", alt: "skyr ou yaourt grec" },
  "concombre": { cat: "Fruits & légumes" },
  "poulet": { cat: "Protéines", alt: "dinde" },
  "riz complet": { cat: "Épicerie", alt: "riz basmati ou quinoa" },
  "brocolis": { cat: "Fruits & légumes", alt: "haricots verts" },
  "saumon": { cat: "Protéines", alt: "truite" },
  "patate douce": { cat: "Fruits & légumes", alt: "pomme de terre ou riz complet" },
  "épinards": { cat: "Fruits & légumes", alt: "épinards surgelés" },
  "citron": { cat: "Fruits & légumes" },
  "boeuf haché 5%": { cat: "Protéines", alt: "dinde hachée" },
  "quinoa": { cat: "Épicerie", alt: "boulgour ou riz complet" },
  "poivrons": { cat: "Fruits & légumes" },
  "oignon": { cat: "Fruits & légumes" },
  "dinde": { cat: "Protéines", alt: "poulet" },
  "pâtes complètes": { cat: "Épicerie", alt: "pâtes semi-complètes" },
  "courgettes": { cat: "Fruits & légumes" },
  "ail": { cat: "Fruits & légumes" },
  "tofu": { cat: "Protéines", alt: "seitan ou blanc de poulet" },
  "riz basmati": { cat: "Épicerie", alt: "riz complet" },
  "carottes": { cat: "Fruits & légumes" },
  "sauce soja": { cat: "Épicerie" },
  "cabillaud": { cat: "Protéines", alt: "colin ou lieu noir" },
  "semoule complète": { cat: "Épicerie", alt: "boulgour" },
  "légumes ratatouille": { cat: "Fruits & légumes", alt: "mélange courgette-aubergine-poivron surgelé" },
  "lentilles": { cat: "Épicerie", alt: "pois chiches" },
  "légumes de saison": { cat: "Fruits & légumes" },
  "haricots verts": { cat: "Fruits & légumes", alt: "brocolis" },
  "soupe de légumes maison": { cat: "Fruits & légumes" },
  "thon": { cat: "Protéines", alt: "maquereau en boîte" },
  "crevettes": { cat: "Protéines" },
  "curry léger": { cat: "Épicerie" },
  "maquereau": { cat: "Protéines", alt: "sardines" },
  "pommes de terre": { cat: "Fruits & légumes", alt: "patate douce" },
  "pois chiches": { cat: "Épicerie", alt: "lentilles" },
  "boulgour": { cat: "Épicerie", alt: "quinoa ou semoule complète" },
  "truite": { cat: "Protéines", alt: "saumon" },
  "feta légère": { cat: "Produits laitiers", alt: "fromage de chèvre frais" },
  "miso": { cat: "Épicerie" },
  "bacon de dinde": { cat: "Protéines" },
  "noix": { cat: "Épicerie", alt: "amandes" },
  "beurre de cacahuète": { cat: "Épicerie" },
  "graines (chia/lin)": { cat: "Épicerie", alt: "flocons d'avoine" },
  "haricots rouges": { cat: "Épicerie", alt: "haricots noirs" },
  "asperges": { cat: "Fruits & légumes", alt: "haricots verts" },
  "porc filet mignon": { cat: "Protéines", alt: "escalope de dinde" },
  "salade verte": { cat: "Fruits & légumes" },
  "parmesan léger": { cat: "Produits laitiers" },
  "houmous": { cat: "Épicerie", alt: "purée de haricots blancs maison" },
  "pomme": { cat: "Fruits & légumes" },
  "kiwi": { cat: "Fruits & légumes" },
};

const WEEKLY_MENUS = [
  { name: "Semaine du Forgeron",
    days: [
      { day:"Lundi",
        breakfast:{ name:"Bol d'avoine au skyr et myrtilles", items:["flocons d'avoine","skyr","myrtilles","amandes","cannelle"] },
        lunch:{ name:"Poulet rôti, riz complet, brocolis", items:["poulet","riz complet","brocolis"] },
        dinner:{ name:"Omelette aux légumes et salade verte", items:["oeufs","poivrons","champignons","salade verte"] } },
      { day:"Mardi",
        breakfast:{ name:"Œufs brouillés et pain complet à l'avocat", items:["oeufs","pain complet","avocat","tomates cerises"] },
        lunch:{ name:"Saumon, patate douce, épinards", items:["saumon","patate douce","épinards","citron"] },
        dinner:{ name:"Filet de poulet grillé, haricots verts", items:["poulet","haricots verts"] } },
      { day:"Mercredi",
        breakfast:{ name:"Porridge protéiné banane-cacao", items:["flocons d'avoine","whey ou lait","banane","cacao non sucré"] },
        lunch:{ name:"Bœuf haché maigre, quinoa, poivrons", items:["boeuf haché 5%","quinoa","poivrons","oignon"] },
        dinner:{ name:"Poisson blanc vapeur, courgettes sautées", items:["cabillaud","courgettes","ail"] } },
      { day:"Jeudi",
        breakfast:{ name:"Omelette champignons et fromage frais", items:["oeufs","champignons","fromage frais léger","ciboulette"] },
        lunch:{ name:"Dinde, pâtes complètes, courgettes à l'ail", items:["dinde","pâtes complètes","courgettes","ail"] },
        dinner:{ name:"Soupe de légumes maison et œufs durs", items:["soupe de légumes maison","oeufs"] } },
      { day:"Vendredi",
        breakfast:{ name:"Yaourt grec, granola, fruits rouges", items:["yaourt grec","granola","fruits rouges","miel"] },
        lunch:{ name:"Tofu mariné, riz basmati, brocolis-carottes", items:["tofu","riz basmati","brocolis","carottes","sauce soja"] },
        dinner:{ name:"Salade de thon, tomates, œufs, quinoa froid", items:["thon","tomates cerises","oeufs","quinoa"] } },
      { day:"Samedi",
        breakfast:{ name:"Pain complet, fromage blanc, œuf dur, concombre", items:["pain complet","fromage blanc","oeufs","concombre"] },
        lunch:{ name:"Cabillaud, semoule complète, ratatouille", items:["cabillaud","semoule complète","légumes ratatouille"] },
        dinner:{ name:"Escalope de dinde, épinards à l'ail", items:["dinde","épinards","ail"] } },
      { day:"Dimanche",
        breakfast:{ name:"Pancakes protéinés à la banane", items:["oeufs","banane","flocons d'avoine","cannelle"] },
        lunch:{ name:"Lentilles, légumes rôtis, œuf poché", items:["lentilles","légumes de saison","oeufs"] },
        dinner:{ name:"Tofu sauté, légumes wok, sauce soja légère", items:["tofu","poivrons","carottes","sauce soja"] } },
    ]
  },
  { name: "Semaine du Marin",
    days: [
      { day:"Lundi",
        breakfast:{ name:"Smoothie protéiné banane-avoine", items:["whey ou lait","banane","flocons d'avoine","beurre de cacahuète"] },
        lunch:{ name:"Crevettes sautées, riz complet, légumes croquants", items:["crevettes","riz complet","poivrons","carottes"] },
        dinner:{ name:"Salade de poulet, avocat, tomates", items:["poulet","avocat","tomates cerises","salade verte"] } },
      { day:"Mardi",
        breakfast:{ name:"Œufs pochés, avocat, pain complet", items:["oeufs","avocat","pain complet"] },
        lunch:{ name:"Poulet au curry léger, riz basmati, épinards", items:["poulet","curry léger","riz basmati","épinards"] },
        dinner:{ name:"Soupe miso, tofu, légumes", items:["miso","tofu","carottes","champignons"] } },
      { day:"Mercredi",
        breakfast:{ name:"Skyr, flocons d'avoine, pomme, cannelle", items:["skyr","flocons d'avoine","pomme","cannelle"] },
        lunch:{ name:"Steak haché 5%, pâtes complètes, salade", items:["boeuf haché 5%","pâtes complètes","salade verte"] },
        dinner:{ name:"Cabillaud au citron, courgettes", items:["cabillaud","citron","courgettes"] } },
      { day:"Jeudi",
        breakfast:{ name:"Omelette au saumon fumé et fromage frais", items:["oeufs","saumon","fromage frais léger"] },
        lunch:{ name:"Maquereau, pommes de terre vapeur, haricots verts", items:["maquereau","pommes de terre","haricots verts"] },
        dinner:{ name:"Œufs brouillés, épinards, champignons", items:["oeufs","épinards","champignons"] } },
      { day:"Vendredi",
        breakfast:{ name:"Porridge quinoa, lait, fruits secs", items:["quinoa","whey ou lait","amandes"] },
        lunch:{ name:"Pois chiches, riz, légumes rôtis (repas végé)", items:["pois chiches","riz complet","légumes de saison"] },
        dinner:{ name:"Salade de lentilles, feta légère, concombre", items:["lentilles","feta légère","concombre"] } },
      { day:"Samedi",
        breakfast:{ name:"Pain complet, houmous, œuf dur, tomates", items:["pain complet","houmous","oeufs","tomates cerises"] },
        lunch:{ name:"Dinde, boulgour, poivrons grillés", items:["dinde","boulgour","poivrons"] },
        dinner:{ name:"Blanc de poulet grillé, ratatouille", items:["poulet","légumes ratatouille"] } },
      { day:"Dimanche",
        breakfast:{ name:"Yaourt grec, muesli, kiwi", items:["yaourt grec","granola","kiwi"] },
        lunch:{ name:"Truite, quinoa, brocolis", items:["truite","quinoa","brocolis"] },
        dinner:{ name:"Poisson blanc, salade verte, vinaigrette légère", items:["cabillaud","salade verte","citron"] } },
    ]
  },
  { name: "Semaine du Chasseur",
    days: [
      { day:"Lundi",
        breakfast:{ name:"Œufs, bacon de dinde grillé, tomates", items:["oeufs","bacon de dinde","tomates cerises"] },
        lunch:{ name:"Bœuf sauté, riz complet, brocolis", items:["boeuf haché 5%","riz complet","brocolis"] },
        dinner:{ name:"Salade César allégée (poulet, salade, parmesan léger)", items:["poulet","salade verte","parmesan léger"] } },
      { day:"Mardi",
        breakfast:{ name:"Porridge avoine, banane, noix", items:["flocons d'avoine","banane","noix"] },
        lunch:{ name:"Poulet grillé, patate douce, salade", items:["poulet","patate douce","salade verte"] },
        dinner:{ name:"Soupe de légumes maison et œuf", items:["soupe de légumes maison","oeufs"] } },
      { day:"Mercredi",
        breakfast:{ name:"Skyr, granola, fruits rouges", items:["skyr","granola","fruits rouges"] },
        lunch:{ name:"Chili con carne maison (bœuf, haricots rouges, riz)", items:["boeuf haché 5%","haricots rouges","riz complet"] },
        dinner:{ name:"Poisson blanc, épinards", items:["cabillaud","épinards"] } },
      { day:"Jeudi",
        breakfast:{ name:"Omelette épinards et feta légère", items:["oeufs","épinards","feta légère"] },
        lunch:{ name:"Saumon, quinoa, asperges", items:["saumon","quinoa","asperges"] },
        dinner:{ name:"Tofu grillé, légumes sautés", items:["tofu","poivrons","courgettes"] } },
      { day:"Vendredi",
        breakfast:{ name:"Pain complet, beurre de cacahuète, banane", items:["pain complet","beurre de cacahuète","banane"] },
        lunch:{ name:"Pois chiches épicés, riz, légumes", items:["pois chiches","riz complet","légumes de saison"] },
        dinner:{ name:"Salade thon, œufs, tomates", items:["thon","oeufs","tomates cerises"] } },
      { day:"Samedi",
        breakfast:{ name:"Yaourt grec, flocons d'avoine, pomme, cannelle", items:["yaourt grec","flocons d'avoine","pomme","cannelle"] },
        lunch:{ name:"Dinde, pâtes complètes, sauce tomate maison", items:["dinde","pâtes complètes","tomates cerises","ail"] },
        dinner:{ name:"Blanc de poulet, courgettes grillées", items:["poulet","courgettes"] } },
      { day:"Dimanche",
        breakfast:{ name:"Smoothie bowl protéiné (yaourt, fruits, graines)", items:["yaourt grec","fruits rouges","graines (chia/lin)"] },
        lunch:{ name:"Filet mignon de porc, purée de patate douce, haricots verts", items:["porc filet mignon","patate douce","haricots verts"] },
        dinner:{ name:"Omelette légumes, salade verte", items:["oeufs","poivrons","salade verte"] } },
    ]
  },
  { name: "Semaine du Navigateur",
    days: [
      { day:"Lundi",
        breakfast:{ name:"Œufs au plat, pain complet, tomates poêlées", items:["oeufs","pain complet","tomates cerises"] },
        lunch:{ name:"Poulet, boulgour, courgettes", items:["poulet","boulgour","courgettes"] },
        dinner:{ name:"Salade de pois chiches, thon, tomates", items:["pois chiches","thon","tomates cerises"] } },
      { day:"Mardi",
        breakfast:{ name:"Bowl skyr, noix, miel", items:["skyr","noix","miel"] },
        lunch:{ name:"Thon, riz complet, poivrons", items:["thon","riz complet","poivrons"] },
        dinner:{ name:"Omelette au fromage frais et ciboulette", items:["oeufs","fromage frais léger","ciboulette"] } },
      { day:"Mercredi",
        breakfast:{ name:"Porridge avoine, pomme, cannelle", items:["flocons d'avoine","pomme","cannelle"] },
        lunch:{ name:"Bœuf haché, patate douce, haricots verts", items:["boeuf haché 5%","patate douce","haricots verts"] },
        dinner:{ name:"Filet de poulet, haricots verts", items:["poulet","haricots verts"] } },
      { day:"Jeudi",
        breakfast:{ name:"Omelette jambon de dinde et fromage frais", items:["bacon de dinde","oeufs","fromage frais léger"] },
        lunch:{ name:"Tofu, quinoa, épinards", items:["tofu","quinoa","épinards"] },
        dinner:{ name:"Soupe miso, tofu", items:["miso","tofu"] } },
      { day:"Vendredi",
        breakfast:{ name:"Smoothie vert protéiné", items:["épinards","banane","whey ou lait"] },
        lunch:{ name:"Crevettes, riz basmati, brocolis", items:["crevettes","riz basmati","brocolis"] },
        dinner:{ name:"Truite, épinards", items:["truite","épinards"] } },
      { day:"Samedi",
        breakfast:{ name:"Pain complet, avocat, œuf poché", items:["pain complet","avocat","oeufs"] },
        lunch:{ name:"Dinde, lentilles, carottes", items:["dinde","lentilles","carottes"] },
        dinner:{ name:"Salade César légère, dinde", items:["dinde","salade verte","parmesan léger"] } },
      { day:"Dimanche",
        breakfast:{ name:"Yaourt grec, fruits rouges, granola", items:["yaourt grec","fruits rouges","granola"] },
        lunch:{ name:"Saumon, semoule complète, courgettes", items:["saumon","semoule complète","courgettes"] },
        dinner:{ name:"Cabillaud, courgettes vapeur", items:["cabillaud","courgettes"] } },
    ]
  }
];

const SNACKS_FRINGALE = [
  { name: "Skyr ou yaourt grec + cannelle", note: "riche en protéines, très rassasiant, peu calorique" },
  { name: "Poignée d'amandes (20g)", note: "gras satiétogènes, à mesurer pour éviter l'excès" },
  { name: "Œuf dur", note: "protéine pure, transportable, coupe-faim solide" },
  { name: "Pomme + carré de fromage frais léger", note: "sucre naturel + protéine, combo anti-fringale classique" },
  { name: "Blanc de poulet ou dinde froid (restes)", note: "quasi sans calories, 100% protéines" },
  { name: "Bâtonnets de concombre / carotte + houmous", note: "volume + fibres, très peu de calories" },
  { name: "Thé ou infusion + eau pétillante", note: "beaucoup de fringales sont en fait de la soif" },
  { name: "Fromage blanc 0% + fruits rouges", note: "protéiné, sucré naturellement, très rassasiant" },
];

function getISOWeek(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function currentWeekIndex(){
  const week = getISOWeek(new Date());
  return week % WEEKLY_MENUS.length;
}

function downloadTextFile(filename, content){
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateShoppingListText(weekIndex){
  const week = WEEKLY_MENUS[weekIndex];
  const seen = new Set();
  const byCat = {};
  week.days.forEach(d => {
    [d.breakfast, d.lunch, d.dinner].forEach(meal => {
      meal.items.forEach(item => {
        if(seen.has(item)) return;
        seen.add(item);
        const info = INGREDIENT_INFO[item] || { cat: "Épicerie" };
        if(!byCat[info.cat]) byCat[info.cat] = [];
        byCat[info.cat].push({ item, alt: info.alt });
      });
    });
  });

  const catOrder = ["Protéines", "Fruits & légumes", "Épicerie", "Produits laitiers"];
  let out = `LISTE DE COURSES — ${week.name}\n`;
  out += `Quantités indicatives — ajuste selon tes portions et le nombre de jours réellement cuisinés.\n\n`;
  catOrder.forEach(cat => {
    if(!byCat[cat]) return;
    out += `== ${cat.toUpperCase()} ==\n`;
    byCat[cat].forEach(entry => {
      out += `[ ] ${entry.item}`;
      if(entry.alt) out += ` (dur à trouver ? remplace par : ${entry.alt})`;
      out += `\n`;
    });
    out += `\n`;
  });
  out += `— Saga du Viking —\n`;
  return out;
}

/* =========================================================
   CARTE DU CORPS — zones travaillées
   ========================================================= */

const ZONE_EXERCISES = {
  epaules:        { label: "Épaules",          view: "front", exos: ["Développé militaire haltères", "Élévations latérales", "Développé Arnold", "Face pull"] },
  pecs:           { label: "Pectoraux",        view: "front", exos: ["Développé couché", "Développé incliné haltères", "Écarté couché / pec deck", "Dips"] },
  biceps:         { label: "Biceps",           view: "front", exos: ["Curl barre EZ", "Curl marteau", "Curl unilatéral"] },
  abdos:          { label: "Abdominaux",       view: "front", exos: ["Crunch", "Relevé de jambes", "Gainage planche", "Mountain climbers"] },
  quadriceps:     { label: "Quadriceps",       view: "front", exos: ["Squat", "Fentes marchées", "Presse à cuisses"] },
  dos:            { label: "Dos",              view: "back",  exos: ["Tractions", "Rowing barre / haltère", "Tirage vertical", "Tirage horizontal poulie"] },
  triceps:        { label: "Triceps",          view: "back",  exos: ["Extensions triceps poulie", "Dips", "Extensions nuque"] },
  fessiersischios:{ label: "Fessiers & Ischios", view: "back", exos: ["Soulevé de terre roumain", "Pont fessier", "Leg curl"] },
  mollets:        { label: "Mollets",          view: "back",  exos: ["Mollets debout", "Mollets assis"] },
};

const CATEGORY_ZONES = {
  push: ["epaules","pecs","triceps"],
  push2: ["epaules","pecs","triceps"],
  pull: ["dos","biceps"],
  pull2: ["dos","biceps"],
  legs: ["quadriceps","fessiersischios","mollets"],
  cardio: ["abdos"],
  mobility: []
};

function bodyMapSVG(){
  return `
  <svg viewBox="0 0 420 260" xmlns="http://www.w3.org/2000/svg" style="width:100%; max-width:420px; height:auto;">
    <!-- FRONT VIEW -->
    <g transform="translate(20,10)">
      <text x="45" y="0" font-family="JetBrains Mono" font-size="10" fill="var(--parchment-dim)">FACE</text>
      <circle cx="45" cy="20" r="14" fill="var(--iron-light)"/>
      <rect x="20" y="36" width="50" height="70" rx="14" fill="var(--iron)"/>
      <circle data-zone="epaules" cx="18" cy="45" r="11" fill="var(--iron-light)"/>
      <circle data-zone="epaules" cx="72" cy="45" r="11" fill="var(--iron-light)"/>
      <rect data-zone="pecs" x="27" y="42" width="36" height="24" rx="6" fill="var(--iron-light)"/>
      <rect data-zone="abdos" x="29" y="68" width="32" height="34" rx="6" fill="var(--iron-light)"/>
      <rect data-zone="biceps" x="8" y="50" width="11" height="34" rx="5" fill="var(--iron-light)"/>
      <rect data-zone="biceps" x="71" y="50" width="11" height="34" rx="5" fill="var(--iron-light)"/>
      <rect x="6" y="84" width="11" height="30" rx="5" fill="var(--iron)"/>
      <rect x="73" y="84" width="11" height="30" rx="5" fill="var(--iron)"/>
      <rect data-zone="quadriceps" x="24" y="108" width="18" height="46" rx="7" fill="var(--iron-light)"/>
      <rect data-zone="quadriceps" x="48" y="108" width="18" height="46" rx="7" fill="var(--iron-light)"/>
      <rect x="24" y="154" width="18" height="42" rx="7" fill="var(--iron)"/>
      <rect x="48" y="154" width="18" height="42" rx="7" fill="var(--iron)"/>
    </g>
    <!-- BACK VIEW -->
    <g transform="translate(220,10)">
      <text x="35" y="0" font-family="JetBrains Mono" font-size="10" fill="var(--parchment-dim)">DOS</text>
      <circle cx="45" cy="20" r="14" fill="var(--iron-light)"/>
      <rect x="20" y="36" width="50" height="70" rx="14" fill="var(--iron)"/>
      <rect data-zone="dos" x="27" y="42" width="36" height="50" rx="8" fill="var(--iron-light)"/>
      <rect data-zone="triceps" x="8" y="50" width="11" height="34" rx="5" fill="var(--iron-light)"/>
      <rect data-zone="triceps" x="71" y="50" width="11" height="34" rx="5" fill="var(--iron-light)"/>
      <rect x="6" y="84" width="11" height="30" rx="5" fill="var(--iron)"/>
      <rect x="73" y="84" width="11" height="30" rx="5" fill="var(--iron)"/>
      <rect data-zone="fessiersischios" x="24" y="108" width="42" height="30" rx="8" fill="var(--iron-light)"/>
      <rect data-zone="fessiersischios" x="24" y="138" width="42" height="16" rx="6" fill="var(--iron-light)" opacity="0.7"/>
      <rect data-zone="mollets" x="24" y="154" width="18" height="42" rx="7" fill="var(--iron-light)"/>
      <rect data-zone="mollets" x="48" y="154" width="18" height="42" rx="7" fill="var(--iron-light)"/>
    </g>
  </svg>`;
}

function highlightBodyZones(containerId, activeZones){
  const container = document.getElementById(containerId);
  if(!container) return;
  const nodes = container.querySelectorAll("[data-zone]");
  nodes.forEach(node => {
    const z = node.getAttribute("data-zone");
    if(activeZones.includes(z)){
      node.setAttribute("fill", "var(--ember-bright)");
    } else {
      node.setAttribute("fill", "var(--iron-light)");
    }
  });
}

function renderCategoryBodyMap(containerId, categoryKey){
  const container = document.getElementById(containerId);
  container.innerHTML = bodyMapSVG();
  highlightBodyZones(containerId, CATEGORY_ZONES[categoryKey] || []);
}

/* =========================================================
   AVATAR ÉVOLUTIF
   ========================================================= */

const AVATAR_STAGES = [
  { minLevel: 1,  label: "Thrall",   accent: "#7d8492" },
  { minLevel: 3,  label: "Karl",     accent: "#8a9a7a" },
  { minLevel: 6,  label: "Berserker",accent: "#b8541f" },
  { minLevel: 10, label: "Housecarl",accent: "#c9a35d" },
  { minLevel: 15, label: "Jarl",     accent: "#e07a3a" },
  { minLevel: 20, label: "Viking Légendaire", accent: "#e6c583" },
];

function avatarStageIndex(level){
  let idx = 0;
  AVATAR_STAGES.forEach((s, i) => { if(level >= s.minLevel) idx = i; });
  return idx;
}

function buildAvatarSVG(level){
  const stage = avatarStageIndex(level);
  const shoulderW = 44 + stage * 7;
  const waistW = Math.max(24, 42 - stage * 3);
  const accent = AVATAR_STAGES[stage].accent;
  const cx = 100, shoulderY = 96, waistY = 160, hipY = 172, footY = 250;

  let gear = "";
  if(stage >= 1){
    gear += `<rect x="${cx-waistW/2-4}" y="${waistY-4}" width="${waistW+8}" height="10" rx="4" fill="#5b4324"/>`;
  }
  if(stage >= 2){
    gear += `<circle cx="${cx-shoulderW/2+4}" cy="${shoulderY+2}" r="13" fill="#6b5335"/>`;
    gear += `<line x1="${cx+shoulderW/2}" y1="${shoulderY+20}" x2="${cx+shoulderW/2+34}" y2="${shoulderY+70}" stroke="#8a6a3f" stroke-width="5" stroke-linecap="round"/>`;
    gear += `<path d="M ${cx+shoulderW/2+30} ${shoulderY+60} l -14 -6 l 14 -18 l 14 18 z" fill="${accent}"/>`;
  }
  if(stage >= 3){
    gear += `<ellipse cx="${cx-shoulderW/2-20}" cy="${shoulderY+50}" rx="16" ry="26" fill="#4a3a2a" stroke="${accent}" stroke-width="2"/>`;
  }
  if(stage >= 4){
    gear += `<path d="M ${cx-shoulderW/2+2} ${shoulderY-6} Q ${cx} ${waistY+50} ${cx+shoulderW/2-2} ${shoulderY-6} L ${cx+shoulderW/2+10} ${shoulderY+4} Q ${cx} ${waistY+64} ${cx-shoulderW/2-10} ${shoulderY+4} Z" fill="#5a1f1f" opacity="0.85"/>`;
  }
  if(stage >= 5){
    gear += `<path d="M ${cx-30} ${shoulderY-40} L ${cx-42} ${shoulderY-64} L ${cx-14} ${shoulderY-46} Z" fill="#d8d0c0"/>`;
    gear += `<path d="M ${cx+30} ${shoulderY-40} L ${cx+42} ${shoulderY-64} L ${cx+14} ${shoulderY-46} Z" fill="#d8d0c0"/>`;
    gear += `<circle cx="${cx}" cy="${shoulderY-10}" r="90" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.35"/>`;
  }

  const absLines = stage >= 2 ? `
    <line x1="${cx-16}" y1="${waistY-38}" x2="${cx-16}" y2="${waistY-6}" stroke="#00000030" stroke-width="2"/>
    <line x1="${cx}" y1="${waistY-38}" x2="${cx}" y2="${waistY-6}" stroke="#00000030" stroke-width="2"/>
    <line x1="${cx+16}" y1="${waistY-38}" x2="${cx+16}" y2="${waistY-6}" stroke="#00000030" stroke-width="2"/>
  ` : "";

  return `
  <svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg" style="width:100%; max-width:220px; height:auto; display:block; margin:0 auto;">
    ${gear}
    <circle cx="${cx}" cy="46" r="22" fill="#d8b88a"/>
    <path d="M ${cx-22} 40 Q ${cx-22} 18 ${cx} 18 Q ${cx+22} 18 ${cx+22} 40 L ${cx+22} 30 Q ${cx} 22 ${cx-22} 30 Z" fill="#7a5a35"/>
    <path d="M ${cx-shoulderW/2} ${shoulderY} Q ${cx-shoulderW/2-6} ${(shoulderY+waistY)/2} ${cx-waistW/2} ${waistY}
             L ${cx+waistW/2} ${waistY} Q ${cx+shoulderW/2+6} ${(shoulderY+waistY)/2} ${cx+shoulderW/2} ${shoulderY}
             Q ${cx} ${shoulderY-14} ${cx-shoulderW/2} ${shoulderY} Z" fill="#c8ccd2"/>
    ${absLines}
    <rect x="${cx-waistW/2-10}" y="${shoulderY+6}" width="10" height="52" rx="5" fill="#d8b88a"/>
    <rect x="${cx+waistW/2}" y="${shoulderY+6}" width="10" height="52" rx="5" fill="#d8b88a"/>
    <rect x="${cx-waistW/2}" y="${hipY}" width="${waistW*0.42}" height="60" rx="8" fill="#3c4450"/>
    <rect x="${cx+waistW/2-waistW*0.42}" y="${hipY}" width="${waistW*0.42}" height="60" rx="8" fill="#3c4450"/>
    <rect x="${cx-waistW/2}" y="${footY-10}" width="${waistW*0.42}" height="12" rx="4" fill="#2a241c"/>
    <rect x="${cx+waistW/2-waistW*0.42}" y="${footY-10}" width="${waistW*0.42}" height="12" rx="4" fill="#2a241c"/>
  </svg>`;
}

function renderAvatarWidget(elId){
  const el = document.getElementById(elId);
  const stage = avatarStageIndex(state.level);
  const info = AVATAR_STAGES[stage];
  const next = AVATAR_STAGES[stage+1];
  el.innerHTML = `
    <div style="text-align:center;">
      ${buildAvatarSVG(state.level)}
      <div style="font-family:var(--font-display); color:var(--gold-bright); margin-top:8px; font-size:16px;">${info.label}</div>
      <div style="font-family:var(--font-mono); color:var(--parchment-dim); font-size:11px; margin-top:4px;">
        ${next ? `Prochaine évolution au niveau ${next.minLevel} (${next.label})` : "Forme ultime atteinte"}
      </div>
    </div>
  `;
}

/* =========================================================
   ESTIMATION DE RYTHME — prochaine évolution
   ========================================================= */

function xpNeededFromLevelToLevel(fromLevel, fromXP, toLevel){
  let remaining = 0;
  let lvl = fromLevel;
  let carriedXP = fromXP;
  while(lvl < toLevel){
    remaining += (xpNeededFor(lvl) - carriedXP);
    carriedXP = 0;
    lvl++;
  }
  return Math.max(0, remaining);
}

function estimateNextStageWeeks(){
  const stage = avatarStageIndex(state.level);
  const next = AVATAR_STAGES[stage+1];
  if(!next) return { done: true };

  if(!state.firstLogDate || state.totalXPEarned <= 0){
    return { done:false, noData:true };
  }

  const weeksSinceStart = Math.max(1/7, daysBetween(new Date(state.firstLogDate), new Date()) / 7);
  const xpPerWeek = state.totalXPEarned / weeksSinceStart;
  if(xpPerWeek <= 0) return { done:false, noData:true };

  const xpRemaining = xpNeededFromLevelToLevel(state.level, state.xp, next.minLevel);
  const weeks = xpRemaining / xpPerWeek;
  return { done:false, noData:false, weeks: Math.max(0, Math.round(weeks)), nextLabel: next.label, nextLevel: next.minLevel };
}

function renderPaceEstimate(elId){
  const el = document.getElementById(elId);
  const est = estimateNextStageWeeks();
  if(est.done){
    el.textContent = "Forme ultime atteinte — la légende est écrite.";
    return;
  }
  if(est.noData){
    el.textContent = "Grave ta première quête pour que ton rythme soit mesuré.";
    return;
  }
  if(est.weeks === 0){
    el.textContent = `À ce rythme, ta prochaine évolution (${est.nextLabel}) arrive d'un jour à l'autre !`;
  } else {
    el.textContent = `À ce rythme, prochaine évolution (${est.nextLabel}, niveau ${est.nextLevel}) estimée dans ${est.weeks} semaine${est.weeks>1?"s":""}.`;
  }
}

/* =========================================================
   LIVRE DE RECETTES — un plat, une recette
   ========================================================= */

const RECIPES = {
  "Bol d'avoine au skyr et myrtilles": "Ingrédients (1 pers.) : 50g de flocons d'avoine, 150g de skyr, 60g de myrtilles, 10g d'amandes effilées, 1 pincée de cannelle\n\nPréparation :\n1. Cuire les flocons d'avoine dans un peu d'eau ou de lait 3-4 min, ou les laisser tremper une nuit.\n2. Une fois tièdes ou froids, incorporer le skyr.\n3. Ajouter les myrtilles, les amandes et une pincée de cannelle.",
  "Poulet rôti, riz complet, brocolis": "Ingrédients (1 pers.) : 150g de blanc de poulet, 60g de riz complet cru, 150g de brocolis, 1 c. à soupe d'huile d'olive, sel, poivre, paprika\n\nPréparation :\n1. Assaisonner le poulet et le rôtir au four 20-25 min à 200°C ou à la poêle 6-7 min par face.\n2. Cuire le riz complet selon les indications du paquet.\n3. Cuire les brocolis à la vapeur 8-10 min, arroser d'un filet d'huile d'olive.",
  "Omelette aux légumes et salade verte": "Ingrédients (1 pers.) : 3 œufs, 1/2 poivron, 50g de champignons, salade verte, 1 c. à café d'huile\n\nPréparation :\n1. Faire revenir le poivron et les champignons émincés 4-5 min.\n2. Battre les œufs, verser sur les légumes, cuire à feu doux 3-4 min.\n3. Servir avec la salade verte assaisonnée.",
  "Œufs brouillés et pain complet à l'avocat": "Ingrédients (1 pers.) : 2-3 œufs, 1 tranche de pain complet, 1/2 avocat, sel, poivre\n\nPréparation :\n1. Battre les œufs et les cuire à feu doux en remuant pour des œufs brouillés crémeux.\n2. Toaster le pain complet.\n3. Écraser l'avocat sur le pain, assaisonner et servir avec les œufs.",
  "Saumon, patate douce, épinards": "Ingrédients (1 pers.) : 150g de saumon, 200g de patate douce, 100g d'épinards frais, 1/2 citron, huile d'olive\n\nPréparation :\n1. Cuire la patate douce en dés au four 20 min à 200°C ou à la vapeur.\n2. Cuire le saumon à la poêle 3-4 min par face ou au four 12-15 min.\n3. Faire tomber les épinards 2-3 min à la poêle, arroser de citron.",
  "Filet de poulet grillé, haricots verts": "Ingrédients (1 pers.) : 150g de filet de poulet, 200g de haricots verts, 1 gousse d'ail, huile d'olive\n\nPréparation :\n1. Griller le poulet 5-6 min par face.\n2. Cuire les haricots verts à la vapeur 8-10 min.\n3. Faire revenir les haricots avec l'ail et un filet d'huile.",
  "Porridge protéiné banane-cacao": "Ingrédients (1 pers.) : 50g de flocons d'avoine, 200ml de lait, 1 banane, 1 c. à café de cacao non sucré\n\nPréparation :\n1. Chauffer le lait et les flocons d'avoine 4-5 min en remuant.\n2. Incorporer le cacao.\n3. Écraser la moitié de la banane dedans, trancher l'autre moitié en garniture.",
  "Bœuf haché maigre, quinoa, poivrons": "Ingrédients (1 pers.) : 150g de bœuf haché 5%, 60g de quinoa cru, 1 poivron, 1/2 oignon, huile d'olive\n\nPréparation :\n1. Cuire le quinoa dans deux fois son volume d'eau 12-15 min.\n2. Faire revenir l'oignon et le poivron 5 min.\n3. Ajouter le bœuf, cuire 6-7 min en émiettant, servir sur le quinoa.",
  "Poisson blanc vapeur, courgettes sautées": "Ingrédients (1 pers.) : 150g de poisson blanc, 1 courgette, 1 gousse d'ail, huile d'olive, citron\n\nPréparation :\n1. Cuire le poisson à la vapeur 10-12 min.\n2. Faire sauter la courgette en rondelles avec l'ail 6-7 min.\n3. Arroser le poisson de citron avant de servir.",
  "Omelette champignons et fromage frais": "Ingrédients (1 pers.) : 3 œufs, 80g de champignons, 30g de fromage frais léger, ciboulette\n\nPréparation :\n1. Faire revenir les champignons 5 min.\n2. Battre les œufs et verser dessus, cuire à feu doux.\n3. Ajouter le fromage frais en fin de cuisson, parsemer de ciboulette.",
  "Dinde, pâtes complètes, courgettes à l'ail": "Ingrédients (1 pers.) : 150g d'escalope de dinde, 70g de pâtes complètes crues, 1 courgette, 1 gousse d'ail\n\nPréparation :\n1. Cuire les pâtes complètes selon le paquet.\n2. Cuire la dinde 5-6 min par face.\n3. Faire revenir la courgette avec l'ail, mélanger le tout.",
  "Soupe de légumes maison et œufs durs": "Ingrédients (1 pers.) : légumes de saison au choix, 2 œufs\n\nPréparation :\n1. Éplucher et couper les légumes, cuire 20 min dans l'eau ou un bouillon.\n2. Mixer jusqu'à consistance lisse, assaisonner.\n3. Cuire les œufs 9-10 min à l'eau bouillante, écaler et servir à côté.",
  "Yaourt grec, granola, fruits rouges": "Ingrédients (1 pers.) : 150g de yaourt grec, 30g de granola, 60g de fruits rouges\n\nPréparation :\n1. Verser le yaourt grec dans un bol.\n2. Ajouter le granola juste avant de manger pour qu'il reste croustillant.\n3. Garnir de fruits rouges.",
  "Tofu mariné, riz basmati, brocolis-carottes": "Ingrédients (1 pers.) : 150g de tofu ferme, 60g de riz basmati cru, 100g de brocolis, 1 carotte, sauce soja\n\nPréparation :\n1. Couper le tofu en dés, le mariner 10 min dans la sauce soja.\n2. Cuire le riz basmati selon le paquet.\n3. Faire revenir le tofu, le brocolis et la carotte 8-10 min.",
  "Salade de thon, tomates, œufs, quinoa froid": "Ingrédients (1 pers.) : 1 boîte de thon au naturel, 2 tomates, 2 œufs durs, 60g de quinoa cuit, huile d'olive\n\nPréparation :\n1. Cuire le quinoa, le laisser refroidir.\n2. Cuire les œufs durs 9-10 min, écaler et couper en quartiers.\n3. Mélanger tous les ingrédients avec un filet d'huile d'olive.",
  "Pain complet, fromage blanc, œuf dur, concombre": "Ingrédients (1 pers.) : 1-2 tranches de pain complet, 100g de fromage blanc, 1 œuf dur, 1/2 concombre\n\nPréparation :\n1. Cuire l'œuf dur 9-10 min.\n2. Trancher le concombre.\n3. Assembler pain, fromage blanc, œuf et concombre.",
  "Cabillaud, semoule complète, ratatouille": "Ingrédients (1 pers.) : 150g de cabillaud, 60g de semoule complète crue, légumes pour ratatouille\n\nPréparation :\n1. Mijoter les légumes en dés avec un filet d'huile 20-25 min.\n2. Cuire le cabillaud à la vapeur ou à la poêle 8-10 min.\n3. Faire gonfler la semoule dans l'eau bouillante hors du feu 5 min, servir ensemble.",
  "Escalope de dinde, épinards à l'ail": "Ingrédients (1 pers.) : 150g d'escalope de dinde, 150g d'épinards frais, 1 gousse d'ail, huile d'olive\n\nPréparation :\n1. Cuire l'escalope 5-6 min par face.\n2. Faire tomber les épinards avec l'ail 2-3 min.\n3. Servir ensemble avec un filet d'huile.",
  "Pancakes protéinés à la banane": "Ingrédients (1 pers.) : 2 œufs, 1 banane, 40g de flocons d'avoine, cannelle\n\nPréparation :\n1. Mixer ou écraser tous les ingrédients ensemble.\n2. Cuire des petites louches de pâte à la poêle 2-3 min par face.\n3. Servir tièdes.",
  "Lentilles, légumes rôtis, œuf poché": "Ingrédients (1 pers.) : 70g de lentilles crues, légumes de saison, 1 œuf\n\nPréparation :\n1. Cuire les lentilles 20-25 min dans l'eau non salée.\n2. Faire rôtir les légumes au four 20 min à 200°C avec un filet d'huile.\n3. Pocher l'œuf 3 min dans une eau frémissante vinaigrée, servir sur les lentilles.",
  "Tofu sauté, légumes wok, sauce soja légère": "Ingrédients (1 pers.) : 150g de tofu ferme, poivron, carotte, sauce soja\n\nPréparation :\n1. Couper le tofu en cubes, le dorer à la poêle 5-6 min.\n2. Ajouter les légumes émincés, sauter à feu vif 5-6 min.\n3. Assaisonner de sauce soja en fin de cuisson.",
  "Smoothie protéiné banane-avoine": "Ingrédients (1 pers.) : 1 banane, 200ml de lait, 30g de flocons d'avoine, 1 c. à soupe de beurre de cacahuète\n\nPréparation :\n1. Mettre tous les ingrédients dans un blender.\n2. Mixer jusqu'à texture lisse.\n3. Ajouter de l'eau ou des glaçons si trop épais.",
  "Crevettes sautées, riz complet, légumes croquants": "Ingrédients (1 pers.) : 150g de crevettes décortiquées, 60g de riz complet cru, poivron, carotte\n\nPréparation :\n1. Cuire le riz complet selon le paquet.\n2. Faire sauter les légumes à feu vif 4-5 min pour qu'ils restent croquants.\n3. Ajouter les crevettes en fin de cuisson, 2-3 min suffisent.",
  "Salade de poulet, avocat, tomates": "Ingrédients (1 pers.) : 150g de blanc de poulet cuit, 1/2 avocat, 2 tomates, salade verte, huile d'olive\n\nPréparation :\n1. Cuire ou réchauffer le poulet, le trancher.\n2. Couper l'avocat et les tomates.\n3. Mélanger sur un lit de salade, assaisonner d'huile d'olive.",
  "Œufs pochés, avocat, pain complet": "Ingrédients (1 pers.) : 2 œufs, 1/2 avocat, 1-2 tranches de pain complet\n\nPréparation :\n1. Pocher les œufs 3 min dans une eau frémissante vinaigrée.\n2. Toaster le pain, écraser l'avocat dessus.\n3. Déposer les œufs pochés sur l'avocat.",
  "Poulet au curry léger, riz basmati, épinards": "Ingrédients (1 pers.) : 150g de poulet, 1 c. à café de curry, 60g de riz basmati cru, 100g d'épinards\n\nPréparation :\n1. Faire revenir le poulet avec le curry 8-10 min.\n2. Cuire le riz basmati selon le paquet.\n3. Ajouter les épinards en fin de cuisson.",
  "Soupe miso, tofu, légumes": "Ingrédients (1 pers.) : 1 c. à soupe de pâte miso, 100g de tofu, champignons, carotte\n\nPréparation :\n1. Chauffer de l'eau sans bouillir fort, y diluer le miso.\n2. Ajouter le tofu en dés et les légumes émincés.\n3. Laisser mijoter doucement 5 min sans bouillir.",
  "Skyr, flocons d'avoine, pomme, cannelle": "Ingrédients (1 pers.) : 150g de skyr, 30g de flocons d'avoine, 1 pomme, cannelle\n\nPréparation :\n1. Mélanger le skyr et les flocons d'avoine.\n2. Couper la pomme en dés.\n3. Ajouter à la préparation, saupoudrer de cannelle.",
  "Steak haché 5%, pâtes complètes, salade": "Ingrédients (1 pers.) : 150g de steak haché 5%, 70g de pâtes complètes crues, salade verte\n\nPréparation :\n1. Cuire les pâtes complètes selon le paquet.\n2. Cuire le steak 3-4 min par face selon la cuisson désirée.\n3. Servir avec une salade assaisonnée.",
  "Cabillaud au citron, courgettes": "Ingrédients (1 pers.) : 150g de cabillaud, 1 courgette, 1/2 citron, huile d'olive\n\nPréparation :\n1. Couper la courgette en rondelles, la cuire à la poêle 8-10 min.\n2. Cuire le cabillaud à la poêle ou au four 10-12 min.\n3. Arroser de citron avant de servir.",
  "Omelette au saumon fumé et fromage frais": "Ingrédients (1 pers.) : 3 œufs, 50g de saumon fumé, 30g de fromage frais léger\n\nPréparation :\n1. Battre les œufs, cuire à feu doux.\n2. Ajouter le saumon et le fromage frais avant que l'omelette ne soit prise.\n3. Plier et servir.",
  "Maquereau, pommes de terre vapeur, haricots verts": "Ingrédients (1 pers.) : 1 boîte ou filet de maquereau, 200g de pommes de terre, 150g de haricots verts\n\nPréparation :\n1. Cuire les pommes de terre à la vapeur 20 min.\n2. Cuire les haricots verts à la vapeur 8-10 min.\n3. Servir avec le maquereau égoutté.",
  "Œufs brouillés, épinards, champignons": "Ingrédients (1 pers.) : 3 œufs, 100g d'épinards, 80g de champignons\n\nPréparation :\n1. Faire revenir les champignons puis les épinards 5 min.\n2. Battre les œufs et les verser dessus.\n3. Cuire à feu doux en remuant pour des œufs brouillés crémeux.",
  "Porridge quinoa, lait, fruits secs": "Ingrédients (1 pers.) : 50g de quinoa, 200ml de lait, amandes ou noix\n\nPréparation :\n1. Rincer le quinoa, le cuire dans le lait 15 min à feu doux.\n2. Laisser légèrement épaissir.\n3. Garnir de fruits secs concassés.",
  "Pois chiches, riz, légumes rôtis (repas végé)": "Ingrédients (1 pers.) : 150g de pois chiches cuits, 60g de riz cru, légumes de saison\n\nPréparation :\n1. Cuire le riz selon le paquet.\n2. Faire rôtir les légumes au four 20 min à 200°C.\n3. Réchauffer les pois chiches et assembler avec un filet d'huile.",
  "Salade de lentilles, feta légère, concombre": "Ingrédients (1 pers.) : 100g de lentilles cuites, 40g de feta légère, 1/2 concombre, huile d'olive\n\nPréparation :\n1. Couper le concombre en dés, émietter la feta.\n2. Mélanger avec les lentilles.\n3. Assaisonner d'huile d'olive et de poivre.",
  "Pain complet, houmous, œuf dur, tomates": "Ingrédients (1 pers.) : 1-2 tranches de pain complet, 40g de houmous, 1 œuf dur, tomates cerises\n\nPréparation :\n1. Cuire l'œuf dur 9-10 min.\n2. Tartiner le pain de houmous.\n3. Ajouter l'œuf tranché et les tomates.",
  "Dinde, boulgour, poivrons grillés": "Ingrédients (1 pers.) : 150g de dinde, 60g de boulgour cru, 1 poivron\n\nPréparation :\n1. Cuire le boulgour dans l'eau bouillante hors du feu 10-12 min.\n2. Griller le poivron puis l'émincer.\n3. Cuire la dinde 5-6 min par face et servir ensemble.",
  "Blanc de poulet grillé, ratatouille": "Ingrédients (1 pers.) : 150g de blanc de poulet, légumes pour ratatouille\n\nPréparation :\n1. Mijoter les légumes en dés avec un filet d'huile 20-25 min.\n2. Griller le poulet 5-6 min par face.\n3. Servir accompagné de la ratatouille.",
  "Yaourt grec, muesli, kiwi": "Ingrédients (1 pers.) : 150g de yaourt grec, 30g de muesli, 1 kiwi\n\nPréparation :\n1. Verser le yaourt grec dans un bol.\n2. Couper le kiwi en tranches.\n3. Ajouter le muesli et le kiwi juste avant de servir.",
  "Truite, quinoa, brocolis": "Ingrédients (1 pers.) : 150g de filet de truite, 60g de quinoa cru, 150g de brocolis\n\nPréparation :\n1. Cuire le quinoa dans deux fois son volume d'eau 12-15 min.\n2. Cuire la truite au four ou à la poêle 10-12 min.\n3. Cuire les brocolis à la vapeur et servir ensemble.",
  "Poisson blanc, salade verte, vinaigrette légère": "Ingrédients (1 pers.) : 150g de poisson blanc, salade verte, huile d'olive, citron\n\nPréparation :\n1. Cuire le poisson à la vapeur ou à la poêle 8-10 min.\n2. Préparer une vinaigrette avec huile d'olive et citron.\n3. Servir le poisson sur la salade assaisonnée.",
  "Œufs, bacon de dinde grillé, tomates": "Ingrédients (1 pers.) : 2-3 œufs, 2 tranches de bacon de dinde, tomates cerises\n\nPréparation :\n1. Griller le bacon de dinde sans matière grasse 3-4 min.\n2. Cuire les œufs au plat ou brouillés dans la même poêle.\n3. Servir avec les tomates cerises.",
  "Bœuf sauté, riz complet, brocolis": "Ingrédients (1 pers.) : 150g de bœuf en lanières, 60g de riz complet cru, 150g de brocolis\n\nPréparation :\n1. Cuire le riz complet selon le paquet.\n2. Cuire les brocolis à la vapeur 8-10 min.\n3. Faire sauter le bœuf à feu vif 3-4 min et servir ensemble.",
  "Salade César allégée (poulet, salade, parmesan léger)": "Ingrédients (1 pers.) : 150g de blanc de poulet, salade verte, 10g de parmesan, yaourt nature pour la sauce\n\nPréparation :\n1. Cuire le poulet 5-6 min par face, le trancher.\n2. Préparer une sauce légère au yaourt, citron et moutarde.\n3. Assembler la salade avec le poulet, la sauce et le parmesan.",
  "Porridge avoine, banane, noix": "Ingrédients (1 pers.) : 50g de flocons d'avoine, 200ml de lait, 1 banane, quelques noix\n\nPréparation :\n1. Chauffer le lait et les flocons d'avoine 4-5 min.\n2. Trancher la banane.\n3. Garnir le porridge de banane et de noix concassées.",
  "Poulet grillé, patate douce, salade": "Ingrédients (1 pers.) : 150g de blanc de poulet, 200g de patate douce, salade verte\n\nPréparation :\n1. Couper la patate douce en frites ou en dés, cuire au four 20-25 min à 200°C.\n2. Griller le poulet 5-6 min par face.\n3. Servir avec une salade verte.",
  "Soupe de légumes maison et œuf": "Ingrédients (1 pers.) : légumes de saison, 1 œuf\n\nPréparation :\n1. Éplucher et couper les légumes, cuire 20 min dans l'eau ou un bouillon.\n2. Mixer jusqu'à consistance lisse.\n3. Servir avec un œuf dur ou poché.",
  "Skyr, granola, fruits rouges": "Ingrédients (1 pers.) : 150g de skyr, 30g de granola, fruits rouges\n\nPréparation :\n1. Verser le skyr dans un bol.\n2. Ajouter le granola juste avant de servir.\n3. Garnir de fruits rouges.",
  "Chili con carne maison (bœuf, haricots rouges, riz)": "Ingrédients (1 pers.) : 150g de bœuf haché, 100g de haricots rouges cuits, 60g de riz cru, tomates, cumin, paprika\n\nPréparation :\n1. Faire revenir le bœuf avec les épices 5-6 min.\n2. Ajouter les tomates et les haricots rouges, mijoter 15-20 min.\n3. Cuire le riz à part et servir le chili dessus.",
  "Poisson blanc, épinards": "Ingrédients (1 pers.) : 150g de poisson blanc, 150g d'épinards, huile d'olive\n\nPréparation :\n1. Cuire le poisson à la vapeur ou à la poêle 8-10 min.\n2. Faire tomber les épinards 2-3 min.\n3. Servir ensemble avec un filet d'huile.",
  "Omelette épinards et feta légère": "Ingrédients (1 pers.) : 3 œufs, 100g d'épinards, 30g de feta légère\n\nPréparation :\n1. Faire tomber les épinards 2-3 min.\n2. Battre les œufs et verser dessus.\n3. Ajouter la feta et cuire à feu doux jusqu'à ce que l'omelette soit prise.",
  "Saumon, quinoa, asperges": "Ingrédients (1 pers.) : 150g de saumon, 60g de quinoa cru, asperges\n\nPréparation :\n1. Cuire le quinoa dans deux fois son volume d'eau 12-15 min.\n2. Cuire les asperges à la vapeur 8-10 min.\n3. Cuire le saumon 10-12 min et servir ensemble.",
  "Tofu grillé, légumes sautés": "Ingrédients (1 pers.) : 150g de tofu ferme, poivron, courgette\n\nPréparation :\n1. Couper le tofu en tranches, le griller 4-5 min par face.\n2. Faire sauter les légumes à feu vif 5-6 min.\n3. Servir ensemble.",
  "Pain complet, beurre de cacahuète, banane": "Ingrédients (1 pers.) : 1-2 tranches de pain complet, 1 c. à soupe de beurre de cacahuète, 1 banane\n\nPréparation :\n1. Toaster le pain.\n2. Tartiner de beurre de cacahuète.\n3. Ajouter des rondelles de banane.",
  "Pois chiches épicés, riz, légumes": "Ingrédients (1 pers.) : 150g de pois chiches cuits, 60g de riz cru, légumes de saison, cumin, paprika\n\nPréparation :\n1. Cuire le riz selon le paquet.\n2. Faire revenir les pois chiches avec les épices 5-6 min.\n3. Ajouter les légumes émincés, poursuivre 5 min.",
  "Salade thon, œufs, tomates": "Ingrédients (1 pers.) : 1 boîte de thon, 2 œufs durs, tomates, huile d'olive\n\nPréparation :\n1. Cuire les œufs durs 9-10 min, les couper en quartiers.\n2. Égoutter le thon.\n3. Mélanger tous les ingrédients avec un filet d'huile.",
  "Yaourt grec, flocons d'avoine, pomme, cannelle": "Ingrédients (1 pers.) : 150g de yaourt grec, 30g de flocons d'avoine, 1 pomme, cannelle\n\nPréparation :\n1. Mélanger le yaourt grec et les flocons d'avoine.\n2. Couper la pomme en dés.\n3. Ajouter à la préparation, saupoudrer de cannelle.",
  "Dinde, pâtes complètes, sauce tomate maison": "Ingrédients (1 pers.) : 150g de dinde, 70g de pâtes complètes crues, tomates, ail\n\nPréparation :\n1. Cuire les pâtes selon le paquet.\n2. Faire revenir la dinde avec l'ail 6-7 min.\n3. Ajouter les tomates concassées, mijoter 10 min et servir sur les pâtes.",
  "Blanc de poulet, courgettes grillées": "Ingrédients (1 pers.) : 150g de blanc de poulet, 1-2 courgettes\n\nPréparation :\n1. Couper les courgettes en tranches, les griller 8-10 min.\n2. Griller le poulet 5-6 min par face.\n3. Servir ensemble.",
  "Smoothie bowl protéiné (yaourt, fruits, graines)": "Ingrédients (1 pers.) : 150g de yaourt grec, fruits rouges, 1 c. à soupe de graines (chia/lin)\n\nPréparation :\n1. Mixer une partie du yaourt avec des fruits pour une base crémeuse.\n2. Verser dans un bol.\n3. Garnir de fruits frais et de graines.",
  "Filet mignon de porc, purée de patate douce, haricots verts": "Ingrédients (1 pers.) : 150g de filet mignon de porc, 200g de patate douce, 150g de haricots verts\n\nPréparation :\n1. Cuire la patate douce puis l'écraser en purée.\n2. Cuire le filet mignon 4-5 min par face puis 10 min au four à 180°C si épais.\n3. Cuire les haricots verts à la vapeur et servir ensemble.",
  "Omelette légumes, salade verte": "Ingrédients (1 pers.) : 3 œufs, poivron, carotte, salade verte\n\nPréparation :\n1. Faire revenir les légumes émincés 5 min.\n2. Battre les œufs et verser dessus, cuire à feu doux.\n3. Servir avec une salade verte.",
  "Œufs au plat, pain complet, tomates poêlées": "Ingrédients (1 pers.) : 2-3 œufs, 1-2 tranches de pain complet, tomates cerises\n\nPréparation :\n1. Poêler les tomates cerises coupées en deux 3-4 min.\n2. Cuire les œufs au plat.\n3. Servir avec le pain complet toasté.",
  "Poulet, boulgour, courgettes": "Ingrédients (1 pers.) : 150g de poulet, 60g de boulgour cru, 1 courgette\n\nPréparation :\n1. Cuire le boulgour dans l'eau bouillante hors du feu 10-12 min.\n2. Griller le poulet 5-6 min par face.\n3. Faire sauter la courgette et servir ensemble.",
  "Salade de pois chiches, thon, tomates": "Ingrédients (1 pers.) : 150g de pois chiches cuits, 1 boîte de thon, tomates, huile d'olive\n\nPréparation :\n1. Égoutter le thon et les pois chiches.\n2. Couper les tomates.\n3. Mélanger le tout avec un filet d'huile.",
  "Bowl skyr, noix, miel": "Ingrédients (1 pers.) : 150g de skyr, quelques noix, 1 c. à café de miel\n\nPréparation :\n1. Verser le skyr dans un bol.\n2. Concasser les noix par-dessus.\n3. Ajouter un filet de miel.",
  "Thon, riz complet, poivrons": "Ingrédients (1 pers.) : 1 boîte de thon, 60g de riz complet cru, 1 poivron\n\nPréparation :\n1. Cuire le riz complet selon le paquet.\n2. Faire sauter le poivron 5-6 min.\n3. Ajouter le thon égoutté et mélanger.",
  "Omelette au fromage frais et ciboulette": "Ingrédients (1 pers.) : 3 œufs, 30g de fromage frais léger, ciboulette\n\nPréparation :\n1. Battre les œufs, cuire à feu doux.\n2. Ajouter le fromage frais avant que l'omelette ne soit prise.\n3. Parsemer de ciboulette avant de servir.",
  "Porridge avoine, pomme, cannelle": "Ingrédients (1 pers.) : 50g de flocons d'avoine, 200ml de lait, 1 pomme, cannelle\n\nPréparation :\n1. Chauffer le lait et les flocons d'avoine 4-5 min.\n2. Couper la pomme en dés.\n3. Ajouter la pomme et la cannelle en fin de cuisson.",
  "Bœuf haché, patate douce, haricots verts": "Ingrédients (1 pers.) : 150g de bœuf haché 5%, 200g de patate douce, 150g de haricots verts\n\nPréparation :\n1. Cuire la patate douce en dés au four 20 min à 200°C.\n2. Cuire les haricots verts à la vapeur 8-10 min.\n3. Cuire le bœuf haché 6-7 min et servir ensemble.",
  "Filet de poulet, haricots verts": "Ingrédients (1 pers.) : 150g de filet de poulet, 200g de haricots verts\n\nPréparation :\n1. Cuire les haricots verts à la vapeur 8-10 min.\n2. Griller le poulet 5-6 min par face.\n3. Servir ensemble avec un filet d'huile.",
  "Omelette jambon de dinde et fromage frais": "Ingrédients (1 pers.) : 3 œufs, 2 tranches de bacon/jambon de dinde, 30g de fromage frais léger\n\nPréparation :\n1. Faire revenir le bacon de dinde en lanières 2-3 min.\n2. Battre les œufs et verser dessus, cuire à feu doux.\n3. Ajouter le fromage frais avant que l'omelette ne soit prise.",
  "Tofu, quinoa, épinards": "Ingrédients (1 pers.) : 150g de tofu, 60g de quinoa cru, 100g d'épinards\n\nPréparation :\n1. Cuire le quinoa dans deux fois son volume d'eau 12-15 min.\n2. Faire dorer le tofu en dés 6-7 min.\n3. Ajouter les épinards en fin de cuisson, servir avec le quinoa.",
  "Soupe miso, tofu": "Ingrédients (1 pers.) : 1 c. à soupe de pâte miso, 100g de tofu\n\nPréparation :\n1. Chauffer de l'eau sans bouillir fort.\n2. Diluer la pâte miso dedans.\n3. Ajouter le tofu en dés, réchauffer doucement 3-4 min.",
  "Smoothie vert protéiné": "Ingrédients (1 pers.) : poignée d'épinards, 1 banane, 200ml de lait ou whey\n\nPréparation :\n1. Mettre tous les ingrédients dans un blender.\n2. Mixer jusqu'à texture bien lisse.\n3. Ajouter de l'eau si trop épais.",
  "Crevettes, riz basmati, brocolis": "Ingrédients (1 pers.) : 150g de crevettes, 60g de riz basmati cru, 150g de brocolis\n\nPréparation :\n1. Cuire le riz basmati selon le paquet.\n2. Cuire les brocolis à la vapeur 8-10 min.\n3. Faire sauter les crevettes 2-3 min et servir ensemble.",
  "Truite, épinards": "Ingrédients (1 pers.) : 150g de filet de truite, 150g d'épinards\n\nPréparation :\n1. Cuire la truite à la poêle ou au four 10-12 min.\n2. Faire tomber les épinards 2-3 min.\n3. Servir ensemble.",
  "Pain complet, avocat, œuf poché": "Ingrédients (1 pers.) : 1-2 tranches de pain complet, 1/2 avocat, 1-2 œufs\n\nPréparation :\n1. Toaster le pain, écraser l'avocat dessus.\n2. Pocher les œufs 3 min dans une eau frémissante vinaigrée.\n3. Déposer les œufs sur l'avocat.",
  "Dinde, lentilles, carottes": "Ingrédients (1 pers.) : 150g de dinde, 70g de lentilles crues, carottes\n\nPréparation :\n1. Cuire les lentilles 20-25 min dans l'eau non salée.\n2. Cuire la dinde 5-6 min par face.\n3. Cuire les carottes à la vapeur et servir ensemble.",
  "Salade César légère, dinde": "Ingrédients (1 pers.) : 150g de dinde, salade verte, 10g de parmesan léger\n\nPréparation :\n1. Cuire la dinde 5-6 min par face, la trancher.\n2. Préparer une sauce légère au yaourt, citron et moutarde.\n3. Assembler la salade avec la dinde, la sauce et le parmesan.",
  "Yaourt grec, fruits rouges, granola": "Ingrédients (1 pers.) : 150g de yaourt grec, fruits rouges, 30g de granola\n\nPréparation :\n1. Verser le yaourt grec dans un bol.\n2. Ajouter les fruits rouges.\n3. Garnir de granola juste avant de servir.",
  "Saumon, semoule complète, courgettes": "Ingrédients (1 pers.) : 150g de saumon, 60g de semoule complète crue, 1 courgette\n\nPréparation :\n1. Faire gonfler la semoule dans l'eau bouillante hors du feu 5 min.\n2. Cuire le saumon 10-12 min.\n3. Faire sauter la courgette et servir ensemble.",
  "Cabillaud, courgettes vapeur": "Ingrédients (1 pers.) : 150g de cabillaud, 1-2 courgettes\n\nPréparation :\n1. Cuire les courgettes à la vapeur 10-12 min.\n2. Cuire le cabillaud à la vapeur ou à la poêle 8-10 min.\n3. Servir ensemble avec un filet d'huile.",
};

function generateRecipesText(weekIndex){
  const week = WEEKLY_MENUS[weekIndex];
  let out = `RECETTES — ${week.name}\n`;
  out += `Quantités données pour 1 personne — multiplie selon le nombre de convives.\n\n`;
  week.days.forEach(d => {
    ["breakfast","lunch","dinner"].forEach(slot => {
      const meal = d[slot];
      const slotLabel = slot === "breakfast" ? "Petit-déjeuner" : slot === "lunch" ? "Déjeuner" : "Dîner";
      out += `=== ${d.day} — ${slotLabel} : ${meal.name} ===\n`;
      out += (RECIPES[meal.name] || "Recette non disponible.") + "\n\n";
    });
  });
  out += `— Saga du Viking —\n`;
  return out;
}