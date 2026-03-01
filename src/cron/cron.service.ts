import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MedicationRequest, MedicationRequestDocument } from '../medication-requests/schemas/medication-request.schema';
import { Pharmacien, PharmacienDocument } from '../pharmaciens/schemas/pharmacien.schema';
import { PharmacyActivity, PharmacyActivityDocument } from '../activities/schemas/pharmacy-activity.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AiPatternService } from '../ai-pattern/ai-pattern.service';
import { Role } from '../common/enums/role.enum';
import { StatutCompte } from '../common/enums/statut-compte.enum';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @InjectModel(MedicationRequest.name) private requestModel: Model<MedicationRequestDocument>,
    @InjectModel(Pharmacien.name) private pharmacienModel: Model<PharmacienDocument>,
    @InjectModel(PharmacyActivity.name) private activityModel: Model<PharmacyActivityDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly aiPatternService: AiPatternService,
  ) {}

  @Cron('*/5 * * * *') // Toutes les 5 minutes
  async handleExpiredRequests() {
    this.logger.debug('Vérification des demandes expirées...');

    const now = new Date();

    // Trouver toutes les demandes expirées et encore ouvertes
    const expiredRequests = await this.requestModel
      .find({
        expiresAt: { $lte: now },
        globalStatus: 'open',
      })
      .exec();

    this.logger.debug(`${expiredRequests.length} demandes expirées trouvées`);

    for (const request of expiredRequests) {
      let hasAccepted = false;

      // Parcourir les réponses de chaque pharmacie
      for (const response of request.pharmacyResponses) {
        if (response.status === 'accepted') {
          hasAccepted = true;
        } else if (response.status === 'pending') {
          // Marquer comme expiré et retirer des points
          await this.requestModel.updateOne(
            {
              _id: request._id,
              'pharmacyResponses.pharmacyId': response.pharmacyId,
            },
            {
              $set: {
                'pharmacyResponses.$.status': 'expired',
              },
            },
          ).exec();

          // Retirer 2 points à la pharmacie
          await this.pharmacienModel.findByIdAndUpdate(
            response.pharmacyId,
            { $inc: { points: -2 } },
          ).exec();

          // Logger l'activité
          await this.activityModel.create({
            pharmacyId: response.pharmacyId,
            activityType: 'request_declined',
            description: `Demande expirée sans réponse: ${request.medicationName}`,
            points: -2,
            metadata: {
              requestId: request._id,
              reason: 'expired_no_response',
            },
          });

          this.logger.debug(
            `Pharmacie ${response.pharmacyId} pénalisée de -2 points pour non-réponse`,
          );
        }
      }

      // Mettre à jour le statut global
      const newGlobalStatus = hasAccepted ? 'open' : 'expired';
      await this.requestModel.findByIdAndUpdate(request._id, {
        $set: { globalStatus: newGlobalStatus },
      }).exec();

      this.logger.debug(
        `Demande ${request._id} marquée comme ${newGlobalStatus}`,
      );
    }

    if (expiredRequests.length > 0) {
      this.logger.log(`${expiredRequests.length} demandes traitées`);
    }
  }

  // ── Weekly pattern analysis — every Monday at 08:00 ─────────────────────

  @Cron('0 8 * * 1')
  async weeklyPatternAnalysis(): Promise<void> {
    this.logger.log('⏰ Weekly pattern analysis started...');

    const patients = await this.userModel
      .find({ role: Role.PATIENT, statutCompte: StatutCompte.ACTIF })
      .select('_id')
      .lean()
      .exec();

    this.logger.log(`Found ${patients.length} active patients to analyze`);

    let successCount = 0;
    let errorCount = 0;

    for (const patient of patients) {
      try {
        await this.aiPatternService.analyzePatterns(String(patient._id), 'cron');
        successCount++;
        this.logger.log(`✅ Pattern analyzed for patient ${patient._id}`);
      } catch (err) {
        errorCount++;
        this.logger.warn(
          `⚠️ Pattern analysis failed for patient ${patient._id}: ${
            (err as Error).message
          }`,
        );
        // Continue with next patient — never throw
      }

      // 3-second delay between patients to avoid overloading Ollama
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    this.logger.log(
      `✅ Weekly pattern analysis done. Success: ${successCount}, Errors: ${errorCount}`,
    );
  }
}
