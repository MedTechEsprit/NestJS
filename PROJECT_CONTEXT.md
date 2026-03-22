# PROJECT_CONTEXT.md — Diabetes Management Backend

> Généré le 1 mars 2026. Ce document décrit entièrement l'architecture, les endpoints, les modèles et les conventions du projet pour tout développeur ou IA prenant en charge ce code.

---

## 1. Vue générale du projet

### Nom et but
**`diabetes-backend`** — API REST backend pour une application mobile/web de gestion du diabète.  
Elle centralise la gestion des **patients diabétiques**, de leurs **médecins** et de leurs **pharmaciens**, avec des fonctionnalités médicales (glycémie, nutrition, rendez-vous, ordonnances) et des fonctionnalités communautaires (messagerie, avis, gamification pharmacies).

### Stack technique
| Catégorie | Technologie | Version |
|---|---|---|
| Framework | NestJS | ^11.0.1 |
| Runtime | Node.js + TypeScript | TS 5.7.3 |
| Base de données | MongoDB + Mongoose | ^8.23.0 |
| ORM/ODM | `@nestjs/mongoose` | ^11.0.4 |
| Auth | JWT + Passport | `@nestjs/jwt` ^11.0.2 |
| Validation | class-validator + class-transformer | ^0.14.3 |
| Documentation | Swagger / OpenAPI | `@nestjs/swagger` ^11.2.6 |
| Tâches planifiées | `@nestjs/schedule` (node-cron) | ^6.1.1 |
| Chiffrement | bcrypt | ^6.0.0 |
| HTTP client | axios | ^1.13.5 |
| IA externe | FastAPI (Python, 2 serveurs distincts) | — |

### URLs de démarrage
- **API** : `http://localhost:3000/api`
- **Swagger** : `http://localhost:3000/api/docs`

---

## 2. Architecture

### Principe architectural
- **Discriminator Mongoose** : Un seul document MongoDB dans la collection `users`, avec un champ `role` (`PATIENT` | `MEDECIN` | `PHARMACIEN`) comme clé discriminante. Les schémas `Patient`, `Medecin`, `Pharmacien` héritent de `User`.
- **Global prefix** : Toutes les routes sont préfixées par `/api`
- **Validation globale** : `ValidationPipe` avec `whitelist: true`, `transform: true`
- **CORS** : Activé (configurable via `CORS_ORIGIN`)

### Liste de tous les modules

| Module | Dossier | Rôle |
|---|---|---|
| `AppModule` | `src/` | Racine, importe tous les modules |
| `AuthModule` | `src/auth/` | Inscription, connexion, profil, JWT |
| `UsersModule` | `src/users/` | CRUD utilisateurs génériques |
| `PatientsModule` | `src/patients/` | CRUD patients, recherche, filtre par type de diabète |
| `MedecinsModule` | `src/medecins/` | CRUD médecins, gestion des patients du médecin |
| `PharmaciensModule` | `src/pharmaciens/` | CRUD pharmaciens, géolocalisation, médicaments disponibles |
| `SessionsModule` | `src/sessions/` | Gestion des sessions JWT (multi-device) |
| `GlucoseModule` | `src/glucose/` | Enregistrements glycémie, statistiques avancées |
| `NutritionModule` | `src/nutrition/` | Repas (meals) et aliments (food items), nutrition tracking |
| `AppointmentsModule` | `src/appointments/` | Rendez-vous médecin-patient |
| `ConversationsModule` | `src/conversations/` | Conversations (chat) entre acteurs |
| `MessagesModule` | `src/messages/` | Messages dans les conversations |
| `MedicationRequestsModule` | `src/medication-requests/` | Demandes de médicaments patient → pharmacie |
| `PatientRequestsModule` | `src/patient-requests/` | Demandes de prise en charge patient → médecin |
| `NotificationsModule` | `src/notifications/` | Notifications utilisateurs |
| `ReviewsModule` | `src/reviews/` | Avis sur les pharmacies |
| `RatingsModule` | `src/ratings/` | Évaluations des demandes, système de points |
| `BoostsModule` | `src/boosts/` | Boost de visibilité pour les pharmacies |
| `ActivitiesModule` | `src/activities/` | Journal d'activité des pharmacies |
| `AiChatModule` | `src/ai-chat/` | Chat IA médical (proxy FastAPI chat) |
| `AiFoodAnalyzerModule` | `src/ai-food-analyzer/` | Analyse d'image d'aliment (proxy FastAPI vision) |
| `ProductsModule` | `src/products/` | Catalogue de produits de la pharmacie |
| `OrdersModule` | `src/orders/` | Commandes patients auprès des pharmacies |
| `CronModule` | `src/cron/` | Tâches planifiées (expiration des demandes toutes les 5 min) |

