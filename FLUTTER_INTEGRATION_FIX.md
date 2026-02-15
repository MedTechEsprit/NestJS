# 🚨 PROBLÈMES IDENTIFIÉS ET SOLUTIONS - Backend DiabCare Pharmacy

## ⚠️ PROBLÈMES ACTUELS

### 1. **Token NULL après login** ✅ RÉSOLU
**Symptôme:** Le token est NULL dans le stockage Flutter après connexion réussie.  
**Cause:** Le backend retourne `accessToken` (pas `access_token`).  
**Solution:** Vérifier que Flutter stocke bien `response['accessToken']` (PAS `response['access_token']`).

### 2. **Aucune demande affichée** ✅ RÉSOLU
**Symptôme:** 0 demandes affichées pour la pharmacie ID `69910c81599fdacc840728aa`.  
**Cause 1:** Il manquait le champ `__t: 'Pharmacien'` dans le document MongoDB → CORRIGÉ  
**Cause 2:** Aucune demande n'existait → 3 demandes de test créées  
**Solution:** La base de données est maintenant correcte avec 3 demandes en attente.

### 3. **Compte de test disponible**
**Email:** syrine@gmail.com  
**Password:** [Votre mot de passe actuel]  
**Pharmacy ID:** 69910c81599fdacc840728aa  
**Demandes en attente:** 3 (Metformine, Insuline Lantus, Glucophage)

---

## 📋 STRUCTURE EXACTE DES RÉPONSES BACKEND

### 🔐 LOGIN RESPONSE
**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "pharmacie.centrale@test.com",
  "motDePasse": "password123"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "_id": "69910c81599fdacc840728aa",
    "nom": "Pharmacie",
    "prenom": "Centrale",
    "email": "pharmacie.centrale@test.com",
    "role": "PHARMACIEN",
    "nomPharmacie": "Pharmacie Centrale",
    "numeroOrdre": "PH001",
    "telephonePharmacie": "71234567",
    "adressePharmacie": "123 Rue Principale",
    "statutCompte": "ACTIF"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**⚠️ ATTENTION:** Le champ s'appelle `accessToken` (PAS `access_token`) !

---

### 👤 GET PROFILE RESPONSE
**Endpoint:** `GET /api/auth/profile`  
**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "_id": "69910c81599fdacc840728aa",
  "nom": "Pharmacie",
  "prenom": "Centrale",
  "email": "pharmacie.centrale@test.com",
  "role": "PHARMACIEN",
  "nomPharmacie": "Pharmacie Centrale",
  "numeroOrdre": "PH001",
  "telephonePharmacie": "71234567",
  "adressePharmacie": "123 Rue Principale",
  "points": 45,
  "badgeLevel": "bronze",
  "totalRequestsReceived": 3,
  "totalRequestsAccepted": 2,
  "totalClients": 1,
  "totalRevenue": 125.50,
  "averageResponseTime": 25,
  "averageRating": 4.5,
  "totalReviews": 10,
  "isOnDuty": true,
  "statutCompte": "ACTIF"
}
```

---

### 📊 DASHBOARD RESPONSE
**Endpoint:** `GET /api/pharmaciens/{pharmacyId}/dashboard`  
**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "pharmacy": {
    "_id": "69910c81599fdacc840728aa",
    "nom": "Pharmacie",
    "prenom": "Centrale",
    "email": "pharmacie.centrale@test.com",
    "nomPharmacie": "Pharmacie Centrale",
    "points": 45,
    "badgeLevel": "bronze",
    "totalRequestsReceived": 3,
    "totalRequestsAccepted": 2,
    "totalRequestsDeclined": 1,
    "totalClients": 1,
    "totalRevenue": 125.50,
    "averageResponseTime": 25,
    "averageRating": 4.5,
    "totalReviews": 10,
    "isOnDuty": true,
    "location": {
      "type": "Point",
      "coordinates": [10.1815, 36.8065]
    }
  },
  "stats": {
    "totalRequestsReceived": 3,
    "totalRequestsAccepted": 2,
    "totalRequestsDeclined": 1,
    "totalClients": 1,
    "totalRevenue": 125.50,
    "averageResponseTime": 25,
    "averageRating": 4.5,
    "totalReviews": 10,
    "acceptanceRate": 66.7,
    "responseRate": 100
  },
  "monthlyStats": [
    {
      "month": "2025-09",
      "requestsCount": 0,
      "acceptedCount": 0,
      "clientsCount": 0,
      "revenue": 0
    },
    {
      "month": "2025-10",
      "requestsCount": 1,
      "acceptedCount": 1,
      "clientsCount": 0,
      "revenue": 0
    }
  ],
  "pendingRequestsCount": 1,
  "recentActivity": [],
  "recentReviews": [],
  "badgeProgression": {
    "currentPoints": 45,
    "currentBadge": "bronze",
    "pointsToNextLevel": 5,
    "nextBadgeName": "silver"
  },
  "performanceComparison": {
    "pharmacyAverageResponseTime": 25,
    "sectorAverage": 45,
    "pharmacyAverageRating": 4.5,
    "sectorAverageRating": 3.8,
    "topPercentage": 15
  },
  "valueProposition": {
    "equivalentAdvertisingCost": {
      "targetedAds": 300,
      "localSEO": 200,
      "analytics": 150,
      "totalValue": 650
    },
    "pharmacyPays": 0,
    "annualSavings": 7800
  },
  "annualProjection": {
    "estimatedYearlyClients": 12,
    "estimatedYearlyRevenue": 1506
  },
  "missedOpportunitiesCount": 0
}
```

