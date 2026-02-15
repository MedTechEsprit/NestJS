const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'diabetes';
const PHARMACY_ID = '69910c81599fdacc840728aa';

async function checkPharmacy() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB\n');
    
    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');
    
    // Chercher avec juste l'ID
    console.log('🔍 Recherche par ID:', PHARMACY_ID);
    const pharmacyById = await usersCollection.findOne({ 
      _id: new ObjectId(PHARMACY_ID)
    });
    
    if (pharmacyById) {
      console.log('✅ PHARMACIE TROUVÉE PAR ID!');
      console.log(JSON.stringify(pharmacyById, null, 2));
    } else {
      console.log('❌ Aucune pharmacie avec cet ID');
    }
    
    console.log('\n🔍 Recherche par role PHARMACIEN:');
    const pharmaciesByRole = await usersCollection.find({ 
      role: 'PHARMACIEN'
    }).toArray();
    
    console.log(`✅ ${pharmaciesByRole.length} pharmacie(s) avec role PHARMACIEN:`);
    pharmaciesByRole.forEach(p => {
      console.log(`  - ${p.nom} ${p.prenom} (${p.email}) - ID: ${p._id}`);
      console.log(`    __t: ${p.__t || 'NON DÉFINI'}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
  }
}

checkPharmacy();
