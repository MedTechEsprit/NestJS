import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { MedicationRequestsService } from './medication-requests.service';
import { CreateMedicationRequestDto, RespondToRequestDto, CreateSimpleRequestDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Medication Requests')
@Controller('medication-request')
export class MedicationRequestsController {
  constructor(private readonly requestsService: MedicationRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle demande de médicament' })
  @ApiResponse({ status: 201, description: 'Demande créée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() createDto: CreateMedicationRequestDto) {
    return this.requestsService.create(createDto);
  }

  @Post('test/simple')
  @ApiOperation({ 
    summary: '🧪 TEST: Créer une demande simplifiée (patient → pharmacie)',
    description: 'Endpoint de test pour créer rapidement une demande avec seulement 3 champs. Expiration automatique après 3-4h.'
  })
  @ApiResponse({ status: 201, description: 'Demande de test créée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  createSimple(@Body() simpleDto: CreateSimpleRequestDto) {
    return this.requestsService.createSimple(simpleDto);
  }

  @Get('pharmacy/:pharmacyId/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer les demandes en attente pour une pharmacie' })
  @ApiResponse({ status: 200, description: 'Liste des demandes en attente' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  findPending(@Param('pharmacyId') pharmacyId: string) {
    return this.requestsService.findPending(pharmacyId);
  }

  @Get('pharmacy/:pharmacyId/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer l\'historique des demandes pour une pharmacie' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'medicationName', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Historique des demandes' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  findHistory(
    @Param('pharmacyId') pharmacyId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('medicationName') medicationName?: string,
  ) {
    return this.requestsService.findHistory(
      pharmacyId,
      page,
      limit,
      { status, startDate, endDate, medicationName },
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer une demande par ID' })
  @ApiResponse({ status: 200, description: 'Demande trouvée' })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  findOne(@Param('id') id: string) {
    return this.requestsService.findOne(id);
  }

  @Put(':id/respond')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Répondre à une demande de médicament' })
  @ApiResponse({ status: 200, description: 'Réponse enregistrée' })
  @ApiResponse({ status: 400, description: 'Demande invalide ou expirée' })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  respondToRequest(
    @Param('id') id: string,
    @Body() respondDto: RespondToRequestDto,
  ) {
    return this.requestsService.respondToRequest(id, respondDto.pharmacyId, respondDto);
  }

  @Put(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmer la pharmacie sélectionnée' })
  @ApiResponse({ status: 200, description: 'Confirmation enregistrée' })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  confirmRequest(
    @Param('id') id: string,
    @Body('selectedPharmacyId') selectedPharmacyId: string,
  ) {
    return this.requestsService.confirmRequest(id, selectedPharmacyId);
  }

  @Put(':id/pickup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marquer comme retiré' })
  @ApiResponse({ status: 200, description: 'Statut mis à jour' })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  markAsPickedUp(@Param('id') id: string) {
    return this.requestsService.markAsPickedUp(id);
  }
}
