import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaService } from './prisma/prisma.service';
import { BigIntInterceptor } from './common/bigint.interceptor';

// Core services
import { SettingsService } from './modules/settings/settings.service';
import { TextsService } from './modules/settings/texts.service';
import { UsersService } from './modules/users/users.service';
import { WalletService } from './modules/wallet/wallet.service';
import { CatalogService } from './modules/catalog/catalog.service';
import { DiscountsService } from './modules/discounts/discounts.service';
import { InventoryService } from './modules/fulfillment/inventory.service';
import { FulfillmentService } from './modules/fulfillment/fulfillment.service';
import { OrdersService } from './modules/orders/orders.service';
import { NotifierService } from './modules/notifier/notifier.service';
import { PaymentsService } from './modules/payments/payments.service';
import { ZarinpalProvider } from './modules/payments/providers/zarinpal.provider';
import { SupportService } from './modules/support/support.service';
import { AuditService } from './modules/audit/audit.service';

// Admin auth
import { AdminAuthService } from './modules/admin-auth/admin-auth.service';
import { AdminAuthGuard } from './modules/admin-auth/admin-auth.guard';
import { AdminAuthController } from './modules/admin-auth/admin-auth.controller';

// Bot
import { BotCommonService } from './modules/bot/bot-common.service';
import { CatalogHandler } from './modules/bot/handlers/catalog.handler';
import { WalletHandler } from './modules/bot/handlers/wallet.handler';
import { OrdersHandler } from './modules/bot/handlers/orders.handler';
import { MiscHandler } from './modules/bot/handlers/misc.handler';
import { AdminHandler } from './modules/bot/handlers/admin.handler';
import { BotService } from './modules/bot/bot.service';
import { BotController } from './modules/bot/bot.controller';

// Public + admin controllers
import { PaymentsController } from './modules/payments/payments.controller';
import { DashboardController } from './modules/admin-api/dashboard.controller';
import { UsersController } from './modules/admin-api/users.controller';
import { CatalogAdminController } from './modules/admin-api/catalog.controller';
import { InventoryAdminController } from './modules/admin-api/inventory.controller';
import { PaymentsAdminController } from './modules/admin-api/payments-admin.controller';
import { OperationsController } from './modules/admin-api/operations.controller';
import { DiscountsAdminController } from './modules/admin-api/discounts.controller';
import { SettingsAdminController } from './modules/admin-api/settings.controller';
import { SupportAdminController } from './modules/admin-api/support-admin.controller';
import { AuditController } from './modules/admin-api/audit.controller';

@Module({
  controllers: [
    AdminAuthController,
    BotController,
    PaymentsController,
    DashboardController,
    UsersController,
    CatalogAdminController,
    InventoryAdminController,
    PaymentsAdminController,
    OperationsController,
    DiscountsAdminController,
    SettingsAdminController,
    SupportAdminController,
    AuditController,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: BigIntInterceptor },
    PrismaService,
    SettingsService,
    TextsService,
    UsersService,
    WalletService,
    CatalogService,
    DiscountsService,
    InventoryService,
    FulfillmentService,
    OrdersService,
    NotifierService,
    PaymentsService,
    ZarinpalProvider,
    SupportService,
    AuditService,
    AdminAuthService,
    AdminAuthGuard,
    BotCommonService,
    CatalogHandler,
    WalletHandler,
    OrdersHandler,
    MiscHandler,
    AdminHandler,
    BotService,
  ],
})
export class AppModule {}
