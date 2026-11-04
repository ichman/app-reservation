// 1. Récupérer les éléments de la page
const ecranConnexion = document.getElementById("ecran-connexion");
const ecranReservations = document.getElementById("ecran-reservations");
const formConnexion = document.getElementById("form-connexion");
const messageConnexion = document.getElementById("message-connexion");
const messageAdmin = document.getElementById("message-admin");
const liste = document.getElementById("liste-admin");
const boutonDeconnexion = document.getElementById("bouton-deconnexion");

// 2. Le jeton reçu du serveur, gardé le temps de l'onglet
//    (sessionStorage : effacé quand on ferme l'onglet)
let jeton = sessionStorage.getItem("jeton");

// 3. Envoyer une requête au serveur en montrant le jeton
async function requeteAdmin(adresse, options = {}) {
  const reponse = await fetch(adresse, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${jeton}` },
  });

  // Jeton refusé (expiré, serveur redémarré…) : retour à l'écran de connexion
  if (reponse.status === 401) {
    seDeconnecterLocalement();
    throw new Error("Connexion requise.");
  }
  return reponse;
}

// 4. Basculer entre les deux écrans
function afficherEcran(connecte) {
  ecranConnexion.hidden = connecte;
  ecranReservations.hidden = !connecte;
}

function seDeconnecterLocalement() {
  jeton = null;
  sessionStorage.removeItem("jeton");
  afficherEcran(false);
}

// 5. Charger et afficher toutes les réservations, avec un bouton Annuler
async function chargerReservations() {
  try {
    const reponse = await requeteAdmin("/api/admin/reservations");
    const reservations = await reponse.json();

    // Trier par date puis par heure (comparaison de textes, comme avant)
    reservations.sort((a, b) =>
      (a.date + a.heure).localeCompare(b.date + b.heure)
    );

    liste.innerHTML = "";
    if (reservations.length === 0) {
      liste.innerHTML = "<li>Aucune réservation.</li>";
      return;
    }

    for (const r of reservations) {
      const ligne = document.createElement("li");

      const texte = document.createElement("span");
      texte.textContent =
        `${r.date} à ${r.heure} – ${r.nom} (${r.prestation}) – ${r.telephone}`;

      const bouton = document.createElement("button");
      bouton.textContent = "Annuler";
      bouton.className = "petit";
      bouton.addEventListener("click", () => annuler(r));

      ligne.append(texte, bouton);
      liste.appendChild(ligne);
    }
  } catch (erreur) {
    // déjà géré dans requeteAdmin pour le cas 401
  }
}

// 6. Annuler une réservation (après confirmation)
async function annuler(r) {
  const ok = confirm(`Annuler la réservation de ${r.nom} le ${r.date} à ${r.heure} ?`);
  if (!ok) return;

  try {
    const reponse = await requeteAdmin(`/api/admin/reservations/${r.id}`, {
      method: "DELETE",
    });
    const resultat = await reponse.json();
    messageAdmin.textContent = resultat.message || resultat.erreur;
    messageAdmin.className = reponse.ok ? "succes" : "erreur";
    chargerReservations();
  } catch (erreur) {
    // déjà géré
  }
}

// 7. Connexion
formConnexion.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const motDePasse = document.getElementById("mot-de-passe").value;

  try {
    const reponse = await fetch("/api/admin/connexion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motDePasse }),
    });
    const resultat = await reponse.json();

    if (!reponse.ok) {
      messageConnexion.textContent = resultat.erreur;
      messageConnexion.className = "erreur";
      return;
    }

    jeton = resultat.jeton;
    sessionStorage.setItem("jeton", jeton);
    formConnexion.reset();
    messageConnexion.textContent = "";
    afficherEcran(true);
    chargerReservations();
  } catch (erreur) {
    messageConnexion.textContent = "Impossible de joindre le serveur.";
    messageConnexion.className = "erreur";
  }
});

// 8. Déconnexion
boutonDeconnexion.addEventListener("click", async () => {
  try {
    await requeteAdmin("/api/admin/deconnexion", { method: "POST" });
  } catch (erreur) {
    // même si le serveur ne répond pas, on se déconnecte côté page
  }
  seDeconnecterLocalement();
});

// 9. Au chargement : si on a déjà un jeton, on tente d'afficher les réservations
if (jeton) {
  afficherEcran(true);
  chargerReservations();
} else {
  afficherEcran(false);
}
