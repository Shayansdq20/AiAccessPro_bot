import { Injectable } from '@nestjs/common';
import type { LedgerType, Prisma, WalletLedger } from '@pro-ai-access/db';
import { PrismaService } from '../../prisma/prisma.service';

export class InsufficientBalanceError extends Error {
  constructor(
    public readonly balance: bigint,
    public readonly required: bigint,
  ) {
    super('Insufficient wallet balance');
  }
}

export class DuplicateReferenceError extends Error {
  constructor(public readonly reference: string) {
    super('Ledger reference already exists');
  }
}

type Tx = Prisma.TransactionClient;

/**
 * Ledger-first wallet. Balance is never overwritten: every change is an
 * immutable ledger row created in the same transaction that updates the
 * cached balance. `reference` is globally unique => idempotent money ops.
 */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getByUserId(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async balanceOf(userId: string): Promise<bigint> {
    const wallet = await this.getByUserId(userId);
    return wallet.balance;
  }

  /**
   * Credit `amount` (> 0). Idempotent by `reference`: if the reference was
   * already applied, returns the existing entry with `applied: false`.
   */
  async credit(params: {
    userId: string;
    amount: bigint;
    reference: string;
    type?: LedgerType;
    description?: string;
    actorAdminId?: string;
    tx?: Tx;
  }): Promise<{ entry: WalletLedger; applied: boolean }> {
    if (params.amount <= 0n) throw new Error('Credit amount must be positive');
    return this.applySigned({ ...params, signedAmount: params.amount, type: params.type ?? 'credit' });
  }

  /**
   * Debit `amount` (> 0) with a row lock; throws InsufficientBalanceError.
   * Idempotent by `reference`.
   */
  async debit(params: {
    userId: string;
    amount: bigint;
    reference: string;
    type?: LedgerType;
    description?: string;
    actorAdminId?: string;
    tx?: Tx;
  }): Promise<{ entry: WalletLedger; applied: boolean }> {
    if (params.amount <= 0n) throw new Error('Debit amount must be positive');
    return this.applySigned({ ...params, signedAmount: -params.amount, type: params.type ?? 'debit' });
  }

  /** Signed admin adjustment (positive or negative), audited via ledger. */
  async adjust(params: {
    userId: string;
    signedAmount: bigint;
    reference: string;
    description?: string;
    actorAdminId?: string;
  }): Promise<{ entry: WalletLedger; applied: boolean }> {
    if (params.signedAmount === 0n) throw new Error('Adjustment cannot be zero');
    return this.applySigned({ ...params, type: 'adjustment' });
  }

  private async applySigned(params: {
    userId: string;
    signedAmount: bigint;
    reference: string;
    type: LedgerType;
    description?: string;
    actorAdminId?: string;
    tx?: Tx;
  }): Promise<{ entry: WalletLedger; applied: boolean }> {
    const run = async (tx: Tx) => {
      const existing = await tx.walletLedger.findUnique({ where: { reference: params.reference } });
      if (existing) return { entry: existing, applied: false };

      const wallet = await tx.wallet.upsert({
        where: { userId: params.userId },
        create: { userId: params.userId },
        update: {},
      });

      // Serialize concurrent changes on this wallet.
      const rows = await tx.$queryRaw<{ balance: bigint }[]>`
        SELECT balance FROM "Wallet" WHERE id = ${wallet.id} FOR UPDATE`;
      const balance = rows[0]?.balance ?? 0n;
      const newBalance = balance + params.signedAmount;
      if (newBalance < 0n) throw new InsufficientBalanceError(balance, -params.signedAmount);

      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
      try {
        const entry = await tx.walletLedger.create({
          data: {
            walletId: wallet.id,
            type: params.type,
            amount: params.signedAmount,
            balanceAfter: newBalance,
            reference: params.reference,
            description: params.description,
            actorAdminId: params.actorAdminId,
          },
        });
        return { entry, applied: true };
      } catch (err: unknown) {
        // The tx is aborted after a P2002; the existing row must be fetched
        // outside this transaction (see catch below).
        if ((err as { code?: string }).code === 'P2002') {
          throw new DuplicateReferenceError(params.reference);
        }
        throw err;
      }
    };

    if (params.tx) return run(params.tx);
    try {
      return await this.prisma.$transaction(run, { isolationLevel: 'ReadCommitted' });
    } catch (err) {
      // A concurrent tx inserted the same reference: the operation already happened.
      if (err instanceof DuplicateReferenceError) {
        const existing = await this.prisma.walletLedger.findUnique({
          where: { reference: params.reference },
        });
        if (existing) return { entry: existing, applied: false };
      }
      throw err;
    }
  }

  async ledgerOf(userId: string, take = 30) {
    const wallet = await this.getByUserId(userId);
    return this.prisma.walletLedger.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
