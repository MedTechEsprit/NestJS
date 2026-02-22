import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pharmacien, PharmacienDocument } from '../../pharmaciens/schemas/pharmacien.schema';
import { PharmacyActivity, PharmacyActivityDocument } from '../../activities/schemas/pharmacy-activity.schema';

export interface PointsBreakdown {
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  reason: string;
  breakdown: string[];
}

export interface BadgeThreshold {
  badge: string;
  emoji: string;
  minPoints: number;
  maxPoints: number;
  description: string;
}

@Injectable()
export class PointsCalculatorService {
  // Seuils des badges
  private readonly BADGE_THRESHOLDS: BadgeThreshold[] = [
    {
      badge: 'aucun',
      emoji: '',
      minPoints: 0,
      maxPoints: 49,
      description: 'Pas de badge',
    },
    {
      badge: 'fiable',
      emoji: '⭐',
      minPoints: 50,
      maxPoints: 99,
      description: 'Fiable - Répond régulièrement',
    },
    {
      badge: 'reactif',
      emoji: '🔥',
      minPoints: 100,
      maxPoints: 199,
      description: 'Réactif - Répond très rapidement',
    },
    {
      badge: 'excellence',
      emoji: '👑',
      minPoints: 200,
      maxPoints: Infinity,
      description: 'Excellence - Pharmacie de premier choix',
    },
  ];

  constructor(
    @InjectModel(Pharmacien.name) private pharmacienModel: Model<PharmacienDocument>,
    @InjectModel(PharmacyActivity.name) private activityModel: Model<PharmacyActivityDocument>,
  ) {}

  /**
   * Calcule les points pour une réponse "Disponible"
   * Règle: 10 pts base + bonus selon le temps de réponse
   */
  calculateAvailableResponsePoints(responseTimeMinutes: number): PointsBreakdown {
    const basePoints = 10;
    let bonusPoints = 0;
    const breakdown: string[] = ['Base: +10 pts (réponse rapide)'];

    if (responseTimeMinutes < 30) {
      bonusPoints = 20;
      breakdown.push(`Bonus ultra-rapide (< 30 min): +20 pts`);
    } else if (responseTimeMinutes < 60) {
      bonusPoints = 15;
      breakdown.push(`Bonus rapide (30-60 min): +15 pts`);
    } else if (responseTimeMinutes < 120) {
      bonusPoints = 5;
      breakdown.push(`Bonus modéré (60-120 min): +5 pts`);
    }

    return {
      basePoints,
      bonusPoints,
      totalPoints: basePoints + bonusPoints,
      reason: `Réponse Disponible en ${responseTimeMinutes}min`,
      breakdown,
    };
  }

  /**
   * Calcule les points pour une réponse "Non Disponible"
   * Règle: 5 pts (peu importe le délai)
   */
  calculateUnavailableResponsePoints(): PointsBreakdown {
    return {
      basePoints: 5,
      bonusPoints: 0,
      totalPoints: 5,
      reason: 'Réponse Non Disponible',
      breakdown: ['Réponse rapide et honnête: +5 pts'],
    };
  }

  /**
   * Calcule les points pour un rejet
   * Règle: 0 points
   */
  calculateRejectionPoints(): PointsBreakdown {
    return {
      basePoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
      reason: 'Demande rejetée',
      breakdown: ['Pas de points pour un rejet'],
    };
  }

  /**
   * Calcule les points pour une évaluation client
   * Règle: De +25 à -10 selon les étoiles
   */
  calculateRatingPoints(stars: number): PointsBreakdown {
    let points = 0;
    let breakdown: string[] = [];

    switch (stars) {
      case 5:
        points = 25;
        breakdown = ['5 étoiles ⭐⭐⭐⭐⭐: +25 pts'];
        break;
      case 4:
        points = 15;
        breakdown = ['4 étoiles ⭐⭐⭐⭐: +15 pts'];
        break;
      case 3:
        points = 5;
        breakdown = ['3 étoiles ⭐⭐⭐: +5 pts'];
        break;
      case 2:
        points = 0;
        breakdown = ['2 étoiles ⭐⭐: 0 pts'];
        break;
      case 1:
        points = -10;
        breakdown = ['1 étoile ⭐: -10 pts (pénalité)'];
        break;
      default:
        points = 0;
        breakdown = ['Évaluation invalide: 0 pts'];
    }

    return {
      basePoints: Math.max(points, 0),
      bonusPoints: Math.min(points, 0),
      totalPoints: points,
      reason: `Évaluation client: ${stars}/5 étoiles`,
      breakdown,
    };
  }

  /**
   * Calcule la pénalité si pharmacie dit "Dispo" mais article non trouvé
   * Règle: -10 pts
   */
  calculateAvailabilityPenalty(): PointsBreakdown {
    return {
      basePoints: 0,
      bonusPoints: -10,
      totalPoints: -10,
      reason: 'Pénalité: Médicament non trouvé après confirmation',
      breakdown: ['Article indisponible malgré confirmation: -10 pts'],
    };
  }

  /**
   * Retourne le badge actuel basé sur les points
   */
  getBadgeForPoints(points: number): BadgeThreshold {
    return this.BADGE_THRESHOLDS.find(
      (badge) => points >= badge.minPoints && points < badge.maxPoints
    ) || this.BADGE_THRESHOLDS[0];
  }

  /**
   * Retourne tous les seuils de badges
   */
  getAllBadgeThresholds(): BadgeThreshold[] {
    return this.BADGE_THRESHOLDS;
  }

