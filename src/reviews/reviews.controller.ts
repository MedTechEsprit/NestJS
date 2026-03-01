import {
  Controller,
  Get,
  Post,
  Delete,
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
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Reviews')
@Controller('review')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un nouvel avis' })
  @ApiResponse({ status: 201, description: 'Avis créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() createDto: CreateReviewDto) {
    return this.reviewsService.create(createDto);
  }

  @Get('pharmacy/:pharmacyId')
  @ApiOperation({ summary: 'Récupérer les avis d\'une pharmacie' })
  @ApiQuery({ name: 'rating', required: false, type: Number, description: 'Filtrer par note' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Liste des avis' })
  findByPharmacy(
    @Param('pharmacyId') pharmacyId: string,
    @Query('rating') rating?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.findByPharmacy(pharmacyId, rating, page, limit);
  }

  @Get('pharmacy/:pharmacyId/summary')
  @ApiOperation({ summary: 'Récupérer le résumé des avis d\'une pharmacie' })
  @ApiResponse({ status: 200, description: 'Résumé des avis' })
  getSummary(@Param('pharmacyId') pharmacyId: string) {
    return this.reviewsService.getSummary(pharmacyId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un avis' })
  @ApiResponse({ status: 200, description: 'Avis supprimé' })
  @ApiResponse({ status: 404, description: 'Avis non trouvé' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  deleteReview(@Param('id') id: string) {
    return this.reviewsService.deleteReview(id);
  }
}
