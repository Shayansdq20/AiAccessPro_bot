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

  get adminChatIds(): string[] {
    return config.telegram.adminIds;
  }

  async sendMessage(chatId: string | number | bigint, text: string, keyboard?: InlineKeyboard): Promise<boolean> {
    try {
      await this.api.sendMessage(String(chatId), text, keyboard ? { reply_markup: keyboard } : undefined);
      return true;
    } catch (err) {
      this.logger.warn(`sendMessage to ${chatId} failed: ${(err as Error).message}`);
      return false;
    }
  }

  /** Send a generated image (e.g. QR code) with optional caption. */
  async sendPhotoBuffer(
    chatId: string | number | bigint,
    image: Buffer,
    caption?: string,
  ): Promise<boolean> {
    try {
      await this.api.sendPhoto(String(chatId), new InputFile(image, 'qr.png'), { caption });
      return true;
    } catch (err) {
      this.logger.warn(`sendPhotoBuffer to ${chatId} failed: ${(err as Error).message}`);
      return false;
    }
  }

  async notifyAdmins(text: string, keyboard?: InlineKeyboard): Promise<void> {
    await Promise.all(this.adminChatIds.map((id) => this.sendMessage(id, text, keyboard)));
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
