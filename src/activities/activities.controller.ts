import {
  Controller,
  Get,
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
import { ActivitiesService } from './activities.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Pharmacy Activities')
@Controller('activity')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('pharmacy/:id')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Récupérer les activités d\'une pharmacie avec pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Liste des activités' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  findByPharmacy(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activitiesService.findByPharmacy(id, page, limit);
  }

  @Get('pharmacy/:id/feed')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Récupérer le fil d\'activité récent (8 dernières)' })
  @ApiResponse({ status: 200, description: 'Fil d\'activité récent' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  findFeed(@Param('id') id: string) {
    return this.activitiesService.findFeed(id);
  }
}