---

### 💊 GET PENDING REQUESTS
**Endpoint:** `GET /api/medication-request/pharmacy/{pharmacyId}/pending`  
**Headers:** `Authorization: Bearer {token}`

**Response (200 OK) - Array direct:**
```json
[
  {
    "_id": "69922de4e7912900f6269932",
    "patientId": "69910805fa9cb3ec5e0e95cb",
    "medicationName": "Metformine 850mg",
    "dosage": "850mg",
    "quantity": 90,
    "format": "comprimés",
    "urgencyLevel": "urgent",
    "patientNote": "Besoin urgent pour renouvellement",
    "globalStatus": "open",
    "expiresAt": "2026-02-15T22:34:44.639Z",
    "createdAt": "2026-02-15T20:34:44.639Z",
    "updatedAt": "2026-02-15T20:34:44.639Z",
    "isPickedUp": false,
    "pharmacyResponses": [
      {
        "pharmacyId": "69910c81599fdacc840728aa",
        "status": "pending",
        "responseTime": null,
        "indicativePrice": null,
        "preparationDelay": null,
        "pharmacyMessage": null
      }
    ]
  }
]
```

**Response (200 OK) - Liste VIDE si aucune demande:**
```json
[]
```

**⚠️ NOTE:** Si vous testez l'endpoint `/history` au lieu de `/pending`, la réponse sera un objet paginé :
```json
{
  "data": [{...}, {...}],
  "total": 4,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

### ✅ RESPOND TO REQUEST
**Endpoint:** `PUT /api/medication-request/{requestId}/respond`  
**Headers:** `Authorization: Bearer {token}`

**Request Body - ACCEPTER:**
```json
{
  "pharmacyId": "69910c81599fdacc840728aa",
  "status": "accepted",
  "indicativePrice": 125.50,
  "preparationDelay": "immediate",
  "pharmacyMessage": "Médicament disponible, venez le chercher",
  "pickupDeadline": "2026-02-15T18:00:00Z"
}
```

**Request Body - REFUSER:**
```json
{
  "pharmacyId": "69910c81599fdacc840728aa",
  "status": "declined",
  "pharmacyMessage": "Désolé, médicament non disponible actuellement"
}
```

**Response (200 OK):**
```json
{
  "message": "Réponse enregistrée avec succès",
  "request": {
    "_id": "69922c7870f78bef9669191d",
    "globalStatus": "open",
    "pharmacyResponses": [
      {
        "pharmacyId": "69910c81599fdacc840728aa",
        "status": "accepted",
        "responseTime": 12,
        "indicativePrice": 125.50,
        "preparationDelay": "immediate",
        "pharmacyMessage": "Médicament disponible, venez le chercher",
        "pickupDeadline": "2026-02-15T18:00:00.000Z",
        "respondedAt": "2026-02-15T14:42:00.000Z"
      }
    ]
  }
}
```

---

## 🔧 CORRECTIONS FLUTTER NÉCESSAIRES

### 1. **Stockage du Token après Login**

**❌ CODE INCORRECT:**
```dart
// Le token est recherché avec la mauvaise clé
final token = response['access_token']; // ❌ FAUX
await storage.write(key: 'pharmacy_token', value: token);
```

**✅ CODE CORRECT:**
```dart
// Le backend retourne "accessToken" (PAS "access_token")
final token = response['accessToken']; // ✅ CORRECT
await storage.write(key: 'pharmacy_token', value: token);

