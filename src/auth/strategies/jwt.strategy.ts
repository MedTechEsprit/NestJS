import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { SessionsService } from '../../sessions/sessions.service';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private sessionsService: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'diabetes-secret-key',
      passReqToCallback: true, // Pour accéder au token dans validate()
    });
  }

  async validate(request: Request, payload: JwtPayload): Promise<UserDocument> {
    // Extraire le token de l'en-tête Authorization
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token manquant');
    }

    // Vérifier que la session existe et est active
    const session = await this.sessionsService.findByToken(token);

    if (!session) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    // Vérifier l'utilisateur
    const user = await this.userModel.findById(payload.sub).exec();

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    // Mettre à jour la dernière activité de la session
    await this.sessionsService.updateActivity(token);

    return user;
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}

