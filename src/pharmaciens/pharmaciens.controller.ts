import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PharmaciensService } from './pharmaciens.service';
import { UpdatePharmacienDto } from './dto/update-pharmacien.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Pharmaciens')
@Controller('pharmaciens')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PharmaciensController {
  constructor(private readonly pharmaciensService: PharmaciensService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les pharmaciens avec pagination' })
  @ApiQuery({ name: 'nomPharmacie', required: false, description: 'Filtrer par nom de pharmacie' })
  @ApiResponse({ status: 200, description: 'Liste des pharmaciens' })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('nomPharmacie') nomPharmacie?: string,
  ) {
    return this.pharmaciensService.findAll(paginationDto, nomPharmacie);
  }

  @Get('search/medicament')
  @ApiOperation({ summary: 'Rechercher des pharmacies par médicament disponible' })
  @ApiQuery({ name: 'medicament', required: true, description: 'Nom du médicament' })
  @ApiResponse({ status: 200, description: 'Liste des pharmacies avec le médicament' })
  searchByMedicament(
    @Query('medicament') medicament: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.pharmaciensService.searchByMedicament(medicament, paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un pharmacien par son ID' })
  @ApiResponse({ status: 200, description: 'Pharmacien trouvé' })
  @ApiResponse({ status: 404, description: 'Pharmacien non trouvé' })
  findOne(@Param('id') id: string) {
    return this.pharmaciensService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Mettre à jour un pharmacien' })
  @ApiResponse({ status: 200, description: 'Pharmacien mis à jour' })
  @ApiResponse({ status: 404, description: 'Pharmacien non trouvé' })
  update(@Param('id') id: string, @Body() updatePharmacienDto: UpdatePharmacienDto) {
    return this.pharmaciensService.update(id, updatePharmacienDto);
  }

  @Delete(':id')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Supprimer un pharmacien' })
  @ApiResponse({ status: 200, description: 'Pharmacien supprimé' })
  @ApiResponse({ status: 404, description: 'Pharmacien non trouvé' })
  remove(@Param('id') id: string) {
    return this.pharmaciensService.remove(id);
  }

  @Post(':id/medicaments')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Ajouter un médicament à la liste' })
  @ApiResponse({ status: 200, description: 'Médicament ajouté' })
  addMedicament(@Param('id') id: string, @Body('medicament') medicament: string) {
    return this.pharmaciensService.addMedicament(id, medicament);
  }

  @Delete(':id/medicaments/:medicament')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Retirer un médicament de la liste' })
  @ApiResponse({ status: 200, description: 'Médicament retiré' })
  removeMedicament(
    @Param('id') id: string,
    @Param('medicament') medicament: string,
  ) {
    return this.pharmaciensService.removeMedicament(id, medicament);
  }

  @Patch(':id/note')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Noter un pharmacien' })
  @ApiResponse({ status: 200, description: 'Note mise à jour' })
  updateNote(@Param('id') id: string, @Body('note') note: number) {
    return this.pharmaciensService.updateNote(id, note);
  }
}
