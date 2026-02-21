# Diabetes Management Backend - Complete API Documentation

**Project Name:** Diabetes Management System  
**Framework:** NestJS + TypeScript  
**Database:** MongoDB with Mongoose ODM  
**API Version:** 1.0  
**Description:** A comprehensive backend system for managing diabetes with support for Patients, Doctors (Médecins), and Pharmacists

---

## 📑 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Authentication & Security](#authentication--security)
4. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication)
   - [Users](#users)
   - [Patients](#patients)
   - [Doctors (Médecins)](#doctors-médecins)
   - [Pharmacists (Pharmaciens)](#pharmacists-pharmaciens)
   - [Glucose Management](#glucose-management)
   - [Nutrition](#nutrition)
   - [Medication Requests](#medication-requests)
   - [Sessions](#sessions)
   - [Reviews](#reviews)
   - [Boosts](#boosts)
   - [Activities](#activities)

---

## 🎯 Project Overview

### Purpose
This project is a diabetes management backend system that enables:
- **Patients** to track their health metrics (glucose levels, nutrition, activities)
- **Doctors** to manage and monitor their patients
- **Pharmacists** to handle medication requests and provide services
- **Cross-role collaboration** for comprehensive patient care

### Tech Stack
- **Framework:** NestJS 11.0.1
- **Language:** TypeScript
- **Database:** MongoDB 8.23.0
- **Authentication:** JWT with Passport.js
- **Validation:** class-validator & class-transformer
- **API Documentation:** Swagger/OpenAPI
- **Password Hashing:** bcrypt
- **Task Scheduling:** NestJS Schedule
- **ORM:** Mongoose 11.0.4

### Key Features
- Multi-role authentication system (Patient, Doctor, Pharmacist)
- Session management with device tracking
- Health metrics tracking (Glucose, Nutrition, Activities)
- Medication request handling
- Pharmacy search by proximity
- Health statistics and analytics
- Review and rating system
- Boost promotions for pharmacies
- Comprehensive audit logging

---

## 🏗️ Architecture

### Architecture Pattern: **Domain-Driven Modular Architecture**

```
NestJS Application (Port: 3000 by default)
├── Auth Module
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   └── DTOs (login, register)
│
├── Users Module
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── user.schema.ts (Discriminator pattern)
│   └── DTOs
│
├── Patients Module
│   ├── patients.controller.ts
│   ├── patients.service.ts
│   ├── patient.schema.ts
│   └── DTOs
│
├── Medecins Module
│   ├── medecins.controller.ts
│   ├── medecins.service.ts
│   ├── medecin.schema.ts
│   └── DTOs
│
├── Pharmaciens Module
│   ├── pharmaciens.controller.ts
│   ├── pharmaciens.service.ts
│   ├── pharmacien.schema.ts
│   └── DTOs
│
├── Glucose Module
│   ├── glucose.controller.ts
│   ├── glucose.service.ts
│   ├── glucose.schema.ts
│   └── DTOs
│
├── Nutrition Module
│   ├── nutrition.controller.ts
│   ├── nutrition.service.ts
│   ├── meal.schema.ts
│   └── DTOs
│
├── Medication Requests Module
│   ├── medication-requests.controller.ts
│   ├── medication-requests.service.ts
│   ├── medication-request.schema.ts
│   └── DTOs
│
├── Sessions Module
│   ├── sessions.controller.ts
│   ├── sessions.service.ts
│   ├── session.schema.ts
│   └── DTOs
│
├── Reviews Module
├── Boosts Module
├── Activities Module
│
└── Common Module
    ├── Guards (JwtAuthGuard, RolesGuard)
    ├── Decorators (CurrentUser, Roles)
    ├── Enums (Role, TypeDiabete, Sexe, etc.)
    └── DTOs (PaginationDto)
```

### Design Patterns Used

| Pattern | Usage | Example |
|---------|-------|---------|
| **Discriminator Pattern** | User type differentiation | Patient, Doctor, Pharmacist in single collection |
| **Guard Pattern** | Access control | JwtAuthGuard, RolesGuard |
| **Decorator Pattern** | Metadata attachment | @Roles(), @CurrentUser() |
| **Repository Pattern** | Data access layer | MongooseModule with schemas |
| **DTO Pattern** | Data validation & transformation | CreatePatientDto, UpdateUserDto |

---

## 🔐 Authentication & Security

### Authentication Flow

1. **Registration**: User registers as Patient, Doctor, or Pharmacist
2. **JWT Issuance**: Upon successful login, JWT token with user ID and role is issued
3. **Token Usage**: Token sent in `Authorization: Bearer <token>` header
4. **Session Tracking**: Session created with device info, IP address, and user agent

### JWT Claims
```json
{
  "sub": "user_id",
  "role": "PATIENT|MEDECIN|PHARMACIEN",
  "iat": 1708425600,
  "exp": 1708512000
}
```

### Guards & Decorators

| Guard/Decorator | Purpose |
|-----------------|---------|
| `@UseGuards(JwtAuthGuard)` | Validates JWT token |
| `@UseGuards(RolesGuard)` | Validates user role |
| `@Roles(Role.PATIENT)` | Restricts endpoint to specific role |
| `@CurrentUser()` | Injects current authenticated user |

### Enums & Constants

**Roles:**
- `PATIENT` - Individual managing their health
- `MEDECIN` - Doctor/Medical professional
- `PHARMACIEN` - Pharmacist
- `ADMIN` - System administrator

**Diabetes Types:**
- `TYPE_1` - Type 1 Diabetes
- `TYPE_2` - Type 2 Diabetes
- `GESTATIONAL` - Gestational Diabetes
- `OTHER` - Other types

**Gender:**
- `MALE` - Male
- `FEMALE` - Female
- `OTHER` - Other

---

## 🔌 API Endpoints

### Authentication

#### 1. Register Patient
**Endpoint:** `POST /api/auth/register/patient`  
**Access:** Public  
**Description:** Register a new patient account

**Request Body:**
```json
{
  "email": "patient@example.com",
  "motDePasse": "securePassword123",
  "nom": "John",
  "prenom": "Doe",
  "dateNaissance": "1990-01-15",
  "sexe": "MALE",
  "taille": 175,
  "poids": 70,
  "typeDiabete": "TYPE_2",
  "dateDiagnostic": "2020-05-10"
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "patient@example.com",
  "nom": "John",
  "prenom": "Doe",
  "role": "PATIENT",
  "typeDiabete": "TYPE_2",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `409 Conflict` - Email already in use
- `400 Bad Request` - Invalid input data

---

#### 2. Register Doctor (Médecin)
**Endpoint:** `POST /api/auth/register/medecin`  
**Access:** Public  
**Description:** Register a new doctor account

**Request Body:**
```json
{
  "email": "doctor@example.com",
  "motDePasse": "securePassword123",
  "nom": "Smith",
  "prenom": "Jane",
  "numeroOrdre": "MED123456",
  "specialite": "Endocrinologie"
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "email": "doctor@example.com",
  "role": "MEDECIN",
  "specialite": "Endocrinologie",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `409 Conflict` - Email or order number already in use
- `400 Bad Request` - Invalid input data

---

#### 3. Register Pharmacist (Pharmacien)
**Endpoint:** `POST /api/auth/register/pharmacien`  
**Access:** Public  
**Description:** Register a new pharmacist account

**Request Body:**
```json
{
  "email": "pharmacist@example.com",
  "motDePasse": "securePassword123",
  "nom": "Brown",
  "prenom": "Robert",
  "numeroOrdre": "PHARM789012",
  "nomPharmacie": "Pharmacie Central",
  "adresse": "123 Rue de la Paix",
  "latitude": 48.856613,
  "longitude": 2.352222,
  "horairesOuverture": "09:00-20:00"
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "email": "pharmacist@example.com",
  "role": "PHARMACIEN",
  "nomPharmacie": "Pharmacie Central",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### 4. Login
**Endpoint:** `POST /api/auth/login`  
**Access:** Public  
**Description:** Authenticate user and create session

**Request Body:**
```json
{
  "email": "user@example.com",
  "motDePasse": "password123"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "role": "PATIENT",
    "nom": "John"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "session": {
    "_id": "507f1f77bcf86cd799439020",
    "deviceInfo": "Mobile Device",
    "ipAddress": "192.168.1.1",
    "createdAt": "2024-02-20T10:30:00Z",
    "expiresAt": "2024-02-22T10:30:00Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid credentials
- `400 Bad Request` - Missing email or password

---

#### 5. Get User Profile
**Endpoint:** `GET /api/auth/profile`  
**Access:** Protected (JWT Required)  
**Description:** Retrieve current user's profile information

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "patient@example.com",
  "nom": "John",
  "prenom": "Doe",
  "role": "PATIENT",
  "typeDiabete": "TYPE_2",
  "poids": 70,
  "taille": 175,
  "createdAt": "2024-02-15T10:30:00Z"
}
```

---

### Users

#### Get All Users
**Endpoint:** `GET /api/users`  
**Access:** Protected (JWT Required)  
**Description:** Retrieve all users with pagination and optional role filtering

**Query Parameters:**
```
?page=1&limit=10&role=PATIENT
```

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10) |
| role | string | Filter by role (PATIENT, MEDECIN, PHARMACIEN, ADMIN) |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "email": "patient@example.com",
      "nom": "John",
      "role": "PATIENT"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 10
}
```

---

#### Get User Statistics
**Endpoint:** `GET /api/users/stats`  
**Access:** Protected (JWT Required)  
**Description:** Get user count statistics grouped by role

**Response:** `200 OK`
```json
{
  "PATIENT": 150,
  "MEDECIN": 25,
  "PHARMACIEN": 15,
  "ADMIN": 2
}
```

---

#### Get User by ID
**Endpoint:** `GET /api/users/:id`  
**Access:** Protected (JWT Required)  
**Description:** Retrieve specific user by ID

**Path Parameters:**
```
:id - User MongoDB ID
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "patient@example.com",
  "nom": "John",
  "prenom": "Doe",
  "role": "PATIENT",
  "createdAt": "2024-02-15T10:30:00Z"
}
```

**Error Responses:**
- `404 Not Found` - User does not exist
- `401 Unauthorized` - Invalid token

---

#### Update User
**Endpoint:** `PATCH /api/users/:id`  
**Access:** Protected (JWT Required)  
**Description:** Update user profile information

**Request Body:**
```json
{
  "prenom": "Jane",
  "poids": 65
}
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "prenom": "Jane",
  "poids": 65
}
```

---

#### Delete User
**Endpoint:** `DELETE /api/users/:id`  
**Access:** Protected (JWT Required)  
**Description:** Delete user account

**Response:** `200 OK`
```json
{
  "message": "User deleted successfully"
}
```

---

### Patients

#### Create Patient (Doctor Only)
**Endpoint:** `POST /api/patients`  
**Access:** Protected (JWT Required) - MEDECIN role only  
**Description:** Create a new patient record

**Request Body:**
```json
{
  "email": "newpatient@example.com",
  "motDePasse": "password123",
  "nom": "Patient",
  "prenom": "New",
  "dateNaissance": "1985-05-20",
  "sexe": "FEMALE",
  "taille": 165,
  "poids": 60,
  "typeDiabete": "TYPE_1"
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439030",
  "email": "newpatient@example.com",
  "nom": "Patient",
  "typeDiabete": "TYPE_1",
  "role": "PATIENT"
}
```

---

#### Get All Patients
**Endpoint:** `GET /api/patients`  
**Access:** Protected (JWT Required) - MEDECIN or PHARMACIEN role  
**Description:** Retrieve all patients with pagination

**Query Parameters:**
```
?page=1&limit=20
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439030",
      "email": "patient@example.com",
      "nom": "Patient",
      "typeDiabete": "TYPE_1",
      "poids": 60,
      "taille": 165
    }
  ],
  "total": 95,
  "page": 1,
  "limit": 20
}
```

---

#### Get Patients by Diabetes Type
**Endpoint:** `GET /api/patients/by-type/:typeDiabete`  
**Access:** Protected (JWT Required) - MEDECIN role  
**Description:** Filter patients by diabetes type

**Path Parameters:**
```
:typeDiabete - TYPE_1 | TYPE_2 | GESTATIONAL | OTHER
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439030",
      "email": "patient@example.com",
      "typeDiabete": "TYPE_1"
    }
  ],
  "total": 45,
  "type": "TYPE_1"
}
```

---

#### Get Patient by ID
**Endpoint:** `GET /api/patients/:id`  
**Access:** Protected (JWT Required) - Patient, Doctor, or Pharmacist  
**Description:** Retrieve specific patient details

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439030",
  "email": "patient@example.com",
  "nom": "John",
  "prenom": "Doe",
  "typeDiabete": "TYPE_2",
  "poids": 70,
  "taille": 175,
  "dateNaissance": "1990-01-15"
}
```

---

#### Update Patient
**Endpoint:** `PATCH /api/patients/:id`  
**Access:** Protected (JWT Required) - Patient or Doctor  
**Description:** Update patient health information

**Request Body:**
```json
{
  "poids": 68,
  "taille": 176,
  "typeDiabete": "TYPE_2"
}
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439030",
  "poids": 68,
  "taille": 176,
  "typeDiabete": "TYPE_2"
}
```

---

#### Delete Patient
**Endpoint:** `DELETE /api/patients/:id`  
**Access:** Protected (JWT Required) - MEDECIN role  
**Description:** Delete patient record

**Response:** `200 OK`
```json
{
  "message": "Patient deleted successfully"
}
```

---

### Doctors (Médecins)

#### Get All Doctors
**Endpoint:** `GET /api/medecins`  
**Access:** Protected (JWT Required)  
**Description:** Retrieve all doctors with pagination and optional specialty filter

**Query Parameters:**
```
?page=1&limit=10&specialite=Endocrinologie
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "email": "doctor@example.com",
      "nom": "Smith",
      "specialite": "Endocrinologie",
      "numeroOrdre": "MED123456",
      "patientIds": ["507f1f77bcf86cd799439030"]
    }
  ],
  "total": 25,
  "page": 1
}
```

---

#### Get Doctor by ID
**Endpoint:** `GET /api/medecins/:id`  
**Access:** Protected (JWT Required)  
**Description:** Retrieve specific doctor details

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "email": "doctor@example.com",
  "nom": "Smith",
  "specialite": "Endocrinologie",
  "patientIds": ["507f1f77bcf86cd799439030", "507f1f77bcf86cd799439031"],
  "moyenneNote": 4.5,
  "nombreAvis": 24
}
```

---

#### Update Doctor
**Endpoint:** `PATCH /api/medecins/:id`  
**Access:** Protected (JWT Required) - MEDECIN role  
**Description:** Update doctor profile

**Request Body:**
```json
{
  "specialite": "Cardiologie"
}
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "specialite": "Cardiologie"
}
```

---

#### Add Patient to Doctor
**Endpoint:** `POST /api/medecins/:id/patients/:patientId`  
**Access:** Protected (JWT Required) - MEDECIN role  
**Description:** Add patient to doctor's patient list

**Response:** `200 OK`
```json
{
  "message": "Patient added successfully",
  "patientIds": ["507f1f77bcf86cd799439030", "507f1f77bcf86cd799439031"]
}
```

---

#### Remove Patient from Doctor
**Endpoint:** `DELETE /api/medecins/:id/patients/:patientId`  
**Access:** Protected (JWT Required) - MEDECIN role  
**Description:** Remove patient from doctor's list

**Response:** `200 OK`
```json
{
  "message": "Patient removed successfully"
}
```

---

#### Rate Doctor
**Endpoint:** `PATCH /api/medecins/:id/note`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Rate a doctor (1-5 stars)

**Request Body:**
```json
{
  "note": 4.5
}
```

**Response:** `200 OK`
```json
{
  "moyenneNote": 4.5,
  "totalNotes": 24
}
```

---

#### Delete Doctor
**Endpoint:** `DELETE /api/medecins/:id`  
**Access:** Protected (JWT Required) - MEDECIN role  
**Description:** Delete doctor account

**Response:** `200 OK`
```json
{
  "message": "Doctor deleted successfully"
}
```

---

### Pharmacists (Pharmaciens)

#### Find Nearby Pharmacies (Public)
**Endpoint:** `GET /api/pharmaciens/nearby`  
**Access:** Public  
**Description:** Find pharmacies near a location

**Query Parameters:**
```
?lat=48.856613&lng=2.352222&radius=5
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| lat | number | Yes | Latitude |
| lng | number | Yes | Longitude |
| radius | number | No | Search radius in km (default: 5) |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "nomPharmacie": "Pharmacie Central",
      "adresse": "123 Rue de la Paix",
      "latitude": 48.856613,
      "longitude": 2.352222,
      "horairesOuverture": "09:00-20:00",
      "distance": 0.5,
      "moyenneNote": 4.7
    }
  ],
  "total": 8
}
```

---

#### Get All Pharmacists
**Endpoint:** `GET /api/pharmaciens`  
**Access:** Protected (JWT Required)  
**Description:** Retrieve all pharmacists with optional filter

**Query Parameters:**
```
?page=1&limit=10&nomPharmacie=Central
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "email": "pharmacist@example.com",
      "nomPharmacie": "Pharmacie Central",
      "adresse": "123 Rue de la Paix",
      "latitude": 48.856613,
      "longitude": 2.352222,
      "medicamentsDispo": ["Metformine", "Insulin"],
      "moyenneNote": 4.7
    }
  ],
  "total": 15
}
```

---

#### Search Pharmacies by Medication
**Endpoint:** `GET /api/pharmaciens/search/medicament`  
**Access:** Protected (JWT Required)  
**Description:** Find pharmacies with specific medication available

**Query Parameters:**
```
?medicament=Metformine&page=1&limit=10
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "nomPharmacie": "Pharmacie Central",
      "medicamentsDispo": ["Metformine", "Insulin"]
    }
  ],
  "total": 3
}
```

---

#### Get Pharmacist by ID
**Endpoint:** `GET /api/pharmaciens/:id`  
**Access:** Protected (JWT Required)  
**Description:** Retrieve specific pharmacist details

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "email": "pharmacist@example.com",
  "nomPharmacie": "Pharmacie Central",
  "adresse": "123 Rue de la Paix",
  "horairesOuverture": "09:00-20:00",
  "medicamentsDispo": ["Metformine", "Insulin"],
  "moyenneNote": 4.7,
  "nombreAvis": 156
}
```

---

#### Update Pharmacist
**Endpoint:** `PATCH /api/pharmaciens/:id`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Update pharmacist/pharmacy information

**Request Body:**
```json
{
  "horairesOuverture": "08:00-21:00",
  "adresse": "456 New Street"
}
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "horairesOuverture": "08:00-21:00",
  "adresse": "456 New Street"
}
```

---

#### Add Medication
**Endpoint:** `POST /api/pharmaciens/:id/medicaments`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Add medication to pharmacy inventory

**Request Body:**
```json
{
  "medicament": "Aspirin"
}
```

**Response:** `200 OK`
```json
{
  "message": "Medication added",
  "medicamentsDispo": ["Metformine", "Insulin", "Aspirin"]
}
```

---

#### Remove Medication
**Endpoint:** `DELETE /api/pharmaciens/:id/medicaments/:medicament`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Remove medication from inventory

**Response:** `200 OK`
```json
{
  "message": "Medication removed"
}
```

---

#### Rate Pharmacist
**Endpoint:** `PATCH /api/pharmaciens/:id/note`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Rate pharmacy (1-5 stars)

**Request Body:**
```json
{
  "note": 4.5
}
```

**Response:** `200 OK`
```json
{
  "moyenneNote": 4.7,
  "totalNotes": 157
}
```

---

#### Delete Pharmacist
**Endpoint:** `DELETE /api/pharmaciens/:id`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Delete pharmacist account

**Response:** `200 OK`
```json
{
  "message": "Pharmacist deleted successfully"
}
```

---

### Glucose Management

#### Record Glucose Level
**Endpoint:** `POST /api/glucose`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Create a new glucose measurement

**Request Body:**
```json
{
  "value": 145,
  "measuredAt": "2024-02-20T10:30:00Z",
  "period": "BEFORE_MEALS",
  "note": "Before breakfast"
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439040",
  "patientId": "507f1f77bcf86cd799439030",
  "value": 145,
  "measuredAt": "2024-02-20T10:30:00Z",
  "period": "BEFORE_MEALS",
  "note": "Before breakfast",
  "createdAt": "2024-02-20T10:30:00Z"
}
```

---

#### Get My Glucose Records
**Endpoint:** `GET /api/glucose/my-records`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Retrieve user's glucose measurements with pagination

**Query Parameters:**
```
?page=1&limit=20
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439040",
      "value": 145,
      "measuredAt": "2024-02-20T10:30:00Z",
      "period": "BEFORE_MEALS"
    }
  ],
  "total": 85,
  "page": 1
}
```

---

#### Filter by Date Range
**Endpoint:** `GET /api/glucose`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Get glucose records within date range

**Query Parameters:**
```
?start=2024-02-01T00:00:00Z&end=2024-02-28T23:59:59Z
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439040",
      "value": 145,
      "measuredAt": "2024-02-20T10:30:00Z"
    }
  ],
  "total": 28
}
```

---

#### Weekly Statistics
**Endpoint:** `GET /api/glucose/stats/weekly`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Get glucose statistics for last 7 days

**Response:** `200 OK`
```json
{
  "average": 142.5,
  "min": 110,
  "max": 185,
  "dataPoints": 18,
  "period": "last_7_days"
}
```

---

#### Monthly Statistics
**Endpoint:** `GET /api/glucose/stats/monthly`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Get glucose statistics for last 30 days

**Response:** `200 OK`
```json
{
  "average": 138.2,
  "min": 95,
  "max": 215,
  "dataPoints": 85,
  "period": "last_30_days"
}
```

---

#### Daily Average
**Endpoint:** `GET /api/glucose/stats/daily-average`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Get average glucose grouped by day

**Query Parameters:**
```
?days=30
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "date": "2024-02-01",
      "average": 135.5,
      "count": 3
    },
    {
      "date": "2024-02-02",
      "average": 142.0,
      "count": 4
    }
  ]
}
```

---

#### Alerts Statistics
**Endpoint:** `GET /api/glucose/stats/alerts`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Get hypo/hyper alerts count for last 30 days

**Response:** `200 OK`
```json
{
  "hypoglycemia": 5,
  "hyperglycemia": 12,
  "total": 17,
  "period": "last_30_days"
}
```

---

#### HbA1c Estimation
**Endpoint:** `GET /api/glucose/stats/hba1c`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Estimate HbA1c based on last 90 days

**Response:** `200 OK`
```json
{
  "estimatedHbA1c": 7.2,
  "basedOnDays": 90,
  "dataPoints": 250,
  "note": "Based on average glucose: 155 mg/dL"
}
```

---

#### Time in Range
**Endpoint:** `GET /api/glucose/stats/time-in-range`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Percentage of time glucose in target range

**Query Parameters:**
```
?days=30
```

**Response:** `200 OK`
```json
{
  "targetRangeStart": 80,
  "targetRangeEnd": 130,
  "percentageInRange": 68.5,
  "percentageHigher": 22.0,
  "percentageLower": 9.5,
  "period": "last_30_days"
}
```

---

#### Chart Data
**Endpoint:** `GET /api/glucose/stats/chart`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Get data formatted for charts

**Query Parameters:**
```
?period=7d
```

**Response:** `200 OK`
```json
{
  "period": "7d",
  "data": [
    {"date": "2024-02-14", "values": [125, 142, 155]},
    {"date": "2024-02-15", "values": [118, 138, 162]}
  ]
}
```

---

#### Trend Analysis
**Endpoint:** `GET /api/glucose/stats/trend`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Compare last 7 days vs previous 7 days

**Response:** `200 OK`
```json
{
  "currentPeriod": {
    "average": 142.5,
    "days": "2024-02-14 to 2024-02-20"
  },
  "previousPeriod": {
    "average": 138.2,
    "days": "2024-02-07 to 2024-02-13"
  },
  "trend": "UP",
  "changePercent": 3.1
}
```

---

#### Get Single Glucose Record
**Endpoint:** `GET /api/glucose/:id`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Retrieve specific glucose measurement

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439040",
  "patientId": "507f1f77bcf86cd799439030",
  "value": 145,
  "measuredAt": "2024-02-20T10:30:00Z",
  "period": "BEFORE_MEALS",
  "note": "Before breakfast"
}
```

