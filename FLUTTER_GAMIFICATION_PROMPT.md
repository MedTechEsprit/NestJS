# 📱 Flutter Frontend - Système de Gamification Pharmacien
## Document Complet pour Agent AI Android Studio

---

## 🎯 OBJECTIF PRINCIPAL

Intégrer le système de points de gamification dans le dashboard Flutter de la pharmacie. Ce système doit:
- Afficher les points accumulés en temps réel
- Afficher les badges gagnés (⭐Fiable, 🔥Réactif, 👑Excellence)
- Montrer une pop-up interactive à chaque action pour afficher les points gagnés
- Consommer toutes les APIs backend de gamification
- Synchroniser le dashboard avec les données en base de données

---

## 📚 CONTEXTE BACKEND - APIs GAMIFICATION

### **Version Backend Déployée**
- **URL Base**: `http://localhost:3000/api`
- **Token Auth**: Header `Authorization: Bearer {token}`
- **Schéma**: NestJS + MongoDB

### **Endpoints Disponibles à Consommer**

#### **1️⃣ Répondre à une Demande (Avec Points)**
```
Endpoint: PUT /medication-request/:id/respond
Authentification: Bearer token (PHARMACIEN)
Headers: Content-Type: application/json

Request Body:
{
  "pharmacyId": "string (ObjectId)",
  "status": "accepted" | "unavailable" | "declined" | "ignored",
  "indicativePrice": number (optional),
  "preparationDelay": "immediate" | "30min" | "1h" | "2h" | "other",
  "pharmacyMessage": "string (optional)",
  "pickupDeadline": "ISO datetime (optional)"
}

Response: MedicationRequest object with embedded points calculation:
{
  "pharmacyResponses": [
    {
      "pharmacyId": "...",
      "status": "accepted",
      "pointsAwarded": 30,
      "responseTime": 1,
      "pointsBreakdown": {
        "basePoints": 10,
        "bonusPoints": 20,
        "reason": "Réponse Disponible en 1min"
      },
      "respondedAt": "ISO datetime"
    }
  ]
}

Points Calculation Logic:
- "accepted" (Disponible):
  * Base: +10 pts
  * < 30 min: +20 bonus (Total: 30)
  * 30-60 min: +15 bonus (Total: 25)
  * 60-120 min: +5 bonus (Total: 15)
  * > 120 min: 0 bonus (Total: 10)

- "unavailable" (Non Disponible): +5 pts (toujours)

- "declined" (Rejet): 0 pts

- "ignored": 0 pts
```

---

#### **2️⃣ Créer une Évaluation Client (Rating)**
```
Endpoint: POST /ratings
Authentification: Not required (Patient évalue)
Headers: Content-Type: application/json

Request Body:
{
  "patientId": "string (ObjectId)",
  "pharmacyId": "string (ObjectId)",
  "medicationRequestId": "string (ObjectId)",
  "stars": 1-5,
  "comment": "string (optional)",
  "medicationAvailable": boolean,
  "speedRating": 1-5 (optional),
  "courtesynRating": 1-5 (optional)
}

Points Awarded:
- 5 stars: +25 pts
- 4 stars: +15 pts
- 3 stars: +5 pts
- 2 stars: 0 pts
- 1 star: -10 pts (PÉNALITÉ)

Penalty:
- Si medicationAvailable = false: -10 pts supplémentaires

Response:
{
  "_id": "...",
  "pharmacyId": "...",
  "stars": 5,
  "pointsAwarded": 25,
  "penaltyApplied": 0,
  "createdAt": "ISO datetime"
}
```

---

