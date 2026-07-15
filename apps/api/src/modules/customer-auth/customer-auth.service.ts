import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { User } from '@premium-hub/db';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SmsService } from '../sms/sms.service';
import { config } from '../../config';
import { normalizeIranPhone } from './phone.util';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface AuthenticatedCustomer {
  id: string;
  displayUsername: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  language: User['language'];
  status: User['status'];
  referralCode: string | null;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function generateOtpCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i++) code += randomInt(0, 10).toString();
  return code;
}

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly sms: SmsService,
  ) {}

  /** Step 1: send a one-time code to the phone. Enforces a resend cooldown. */
  async requestOtp(rawPhone: string): Promise<{ ok: true; expiresInSeconds: number }> {
    const phone = normalizeIranPhone(rawPhone);
    if (!phone) throw new BadRequestException('شماره موبایل نامعتبر است');

    const { ttlSeconds, resendCooldownSeconds, length } = config.sms.otp;

    const recent = await this.prisma.phoneOtp.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      const elapsed = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (elapsed < resendCooldownSeconds) {
        throw new BadRequestException(
          `کمی صبر کن؛ ${Math.ceil(resendCooldownSeconds - elapsed)} ثانیه تا ارسال دوباره`,
        );
      }
    }

    const code = generateOtpCode(length);

    // Only the latest code is valid.
    await this.prisma.phoneOtp.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.phoneOtp.create({
      data: {
        phone,
        codeHash: sha256(`${phone}:${code}`),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    });

    const sent = await this.sms.sendOtp(phone, code);
    if (!sent) this.logger.warn(`OTP SMS not delivered to ${phone} (driver reported failure)`);

    return { ok: true, expiresInSeconds: ttlSeconds };
  }

  /** Step 2: verify the code, then find/create the customer and open a session. */
  async verifyOtp(
    rawPhone: string,
    code: string,
  ): Promise<{ token: string; customer: AuthenticatedCustomer }> {
    const phone = normalizeIranPhone(rawPhone);
    if (!phone) throw new BadRequestException('شماره موبایل نامعتبر است');

    const otp = await this.prisma.phoneOtp.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new UnauthorizedException('کد نامعتبر یا منقضی شده است');

    const attempts = otp.attempts + 1;
    if (attempts > config.sms.otp.maxAttempts) {
      await this.prisma.phoneOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date(), attempts },
      });
      throw new UnauthorizedException('تعداد تلاش زیاد است؛ کد جدید بگیر');
    }

    if (otp.codeHash !== sha256(`${phone}:${code}`)) {
      await this.prisma.phoneOtp.update({ where: { id: otp.id }, data: { attempts } });
      throw new UnauthorizedException('کد وارد شده اشتباه است');
    }

    await this.prisma.phoneOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date(), attempts },
    });

    const user = await this.users.upsertFromPhone(phone);
    if (user.status === 'blocked') throw new ForbiddenException('حساب شما مسدود است');

    const token = randomBytes(48).toString('hex');
    await this.prisma.customerSession.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    return { token, customer: this.toPublic(user) };
  }

  async logout(token: string): Promise<void> {
    await this.prisma.customerSession.updateMany({
      where: { tokenHash: sha256(token) },
      data: { revokedAt: new Date() },
    });
  }

  async validateToken(token: string): Promise<AuthenticatedCustomer | null> {
    const session = await this.prisma.customerSession.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
    if (session.user.status === 'blocked') return null;
    return this.toPublic(session.user);
  }

  private toPublic(user: User): AuthenticatedCustomer {
    return {
      id: user.id,
      displayUsername: user.displayUsername,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      language: user.language,
      status: user.status,
      referralCode: user.referralCode,
    };
  }
}