### Relations entre modules
```
AuthModule
  ├── UsersModule (User schema)
  ├── PatientsModule (Patient discriminator)
  ├── MedecinsModule (Medecin discriminator)
  ├── PharmaciensModule (Pharmacien discriminator)
  └── SessionsModule (création de session au login)

GlucoseModule ←── AiChatModule (récupère les enregistrements du patient)
GlucoseModule ←── AiFoodAnalyzerModule (appel après analyse image)
NutritionModule ←── AiFoodAnalyzerModule (sauvegarde du repas analysé)

MedicationRequestsModule ←── RatingsModule (évaluation post-demande)
MedicationRequestsModule ←── CronModule (expiration automatique)
MedicationRequestsModule ←── ActivitiesModule (log des actions)

PharmaciensModule ←── BoostsModule, ReviewsModule, RatingsModule, ActivitiesModule
MedecinsModule ←── PatientRequestsModule, AppointmentsModule

ConversationsModule ←── MessagesModule (messages dans une conv)
```

### Structure des dossiers
```
src/
├── app.module.ts           # Module racine
├── main.ts                 # Bootstrap (CORS, Swagger, ValidationPipe, prefix /api)
├── auth/                   # Auth JWT + inscription 3 rôles
│   ├── dto/                # LoginDto, RegisterPatientDto, RegisterMedecinDto, RegisterPharmacienDto
│   └── strategies/         # jwt.strategy.ts (valide le token + la session)
├── common/
│   ├── decorators/         # @CurrentUser(), @Roles()
│   ├── dto/                # PaginationDto
│   ├── enums/              # Role, StatutCompte, TypeDiabete, Sexe
│   ├── guards/             # JwtAuthGuard, RolesGuard
│   └── services/           # PointsCalculatorService
├── users/                  # Schéma User (base discriminator)
├── patients/               # Schéma Patient + ProfilMedical
├── medecins/               # Schéma Medecin
├── pharmaciens/            # Schéma Pharmacien (géoloc, points, badges)
├── sessions/               # Schéma Session (token, device, IP, lastActivity)
├── glucose/                # Schéma Glucose (mesures + stats)
├── nutrition/              # Schémas Meal + FoodItem
├── appointments/           # Schéma Appointment
├── conversations/          # Schéma Conversation
├── messages/               # Schéma Message
├── medication-requests/    # Schéma MedicationRequest (multi-pharmacie)
├── patient-requests/       # Schéma PatientRequest (patient → médecin)
├── notifications/          # Schéma Notification
├── reviews/                # Schéma Review (avis pharmacie)
├── ratings/                # Schéma Rating (évaluation post-demande)
├── boosts/                 # Schéma Boost (visibilité pharmacie)
├── activities/             # Schéma PharmacyActivity
├── ai-chat/                # Proxy vers FastAPI /chat
├── ai-food-analyzer/       # Proxy vers FastAPI /analyze-image + /chat
├── products/               # Schéma Product (catalogue pharmacie)
├── orders/                 # Schéma Order (commande patient)
└── cron/                   # CronService (toutes les 5 min)
```

---

## 3. Endpoints API

> Préfixe global : `/api`  
> Auth : `Bearer <JWT>` dans le header `Authorization`  
> `[JWT]` = nécessite `JwtAuthGuard` | `[ROLE]` = nécessite `RolesGuard` avec le rôle indiqué

### Auth — `/api/auth`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| POST | `/auth/register/patient` | Inscription patient | Public |
| POST | `/auth/register/medecin` | Inscription médecin | Public |
| POST | `/auth/register/pharmacien` | Inscription pharmacien | Public |
| POST | `/auth/login` | Connexion (retourne JWT + créé session) | Public |
| GET | `/auth/profile` | Profil de l'utilisateur connecté | [JWT] |

### Users — `/api/users`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| GET | `/users` | Liste paginée, filtre par rôle | [JWT] |
| GET | `/users/stats` | Statistiques par rôle | [JWT] |
| GET | `/users/:id` | Détail utilisateur | [JWT] |
| PATCH | `/users/:id` | Mise à jour utilisateur | [JWT] |
| DELETE | `/users/:id` | Supprimer utilisateur | [JWT] |

### Patients — `/api/patients`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| POST | `/patients` | Créer patient | [JWT] [MEDECIN] |
| GET | `/patients` | Liste paginée | [JWT] [MEDECIN/PHARMACIEN] |
| GET | `/patients/by-type/:typeDiabete` | Filtrer par type diabète | [JWT] [MEDECIN] |
| GET | `/patients/debug/all-roles` | Debug: liste tous les users | [JWT] [MEDECIN/PHARMACIEN] |
| GET | `/patients/search/by-name-or-email` | Recherche par nom/email | [JWT] [MEDECIN/PHARMACIEN] |
| GET | `/patients/:id` | Détail patient | [JWT] tous rôles |
| PATCH | `/patients/:id` | Modifier patient | [JWT] [PATIENT/MEDECIN] |
| DELETE | `/patients/:id` | Supprimer patient | [JWT] [MEDECIN] |

