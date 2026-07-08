import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, Roles } from '../admin-auth/admin-auth.guard';
import { XuiService } from '../xui/xui.service';

@UseGuards(AdminAuthGuard)
@Roles('catalog_manager')
@Controller('admin/xui')
export class XuiAdminController {
  constructor(private readonly xui: XuiService) {}

  /** Inbound list for the plan form's picker; never exposes panel secrets. */
  @Get('inbounds')
  async inbounds() {
    if (!this.xui.enabled) return { configured: false, inbounds: [] };
    try {
      const inbounds = await this.xui.listInbounds();
      return {
        configured: true,
        inbounds: inbounds.map((i) => ({
          id: i.id,
          remark: i.remark,
          protocol: i.protocol,
          port: i.port,
          enable: i.enable,
        })),
      };
    } catch (err) {
      return { configured: true, error: (err as Error).message, inbounds: [] };
    }
  }
}
