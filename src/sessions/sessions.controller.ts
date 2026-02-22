import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import type { Request } from 'express';

@ApiTags('Sessions')
@ApiBearerAuth()
@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('active')
  @ApiOperation({ summary: 'Récupérer toutes mes sessions actives' })
  @ApiResponse({ status: 200, description: 'Liste des sessions actives' })
  async getActiveSessions(@CurrentUser() user: any) {
    const sessions = await this.sessionsService.getActiveSessions(
      (user as UserDocument)._id.toString(),
    );

    // Ne pas renvoyer le token complet pour la sécurité
    return sessions.map((session) => ({
      _id: session._id,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: this.isCurrentSession(session.token, this.extractToken(null)),
    }));
  }

  @Get('count')
  @ApiOperation({ summary: 'Compter mes sessions actives' })
  @ApiResponse({ status: 200, description: 'Nombre de sessions actives' })
  async countActiveSessions(@CurrentUser() user: any) {
    const count = await this.sessionsService.countActiveSessions(
      (user as UserDocument)._id.toString(),
    );
    return { count };
  }

  @Delete('current')
  @ApiOperation({ summary: 'Logout de la session actuelle' })
  @ApiResponse({ status: 200, description: 'Session révoquée avec succès' })
  async logoutCurrent(@Req() request: Request) {
    const token = this.extractToken(request);
    if (token) {
      await this.sessionsService.revokeSession(token);
    }
    return { message: 'Déconnexion réussie' };
  }

  @Delete('all')
  @ApiOperation({ summary: 'Logout de tous les appareils' })
  @ApiResponse({
    status: 200,
    description: 'Toutes les sessions révoquées avec succès',
  })
  async logoutAll(@CurrentUser() user: any) {
    const count = await this.sessionsService.revokeAllSessions(
      (user as UserDocument)._id.toString(),
    );
    return {
      message: `Déconnecté de ${count} appareil(s)`,
      count,
    };
  }

  @Delete(':sessionId')
  @ApiOperation({ summary: 'Révoquer une session spécifique' })
  @ApiResponse({ status: 200, description: 'Session révoquée avec succès' })
  async revokeSession(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
  ) {
    await this.sessionsService.revokeSessionById(
      (user as UserDocument)._id.toString(),
      sessionId,
    );
    return { message: 'Session révoquée avec succès' };
  }

  private extractToken(request: Request | null): string | null {
    if (!request) return null;
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }

  private isCurrentSession(sessionToken: string, currentToken: string | null): boolean {
    return sessionToken === currentToken;
  }
}