### Médecins — `/api/medecins`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| GET | `/medecins` | Liste paginée, filtrer par spécialité | [JWT] |
| GET | `/medecins/patient/:patientId/my-doctors` | Médecins du patient | [JWT] [PATIENT] |
| GET | `/medecins/:id` | Détail médecin | [JWT] |
| PATCH | `/medecins/:id` | Modifier médecin | [JWT] [MEDECIN] |
| DELETE | `/medecins/:id` | Supprimer médecin | [JWT] [MEDECIN] |
| POST | `/medecins/:id/patients/:patientId` | Ajouter patient à liste | [JWT] [MEDECIN] |
| DELETE | `/medecins/:id/patients/:patientId` | Retirer patient de liste | [JWT] [MEDECIN] |
| PATCH | `/medecins/:id/note` | Noter le médecin | [JWT] [PATIENT] |
| GET | `/medecins/:id/my-patients` | Liste patients du médecin (filtres, pagination) | [JWT] [MEDECIN] |
| PATCH | `/medecins/:id/toggle-status` | Basculer ACTIF/INACTIF | [JWT] [MEDECIN] |
| GET | `/medecins/:id/status` | Statut du compte | [JWT] [MEDECIN] |

### Pharmaciens — `/api/pharmaciens`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| GET | `/pharmaciens/nearby` | Pharmacies proches (lat/lng/radius) | **Public** |
| POST | `/pharmaciens` | Créer pharmacien | [JWT] [PHARMACIEN] |
| GET | `/pharmaciens` | Liste paginée, filtre par nom | [JWT] |
| GET | `/pharmaciens/search/medicament` | Chercher par médicament disponible | [JWT] |
| GET | `/pharmaciens/:id` | Détail pharmacien | [JWT] |
| PATCH | `/pharmaciens/:id` | Modifier pharmacien | [JWT] [PHARMACIEN] |
| DELETE | `/pharmaciens/:id` | Supprimer pharmacien | [JWT] [PHARMACIEN] |
| POST | `/pharmaciens/:id/medicaments` | Ajouter médicament disponible | [JWT] [PHARMACIEN] |
| DELETE | `/pharmaciens/:id/medicaments/:medicament` | Retirer médicament | [JWT] [PHARMACIEN] |
| PATCH | `/pharmaciens/:id/note` | Noter pharmacien | [JWT] [PATIENT] |

### Sessions — `/api/sessions`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| GET | `/sessions/active` | Mes sessions actives | [JWT] |
| GET | `/sessions/count` | Nombre de sessions actives | [JWT] |
| DELETE | `/sessions/current` | Logout session courante | [JWT] |
| DELETE | `/sessions/all` | Logout tous appareils | [JWT] |
| DELETE | `/sessions/:sessionId` | Révoquer une session | [JWT] |

### Glycémie — `/api/glucose`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| POST | `/glucose` | Enregistrer mesure | [JWT] [PATIENT] |
| GET | `/glucose/my-records` | Mes enregistrements (paginés) | [JWT] [PATIENT] |
| GET | `/glucose` | Filtrer par plage de dates | [JWT] [PATIENT] |
| GET | `/glucose/stats/weekly` | Stats 7 derniers jours | [JWT] [PATIENT] |
| GET | `/glucose/stats/monthly` | Stats 30 derniers jours | [JWT] [PATIENT] |
| GET | `/glucose/stats/daily-average` | Moyenne quotidienne (n jours) | [JWT] [PATIENT] |
| GET | `/glucose/stats/alerts` | Alertes hypo/hyperglycémie | [JWT] [PATIENT] |
| GET | `/glucose/stats/hba1c` | Estimation HbA1c (90j) | [JWT] [PATIENT] |
| GET | `/glucose/stats/time-in-range` | % temps dans plage cible | [JWT] [PATIENT] |
| GET | `/glucose/stats/chart` | Données pour graphiques (7d/30d/90d) | [JWT] [PATIENT] |
| GET | `/glucose/stats/trend` | Tendance (7j vs 7j précédents) | [JWT] [PATIENT] |
| GET | `/glucose/:id` | Détail d'une mesure | [JWT] [PATIENT] |
| PATCH | `/glucose/:id` | Modifier une mesure | [JWT] [PATIENT] |
| DELETE | `/glucose/:id` | Supprimer une mesure | [JWT] [PATIENT] |

### Nutrition — `/api/nutrition`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| POST | `/nutrition/meals` | Créer repas | [JWT] [PATIENT] |
| GET | `/nutrition/meals` | Liste repas (filtres dates, pagination) | [JWT] [PATIENT] |
| GET | `/nutrition/meals/:id` | Détail repas | [JWT] [PATIENT] |
| PATCH | `/nutrition/meals/:id` | Modifier repas | [JWT] [PATIENT] |
| DELETE | `/nutrition/meals/:id` | Supprimer repas | [JWT] [PATIENT] |
| POST | `/nutrition/meals/:mealId/foods` | Ajouter aliment au repas | [JWT] [PATIENT] |

