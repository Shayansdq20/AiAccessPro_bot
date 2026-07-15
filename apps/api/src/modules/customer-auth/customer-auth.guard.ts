import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { CustomerAuthService, AuthenticatedCustomer } from './customer-auth.service';

export interface CustomerRequest extends Request {
  customer: AuthenticatedCustomer;
}

/** Protects storefront (customer-facing) endpoints via a Bearer session token. */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly auth: CustomerAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<CustomerRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException();

    const customer = await this.auth.validateToken(token);
    if (!customer) throw new UnauthorizedException();
    req.customer = customer;
    return true;
  }
}
