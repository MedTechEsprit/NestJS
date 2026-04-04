import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AiDoctorService } from './ai-doctor.service';
import { AiDoctorChatDto } from './dto/ai-doctor-chat.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('AI Doctor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MEDECIN)
@Controller('ai-doctor')
export class AiDoctorController {
  constructor(private readonly aiDoctorService: AiDoctorService) {}

  // ── POST /ai-doctor/chat/:patientId ─────────────────────────────────────────

  @Post('chat/:patientId')
  @ApiOperation({
    summary: 'Poser une question sur un patient spécifique',
    description:
      'Analyse un patient en particulier. ' +
      'Le médecin ne peut interroger que ses propres patients. ' +
      'MediAssist utilise les données glycémiques et nutritionnelles réelles.',
  })
  @ApiParam({ name: 'patientId', description: 'ID du patient à analyser' })
  @ApiResponse({ status: 201, description: 'Réponse IA retournée' })
  @ApiResponse({ status: 403, description: 'Patient non dans votre liste' })
  @ApiResponse({ status: 503, description: 'Service Ollama indisponible' })
  async chatAboutPatient(
    @CurrentUser('_id') doctorId: string,
    @Param('patientId') patientId: string,
    @Body() dto: AiDoctorChatDto,
  ) {
    return this.aiDoctorService.chatAboutPatient(
      String(doctorId),
      patientId,
      dto.message,
    );
  }

  // ── POST /ai-doctor/chat ────────────────────────────────────────────────────

  @Post('chat')
  @ApiOperation({
    summary: 'Analyser tous mes patients',
    description:
      'Vue d\'ensemble de tous les patients du médecin. ' +
      'Limité à 20 patients par appel. ' +
      'Détecte automatiquement les urgences avant de les soumettre à l\'IA.',
  })
  @ApiResponse({ status: 201, description: 'Réponse IA retournée' })
  @ApiResponse({
    status: 400,
    description: 'Aucun patient assigné',
  })
  @ApiResponse({ status: 503, description: 'Service Ollama indisponible' })
  async chatAboutAllPatients(
    @CurrentUser('_id') doctorId: string,
    @Body() dto: AiDoctorChatDto,
  ) {
    return this.aiDoctorService.chatAboutAllPatients(String(doctorId), dto.message);
  }

  // ── GET /ai-doctor/urgent ───────────────────────────────────────────────────

  @Get('urgent')
  @ApiOperation({
    summary: 'Vérifier les patients en situation urgente (instantané)',
    description:
      'Calcul local sans Ollama — réponse immédiate. ' +
      'Détecte : glycémie moyenne > 200, HbA1c estimé > 9%, ' +
      'plus de 5 hypos, dernière valeur > 250 mg/dL.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des patients urgents',
    schema: {
      example: {
        urgentPatients: [
          {
            patientId: '665abc',
            patientName: 'Mohamed Ali',
            flags: ['🚨 HbA1c > 9%', '⚠️ AVERAGE > 200 mg/dL'],
            lastGlucose: 267,
            avgGlucose: 213,
            recommendation: 'Consultation immédiate recommandée',
          },
        ],
        totalPatientsChecked: 15,
        urgentCount: 1,
        checkedAt: '2026-03-01T08:00:00Z',
      },
    },
  })
  async urgentCheck(@CurrentUser('_id') doctorId: string) {
    return this.aiDoctorService.urgentCheck(String(doctorId));
  }

  // ── GET /ai-doctor/history ─────────────────────────────────────────────────

  @Get('history')
  @ApiOperation({
    summary: 'Historique de mes conversations IA',
    description:
      'Retourne les échanges avec MediAssist, triés par date décroissante. ' +
      'Filtrer par patientId pour voir les conversations sur un patient spécifique.',
  })
  @ApiQuery({
    name: 'patientId',
    required: false,
    description: 'Filtrer par patient (optionnel)',
  })
  @ApiResponse({ status: 200, description: 'Historique paginé' })
  async getChatHistory(
    @CurrentUser('_id') doctorId: string,
    @Query('patientId') patientId: string | undefined,
    @Query() pagination: PaginationDto,
  ) {
    return this.aiDoctorService.getChatHistory(
      String(doctorId),
      patientId,
      pagination.page ?? 1,
      pagination.limit ?? 10,
    );
  }

  @Get('report/:patientId')
  @ApiOperation({
    summary: 'Generer un rapport medical detaille d\'un patient (Gemini)',
    description:
      'Construit un rapport clinique structure en utilisant les donnees du patient ' +
      '(profil, glycemie, nutrition, prediction) et Gemini.',
  })
  @ApiParam({ name: 'patientId', description: 'ID du patient a analyser' })
  @ApiResponse({ status: 200, description: 'Rapport medical genere avec succes' })
  @ApiResponse({ status: 403, description: 'Patient non dans votre liste' })
  @ApiResponse({ status: 503, description: 'Service Gemini indisponible' })
  async getPatientMedicalReport(
    @CurrentUser('_id') doctorId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.aiDoctorService.generatePatientMedicalReport(
      String(doctorId),
      patientId,
    );
  }
}
