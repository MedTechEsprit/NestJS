const { MongoClient, ObjectId } = require('mongodb');

// Configuration
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'diabetes';
const PHARMACY_ID = '69910c81599fdacc840728aa'; // L'ID de votre pharmacie

async function createMedicationRequest() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB');

    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');
    const requestsCollection = db.collection('medicationrequests');

    // Chercher un patient existant ou créer un patient de test
    let patient = await usersCollection.findOne({ role: 'patient', __t: 'Patient' });
    
    if (!patient) {
      console.log('⚠️ Aucun patient trouvé, création d\'un patient de test...');
      const patientId = new ObjectId();
      await usersCollection.insertOne({
        _id: patientId,
        __t: 'Patient',
        nom: 'Test',
        prenom: 'Patient',
        email: 'patient.test@example.com',
        motDePasse: '$2b$10$hashedpassword',
        role: 'patient',
        statutCompte: 'ACTIF',
        dateNaissance: new Date('1990-01-01'),
        sexe: 'masculin',
        typeDiabete: 'type2',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      patient = await usersCollection.findOne({ _id: patientId });
      console.log('✅ Patient créé:', patientId.toString());
    }

    // Vérifier que la pharmacie existe
    const pharmacy = await usersCollection.findOne({ 
      _id: new ObjectId(PHARMACY_ID),
      __t: 'Pharmacien' 
    });

    if (!pharmacy) {
      console.error('❌ Pharmacie non trouvée avec l\'ID:', PHARMACY_ID);
      console.log('💡 Vérifiez l\'ID de la pharmacie ou créez-la d\'abord');
      return;
    }

    console.log('✅ Pharmacie trouvée:', pharmacy.nomPharmacie || pharmacy.nom);

    // Créer 3 demandes de médicaments pour cette pharmacie
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2h

    const requests = [
      {
        _id: new ObjectId(),
        patientId: patient._id,
        medicationName: 'Metformine 850mg',
        dosage: '850mg',
        quantity: 90,
        format: 'comprimés',
        urgencyLevel: 'urgent',
        patientNote: 'Besoin urgent pour renouvellement',
        pharmacyResponses: [
          {
            pharmacyId: new ObjectId(PHARMACY_ID),
            status: 'pending',
            responseTime: null,
            indicativePrice: null,
            preparationDelay: null,
            pharmacyMessage: null,
          }
        ],
        globalStatus: 'open',
        expiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId(),
        patientId: patient._id,
        medicationName: 'Insuline Lantus Solostar',
        dosage: '100 UI/ml',
        quantity: 5,
        format: 'stylos',
        urgencyLevel: 'très urgent',
        patientNote: 'Stock épuisé, besoin immédiat !',
        pharmacyResponses: [
          {
            pharmacyId: new ObjectId(PHARMACY_ID),
            status: 'pending',
            responseTime: null,
            indicativePrice: null,
            preparationDelay: null,
            pharmacyMessage: null,
          }
        ],
        globalStatus: 'open',
        expiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId(),
        patientId: patient._id,
        medicationName: 'Glucophage XR 1000mg',
        dosage: '1000mg',
        quantity: 60,
        format: 'comprimés à libération prolongée',
        urgencyLevel: 'normal',
        patientNote: 'Pour renouvellement mensuel',
        pharmacyResponses: [
          {
            pharmacyId: new ObjectId(PHARMACY_ID),
            status: 'pending',
            responseTime: null,
            indicativePrice: null,
            preparationDelay: null,
            pharmacyMessage: null,
          }
        ],
        globalStatus: 'open',
        expiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
      }
    ];

    await requestsCollection.insertMany(requests);
    console.log('✅ 3 demandes de médicaments créées pour la pharmacie');

    // Mettre à jour le compteur de la pharmacie
    await usersCollection.updateOne(
      { _id: new ObjectId(PHARMACY_ID) },
      { $inc: { totalRequestsReceived: 3 } }
    );

    console.log('\n📋 RÉSUMÉ:');
    console.log('==========');
    console.log(`Patient ID: ${patient._id}`);
    console.log(`Pharmacie ID: ${PHARMACY_ID}`);
    console.log(`Pharmacie: ${pharmacy.nomPharmacie || pharmacy.nom}`);
    console.log('\n✅ 3 demandes créées:');
    requests.forEach((req, index) => {
      console.log(`  ${index + 1}. ${req.medicationName} (${req.urgencyLevel})`);
      console.log(`     ID: ${req._id}`);
    });
    
    console.log('\n🎯 Testez maintenant dans Swagger:');
    console.log(`   GET /api/medication-request/pharmacy/${PHARMACY_ID}/pending`);
    console.log(`   PUT /api/medication-request/{requestId}/respond`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
    console.log('\n✅ Connexion fermée');
  }
}

createMedicationRequest();
