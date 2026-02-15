# 🎯 Guide API Flutter - DiabCare Pharmacie

## 📱 Configuration de Base

```dart
// Base URL pour émulateur Android
const String baseUrl = 'http://10.0.2.2:3001/api';

// Storage keys
const String tokenKey = 'pharmacy_token';
const String pharmacyIdKey = 'pharmacy_id';
```

---

## 🔐 1. AUTHENTIFICATION

### Login
```dart
POST /api/auth/login

Body:
{
  "email": "syrine@gmail.com",
  "motDePasse": "votre_password"
}

Response:
{
  "user": { "_id": "...", "role": "PHARMACIEN", ... },
  "accessToken": "eyJhbGc..."  // ⚠️ Pas "access_token"
}

// Stockage:
await storage.write(key: 'pharmacy_token', value: response['accessToken']);
await storage.write(key: 'pharmacy_id', value: response['user']['_id']);
```

---

## 💊 2. DEMANDES DE MÉDICAMENTS

### 2.1 Liste des demandes en attente
```dart
GET /api/medication-request/pharmacy/{pharmacyId}/pending

Headers:
  Authorization: Bearer {token}

Response: Array direct [...]
[
  {
    "_id": "69922de4...",
    "medicationName": "Metformine 850mg",
    "dosage": "850mg",
    "quantity": 90,
    "urgencyLevel": "urgent",  // "normal" | "urgent" | "très urgent"
    "patientNote": "Besoin urgent...",
    "expiresAt": "2026-02-15T22:34:44.639Z",
    "pharmacyResponses": [
      {
        "pharmacyId": "69910c81...",
        "status": "pending"
      }
    ]
  }
]
```

### 2.2 Accepter une demande ✅ (+15 à +28 points)
```dart
PUT /api/medication-request/{requestId}/respond

Headers:
  Authorization: Bearer {token}

Body:
{
  "pharmacyId": "69910c81599fdacc840728aa",
  "status": "accepted",
  "indicativePrice": 125.50,  // Obligatoire si accepted
  "preparationDelay": "immediate",  // "immediate" | "30min" | "1h" | "2h"
  "pharmacyMessage": "Disponible, venez le chercher"
}

Points gagnés:
- Base: +5 (réponse)
- Acceptation: +10
- Bonus urgent (< 30min): +15
- Bonus rapide (< 15min): +3
TOTAL: 5 + 10 + 15 + 3 = 33 points max
```

### 2.3 Refuser une demande ❌ (+5 points)
```dart
PUT /api/medication-request/{requestId}/respond

Body:
{
  "pharmacyId": "69910c81599fdacc840728aa",
  "status": "declined",
  "pharmacyMessage": "Médicament non disponible"
}

Points: +5 (réponse uniquement)
```

### 2.4 Historique des demandes
```dart
GET /api/medication-request/pharmacy/{pharmacyId}/history?page=1&limit=20

Response: Objet paginé
{
  "data": [...],
  "total": 10,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

## 📊 3. DASHBOARD & STATISTIQUES

### 3.1 Dashboard complet
```dart
GET /api/pharmaciens/{pharmacyId}/dashboard

Response:
{
  "pharmacy": {
    "points": 45,
    "badgeLevel": "bronze",  // bronze|silver|gold|platinum|diamond
    "totalRequestsReceived": 10,
    "totalRequestsAccepted": 7,
    "averageRating": 4.5
  },
  "stats": {
    "acceptanceRate": 70.0,
    "responseRate": 100,
    "averageResponseTime": 25
  },
  "pendingRequestsCount": 3,
  "badgeProgression": {
    "currentPoints": 45,
    "pointsToNextLevel": 5,
    "nextBadgeName": "silver"
  }
}
```

### 3.2 Statistiques détaillées
```dart
GET /api/pharmaciens/{pharmacyId}/stats

Response:
{
  "totalRequestsReceived": 10,
  "totalRequestsAccepted": 7,
  "acceptanceRate": 70.0,
  "averageResponseTime": 25,
  "averageRating": 4.5
}
```

### 3.3 Statistiques mensuelles
```dart
GET /api/pharmaciens/{pharmacyId}/stats/monthly

