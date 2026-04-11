import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermission) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    // Admins have all permissions automatically
    if (user && user.role === 'admin') {
      return true;
    }

    const permissions = user?.permissions || [];
    if (!permissions.includes(requiredPermission)) {
      throw new ForbiddenException(`Insufficient permission: ${requiredPermission}`);
    }

    return true;
  }
}
