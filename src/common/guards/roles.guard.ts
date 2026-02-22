import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // Case-insensitive role comparison to support both old and new role formats
    const userRole = user.role?.toUpperCase();
    const hasRole = requiredRoles.some((role) => userRole === role.toUpperCase());

    if (!hasRole) {
      throw new ForbiddenException(
        `Accès refusé. Rôle requis: ${requiredRoles.join(' ou ')}`,
      );
    }

    return true;
  }
}