#### **3️⃣ Récupérer Stats Complètes de Points (Dashboard)**
```
Endpoint: GET /pharmaciens/:id/points/stats
Authentification: Bearer token (PHARMACIEN)
Parameters: 
  - id: pharmacy ObjectId

Response:
{
  "currentPoints": 150,
  "badge": {
    "name": "reactif",
    "emoji": "🔥",
    "description": "Réactif - Répond très rapidement"
  },
  "ranking": {
    "rank": 5,
    "totalPharmacies": 50,
    "percentile": 85
  },
  "statistics": {
    "totalRequests": 10,
    "totalAccepted": 8,
    "totalDeclined": 2,
    "acceptanceRate": 80,
    "averageResponseTime": 12,
    "totalClients": 6,
    "averageRating": 4.5,
    "totalReviews": 4
  },
  "today": {
    "pointsEarned": 30,
    "activitiesCount": 1
  },
  "unlockedBadges": ["bronze", "fiable"],
  "badgeThresholds": [
    {
      "badge": "aucun",
      "emoji": "",
      "minPoints": 0,
      "maxPoints": 49,
      "description": "Pas de badge"
    },
    {
      "badge": "fiable",
      "emoji": "⭐",
      "minPoints": 50,
      "maxPoints": 99,
      "description": "Fiable - Répond régulièrement"
    },
    {
      "badge": "reactif",
      "emoji": "🔥",
      "minPoints": 100,
      "maxPoints": 199,
      "description": "Réactif - Répond très rapidement"
    },
    {
      "badge": "excellence",
      "emoji": "👑",
      "minPoints": 200,
      "maxPoints": "Infinity",
      "description": "Excellence - Pharmacie de premier choix"
    }
  ]
}
```

---

#### **4️⃣ Récupérer Ranking (Position Classement)**
```
Endpoint: GET /pharmaciens/:id/points/ranking
Authentification: Bearer token (PHARMACIEN)
Parameters:
  - id: pharmacy ObjectId

Response:
{
  "pharmacyId": "...",
  "rank": 5,
  "totalPharmacies": 50,
  "percentile": 85,
  "points": 150,
  "nomPharmacie": "Pharmacie Centrale"
}
```

---

#### **5️⃣ Récupérer Historique Points du Jour**
```
Endpoint: GET /pharmaciens/:id/points/history/today
Authentification: Bearer token (PHARMACIEN)
Parameters:
  - id: pharmacy ObjectId

Response: Array of activities
[
  {
    "timestamp": "2026-02-21T21:45:00Z",
    "points": 30,
    "description": "Réponse Disponible en 15min",
    "breakdown": [
      "+10 base",
      "+20 bonus ultra-rapide (< 30 min)"
    ]
  },
  {
    "timestamp": "2026-02-21T22:10:00Z",
    "points": 5,
    "description": "Réponse Non Disponible",
    "breakdown": [
      "+5 points (réponse rapide et honnête)"
    ]
  }
]
```

---

#### **6️⃣ Récupérer Tous les Seuils de Badges**
```
Endpoint: GET /pharmaciens/points/badges
Authentification: Public (no auth required)

Response: Array of badge thresholds
[
  {
    "badge": "aucun",
    "emoji": "",
    "minPoints": 0,
    "maxPoints": 49,
    "description": "Pas de badge"
  },
  {
    "badge": "fiable",
    "emoji": "⭐",
    "minPoints": 50,
    "maxPoints": 99,
    "description": "Fiable - Répond régulièrement"
  },
  {
    "badge": "reactif",
    "emoji": "🔥",
    "minPoints": 100,
    "maxPoints": 199,
    "description": "Réactif - Répond très rapidement"
  },
  {
    "badge": "excellence",
    "emoji": "👑",
    "minPoints": 200,
    "maxPoints": Infinity,
    "description": "Excellence - Pharmacie de premier choix"
  }
]
```

---

## 🎨 UI/UX REQUIREMENTS

### **1. Dashboard Pharmacien - Modifications**

**Section Haute (Déjà Existante)**
```
┌─────────────────────────────────────┐
│  Pharmacie Centrale                 │
│  💎 30 points    [Hors ligne]       │
│  ⭐ Badge: Fiable                   │
│  Ranking: #5 / 50 (Percentile: 85%) │
└─────────────────────────────────────┘
```

**NEW: Section Points & Progression**
```
┌─────────────────────────────────────┐
│  📊 POINTS & BADGES                 │
├─────────────────────────────────────┤
│  Current Badge: ⭐ Fiable (50-99)   │
│  Progress: [████████░░░] 75/100     │
│  Next Badge: 🔥 Réactif             │
│  Points to Next: 25 points needed   │
│                                     │
│  Today's Earnings: +30 pts (1 action)
│                                     │
│  UNLOCKED BADGES:                   │
│  ☑️ Bronze (0-49)                   │
│  ☑️ Fiable ⭐ (50-99)               │
│  ☐ Réactif 🔥 (100-199)            │
│  ☐ Excellence 👑 (200+)            │
└─────────────────────────────────────┘
```

