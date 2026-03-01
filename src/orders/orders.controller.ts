import {
  Controller, Get, Post, Put, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Patient endpoints ──────────────────────────────────────────

  @Post('patient/:patientId')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Create a new order (patient)' })
  create(@Param('patientId') patientId: string, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(patientId, dto);
  }

  @Get('patient/:patientId')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Get my orders (patient)' })
  findByPatient(@Param('patientId') patientId: string) {
    return this.ordersService.findByPatient(patientId);
  }

  @Put(':orderId/patient/:patientId/cancel')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Cancel an order (patient)' })
  cancelOrder(@Param('orderId') orderId: string, @Param('patientId') patientId: string) {
    return this.ordersService.cancelByPatient(orderId, patientId);
  }

  // ── Pharmacist endpoints ───────────────────────────────────────

  @Get('pharmacist/:pharmacistId')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Get orders for my pharmacy' })
  @ApiQuery({ name: 'status', required: false })
  findByPharmacist(@Param('pharmacistId') pharmacistId: string, @Query('status') status?: string) {
    return this.ordersService.findByPharmacist(pharmacistId, status);
  }

  @Put(':orderId/pharmacist/:pharmacistId/status')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Update order status (pharmacist)' })
  updateStatus(
    @Param('orderId') orderId: string,
    @Param('pharmacistId') pharmacistId: string,
    @Body() body: { status: string; note?: string },
  ) {
    return this.ordersService.updateStatus(orderId, pharmacistId, body.status, body.note);
  }

  @Get('pharmacist/:pharmacistId/stats')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Get order stats for pharmacist' })
  getStats(@Param('pharmacistId') pharmacistId: string) {
    return this.ordersService.getPharmacistStats(pharmacistId);
  }

  // ── Points config (public) ─────────────────────────────────────

  @Get('points/config')
  @Roles(Role.PATIENT, Role.MEDECIN, Role.PHARMACIEN)
  @ApiOperation({ summary: 'Get points system configuration' })
  getPointsConfig() {
    return OrdersService.getPointsConfig();
  }
}
