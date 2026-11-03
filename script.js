// 1. Récupérer les éléments de la page
const formulaire = document.getElementById("form-reservation");
const message = document.getElementById("message");
const liste = document.getElementById("liste-reservations");

// 2. Charger les réservations déjà enregistrées dans le navigateur
//    (localStorage ne stocke que du texte, d'où JSON.parse)
let reservations = JSON.parse(localStorage.getItem("reservations")) || [];

// 3. Afficher la liste des réservations
function afficherReservations() {
  liste.innerHTML = "";

  if (reservations.length === 0) {
    liste.innerHTML = "<li>Aucune réservation pour l'instant.</li>";
    return;
  }

  for (const r of reservations) {
    const ligne = document.createElement("li");
    ligne.textContent = `${r.date} à ${r.heure} – ${r.nom} (${r.prestation})`;
    liste.appendChild(ligne);
  }
}

// 4. Afficher un message de succès ou d'erreur
function afficherMessage(texte, type) {
  message.textContent = texte;
  message.className = type;
}

// 5. Quand on envoie le formulaire
formulaire.addEventListener("submit", function (evenement) {
  evenement.preventDefault(); // empêche le rechargement de la page

  const nouvelle = {
    nom: document.getElementById("nom").value.trim(),
    telephone: document.getElementById("telephone").value.trim(),
    prestation: document.getElementById("prestation").value,
    date: document.getElementById("date").value,
    heure: document.getElementById("heure").value,
  };

  // Vérification : le créneau est-il déjà pris ?
  const dejaPris = reservations.some(
    (r) => r.date === nouvelle.date && r.heure === nouvelle.heure
  );
  if (dejaPris) {
    afficherMessage("Ce créneau est déjà réservé.", "erreur");
    return;
  }

  // Enregistrer la réservation
  reservations.push(nouvelle);
  localStorage.setItem("reservations", JSON.stringify(reservations));

  afficherMessage("Réservation enregistrée !", "succes");
  formulaire.reset();
  afficherReservations();
});

// 6. Au chargement de la page, afficher ce qui existe déjà
afficherReservations();
