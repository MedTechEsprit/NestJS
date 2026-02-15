const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'diabetes';
const PHARMACY_ID = '69910c81599fdacc840728aa';

async function fixPharmacy() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB\n');
    
    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');
    
    // Mettre à jour la pharmacie avec tous les champs nécessaires
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(PHARMACY_ID) },
      {
        $set: {
          __t: 'Pharmacien',
          numeroOrdre: 'PH004',
          nomPharmacie: 'Pharmacie Syrine Abid',
          adressePharmacie: 'Adresse à définir',
          telephonePharmacie: '+33612345678',
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
          updatedAt: new Date()
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Pharmacie mise à jour avec succès!\n');
      
      // Afficher la pharmacie mise à jour
      const updatedPharmacy = await usersCollection.findOne({ 
        _id: new ObjectId(PHARMACY_ID) 
      });
      
      console.log('📋 Informations de la pharmacie:');
      console.log(`   ID: ${updatedPharmacy._id}`);
      console.log(`   Nom: ${updatedPharmacy.nom} ${updatedPharmacy.prenom}`);
      console.log(`   Email: ${updatedPharmacy.email}`);
      console.log(`   Nom Pharmacie: ${updatedPharmacy.nomPharmacie}`);
      console.log(`   __t: ${updatedPharmacy.__t}`);
      console.log(`   Points: ${updatedPharmacy.points}`);
      console.log(`   Badge: ${updatedPharmacy.badgeLevel}`);
      console.log(`   Demandes reçues: ${updatedPharmacy.totalRequestsReceived}`);
      
      console.log('\n🎯 La pharmacie est maintenant prête à recevoir des demandes!');
      console.log('💡 Vous pouvez maintenant:');
      console.log('   1. Vous connecter avec: syrine@gmail.com');
      console.log('   2. Créer des demandes avec le script create-request-for-pharmacy.js');
    } else {
      console.log('⚠️  Aucune modification effectuée');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
  }
}

fixPharmacy();
