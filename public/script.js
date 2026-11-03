// 1. Récupérer les éléments de la page
const formulaire = document.getElementById("form-reservation");
const message = document.getElementById("message");
const liste = document.getElementById("liste-reservations");

// Adresse de l'API (même serveur que la page, donc chemin relatif)
const API = "/api/reservations";

// 2. Afficher un message de succès ou d'erreur
function afficherMessage(texte, type) {
  message.textContent = texte;
  message.className = type;
}

// 3. Demander la liste au serveur (GET), puis l'afficher
async function chargerReservations() {
  try {
    const reponse = await fetch(API);
    const reservations = await reponse.json();

    liste.innerHTML = "";

    if (reservations.length === 0) {
      liste.innerHTML = "<li>Aucune réservation pour l'instant.</li>";
      return;
    }

    for (const r of reservations) {
      const ligne = document.createElement("li");
      // textContent (et pas innerHTML) : un nom contenant du code HTML
      // sera affiché comme du texte, sans être exécuté
      ligne.textContent = `${r.date} à ${r.heure} – ${r.nom} (${r.prestation})`;
      liste.appendChild(ligne);
    }
  } catch (erreur) {
    afficherMessage("Impossible de joindre le serveur.", "erreur");
  }
}

// 4. Quand on envoie le formulaire : envoyer la réservation au serveur (POST)
formulaire.addEventListener("submit", async function (evenement) {
  evenement.preventDefault(); // empêche le rechargement de la page

  const nouvelle = {
    nom: document.getElementById("nom").value.trim(),
    telephone: document.getElementById("telephone").value.trim(),
    prestation: document.getElementById("prestation").value,
    date: document.getElementById("date").value,
    heure: document.getElementById("heure").value,
  };

  // Vérification rapide côté navigateur, pour un retour immédiat.
  // Ce n'est qu'un confort : la vraie vérification est faite par le serveur.
  const aujourdhui = new Date().toISOString().slice(0, 10);
  if (nouvelle.date < aujourdhui) {
    afficherMessage("Impossible de réserver une date passée.", "erreur");
    return;
  }

  try {
    const reponse = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nouvelle),
    });
    const resultat = await reponse.json();

    // reponse.ok vaut true pour les codes 200 à 299 (ici 201)
    if (!reponse.ok) {
      afficherMessage(resultat.erreur, "erreur");
      return;
    }

    afficherMessage(resultat.message, "succes");
    formulaire.reset();
    chargerReservations();
  } catch (erreur) {
    afficherMessage("Impossible de joindre le serveur.", "erreur");
  }
});

// 5. Au chargement de la page, afficher ce qui existe déjà
chargerReservations();
