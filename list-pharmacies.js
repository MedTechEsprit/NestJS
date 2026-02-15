const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'diabetes';

async function listPharmacies() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB\n');
    
    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');
    
    const pharmacies = await usersCollection.find({ 
      __t: 'Pharmacien',
      role: 'PHARMACIEN'
    }).toArray();
    
    if (pharmacies.length === 0) {
      console.log('❌ Aucune pharmacie trouvée dans la base de données');
      console.log('💡 Créez une pharmacie via l\'endpoint POST /api/auth/register');
      console.log('   ou utilisez le script seed-test-data.js\n');
    } else {
      console.log(`📋 ${pharmacies.length} pharmacie(s) trouvée(s):\n`);
      pharmacies.forEach((p, i) => {
        console.log(`${i + 1}. ${p.nomPharmacie || p.nom + ' ' + p.prenom}`);
        console.log(`   ID: ${p._id}`);
        console.log(`   Email: ${p.email}`);
        console.log(`   Téléphone: ${p.telephonePharmacie || 'N/A'}`);
        console.log(`   Demandes reçues: ${p.totalRequestsReceived || 0}`);
        console.log(`   Points: ${p.points || 0}`);
        console.log(`   Badge: ${p.badgeLevel || 'bronze'}`);
        console.log('---');
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
  }
}

listPharmacies();
