import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MedicationRequest, MedicationRequestDocument } from '../medication-requests/schemas/medication-request.schema';
import { Pharmacien, PharmacienDocument } from '../pharmaciens/schemas/pharmacien.schema';
import { PharmacyActivity, PharmacyActivityDocument } from '../activities/schemas/pharmacy-activity.schema';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @InjectModel(MedicationRequest.name) private requestModel: Model<MedicationRequestDocument>,
    @InjectModel(Pharmacien.name) private pharmacienModel: Model<PharmacienDocument>,
    @InjectModel(PharmacyActivity.name) private activityModel: Model<PharmacyActivityDocument>,
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
}
