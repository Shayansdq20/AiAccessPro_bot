import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Bot, session, webhookCallback } from 'grammy';
import { PrismaService } from '../../prisma/prisma.service';
import { config } from '../../config';
import { BotContext, initialSession } from './bot.context';
import { createPrismaSessionStorage } from './session-storage';
import { CatalogHandler } from './handlers/catalog.handler';
import { WalletHandler } from './handlers/wallet.handler';
import { OrdersHandler } from './handlers/orders.handler';
import { MiscHandler } from './handlers/misc.handler';
import { AdminHandler } from './handlers/admin.handler';

@Injectable()
export class BotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BotService.name);
  readonly bot: Bot<BotContext>;
  /** Express-compatible webhook handler (used by BotController). */
  readonly webhookHandler: (req: unknown, res: unknown) => Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    catalogHandler: CatalogHandler,
    walletHandler: WalletHandler,
    ordersHandler: OrdersHandler,
    miscHandler: MiscHandler,
    adminHandler: AdminHandler,
  ) {
    this.bot = new Bot<BotContext>(config.telegram.botToken);

    this.bot.use(
      session({
        initial: initialSession,
        storage: createPrismaSessionStorage(this.prisma),
        getSessionKey: (ctx) => (ctx.from ? String(ctx.from.id) : undefined),
      }),
    );

    // Callback-query handlers must be registered before the generic
    // message router; grammY dispatches by update type so order between
    // domains only matters for overlapping filters.
    catalogHandler.register(this.bot);
    walletHandler.register(this.bot);
    ordersHandler.register(this.bot);
    adminHandler.register(this.bot);
    miscHandler.register(this.bot);

    this.bot.catch((err) => {
      this.logger.error(`Bot error for update ${err.ctx.update.update_id}: ${err.message}`, err.stack);
    });

    // grammY forbids mixing webhookCallback with bot.start(); only create the
    // webhook handler when actually running in webhook mode.
    if (config.telegram.mode === 'webhook') {
      this.webhookHandler = webhookCallback(this.bot, 'express', {
        secretToken: config.telegram.webhookSecret || undefined,
      }) as unknown as (req: unknown, res: unknown) => Promise<void>;
    } else {
      this.webhookHandler = async (_req, res) => {
        (res as { status(code: number): { send(body: string): void } })
          .status(404)
          .send('Bot is running in polling mode');
      };
    }
  }

  async onApplicationBootstrap() {
    if (config.telegram.mode === 'webhook') {
      // A webhook failure (bad token/URL/secret) must not crash-loop the API;
      // the admin panel and REST API must stay available for debugging.
      try {
        await this.bot.init();
        const url = `${config.telegram.webhookUrl.replace(/\/$/, '')}/telegram/webhook`;
        await this.bot.api.setWebhook(url, {
          secret_token: config.telegram.webhookSecret || undefined,
          drop_pending_updates: false,
        });
        this.logger.log(`Telegram webhook set to ${url}`);
      } catch (err) {
        this.logger.error(
          `Telegram webhook setup FAILED — bot will not receive updates until this is fixed and the api container is recreated: ${(err as Error).message}`,
        );
      }
    } else {
      // Long polling for local development — no public domain needed.
      await this.bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => undefined);
      this.bot
        .start({
          onStart: (me) => this.logger.log(`Bot @${me.username} started (polling)`),
        })
        .catch((err) => {
          // Invalid/missing token must not crash the API (admin panel still works).
          this.logger.error(`Bot polling failed: ${(err as Error).message}`);
        });
    }
  }

  async onApplicationShutdown() {
    if (config.telegram.mode !== 'webhook') {
      await this.bot.stop().catch(() => undefined);
    }
  }
}