Response:
[
  {
    "month": "2026-01",
    "requestsCount": 5,
    "acceptedCount": 4,
    "revenue": 250.00
  }
]
```

---

## 🎯 4. SYSTÈME DE POINTS & BADGES

### Calcul des points
| Action | Points |
|--------|--------|
| Répondre à une demande | +5 |
| Accepter une demande | +10 |
| Réponse rapide urgent (< 30min) | +15 |
| Réponse ultra-rapide (< 15min) | +3 |
| Review 5 étoiles reçu | +8 |
| Pas de réponse (expiration) | -2 |

### Niveaux de badges
| Badge | Points requis |
|-------|---------------|
| 🥉 Bronze | 0 |
| 🥈 Silver | 50 |
| 🥇 Gold | 150 |
| 💎 Platinum | 300 |
| 💎💎 Diamond | 500 |

---

## ⚡ 5. BOOSTS DE VISIBILITÉ

### 5.1 Activer un boost
```dart
POST /api/boost

Body:
{
  "pharmacyId": "69910c81599fdacc840728aa",
  "boostType": "24h",  // "24h" | "week" | "month"
  "radiusKm": 10  // Rayon en km
}

Response:
{
  "boost": {
    "_id": "...",
    "boostType": "24h",
    "expiresAt": "2026-02-16T10:00:00Z"
  }
}
```

### 5.2 Boosts actifs
```dart
GET /api/boost/pharmacy/{pharmacyId}/active

Response:
[
  {
    "boostType": "24h",
    "expiresAt": "2026-02-16T10:00:00Z",
    "radiusKm": 10
  }
]
```

---

## 🎬 6. ACTIVITÉS RÉCENTES

### Fil d'activité
```dart
GET /api/activities/pharmacy/{pharmacyId}/feed?limit=10

Response:
[
  {
    "activityType": "request_accepted",  // Types: request_accepted, request_declined, points_earned, badge_unlocked, boost_activated
    "description": "Demande acceptée: Metformine 850mg",
    "points": 15,
    "createdAt": "2026-02-15T14:30:00Z",
    "relativeTime": "Il y a 2h"
  }
]
```

---

## ⭐ 7. AVIS & ÉVALUATIONS

### 7.1 Liste des avis
```dart
GET /api/review/pharmacy/{pharmacyId}?page=1

Response:
{
  "data": [
    {
      "rating": 5,
      "comment": "Excellent service",
      "createdAt": "2026-02-10T10:00:00Z"
    }
  ]
}
```

### 7.2 Résumé des évaluations
```dart
GET /api/review/pharmacy/{pharmacyId}/summary

Response:
{
  "averageRating": 4.5,
  "totalReviews": 25,
  "ratingDistribution": {
    "5": 15,
    "4": 7,
    "3": 2,
    "2": 1,
    "1": 0
  }
}
```

---

## 🔧 8. PARAMÈTRES DE LA PHARMACIE

### 8.1 Modifier les horaires
```dart
PUT /api/pharmaciens/{pharmacyId}/working-hours

Body:
{
  "monday": { "open": "08:00", "close": "20:00", "isOpen": true },
  "tuesday": { "open": "08:00", "close": "20:00", "isOpen": true },
  ...
}
```

### 8.2 Activer/désactiver le service de garde
```dart
PUT /api/pharmaciens/{pharmacyId}/duty

Body:
{
  "isOnDuty": true
}
```

### 8.3 Paramètres de notification
```dart
PUT /api/pharmaciens/{pharmacyId}/settings

