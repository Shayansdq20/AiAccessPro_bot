import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AdminRole } from '@pro-ai-access/db';
import { AdminAuthService, AuthenticatedAdmin } from './admin-auth.service';

export const ROLES_KEY = 'admin_roles';
/** Restrict a controller/handler to specific roles. Owner always passes. */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AdminRequest extends Request {
  admin: AuthenticatedAdmin;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException();

    const admin = await this.auth.validateToken(token);
    if (!admin) throw new UnauthorizedException();
    req.admin = admin;

    const roles =
      this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (roles.length > 0 && admin.role !== 'owner' && !roles.includes(admin.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
