/* =========================================================
   CONFIGURATION FIREBASE — synchronisation en ligne
   =========================================================

   Sans cette configuration, la Saga du Viking fonctionne quand même,
   mais uniquement en local sur cet appareil/navigateur (IndexedDB).

   Pour activer la synchronisation entre appareils, suis ces étapes
   (5 minutes, gratuit, aucune carte bancaire requise) :

   1. Va sur https://console.firebase.google.com
   2. Clique "Ajouter un projet", donne-lui un nom (ex: "saga-du-viking"),
      tu peux désactiver Google Analytics (pas nécessaire).
   3. Dans le menu de gauche du projet : "Compilation" > "Firestore Database"
      > "Créer une base de données" > choisis "Mode test" pour commencer
      (tu pourras restreindre les règles plus tard, voir note en bas).
   4. Toujours dans le projet : clique l'icône ⚙️ (roue crantée) en haut
      à gauche > "Paramètres du projet" > onglet "Général".
   5. Tout en bas de la page, section "Vos applications" : clique
      l'icône Web "</>", donne un surnom à l'app, PAS besoin de configurer
      Firebase Hosting.
   6. Firebase t'affiche un bloc "firebaseConfig = { ... }" :
      copie-colle-le ci-dessous à la place de l'objet firebaseConfig actuel.

   ---------------------------------------------------------
   RÈGLES FIRESTORE (à coller dans l'onglet "Règles" de Firestore) :

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /characters/{code} {
         allow read, write: if true;
       }
     }
   }

   ⚠️ Ces règles sont ouvertes : n'importe qui connaissant un code peut
   lire/modifier la sauvegarde associée. C'est un compromis simple et
   suffisant pour un tracker fitness personnel — garde ton code privé,
   comme un mot de passe. Rien de plus strict n'est nécessaire ici car
   il n'y a pas de compte avec mot de passe dans ce système.
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAPyWeZNsqKjguEDqUsrsqGv0ow9LXVsIE",
  authDomain: "vikingprogram-7e9fb.firebaseapp.com",
  projectId: "vikingprogram-7e9fb",
  storageBucket: "vikingprogram-7e9fb.firebasestorage.app",
  messagingSenderId: "227578269615",
  appId: "1:227578269615:web:0f9ac4a0a5ebfe4800695a"
};

let db;
try{
  if(typeof firebase !== "undefined" && firebaseConfig.apiKey && firebaseConfig.apiKey !== "COLLE_TA_CLE_ICI"){
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  }
}catch(e){
  console.warn("Firebase non configuré ou invalide — la Saga du Viking fonctionne en local uniquement.", e);
}
