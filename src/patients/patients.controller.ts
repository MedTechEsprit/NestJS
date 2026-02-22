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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';
import { TypeDiabete } from '../common/enums/type-diabete.enum';

@ApiTags('Patients')
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Créer un nouveau patient (Médecin uniquement)' })
  @ApiResponse({ status: 201, description: 'Patient créé avec succès' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  create(@Body() createPatientDto: CreatePatientDto) {
    return this.patientsService.create(createPatientDto);
  }

  @Get()
  @Roles(Role.MEDECIN, Role.PHARMACIEN)
  @ApiOperation({ summary: 'Récupérer tous les patients avec pagination' })
  @ApiResponse({ status: 200, description: 'Liste des patients' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.patientsService.findAll(paginationDto);
  }

  @Get('by-type/:typeDiabete')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Filtrer les patients par type de diabète' })
  @ApiQuery({ name: 'typeDiabete', enum: TypeDiabete })
  @ApiResponse({ status: 200, description: 'Liste des patients filtrés' })
  findByTypeDiabete(
    @Param('typeDiabete') typeDiabete: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.patientsService.findByTypeDiabete(typeDiabete, paginationDto);
  }

  @Get('debug/all-roles')
  @Roles(Role.MEDECIN, Role.PHARMACIEN)
  @ApiOperation({ summary: 'Debug: voir tous les utilisateurs avec leurs rôles' })
  @ApiResponse({ status: 200, description: 'Liste de tous les utilisateurs avec rôles' })
  debugAllRoles() {
    return this.patientsService.debugAllRoles();
  }

  @Get('search/by-name-or-email')
  @Roles(Role.MEDECIN, Role.PHARMACIEN)
  @ApiOperation({ summary: 'Rechercher un patient par nom ou email' })
  @ApiQuery({ name: 'query', required: true, type: String, description: 'Nom, prénom ou email du patient' })
  @ApiResponse({ status: 200, description: 'Patients trouvés' })
  @ApiResponse({ status: 400, description: 'Paramètre de recherche manquant' })
  searchByNameOrEmail(@Query('query') query: string) {
    return this.patientsService.searchByNameOrEmail(query);
  }

  @Get(':id')
  @Roles(Role.PATIENT, Role.MEDECIN, Role.PHARMACIEN)
  @ApiOperation({ summary: 'Récupérer un patient par son ID' })
  @ApiResponse({ status: 200, description: 'Patient trouvé' })
  @ApiResponse({ status: 404, description: 'Patient non trouvé' })
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.PATIENT, Role.MEDECIN)
  @ApiOperation({ summary: 'Mettre à jour un patient' })
  @ApiResponse({ status: 200, description: 'Patient mis à jour' })
  @ApiResponse({ status: 404, description: 'Patient non trouvé' })
  update(@Param('id') id: string, @Body() updatePatientDto: UpdatePatientDto) {
    return this.patientsService.update(id, updatePatientDto);
  }

  @Delete(':id')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Supprimer un patient (Médecin uniquement)' })
  @ApiResponse({ status: 200, description: 'Patient supprimé' })
  @ApiResponse({ status: 404, description: 'Patient non trouvé' })
  remove(@Param('id') id: string) {
    return this.patientsService.remove(id);
  }
}