---

#### Update Glucose Record
**Endpoint:** `PATCH /api/glucose/:id`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Update glucose measurement

**Request Body:**
```json
{
  "value": 142,
  "note": "Updated - more accurate"
}
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439040",
  "value": 142,
  "note": "Updated - more accurate"
}
```

---

#### Delete Glucose Record
**Endpoint:** `DELETE /api/glucose/:id`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Delete glucose measurement

**Response:** `200 OK`
```json
{
  "message": "Glucose record deleted successfully"
}
```

---

### Nutrition

#### Create Meal
**Endpoint:** `POST /api/nutrition/meals`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Record a new meal

**Request Body:**
```json
{
  "name": "Breakfast",
  "eatenAt": "2024-02-20T08:00:00Z",
  "carbs": 45,
  "protein": 20,
  "fat": 10,
  "calories": 350,
  "note": "Whole grain toast with eggs",
  "source": "MANUAL"
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439050",
  "patientId": "507f1f77bcf86cd799439030",
  "name": "Breakfast",
  "carbs": 45,
  "protein": 20,
  "fat": 10,
  "calories": 350,
  "eatenAt": "2024-02-20T08:00:00Z",
  "createdAt": "2024-02-20T08:00:00Z"
}
```

---

#### Get All Meals
**Endpoint:** `GET /api/nutrition/meals`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Retrieve meals with optional date filtering

