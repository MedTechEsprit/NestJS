import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { Public } from '../common/decorators/public.decorator';
import { RevenueCatBillingService } from './revenuecat-billing.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PatientSubscription,
  PatientSubscriptionDocument,
} from './schemas/patient-subscription.schema';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly revenueCatBillingService: RevenueCatBillingService,
    @InjectModel(PatientSubscription.name)
    private readonly subscriptionModel: Model<PatientSubscriptionDocument>,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @Get('me')
  @ApiOperation({ summary: 'Récupérer mon abonnement Premium' })
  @ApiResponse({ status: 200, description: 'Statut abonnement récupéré' })
  async getMySubscription(@Req() req: any) {
    const patientId = req.user._id.toString();
    const sub = await this.subscriptionModel.findOne({
      patientId: new Types.ObjectId(patientId),
    });

    if (!sub) {
      return {
        isActive: false,
        status: 'inactive',
        planName: 'Premium Mensuel',
        amount: 20,
        currency: 'eur',
        subscribedAt: null,
        expiresAt: null,
      };
    }

    return {
      isActive: sub.isActive,
      status: sub.status,
      planName: sub.planName,
      amount: sub.amount,
      currency: sub.currency,
      subscribedAt: sub.subscribedAt,
      expiresAt: sub.expiresAt,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @Get('catalog')
  @ApiOperation({ summary: 'Obtenir les infos produit RevenueCat pour Premium' })
  @ApiResponse({ status: 200, description: 'Catalogue Premium RevenueCat' })
  async getCatalog() {
    return this.revenueCatBillingService.getPremiumCatalog();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @Post('sync')
  @ApiOperation({ summary: 'Synchroniser le statut Premium depuis RevenueCat' })
  @ApiResponse({ status: 200, description: 'Statut synchronisé' })
  async syncSubscription(@Req() req: any) {
    const patientId = req.user._id.toString();
    await this.revenueCatBillingService.syncPremiumForPatient(patientId);

    // Return updated status
    const sub = await this.subscriptionModel.findOne({
      patientId: new Types.ObjectId(patientId),
    });

    if (!sub) {
      return {
        isActive: false,
        status: 'inactive',
        planName: 'Premium Mensuel',
        amount: 20,
        currency: 'eur',
        subscribedAt: null,
        expiresAt: null,
      };
    }

    return {
      isActive: sub.isActive,
      status: sub.status,
      planName: sub.planName,
      amount: sub.amount,
      currency: sub.currency,
      subscribedAt: sub.subscribedAt,
      expiresAt: sub.expiresAt,
    };
  }

  @Post('revenuecat/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook RevenueCat pour abonnements et achats' })
  @ApiResponse({ status: 200, description: 'Webhook traité' })
  async revenueCatWebhook(
    @Body() body: any,
    @Headers('authorization') authorization: string,
  ) {
    return this.revenueCatBillingService.processWebhook(body, authorization);
  }
}