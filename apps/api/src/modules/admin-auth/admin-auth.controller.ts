import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard, AdminRequest } from './admin-auth.guard';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  async login(@Body() body: unknown) {
    const { email, password } = loginSchema.parse(body);
    return this.auth.login(email, password);
  }

  @UseGuards(AdminAuthGuard)
  @Post('logout')
  async logout(@Req() req: AdminRequest) {
    const token = (req.headers.authorization ?? '').slice(7);
    await this.auth.logout(token);
    return { ok: true };
  }

  @UseGuards(AdminAuthGuard)
  @Get('me')
  me(@Req() req: AdminRequest) {
    return req.admin;
  }
}
