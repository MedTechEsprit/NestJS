import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Post,
  Body,
  Delete,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards';
import { CurrentUser } from '../common/decorators';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './schemas/notification.schema';
import { RegisterTokenDto, RegisterTokenUserType } from './dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-token')
  @ApiOperation({ summary: 'Register an FCM token for authenticated user' })
  registerToken(
    @Body() body: RegisterTokenDto,
    @CurrentUser('_id') currentUserId: string,
    @CurrentUser('role') role: string,
  ) {
    this.assertOwnershipAndRole(body.userId, body.userType, String(currentUserId), role);
    return this.notificationsService.registerToken(body);
  }

  @Delete('remove-token')
  @ApiOperation({ summary: 'Remove an FCM token for authenticated user' })
  removeToken(
    @Body() body: RegisterTokenDto,
    @CurrentUser('_id') currentUserId: string,
    @CurrentUser('role') role: string,
  ) {
    this.assertOwnershipAndRole(body.userId, body.userType, String(currentUserId), role);
    return this.notificationsService.removeToken(body);
  }

  @Get('my-notifications')
  @ApiOperation({ summary: 'Get notification history for current user' })
  myNotifications(@CurrentUser('_id') userId: string) {
    return this.notificationsService.getMyNotifications(String(userId));
  }

  @Get()
  @ApiOperation({ summary: 'Get user notifications with optional filters' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'type', required: false, enum: NotificationType })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser('_id') userId: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('type') type?: NotificationType,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.findByUser(userId, {
      unreadOnly: unreadOnly === 'true',
      type,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  async markAllAsRead(@CurrentUser('_id') userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count for current user' })
  async getUnreadCount(@CurrentUser('_id') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  private assertOwnershipAndRole(
    userId: string,
    userType: RegisterTokenUserType,
    currentUserId: string,
    role: string,
  ): void {
    if (String(userId) !== String(currentUserId)) {
      throw new ForbiddenException('Vous ne pouvez gérer que vos propres tokens');
    }

    const normalizedRole = String(role || '').toUpperCase();
    const valid =
      (userType === RegisterTokenUserType.PATIENT && normalizedRole === 'PATIENT') ||
      (userType === RegisterTokenUserType.DOCTOR && normalizedRole === 'MEDECIN') ||
      (userType === RegisterTokenUserType.PHARMACY && normalizedRole === 'PHARMACIEN');

    if (!valid) {
      throw new ForbiddenException('Type utilisateur invalide pour ce compte');
    }
  }
}
