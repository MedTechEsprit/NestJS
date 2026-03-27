import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards';
import { CurrentUser } from '../common/decorators';
import { PatientRequestsService } from './patient-requests.service';
import { CreatePatientRequestDto, DeclineRequestDto } from './dto';

@ApiTags('Patient Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PatientRequestsController {
  constructor(private readonly patientRequestsService: PatientRequestsService) {}

  private asString(value: any): string {
    return value?.toString?.() ?? String(value);
  }

  @Get('doctors/:doctorId/patient-requests')
  @ApiOperation({ summary: 'Get pending patient requests for a doctor' })
  findPendingByDoctor(@Param('doctorId') doctorId: string) {
    return this.patientRequestsService.findPendingByDoctor(doctorId);
  }

  @Post('doctors/:id/patient-requests/:requestId/accept')
  @ApiOperation({ summary: 'Accept a patient request and add patient to doctor' })
  acceptRequest(
    @Param('id') doctorId: string,
    @Param('requestId') requestId: string,
    @CurrentUser('_id') currentUserId: string,
  ) {
    if (doctorId !== this.asString(currentUserId)) {
      throw new ForbiddenException('Accès refusé');
    }
    return this.patientRequestsService.acceptRequest(doctorId, requestId);
  }

  @Post('doctors/:id/patient-requests/:requestId/decline')
  @ApiOperation({ summary: 'Decline a patient request with reason' })
  declineRequest(
    @Param('id') doctorId: string,
    @Param('requestId') requestId: string,
    @Body() declineDto: DeclineRequestDto,
    @CurrentUser('_id') currentUserId: string,
  ) {
    if (doctorId !== this.asString(currentUserId)) {
      throw new ForbiddenException('Accès refusé');
    }
    return this.patientRequestsService.declineRequest(doctorId, requestId, declineDto);
  }

  @Post('patients/:patientId/request-doctor')
  @ApiOperation({ summary: 'Create a new request to a doctor' })
  createRequest(
    @Param('patientId') patientId: string,
    @Body() createDto: CreatePatientRequestDto,
    @CurrentUser('_id') currentUserId: string,
  ) {
    if (patientId !== this.asString(currentUserId)) {
      throw new ForbiddenException('Accès refusé');
    }
    return this.patientRequestsService.create(patientId, createDto);
  }

  @Get('patients/:patientId/my-requests')
  @ApiOperation({ summary: 'Get all requests sent by a patient' })
  findByPatient(
    @Param('patientId') patientId: string,
    @CurrentUser('_id') currentUserId: string,
  ) {
    if (patientId !== this.asString(currentUserId)) {
      throw new ForbiddenException('Accès refusé');
    }
    return this.patientRequestsService.findByPatient(patientId);
  }

  @Post('doctors/:doctorId/patients/:patientId/request-access')
  @ApiOperation({ summary: 'Doctor requests patient access renewal' })
  requestAccess(
    @Param('doctorId') doctorId: string,
    @Param('patientId') patientId: string,
    @CurrentUser('_id') currentUserId: string,
  ) {
    if (doctorId !== this.asString(currentUserId)) {
      throw new ForbiddenException('Vous ne pouvez créer une demande que pour votre propre compte médecin');
    }
    return this.patientRequestsService.requestDoctorAccess(doctorId, patientId);
  }

  @Get('patients/:patientId/pending-doctor-access-requests')
  @ApiOperation({ summary: 'Get pending doctor access requests for a patient' })
  findPendingDoctorAccessByPatient(
    @Param('patientId') patientId: string,
    @CurrentUser('_id') currentUserId: string,
  ) {
    if (patientId !== this.asString(currentUserId)) {
      throw new ForbiddenException('Accès refusé');
    }
    return this.patientRequestsService.findPendingDoctorAccessRequestsByPatient(patientId);
  }

  @Post('patients/:patientId/doctor-access-requests/:requestId/accept')
  @ApiOperation({ summary: 'Patient accepts doctor access request' })
  acceptDoctorAccessRequestByPatient(
    @Param('patientId') patientId: string,
    @Param('requestId') requestId: string,
    @CurrentUser('_id') currentUserId: string,
  ) {
    if (patientId !== this.asString(currentUserId)) {
      throw new ForbiddenException('Accès refusé');
    }
    return this.patientRequestsService.acceptDoctorAccessRequestByPatient(patientId, requestId);
  }

  @Post('patients/:patientId/doctor-access-requests/:requestId/decline')
  @ApiOperation({ summary: 'Patient declines doctor access request' })
  declineDoctorAccessRequestByPatient(
    @Param('patientId') patientId: string,
    @Param('requestId') requestId: string,
    @CurrentUser('_id') currentUserId: string,
    @Body() declineDto: DeclineRequestDto,
  ) {
    if (patientId !== this.asString(currentUserId)) {
      throw new ForbiddenException('Accès refusé');
    }
    return this.patientRequestsService.declineDoctorAccessRequestByPatient(
      patientId,
      requestId,
      declineDto?.declineReason,
    );
  }

  @Get('patients/:patientId/doctors/:doctorId/access-status')
  @ApiOperation({ summary: 'Get doctor access status for a patient' })
  getDoctorAccessStatus(
    @Param('patientId') patientId: string,
    @Param('doctorId') doctorId: string,
    @CurrentUser('_id') currentUserId: string,
  ) {
    if (patientId !== this.asString(currentUserId)) {
      throw new ForbiddenException('Accès refusé');
    }
    return this.patientRequestsService.getDoctorAccessStatus(patientId, doctorId);
  }

  @Get('doctors/:doctorId/patients/:patientId/access-status')
  @ApiOperation({ summary: 'Doctor checks access status for a specific patient' })
  getDoctorAccessStatusForDoctor(
    @Param('doctorId') doctorId: string,
    @Param('patientId') patientId: string,
    @CurrentUser('_id') currentUserId: string,
  ) {
    if (doctorId !== this.asString(currentUserId)) {
      throw new ForbiddenException('Accès refusé');
    }
    return this.patientRequestsService.getDoctorAccessStatus(patientId, doctorId);
  }

  @Patch('patients/:patientId/doctors/:doctorId/access')
  @ApiOperation({ summary: 'Patient toggles doctor access on/off' })
  setDoctorAccessByPatient(
    @Param('patientId') patientId: string,
    @Param('doctorId') doctorId: string,
    @CurrentUser('_id') currentUserId: string,
    @Body('enabled') enabled: boolean,
  ) {
    if (patientId !== this.asString(currentUserId)) {
      throw new ForbiddenException('Accès refusé');
    }
    return this.patientRequestsService.setDoctorAccessByPatient(patientId, doctorId, Boolean(enabled));
  }
}
