import { Injectable, Logger } from '@nestjs/common';
import { Api, InlineKeyboard, InputFile } from 'grammy';
import { config } from '../../config';

/**
 * Thin wrapper around the Telegram Bot API for outbound notifications
 * (payment results, deliveries, admin alerts). Separate from the Bot update
 * pipeline so any service can notify without circular dependencies.
 * Failures are logged, never thrown into business logic.
 */
@Injectable()
export class NotifierService {
  readonly api = new Api(config.telegram.botToken);
  private readonly logger = new Logger(NotifierService.name);
  private cachedUsername: string | null = null;

  get adminChatIds(): string[] {
    return config.telegram.adminIds;
  }

  /** Bot @username (cached), used to build referral deep links. */
  async botUsername(): Promise<string> {
    if (this.cachedUsername) return this.cachedUsername;
    try {
      const me = await this.api.getMe();
      this.cachedUsername = me.username;
      return me.username;
    } catch {
      return '';
    }
  }

  async sendMessage(
    chatId: string | number | bigint | null | undefined,
    text: string,
    keyboard?: InlineKeyboard,
    parseMode?: 'HTML',
  ): Promise<boolean> {
    // Web-only customers have no Telegram id — nothing to notify, not an error.
    if (chatId === null || chatId === undefined || chatId === '') return false;
    try {
      await this.api.sendMessage(String(chatId), text, {
        reply_markup: keyboard,
        parse_mode: parseMode,
        // Config links shouldn't spawn giant link previews.
        link_preview_options: parseMode ? { is_disabled: true } : undefined,
      });
      return true;
    } catch (err) {
      this.logger.warn(`sendMessage to ${chatId} failed: ${(err as Error).message}`);
      return false;
    }
  }

  /** Send a generated image (e.g. QR code) with optional caption. */
  async sendPhotoBuffer(
    chatId: string | number | bigint | null | undefined,
    image: Buffer,
    caption?: string,
    parseMode?: 'HTML',
  ): Promise<boolean> {
    if (chatId === null || chatId === undefined || chatId === '') return false;
    try {
      await this.api.sendPhoto(String(chatId), new InputFile(image, 'qr.png'), {
        caption,
        parse_mode: parseMode,
      });
      return true;
    } catch (err) {
      this.logger.warn(`sendPhotoBuffer to ${chatId} failed: ${(err as Error).message}`);
      return false;
    }
  }

  async notifyAdmins(text: string, keyboard?: InlineKeyboard): Promise<void> {
    await Promise.all(this.adminChatIds.map((id) => this.sendMessage(id, text, keyboard)));
  }

  /** Send an in-memory image (e.g. a web-uploaded receipt) to all admins. */
  async sendPhotoBufferToAdmins(image: Buffer, caption: string, keyboard?: InlineKeyboard): Promise<void> {
    await Promise.all(
      this.adminChatIds.map(async (chatId) => {
        try {
          await this.api.sendPhoto(chatId, new InputFile(image, 'receipt.jpg'), {
            caption,
            reply_markup: keyboard,
          });
        } catch (err) {
          this.logger.warn(`sendPhotoBuffer to admin ${chatId} failed: ${(err as Error).message}`);
          // Fallback: plain message so the admin still gets actionable controls.
          await this.sendMessage(chatId, caption, keyboard);
        }
      }),
    );
  }

  /** Send a photo (by Telegram file id) with caption + keyboard to all admins. */
  async sendPhotoToAdmins(fileId: string, caption: string, keyboard?: InlineKeyboard): Promise<void> {
    await Promise.all(
      this.adminChatIds.map(async (chatId) => {
        try {
          await this.api.sendPhoto(chatId, fileId, {
            caption,
            reply_markup: keyboard,
          });
        } catch (err) {
          this.logger.warn(`sendPhoto to admin ${chatId} failed: ${(err as Error).message}`);
          // Fallback: plain message so the admin still gets actionable controls.
          await this.sendMessage(chatId, caption, keyboard);
        }
      }),
    );
  }
}