**Query Parameters:**
```
?start=2024-02-01T00:00:00Z&end=2024-02-28T23:59:59Z&page=1&limit=20
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439050",
      "name": "Breakfast",
      "carbs": 45,
      "calories": 350,
      "eatenAt": "2024-02-20T08:00:00Z"
    }
  ],
  "total": 65,
  "page": 1
}
```

---

#### Get Meal by ID
**Endpoint:** `GET /api/nutrition/meals/:id`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Retrieve specific meal details

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439050",
  "name": "Breakfast",
  "carbs": 45,
  "protein": 20,
  "fat": 10,
  "calories": 350,
  "note": "Whole grain toast with eggs",
  "foods": ["507f1f77bcf86cd799439051"]
}
```

---

#### Update Meal
**Endpoint:** `PATCH /api/nutrition/meals/:id`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Update meal information

**Request Body:**
```json
{
  "carbs": 48,
  "calories": 360
}
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439050",
  "carbs": 48,
  "calories": 360
}
```

---

#### Delete Meal
**Endpoint:** `DELETE /api/nutrition/meals/:id`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Delete meal record

**Response:** `200 OK`
```json
{
  "message": "Meal deleted successfully"
}
```

---

#### Add Food Item to Meal
**Endpoint:** `POST /api/nutrition/meals/:mealId/foods`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Add specific food item to meal

**Request Body:**
```json
{
  "name": "Whole Wheat Bread",
  "quantity": 2,
  "unit": "slices",
  "carbs": 30,
  "protein": 8,
  "fat": 2,
  "calories": 160
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439051",
  "name": "Whole Wheat Bread",
  "quantity": 2,
  "carbs": 30
}
```

---

#### Get Food Items in Meal
**Endpoint:** `GET /api/nutrition/meals/:mealId/foods`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Get all foods in specific meal

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439051",
      "name": "Whole Wheat Bread",
      "quantity": 2,
      "unit": "slices",
      "carbs": 30
    }
  ],
  "total": 2
}
```