**NEW: Section Ranking & Statistics**
```
┌─────────────────────────────────────┐
│  🏆 RANKING & PERFORMANCE           │
├─────────────────────────────────────┤
│  Your Rank: #5 / 50 pharmacies      │
│  Percentile: Top 85%                │
│                                     │
│  Acceptance Rate: 80% (8/10)        │
│  Avg Response Time: 12 mins         │
│  Avg Rating: ⭐4.5 (4 reviews)      │
│  Total Clients: 6                   │
└─────────────────────────────────────┘
```

### **2. Action Buttons - Avec Pop-up Interactive**

**Current Buttons (Existing)**
```
┌─────────────────────────┐
│  [✓ Disponible]         │
│  [⏸ Non Disponible]     │
│  [✕ Refuser]            │
└─────────────────────────┘
```

**NEW: Pop-up Après Action**
```
╔════════════════════════════════════╗
║         🎉 POINTS GAGNÉS! 🎉       ║
╠════════════════════════════════════╣
║                                    ║
║  Action: Médicament Disponible      ║
║  Response Time: 1 minute            ║
║                                    ║
║  ┌──────────────────────────────┐  ║
║  │ Breakdown:                   │  ║
║  │ • Base Points: +10           │  ║
║  │ • Ultra-Fast Bonus: +20      │  ║
║  │ ───────────────────────      │  ║
║  │ TOTAL: +30 points ✨         │  ║
║  └──────────────────────────────┘  ║
║                                    ║
║  Points Progression:               ║
║  Before: 150 → After: 180 ⭐      │
║                                    ║
║  [✓ FERMER]                        │
╚════════════════════════════════════╝
```

### **3. Pop-up Variants par Action**

**Variante A: Disponible (Accepted)**
```
POINTS GAGNÉS: +30 ✨
Breakdown:
- Base: +10 (Répondre)
- Bonus: +20 (< 30 min ultra-rapide)
```

**Variante B: Non Disponible (Unavailable)**
```
POINTS GAGNÉS: +5 ✅
Breakdown:
- Response: +5 (Réponse honnête)
```

**Variante C: Refuser (Declined)**
```
Pas de points pour cette action (0 pts)
```

**Variante D: Rating Reçu (Bonus)**
```
ÉVALUATION REÇUE ⭐⭐⭐⭐⭐
POINTS GAGNÉS: +25 💎
Breakdown:
- 5 Stars Rating: +25
```

**Variante E: Pénalité (Medication Not Found)**
```
⚠️ PÉNALITÉ APPLIQUÉE
Points Perdus: -10 ❌
Raison: Médicament non trouvé après confirmation
```

---

## 💻 IMPLEMENTATION CHECKLIST

### **Phase 1: Dashboard Integration**
- [ ] Créer un service `GamificationService` pour appeler les APIs
- [ ] Ajouter les models/classes pour les réponses API
  - `PointsStatsResponse`
  - `RankingResponse`
  - `BadgeThreshold`
  - `PointsHistoryItem`
  - `RatingResponse`
- [ ] Intégrer `GET /pharmaciens/:id/points/stats` au chargement du dashboard
- [ ] Afficher les points actuels en haut du dashboard
- [ ] Afficher le badge actuel avec emoji et description
- [ ] Afficher le ranking (position et percentile)
- [ ] Créer la section "Badge Progression" avec barre de progression
- [ ] Afficher la liste des badges débloqués

### **Phase 2: Pop-up Interactive**
- [ ] Créer un widget `PointsEarnedDialog` réutilisable
- [ ] Afficher breakdown détaillé des points
- [ ] Afficher avant/après progression
- [ ] Gérer les 5 variantes (Disponible, Non Disponible, Refuser, Rating, Pénalité)
- [ ] Animation d'apparition de la pop-up
- [ ] Auto-fermeture après 3 secondes (optionnel) ou bouton fermer

### **Phase 3: Action Buttons Integration**
- [ ] Modifier les boutons "Répondre à demande" existants
- [ ] Ajouter l'appel API `PUT /medication-request/:id/respond` aux boutons
- [ ] Extraire les données de réponse (pointsAwarded, pointsBreakdown, responseTime)
- [ ] Afficher la pop-up avec les points gagnés
- [ ] Rafraîchir le dashboard après action
- [ ] Gérer les erreurs d'API

### **Phase 4: Real-time Updates**
- [ ] Rafraîchir le dashboard automatiquement après une action
- [ ] Mettre à jour les points affichés en haut
- [ ] Mettre à jour la progression badge si seuil atteint
- [ ] Mettre à jour le ranking en temps réel
- [ ] Animation de transition pour les changements de badge

