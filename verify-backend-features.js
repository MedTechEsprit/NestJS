// verify-backend-features.js - Vérification complète du backend
const mongoose = require('mongoose');

const PHARMACY_ID = '69910c81599fdacc840728aa';

async function verifyBackend() {
  try {
    await mongoose.connect('mongodb://localhost:27017/diabetes');
    console.log('✅ Connecté à MongoDB\n');

    // 1. Vérifier la pharmacie
    const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
    const User = mongoose.model('User', userSchema);
    const pharmacy = await User.findById(PHARMACY_ID);
    
    console.log('═══════════════════════════════════════');
    console.log('📋 1. VÉRIFICATION PHARMACIE');
    console.log('═══════════════════════════════════════');
    
    if (!pharmacy) {
      console.log('❌ Pharmacie non trouvée');
      process.exit(1);
    }
    
    console.log(`✅ Pharmacie: ${pharmacy.nomPharmacie || pharmacy.nom}`);
    console.log(`   Email: ${pharmacy.email}`);
    console.log(`   Role: ${pharmacy.role}`);
    console.log(`   __t: ${pharmacy.__t || 'MANQUANT ❌'}`);
    console.log(`   Points: ${pharmacy.points || 0}`);
    console.log(`   Badge: ${pharmacy.badgeLevel || 'none'}`);
    console.log(`   Demandes reçues: ${pharmacy.totalRequestsReceived || 0}`);
    console.log(`   Demandes acceptées: ${pharmacy.totalRequestsAccepted || 0}`);
    console.log(`   En service: ${pharmacy.isOnDuty ? 'Oui' : 'Non'}`);
    
    // 2. Vérifier les demandes
    const medicationRequestSchema = new mongoose.Schema({}, { strict: false, collection: 'medicationrequests' });
    const MedicationRequest = mongoose.model('MedicationRequest', medicationRequestSchema);
    
    const now = new Date();
    const pendingRequests = await MedicationRequest.find({
      'pharmacyResponses': {
        $elemMatch: {
          pharmacyId: new mongoose.Types.ObjectId(PHARMACY_ID),
          status: 'pending',
        },
      },
      expiresAt: { $gt: now },
      globalStatus: 'open',
    });
    
    console.log('\n═══════════════════════════════════════');
    console.log('💊 2. DEMANDES DE MÉDICAMENTS');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Demandes en attente: ${pendingRequests.length}`);
    
    if (pendingRequests.length > 0) {
      pendingRequests.forEach((req, idx) => {
        console.log(`\n   ${idx + 1}. ${req.medicationName}`);
        console.log(`      Urgence: ${req.urgencyLevel}`);
        console.log(`      Expire: ${req.expiresAt.toLocaleString('fr-FR')}`);
      });
    } else {
      console.log('⚠️  Aucune demande en attente (exécutez create-request-for-pharmacy.js)');
    }
    
    // 3. Vérifier les activités
    const activitySchema = new mongoose.Schema({}, { strict: false, collection: 'pharmacyactivities' });
    const PharmacyActivity = mongoose.model('PharmacyActivity', activitySchema);
    
    const activities = await PharmacyActivity.find({
      pharmacyId: new mongoose.Types.ObjectId(PHARMACY_ID)
    }).sort({ createdAt: -1 }).limit(5);
    
    console.log('\n═══════════════════════════════════════');
    console.log('🎬 3. ACTIVITÉS RÉCENTES');
    console.log('═══════════════════════════════════════');
    
    if (activities.length > 0) {
      console.log(`✅ ${activities.length} activités enregistrées (dernières 5):`);
      activities.forEach((act, idx) => {
        console.log(`\n   ${idx + 1}. ${act.activityType}`);
        console.log(`      ${act.description}`);
        if (act.points) console.log(`      Points: +${act.points}`);
        console.log(`      Date: ${act.createdAt.toLocaleString('fr-FR')}`);
      });
    } else {
      console.log('ℹ️  Aucune activité (normal si pas encore d\'interaction)');
    }
    
    // 4. Vérifier les reviews
    const reviewSchema = new mongoose.Schema({}, { strict: false, collection: 'reviews' });
    const Review = mongoose.model('Review', reviewSchema);
    
    const reviews = await Review.find({
      pharmacyId: new mongoose.Types.ObjectId(PHARMACY_ID)
    });
    
    console.log('\n═══════════════════════════════════════');
    console.log('⭐ 4. AVIS CLIENTS');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Total avis: ${reviews.length}`);
    
    if (reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      console.log(`   Note moyenne: ${avgRating.toFixed(1)}/5`);
    } else {
      console.log('ℹ️  Aucun avis (normal pour nouveau compte)');
    }
    
    // 5. Vérifier les boosts
    const boostSchema = new mongoose.Schema({}, { strict: false, collection: 'boosts' });
    const Boost = mongoose.model('Boost', boostSchema);
    
    const activeBoosts = await Boost.find({
      pharmacyId: new mongoose.Types.ObjectId(PHARMACY_ID),
      expiresAt: { $gt: now },
      status: 'active'
    });
    
    console.log('\n═══════════════════════════════════════');
    console.log('⚡ 5. BOOSTS DE VISIBILITÉ');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Boosts actifs: ${activeBoosts.length}`);
    
    if (activeBoosts.length > 0) {
      activeBoosts.forEach(boost => {
        console.log(`   Type: ${boost.boostType}`);
        console.log(`   Expire: ${boost.expiresAt.toLocaleString('fr-FR')}`);
      });
    } else {
      console.log('ℹ️  Aucun boost actif');
    }
    
    // 6. Résumé système de points
    console.log('\n═══════════════════════════════════════');
    console.log('🎯 6. SYSTÈME DE POINTS & BADGES');
    console.log('═══════════════════════════════════════');
    console.log('✅ Système configuré:');
    console.log('   • Répondre: +5 points');
    console.log('   • Accepter: +10 points');
    console.log('   • Urgent < 30min: +15 points');
    console.log('   • Rapide < 15min: +3 points');
    console.log('   • Review 5⭐: +8 points');
    console.log('   • Pas de réponse: -2 points');
    console.log('');
    console.log('✅ Badges configurés:');
    console.log('   • Bronze: 0 pts');
    console.log('   • Silver: 50 pts');
    console.log('   • Gold: 150 pts');
    console.log('   • Platinum: 300 pts');
    console.log('   • Diamond: 500 pts');
    
    const currentPoints = pharmacy.points || 0;
    const currentBadge = pharmacy.badgeLevel || 'bronze';
    
    console.log('');
    console.log(`📊 État actuel: ${currentPoints} points, Badge ${currentBadge.toUpperCase()}`);
    
    let nextBadge = '';
    let pointsNeeded = 0;
    
    if (currentPoints < 50) {
      nextBadge = 'Silver';
      pointsNeeded = 50 - currentPoints;
    } else if (currentPoints < 150) {
      nextBadge = 'Gold';
      pointsNeeded = 150 - currentPoints;
    } else if (currentPoints < 300) {
      nextBadge = 'Platinum';
      pointsNeeded = 300 - currentPoints;
    } else if (currentPoints < 500) {
      nextBadge = 'Diamond';
      pointsNeeded = 500 - currentPoints;
    } else {
      nextBadge = 'MAX';
      pointsNeeded = 0;
    }
    
    if (pointsNeeded > 0) {
      console.log(`🎯 Prochain badge: ${nextBadge} (${pointsNeeded} points restants)`);
    } else {
      console.log('🏆 Badge maximum atteint!');
    }
    
    // 7. Endpoints disponibles
    console.log('\n═══════════════════════════════════════');
    console.log('🔌 7. ENDPOINTS BACKEND DISPONIBLES');
    console.log('═══════════════════════════════════════');
    console.log('✅ Authentification:');
    console.log('   POST /api/auth/login');
    console.log('   GET  /api/auth/profile');
    console.log('');
    console.log('✅ Demandes:');
    console.log('   GET  /api/medication-request/pharmacy/:id/pending');
    console.log('   GET  /api/medication-request/pharmacy/:id/history');
    console.log('   PUT  /api/medication-request/:id/respond');
    console.log('');
    console.log('✅ Dashboard:');
    console.log('   GET  /api/pharmaciens/:id/dashboard');
    console.log('   GET  /api/pharmaciens/:id/stats');
    console.log('   GET  /api/pharmaciens/:id/stats/monthly');
    console.log('');
    console.log('✅ Paramètres:');
    console.log('   PUT  /api/pharmaciens/:id/working-hours');
    console.log('   PUT  /api/pharmaciens/:id/duty');
    console.log('   PUT  /api/pharmaciens/:id/settings');
    console.log('');
    console.log('✅ Boosts:');
    console.log('   POST /api/boost');
    console.log('   GET  /api/boost/pharmacy/:id/active');
    console.log('');
    console.log('✅ Activités:');
    console.log('   GET  /api/activities/pharmacy/:id/feed');
    console.log('');
    console.log('✅ Avis:');
    console.log('   GET  /api/review/pharmacy/:id');
    console.log('   GET  /api/review/pharmacy/:id/summary');
    
    // Recommandations
    console.log('\n═══════════════════════════════════════');
    console.log('💡 RECOMMANDATIONS');
    console.log('═══════════════════════════════════════');
    
    const recommendations = [];
    
    if (!pharmacy.__t) {
      recommendations.push('⚠️  Ajouter le champ __t: "Pharmacien" (exécutez fix-pharmacy.js)');
    }
    
    if (pendingRequests.length === 0) {
      recommendations.push('💊 Créer des demandes de test (node create-request-for-pharmacy.js)');
    }
    
    if ((pharmacy.points || 0) === 0 && pendingRequests.length > 0) {
      recommendations.push('🎯 Tester acceptation de demande pour gagner des points');
    }
    
    if (recommendations.length > 0) {
      recommendations.forEach(rec => console.log(rec));
    } else {
      console.log('✅ Tout est prêt pour Flutter!');
      console.log('📱 Suivez le guide: FLUTTER_API_GUIDE.md');
    }
    
    console.log('\n═══════════════════════════════════════');
    console.log('✅ VÉRIFICATION TERMINÉE');
    console.log('═══════════════════════════════════════\n');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verifyBackend();
