/**
 * 📱 GUILDE FLUTTER - AFFICHAGE POP-UP POINTS
 * Pour le Agent Flutter/Android Studio
 * 
 * OBJECTIF PRINCIPAL:
 * Afficher un pop-up interactif quand la pharmacie gagne des points
 * ================================================
 */

// ========================================
// 🎯 CE QUE TU DOIS FAIRE (TRÈS SIMPLE!)
// ========================================

/*
ÉTAPE 1: User clique sur "✓ Disponible"
ÉTAPE 2: Tu appelles l'API backend
ÉTAPE 3: Backend retourne les points (Ex: 30)
ÉTAPE 4: ⭐ TU AFFICHES UN DIALOG AVEC LES POINTS ⭐
ÉTAPE 5: Dialog affiche:
         - Gros nombre: +30
         - Breakdown: Base 10 + Bonus 20
         - Raison: "Réponse en 1min"
ÉTAPE 6: User click "FERMER" ou auto-fermeture après 3 sec
ÉTAPE 7: Rafraîchir le dashboard
*/

// ========================================
// 📦 IMPORTS NÉCESSAIRES
// ========================================

import 'package:flutter/material.dart';
import 'package:votre_app/services/medication_service.dart';
import 'package:votre_app/models/respond_to_request_response.dart';

// ========================================
// 🎨 WIDGET POP-UP (À CRÉER)
// ========================================

class PointsEarnedPopup extends StatelessWidget {
  final int pointsAwarded;
  final int basePoints;
  final int bonusPoints;
  final String reasonText;
  final int beforePoints;
  final int afterPoints;