### Rendez-vous — `/api/appointments`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| POST | `/appointments` | Créer rendez-vous | [JWT] [PATIENT/MEDECIN] |
| GET | `/appointments/doctor/:doctorId/upcoming` | RDV à venir (7 jours) | [JWT] [MEDECIN/PATIENT] |
| GET | `/appointments/doctor/:doctorId/stats` | Stats RDV médecin | [JWT] [MEDECIN] |
| GET | `/appointments/doctor/:doctorId` | Tous RDV médecin (filtres) | [JWT] nombreux rôles |
| GET | `/appointments/patient/:patientId` | Tous RDV patient | [JWT] [PATIENT/MEDECIN] |
| GET | `/appointments/:id` | Détail RDV | [JWT] |
| PATCH | `/appointments/:id` | Modifier RDV | [JWT] [PATIENT/MEDECIN] |
| DELETE | `/appointments/:id` | Supprimer RDV | [JWT] [PATIENT/MEDECIN] |

### Conversations & Messages
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| POST | `/conversations` | Créer conversation | [JWT] |
| GET | `/patients/:patientId/conversations` | Conversations du patient | [JWT] |
| GET | `/doctors/:doctorId/conversations` | Conversations du médecin | [JWT] |
| GET | `/pharmacists/:pharmacistId/conversations` | Conversations pharmacien | [JWT] |
| GET | `/conversations/:id/messages` | Messages paginés | [JWT] |
| POST | `/conversations/:id/messages` | Envoyer message | [JWT] |
| PATCH | `/conversations/:id/read/:userId` | Marquer comme lu | [JWT] |

### Demandes de médicaments — `/api/medication-request`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| POST | `/medication-request` | Créer demande | Public |
| POST | `/medication-request/test/simple` | Créer demande simplifiée (test) | Public |
| GET | `/medication-request/pharmacy/:pharmacyId/pending` | Demandes en attente | [JWT] [PHARMACIEN] |
| GET | `/medication-request/pharmacy/:pharmacyId/history` | Historique (filtres) | [JWT] [PHARMACIEN] |
| GET | `/medication-request/:id` | Détail demande | [JWT] |
| PUT | `/medication-request/:id/respond` | Répondre (accepter/refuser) | [JWT] [PHARMACIEN] |
| PUT | `/medication-request/:id/confirm` | Confirmer par le patient | [JWT] |

### Demandes patient → médecin — `/api`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| GET | `/doctors/:doctorId/patient-requests` | Demandes en attente | [JWT] |
| POST | `/doctors/:id/patient-requests/:requestId/accept` | Accepter demande | [JWT] |
| POST | `/doctors/:id/patient-requests/:requestId/decline` | Refuser demande | [JWT] |
| POST | `/patients/:patientId/request-doctor` | Créer demande vers médecin | [JWT] |
| GET | `/patients/:patientId/my-requests` | Mes demandes (patient) | [JWT] |

### Notifications — `/api/notifications`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| GET | `/notifications` | Mes notifications (filtres) | [JWT] |
| PATCH | `/notifications/:id/read` | Marquer comme lu | [JWT] |

### Reviews (Avis pharmacies) — `/api/review`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| POST | `/review` | Créer avis | Public |
| GET | `/review/pharmacy/:pharmacyId` | Avis d'une pharmacie | Public |
| GET | `/review/pharmacy/:pharmacyId/summary` | Résumé des avis | Public |
| DELETE | `/review/:id` | Supprimer avis | [JWT] [PHARMACIEN] |

### Ratings (Évaluations) — `/api/ratings`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| POST | `/ratings` | Créer évaluation + points | [JWT] |
| GET | `/ratings/pharmacy/:pharmacyId` | Évaluations d'une pharmacie | Public |
| GET | `/ratings/pharmacy/:pharmacyId/stats` | Stats évaluations | Public |
| GET | `/ratings/medication-request/:id` | Évaluation par demande | Public |

### Boosts — `/api/boost`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| POST | `/boost` | Activer boost | [JWT] [PHARMACIEN] |
| GET | `/boost/pharmacy/:id` | Tous boosts pharmacie | [JWT] [PHARMACIEN] |
| GET | `/boost/pharmacy/:id/active` | Boost actif | [JWT] [PHARMACIEN] |
| PUT | `/boost/:id/cancel` | Annuler boost | [JWT] [PHARMACIEN] |

### Activités pharmacie — `/api/activity`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| GET | `/activity/pharmacy/:id` | Activités paginées | [JWT] [PHARMACIEN] |
| GET | `/activity/pharmacy/:id/feed` | 8 dernières activités | [JWT] [PHARMACIEN] |

### AI Chat — `/api/ai-chat`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| POST | `/ai-chat` | Message IA médical (proxy FastAPI) | [JWT] |

### AI Food Analyzer — `/api/ai-food-analyzer`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| POST | `/ai-food-analyzer` | Analyser image aliment + sauvegarder repas | [JWT] [PATIENT] |

