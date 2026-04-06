import {
  BadRequestException,
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
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @Get('me')
  async getMySubscription(@Req() req: any) {
    return this.subscriptionsService.getMySubscription(req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @Post('checkout-session')
  async createCheckoutSession(
    @Req() req: any,
    @Body() body: CreateCheckoutSessionDto,
  ) {
    return this.subscriptionsService.createCheckoutSession(
      req.user._id.toString(),
      body.successUrl,
      body.cancelUrl,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @Post('verify-session')
  async verifySession(@Req() req: any, @Body('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException('sessionId requis');
    }

    return this.subscriptionsService.verifyCheckoutSession(req.user._id.toString(), sessionId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @Post('verify-latest')
  async verifyLatest(@Req() req: any) {
    return this.subscriptionsService.verifyLatestCheckoutSession(
      req.user._id.toString(),
    );
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    return this.subscriptionsService.handleWebhook(req.rawBody as Buffer, signature);
  }
}