// Vérifier immédiatement que le stockage a fonctionné
final verif = await storage.read(key: 'pharmacy_token');
print('🔍 Token stocké: ${verif != null ? "SUCCESS" : "FAIL"}');
```

### 2. **Récupération du Token pour les API Calls**

**❌ CODE INCORRECT:**
```dart
final token = await storage.read(key: 'access_token'); // ❌ Mauvaise clé
```

**✅ CODE CORRECT:**
```dart
final token = await storage.read(key: 'pharmacy_token'); // ✅ Bonne clé
if (token == null || token.isEmpty) {
  throw Exception('Token non disponible - utilisateur non connecté');
}

// Utiliser le token dans les headers
final headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer $token',
};
```

### 3. **Appel Dashboard API**

**CODE COMPLET:**
```dart
Future<Map<String, dynamic>?> loadDashboard() async {
  try {
    // 1. Récupérer les credentials
    final token = await storage.read(key: 'pharmacy_token');
    final pharmacyId = await storage.read(key: 'pharmacy_id');
    
    print('🔑 Token: ${token != null ? "FOUND" : "NULL"}');
    print('🆔 PharmacyId: $pharmacyId');
    
    // 2. Vérifier qu'on a tout
    if (token == null || token.isEmpty) {
      throw Exception('Token manquant - déconnexion requise');
    }
    
    if (pharmacyId == null || pharmacyId.isEmpty) {
      throw Exception('PharmacyId manquant - déconnexion requise');
    }
    
    // 3. Appeler l'API dashboard
    final url = 'http://10.0.2.2:3001/api/pharmaciens/$pharmacyId/dashboard';
    print('📡 Calling: $url');
    
    final response = await http.get(
      Uri.parse(url),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );
    
    print('📊 Dashboard response status: ${response.statusCode}');
    
    // 4. Gérer les erreurs
    if (response.statusCode == 401) {
      // Token expiré
      await storage.deleteAll();
      throw Exception('Session expirée - reconnexion requise');
    }
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      print('✅ Dashboard loaded successfully');
      return data;
    } else {
      throw Exception('Erreur ${response.statusCode}: ${response.body}');
    }
  } catch (e) {
    print('❌ Dashboard error: $e');
    rethrow;
  }
}
```

### 4. **Appel Pending Requests API**

**CODE COMPLET avec gestion des 2 formats:**
```dart
Future<List<MedicationRequest>> fetchPendingRequests() async {
  try {
    // 1. Récupérer les credentials
    final token = await storage.read(key: 'pharmacy_token');
    final pharmacyId = await storage.read(key: 'pharmacy_id');
    
    if (token == null || pharmacyId == null) {
      throw Exception('Non authentifié');
    }
    
    // 2. Appeler l'API (ATTENTION: utilisez 10.0.2.2 pour émulateur Android)
    final url = 'http://10.0.2.2:3001/api/medication-request/pharmacy/$pharmacyId/pending';
    print('📡 Fetching pending requests from: $url');
    
    final response = await http.get(
      Uri.parse(url),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );
    
    print('📊 Pending requests response: ${response.statusCode}');
    
    if (response.statusCode == 401) {
      await storage.deleteAll();
      throw Exception('Session expirée');
    }
    
    if (response.statusCode == 200) {
      // ⚠️ IMPORTANT: Gérer les 2 formats possibles
      final dynamic decoded = jsonDecode(response.body);
      
      // Format 1: Array direct [...]
      if (decoded is List) {
        print('✅ Found ${decoded.length} pending requests (array format)');
        
        if (decoded.isEmpty) {
          print('ℹ️ Aucune demande en attente pour cette pharmacie');
          return [];
        }
        
        return decoded.map((json) => MedicationRequest.fromJson(json)).toList();
      } 
      // Format 2: Objet paginé {data: [...], total: ...}
      else if (decoded is Map && decoded.containsKey('data')) {
        final List<dynamic> data = decoded['data'];
        print('✅ Found ${data.length} pending requests (paginated format)');
        
        if (data.isEmpty) {
          print('ℹ️ Aucune demande en attente pour cette pharmacie');
          return [];
        }
        
        return data.map((json) => MedicationRequest.fromJson(json)).toList();
      }
      // Format inattendu
      else {
        print('❌ Unexpected response format: ${decoded.runtimeType}');
        throw Exception('Format de réponse invalide');
      }
    } else {
      throw Exception('Erreur ${response.statusCode}');
    }
  } catch (e) {
    print('❌ Fetch pending requests error: $e');
    rethrow;
  }
}
```

### 5. **Répondre à une Demande**

**CODE COMPLET:**
```dart
Future<bool> respondToRequest({
  required String requestId,
  required String status, // "accepted" ou "declined"
  double? indicativePrice,
  String? preparationDelay,
  String? pharmacyMessage,
}) async {
  try {
    final token = await storage.read(key: 'pharmacy_token');
    final pharmacyId = await storage.read(key: 'pharmacy_id');
    
    if (token == null || pharmacyId == null) {
      throw Exception('Non authentifié');
    }
    
    // Construire le body selon le status
    final body = {
      'pharmacyId': pharmacyId,
      'status': status,
      if (indicativePrice != null) 'indicativePrice': indicativePrice,
      if (preparationDelay != null) 'preparationDelay': preparationDelay,
      if (pharmacyMessage != null) 'pharmacyMessage': pharmacyMessage,
    };
    
    print('📡 Responding to request $requestId with status: $status');
    
    final url = 'http://10.0.2.2:3001/api/medication-request/$requestId/respond';
    final response = await http.put(
      Uri.parse(url),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode(body),
    );
    
    print('📊 Response status: ${response.statusCode}');
    
    if (response.statusCode == 200) {
      print('✅ Response saved successfully');
      return true;
    } else {
      print('❌ Error: ${response.body}');
      return false;
    }
  } catch (e) {
    print('❌ Respond error: $e');
    return false;
  }
}
```

---

## ✅ DONNÉES DE TEST CRÉÉES

### 🎯 Demandes de médicaments disponibles

Les demandes suivantes ont été créées avec succès pour votre pharmacie:

| # | Médicament | Urgence | Status | ID MongoDB |
|---|-----------|---------|--------|------------|
| 1 | **Metformine 850mg** | 🔴 Urgent | ⏳ Pending | `69922de4e7912900f6269932` |
| 2 | **Insuline Lantus Solostar** | 🔴 Très urgent | ⏳ Pending | `69922de4e7912900f6269933` |
| 3 | **Glucophage XR 1000mg** | 🟢 Normal | ⏳ Pending | `69922de4e7912900f6269934` |

**Détails:**
- 👤 Patient ID: `69910805fa9cb3ec5e0e95cb`
- 🏥 Pharmacie ID: `69910c81599fdacc840728aa` (Pharmacie Syrine Abid)
- ⏰ Expiration: 2 heures après création
- 📊 Status global: `open`

### 🗄️ Database corrections effectuées

✅ Le document MongoDB de votre pharmacie a été corrigé:
- Ajout du champ discriminateur `__t: 'Pharmacien'` (requis pour les queries Mongoose)
- Initialisation de tous les champs Pharmacien (points, badges, stats, notifications)
- Géolocalisation configurée (GeoJSON Point avec index 2dsphere)
- Horaires de travail initialisés
- Notifications activées par défaut

### 🧪 Test maintenant

Vous pouvez tester ces endpoints:
```bash
# Récupérer les demandes en attente
GET /api/medication-request/pharmacy/69910c81599fdacc840728aa/pending
Authorization: Bearer {votre_token}