### Produits — `/api/products`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| GET | `/products/marketplace` | Catalogue public produits | [JWT] tous rôles |
| POST | `/products/pharmacist/:pharmacistId` | Ajouter produit | [JWT] [PHARMACIEN] |
| GET | `/products/pharmacist/:pharmacistId` | Mes produits | [JWT] [PHARMACIEN] |
| GET | `/products/:id` | Détail produit | [JWT] tous rôles |
| PATCH | `/products/:id/pharmacist/:pharmacistId` | Modifier produit | [JWT] [PHARMACIEN] |
| DELETE | `/products/:id/pharmacist/:pharmacistId` | Supprimer produit | [JWT] [PHARMACIEN] |

### Commandes — `/api/orders`
| Méthode | URL | Description | Sécurité |
|---|---|---|---|
| POST | `/orders/patient/:patientId` | Créer commande | [JWT] [PATIENT] |
| GET | `/orders/patient/:patientId` | Mes commandes | [JWT] [PATIENT] |
| PUT | `/orders/:orderId/patient/:patientId/cancel` | Annuler commande | [JWT] [PATIENT] |
| GET | `/orders/pharmacist/:pharmacistId` | Commandes de ma pharmacie | [JWT] [PHARMACIEN] |
| PUT | `/orders/:orderId/pharmacist/:pharmacistId/status` | Mettre à jour statut | [JWT] [PHARMACIEN] |
| GET | `/orders/pharmacist/:pharmacistId/stats` | Stats commandes | [JWT] [PHARMACIEN] |
| GET | `/orders/points/config` | Configuration points | [JWT] tous rôles |

---

## 4. Base de données

### ODM utilisé
**Mongoose** (`@nestjs/mongoose` v11) avec MongoDB.  
Le schéma de base est `users` (collection unique) utilisant le **Mongoose Discriminator Pattern** — le champ `role` est la `discriminatorKey`.

### Modèles / Schémas

#### `User` (base — collection `users`)
| Champ | Type | Requis | Description |
|---|---|---|---|
| `nom` | String | ✅ | Nom de famille |
| `prenom` | String | ✅ | Prénom |
| `email` | String | ✅ unique | Email (lowercase auto) |
| `motDePasse` | String | ✅ | Mot de passe haché (bcrypt) |
| `telephone` | String | — | Numéro de téléphone |
| `photoProfil` | String | — | URL photo de profil |
| `role` | Enum (PATIENT/MEDECIN/PHARMACIEN) | auto | Clé discriminante |
| `statutCompte` | Enum (ACTIF/INACTIF/SUSPENDU) | default: ACTIF | Statut du compte |
| `createdAt`, `updatedAt` | Date | auto | Timestamps Mongoose |

#### `Patient` (discriminator de `User`, `role = PATIENT`)
| Champ | Type | Description |
|---|---|---|
| `dateNaissance` | Date | Date de naissance |
| `sexe` | Enum (MASCULIN/FEMININ/AUTRE) | Sexe |
| `typeDiabete` | Enum (TYPE_1/TYPE_2/GESTATIONNEL/PRE_DIABETE/AUTRE) | Type diabète |
| `groupeSanguin` | String | Groupe sanguin |
| `profilMedical` | ProfilMedical (sous-document) | Profil médical complet |

**ProfilMedical** (sous-document imbriqué dans Patient) :
- Taille, poids, contactUrgence
- dateDiagnostic, glycemieAJeunMoyenne, dernierHba1c, frequenceMesureGlycemie
- prendInsuline, typeInsuline, doseQuotidienneInsuline, frequenceInjection
- antidiabetiquesOraux[], traitements[], utiliseCapteurGlucose
- antecedentsFamiliauxDiabete, hypertension, maladiesCardiovasculaires, problemesRenaux, problemesOculaires, neuropathieDiabetique
- piedDiabetique, ulceres, hypoglycemiesFrequentes

#### `Medecin` (discriminator de `User`, `role = MEDECIN`)
| Champ | Type | Description |
|---|---|---|
| `specialite` | String | Spécialité médicale |
| `numeroOrdre` | String (unique) | Numéro d'ordre professionnel |
| `anneesExperience` | Number | Années d'expérience |
| `clinique` | String | Nom de la clinique |
| `adresseCabinet` | String | Adresse du cabinet |
| `description` | String | Bio/description |
| `tarifConsultation` | Number | Tarif consultation (€) |
| `disponibilite` | Object | Disponibilités (JSON libre) |
| `listePatients` | ObjectId[] (ref: User) | Patients suivi par ce médecin |
| `noteMoyenne` | Number (0-5) | Note moyenne |
| `abonnementPlateforme` | String | Type d'abonnement |

