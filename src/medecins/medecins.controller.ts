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
import { MedecinsService } from './medecins.service';
import { UpdateMedecinDto } from './dto/update-medecin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Médecins')
@Controller('medecins')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MedecinsController {
  constructor(private readonly medecinsService: MedecinsService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les médecins avec pagination' })
  @ApiQuery({ name: 'specialite', required: false, description: 'Filtrer par spécialité' })
  @ApiResponse({ status: 200, description: 'Liste des médecins' })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('specialite') specialite?: string,
  ) {
    return this.medecinsService.findAll(paginationDto, specialite);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un médecin par son ID' })
  @ApiResponse({ status: 200, description: 'Médecin trouvé' })
  @ApiResponse({ status: 404, description: 'Médecin non trouvé' })
  findOne(@Param('id') id: string) {
    return this.medecinsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Mettre à jour un médecin' })
  @ApiResponse({ status: 200, description: 'Médecin mis à jour' })
  @ApiResponse({ status: 404, description: 'Médecin non trouvé' })
  update(@Param('id') id: string, @Body() updateMedecinDto: UpdateMedecinDto) {
    return this.medecinsService.update(id, updateMedecinDto);
  }

  @Delete(':id')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Supprimer un médecin' })
  @ApiResponse({ status: 200, description: 'Médecin supprimé' })
  @ApiResponse({ status: 404, description: 'Médecin non trouvé' })
  remove(@Param('id') id: string) {
    return this.medecinsService.remove(id);
  }

  @Post(':id/patients/:patientId')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Ajouter un patient à la liste du médecin' })
  @ApiResponse({ status: 200, description: 'Patient ajouté' })
  @ApiResponse({ status: 404, description: 'Médecin non trouvé' })
  @ApiResponse({ status: 409, description: 'Patient déjà dans la liste' })
  addPatient(
    @Param('id') id: string,
    @Param('patientId') patientId: string,
  ) {
    return this.medecinsService.addPatient(id, patientId);
  }

  @Delete(':id/patients/:patientId')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Retirer un patient de la liste du médecin' })
  @ApiResponse({ status: 200, description: 'Patient retiré' })
  @ApiResponse({ status: 404, description: 'Médecin non trouvé' })
  removePatient(
    @Param('id') id: string,
    @Param('patientId') patientId: string,
  ) {
    return this.medecinsService.removePatient(id, patientId);
  }

  @Patch(':id/note')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Noter un médecin' })
  @ApiResponse({ status: 200, description: 'Note mise à jour' })
  updateNote(@Param('id') id: string, @Body('note') note: number) {
    return this.medecinsService.updateNote(id, note);
  }
}
