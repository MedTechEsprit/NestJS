import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { GlucoseService } from './glucose.service';
import { CreateGlucoseDto } from './dto/create-glucose.dto';
import { UpdateGlucoseDto } from './dto/update-glucose.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Glucose')
@Controller('glucose')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class GlucoseController {
  constructor(private readonly glucoseService: GlucoseService) {}

  @Post()
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Créer un nouvel enregistrement de glycémie' })
  @ApiResponse({ status: 201, description: 'Enregistrement créé avec succès' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  create(
    @CurrentUser('_id') patientId: string,
    @Body() createGlucoseDto: CreateGlucoseDto,
  ) {
    return this.glucoseService.create(patientId, createGlucoseDto);
  }

  @Get('my-records')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Récupérer mes enregistrements de glycémie avec pagination' })
  @ApiResponse({ status: 200, description: 'Liste des enregistrements' })
  findMyRecords(
    @CurrentUser('_id') patientId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.glucoseService.findMyRecords(patientId, paginationDto);
  }

  @Get()
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Filtrer les enregistrements par plage de dates' })
  @ApiQuery({ name: 'start', required: true, description: 'Date de début (ISO 8601)' })
  @ApiQuery({ name: 'end', required: true, description: 'Date de fin (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Liste des enregistrements filtrés' })
  findByDateRange(
    @CurrentUser('_id') patientId: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return this.glucoseService.findByDateRange(patientId, startDate, endDate);
  }

  @Get('stats/weekly')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Statistiques des 7 derniers jours' })
  @ApiResponse({ status: 200, description: 'Statistiques hebdomadaires' })
  getWeeklyStats(@CurrentUser('_id') patientId: string) {
    return this.glucoseService.getWeeklyStats(patientId);
  }

  @Get('stats/monthly')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Statistiques des 30 derniers jours' })
  @ApiResponse({ status: 200, description: 'Statistiques mensuelles' })
  getMonthlyStats(@CurrentUser('_id') patientId: string) {
    return this.glucoseService.getMonthlyStats(patientId);
  }

  @Get('stats/daily-average')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Moyenne quotidienne groupée par jour' })
  @ApiQuery({ name: 'days', required: false, description: 'Nombre de jours (défaut: 30)' })
  @ApiResponse({ status: 200, description: 'Moyennes quotidiennes' })
  getDailyAverage(
    @CurrentUser('_id') patientId: string,
    @Query('days') days?: number,
  ) {
    return this.glucoseService.getDailyAverage(patientId, days);
  }

  @Get('stats/alerts')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Nombre d\'alertes hypo/hyper des 30 derniers jours' })
  @ApiResponse({ status: 200, description: 'Statistiques des alertes' })
  getAlerts(@CurrentUser('_id') patientId: string) {
    return this.glucoseService.getAlerts(patientId);
  }

  @Get('stats/hba1c')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Estimation de l\'HbA1c basée sur les 90 derniers jours' })
  @ApiResponse({ status: 200, description: 'HbA1c estimée' })
  getHbA1c(@CurrentUser('_id') patientId: string) {
    return this.glucoseService.getHbA1c(patientId);
  }

  @Get('stats/time-in-range')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Pourcentage de temps dans/hors de la plage cible' })
  @ApiQuery({ name: 'days', required: false, description: 'Nombre de jours (défaut: 30)' })
  @ApiResponse({ status: 200, description: 'Temps dans la plage' })
  getTimeInRange(
    @CurrentUser('_id') patientId: string,
    @Query('days') days?: number,
  ) {
    return this.glucoseService.getTimeInRange(patientId, days);
  }

  @Get('stats/chart')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Données groupées pour graphiques' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'], description: 'Période (défaut: 7d)' })
  @ApiResponse({ status: 200, description: 'Données du graphique' })
  getChartData(
    @CurrentUser('_id') patientId: string,
    @Query('period') period?: string,
  ) {
    return this.glucoseService.getChartData(patientId, period);
  }

  @Get('stats/trend')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Tendance: comparaison 7 derniers jours vs 7 jours précédents' })
  @ApiResponse({ status: 200, description: 'Tendance de glycémie' })
  getTrend(@CurrentUser('_id') patientId: string) {
    return this.glucoseService.getTrend(patientId);
  }

  @Get('patient/:patientId/records')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Récupérer les enregistrements de glycémie d\'un patient (Médecin)' })
  @ApiResponse({ status: 200, description: 'Liste des enregistrements du patient' })
  async findPatientRecords(
    @Param('patientId') patientId: string,
    @CurrentUser('_id') doctorId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    const canAccess = await this.glucoseService.canDoctorAccessPatient(doctorId, patientId);
    if (!canAccess) {
      throw new ForbiddenException('Accès glycémie refusé par le patient. Envoyez une demande d\'autorisation.');
    }
    return this.glucoseService.findMyRecords(patientId, paginationDto);
  }

  @Get(':id')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Récupérer un enregistrement spécifique' })
  @ApiResponse({ status: 200, description: 'Enregistrement trouvé' })
  @ApiResponse({ status: 404, description: 'Enregistrement non trouvé' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('_id') patientId: string,
  ) {
    return this.glucoseService.findOne(id, patientId);
  }

  @Patch(':id')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Mettre à jour un enregistrement' })
  @ApiResponse({ status: 200, description: 'Enregistrement mis à jour' })
  @ApiResponse({ status: 404, description: 'Enregistrement non trouvé' })
  update(
    @Param('id') id: string,
    @CurrentUser('_id') patientId: string,
    @Body() updateGlucoseDto: UpdateGlucoseDto,
  ) {
    return this.glucoseService.update(id, patientId, updateGlucoseDto);
  }

  @Delete(':id')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Supprimer un enregistrement' })
  @ApiResponse({ status: 200, description: 'Enregistrement supprimé' })
  @ApiResponse({ status: 404, description: 'Enregistrement non trouvé' })
  remove(
    @Param('id') id: string,
    @CurrentUser('_id') patientId: string,
  ) {
    return this.glucoseService.remove(id, patientId);
  }
}
