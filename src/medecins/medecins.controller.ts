import {
  BadRequestException,
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { MedecinsService } from './medecins.service';
import { UpdateMedecinDto } from './dto/update-medecin.dto';
import { ActivateMedecinBoostDto } from './dto/activate-medecin-boost.dto';
import { CreateMedecinBoostCheckoutDto } from './dto/create-medecin-boost-checkout.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Public } from '../common/decorators/public.decorator';

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

  @Get('patient/:patientId/my-doctors')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Get all doctors for a patient (where patient is in listePatients)' })
  @ApiResponse({ status: 200, description: 'Liste des médecins du patient' })
  getMyDoctors(@Param('patientId') patientId: string) {
    return this.medecinsService.getMyDoctors(patientId);
  }

  @Get('boost/plans')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Obtenir les offres boost médecin (7j, 15j, 30j)' })
  @ApiResponse({ status: 200, description: 'Liste des plans boost médecin' })
  getBoostPlans() {
    return this.medecinsService.getBoostPlans();
  }

  @Get('boost/me')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Obtenir mon statut boost médecin' })
  @ApiResponse({ status: 200, description: 'Statut boost récupéré' })
  getMyBoostStatus(@Req() req: any) {
    return this.medecinsService.getBoostStatus(req.user._id.toString());
  }

  @Post('boost/checkout-session')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Créer une session Stripe Checkout pour boost médecin' })
  @ApiResponse({ status: 201, description: 'Session Stripe créée' })
  createBoostCheckoutSession(
    @Req() req: any,
    @Body() body: CreateMedecinBoostCheckoutDto,
  ) {
    return this.medecinsService.createBoostCheckoutSession(
      req.user._id.toString(),
      body.boostType,
      body.successUrl,
      body.cancelUrl,
    );
  }

  @Post('boost/verify-session')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Vérifier une session Stripe boost médecin' })
  @ApiResponse({ status: 200, description: 'Session vérifiée' })
  verifyBoostSession(@Req() req: any, @Body('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException('sessionId requis');
    }

    return this.medecinsService.verifyBoostCheckoutSession(
      req.user._id.toString(),
      sessionId,
    );
  }

  @Post('boost/verify-latest')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Vérifier la dernière session Stripe boost médecin' })
  @ApiResponse({ status: 200, description: 'Dernière session vérifiée' })
  verifyLatestBoost(@Req() req: any) {
    return this.medecinsService.verifyLatestBoostCheckoutSession(
      req.user._id.toString(),
    );
  }

  @Post('boost/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Stripe pour boost médecin' })
  @ApiResponse({ status: 200, description: 'Webhook traité' })
  stripeBoostWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    return this.medecinsService.handleBoostWebhook(req.rawBody as Buffer, signature);
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

  @Get(':id/my-patients')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Récupérer la liste des patients du médecin avec leur statut de santé' })
  @ApiQuery({ name: 'page', required: false, description: 'Numéro de la page', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Nombre d\'éléments par page', type: Number })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut (all, stable, attention, critical)' })
  @ApiQuery({ name: 'search', required: false, description: 'Rechercher par nom, prénom ou email' })
  @ApiResponse({ status: 200, description: 'Liste des patients avec statut' })
  @ApiResponse({ status: 404, description: 'Médecin non trouvé' })
  getMyPatients(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const paginationDto: PaginationDto = { page, limit };
    return this.medecinsService.getMyPatients(id, paginationDto, status, search);
  }

  @Patch(':id/toggle-status')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Basculer le statut du compte entre ACTIF et INACTIF' })
  @ApiResponse({ status: 200, description: 'Statut du compte mis à jour' })
  @ApiResponse({ status: 404, description: 'Médecin non trouvé' })
  toggleAccountStatus(@Param('id') id: string) {
    return this.medecinsService.toggleAccountStatus(id);
  }

  @Get(':id/status')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Obtenir le statut du compte du médecin' })
  @ApiResponse({ status: 200, description: 'Statut du compte récupéré' })
  @ApiResponse({ status: 404, description: 'Médecin non trouvé' })
  getAccountStatus(@Param('id') id: string) {
    return this.medecinsService.getAccountStatus(id);
  }

  @Get(':id/boost/status')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Obtenir le statut boost du médecin' })
  @ApiResponse({ status: 200, description: 'Statut boost récupéré' })
  @ApiResponse({ status: 404, description: 'Médecin non trouvé' })
  getBoostStatus(@Param('id') id: string) {
    return this.medecinsService.getBoostStatus(id);
  }

  @Post(':id/boost/activate')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Créer un checkout Stripe pour activer le boost médecin' })
  @ApiResponse({ status: 201, description: 'Checkout Stripe boost créé' })
  @ApiResponse({ status: 400, description: 'Plan invalide' })
  @ApiResponse({ status: 404, description: 'Médecin non trouvé' })
  activateBoost(
    @Param('id') id: string,
    @Body() body: ActivateMedecinBoostDto,
  ) {
    return this.medecinsService.createBoostCheckoutSession(id, body.boostType);
  }
}