### **Phase 5: Additional Features**
- [ ] Afficher l'historique des points du jour (bottom sheet/modal)
- [ ] Intégrer les ratings reçus (si client évalue la pharmacie)
- [ ] Notification push quand nouveau badge débloqué
- [ ] Confetti animation si nouveau badge atteint 🎉
- [ ] Graphique de progression mensuelle (optionnel)

---

## 📡 INTEGRATION FLOW (Code Structure)

### **1. Service Layer (GamificationService)**
```dart
class GamificationService {
  // GET /pharmaciens/:id/points/stats
  Future<PointsStatsResponse> getPointsStats(String pharmacyId);
  
  // GET /pharmaciens/:id/points/ranking
  Future<RankingResponse> getRanking(String pharmacyId);
  
  // GET /pharmaciens/:id/points/history/today
  Future<List<PointsHistoryItem>> getDailyHistory(String pharmacyId);
  
  // PUT /medication-request/:id/respond
  Future<RespondToRequestResponse> respondToRequest(
    String requestId,
    RespondToRequestDto dto,
  );
  
  // POST /ratings
  Future<RatingResponse> createRating(CreateRatingDto dto);
  
  // GET /pharmaciens/points/badges
  Future<List<BadgeThreshold>> getBadgeThresholds();
}
```

### **2. Models/DTOs Required**
```dart
// Responses from APIs
class PointsStatsResponse {
  int currentPoints;
  Badge badge;
  Ranking ranking;
  Statistics statistics;
  TodayStats today;
  List<String> unlockedBadges;
  List<BadgeThreshold> badgeThresholds;
}

class Badge {
  String name;
  String emoji;
  String description;
}

class Ranking {
  int rank;
  int totalPharmacies;
  int percentile;
}

class RankingResponse {
  String pharmacyId;
  int rank;
  int totalPharmacies;
  int percentile;
  int points;
  String nomPharmacie;
}

class BadgeThreshold {
  String badge;
  String emoji;
  int minPoints;
  int maxPoints;
  String description;
}

class PointsHistoryItem {
  DateTime timestamp;
  int points;
  String description;
  List<String> breakdown;
}

// For Actions
class RespondToRequestDto {
  String pharmacyId;
  String status; // "accepted", "unavailable", "declined", "ignored"
  double? indicativePrice;
  String? preparationDelay;
  String? pharmacyMessage;
  DateTime? pickupDeadline;
}

class RespondToRequestResponse {
  String id;
  List<PharmacyResponse> pharmacyResponses;
  // ... other fields
}

class PharmacyResponse {
  String pharmacyId;
  String status;
  int pointsAwarded;
  PointsBreakdown pointsBreakdown;
  int responseTime;
  DateTime respondedAt;
}

class PointsBreakdown {
  int basePoints;
  int bonusPoints;
  String reason;
}

class CreateRatingDto {
  String patientId;
  String pharmacyId;
  String medicationRequestId;
  int stars;
  String? comment;
  bool medicationAvailable;
  int? speedRating;
  int? courtesynRating;
}

class RatingResponse {
  String id;
  String pharmacyId;
  int stars;
  int pointsAwarded;
  int penaltyApplied;
  DateTime createdAt;
}
```

### **3. UI Layer (Widgets)**

```dart
// Main Dashboard Widget
class PharmacyDashboard extends StatefulWidget {
  // Load points stats on init
  // Display all gamification sections
}

// New Widget: Points & Badges Section
class PointsAndBadgesSection extends StatelessWidget {
  final PointsStatsResponse stats;
  // Display current points, badge, progression
}

// New Widget: Badge Progress Bar
class BadgeProgressBar extends StatelessWidget {
  final int currentPoints;
  final int nextBadgeMinPoints;
  final String currentBadgeName;
  final String nextBadgeName;
  final String nextBadgeEmoji;
  // Animated progress bar
}

// New Widget: Unlock Badges Display
class UnlockedBadgesDisplay extends StatelessWidget {
  final List<BadgeThreshold> allBadges;
  final List<String> unlockedBadges;
  // Grid of badges with checkmarks
}

// New Widget: Ranking Card
class RankingCard extends StatelessWidget {
  final RankingResponse ranking;
  // Display rank, percentile, position
}

// New Widget: Points Earned Dialog
class PointsEarnedDialog extends StatefulWidget {
  final String action;
  final int basePoints;
  final int bonusPoints;
  final int totalPoints;
  final int beforePoints;
  final int afterPoints;
  final List<String> breakdown;
  final String? reason;
  final bool isPenalty;
  
  // Show animated dialog with breakdown
  // Auto-close or manual close
}
```