  const PointsEarnedPopup({
    required this.pointsAwarded,
    required this.basePoints,
    required this.bonusPoints,
    required this.reasonText,
    required this.beforePoints,
    required this.afterPoints,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Container(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // TITRE
            Text(
              '🎉 POINTS GAGNÉS! 🎉',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
              textAlign: TextAlign.center,
            ),
            
            SizedBox(height: 24),
            
            // GROS NOMBRE POINTS
            Container(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Text(
                '+$pointsAwarded',
                style: TextStyle(
                  fontSize: 64,
                  fontWeight: FontWeight.bold,
                  color: Colors.green[600],
                ),
              ),
            ),
            
            SizedBox(height: 16),
            
            // BREAKDOWN CARD
            Container(
              padding: EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Breakdown:',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  SizedBox(height: 12),
                  Text('• Base Points: +$basePoints'),
                  Text('• Bonus: +$bonusPoints'),
                  SizedBox(height: 12),
                  Divider(color: Colors.grey[400]),
                  SizedBox(height: 12),
                  Text(
                    reasonText,
                    style: TextStyle(
                      fontSize: 12,
                      fontStyle: FontStyle.italic,
                      color: Colors.grey[700],
                    ),
                  ),
                ],
              ),
            ),
            
            SizedBox(height: 16),
            
            // PROGRESSION
            Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  Column(
                    children: [
                      Text('Avant', style: TextStyle(fontSize: 10)),
                      Text(
                        '$beforePoints',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  Icon(Icons.arrow_forward),
                  Column(
                    children: [
                      Text('Après', style: TextStyle(fontSize: 10)),
                      Text(
                        '$afterPoints',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.green,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            SizedBox(height: 24),
            
            // BOUTON FERMER
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.symmetric(horizontal: 32, vertical: 12),
              ),
              child: Text(
                '✓ FERMER',
                style: TextStyle(fontSize: 16),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ========================================
// 🔧 FONCTION HELPER (À UTILISER)
// ========================================

Future<void> showPointsPopup(
  BuildContext context, {
  required int pointsAwarded,
  required int basePoints,
  required int bonusPoints,
  required String reason,
  required int beforePoints,
  required int afterPoints,
}) {
  return showDialog(
    context: context,
    builder: (context) => PointsEarnedPopup(
      pointsAwarded: pointsAwarded,
      basePoints: basePoints,
      bonusPoints: bonusPoints,
      reasonText: reason,
      beforePoints: beforePoints,
      afterPoints: afterPoints,
    ),
  );
}

// ========================================
// 🎯 CAS 1: CLICK "✓ DISPONIBLE" (Accepted)
// ========================================

ElevatedButton(
  onPressed: () async {
    // Optionnel: Show loading
    showLoadingDialog(context);

    try {
      // 1️⃣ APPEL API
      final MedicationRequestService medicationService = 
          MedicationRequestService(); // ou via Provider/Getx
      
      final response = await medicationService.respondToRequest(
        requestId: widget.requestId,
        pharmacyId: widget.pharmacyId,
        status: 'accepted',  // ← KEY: Status pour "Disponible"
        preparationDelay: 'immediate',
        pharmacyMessage: 'Médicament disponible',
      );

      // 2️⃣ EXTRAIRE LES DONNÉES DE LA RÉPONSE
      final pharmacyResponse = response.pharmacyResponses.first;
      final int pointsAwarded = pharmacyResponse.pointsAwarded;
      final int basePoints = pharmacyResponse.pointsBreakdown.basePoints;
      final int bonusPoints = pharmacyResponse.pointsBreakdown.bonusPoints;
      final String reason = pharmacyResponse.pointsBreakdown.reason;
      
      // Fermer loading
      Navigator.pop(context);
      
      // 3️⃣ ⭐⭐⭐ AFFICHER LE POP-UP ⭐⭐⭐
      await showPointsPopup(
        context,
        pointsAwarded: pointsAwarded,
        basePoints: basePoints,
        bonusPoints: bonusPoints,
        reason: reason,
        beforePoints: 150,  // À récupérer depuis le state/provider
        afterPoints: 150 + pointsAwarded,
      );

      // 4️⃣ RAFRAÎCHIR LE DASHBOARD
      // (setState, ou refresh le FutureBuilder)
      setState(() {
        // Recharger les stats
      });

    } catch (e) {
      Navigator.pop(context); // Fermer loading si erreur
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erreur: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  },
  style: ElevatedButton.styleFrom(
    backgroundColor: Colors.green,
  ),
  child: Text(
    '✓ Disponible',
    style: TextStyle(color: Colors.white),
  ),
)

// ========================================
// 🎯 CAS 2: CLICK "⏸ NON DISPONIBLE" (Unavailable)
// ========================================

ElevatedButton(
  onPressed: () async {
    showLoadingDialog(context);

    try {
      final medicationService = MedicationRequestService();
      
      final response = await medicationService.respondToRequest(
        requestId: widget.requestId,
        pharmacyId: widget.pharmacyId,
        status: 'unavailable',  // ← KEY: Status pour "Non Disponible"
      );

      final pharmacyResponse = response.pharmacyResponses.first;
      Navigator.pop(context);

      // Afficher le pop-up (5 points seulement, pas de bonus)
      await showPointsPopup(
        context,
        pointsAwarded: 5,
        basePoints: 5,
        bonusPoints: 0,
        reason: 'Réponse rapide et honnête',
        beforePoints: 150,
        afterPoints: 155,
      );

      setState(() {});

    } catch (e) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e')),
      );
    }
  },
  style: ElevatedButton.styleFrom(
    backgroundColor: Colors.orange,
  ),
  child: Text(
    '⏸ Non Disponible',
    style: TextStyle(color: Colors.white),
  ),
)

// ========================================
// 🎯 CAS 3: CLICK "✕ REFUSER" (Declined)
// ========================================

ElevatedButton(
  onPressed: () async {
    showLoadingDialog(context);

    try {
      final medicationService = MedicationRequestService();
      
      final response = await medicationService.respondToRequest(
        requestId: widget.requestId,
        pharmacyId: widget.pharmacyId,
        status: 'declined',  // ← KEY: Status pour "Refuser"
      );

      Navigator.pop(context);

      // Pas de points pour refuser, mais afficher un message
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Demande Refusée ✕'),
          content: Text('Pas de points pour cette action'),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              child: Text('OK'),
            ),
          ],
        ),
      );

      setState(() {});

    } catch (e) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e')),
      );
    }
  },
  style: ElevatedButton.styleFrom(
    backgroundColor: Colors.red,
  ),
  child: Text(
    '✕ Refuser',
    style: TextStyle(color: Colors.white),
  ),
)

// ========================================
// 📋 CHECKLIST AVANT DE CODER
// ========================================

/*
VÉRIFICATIONS ESSENTIELLES:

Backend:
  ☐ API PUT /medication-request/:id/respond fonctionne
  ☐ Retourne pointsAwarded dans la réponse
  ☐ Retourne pointsBreakdown avec basePoints, bonusPoints, reason
  ☐ Points varient selon le status ("accepted" vs "unavailable" vs "declined")

Frontend:
  ☐ Tu crées le widget PointsEarnedPopup
  ☐ Tu crées la fonction showPointsPopup
  ☐ Chaque bouton d'action appelle l'API
  ☐ Chaque API retourne extraits les points de la réponse
  ☐ Tu affiches le pop-up avec showPointsPopup()
  ☐ Tu fermes le pop-up après click
  ☐ Tu rafraîchis le dashboard après

Cas d'Erreur:
  ☐ Try-catch sur chaque appel API
  ☐ Afficher un snackbar d'erreur
  ☐ Fermer le loading dialog si erreur
  ☐ Ne PAS planter l'app si API timeout

*/

// ========================================
// 🚨 CONSEILS IMPORTANTS
// ========================================

/*
1. L'API retourne TOUJOURS les points:
   - "accepted" → 10-30 points (selon temps)
   - "unavailable" → 5 points
   - "declined" → 0 points

2. TU DOIS UTILISER LES POINTS DE LA RÉPONSE:
   ✅ Bon:
   final pointsAwarded = response.pharmacyResponses.first.pointsAwarded;
   showPointsPopup(context, pointsAwarded: pointsAwarded, ...);
   
   ❌ Mauvais:
   final pointsAwarded = 30; // D'où ça vient??
   showPointsPopup(context, pointsAwarded: pointsAwarded, ...);

3. TOUJOURS AFFICHER LE POP-UP:
   ✅ Appel API → Extract data → Show dialog
   ❌ Appel API → Oublie le dialog → User voit rien

4. FERMER LE POP-UP:
   - Après click sur "FERMER"
   - Ou auto-fermeture après 3 sec
   - Puis rafraîchir le dashboard

5. ANIMATION (Optionnel mais nice):
   - FadeIn/ScaleIn pour l'apparition
   - Confetti si points élevés
   - Couleur verte pour gains, rouge pour pénalités
*/

// ========================================
// RÉSUMÉ EN UNE PHRASE
// ========================================

/*
BACKEND CALCULE & RETOURNE LES POINTS ✅
FLUTTER DOIT AFFICHER UN DIALOG AVEC CES POINTS ⭐
*/

