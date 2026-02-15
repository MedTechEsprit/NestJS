# DiabCare Pharmacy API Integration Guide

## 📋 Table of Contents
1. [General Configuration](#general-configuration)
2. [Authentication](#authentication)
3. [Medication Requests Management](#medication-requests-management)
4. [Pharmacy Dashboard](#pharmacy-dashboard)
5. [Supporting Endpoints](#supporting-endpoints)
6. [API Reference Table](#api-reference-table)
7. [Troubleshooting](#troubleshooting)

---

## 🔧 General Configuration

### Base URL Configuration
```dart
// Development
const String BASE_URL = 'http://localhost:3001/api';

// Production (when deployed)
const String BASE_URL = 'https://your-domain.com/api';
```

### Default Headers
All API requests must include:
```dart
headers: {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
}
```

### Authentication Headers
All **protected routes** require JWT authentication via Bearer token:
```dart
headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
}
```

### Secure Storage Setup
Install the required package:
```yaml
# pubspec.yaml
dependencies:
  flutter_secure_storage: ^9.0.0
```

Store authentication data after successful login:
```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const storage = FlutterSecureStorage();

// After successful login
await storage.write(key: 'pharmacy_token', value: jwtToken);
await storage.write(key: 'pharmacy_id', value: pharmacyId);

// Retrieve for API calls
final token = await storage.read(key: 'pharmacy_token');
final pharmacyId = await storage.read(key: 'pharmacy_id');

// On logout
await storage.deleteAll();
```

---

## 🔐 Authentication

### Login Endpoint

**Note:** There is no registration screen at this stage. Accounts are pre-created in MongoDB. Only login flow is needed.

#### Request
```
POST /auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "pharmacie.centrale@diabcare.tn",
  "motDePasse": "password123"
}
```

**Field Descriptions:**
- `email` (String, required): Pharmacy account email
- `motDePasse` (String, required): Password (note: backend uses French field name)

#### Success Response (200 OK)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "69910805fa9cb3ec5e0e95cd",
    "nom": "Pharmacie",
    "prenom": "Centrale",
    "email": "pharmacie.centrale@diabcare.tn",
    "role": "PHARMACIEN",
    "nomPharmacie": "Pharmacie Centrale",
    "numeroOrdre": "PH001",
    "telephonePharmacie": "71234567",
    "adressePharmacie": "123 Rue Principale, Tunis",
    "statutCompte": "ACTIF"
  }
}
```

**Important:** Extract and store:
1. `access_token` → Store as `pharmacy_token`
2. `user._id` → Store as `pharmacy_id`

#### Error Responses

**401 Unauthorized** - Wrong credentials:
```json
{
  "statusCode": 401,
  "message": "Identifiants incorrects",
  "error": "Unauthorized"
}
```

**400 Bad Request** - Validation error:
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "motDePasse should not be empty"],
  "error": "Bad Request"
}
```

---

### Flutter Implementation Example

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthService {
  static const String baseUrl = 'http://localhost:3001/api';
  static const storage = FlutterSecureStorage();

  /// Login pharmacy user
  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'email': email,
          'motDePasse': password, // Backend uses French field name
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        // Extract token and pharmacy ID
        final token = data['access_token'];
        final pharmacyId = data['user']['_id'];
        
        // Store securely
        await storage.write(key: 'pharmacy_token', value: token);
        await storage.write(key: 'pharmacy_id', value: pharmacyId);
        
        return {
          'success': true,
          'token': token,
          'pharmacyId': pharmacyId,
          'user': data['user'],
        };
      } else if (response.statusCode == 401) {
        return {
          'success': false,
          'message': 'Email ou mot de passe incorrect',
        };
      } else {
        final error = jsonDecode(response.body);
        return {
          'success': false,
          'message': error['message'] ?? 'Erreur de connexion',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Erreur réseau: $e',
      };
    }
  }

  /// Logout user
  Future<void> logout() async {
    await storage.deleteAll();
  }

  /// Check if user is logged in
  Future<bool> isLoggedIn() async {
    final token = await storage.read(key: 'pharmacy_token');
    return token != null && token.isNotEmpty;
  }
}
```

---

## 💊 Medication Requests Management

### 1. Get Pending Requests

Retrieve all pending medication requests for the authenticated pharmacy.

#### Request
```
GET /medication-request/pharmacy/{pharmacyId}/pending
Authorization: Bearer {token}
```

**Path Parameters:**
- `pharmacyId`: The pharmacy ID stored from login (use the value from `pharmacy_id` key in secure storage)

#### Success Response (200 OK)
```json
[
  {
    "_id": "6991178208fdc9539dce5024",
    "patientId": "69910805fa9cb3ec5e0e95cb",
    "medicationName": "Metformine 850mg",
    "dosage": "850mg",
    "quantity": 90,
    "format": "comprimés",
    "urgencyLevel": "urgent",
    "patientNote": "Besoin urgent pour renouvellement",
    "globalStatus": "open",
    "expiresAt": "2026-02-15T14:30:00.000Z",
    "createdAt": "2026-02-15T12:30:00.000Z",
    "updatedAt": "2026-02-15T12:30:00.000Z",
    "pharmacyResponses": [
      {
        "pharmacyId": "69910805fa9cb3ec5e0e95cd",
        "status": "pending",
        "responseTime": null,
        "indicativePrice": null,
        "preparationDelay": null,
        "pharmacyMessage": null,
        "pickupDeadline": null
      }
    ]
  }
]
```

**Empty Response:**
```json
[]
```
When the response array is empty, display the existing empty state UI with message: **"Aucune demande en attente"**

**Field Descriptions:**
- `_id`: Request ID (use this for responding)
- `urgencyLevel`: "normal" | "urgent" | "très urgent"
- `globalStatus`: "open" | "confirmed" | "picked_up"
- `expiresAt`: Request expires 2 hours after creation
- `pharmacyResponses`: Array containing responses from all targeted pharmacies
  - Find the subdocument where `pharmacyResponses[].pharmacyId` matches your pharmacy ID
  - Extract `status`, `indicativePrice`, `preparationDelay`, `pharmacyMessage` from that subdocument

---

### 2. Get Requests History

Retrieve historical requests with filters and pagination.

#### Request
```
GET /medication-request/pharmacy/{pharmacyId}/history?page=1&limit=20&status=accepted
Authorization: Bearer {token}
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number |
| limit | integer | No | 20 | Results per page |
| status | string | No | - | Filter by: pending, accepted, declined, expired, ignored |
| startDate | string | No | - | ISO date string (e.g., "2026-01-01T00:00:00Z") |
| endDate | string | No | - | ISO date string |
| medicationName | string | No | - | Search by medication name |

#### Success Response (200 OK)
Same structure as pending requests, but includes all historical responses.

---

### 3. Respond to a Request

Accept, decline, or ignore a medication request.

#### Request
```
PUT /medication-request/{requestId}/respond
Authorization: Bearer {token}
Content-Type: application/json
```

**Path Parameters:**
- `requestId`: The request ID (from `_id` field)

**Request Body:**
```json
{
  "pharmacyId": "69910805fa9cb3ec5e0e95cd",
  "status": "accepted",
  "indicativePrice": 45.50,
  "preparationDelay": "immediate",
  "pharmacyMessage": "Médicament disponible, venez le chercher",
  "pickupDeadline": "2026-02-15T18:00:00Z"
}
```

**Field Descriptions:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| pharmacyId | string | Yes | Your pharmacy ID from secure storage |
| status | string | Yes | "accepted", "declined", or "ignored" |
| indicativePrice | number | No | Price in TND (required if status = "accepted") |
| preparationDelay | string | No | "immediate", "30min", "1h", "2h", "other" |
| pharmacyMessage | string | No | Custom message to the patient |
| pickupDeadline | string (ISO Date) | No | Deadline for patient pickup |

#### Success Response (200 OK)
```json
{
  "message": "Réponse enregistrée avec succès",
  "request": {
    "_id": "6991178208fdc9539dce5024",
    "globalStatus": "open",
    "pharmacyResponses": [
      {
        "pharmacyId": "69910805fa9cb3ec5e0e95cd",
        "status": "accepted",
        "responseTime": 12,
        "indicativePrice": 45.50,
        "preparationDelay": "immediate",
        "pharmacyMessage": "Médicament disponible, venez le chercher",
        "pickupDeadline": "2026-02-15T18:00:00.000Z",
        "respondedAt": "2026-02-15T12:42:00.000Z"
      }
    ]
  }
}
```

**Points Awarded:**
- Base response: +5 points
- Accepted request: +10 points
- Fast response (< 15 min): +3 bonus points
- Urgent request (< 30 min): +15 bonus points

#### Error Responses

**400 Bad Request** - Request expired:
```json
{
  "statusCode": 400,
  "message": "Cette demande a expiré",
  "error": "Bad Request"
}
```

**404 Not Found:**
```json
{
  "statusCode": 404,
  "message": "Demande non trouvée"
}
```

---

### 4. Confirm Request (Patient Action)

**Note:** This endpoint is for patient use, not pharmacy. Included for reference.

```
PUT /medication-request/{requestId}/confirm
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "selectedPharmacyId": "69910805fa9cb3ec5e0e95cd"
}
```

---

### 5. Mark as Picked Up

Mark a request as picked up by the patient.

#### Request
```
PUT /medication-request/{requestId}/pickup
Authorization: Bearer {token}
```

No request body required.

#### Success Response (200 OK)
```json
{
  "message": "Demande marquée comme retirée",
  "request": {
    "_id": "6991178208fdc9539dce5024",
    "globalStatus": "picked_up",
    "isPickedUp": true
  }
}
```

---

### Flutter Implementation Example

```dart
class MedicationRequestModel {
  final String id;
  final String medicationName;
  final String dosage;
  final int quantity;
  final String format;
  final String urgencyLevel;
  final String patientNote;
  final String globalStatus;
  final DateTime expiresAt;
  final List<PharmacyResponse> pharmacyResponses;

  MedicationRequestModel({
    required this.id,
    required this.medicationName,
    required this.dosage,
    required this.quantity,
    required this.format,
    required this.urgencyLevel,
    required this.patientNote,
    required this.globalStatus,
    required this.expiresAt,
    required this.pharmacyResponses,
  });

  factory MedicationRequestModel.fromJson(Map<String, dynamic> json) {
    return MedicationRequestModel(
      id: json['_id'],
      medicationName: json['medicationName'],
      dosage: json['dosage'],
      quantity: json['quantity'],
      format: json['format'],
      urgencyLevel: json['urgencyLevel'],
      patientNote: json['patientNote'] ?? '',
      globalStatus: json['globalStatus'],
      expiresAt: DateTime.parse(json['expiresAt']),
      pharmacyResponses: (json['pharmacyResponses'] as List)
          .map((r) => PharmacyResponse.fromJson(r))
          .toList(),
    );
  }

  /// Get the response for the current pharmacy
  PharmacyResponse? getMyResponse(String myPharmacyId) {
    try {
      return pharmacyResponses.firstWhere(
        (r) => r.pharmacyId == myPharmacyId,
      );
    } catch (e) {
      return null;
    }
  }
}

class PharmacyResponse {
  final String pharmacyId;
  final String status;
  final int? responseTime;
  final double? indicativePrice;
  final String? preparationDelay;
  final String? pharmacyMessage;
  final DateTime? pickupDeadline;
  final DateTime? respondedAt;

  PharmacyResponse({
    required this.pharmacyId,
    required this.status,
    this.responseTime,
    this.indicativePrice,
    this.preparationDelay,
    this.pharmacyMessage,
    this.pickupDeadline,
    this.respondedAt,
  });

  factory PharmacyResponse.fromJson(Map<String, dynamic> json) {
    return PharmacyResponse(
      pharmacyId: json['pharmacyId'],
      status: json['status'],
      responseTime: json['responseTime'],
      indicativePrice: json['indicativePrice']?.toDouble(),
      preparationDelay: json['preparationDelay'],
      pharmacyMessage: json['pharmacyMessage'],
      pickupDeadline: json['pickupDeadline'] != null
          ? DateTime.parse(json['pickupDeadline'])
          : null,
      respondedAt: json['respondedAt'] != null
          ? DateTime.parse(json['respondedAt'])
          : null,
    );
  }
}

class MedicationRequestService {
  static const String baseUrl = 'http://localhost:3001/api';
  static const storage = FlutterSecureStorage();

  /// Fetch pending requests for current pharmacy
  Future<List<MedicationRequestModel>> fetchPendingRequests() async {
    try {
      final token = await storage.read(key: 'pharmacy_token');
      final pharmacyId = await storage.read(key: 'pharmacy_id');

      if (token == null || pharmacyId == null) {
        throw Exception('Not authenticated');
      }

      final response = await http.get(
        Uri.parse('$baseUrl/medication-request/pharmacy/$pharmacyId/pending'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        
        // Return empty list if no requests
        if (data.isEmpty) {
          return [];
        }
        
        return data.map((json) => MedicationRequestModel.fromJson(json)).toList();
      } else if (response.statusCode == 401) {
        // Token expired - logout
        await storage.deleteAll();
        throw Exception('Session expirée');
      } else {
        throw Exception('Erreur lors du chargement: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Erreur réseau: $e');
    }
  }

  /// Respond to a medication request
  Future<Map<String, dynamic>> respondToRequest({
    required String requestId,
    required String status,
    double? indicativePrice,
    String? preparationDelay,
    String? pharmacyMessage,
    DateTime? pickupDeadline,
  }) async {
    try {
      final token = await storage.read(key: 'pharmacy_token');
      final pharmacyId = await storage.read(key: 'pharmacy_id');

      if (token == null || pharmacyId == null) {
        throw Exception('Not authenticated');
      }

      final body = {
        'pharmacyId': pharmacyId,
        'status': status,
        if (indicativePrice != null) 'indicativePrice': indicativePrice,
        if (preparationDelay != null) 'preparationDelay': preparationDelay,
        if (pharmacyMessage != null) 'pharmacyMessage': pharmacyMessage,
        if (pickupDeadline != null) 'pickupDeadline': pickupDeadline.toIso8601String(),
      };

      final response = await http.put(
        Uri.parse('$baseUrl/medication-request/$requestId/respond'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        return {
          'success': true,
          'data': jsonDecode(response.body),
        };
      } else {
        final error = jsonDecode(response.body);
        return {
          'success': false,
          'message': error['message'] ?? 'Erreur',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Erreur réseau: $e',
      };
    }
  }
}
```

---

## 📊 Pharmacy Dashboard

### Get Complete Dashboard

Retrieve comprehensive dashboard data including stats, badge progression, recent activity, and performance metrics.

#### Request
```
GET /pharmaciens/{pharmacyId}/dashboard
Authorization: Bearer {token}
```

**Path Parameters:**
- `pharmacyId`: The pharmacy ID from secure storage

#### Success Response (200 OK)

```json
{
  "pharmacy": {
    "_id": "69910805fa9cb3ec5e0e95cd",
    "nom": "Pharmacie",
    "prenom": "Express",
    "email": "pharmacie.express@diabcare.tn",
    "role": "PHARMACIEN",
    "nomPharmacie": "Pharmacie Express",
    "numeroOrdre": "PH002",
    "telephonePharmacie": "71987654",
    "adressePharmacie": "456 Avenue Habib Bourguiba, Tunis",
    "location": {
      "type": "Point",
      "coordinates": [10.1735, 36.8002]
    },
    "points": 120,
    "badgeLevel": "silver",
    "totalRequestsReceived": 45,
    "totalRequestsAccepted": 38,
    "totalRequestsDeclined": 5,
    "totalClients": 32,
    "totalRevenue": 1250.50,
    "averageResponseTime": 18,
    "averageRating": 4.5,
    "totalReviews": 28,
    "isOnDuty": true,
    "notificationsPush": true,
    "notificationsEmail": true,
    "notificationsSMS": false,
    "visibilityRadius": 5
  },
  "stats": {
    "totalRequestsReceived": 45,
    "totalRequestsAccepted": 38,
    "totalRequestsDeclined": 5,
    "totalClients": 32,
    "totalRevenue": 1250.50,
    "averageResponseTime": 18,
    "averageRating": 4.5,
    "totalReviews": 28,
    "acceptanceRate": 84.4,
    "responseRate": 95.6
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
      "requestsCount": 0,
      "acceptedCount": 0,
      "clientsCount": 0,
      "revenue": 0
    }
  ],
  "pendingRequestsCount": 3,
  "recentActivity": [],
  "recentReviews": [],
  "badgeProgression": {
    "currentPoints": 120,
    "currentBadge": "silver",
    "pointsToNextLevel": 30,
    "nextBadgeName": "gold"
  },
  "performanceComparison": {
    "pharmacyAverageResponseTime": 18,
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
    "estimatedYearlyClients": 384,
    "estimatedYearlyRevenue": 15006.0
  },
  "missedOpportunitiesCount": 0
}
```

**Badge Levels:**
- bronze: 0-49 points
- silver: 50-149 points
- gold: 150-299 points
- platinum: 300-499 points
- diamond: 500+ points

---

### Flutter Implementation Example

```dart
class PharmacyDashboardModel {
  final PharmacyProfile pharmacy;
  final DashboardStats stats;
  final List<MonthlyStats> monthlyStats;
  final int pendingRequestsCount;
  final BadgeProgression badgeProgression;
  final PerformanceComparison performanceComparison;
  final ValueProposition valueProposition;
  final AnnualProjection annualProjection;
  final int missedOpportunitiesCount;

  PharmacyDashboardModel({
    required this.pharmacy,
    required this.stats,
    required this.monthlyStats,
    required this.pendingRequestsCount,
    required this.badgeProgression,
    required this.performanceComparison,
    required this.valueProposition,
    required this.annualProjection,
    required this.missedOpportunitiesCount,
  });

  factory PharmacyDashboardModel.fromJson(Map<String, dynamic> json) {
    return PharmacyDashboardModel(
      pharmacy: PharmacyProfile.fromJson(json['pharmacy']),
      stats: DashboardStats.fromJson(json['stats']),
      monthlyStats: (json['monthlyStats'] as List)
          .map((m) => MonthlyStats.fromJson(m))
          .toList(),
      pendingRequestsCount: json['pendingRequestsCount'] ?? 0,
      badgeProgression: BadgeProgression.fromJson(json['badgeProgression']),
      performanceComparison: PerformanceComparison.fromJson(json['performanceComparison']),
      valueProposition: ValueProposition.fromJson(json['valueProposition']),
      annualProjection: AnnualProjection.fromJson(json['annualProjection']),
      missedOpportunitiesCount: json['missedOpportunitiesCount'] ?? 0,
    );
  }
}

class BadgeProgression {
  final int currentPoints;
  final String currentBadge;
  final int pointsToNextLevel;
  final String nextBadgeName;

  BadgeProgression({
    required this.currentPoints,
    required this.currentBadge,
    required this.pointsToNextLevel,
    required this.nextBadgeName,
  });

  factory BadgeProgression.fromJson(Map<String, dynamic> json) {
    return BadgeProgression(
      currentPoints: json['currentPoints'],
      currentBadge: json['currentBadge'],
      pointsToNextLevel: json['pointsToNextLevel'],
      nextBadgeName: json['nextBadgeName'],
    );
  }

  double get progressPercentage {
    if (nextBadgeName == 'max') return 100.0;
    final badgeThresholds = {
      'bronze': 50,
      'silver': 100,
      'gold': 150,
      'platinum': 200,
    };
    final threshold = badgeThresholds[currentBadge] ?? 50;
    return (currentPoints % threshold) / threshold * 100;
  }
}

class PharmacyDashboardService {
  static const String baseUrl = 'http://localhost:3001/api';
  static const storage = FlutterSecureStorage();

  Future<PharmacyDashboardModel?> loadDashboard() async {
    try {
      final token = await storage.read(key: 'pharmacy_token');
      final pharmacyId = await storage.read(key: 'pharmacy_id');

      if (token == null || pharmacyId == null) {
        throw Exception('Not authenticated');
      }

      final response = await http.get(
        Uri.parse('$baseUrl/pharmaciens/$pharmacyId/dashboard'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return PharmacyDashboardModel.fromJson(data);
      } else if (response.statusCode == 401) {
        // Token expired - clear storage and redirect to login
        await storage.deleteAll();
        // TODO: Navigate to login screen
        throw Exception('Session expirée. Veuillez vous reconnecter.');
      } else {
        throw Exception('Erreur: ${response.statusCode}');
      }
    } catch (e) {
      print('Dashboard load error: $e');
      return null;
    }
  }
}
```

---

## 🔌 Supporting Endpoints

### Basic Stats Only
```
GET /pharmaciens/{id}/stats
Authorization: Bearer {token}
```

Returns only the stats object without other dashboard data.

### Monthly Stats for Charts
```
GET /pharmaciens/{id}/stats/monthly
Authorization: Bearer {token}
```

Returns only the last 6 months statistics array.

### Activity Feed
```
GET /activity/pharmacy/{id}/feed
Authorization: Bearer {token}
```

Returns the last 8 activities with `relativeTime` formatted as:
- "Il y a 5 min"
- "Il y a 2h"
- "Hier"
- "Il y a 3 jours"

**Response:**
```json
[
  {
    "_id": "...",
    "pharmacyId": "69910805fa9cb3ec5e0e95cd",
    "activityType": "request_accepted",
    "description": "Demande acceptée: Metformine 850mg",
    "amount": null,
    "points": 10,
    "relativeTime": "Il y a 15 min",
    "createdAt": "2026-02-15T12:30:00.000Z"
  }
]
```

**Activity Types:**
- request_received
- request_accepted
- request_declined
- client_pickup
- review_received
- points_earned
- badge_unlocked
- boost_activated

### Review Summary
```
GET /review/pharmacy/{pharmacyId}/summary
```

**Response:**
```json
{
  "averageRating": 4.5,
  "totalReviews": 28,
  "ratingDistribution": {
    "5": 18,
    "4": 7,
    "3": 2,
    "2": 1,
    "1": 0
  }
}
```

### Active Boost
```
GET /boost/pharmacy/{id}/active
Authorization: Bearer {token}
```

Returns the currently active boost if any.

**Response:**
```json
{
  "_id": "...",
  "pharmacyId": "69910805fa9cb3ec5e0e95cd",
  "boostType": "boost_week",
  "price": 50,
  "startsAt": "2026-02-15T00:00:00.000Z",
  "expiresAt": "2026-02-22T00:00:00.000Z",
  "status": "active",
  "paymentStatus": "paid"
}
```

**404** if no active boost.

---

## 📚 API Reference Table

| Method | Endpoint | Auth Required | Description | Request Body |
|--------|----------|---------------|-------------|--------------|
| POST | `/auth/login` | No | Login pharmacy user | email, motDePasse |
| GET | `/medication-request/pharmacy/{id}/pending` | Yes | Get pending requests | - |
| GET | `/medication-request/pharmacy/{id}/history` | Yes | Get request history with filters | - |
| GET | `/medication-request/{id}` | Yes | Get single request details | - |
| PUT | `/medication-request/{id}/respond` | Yes | Respond to a request (accept/decline) | pharmacyId, status, indicativePrice, preparationDelay, pharmacyMessage, pickupDeadline |
| PUT | `/medication-request/{id}/confirm` | Yes | Confirm selected pharmacy (patient) | selectedPharmacyId |
| PUT | `/medication-request/{id}/pickup` | Yes | Mark as picked up | - |
| GET | `/pharmaciens/{id}/dashboard` | Yes | Get complete dashboard | - |
| GET | `/pharmaciens/{id}/stats` | Yes | Get basic stats only | - |
| GET | `/pharmaciens/{id}/stats/monthly` | Yes | Get monthly stats for chart | - |
| GET | `/pharmaciens/nearby` | No | Search nearby pharmacies (public) | lat, lng, radius |
| GET | `/activity/pharmacy/{id}/feed` | Yes | Get last 8 activities | - |
| GET | `/review/pharmacy/{id}/summary` | Yes | Get review summary | - |
| GET | `/review/pharmacy/{id}` | No | Get pharmacy reviews | rating, page, limit |
| GET | `/boost/pharmacy/{id}/active` | Yes | Get active boost | - |
| PUT | `/pharmaciens/{id}/working-hours` | Yes | Update working hours | workingHours object |
| PUT | `/pharmaciens/{id}/duty` | Yes | Toggle on-duty status | - |
| PUT | `/pharmaciens/{id}/settings` | Yes | Update notification settings | settings object |

---

## ⚠️ Troubleshooting

### Common Issues and Solutions

#### 1. **401 Unauthorized Error**
**Cause:** JWT token has expired or is invalid.

**Solution:**
```dart
if (response.statusCode == 401) {
  await storage.deleteAll();
  // Navigate to login screen
  Navigator.pushReplacementNamed(context, '/login');
}
```

#### 2. **CORS Errors**
**Cause:** Backend CORS not configured properly.

**Solution:** CORS is already configured in your NestJS backend (`app.enableCors()` in `main.ts`). If you still encounter this issue during development:
- Ensure the backend is running on `http://localhost:3001`
- Use the correct base URL in Flutter
- For mobile testing, use your computer's local IP instead of `localhost` (e.g., `http://192.168.1.10:3001`)

#### 3. **Connection Refused / Network Error**
**Cause:** Backend server is not running or base URL is incorrect.

**Checklist:**
- ✅ Verify backend is running: `npm run start:dev`
- ✅ Check terminal for `Application is running on: http://localhost:3001`
- ✅ Test in browser: `http://localhost:3001/api/docs` (should show Swagger UI)
- ✅ For mobile emulator/device testing, replace `localhost` with your computer's IP address

#### 4. **Empty Request List**
**Cause:** No pending requests exist in MongoDB for this pharmacy account.

**Solution:** This is **expected behavior**. The Flutter screen should handle empty lists gracefully:
```dart
if (requests.isEmpty) {
  return Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.inbox, size: 64, color: Colors.grey),
        SizedBox(height: 16),
        Text('Aucune demande en attente'),
      ],
    ),
  );
}
```

To test with data:
```bash
# Run the seed script to create test requests
cd path/to/backend
node create-request-for-pharmacy.js
```

#### 5. **Field Name Mismatch**
**Common Issue:** Backend uses French field names.

**Examples:**
- Password field: `motDePasse` (not `password`)
- Pharmacy name: `nomPharmacie` (not `pharmacyName`)

Always check the API response structure in Swagger or Postman before mapping to Dart models.

#### 6. **Date Parsing Errors**
**Issue:** DateTime parsing fails.

**Solution:**
```dart
// Use try-catch for date parsing
DateTime? parseDate(String? dateStr) {
  if (dateStr == null) return null;
  try {
    return DateTime.parse(dateStr);
  } catch (e) {
    print('Date parse error: $e');
    return null;
  }
}
```

---

## 📱 Testing Checklist

Before deploying to production, verify:

- [ ] Login with valid credentials works
- [ ] Token is stored securely after login
- [ ] Pending requests list loads (even if empty)
- [ ] Responding to a request works (accept/decline)
- [ ] Dashboard loads all sections correctly
- [ ] 401 errors trigger logout and redirect to login
- [ ] Empty states display appropriate messages
- [ ] Network errors show user-friendly messages
- [ ] Token is included in all authenticated requests

---

## 🔗 Additional Resources

- **Swagger Documentation:** `http://localhost:3001/api/docs`
- **Test Pharmacy Accounts:** Check MongoDB or use seed script
- **Backend Repository:** [Link to your repo]

---

**Last Updated:** February 15, 2026  
**Backend Version:** 1.0.0  
**API Base URL:** `http://localhost:3001/api`