---

#### Update Food Item
**Endpoint:** `PATCH /api/nutrition/meals/:mealId/foods/:id`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Update food item details

**Request Body:**
```json
{
  "quantity": 3
}
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439051",
  "quantity": 3
}
```

---

#### Delete Food Item
**Endpoint:** `DELETE /api/nutrition/meals/:mealId/foods/:id`  
**Access:** Protected (JWT Required) - PATIENT role  
**Description:** Remove food from meal

**Response:** `200 OK`
```json
{
  "message": "Food item deleted successfully"
}
```

---

### Medication Requests

#### Create Medication Request
**Endpoint:** `POST /api/medication-request`  
**Access:** Public  
**Description:** Patient creates medication request to pharmacies

**Request Body:**
```json
{
  "patientId": "507f1f77bcf86cd799439030",
  "medicationName": "Metformine",
  "dosage": "500mg",
  "quantity": 30,
  "prescriptionDate": "2024-02-20",
  "expiryDate": "2025-02-20",
  "pharmacyIds": ["507f1f77bcf86cd799439013", "507f1f77bcf86cd799439014"]
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439060",
  "patientId": "507f1f77bcf86cd799439030",
  "medicationName": "Metformine",
  "dosage": "500mg",
  "quantity": 30,
  "status": "PENDING",
  "createdAt": "2024-02-20T10:30:00Z",
  "expiresAt": "2024-02-20T14:30:00Z"
}
```

