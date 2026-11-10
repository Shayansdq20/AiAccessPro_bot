import { Injectable } from '@nestjs/common';
import { Keyboard } from 'grammy';
import type { User } from '@pro-ai-access/db';
import type { Language, MessageKey } from '@pro-ai-access/shared';
import { UsersService } from '../users/users.service';
import { TextsService } from '../settings/texts.service';
import { config } from '../../config';
import type { BotContext } from './bot.context';

/** Cross-handler helpers: user resolution, localized text, main menu keyboard. */
@Injectable()
export class BotCommonService {
  constructor(
    private readonly users: UsersService,
    private readonly texts: TextsService,
  ) {}

  /** Resolve (and refresh) the store user for an incoming update. */
  async user(ctx: BotContext): Promise<User> {
    const from = ctx.from!;
    return this.users.upsertFromTelegram({
      telegramId: BigInt(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });
  }

  t(lang: Language, key: MessageKey, vars?: Record<string, string | number | bigint>) {
    return this.texts.text(lang, key, vars);
  }

  resolveMenuAction(input: string) {
    return this.texts.resolveMenuAction(input);
  }

  async mainMenuKeyboard(lang: Language): Promise<Keyboard> {
    const labels = await this.texts.menuLabels(lang);
    return new Keyboard()
      .text(labels.products)
      .text(labels.wallet)
      .row()
      .text(labels.myServices)
      .text(labels.orders)
      .row()
      .text(labels.discount)
      .text(labels.referral)
      .row()
      .text(labels.support)
      .text(labels.profile)
      .row()
      .text(labels.language)
      .resized()
      .persistent();
  }

  async sendMainMenu(ctx: BotContext, user: User, text: string): Promise<void> {
    await ctx.reply(text, { reply_markup: await this.mainMenuKeyboard(user.language) });
  }

  isTelegramAdmin(ctx: BotContext): boolean {
    return ctx.from != null && config.telegram.adminIds.includes(String(ctx.from.id));
  }

  greetingName(user: User): string {
    return this.users.greetingName(user);
  }
}
