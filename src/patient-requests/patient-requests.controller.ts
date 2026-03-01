import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards';
import { PatientRequestsService } from './patient-requests.service';
import { CreatePatientRequestDto, DeclineRequestDto } from './dto';

@ApiTags('Patient Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PatientRequestsController {
  constructor(private readonly patientRequestsService: PatientRequestsService) {}

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
  ) {
    return this.patientRequestsService.acceptRequest(doctorId, requestId);
  }

  @Post('doctors/:id/patient-requests/:requestId/decline')
  @ApiOperation({ summary: 'Decline a patient request with reason' })
  declineRequest(
    @Param('id') doctorId: string,
    @Param('requestId') requestId: string,
    @Body() declineDto: DeclineRequestDto,
  ) {
    return this.patientRequestsService.declineRequest(doctorId, requestId, declineDto);
  }

  @Post('patients/:patientId/request-doctor')
  @ApiOperation({ summary: 'Create a new request to a doctor' })
  createRequest(
    @Param('patientId') patientId: string,
    @Body() createDto: CreatePatientRequestDto,
  ) {
    return this.patientRequestsService.create(patientId, createDto);
  }

  @Get('patients/:patientId/my-requests')
  @ApiOperation({ summary: 'Get all requests sent by a patient' })
  findByPatient(@Param('patientId') patientId: string) {
    return this.patientRequestsService.findByPatient(patientId);
  }
}
