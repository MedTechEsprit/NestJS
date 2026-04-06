import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token admin manquant');
    }

    const token = authHeader.slice(7);

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET') || 'diabetes-secret-key',
      });

      if (!payload?.isAdmin || payload?.role !== 'ADMIN') {
        throw new UnauthorizedException('Token admin invalide');
      }

      request.admin = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Session admin invalide ou expirée');
    }
  }
}