// server.js — le serveur de l'app de réservation
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

// Fichier où sont enregistrées les réservations
// (__dirname = dossier de server.js : le fichier est toujours créé au même endroit)
const FICHIER = path.join(__dirname, "reservations.json");

// Mot de passe du coiffeur : lu dans une variable d'environnement,
// jamais écrit dans le code (sinon il finirait sur GitHub).
const MOT_DE_PASSE_ADMIN = process.env.ADMIN_PASSWORD;
if (!MOT_DE_PASSE_ADMIN) {
  console.error("Erreur : définis ADMIN_PASSWORD avant de lancer le serveur.");
  console.error('Exemple : ADMIN_PASSWORD="ton-mot-de-passe" node server.js');
  process.exit(1);
}

// Jetons de connexion valides (gardés en mémoire : un redémarrage déconnecte tout le monde)
const jetonsValides = new Set();

// Règles du salon (le serveur est la seule source de vérité)
const PRESTATIONS = ["Coupe", "Coupe + barbe", "Coloration"];
const HEURES = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];

// --- Lecture et écriture du fichier ---

// Au démarrage : charger les réservations depuis le fichier, s'il existe
function chargerDepuisFichier() {
  if (!fs.existsSync(FICHIER)) {
    return [];
  }
  const texte = fs.readFileSync(FICHIER, "utf-8");
  return JSON.parse(texte);
}

// Après chaque changement : réécrire tout le fichier
function enregistrerDansFichier() {
  // null, 2 : indentation de 2 espaces pour que le fichier reste lisible
  fs.writeFileSync(FICHIER, JSON.stringify(reservations, null, 2));
}

const reservations = chargerDepuisFichier();

// Chaque réservation reçoit un identifiant unique : 1, 2, 3...
// On repart du plus grand id déjà utilisé pour ne jamais en réutiliser un.
let prochainId = reservations.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;

// --- Configuration d'Express ---

// 1. Comprendre le JSON envoyé par le navigateur
app.use(express.json());

// 2. Servir les fichiers du site (index.html, style.css, script.js)
app.use(express.static("public"));

// --- Routes de l'API ---

// 3. GET /api/reservations : renvoyer la liste
app.get("/api/reservations", (req, res) => {
  // On ne renvoie pas le téléphone : inutile d'exposer des données personnelles
  const publiques = reservations.map((r) => ({
    id: r.id,
    nom: r.nom,
    prestation: r.prestation,
    date: r.date,
    heure: r.heure,
  }));
  res.json(publiques);
});

// 4. POST /api/reservations : créer une réservation
app.post("/api/reservations", (req, res) => {
  const { nom, telephone, prestation, date, heure } = req.body;

  // Vérification : tous les champs sont présents
  if (!nom || !telephone || !prestation || !date || !heure) {
    return res.status(400).json({ erreur: "Tous les champs sont obligatoires." });
  }

  // Vérification : la prestation et l'heure font partie des choix autorisés
  if (!PRESTATIONS.includes(prestation) || !HEURES.includes(heure)) {
    return res.status(400).json({ erreur: "Prestation ou heure invalide." });
  }

  // Vérification : la date a bien le format AAAA-MM-JJ
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ erreur: "Format de date invalide." });
  }

  // Vérification : la date n'est pas passée
  const aujourdhui = new Date().toISOString().slice(0, 10);
  if (date < aujourdhui) {
    return res.status(400).json({ erreur: "Impossible de réserver une date passée." });
  }

  // Vérification : le créneau est libre
  const dejaPris = reservations.some((r) => r.date === date && r.heure === heure);
  if (dejaPris) {
    return res.status(409).json({ erreur: "Ce créneau est déjà réservé." });
  }

  const nouvelle = {
    id: prochainId++,
    nom: String(nom).trim(),
    telephone: String(telephone).trim(),
    prestation,
    date,
    heure,
  };
  reservations.push(nouvelle);
  enregistrerDansFichier();

  res.status(201).json({ message: "Réservation enregistrée !", id: nouvelle.id });
});

// --- Partie coiffeur (protégée) ---

// Compare deux textes en temps constant : la durée de la comparaison
// ne révèle pas combien de caractères étaient corrects.
function memesTextes(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Middleware : vérifie le jeton avant de laisser passer la requête
function exigerConnexion(req, res, next) {
  // Le navigateur envoie l'en-tête : "Authorization: Bearer <jeton>"
  const entete = req.headers.authorization || "";
  const jeton = entete.startsWith("Bearer ") ? entete.slice(7) : "";

  if (!jetonsValides.has(jeton)) {
    return res.status(401).json({ erreur: "Connexion requise." });
  }
  next(); // jeton valide : on passe à la route
}

// 5. POST /api/admin/connexion : vérifier le mot de passe, donner un jeton
app.post("/api/admin/connexion", (req, res) => {
  const { motDePasse } = req.body;

  if (!motDePasse || !memesTextes(motDePasse, MOT_DE_PASSE_ADMIN)) {
    return res.status(401).json({ erreur: "Mot de passe incorrect." });
  }

  // 32 octets aléatoires sûrs -> 64 caractères hexadécimaux, impossibles à deviner
  const jeton = crypto.randomBytes(32).toString("hex");
  jetonsValides.add(jeton);
  res.json({ jeton });
});

// 6. POST /api/admin/deconnexion : invalider le jeton
app.post("/api/admin/deconnexion", exigerConnexion, (req, res) => {
  const jeton = req.headers.authorization.slice(7);
  jetonsValides.delete(jeton);
  res.json({ message: "Déconnecté." });
});

// 7. GET /api/admin/reservations : liste complète, avec les téléphones
app.get("/api/admin/reservations", exigerConnexion, (req, res) => {
  res.json(reservations);
});

// 8. DELETE /api/admin/reservations/:id : annuler une réservation
app.delete("/api/admin/reservations/:id", exigerConnexion, (req, res) => {
  const id = Number(req.params.id);
  const index = reservations.findIndex((r) => r.id === id);

  if (index === -1) {
    return res.status(404).json({ erreur: "Réservation introuvable." });
  }

  reservations.splice(index, 1); // retire 1 élément à la position index
  enregistrerDansFichier();
  res.json({ message: "Réservation annulée." });
});

// 9. Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré : http://localhost:${PORT}`);
  console.log(`${reservations.length} réservation(s) chargée(s) depuis ${FICHIER}`);
});