# Voir le dashboard
GET /api/pharmaciens/69910c81599fdacc840728aa/dashboard
Authorization: Bearer {votre_token}
```

---

## 📱 URL POUR ÉMULATEUR ANDROID

**❌ N'UTILISEZ PAS:** `http://localhost:3001`  
**✅ UTILISEZ:** `http://10.0.2.2:3001` (IP spéciale émulateur Android)

---

## ✅ CHECKLIST DE VÉRIFICATION

### Login
- [ ] Le token est extrait avec `response['accessToken']` (PAS `access_token`)
- [ ] Le token est stocké avec la clé `pharmacy_token`
- [ ] Le pharmacyId est extrait avec `response['user']['_id']`
- [ ] Le pharmacyId est stocké avec la clé `pharmacy_id`
- [ ] Vérification immédiate après stockage (print pour debug)

### Dashboard
- [ ] Le token est récupéré avec `storage.read(key: 'pharmacy_token')`
- [ ] Headers incluent `Authorization: Bearer $token`
- [ ] URL correcte: `http://10.0.2.2:3001/api/pharmaciens/{id}/dashboard`
- [ ] Gestion du 401 (token expiré → logout)

### Pending Requests
- [ ] Le token est récupéré avec `storage.read(key: 'pharmacy_token')`
- [ ] Headers incluent `Authorization: Bearer $token`
- [ ] URL correcte: `http://10.0.2.2:3001/api/medication-request/pharmacy/{id}/pending`
- [ ] Liste vide = comportement normal (pas d'erreur)
- [ ] Afficher message "Aucune demande" si liste vide

### Respond to Request
- [ ] Body inclut `pharmacyId` (obligatoire)
- [ ] Body inclut `status`: "accepted" ou "declined"
- [ ] Si accepted: inclure `indicativePrice` et `preparationDelay`
- [ ] Headers incluent le token Bearer

---

## 🎯 RÉSUMÉ DES CORRECTIONS URGENTES

### 1. Login Token Extraction ⚠️ CRITIQUE
```dart
// ❌ INCORRECT
final token = response['access_token']; // NE MARCHE PAS

// ✅ CORRECT
final token = response['accessToken']; // Backend utilise camelCase
await storage.write(key: 'pharmacy_token', value: token);
```

### 2. API Calls avec Token
```dart
final token = await storage.read(key: 'pharmacy_token');
if (token == null || token.isEmpty) {
  throw Exception('Non authentifié');
}

final headers = {
  'Authorization': 'Bearer $token',
  'Content-Type': 'application/json',
};
```

### 3. URL pour émulateur Android
```dart
// ❌ INCORRECT
const baseUrl = 'http://localhost:3001/api';

// ✅ CORRECT
const baseUrl = 'http://10.0.2.2:3001/api'; // IP spéciale émulateur
```

### 4. Credentiales de test ✅ PRÊTES

Email: `syrine@gmail.com`  
Password: [Votre mot de passe actuel]  
Pharmacy ID: `69910c81599fdacc840728aa`  
**3 demandes déjà créées dans la base de données !**

---

## 📞 SUPPORT

Si vous voyez toujours 0 demandes après ces corrections:

1. ✅ Vérifiez le token dans storage: `print(await storage.read(key: 'pharmacy_token'));`
2. ✅ Vérifiez la réponse complete du login: `print(response);`
3. ✅ Testez l'endpoint pending dans Swagger avec votre token
4. ✅ Vérifiez les logs backend pour les erreurs 401

---

## 🚨 PROBLÈME: 0 Demandes Affichées (Backend = 4 demandes)

### Diagnostic Rapide

**Symptôme:** Le backend Swagger montre 4 demandes mais Flutter affiche 0.

**Causes possibles:**

#### 1️⃣ URL incorrecte (émulateur Android)
```dart
// ❌ FAUX - Ne fonctionne PAS sur émulateur Android
const baseUrl = 'http://localhost:3001/api';

// ✅ CORRECT - IP spéciale pour émulateur
const baseUrl = 'http://10.0.2.2:3001/api';
```

**Test:** Ajoutez ce print avant l'appel API:
```dart
final url = 'http://10.0.2.2:3001/api/medication-request/pharmacy/$pharmacyId/pending';
print('🌐 URL complète: $url');
```

#### 2️⃣ Token non envoyé ou invalide
```dart
// TOUJOURS vérifier le token avant l'appel
final token = await storage.read(key: 'pharmacy_token');
print('🔑 Token: ${token?.substring(0, 20)}...'); // Afficher les 20 premiers chars

if (token == null || token.isEmpty) {
  print('❌ Token NULL ou vide - Abandon');
  return [];
}
```

#### 3️⃣ Format de réponse incorrect

**⚠️ ATTENTION:** Le backend a **2 endpoints différents** !

| Endpoint | Format de réponse |
|----------|-------------------|
| `/pending` | **Array direct** `[{...}, {...}]` |
| `/history` | **Objet paginé** `{data: [...], total: 4, page: 1}` |

**Code Flutter CORRECT pour /pending:**
```dart
// Pour l'endpoint /pending (retourne un array direct)
if (response.statusCode == 200) {
  final List<dynamic> data = jsonDecode(response.body);
  print('✅ Demandes trouvées: ${data.length}');
  return data.map((json) => MedicationRequest.fromJson(json)).toList();
}
```

**Code Flutter pour /history (si vous utilisez cet endpoint):**
```dart
// Pour l'endpoint /history (retourne {data: [], total: ...})
if (response.statusCode == 200) {
  final Map<String, dynamic> jsonResponse = jsonDecode(response.body);
  final List<dynamic> data = jsonResponse['data']; // ← Important!
  print('✅ Demandes trouvées: ${data.length} sur ${jsonResponse['total']}');
  return data.map((json) => MedicationRequest.fromJson(json)).toList();
}
```

### 🔍 Code de Debug Complet

Ajoutez ce code dans votre méthode Flutter:

```dart
Future<List<MedicationRequest>> fetchPendingRequests() async {
  print('\n🔎 === DEBUG FETCH PENDING REQUESTS ===');
  
  try {
    // 1. Vérifier les credentials
    final token = await storage.read(key: 'pharmacy_token');
    final pharmacyId = await storage.read(key: 'pharmacy_id');
    
    print('🔑 Token présent: ${token != null ? "OUI (${token.length} chars)" : "NON"}');
    print('🆔 Pharmacy ID: $pharmacyId');
    
    if (token == null || pharmacyId == null) {
      print('❌ Credentials manquants');
      return [];
    }
    
    // 2. Construire l'URL (ATTENTION à 10.0.2.2 pour émulateur)
    final url = 'http://10.0.2.2:3001/api/medication-request/pharmacy/$pharmacyId/pending';
    print('🌐 URL: $url');
    
    // 3. Faire l'appel
    print('📡 Envoi de la requête...');
    final response = await http.get(
      Uri.parse(url),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    ).timeout(Duration(seconds: 10));
    
    print('📊 Status Code: ${response.statusCode}');
    print('📦 Response Body (100 premiers chars): ${response.body.substring(0, min(100, response.body.length))}...');
    print('📏 Response Body Length: ${response.body.length} chars');
    
    // 4. Analyser la réponse
    if (response.statusCode == 401) {
      print('❌ 401 Unauthorized - Token invalide ou expiré');
      await storage.deleteAll();
      throw Exception('Session expirée');
    }
    
    if (response.statusCode == 403) {
      print('❌ 403 Forbidden - Accès refusé (mauvais rôle?)');
      throw Exception('Accès interdit');
    }
    
    if (response.statusCode == 200) {
      print('✅ Réponse 200 OK');
      
      // Décoder le JSON
      final dynamic decoded = jsonDecode(response.body);
      print('🔍 Type de réponse: ${decoded.runtimeType}');
      
      // Vérifier si c'est un array ou un objet
      if (decoded is List) {
        print('✅ C\'est un array direct de ${decoded.length} éléments');
        final list = decoded.map((json) => MedicationRequest.fromJson(json)).toList();
        print('✅ Parsing réussi: ${list.length} demandes');
        return list;
      } else if (decoded is Map && decoded.containsKey('data')) {
        print('✅ C\'est un objet paginé avec ${decoded['data'].length} éléments');
        final data = decoded['data'] as List;
        print('📊 Total: ${decoded['total']}, Page: ${decoded['page']}');
        final list = data.map((json) => MedicationRequest.fromJson(json)).toList();
        print('✅ Parsing réussi: ${list.length} demandes');
        return list;
      } else {
        print('❌ Format de réponse inattendu!');
        print('📦 Réponse complète: ${response.body}');
        throw Exception('Format de réponse invalide');
      }
    } else {
      print('❌ Erreur HTTP ${response.statusCode}');
      print('📦 Body: ${response.body}');
      throw Exception('Erreur ${response.statusCode}');
    }
  } catch (e, stackTrace) {
    print('❌ ERREUR EXCEPTION: $e');
    print('📚 StackTrace: $stackTrace');
    rethrow;
  }
}
```

### ✅ Checklist de Vérification

Dans les logs Flutter, vous DEVEZ voir:

- [ ] `🔑 Token présent: OUI`
- [ ] `🆔 Pharmacy ID: 69910c81599fdacc840728aa`
- [ ] `🌐 URL: http://10.0.2.2:3001/api/...`
- [ ] `📊 Status Code: 200`
- [ ] `✅ C'est un array direct de 4 éléments` (ou objet paginé)
- [ ] `✅ Parsing réussi: 4 demandes`

**Si vous voyez `Status Code: 401`:**
- Le token est invalide ou expiré
- Reconnectez-vous et vérifiez que vous extrayez bien `response['accessToken']`

**Si vous voyez `Status Code: 404`:**
- L'URL est incorrecte
- Vérifiez que vous utilisez bien `http://10.0.2.2:3001` (pas localhost)

**Si vous voyez `Status Code: 403`:**
- Le rôle n'est pas PHARMACIEN
- Vérifiez dans le profil: `response['user']['role']` doit être `'PHARMACIEN'`

**Si aucun log n'apparaît:**
- La méthode n'est jamais appelée
- Ajoutez un print au tout début: `print('🚀 fetchPendingRequests() appelée');`

---

**Date de création:** 15 février 2026  
**Backend Version:** 1.0.0  
**Base URL:** `http://10.0.2.2:3001/api` (émulateur Android)