  /**
   * Applique les points à une pharmacie et gère les déblocages de badges
   */
  async applyPointsToPharmacy(
    pharmacyId: string,
    pointsBreakdown: PointsBreakdown,
    metadata?: any,
  ): Promise<{ newPoints: number; oldBadge: BadgeThreshold; newBadge: BadgeThreshold; badgeUnlocked: boolean }> {
    const pharmacy = await this.pharmacienModel.findByIdAndUpdate(
      pharmacyId,
      { $inc: { points: pointsBreakdown.totalPoints } },
      { new: true },
    ).exec();

    if (!pharmacy) {
      throw new Error(`Pharmacie non trouvée: ${pharmacyId}`);
    }

    const oldBadge = this.getBadgeForPoints(pharmacy.points - pointsBreakdown.totalPoints);
    const newBadge = this.getBadgeForPoints(pharmacy.points);
    const badgeUnlocked = oldBadge.badge !== newBadge.badge;

    // Si nouveau badge, le mettre à jour
    if (badgeUnlocked) {
      await this.pharmacienModel.findByIdAndUpdate(pharmacyId, {
        $set: { badgeLevel: newBadge.badge },
        $addToSet: { unlockedBadges: newBadge.badge },
      });

      // Logger le déblocage
      await this.activityModel.create({
        pharmacyId: new Types.ObjectId(pharmacyId),
        activityType: 'badge_unlocked',
        description: `Badge ${newBadge.emoji} ${newBadge.badge.toUpperCase()} débloqué!`,
        points: 0,
        metadata: {
          newBadge: newBadge.badge,
          totalPoints: pharmacy.points,
          emoji: newBadge.emoji,
        },
      });
    }

    // Logger l'activité des points
    await this.activityModel.create({
      pharmacyId: new Types.ObjectId(pharmacyId),
      activityType: 'points_earned',
      description: pointsBreakdown.reason,
      points: pointsBreakdown.totalPoints,
      metadata: {
        breakdown: pointsBreakdown.breakdown,
        newTotal: pharmacy.points,
        oldBadge: oldBadge.badge,
        newBadge: newBadge.badge,
        badgeUnlocked,
        ...metadata,
      },
    });

    return {
      newPoints: pharmacy.points,
      oldBadge,
      newBadge,
      badgeUnlocked,
    };
  }

  /**
   * Obtient le ranking d'une pharmacie parmi toutes les autres
   */
  async getPharmacyRanking(pharmacyId: string): Promise<{
    pharmacyId: string;
    rank: number;
    totalPharmacies: number;
    percentile: number;
    points: number;
  }> {
    const pharmacy = await this.pharmacienModel.findById(pharmacyId).exec();

    if (!pharmacy) {
      throw new Error(`Pharmacie non trouvée: ${pharmacyId}`);
    }

    // Compter combien de pharmacies ont plus de points
    const betterPharmacies = await this.pharmacienModel
      .countDocuments({ points: { $gt: pharmacy.points } })
      .exec();

    const totalPharmacies = await this.pharmacienModel.countDocuments().exec();
    const rank = betterPharmacies + 1;
    const percentile = Math.round(((totalPharmacies - betterPharmacies) / totalPharmacies) * 100);

    return {
      pharmacyId,
      rank,
      totalPharmacies,
      percentile,
      points: pharmacy.points,
    };
  }

  /**
   * Obtient l'historique des points du jour
   */
  async getDailyPointsHistory(pharmacyId: string): Promise<any[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const today = startOfDay.toISOString().split('T')[0];

    const history = await this.activityModel
      .find({
        pharmacyId: new Types.ObjectId(pharmacyId),
        activityType: 'points_earned',
        createdAt: { $gte: startOfDay },
      })
      .sort({ createdAt: -1 })
      .exec();

    return history.map((h: any) => ({
      timestamp: h.createdAt,
      points: h.points,
      description: h.description,
      breakdown: h.metadata?.breakdown || [],
    }));
  }

  /**
   * Obtient les statistiques complètes de points d'une pharmacie
   */
  async getPharmacyPointsStats(pharmacyId: string): Promise<any> {
    const pharmacy = await this.pharmacienModel.findById(pharmacyId).exec();

    if (!pharmacy) {
      throw new Error(`Pharmacie non trouvée: ${pharmacyId}`);
    }

    const badge = this.getBadgeForPoints(pharmacy.points);
    const ranking = await this.getPharmacyRanking(pharmacyId);
    const dailyHistory = await this.getDailyPointsHistory(pharmacyId);

    // Compter les points gagnés aujourd'hui
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayActivities = await this.activityModel
      .find({
        pharmacyId: new Types.ObjectId(pharmacyId),
        activityType: 'points_earned',
        createdAt: { $gte: startOfDay },
      })
      .exec();

    const pointsToday = todayActivities.reduce((sum, a: any) => sum + (a.points || 0), 0);

    return {
      currentPoints: pharmacy.points,
      badge: {
        name: badge.badge,
        emoji: badge.emoji,
        description: badge.description,
      },
      ranking,
      statistics: {
        totalRequests: pharmacy.totalRequestsReceived,
        totalAccepted: pharmacy.totalRequestsAccepted,
        totalDeclined: pharmacy.totalRequestsDeclined,
        acceptanceRate: pharmacy.totalRequestsReceived > 0 
          ? Math.round((pharmacy.totalRequestsAccepted / pharmacy.totalRequestsReceived) * 100) 
          : 0,
        averageResponseTime: pharmacy.averageResponseTime,
        totalClients: pharmacy.totalClients,
        averageRating: pharmacy.averageRating,
        totalReviews: pharmacy.totalReviews,
      },
      today: {
        pointsEarned: pointsToday,
        activitiesCount: todayActivities.length,
      },
      unlockedBadges: pharmacy.unlockedBadges || [],
      allBadgeThresholds: this.BADGE_THRESHOLDS,
      dailyHistory,
    };
  }
}