#### `Pharmacien` (discriminator de `User`, `role = PHARMACIEN`)
| Champ | Type | Description |
|---|---|---|
| `numeroOrdre` | String (unique) | Numéro d'ordre |
| `nomPharmacie` | String | Nom de la pharmacie |
| `adressePharmacie` | String | Adresse |
| `horaires` | Object | Horaires d'ouverture |
| `telephonePharmacie` | String | Téléphone |
| `servicesProposes` | String[] | Services proposés |
| `listeMedicamentsDisponibles` | String[] | Médicaments en stock |
| `noteMoyenne` | Number (0-5) | Note moyenne |
| `location` | GeoJSON Point | Géolocalisation (optionnel) |
| `points` | Number | Points gamification |
| `badgeLevel` | Enum (bronze/silver/gold/platinum/diamond) | Niveau badge |
| `unlockedBadges` | String[] | Badges débloqués |
| `totalRequestsReceived` | Number | Demandes reçues |
| `totalRequestsAccepted` | Number | Demandes acceptées |

#### `Session`
| Champ | Type | Description |
|---|---|---|
| `userId` | ObjectId (ref: User) | Propriétaire de la session |
| `token` | String | Token JWT complet |
| `deviceInfo` | String | Type d'appareil (Mobile/Desktop/Tablet) |
| `ipAddress` | String | Adresse IP |
| `userAgent` | String | User-Agent navigateur/app |
| `lastActivityAt` | Date | Dernière activité |
| `expiresAt` | Date | Expiration de la session |
| `isActive` | Boolean | Session active ou révoquée |

#### `Glucose`
| Champ | Type | Description |
|---|---|---|
| `patientId` | ObjectId (ref: User) | Propriétaire |
| `value` | Number | Valeur en mg/dL |
| `measuredAt` | Date | Date/heure de mesure |
| `period` | Enum (fasting/before_meal/after_meal/bedtime/random) | Période |
| `unit` | Enum (mg/dL / mmol/L) | Unité |
| `note` | String | Note optionnelle |
Index : `{ patientId: 1, measuredAt: -1 }`

#### `Meal` (nutrition)
- `patientId`, `name`, `eatenAt`, `calories`, `carbs`, `protein`, `fat`, `note`
- `source`: Enum (manual/ai) — `ai` quand créé par AiFoodAnalyzer
- `confidence`: Number — score de confiance IA
- Items: tableau de `FoodItem` (aliments composant le repas)

#### `FoodItem`
- `mealId`, `name`, `quantity`, `unit`, `calories`, `carbs`, `protein`, `fat`

#### `Appointment`
- `patientId`, `doctorId`, `dateTime`, `type`, `status` (Enum: scheduled/confirmed/cancelled/completed/no_show), `notes`, `duration`

#### `Conversation`
- `participants`: ObjectId[] (ref: User), `lastMessage`, `lastMessageAt`, `unreadCounts`

#### `Message`
- `conversationId`, `senderId`, `content`, `isRead`, `readAt`

#### `MedicationRequest`
- Demande d'un patient vers une ou plusieurs pharmacies
- `patientId`, `medicationName`, `dosage`, `quantity`, `note`
- `globalStatus`: Enum (open/fulfilled/expired/cancelled)
- `expiresAt`: Date (auto ~3-4h après création)
- `pharmacyResponses[]`: tableau par pharmacie avec `pharmacyId`, `status` (pending/accepted/refused/expired), `price`, `availableAt`, `note`

#### `Notification`
- `userId`, `type` (Enum: NotificationType), `title`, `body`, `data`, `isRead`, `readAt`

#### `Review`
- `pharmacyId`, `authorId`, `rating` (1-5), `comment`, `createdAt`

#### `Rating`
- Évaluation liée à une `MedicationRequest` confirmée
- `medicationRequestId`, `pharmacyId`, `patientId`, `rating`, `comment`
- Déclenche l'attribution de points à la pharmacie

#### `Boost`
- `pharmacyId`, `type`, `startDate`, `endDate`, `isActive`, `cost`

#### `PharmacyActivity`
- `pharmacyId`, `activityType`, `description`, `points`, `metadata`

#### `Product`
- `pharmacistId`, `name`, `description`, `price`, `category`, `stock`, `imageUrl`, `isActive`

#### `Order`
- `patientId`, `pharmacistId`, `items[]` (productId, quantity, price), `totalAmount`, `status` (Enum), `note`

### Relations entre entités
```
User (discriminator)
  ├── Patient → profilMedical (embedded)
  ├── Medecin → listePatients[] → Patient
  └── Pharmacien → location (GeoJSON)

Session → User

Patient → Glucose (1:N)
Patient → Meal (1:N)
Patient ↔ Medecin via PatientRequest + listePatients
Patient ↔ Appointment ↔ Medecin
Patient ↔ Conversation ↔ Medecin/Pharmacien
Patient → MedicationRequest → Pharmacien[] (multi-réponses)
Patient → Rating → MedicationRequest
Patient → Order → Pharmacien (via Product)

Pharmacien → Review (1:N)
Pharmacien → Boost (1:N)
Pharmacien → PharmacyActivity (1:N)
Pharmacien → Product (1:N)
```

---

## 5. Authentification & Sécurité

### Stratégie
**JWT (JSON Web Token)** avec `passport-jwt`.  
- Token extrait depuis le header `Authorization: Bearer <token>`
- Expiration : **7 jours** (604800 secondes)
- Secret : variable d'env `JWT_SECRET` (fallback : `diabetes-secret-key`)

