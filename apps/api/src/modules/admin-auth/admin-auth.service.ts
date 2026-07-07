import { Injectable, Logger, OnApplicationBootstrap, UnauthorizedException } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { AdminRole, AdminUser } from '@premium-hub/db';
import { PrismaService } from '../../prisma/prisma.service';
import { config } from '../../config';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AdminAuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Ensure the initial owner account exists (idempotent, from env). */
  async onApplicationBootstrap() {
    const { email, password } = config.adminInitial;
    if (!email || !password) return;
    const count = await this.prisma.adminUser.count();
    if (count > 0) return;
    await this.prisma.adminUser.create({
      data: {
        email: email.toLowerCase(),
        name: 'Owner',
        passwordHash: await hash(password),
        role: 'owner',
      },
    });
    this.logger.log(`Initial owner admin created for ${email}`);
  }

  async login(email: string, password: string): Promise<{ token: string; admin: AuthenticatedAdmin }> {
    const admin = await this.prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin || !admin.isActive || !(await verify(admin.passwordHash, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = randomBytes(48).toString('hex');
    await this.prisma.adminSession.create({
      data: {
        adminId: admin.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return { token, admin: this.toPublic(admin) };
  }

  async logout(token: string): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: { tokenHash: hashToken(token) },
      data: { revokedAt: new Date() },
    });
  }

  async validateToken(token: string): Promise<AuthenticatedAdmin | null> {
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { admin: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
    if (!session.admin.isActive) return null;
    return this.toPublic(session.admin);
  }

  private toPublic(admin: AdminUser): AuthenticatedAdmin {
    return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
  }
}