---

#### Create Simple Test Request (Testing)
**Endpoint:** `POST /api/medication-request/test/simple`  
**Access:** Public  
**Description:** Simplified request for testing (3 fields, expires in 3-4h)

**Request Body:**
```json
{
  "patientId": "507f1f77bcf86cd799439030",
  "medicationName": "Aspirin",
  "pharmacyId": "507f1f77bcf86cd799439013"
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439061",
  "medicationName": "Aspirin",
  "status": "PENDING",
  "expiresAt": "2024-02-20T13:30:00Z"
}
```

---

#### Get Pending Requests (Pharmacist)
**Endpoint:** `GET /api/medication-request/pharmacy/:pharmacyId/pending`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Get all pending medication requests for pharmacy

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439060",
      "patientId": "507f1f77bcf86cd799439030",
      "medicationName": "Metformine",
      "dosage": "500mg",
      "quantity": 30,
      "status": "PENDING",
      "createdAt": "2024-02-20T10:30:00Z"
    }
  ],
  "total": 8
}
```

---

#### Get Request History (Pharmacist)
**Endpoint:** `GET /api/medication-request/pharmacy/:pharmacyId/history`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Get request history with pagination and filtering

**Query Parameters:**
```
?page=1&limit=20&status=COMPLETED&startDate=2024-02-01&endDate=2024-02-28&medicationName=Metformine
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439060",
      "medicationName": "Metformine",
      "status": "COMPLETED",
      "createdAt": "2024-02-20T10:30:00Z",
      "completedAt": "2024-02-20T11:45:00Z"
    }
  ],
  "total": 45,
  "page": 1
}
```

---

#### Get Request by ID
**Endpoint:** `GET /api/medication-request/:id`  
**Access:** Protected (JWT Required)  
**Description:** Retrieve specific medication request

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439060",
  "patientId": "507f1f77bcf86cd799439030",
  "medicationName": "Metformine",
  "dosage": "500mg",
  "quantity": 30,
  "status": "PENDING",
  "responses": [],
  "createdAt": "2024-02-20T10:30:00Z"
}
```