### Validation de session
La `JwtStrategy` ne valide pas seulement le token JWT mais **vérifie aussi qu'une session active existe** dans MongoDB (`SessionsService.findByToken`). Cela permet la révocation explicite des sessions (logout).

À chaque requête authentifiée, la `lastActivityAt` de la session est mise à jour.

### Guards
| Guard | Fichier | Rôle |
|---|---|---|
| `JwtAuthGuard` | `common/guards/jwt-auth.guard.ts` | Vérifie JWT valide + session active |
| `RolesGuard` | `common/guards/roles.guard.ts` | Vérifie que `user.role` correspond aux `@Roles()` requis |

### Décorateurs
| Décorateur | Usage |
|---|---|
| `@CurrentUser()` | Injecte l'utilisateur connecté (UserDocument complet) |
| `@CurrentUser('_id')` | Extrait uniquement l'ID de l'utilisateur |
| `@Roles(Role.PATIENT, Role.MEDECIN)` | Définit les rôles autorisés sur une route |

### Rôles disponibles
```typescript
enum Role {
  PATIENT     = 'PATIENT',
  MEDECIN     = 'MEDECIN',
  PHARMACIEN  = 'PHARMACIEN',
}
```

### Statuts de compte
```typescript
enum StatutCompte {
  ACTIF    = 'ACTIF',
  INACTIF  = 'INACTIF',
  SUSPENDU = 'SUSPENDU',
}
```

### Hachage des mots de passe
`bcrypt` avec salt auto.

---

## 6. Services principaux

### `AuthService`
- Inscription de chaque type d'utilisateur (discriminators Mongoose)
- Vérification email unique, `numeroOrdre` unique (Medecin/Pharmacien)
- Hashage du mot de passe, `StatutCompte.ACTIF` par défaut
- À l'inscription et au login : crée une `Session` avec device/IP/userAgent
- Génère un JWT encodant `{ sub: userId, email, role }`

### `SessionsService`
- `create(userId, token, ...)` : crée session en base
- `findByToken(token)` : validation par la JwtStrategy
- `updateActivity(token)` : met à jour `lastActivityAt`
- `getActiveSessions(userId)` : toutes sessions actives d'un user
- `revokeSession(token)` / `revokeSessionById` / `revokeAllSessions`
- `countActiveSessions(userId)`

### `GlucoseService`
- CRUD enregistrements glycémie pour un patient
- Statistiques avancées : weekly/monthly, moyennes journalières, alertes hypo/hyper, estimation HbA1c (formule ADAG), temps dans plage, graphiques par période, tendance comparative

### `NutritionService`
- CRUD repas (`Meal`) et aliments (`FoodItem`)
- Filtres par plage de dates, pagination

### `AiChatService`
- Récupère les 100 derniers enregistrements de glycémie du patient
- Les envoie comme contexte au serveur FastAPI (`POST http://127.0.0.1:8001/chat`)
- Retourne la réponse IA

### `AiFoodAnalyzerService`
- Envoie l'URL d'image au serveur FastAPI vision (`POST http://localhost:8000/analyze-image`)
- Sauvegarde automatiquement le repas en base (`source = 'ai'`)
- Récupère 50 relevés glycémiques, appelle FastAPI Chat pour des conseils personnalisés
- Retourne `{ meal, image_analysis, ai_advice }`

### `MedicationRequestsService`
- Crée une demande de médicament broadcast à plusieurs pharmacies
- Expiration automatique (~3-4h, gérée par `CronService`)
- `respondToRequest` : la pharmacie accepte/refuse lorsque la demande est encore ouverte
- `confirmRequest` : le patient confirme la pharmacie retenue
- Gestion des points via `PointsCalculatorService`

### `CronService`
- Tourne **toutes les 5 minutes** (`*/5 * * * *`)
- Cherche les `MedicationRequest` expirées avec `globalStatus: 'open'`
- Pour chaque réponse `pending` non traitée : pénalise la pharmacie de **-2 points**, log une activité `request_declined`

### `RatingsService`
- Crée une évaluation après confirmation d'une demande médicament
- Utilise `PointsCalculatorService` pour attribuer des points à la pharmacie selon la note
- Met à jour `noteMoyenne` de la pharmacie

### `PointsCalculatorService` (common/services)
- Centralise la logique de calcul des points de gamification (pharmacies)
- Points gagnés sur acceptation d'une demande, sur bonne note, perdus sur expiration

### `NotificationsService`
- Crée et récupère des notifications par utilisateur
- Filtres : `unreadOnly`, `type`, `limit`

---

## 7. Variables d'environnement

Le projet utilise `@nestjs/config` avec `ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })`.  
Créer un fichier `.env` à la racine du projet avec ces variables :

