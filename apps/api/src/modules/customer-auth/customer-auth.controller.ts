import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthGuard, CustomerRequest } from './customer-auth.guard';

const requestOtpSchema = z.object({
  phone: z.string().min(8).max(20),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().min(4).max(8),
});

@Controller('auth')
export class CustomerAuthController {
  constructor(private readonly auth: CustomerAuthService) {}

  @Post('request-otp')
  async requestOtp(@Body() body: unknown) {
    const { phone } = requestOtpSchema.parse(body);
    return this.auth.requestOtp(phone);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: unknown) {
    const { phone, code } = verifyOtpSchema.parse(body);
    return this.auth.verifyOtp(phone, code);
  }

  @UseGuards(CustomerAuthGuard)
  @Post('logout')
  async logout(@Req() req: CustomerRequest) {
    const token = (req.headers.authorization ?? '').slice(7);
    await this.auth.logout(token);
    return { ok: true };
  }

  @UseGuards(CustomerAuthGuard)
  @Get('me')
  me(@Req() req: CustomerRequest) {
    return req.customer;
  }
}
