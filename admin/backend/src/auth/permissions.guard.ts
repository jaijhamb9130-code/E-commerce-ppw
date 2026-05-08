import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Decorator value can be either a single permission string OR an array
    // (any-of semantics). Backward compatible — old @RequirePermission('x')
    // calls still work, new @RequirePermission('a','b') accepts EITHER.
    const required = this.reflector.getAllAndOverride<string | string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || (Array.isArray(required) && required.length === 0)) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Admins have all permissions automatically
    if (user && user.role === 'admin') {
      return true;
    }

    const userPerms: string[] = user?.permissions || [];
    const requiredList = Array.isArray(required) ? required : [required];
    const hasAny = requiredList.some((p) => userPerms.includes(p));
    if (!hasAny) {
      throw new ForbiddenException(
        `Insufficient permission. Need one of: ${requiredList.join(', ')}`,
      );
    }

    return true;
  }
}