| Variable | Requis | Description | Valeur par défaut |
|---|---|---|---|
| `MONGODB_URI` | ✅ | URI de connexion MongoDB | `mongodb://localhost:27017/diabetes` |
| `JWT_SECRET` | ✅ | Clé secrète de signature JWT | `diabetes-secret-key` ⚠️ |
| `PORT` | — | Port d'écoute du serveur | `3000` |
| `CORS_ORIGIN` | — | Origine(s) autorisées pour CORS | `*` |

> **Note IA** : Les URLs des serveurs FastAPI sont **hardcodées** dans les services :
> - Chat IA : `http://127.0.0.1:8001/chat`
> - Analyseur d'image : `http://localhost:8000/analyze-image`
>
> Pour les rendre configurables, les extraire en variables d'env `AI_CHAT_URL` et `AI_FOOD_ANALYZER_URL`.

### Exemple `.env`
```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/diabetes
JWT_SECRET=super_secret_jwt_key_change_in_production
PORT=3000
CORS_ORIGIN=http://localhost:4200
```

---

## 8. Points importants pour un nouveau développeur

### Comment lancer le projet

```bash
# 1. Installer les dépendances
npm install

# 2. Créer le fichier .env (voir section 7)
cp .env.example .env  # ou créer manuellement

# 3. Démarrer en développement (hot-reload)
npm run start:dev

# 4. Accéder à la documentation Swagger
# http://localhost:3000/api/docs

# 5. Builder pour la production
npm run build
npm run start:prod
```

**Prérequis** :
- Node.js ≥ 18
- MongoDB (local ou Atlas)
- (Optionnel) Serveurs FastAPI pour les fonctionnalités IA

### Conventions de code

| Convention | Détail |
|---|---|
| **Langue** | Mélange français/anglais (champs en français, code en anglais) |
| **Validation** | Toujours utiliser des DTOs avec `class-validator` decorators |
| **Pagination** | Utiliser `PaginationDto` (`page`, `limit`) pour toutes les listes |
| **Auth** | Appliquer `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` |
| **Swagger** | Documenter tous les endpoints avec `@ApiOperation`, `@ApiResponse` |
| **Erreurs** | Utiliser les exceptions NestJS native (`NotFoundException`, `ConflictException`, etc.) |
| **Injection utilisateur** | Décorateur `@CurrentUser('_id')` pour l'ID, `@CurrentUser()` pour l'objet complet |

### Discriminators Mongoose — Point critique

Le projet utilise un **discriminator pattern** pour les utilisateurs. Cela signifie :
1. Il n'y a qu'**une seule collection MongoDB** : `users`
2. Le champ `role` détermine le sous-type (`PATIENT`, `MEDECIN`, `PHARMACIEN`)
3. Dans `AuthModule`, les modèles discriminants sont enregistrés manuellement avec `getModelToken` + `useFactory` pour éviter les conflits de re-déclaration
4. **Ne jamais** utiliser `MongooseModule.forFeature([{ name: Patient.name, schema: PatientSchema }])` directement — cela bypasse le discriminator

### Gestion des sessions
Le projet maintient ses propres sessions en base en **complément** du JWT. C'est intentionnel pour permettre le logout forcé. Si un token JWT valide n'a plus de session associée, la requête est rejetée (401). Cela a un coût : **chaque requête authentifiée fait 2 requêtes MongoDB** (find session + find user).

### Services IA externes
Les deux modules IA (`ai-chat`, `ai-food-analyzer`) dépendent de serveurs Python **FastAPI qui doivent tourner séparément** :
- **Port 8001** : serveur de chat IA médical
- **Port 8000** : serveur d'analyse d'images alimentaires

En leur absence, ces endpoints retournent un `503 Service Unavailable`.

### Système de gamification (Pharmaciens)
Les pharmaciens accumulent des **points** selon leurs actions :
- Accepter une demande de médicament → points positifs
- Bonne évaluation → points positifs
- Ne pas répondre à une demande avant expiration → **-2 points** (géré par le CronJob toutes les 5 min)

Les niveaux de badges : `bronze → silver → gold → platinum → diamond`

### Enums importants à connaître
```typescript
// Rôles
Role: PATIENT | MEDECIN | PHARMACIEN

// Statut compte
StatutCompte: ACTIF | INACTIF | SUSPENDU

// Types de diabète
TypeDiabete: TYPE_1 | TYPE_2 | GESTATIONNEL | PRE_DIABETE | AUTRE

// Périodes glycémie
GlucosePeriod: fasting | before_meal | after_meal | bedtime | random

// Statuts rendez-vous
AppointmentStatus: scheduled | confirmed | cancelled | completed | no_show

// Statuts demande médicament
globalStatus: open | fulfilled | expired | cancelled
pharmacyResponse.status: pending | accepted | refused | expired
```

### Tests
- Tests unitaires : `npm run test` (Jest, fichiers `*.spec.ts`)
- Tests e2e : `npm run test:e2e` (fichiers dans `test/`)
- Couverture : `npm run test:cov`

### Documentation API
Swagger auto-généré disponible sur **`/api/docs`** après démarrage.  
Utiliser le bouton "Authorize" avec `Bearer <votre_token>` pour tester les routes protégées.
