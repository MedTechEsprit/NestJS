import {
  Controller,
  Get,
  Post,
  Put,
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
import { BoostsService } from './boosts.service';
import { CreateBoostDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Boosts')
@Controller('boost')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BoostsController {
  constructor(private readonly boostsService: BoostsService) {}

  @Post()
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Activer un nouveau boost' })
  @ApiResponse({ status: 201, description: 'Boost activé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  activate(@Body() createDto: CreateBoostDto) {
    return this.boostsService.activate(createDto);
  }

  @Get('pharmacy/:id')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Récupérer tous les boosts d\'une pharmacie' })
  @ApiResponse({ status: 200, description: 'Liste des boosts' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  findByPharmacy(@Param('id') id: string) {
    return this.boostsService.findByPharmacy(id);
  }

  @Get('pharmacy/:id/active')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Récupérer le boost actif d\'une pharmacie' })
  @ApiResponse({ status: 200, description: 'Boost actif trouvé' })
  @ApiResponse({ status: 404, description: 'Aucun boost actif' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  findActive(@Param('id') id: string) {
    return this.boostsService.findActive(id);
  }

  @Put(':id/cancel')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Annuler un boost' })
  @ApiResponse({ status: 200, description: 'Boost annulé' })
  @ApiResponse({ status: 404, description: 'Boost non trouvé' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  cancelBoost(@Param('id') id: string) {
    return this.boostsService.cancelBoost(id);
  }
}
