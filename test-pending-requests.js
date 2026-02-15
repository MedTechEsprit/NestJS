// test-pending-requests.js - Test de l'endpoint /pending
const mongoose = require('mongoose');

const PHARMACY_ID = '69910c81599fdacc840728aa';

async function testPendingRequests() {
  try {
    await mongoose.connect('mongodb://localhost:27017/diabetes');
    console.log('✅ Connecté à MongoDB\n');

    // Schéma MedicationRequest
    const medicationRequestSchema = new mongoose.Schema({
      patientId: mongoose.Schema.Types.ObjectId,
      medicationName: String,
      dosage: String,
      quantity: Number,
      format: String,
      urgencyLevel: String,
      patientNote: String,
      pharmacyResponses: [{
        pharmacyId: mongoose.Schema.Types.ObjectId,
        status: String,
        responseTime: Number,
        indicativePrice: Number,
        preparationDelay: String,
        pharmacyMessage: String,
        pickupDeadline: Date,
        respondedAt: Date
      }],
      globalStatus: String,
      selectedPharmacyId: mongoose.Schema.Types.ObjectId,
      isPickedUp: Boolean,
      expiresAt: Date
    }, { timestamps: true });

    let MedicationRequest;
    try {
      MedicationRequest = mongoose.model('MedicationRequest');
    } catch {
      MedicationRequest = mongoose.model('MedicationRequest', medicationRequestSchema);
    }

    console.log('🔍 Recherche des demandes en attente pour la pharmacie:', PHARMACY_ID);
    console.log('   Critères:');
    console.log('   - pharmacyResponses.pharmacyId = ', PHARMACY_ID);
    console.log('   - pharmacyResponses.status = "pending"');
    console.log('   - expiresAt > maintenant');
    console.log('   - globalStatus = "open"\n');

    const now = new Date();
    
    const requests = await MedicationRequest.find({
      'pharmacyResponses': {
        $elemMatch: {
          pharmacyId: new mongoose.Types.ObjectId(PHARMACY_ID),
          status: 'pending',
        },
      },
      expiresAt: { $gt: now },
      globalStatus: 'open',
    })
    .sort({ urgencyLevel: -1, createdAt: -1 })
    .exec();

    console.log(`📊 RÉSULTAT: ${requests.length} demande(s) trouvée(s)\n`);

    if (requests.length > 0) {
      requests.forEach((req, idx) => {
        const pharmacyResponse = req.pharmacyResponses.find(
          r => r.pharmacyId.toString() === PHARMACY_ID
        );
        
        console.log(`${idx + 1}. 💊 ${req.medicationName}`);
        console.log(`   ID: ${req._id}`);
        console.log(`   Urgence: ${req.urgencyLevel}`);
        console.log(`   Status: ${pharmacyResponse?.status || 'N/A'}`);
        console.log(`   Expire: ${req.expiresAt.toLocaleString('fr-FR')}`);
        console.log(`   Note: ${req.patientNote.substring(0, 50)}...`);
        console.log('');
      });

      console.log('✅ Les demandes existent dans la base de données !');
      console.log('\n🎯 Ce que Flutter devrait recevoir:');
      console.log(`   - Status Code: 200`);
      console.log(`   - Format: Array de ${requests.length} objets`);
      console.log(`   - Premier élément: ${requests[0].medicationName}`);
    } else {
      console.log('❌ AUCUNE demande trouvée avec ces critères !');
      console.log('\n🔍 Vérifications possibles:');
      console.log('1. La pharmacy ID est correcte');
      console.log('2. Les demandes n\'ont pas expiré');
      console.log('3. Les pharmacyResponses contiennent bien cette pharmacie');
      
      // Recherche sans filtres pour débugger
      const allRequests = await MedicationRequest.find({
        'pharmacyResponses.pharmacyId': new mongoose.Types.ObjectId(PHARMACY_ID)
      });
      
      console.log(`\n📋 Total de demandes (tous status confondus): ${allRequests.length}`);
      
      if (allRequests.length > 0) {
        allRequests.forEach(req => {
          const resp = req.pharmacyResponses.find(r => r.pharmacyId.toString() === PHARMACY_ID);
          console.log(`   - ${req.medicationName}: status=${resp?.status}, globalStatus=${req.globalStatus}, expiresAt=${req.expiresAt > now ? 'valide' : 'EXPIRÉ'}`);
        });
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

testPendingRequests();