---

#### Respond to Request (Pharmacist)
**Endpoint:** `PUT /api/medication-request/:id/respond`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Pharmacist responds to medication request

**Request Body:**
```json
{
  "pharmacyId": "507f1f77bcf86cd799439013",
  "available": true,
  "price": 25.50,
  "deliveryTime": "30 minutes"
}
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439060",
  "status": "RESPONDED",
  "responses": [
    {
      "pharmacyId": "507f1f77bcf86cd799439013",
      "available": true,
      "price": 25.50,
      "deliveryTime": "30 minutes"
    }
  ]
}
```

---

#### Confirm Selected Pharmacy
**Endpoint:** `PUT /api/medication-request/:id/confirm`  
**Access:** Protected (JWT Required)  
**Description:** Patient confirms selected pharmacy

**Request Body:**
```json
{
  "selectedPharmacyId": "507f1f77bcf86cd799439013"
}
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439060",
  "status": "CONFIRMED",
  "selectedPharmacyId": "507f1f77bcf86cd799439013"
}
```

---

#### Mark as Picked Up
**Endpoint:** `PUT /api/medication-request/:id/pickup`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Mark request as picked up by patient

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439060",
  "status": "PICKED_UP",
  "pickedUpAt": "2024-02-20T11:45:00Z"
}
```

---

### Sessions

#### Get Active Sessions
**Endpoint:** `GET /api/sessions/active`  
**Access:** Protected (JWT Required)  
**Description:** Retrieve all active user sessions

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439070",
      "deviceInfo": "Mobile Device",
      "ipAddress": "192.168.1.1",
      "lastActivityAt": "2024-02-20T10:30:00Z",
      "createdAt": "2024-02-19T10:30:00Z",
      "expiresAt": "2024-02-22T10:30:00Z",
      "isCurrent": true
    }
  ]
}
```

