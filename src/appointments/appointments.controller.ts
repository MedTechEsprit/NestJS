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
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppointmentStatus } from './schemas/appointment.schema';

@ApiTags('Appointments')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Roles(Role.PATIENT, Role.MEDECIN)
  @ApiOperation({ summary: 'Create a new appointment' })
  @ApiResponse({ status: 201, description: 'Appointment created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid appointment data' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(createAppointmentDto);
  }

  @Get('doctor/:doctorId/upcoming')
  @Roles(Role.MEDECIN, Role.PATIENT)
  @ApiOperation({ summary: 'Get upcoming appointments for doctor (next 7 days)' })
  @ApiResponse({ status: 200, description: 'Upcoming appointments retrieved' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  getUpcomingAppointments(@Param('doctorId') doctorId: string) {
    return this.appointmentsService.getUpcomingAppointments(doctorId);
  }

  @Get('doctor/:doctorId/stats')
  @Roles(Role.MEDECIN)
  @ApiOperation({ summary: 'Get appointment statistics for doctor' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  getStats(@Param('doctorId') doctorId: string) {
    return this.appointmentsService.getAppointmentStats(doctorId);
  }

  @Get('doctor/:doctorId')
  @Roles(Role.MEDECIN, Role.PATIENT, Role.PHARMACIEN)
  @ApiOperation({ summary: 'Get all appointments for a doctor with filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: AppointmentStatus,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter from date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter to date (ISO 8601)',
  })
  @ApiResponse({ status: 200, description: 'Appointments retrieved' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  findByDoctor(
    @Param('doctorId') doctorId: string,
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: AppointmentStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.appointmentsService.findByDoctor(
      doctorId,
      paginationDto,
      status,
      startDate,
      endDate,
    );
  }

  @Get('patient/:patientId')
  @Roles(Role.PATIENT, Role.MEDECIN)
  @ApiOperation({ summary: 'Get all appointments for a patient' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Appointments retrieved' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  findByPatient(
    @Param('patientId') patientId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.appointmentsService.findByPatient(patientId, paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single appointment' })
  @ApiResponse({ status: 200, description: 'Appointment retrieved' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.PATIENT, Role.MEDECIN)
  @ApiOperation({ summary: 'Update appointment (dateTime, type, status, notes)' })
  @ApiResponse({ status: 200, description: 'Appointment updated' })
  @ApiResponse({ status: 400, description: 'Invalid data or conflicting appointment time' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  update(@Param('id') id: string, @Body() updateAppointmentDto: UpdateAppointmentDto) {
    return this.appointmentsService.update(id, updateAppointmentDto);
  }

  @Delete(':id')
  @Roles(Role.PATIENT, Role.MEDECIN)
  @ApiOperation({ summary: 'Delete an appointment' })
  @ApiResponse({ status: 200, description: 'Appointment deleted' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  remove(@Param('id') id: string) {
    return this.appointmentsService.remove(id);
  }
}