Body:
{
  "notificationsPush": true,
  "notificationsEmail": false,
  "notificationsSMS": true,
  "visibilityRadius": 15
}
```

---

## 🧪 9. TESTING - DONNÉES DISPONIBLES

### Compte de test
```
Email: syrine@gmail.com
Password: [votre mot de passe]
Pharmacy ID: 69910c81599fdacc840728aa
```

### Demandes de test (4 disponibles)
- Metformine 850mg (urgent)
- Insuline Lantus (très urgent)  
- Glucophage XR (normal)
- Demande personnalisée (normal)

---

## 🔍 10. CODE FLUTTER EXEMPLE COMPLET

### Service API complet
```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class PharmacyApiService {
  static const String baseUrl = 'http://10.0.2.2:3001/api';
  final storage = FlutterSecureStorage();

  // Headers avec token
  Future<Map<String, String>> _headers() async {
    final token = await storage.read(key: 'pharmacy_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  // GET Pending Requests
  Future<List<dynamic>> getPendingRequests() async {
    final pharmacyId = await storage.read(key: 'pharmacy_id');
    final response = await http.get(
      Uri.parse('$baseUrl/medication-request/pharmacy/$pharmacyId/pending'),
      headers: await _headers(),
    );
    
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as List;
    }
    throw Exception('Erreur ${response.statusCode}');
  }

  // POST Accept Request
  Future<bool> acceptRequest({
    required String requestId,
    required double price,
    required String delay,
    String? message,
  }) async {
    final pharmacyId = await storage.read(key: 'pharmacy_id');
    final response = await http.put(
      Uri.parse('$baseUrl/medication-request/$requestId/respond'),
      headers: await _headers(),
      body: jsonEncode({
        'pharmacyId': pharmacyId,
        'status': 'accepted',
        'indicativePrice': price,
        'preparationDelay': delay,
        'pharmacyMessage': message,
      }),
    );
    
    return response.statusCode == 200;
  }

  // POST Decline Request
  Future<bool> declineRequest(String requestId, String message) async {
    final pharmacyId = await storage.read(key: 'pharmacy_id');
    final response = await http.put(
      Uri.parse('$baseUrl/medication-request/$requestId/respond'),
      headers: await _headers(),
      body: jsonEncode({
        'pharmacyId': pharmacyId,
        'status': 'declined',
        'pharmacyMessage': message,
      }),
    );
    
    return response.statusCode == 200;
  }

  // GET Dashboard
  Future<Map<String, dynamic>> getDashboard() async {
    final pharmacyId = await storage.read(key: 'pharmacy_id');
    final response = await http.get(
      Uri.parse('$baseUrl/pharmaciens/$pharmacyId/dashboard'),
      headers: await _headers(),
    );
    
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Erreur ${response.statusCode}');
  }

  // POST Activate Boost
  Future<bool> activateBoost(String type, int radiusKm) async {
    final pharmacyId = await storage.read(key: 'pharmacy_id');
    final response = await http.post(
      Uri.parse('$baseUrl/boost'),
      headers: await _headers(),
      body: jsonEncode({
        'pharmacyId': pharmacyId,
        'boostType': type,
        'radiusKm': radiusKm,
      }),
    );
    
    return response.statusCode == 201;
  }

  // GET Activity Feed
  Future<List<dynamic>> getActivityFeed() async {
    final pharmacyId = await storage.read(key: 'pharmacy_id');
    final response = await http.get(
      Uri.parse('$baseUrl/activities/pharmacy/$pharmacyId/feed?limit=10'),
      headers: await _headers(),
    );
    
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as List;
    }
    return [];
  }
}
```

---

## ⚠️ POINTS CRITIQUES

### 1. URL Émulateur Android
❌ `http://localhost:3001`  
✅ `http://10.0.2.2:3001`

### 2. Token Field Name
❌ `response['access_token']`  
✅ `response['accessToken']`

### 3. Storage Keys
✅ Token: `'pharmacy_token'`  
✅ ID: `'pharmacy_id'`

### 4. Authorization Header
✅ `'Authorization': 'Bearer $token'`

### 5. Response Formats
- `/pending` → Array direct `[]`
- `/history` → Objet paginé `{data: []}`

---

## 🎯 PRIORITÉS D'IMPLÉMENTATION

### Phase 1 - Essentiel (1-2 jours)
1. ✅ Login & stockage token
2. ✅ Liste demandes en attente
3. ✅ Accepter/refuser demandes
4. ✅ Dashboard basique

### Phase 2 - Important (2-3 jours)
5. ✅ Affichage des points/badges
6. ✅ Fil d'activité
7. ✅ Historique des demandes
8. ✅ Statistiques détaillées

### Phase 3 - Bonus (1-2 jours)
9. ✅ Système de boosts
10. ✅ Avis clients
11. ✅ Paramètres pharmacie

---

**✅ Backend vérifié et opérationnel:**
- ✅ Système de points automatique
- ✅ Calcul des badges automatique
- ✅ Incrémentation des compteurs
- ✅ Activités loggées automatiquement
- ✅ Tous les endpoints protégés par JWT
- ✅ 4 demandes de test disponibles

**🎯 Prêt pour consommation Flutter!**