---

#### Count Active Sessions
**Endpoint:** `GET /api/sessions/count`  
**Access:** Protected (JWT Required)  
**Description:** Get count of active sessions

**Response:** `200 OK`
```json
{
  "count": 3
}
```

---

#### Logout Current Session
**Endpoint:** `DELETE /api/sessions/current`  
**Access:** Protected (JWT Required)  
**Description:** Logout from current device

**Response:** `200 OK`
```json
{
  "message": "Logout successful"
}
```

---

#### Logout All Devices
**Endpoint:** `DELETE /api/sessions/all`  
**Access:** Protected (JWT Required)  
**Description:** Logout from all devices

**Response:** `200 OK`
```json
{
  "message": "Logged out from 3 device(s)",
  "count": 3
}
```

---

#### Revoke Specific Session
**Endpoint:** `DELETE /api/sessions/:sessionId`  
**Access:** Protected (JWT Required)  
**Description:** Revoke specific session by ID

**Response:** `200 OK`
```json
{
  "message": "Session revoked successfully"
}
```

---

### Reviews

#### Create Review
**Endpoint:** `POST /api/review`  
**Access:** Public  
**Description:** Create review for pharmacy

**Request Body:**
```json
{
  "pharmacyId": "507f1f77bcf86cd799439013",
  "patientName": "John Doe",
  "rating": 4,
  "title": "Great service",
  "comment": "Excellent service and friendly staff"
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439080",
  "pharmacyId": "507f1f77bcf86cd799439013",
  "patientName": "John Doe",
  "rating": 4,
  "title": "Great service",
  "comment": "Excellent service and friendly staff",
  "createdAt": "2024-02-20T10:30:00Z"
}
```

---

#### Get Pharmacy Reviews
**Endpoint:** `GET /api/review/pharmacy/:pharmacyId`  
**Access:** Public  
**Description:** Get all reviews for pharmacy with optional filtering

**Query Parameters:**
```
?rating=4&page=1&limit=20
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439080",
      "patientName": "John Doe",
      "rating": 4,
      "title": "Great service",
      "comment": "Excellent service and friendly staff",
      "createdAt": "2024-02-20T10:30:00Z"
    }
  ],
  "total": 156,
  "page": 1
}
```

---

#### Get Review Summary
**Endpoint:** `GET /api/review/pharmacy/:pharmacyId/summary`  
**Access:** Public  
**Description:** Get review statistics for pharmacy

**Response:** `200 OK`
```json
{
  "averageRating": 4.5,
  "totalReviews": 156,
  "ratingDistribution": {
    "5": 85,
    "4": 45,
    "3": 18,
    "2": 6,
    "1": 2
  }
}
```

---

#### Delete Review
**Endpoint:** `DELETE /api/review/:id`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Delete review (pharmacist only)

**Response:** `200 OK`
```json
{
  "message": "Review deleted successfully"
}
```

---

### Boosts

#### Activate Boost
**Endpoint:** `POST /api/boost`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Activate promotion boost for pharmacy

**Request Body:**
```json
{
  "pharmacyId": "507f1f77bcf86cd799439013",
  "discountPercentage": 15,
  "startDate": "2024-02-20T00:00:00Z",
  "endDate": "2024-02-27T23:59:59Z"
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439090",
  "pharmacyId": "507f1f77bcf86cd799439013",
  "discountPercentage": 15,
  "status": "ACTIVE",
  "startDate": "2024-02-20T00:00:00Z",
  "endDate": "2024-02-27T23:59:59Z"
}
```

---

#### Get Pharmacy Boosts
**Endpoint:** `GET /api/boost/pharmacy/:id`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Get all boosts for pharmacy

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439090",
      "pharmacyId": "507f1f77bcf86cd799439013",
      "discountPercentage": 15,
      "status": "ACTIVE",
      "startDate": "2024-02-20T00:00:00Z",
      "endDate": "2024-02-27T23:59:59Z"
    }
  ]
}
```

---

#### Get Active Boost
**Endpoint:** `GET /api/boost/pharmacy/:id/active`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Get currently active boost

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439090",
  "discountPercentage": 15,
  "status": "ACTIVE",
  "daysRemaining": 5
}
```

---

