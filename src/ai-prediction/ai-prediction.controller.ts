import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AiPredictionService } from './ai-prediction.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PremiumGuard } from '../subscriptions/guards/premium.guard';

@ApiTags('AI Prediction')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PremiumGuard)
@Controller('ai-prediction')
export class AiPredictionController {
  constructor(private readonly aiPredictionService: AiPredictionService) {}

  // ── POST /ai-prediction — Prédiction manuelle ─────────────────────────────

  @Post()
  @Roles(Role.PATIENT)
  @ApiOperation({
    summary: 'Prédiction glycémique manuelle',
    description:
      'Le patient demande une prédiction de sa tendance glycémique ' +
      'pour les 2-4 prochaines heures basée sur son historique récent.',
  })
  @ApiResponse({
    status: 201,
    description: 'Prédiction générée avec succès',
    schema: {
      example: {
        predictionId: '665abc123',
        prediction: {
          trend: 'increase',
          confidence: 80,
          estimatedValue2h: 170,
          estimatedValue4h: 155,
          riskLevel: 'moderate',
          riskType: 'hyperglycemia_risk',
          alerts: [],
          recommendations: ['Évitez les sucres rapides', 'Marchey 20 minutes'],
          timeToAction: 'within_1h',
          explanation: 'Votre glycémie tend à augmenter.',
          summary: 'Tendance à la hausse modérée prévue dans 2h.',
        },
        triggerType: 'manual',
        createdAt: '2026-03-01T12:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle non autorisé' })
  async predictManual(@CurrentUser('_id') patientId: string) {
    return this.aiPredictionService.predictTrend(String(patientId));
  }

  // ── POST /ai-prediction/post-meal/:mealId ─────────────────────────────────

  @Post('post-meal/:mealId')
  @Roles(Role.PATIENT)
  @ApiOperation({
    summary: 'Prédiction glycémique post-repas',
    description:
      'Prédiction déclenchée automatiquement après une analyse AiFoodAnalyzer. ' +
      'Prend en compte les nutriments du repas consommé pour affiner la prédiction.',
  })
  @ApiParam({ name: 'mealId', description: 'ID du repas analysé' })
  @ApiResponse({ status: 201, description: 'Prédiction post-repas générée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle non autorisé' })
  async predictPostMeal(
    @CurrentUser('_id') patientId: string,
    @Param('mealId') mealId: string,
  ) {
    return this.aiPredictionService.predictTrend(String(patientId), mealId);
  }

  // ── GET /ai-prediction/history ────────────────────────────────────────────

  @Get('history')
  @Roles(Role.PATIENT)
  @ApiOperation({
    summary: 'Historique des prédictions du patient',
    description: 'Retourne les prédictions paginées du patient connecté, triées par date décroissante.',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des prédictions' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getHistory(
    @CurrentUser('_id') patientId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.aiPredictionService.getHistory(
      String(patientId),
      pagination.page ?? 1,
      pagination.limit ?? 10,
    );
  }

  // ── GET /ai-prediction/:id ────────────────────────────────────────────────

  @Get(':id')
  @Roles(Role.PATIENT, Role.MEDECIN)
  @ApiOperation({
    summary: 'Détail d\'une prédiction',
    description:
      'Retourne les détails complets d\'une prédiction. ' +
      'Un patient ne peut accéder qu\'à ses propres prédictions.',
  })
  @ApiParam({ name: 'id', description: 'ID de la prédiction' })
  @ApiResponse({ status: 200, description: 'Prédiction trouvée' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Prédiction non trouvée' })
  async getById(
    @CurrentUser('_id') requesterId: string,
    @Param('id') id: string,
  ) {
    return this.aiPredictionService.getById(id, String(requesterId));
  }
}
