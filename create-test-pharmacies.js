const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'diabetes';

async function createPharmacies() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB\n');
    
    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');
    
    // Hash le mot de passe
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Créer 3 pharmacies avec des IDs spécifiques
    const pharmacies = [
      {
        _id: new ObjectId('69910c81599fdacc840728aa'),
        __t: 'Pharmacien',
        nom: 'Pharmacie',
        prenom: 'Centrale',
        email: 'pharmacie.centrale@test.com',
        motDePasse: hashedPassword,
        role: 'PHARMACIEN',
        statutCompte: 'ACTIF',
        numeroOrdre: 'PH001',
        nomPharmacie: 'Pharmacie Centrale',
        adressePharmacie: '123 Rue Principale, Tunis',
        telephonePharmacie: '71234567',
        location: {
          type: 'Point',
          coordinates: [10.1815, 36.8065]
        },
        points: 0,
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
        _id: new ObjectId(),
        __t: 'Pharmacien',
        nom: 'Pharmacie',
        prenom: 'Express',
        email: 'pharmacie.express@test.com',
        motDePasse: hashedPassword,
        role: 'PHARMACIEN',
        statutCompte: 'ACTIF',
        numeroOrdre: 'PH002',
        nomPharmacie: 'Pharmacie Express',
        adressePharmacie: '456 Avenue Habib Bourguiba, Tunis',
        telephonePharmacie: '71987654',
        location: {
          type: 'Point',
          coordinates: [10.1735, 36.8002]
        },
        points: 0,
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
        notificationsEmail: false,
        notificationsSMS: true,
        visibilityRadius: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        __t: 'Pharmacien',
        nom: 'Pharmacie',
        prenom: 'Garde',
        email: 'pharmacie.garde@test.com',
        motDePasse: hashedPassword,
        role: 'PHARMACIEN',
        statutCompte: 'ACTIF',
        numeroOrdre: 'PH003',
        nomPharmacie: 'Pharmacie de Garde',
        adressePharmacie: '789 Rue de la République, Tunis',
        telephonePharmacie: '71555666',
        location: {
          type: 'Point',
          coordinates: [10.1650, 36.8100]
        },
        points: 0,
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
        notificationsSMS: true,
        visibilityRadius: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];
    
    // Vérifier si des pharmacies existent déjà
    for (const pharmacy of pharmacies) {
      const existing = await usersCollection.findOne({ _id: pharmacy._id });
      if (existing) {
        console.log(`ℹ️  Pharmacie ${pharmacy.nomPharmacie} existe déjà, ignorée`);
        continue;
      }
      
      await usersCollection.insertOne(pharmacy);
      console.log(`✅ Créé: ${pharmacy.nomPharmacie}`);
      console.log(`   ID: ${pharmacy._id}`);
      console.log(`   Email: ${pharmacy.email}`);
      console.log(`   Mot de passe: password123`);
      console.log('---');
    }
    
    // Créer un patient de test aussi
    const existingPatient = await usersCollection.findOne({ 
      email: 'patient.test@example.com' 
    });
    
    if (!existingPatient) {
      const patientId = new ObjectId();
      await usersCollection.insertOne({
        _id: patientId,
        __t: 'Patient',
        nom: 'Test',
        prenom: 'Patient',
        email: 'patient.test@example.com',
        motDePasse: hashedPassword,
        role: 'PATIENT',
        statutCompte: 'ACTIF',
        dateNaissance: new Date('1990-01-01'),
        sexe: 'masculin',
        typeDiabete: 'type2',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`\n✅ Patient de test créé`);
      console.log(`   ID: ${patientId}`);
      console.log(`   Email: patient.test@example.com`);
      console.log(`   Mot de passe: password123`);
    }
    
    console.log('\n🎯 COMPTES DE TEST PRÊTS:');
    console.log('=========================');
    console.log('Email: pharmacie.centrale@test.com');
    console.log('Password: password123');
    console.log('ID: 69910c81599fdacc840728aa');
    console.log('\nEmail: pharmacie.express@test.com');
    console.log('Password: password123');
    console.log('\nEmail: pharmacie.garde@test.com');
    console.log('Password: password123');
    
    console.log('\n💡 Utilisez ces comptes pour vous connecter dans Flutter!');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
  }
}

createPharmacies();
