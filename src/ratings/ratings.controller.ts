import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { CreateRatingDto, RatingResponseDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Ratings')
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer une nouvelle évaluation (patient)' })
  @ApiResponse({ status: 201, description: 'Évaluation créée et points appliqués' })
  @ApiResponse({ status: 400, description: 'Données invalides ou évaluation déjà existante' })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async create(@Body() createRatingDto: CreateRatingDto): Promise<any> {
    return this.ratingsService.create(createRatingDto);
  }

  @Get('pharmacy/:pharmacyId')
  @ApiOperation({ summary: 'Récupérer toutes les évaluations d\'une pharmacie' })
  @ApiResponse({ status: 200, description: 'Liste des évaluations' })
  @ApiResponse({ status: 404, description: 'Pharmacie non trouvée' })
  async findByPharmacy(@Param('pharmacyId') pharmacyId: string): Promise<any[]> {
    return this.ratingsService.findByPharmacy(pharmacyId);
  }

  @Get('pharmacy/:pharmacyId/stats')
  @ApiOperation({ summary: 'Récupérer les statistiques d\'évaluation d\'une pharmacie' })
  @ApiResponse({ status: 200, description: 'Statistiques de rating' })
  @ApiResponse({ status: 404, description: 'Pharmacie non trouvée' })
  async getPharmacyStats(@Param('pharmacyId') pharmacyId: string): Promise<any> {
    return this.ratingsService.getPharmacyRatingStats(pharmacyId);
  }

  @Get('medication-request/:medicationRequestId')
  @ApiOperation({ summary: 'Récupérer l\'évaluation d\'une demande' })
  @ApiResponse({ status: 200, description: 'Évaluation trouvée' })
  @ApiResponse({ status: 404, description: 'Évaluation non trouvée' })
  async findByMedicationRequest(@Param('medicationRequestId') medicationRequestId: string): Promise<any> {
    return this.ratingsService.findByMedicationRequest(medicationRequestId);
  }
}
