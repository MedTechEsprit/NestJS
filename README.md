# Diabetes Management Backend - Documentation Complète

## 📋 Table des Matières

1. [Vue d'ensemble de l'architecture](#vue-densemble-de-larchitecture)
2. [Concepts Clés](#concepts-clés)
3. [Structure du Projet](#structure-du-projet)
4. [Modules et APIs](#modules-et-apis)
5. [Authentification et Sécurité](#authentification-et-sécurité)
6. [Configuration et Installation](#configuration-et-installation)
7. [Utilisation des APIs](#utilisation-des-apis)
8. [Scénarios d'Utilisation](#scénarios-dutilisation)

---

## 🏗️ Vue d'ensemble de l'architecture

Cette application est un backend **NestJS + MongoDB** pour la gestion du diabète avec trois types d'utilisateurs : **Patients**, **Médecins**, et **Pharmaciens**.

### Architecture Technique

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│              (Web App, Mobile App, Postman)                 │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP/REST
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     NestJS Backend                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Controllers  │──│   Services   │──│   Schemas    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Guards    │  │     DTOs     │  │  Decorators  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────┬─────────────────────────────────────┘
                        │ Mongoose ODM
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     MongoDB Database                         │
│         Collection: users (avec discriminator)               │
│    ┌─────────────┬──────────────┬────────────────┐         │
│    │   Patients  │   Médecins   │  Pharmaciens   │         │
│    └─────────────┴──────────────┴────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Principes Architecturaux

1. **Modular Architecture** : Chaque fonctionnalité est isolée dans un module
2. **Dependency Injection** : Les services sont injectés via le constructeur
3. **Schema Inheritance** : Pattern Discriminator pour les types d'utilisateurs
4. **Role-Based Access Control (RBAC)** : Guards pour protéger les routes
5. **DTO Validation** : Validation automatique avec class-validator
6. **JWT Authentication** : Tokens sécurisés pour l'authentification

---

## 🎓 Concepts Clés

### 1. Dependency Injection (DI)

**Qu'est-ce que c'est ?** Un pattern où les dépendances sont fournies automatiquement par le framework au lieu d'être créées manuellement.

**Exemple dans le code :**
```typescript
@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}
}
```

**À quoi ça sert ?**
- Facilite les tests (on peut injecter des mocks)
- Réduit le couplage entre les composants
- Améliore la maintenabilité du code

### 2. Guards

**Qu'est-ce que c'est ?** Des classes qui déterminent si une requête peut accéder à une route.

**Exemples dans le code :**

**JwtAuthGuard** - Vérifie que l'utilisateur est authentifié
```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
```

**RolesGuard** - Vérifie que l'utilisateur a le bon rôle
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<Role[]>('roles', context.getHandler());
    const user = request.user;
    return requiredRoles.some((role) => user.role === role);
  }
}
```

**À quoi ça sert ?**
- Protéger les routes sensibles
- Implémenter l'autorisation (qui peut faire quoi)
- Centraliser la logique de sécurité

### 3. Decorators

**Qu'est-ce que c'est ?** Des fonctions qui ajoutent des métadonnées ou modifient le comportement des classes/méthodes.

**Exemples dans le code :**

**@Roles()** - Définit les rôles autorisés
```typescript
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

// Utilisation
@Roles(Role.MEDECIN)
@Get('patients')
async getMesPatients() {}
```

**@CurrentUser()** - Extrait l'utilisateur de la requête
```typescript
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Utilisation
@Get('profile')
async getProfile(@CurrentUser() user: UserDocument) {
  return user;
}
```

**À quoi ça sert ?**
- Réutiliser du code facilement
- Rendre le code plus lisible
- Ajouter des comportements sans modifier les classes

### 4. DTOs (Data Transfer Objects)

**Qu'est-ce que c'est ?** Des classes qui définissent la structure et la validation des données.

**Exemple dans le code :**
```typescript
export class CreatePatientDto {
  @IsString()
  @MinLength(2)
  nom: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  motDePasse: string;

  @IsEnum(TypeDiabete)
  @IsOptional()
  typeDiabete?: TypeDiabete;
}
```

**À quoi ça sert ?**
- Valider automatiquement les données entrantes
- Documenter l'API (via Swagger)
- Typer les données de manière stricte
- Éviter les erreurs de manipulation de données

### 5. Mongoose Discriminator Pattern

**Qu'est-ce que c'est ?** Un pattern qui permet l'héritage de schémas dans MongoDB.

**Exemple dans le code :**
```typescript
// Schema de base
@Schema({ discriminatorKey: 'role', collection: 'users' })
export class User {
  @Prop({ required: true })
  nom: string;
  
  @Prop({ required: true, enum: Role })
  role: Role; // PATIENT, MEDECIN, PHARMACIEN
}

// Schema enfant
@Schema()
export class Patient extends User {
  @Prop()
  typeDiabete?: TypeDiabete;
  
  @Prop()
  allergies?: string[];
}
```

**À quoi ça sert ?**
- Stocker différents types d'utilisateurs dans une seule collection
- Partager les champs communs (nom, email, motDePasse)
- Avoir des champs spécifiques par type (typeDiabete pour Patient, numeroOrdre pour Medecin)
- Simplifier les requêtes (tous les users dans `users` collection)

---

## 📁 Structure du Projet

```
diabetes-backend/
├── src/
│   ├── common/                    # Modules partagés
│   │   ├── decorators/           # @CurrentUser, @Roles
│   │   ├── dto/                  # PaginationDto
│   │   ├── enums/                # Role, TypeDiabete, Sexe, StatutCompte
│   │   └── guards/               # JwtAuthGuard, RolesGuard
│   │
│   ├── auth/                     # Module d'authentification
│   │   ├── strategies/           # JwtStrategy
│   │   ├── auth.controller.ts    # Routes: /register, /login, /profile
│   │   ├── auth.service.ts       # Logique: hashage, validation, JWT
│   │   └── auth.module.ts
│   │
│   ├── users/                    # Module utilisateurs (admin)
│   │   ├── schemas/              # User.schema.ts (base)
│   │   ├── users.controller.ts   # CRUD utilisateurs
│   │   ├── users.service.ts      # Logique métier
│   │   └── users.module.ts
│   │
│   ├── patients/                 # Module patients
│   │   ├── dto/                  # CreatePatientDto, UpdatePatientDto
│   │   ├── schemas/              # Patient.schema.ts
│   │   ├── patients.controller.ts # Routes patients
│   │   ├── patients.service.ts   # Logique métier patients
│   │   └── patients.module.ts
│   │
│   ├── medecins/                 # Module médecins
│   │   ├── dto/                  # CreateMedecinDto, UpdateMedecinDto
│   │   ├── schemas/              # Medecin.schema.ts
│   │   ├── medecins.controller.ts # Routes médecins
│   │   ├── medecins.service.ts   # Logique: gestion patients, notes
│   │   └── medecins.module.ts
│   │
│   ├── pharmaciens/              # Module pharmaciens
│   │   ├── dto/                  # CreatePharmacienDto, UpdatePharmacienDto
│   │   ├── schemas/              # Pharmacien.schema.ts
│   │   ├── pharmaciens.controller.ts # Routes pharmaciens
│   │   ├── pharmaciens.service.ts # Logique: médicaments
│   │   └── pharmaciens.module.ts
│   │
│   ├── app.module.ts             # Module racine
│   └── main.ts                   # Point d'entrée, config Swagger/CORS
│
├── .env                          # Variables d'environnement
├── package.json
└── README.md
```

---

## 🔧 Modules et APIs

### Module Auth (`/api/auth`)

**Rôle :** Gestion de l'inscription, connexion et profil utilisateur.

#### API: POST `/api/auth/register`

**À quoi ça sert ?** Créer un nouveau compte (Patient, Médecin ou Pharmacien).

**Architecture :**
```
Client → AuthController.register() → AuthService.register() → UserModel.create()
   ↓                                         ↓
Retour JWT + user                    Hashage bcrypt (10 rounds)
```

**Code Key Points :**
```typescript
async register(createUserDto: CreateUserDto) {
  // 1. Hasher le mot de passe
  const hashedPassword = await bcrypt.hash(createUserDto.motDePasse, 10);
  
  // 2. Créer l'utilisateur
  const user = await this.userModel.create({
    ...createUserDto,
    motDePasse: hashedPassword,
  });
  
  // 3. Générer le JWT
  const accessToken = this.jwtService.sign({
    sub: user._id,
    email: user.email,
    role: user.role,
  });
  
  // 4. Retourner sans le mot de passe
  const { motDePasse: _, ...userResponse } = user.toObject();
  return { user: userResponse, accessToken };
}
```

**Exemple de requête :**
```json
POST /api/auth/register
{
  "nom": "Dupont",
  "prenom": "Jean",
  "email": "jean.dupont@example.com",
  "motDePasse": "SecurePass123!",
  "telephone": "0612345678",
  "role": "PATIENT"
}
```

**Réponse :**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "nom": "Dupont",
    "prenom": "Jean",
    "email": "jean.dupont@example.com",
    "role": "PATIENT",
    "statutCompte": "ACTIF"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### API: POST `/api/auth/login`

**À quoi ça sert ?** Se connecter avec email/mot de passe.

**Architecture :**
```
Client → AuthController.login() → AuthService.login() → bcrypt.compare()
   ↓                                    ↓
Retour JWT + user              Validation mot de passe
```

**Code Key Points :**
```typescript
async login(email: string, motDePasse: string) {
  // 1. Trouver l'utilisateur
  const user = await this.userModel.findOne({ email });
  if (!user) throw new UnauthorizedException('Identifiants invalides');
  
  // 2. Vérifier le mot de passe
  const isPasswordValid = await bcrypt.compare(motDePasse, user.motDePasse);
  if (!isPasswordValid) throw new UnauthorizedException('Identifiants invalides');
  
  // 3. Générer le JWT
  const accessToken = this.jwtService.sign({
    sub: user._id,
    email: user.email,
    role: user.role,
  });
  
  return { user, accessToken };
}
```

#### API: GET `/api/auth/profile`

**À quoi ça sert ?** Récupérer les informations de l'utilisateur connecté.

**Protection :** `@UseGuards(JwtAuthGuard)` - Nécessite un JWT valide.

**Code :**
```typescript
@UseGuards(JwtAuthGuard)
@Get('profile')
async getProfile(@CurrentUser() user: UserDocument) {
  return this.authService.getProfile(user._id.toString());
}
```

---

### Module Users (`/api/users`)

**Rôle :** CRUD sur tous les utilisateurs (administration).

**Protection :** Routes protégées par JWT.

#### API: GET `/api/users`

**À quoi ça sert ?** Liste paginée de tous les utilisateurs.

**Query Params :**
- `page` (défaut: 1)
- `limit` (défaut: 10)
- `role` (optionnel: PATIENT, MEDECIN, PHARMACIEN)

**Code :**
```typescript
async findAll(page = 1, limit = 10, role?: Role): Promise<PaginatedResult<UserDocument>> {
  const skip = (page - 1) * limit;
  const filter = role ? { role } : {};
  
  const [data, total] = await Promise.all([
    this.userModel.find(filter).skip(skip).limit(limit).exec(),
    this.userModel.countDocuments(filter),
  ]);
  
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
```

**Réponse :**
```json
{
  "data": [...],
  "total": 45,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

#### API: GET `/api/users/stats`

**À quoi ça sert ?** Statistiques sur les utilisateurs par rôle.

**Réponse :**
```json
{
  "totalPatients": 120,
  "totalMedecins": 15,
  "totalPharmaciens": 8
}
```

---

### Module Patients (`/api/patients`)

**Rôle :** Gestion des patients et leurs données médicales.

#### API: POST `/api/patients`

**À quoi ça sert ?** Créer un nouveau patient avec ses données médicales.

**DTO Validation :**
```typescript
export class CreatePatientDto {
  @IsString() nom: string;
  @IsString() prenom: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) motDePasse: string;
  
  @IsDate() @Type(() => Date) @IsOptional()
  dateNaissance?: Date;
  
  @IsEnum(Sexe) @IsOptional()
  sexe?: Sexe;
  
  @IsEnum(TypeDiabete) @IsOptional()
  typeDiabete?: TypeDiabete;
  
  @IsNumber() @Min(50) @Max(250) @IsOptional()
  objectifGlycemie?: number;
  
  @IsArray() @IsString({ each: true }) @IsOptional()
  allergies?: string[];
}
```

**Exemple :**
```json
POST /api/patients
{
  "nom": "Martin",
  "prenom": "Sophie",
  "email": "sophie.martin@example.com",
  "motDePasse": "SecurePass123!",
  "dateNaissance": "1985-05-15",
  "sexe": "FEMININ",
  "typeDiabete": "TYPE_1",
  "objectifGlycemie": 110,
  "allergies": ["Pénicilline", "Lactose"]
}
```

#### API: GET `/api/patients?typeDiabete=TYPE_1`

**À quoi ça sert ?** Filtrer les patients par type de diabète.

**Code :**
```typescript
async findAll(page = 1, limit = 10, typeDiabete?: TypeDiabete) {
  const filter = typeDiabete ? { typeDiabete } : {};
  // ... pagination logic
}
```

---

### Module Médecins (`/api/medecins`)

**Rôle :** Gestion des médecins et de leurs patients.

#### API: POST `/api/medecins/:id/patients`

**À quoi ça sert ?** Ajouter un patient à la liste d'un médecin.

**Protection :** `@Roles(Role.MEDECIN)` - Seuls les médecins peuvent ajouter des patients.

**Code :**
```typescript
async addPatient(medecinId: string, patientId: string) {
  const medecin = await this.medecinModel.findById(medecinId);
  if (!medecin) throw new NotFoundException('Médecin non trouvé');
  
  if (!medecin.listePatients.includes(new Types.ObjectId(patientId))) {
    medecin.listePatients.push(new Types.ObjectId(patientId));
    await medecin.save();
  }
  
  return medecin.populate('listePatients', 'nom prenom email');
}
```

**Exemple :**
```json
POST /api/medecins/507f1f77bcf86cd799439011/patients
{
  "patientId": "507f1f77bcf86cd799439012"
}
```

#### API: GET `/api/medecins/:id/patients`

**À quoi ça sert ?** Récupérer tous les patients d'un médecin avec leurs informations.

**Code :**
```typescript
@Get(':id/patients')
async getMesPatients(@Param('id') id: string) {
  const medecin = await this.medecinsService.findOne(id);
  return medecin.populate('listePatients', 'nom prenom email telephone');
}
```

#### API: PUT `/api/medecins/:id/rating`

**À quoi ça sert ?** Mettre à jour la note d'un médecin (après évaluation patient).

**Exemple :**
```json
PUT /api/medecins/507f1f77bcf86cd799439011/rating
{
  "nouveauRating": 4.5
}
```

---

### Module Pharmaciens (`/api/pharmaciens`)

**Rôle :** Gestion des pharmaciens et médicaments.

#### API: GET `/api/pharmaciens/search?medicament=Metformine`

**À quoi ça sert ?** Trouver les pharmacies qui ont un médicament en stock.

**Code :**
```typescript
async searchByMedicament(medicament: string) {
  return this.pharmacienModel.find({
    listeMedicamentsDisponibles: {
      $regex: medicament,
      $options: 'i', // case-insensitive
    },
  });
}
```

**Exemple de requête :**
```
GET /api/pharmaciens/search?medicament=Metformine
```

**Réponse :**
```json
[
  {
    "_id": "...",
    "nom": "Pharmacie Centrale",
    "listeMedicamentsDisponibles": ["Metformine 500mg", "Insuline", "..."]
  }
]
```

#### API: POST `/api/pharmaciens/:id/medicaments`

**À quoi ça sert ?** Ajouter un médicament à l'inventaire d'une pharmacie.

**Protection :** `@Roles(Role.PHARMACIEN)` - Seuls les pharmaciens peuvent modifier leur stock.

**Exemple :**
```json
POST /api/pharmaciens/507f1f77bcf86cd799439011/medicaments
{
  "medicament": "Insuline Rapide 100UI"
}
```

---

## 🔐 Authentification et Sécurité

### Flow d'Authentification JWT

```
1. Client envoie email + motDePasse
         ↓
2. AuthService vérifie avec bcrypt.compare()
         ↓
3. Si valide, génère JWT avec payload:
   {
     sub: userId,
     email: user.email,
     role: user.role
   }
         ↓
4. Client reçoit le token
         ↓
5. Client envoie le token dans les requêtes suivantes:
   Authorization: Bearer <token>
         ↓
6. JwtAuthGuard valide le token avec JwtStrategy
         ↓
7. Si valide, extrait le payload et l'attache à request.user
         ↓
8. RolesGuard vérifie que request.user.role correspond
```

### JwtStrategy

**Code :**
```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.userModel.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user; // Attaché à request.user
  }
}
```

### Protection des Routes

**Exemple complet :**
```typescript
@Controller('medecins')
@UseGuards(JwtAuthGuard, RolesGuard) // Authentifié + Rôle vérifié
export class MedecinsController {
  
  @Roles(Role.MEDECIN) // Seuls les médecins
  @Post(':id/patients')
  async addPatient(@Param('id') id: string, @Body('patientId') patientId: string) {
    return this.medecinsService.addPatient(id, patientId);
  }
  
  @Get() // Tous les utilisateurs authentifiés
  async findAll() {
    return this.medecinsService.findAll();
  }
}
```

### Hashage de Mot de Passe

**Pourquoi bcrypt ?**
- Algorithme lent (résiste aux attaques brute-force)
- Salt intégré (chaque hash est unique)
- 10 rounds = bon compromis sécurité/performance

**Code :**
```typescript
// Inscription
const hashedPassword = await bcrypt.hash(plainPassword, 10);

// Connexion
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

---

## 🚀 Configuration et Installation

### 1. Prérequis

- Node.js 18+
- MongoDB 6.0+
- npm ou yarn

### 2. Installation

```bash
# Cloner le projet
cd diabetes-backend

# Installer les dépendances
npm install
```

### 3. Configuration MongoDB

**Démarrer MongoDB (Windows) :**
```powershell
# Ouvrir PowerShell en tant qu'Administrateur
Start-Service MongoDB

# Vérifier le statut
Get-Service MongoDB
```

**Connexion :**
- URL: `mongodb://localhost:27017`
- Database: `diabetes_db`

### 4. Variables d'Environnement

Créer un fichier `.env` :
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/diabetes_db

# JWT
JWT_SECRET=votre_secret_super_securise_ici_123456789
JWT_EXPIRATION=7d

# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:4200
```

### 5. Lancer l'Application

```bash
# Mode développement (hot-reload)
npm run start:dev

# Mode production
npm run build
npm run start:prod
```

### 6. Accéder à Swagger

Une fois l'application démarrée :
```
http://localhost:3000/api/docs
```

Swagger génère automatiquement la documentation interactive de toutes les routes.

---

## 📖 Utilisation des APIs

### Workflow Complet

#### 1. Inscription d'un Patient

```bash
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "nom": "Durand",
  "prenom": "Marie",
  "email": "marie.durand@example.com",
  "motDePasse": "SecurePass123!",
  "telephone": "0623456789",
  "role": "PATIENT",
  "dateNaissance": "1990-03-20",
  "sexe": "FEMININ",
  "typeDiabete": "TYPE_2",
  "objectifGlycemie": 120,
  "allergies": ["Aspirine"]
}
```

**Réponse :**
```json
{
  "user": {
    "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
    "nom": "Durand",
    "prenom": "Marie",
    "email": "marie.durand@example.com",
    "role": "PATIENT",
    "typeDiabete": "TYPE_2"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 2. Connexion

```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "marie.durand@example.com",
  "motDePasse": "SecurePass123!"
}
```

#### 3. Utiliser le Token

**Dans toutes les requêtes suivantes, ajouter le header :**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 4. Récupérer son Profil

```bash
GET http://localhost:3000/api/auth/profile
Authorization: Bearer <votre_token>
```

#### 5. Médecin: Ajouter un Patient

```bash
POST http://localhost:3000/api/medecins/65a1b2c3d4e5f6a7b8c9d0e1/patients
Authorization: Bearer <token_medecin>
Content-Type: application/json

{
  "patientId": "65a1b2c3d4e5f6a7b8c9d0e2"
}
```

#### 6. Rechercher une Pharmacie

```bash
GET http://localhost:3000/api/pharmaciens/search?medicament=Metformine
Authorization: Bearer <votre_token>
```

---

## 💡 Scénarios d'Utilisation

### Scénario 1: Nouveau Patient s'Inscrit

```
1. Patient → POST /api/auth/register (role: PATIENT)
2. Backend → Hashe le mot de passe avec bcrypt
3. Backend → Sauvegarde dans MongoDB (collection: users)
4. Backend → Génère JWT avec payload { sub, email, role }
5. Patient ← Reçoit { user, accessToken }
6. Patient → Stocke le token (localStorage/sessionStorage)
7. Patient → Peut maintenant accéder aux routes protégées
```

### Scénario 2: Médecin Gère ses Patients

```
1. Médecin → POST /api/auth/login
2. Backend ← Retourne JWT avec role: MEDECIN
3. Médecin → GET /api/patients (récupère liste des patients)
4. Médecin → POST /api/medecins/:id/patients (ajoute patient à sa liste)
5. Backend → Vérifie RolesGuard(@Roles(Role.MEDECIN))
6. Backend → Ajoute l'ObjectId du patient dans listePatients[]
7. Médecin → GET /api/medecins/:id/patients (voit tous ses patients avec populate())
```

### Scénario 3: Patient Cherche une Pharmacie

```
1. Patient → GET /api/pharmaciens/search?medicament=Insuline
2. Backend → Recherche avec regex case-insensitive
3. Backend ← Retourne toutes les pharmacies ayant "Insuline" en stock
4. Patient ← Reçoit liste avec nom, adresse, téléphone, horaires
5. Patient → Peut contacter la pharmacie
```

---

## 📊 Schémas MongoDB

### Collection: `users`

**Structure avec Discriminator :**
```javascript
// Document Patient
{
  _id: ObjectId("..."),
  nom: "Durand",
  prenom: "Marie",
  email: "marie@example.com",
  motDePasse: "$2b$10$...", // hash bcrypt
  role: "PATIENT", // discriminator key
  // Champs spécifiques Patient:
  dateNaissance: ISODate("1990-03-20"),
  sexe: "FEMININ",
  typeDiabete: "TYPE_2",
  objectifGlycemie: 120,
  allergies: ["Aspirine"],
  traitementActuel: "Metformine 1000mg"
}

// Document Médecin
{
  _id: ObjectId("..."),
  nom: "Dr. Martin",
  prenom: "Pierre",
  email: "p.martin@example.com",
  motDePasse: "$2b$10$...",
  role: "MEDECIN", // discriminator key
  // Champs spécifiques Médecin:
  numeroOrdre: "123456789",
  specialite: "Endocrinologie",
  listePatients: [
    ObjectId("..."), // ref Patient
    ObjectId("...")
  ],
  rating: 4.7
}

// Document Pharmacien
{
  _id: ObjectId("..."),
  nom: "Pharmacie Centrale",
  email: "contact@pharma.com",
  motDePasse: "$2b$10$...",
  role: "PHARMACIEN",
  // Champs spécifiques Pharmacien:
  numeroOrdre: "987654321",
  nomPharmacie: "Pharmacie Centrale",
  adresse: "12 Rue de la Santé, Paris",
  horaires: "Lun-Sam: 9h-19h",
  servicesProposes: ["Délivrance ordonnances", "Conseil"],
  listeMedicamentsDisponibles: [
    "Metformine 500mg",
    "Metformine 1000mg",
    "Insuline Rapide 100UI"
  ]
}
```

---

## 🔍 Endpoints Complets

### Auth Module

| Méthode | Route | Protection | Rôle | Description |
|---------|-------|------------|------|-------------|
| POST | `/api/auth/register` | ❌ Aucune | Tous | Créer un compte |
| POST | `/api/auth/login` | ❌ Aucune | Tous | Se connecter |
| GET | `/api/auth/profile` | ✅ JWT | Tous | Mon profil |

### Users Module

| Méthode | Route | Protection | Rôle | Description |
|---------|-------|------------|------|-------------|
| GET | `/api/users` | ✅ JWT | Tous | Liste paginée |
| GET | `/api/users/stats` | ✅ JWT | Tous | Statistiques |
| GET | `/api/users/:id` | ✅ JWT | Tous | Détail user |
| PATCH | `/api/users/:id` | ✅ JWT | Tous | Modifier user |
| DELETE | `/api/users/:id` | ✅ JWT | Tous | Supprimer user |

### Patients Module

| Méthode | Route | Protection | Rôle | Description |
|---------|-------|------------|------|-------------|
| POST | `/api/patients` | ✅ JWT | Tous | Créer patient |
| GET | `/api/patients` | ✅ JWT | Tous | Liste paginée + filtre |
| GET | `/api/patients/:id` | ✅ JWT | Tous | Détail patient |
| PATCH | `/api/patients/:id` | ✅ JWT | PATIENT | Modifier patient |
| DELETE | `/api/patients/:id` | ✅ JWT | PATIENT | Supprimer patient |

### Médecins Module

| Méthode | Route | Protection | Rôle | Description |
|---------|-------|------------|------|-------------|
| POST | `/api/medecins` | ✅ JWT | Tous | Créer médecin |
| GET | `/api/medecins` | ✅ JWT | Tous | Liste paginée |
| GET | `/api/medecins/:id` | ✅ JWT | Tous | Détail médecin |
| PATCH | `/api/medecins/:id` | ✅ JWT | MEDECIN | Modifier médecin |
| DELETE | `/api/medecins/:id` | ✅ JWT | MEDECIN | Supprimer médecin |
| POST | `/api/medecins/:id/patients` | ✅ JWT | MEDECIN | Ajouter patient |
| DELETE | `/api/medecins/:id/patients/:patientId` | ✅ JWT | MEDECIN | Retirer patient |
| GET | `/api/medecins/:id/patients` | ✅ JWT | MEDECIN | Mes patients |
| PUT | `/api/medecins/:id/rating` | ✅ JWT | Tous | Noter médecin |

### Pharmaciens Module

| Méthode | Route | Protection | Rôle | Description |
|---------|-------|------------|------|-------------|
| POST | `/api/pharmaciens` | ✅ JWT | Tous | Créer pharmacien |
| GET | `/api/pharmaciens` | ✅ JWT | Tous | Liste paginée |
| GET | `/api/pharmaciens/search` | ✅ JWT | Tous | Recherche médicament |
| GET | `/api/pharmaciens/:id` | ✅ JWT | Tous | Détail pharmacien |
| PATCH | `/api/pharmaciens/:id` | ✅ JWT | PHARMACIEN | Modifier pharmacien |
| DELETE | `/api/pharmaciens/:id` | ✅ JWT | PHARMACIEN | Supprimer pharmacien |
| POST | `/api/pharmaciens/:id/medicaments` | ✅ JWT | PHARMACIEN | Ajouter médicament |
| PUT | `/api/pharmaciens/:id/rating` | ✅ JWT | Tous | Noter pharmacien |

---

## 🎯 Points Clés de l'Architecture

### 1. Sécurité

- ✅ **Hashage bcrypt** : Mots de passe jamais stockés en clair
- ✅ **JWT avec expiration** : Tokens valides 7 jours
- ✅ **Guards multi-niveaux** : JwtAuthGuard + RolesGuard
- ✅ **Validation stricte** : class-validator sur tous les DTOs
- ✅ **Pas de mot de passe dans les réponses** : Destructuring pour exclure

### 2. Performance

- ✅ **Pagination** : Évite de charger toutes les données
- ✅ **Indexes MongoDB** : email (unique), numeroOrdre (unique)
- ✅ **Populate sélectif** : Charge uniquement les champs nécessaires
- ✅ **Promise.all** : Requêtes parallèles (count + find)

### 3. Maintenabilité

- ✅ **Modularité** : Chaque feature dans son module
- ✅ **DI (Dependency Injection)** : Couplage faible
- ✅ **DTOs typés** : Contrats clairs
- ✅ **Swagger** : Documentation auto-générée
- ✅ **Environment variables** : Configuration externalisée

### 4. Scalabilité

- ✅ **Discriminator pattern** : Une collection pour tous les users
- ✅ **Relations MongoDB** : ObjectId refs pour éviter duplication
- ✅ **Stateless JWT** : Pas de session serveur
- ✅ **CORS configuré** : Prêt pour frontend séparé

---

## 📝 Description

Application backend NestJS professionnelle pour la gestion du diabète avec authentification JWT, gestion de rôles, et MongoDB.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