### **4. Integration in Action Buttons**

```dart
// Existing button modified
ElevatedButton(
  onPressed: () async {
    try {
      // Call API
      final response = await gamificationService.respondToRequest(
        requestId,
        RespondToRequestDto(
          pharmacyId: pharmacyId,
          status: "accepted",
          preparationDelay: "immediate",
          // ... other fields
        ),
      );
      
      // Extract points info
      final pharmacy = response.pharmacyResponses.first;
      
      // Show pop-up
      showDialog(
        context: context,
        builder: (context) => PointsEarnedDialog(
          action: "Médicament Disponible",
          basePoints: pharmacy.pointsBreakdown.basePoints,
          bonusPoints: pharmacy.pointsBreakdown.bonusPoints,
          totalPoints: pharmacy.pointsAwarded,
          beforePoints: currentPoints,
          afterPoints: currentPoints + pharmacy.pointsAwarded,
          breakdown: ["Base: +10", "Bonus: +20"],
          reason: pharmacy.pointsBreakdown.reason,
          isPenalty: false,
        ),
      );
      
      // Refresh dashboard
      refreshPointsStats();
      
    } catch (e) {
      // Handle error
      showErrorSnackbar(e.toString());
    }
  },
  child: Text("✓ Disponible"),
)
```

---

## 🔑 KEY IMPLEMENTATION NOTES

### **Critical Requirements**
1. **Always consume the backend APIs** - ne pas utiliser de données statiques
2. **Real-time synchronization** - rafraîchir après chaque action
3. **Error handling** - gérer les timeouts, connexion perdue, etc.
4. **Loading states** - afficher des spinners pendant les appels API
5. **Token management** - utiliser le Bearer token dans tous les appels

### **Performance Considerations**
- Cache les badge thresholds (peu changeants)
- Débounce le rafraîchissement du dashboard (max 1x par 2 secondes)
- Lazy load l'historique des points (infinite scroll optionnel)
- Utilisez `FutureBuilder` et `StreamBuilder` de manière optimale

### **Visual Polish**
- Utiliser des animations Fluent/Material pour les transitions
- Couleurs cohérentes avec le reste de l'app
- Respecter les guidelines Material Design 3
- Icons du package `flutter_icons` pour badges/emojis

### **Testing Checklist** (Avant Release)
- [ ] Tester chaque variant de pop-up (5 cas différents)
- [ ] Vérifier que points augmentent correctement
- [ ] Vérifier que badges débloquent au seuil correct
- [ ] Tester offline mode (graceful degradation)
- [ ] Performance test avec 1000+ transactions
- [ ] Vérifier tout avec données réelles du serveur

---

## 📞 QUESTIONS FRÉQUENTES

**Q: Comment gérer les erreurs API?**
A: Afficher un snackbar avec le message d'erreur, permettre les retry

**Q: Et si l'utilisateur ferme l'app pendant un appel API?**
A: Token refresh + retry automatique au prochain lancement

**Q: Faut-il rafraîchir le dashboard à chaque fois?**
A: Oui, après chaque action (respondToRequest, rating) pour sync les points

**Q: Comment afficher les pénalités?**
A: Même pop-up mais avec icône ⚠️ et couleur rouge, points négatifs

**Q: Peut-on combiner plusieurs actions = pop-up unique?**
A: Non, une action = une pop-up (maintient la clarté UX)

---

## 📋 DELIVERABLES ATTENDUS

1. ✅ Service `GamificationService` avec tous les appels API
2. ✅ Models/DTOs complets et typés
3. ✅ Widget `PointsEarnedDialog` animé et réutilisable
4. ✅ Dashboard enrichi avec:
   - Points actuels affichés
   - Badge actuel + progression
   - Badges débloqués
   - Ranking + position
5. ✅ Integration des boutons d'action avec API
6. ✅ Pop-ups fonctionnelles pour les 5 variantes
7. ✅ Tests unitaires pour GamificationService
8. ✅ Tests d'intégration pour les actions

---

**Version**: 1.0
**Last Updated**: 2026-02-21
**Status**: Ready for Implementation ✅
