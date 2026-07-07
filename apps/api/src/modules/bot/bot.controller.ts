import { Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BotService } from './bot.service';

@Controller('telegram')
export class BotController {
  constructor(private readonly botService: BotService) {}

  /**
   * Telegram webhook endpoint. grammY's webhookCallback verifies the
   * X-Telegram-Bot-Api-Secret-Token header when a secret is configured.
   */
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request, @Res() res: Response) {
    await this.botService.webhookHandler(req, res);
  }
}
