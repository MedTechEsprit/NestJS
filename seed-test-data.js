const { MongoClient, ObjectId } = require('mongodb');

// Configuration MongoDB
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'diabetes';

async function seedTestData() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB');

    const db = client.db(DB_NAME);

    // 1. Créer un patient de test
    const patientsCollection = db.collection('users');
    const patientId = new ObjectId();
    
    await patientsCollection.insertOne({
      _id: patientId,
      __t: 'Patient',
      nom: 'Test',
      prenom: 'Patient',
      email: 'patient.test@diabcare.com',
      motDePasse: '$2b$10$hashedpassword', // Mot de passe fictif
      role: 'patient',
      statutCompte: 'ACTIF',
      dateNaissance: new Date('1990-01-01'),
      sexe: 'masculin',
      typeDiabete: 'type2',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('✅ Patient de test créé:', patientId);

    // 2. Créer 2 pharmacies de test
    const pharmacy1Id = new ObjectId();
    const pharmacy2Id = new ObjectId();

    await patientsCollection.insertMany([
      {
        _id: pharmacy1Id,
        __t: 'Pharmacien',
        nom: 'Pharmacie',
        prenom: 'Centrale',
        email: 'pharmacie1@test.com',
        motDePasse: '$2b$10$hashedpassword',
        role: 'pharmacien',
        statutCompte: 'ACTIF',
        numeroOrdre: 'PH001',
        nomPharmacie: 'Pharmacie Centrale',
        adressePharmacie: '123 Rue Principale, Tunis',
        telephonePharmacie: '71234567',
        location: {
          type: 'Point',
          coordinates: [10.1815, 36.8065] // Tunis
        },
        points: 45,
        badgeLevel: 'bronze',
        totalRequestsReceived: 0,
        totalRequestsAccepted: 0,
        totalRequestsDeclined: 0,
        totalClients: 0,
        totalRevenue: 0,
        averageResponseTime: 0,
        averageRating: 0,
        totalReviews: 0,
        isOnDuty: true,
        notificationsPush: true,
        notificationsEmail: true,
        notificationsSMS: false,
        visibilityRadius: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: pharmacy2Id,
        __t: 'Pharmacien',
        nom: 'Pharmacie',
        prenom: 'Express',
        email: 'pharmacie2@test.com',
        motDePasse: '$2b$10$hashedpassword',
        role: 'pharmacien',
        statutCompte: 'ACTIF',
        numeroOrdre: 'PH002',
        nomPharmacie: 'Pharmacie Express',
        adressePharmacie: '456 Avenue Habib Bourguiba, Tunis',
        telephonePharmacie: '71987654',
        location: {
          type: 'Point',
          coordinates: [10.1735, 36.8002]
        },
        points: 120,
        badgeLevel: 'silver',
        totalRequestsReceived: 0,
        totalRequestsAccepted: 0,
        totalRequestsDeclined: 0,
        totalClients: 0,
        totalRevenue: 0,
        averageResponseTime: 0,
        averageRating: 0,
        totalReviews: 0,
        isOnDuty: true,
        notificationsPush: true,
        notificationsEmail: false,
        notificationsSMS: true,
        visibilityRadius: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ]);
    console.log('✅ 2 pharmacies de test créées:', pharmacy1Id, pharmacy2Id);

    // 3. Créer 3 demandes de médicaments
    const medicationRequestsCollection = db.collection('medicationrequests');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2h

    const requests = [
      {
        _id: new ObjectId(),
        patientId: patientId,
        medicationName: 'Metformine 500mg',
        dosage: '500mg',
        quantity: 30,
        format: 'comprimés',
        urgencyLevel: 'urgent',
        patientNote: 'J\'ai besoin de ce médicament rapidement SVP',
        pharmacyResponses: [
          {
            pharmacyId: pharmacy1Id,
            status: 'pending',
            responseTime: null,
            indicativePrice: null,
            preparationDelay: null,
            pharmacyMessage: null,
          },
          {
            pharmacyId: pharmacy2Id,
            status: 'pending',
            responseTime: null,
            indicativePrice: null,
            preparationDelay: null,
          }
        ],
        globalStatus: 'open',
        expiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId(),
        patientId: patientId,
        medicationName: 'Insuline Lantus',
        dosage: '100 UI/ml',
        quantity: 5,
        format: 'stylos',
        urgencyLevel: 'très urgent',
        patientNote: 'Stock épuisé, besoin immédiat',
        pharmacyResponses: [
          {
            pharmacyId: pharmacy1Id,
            status: 'pending',
            responseTime: null,
            indicativePrice: null,
            preparationDelay: null,
          },
          {
            pharmacyId: pharmacy2Id,
            status: 'pending',
            responseTime: null,
            indicativePrice: null,
            preparationDelay: null,
          }
        ],
        globalStatus: 'open',
        expiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId(),
        patientId: patientId,
        medicationName: 'Glucophage XR 1000mg',
        dosage: '1000mg',
        quantity: 60,
        format: 'comprimés',
        urgencyLevel: 'normal',
        patientNote: 'Pour renouvellement',
        pharmacyResponses: [
          {
            pharmacyId: pharmacy1Id,
            status: 'pending',
            responseTime: null,
            indicativePrice: null,
            preparationDelay: null,
          },
          {
            pharmacyId: pharmacy2Id,
            status: 'pending',
            responseTime: null,
            indicativePrice: null,
            preparationDelay: null,
          }
        ],
        globalStatus: 'open',
        expiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
      }
    ];

    await medicationRequestsCollection.insertMany(requests);
    console.log('✅ 3 demandes de médicaments créées');

    console.log('\n📋 RÉSUMÉ DES DONNÉES DE TEST:');
    console.log('================================');
    console.log(`Patient ID: ${patientId}`);
    console.log(`Pharmacie 1 ID: ${pharmacy1Id}`);
    console.log(`  - Email: pharmacie1@test.com`);
    console.log(`  - Nom: Pharmacie Centrale`);
    console.log(`Pharmacie 2 ID: ${pharmacy2Id}`);
    console.log(`  - Email: pharmacie2@test.com`);
    console.log(`  - Nom: Pharmacie Express`);
    console.log(`\n${requests.length} demandes créées (en attente de réponse)`);
    console.log('\n🎯 Vous pouvez maintenant tester les APIs dans Swagger!');
    console.log(`📚 Swagger: http://localhost:3001/api/docs`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
    console.log('\n✅ Connexion MongoDB fermée');
  }
}

seedTestData();