#### Cancel Boost
**Endpoint:** `PUT /api/boost/:id/cancel`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Cancel active boost

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439090",
  "status": "CANCELLED",
  "message": "Boost cancelled successfully"
}
```

---

### Activities

#### Get Pharmacy Activities
**Endpoint:** `GET /api/activity/pharmacy/:id`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Get activity log for pharmacy

**Query Parameters:**
```
?page=1&limit=20
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439100",
      "pharmacyId": "507f1f77bcf86cd799439013",
      "action": "medication_request_responded",
      "details": {
        "requestId": "507f1f77bcf86cd799439060",
        "medication": "Metformine"
      },
      "createdAt": "2024-02-20T11:45:00Z"
    }
  ],
  "total": 156,
  "page": 1
}
```

---

#### Get Activity Feed
**Endpoint:** `GET /api/activity/pharmacy/:id/feed`  
**Access:** Protected (JWT Required) - PHARMACIEN role  
**Description:** Get recent activity feed (8 latest activities)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439100",
      "action": "medication_request_responded",
      "details": {
        "medication": "Metformine"
      },
      "createdAt": "2024-02-20T11:45:00Z"
    }
  ],
  "total": 8
}
```

---

## 📊 Data Models

### User Schema (Discriminator Pattern)
```json
{
  "_id": ObjectId,
  "email": "user@example.com",
  "motDePasse": "hashed_password",
  "nom": "Smith",
  "prenom": "John",
  "role": "PATIENT|MEDECIN|PHARMACIEN",
  "createdAt": ISODate,
  "updatedAt": ISODate,
  "userType": "patient|medecin|pharmacien"
}
```

### Patient Additional Fields
```json
{
  "dateNaissance": ISODate,
  "sexe": "MALE|FEMALE|OTHER",
  "taille": Number,
  "poids": Number,
  "typeDiabete": "TYPE_1|TYPE_2|GESTATIONAL|OTHER",
  "dateDiagnostic": ISODate,
  "medecinIds": [ObjectId],
  "medicamentIds": [ObjectId]
}
```

### Glucose Record
```json
{
  "_id": ObjectId,
  "patientId": ObjectId,
  "value": 145,
  "measuredAt": ISODate,
  "period": "BEFORE_MEALS|AFTER_MEALS|BEDTIME|FASTING",
  "note": "Before breakfast",
  "createdAt": ISODate
}
```

### Meal Record
```json
{
  "_id": ObjectId,
  "patientId": ObjectId,
  "name": "Breakfast",
  "eatenAt": ISODate,
  "carbs": 45,
  "protein": 20,
  "fat": 10,
  "calories": 350,
  "note": "Whole grain toast",
  "source": "MANUAL|WEARABLE",
  "foods": [ObjectId],
  "createdAt": ISODate
}
```

---

## 🔄 Common Response Formats

### Success Response
```json
{
  "statusCode": 200,
  "data": { ... },
  "message": "Operation successful"
}
```

### Paginated Response
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

### Error Response
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Must be valid email"
    }
  ]
}
```

---

## 🚀 Example Usage Scenarios

### Scenario 1: Patient Tracks Glucose & Nutrition
1. **Register** → `POST /api/auth/register/patient`
2. **Login** → `POST /api/auth/login`
3. **Record Glucose** → `POST /api/glucose`
4. **Record Meal** → `POST /api/nutrition/meals`
5. **View Weekly Stats** → `GET /api/glucose/stats/weekly`
6. **Get HbA1c Estimate** → `GET /api/glucose/stats/hba1c`

### Scenario 2: Doctor Manages Patients
1. **Register** → `POST /api/auth/register/medecin`
2. **Login** → `POST /api/auth/login`
3. **Get All Patients** → `GET /api/patients`
4. **Filter by Diabetes Type** → `GET /api/patients/by-type/TYPE_2`
5. **Add Patient to List** → `POST /api/medecins/:id/patients/:patientId`
6. **View Patient Details** → `GET /api/patients/:id`

### Scenario 3: Patient Requests Medication
1. **Find Nearby Pharmacies** → `GET /api/pharmaciens/nearby?lat=48.856613&lng=2.352222`
2. **Create Request** → `POST /api/medication-request`
3. **Wait for Responses** → `GET /api/medication-request/:id`
4. **Confirm Pharmacy** → `PUT /api/medication-request/:id/confirm`
5. **Leave Review** → `POST /api/review`

### Scenario 4: Pharmacist Manages Operations
1. **Register** → `POST /api/auth/register/pharmacien`
2. **Get Pending Requests** → `GET /api/medication-request/pharmacy/:id/pending`
3. **Respond to Request** → `PUT /api/medication-request/:id/respond`
4. **Manage Inventory** → `POST /api/pharmaciens/:id/medicaments`
5. **View Activity Log** → `GET /api/activity/pharmacy/:id`
6. **Activate Promotion** → `POST /api/boost`

---

## 📝 Notes & Best Practices

1. **Authentication**: Always include JWT token in Authorization header
2. **Pagination**: Default limit is 10 items, max is 100
3. **Date Format**: Use ISO 8601 format (2024-02-20T10:30:00Z)
4. **Validation**: Class-validator DTOs ensure data integrity
5. **CORS**: Configured for cross-origin requests
6. **Error Handling**: Detailed error messages provide debugging information
7. **Rate Limiting**: Consider implementing for production
8. **Password Security**: Minimum 6 characters, bcrypt hashing
9. **Session Expiry**: Default 48 hours (2 days)
10. **Decimal Precision**: Use appropriate precision for health metrics

---

## 📌 Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017/diabetes
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=48h
CORS_ORIGIN=*
NODE_ENV=development
PORT=3000
```

---

**Last Updated:** February 20, 2026  
**API Version:** 1.0  
**Documentation Status:** Complete
