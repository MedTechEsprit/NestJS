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
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PharmaciensService } from './pharmaciens.service';
import { CreatePharmacienDto } from './dto/create-pharmacien.dto';
import { UpdatePharmacienDto } from './dto/update-pharmacien.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Pharmaciens')
@Controller('pharmaciens')
export class PharmaciensController {
  constructor(private readonly pharmaciensService: PharmaciensService) {}

  // ============ ROUTES PUBLIQUES ============

  @Get('nearby')
  @ApiOperation({ summary: 'Rechercher des pharmacies à proximité (public)' })
  @ApiQuery({ name: 'lat', required: true, type: Number, description: 'Latitude' })
  @ApiQuery({ name: 'lng', required: true, type: Number, description: 'Longitude' })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'Rayon en km', example: 5 })
  @ApiResponse({ status: 200, description: 'Liste des pharmacies proches' })
  findNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.pharmaciensService.findNearby(Number(lat), Number(lng), radius ? Number(radius) : 5);
  }

  // ============ ROUTES PROTÉGÉES ============

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un nouveau pharmacien' })
  @ApiResponse({ status: 201, description: 'Pharmacien créé avec succès' })
  @ApiResponse({ status: 409, description: 'Email ou numéro d\'ordre déjà utilisé' })
  create(@Body() createPharmacienDto: CreatePharmacienDto) {
    return this.pharmaciensService.create(createPharmacienDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer un pharmacien par son ID' })
  @ApiResponse({ status: 200, description: 'Pharmacien trouvé' })
  @ApiResponse({ status: 404, description: 'Pharmacien non trouvé' })
  findOne(@Param('id') id: string) {
    return this.pharmaciensService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour un pharmacien' })
  @ApiResponse({ status: 200, description: 'Pharmacien mis à jour' })
  @ApiResponse({ status: 404, description: 'Pharmacien non trouvé' })
  update(@Param('id') id: string, @Body() updatePharmacienDto: UpdatePharmacienDto) {
    return this.pharmaciensService.update(id, updatePharmacienDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un pharmacien' })
  @ApiResponse({ status: 200, description: 'Pharmacien supprimé' })
  @ApiResponse({ status: 404, description: 'Pharmacien non trouvé' })
  remove(@Param('id') id: string) {
    return this.pharmaciensService.remove(id);
  }

  @Post(':id/medicaments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ajouter un médicament à la liste' })
  @ApiResponse({ status: 200, description: 'Médicament ajouté' })
  addMedicament(@Param('id') id: string, @Body('medicament') medicament: string) {
    return this.pharmaciensService.addMedicament(id, medicament);
  }

  @Delete(':id/medicaments/:medicament')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retirer un médicament de la liste' })
  @ApiResponse({ status: 200, description: 'Médicament retiré' })
  removeMedicament(
    @Param('id') id: string,
    @Param('medicament') medicament: string,
  ) {
    return this.pharmaciensService.removeMedicament(id, medicament);
  }

  @Patch(':id/note')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Noter un pharmacien' })
  @ApiResponse({ status: 200, description: 'Note mise à jour' })
  updateNote(@Param('id') id: string, @Body('note') note: number) {
    return this.pharmaciensService.updateNote(id, note);
  }

  // ============ NOUVELLES ROUTES BUSINESS ============

  @Put(':id/working-hours')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour les horaires de travail' })
  @ApiResponse({ status: 200, description: 'Horaires mis à jour' })
  @ApiResponse({ status: 404, description: 'Pharmacien non trouvé' })
  updateWorkingHours(@Param('id') id: string, @Body('workingHours') workingHours: any) {
    return this.pharmaciensService.updateWorkingHours(id, workingHours);
  }

  @Put(':id/duty')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Basculer le statut de pharmacie de garde' })
  @ApiResponse({ status: 200, description: 'Statut mis à jour' })
  @ApiResponse({ status: 404, description: 'Pharmacien non trouvé' })
  toggleDuty(@Param('id') id: string) {
    return this.pharmaciensService.toggleDuty(id);
  }

  @Put(':id/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour les paramètres de notification' })
  @ApiResponse({ status: 200, description: 'Paramètres mis à jour' })
  @ApiResponse({ status: 404, description: 'Pharmacien non trouvé' })
  updateSettings(@Param('id') id: string, @Body() settings: any) {
    return this.pharmaciensService.updateSettings(id, settings);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer les statistiques de la pharmacie' })
  @ApiResponse({ status: 200, description: 'Statistiques de la pharmacie' })
  @ApiResponse({ status: 404, description: 'Pharmacien non trouvé' })
  getStats(@Param('id') id: string) {
    return this.pharmaciensService.getStats(id);
  }

  @Get(':id/stats/monthly')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer les statistiques mensuelles' })
  @ApiResponse({ status: 200, description: 'Statistiques mensuelles' })
  @ApiResponse({ status: 404, description: 'Pharmacien non trouvé' })
  getMonthlyStats(@Param('id') id: string) {
    return this.pharmaciensService.getMonthlyStats(id);
  }

  @Get(':id/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PHARMACIEN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer le tableau de bord complet' })
  @ApiResponse({ status: 200, description: 'Tableau de bord de la pharmacie' })
  @ApiResponse({ status: 404, description: 'Pharmacien non trouvé' })
  getDashboard(@Param('id') id: string) {
    return this.pharmaciensService.getDashboard(id);
  }
}
