import type { MessageKey } from './en';

/**
 * Built-in Persian bot copy (default language). Every key can be overridden
 * from the admin panel (/bot-texts).
 */
export const fa: Record<MessageKey, string> = {
  // Main reply-keyboard menu buttons
  'menu.products': '📦 محصولات',
  'menu.wallet': '👛 کیف پول',
  'menu.myServices': '🧾 سرویس‌های من',
  'menu.orders': '🛒 سفارش‌ها',
  'menu.discount': '🎁 کد تخفیف',
  'menu.support': '💬 پشتیبانی',
  'menu.profile': '👤 پروفایل',
  'menu.language': '🌐 زبان',

  // Common
  'common.back': '⬅️ بازگشت',
  'common.cancel': '❌ انصراف',
  'common.home': '🏠 منوی اصلی',
  'common.cancelled': 'عملیات لغو شد. به منوی اصلی برگشتید.',
  'common.error': 'مشکلی پیش آمد. لطفا دوباره تلاش کنید.',
  'common.useMenu': 'لطفا از دکمه‌های منوی پایین استفاده کنید 👇',
  'common.rateLimited': 'درخواست‌های شما خیلی سریع است. لطفا کمی صبر کنید و دوباره تلاش کنید.',

  // Start
  'start.welcome':
    'سلام {name} 👋\nبه Premium Hub خوش آمدید — فروشگاه سرویس‌های دیجیتال پرمیوم.\nاز منوی پایین شروع کنید.',

  // Catalog
  'catalog.chooseCategory': '🗂 یک دسته‌بندی انتخاب کنید:',
  'catalog.chooseProduct': '📦 {category} — یک محصول انتخاب کنید:',
  'catalog.choosePlan': '📦 {product} — یک پلن انتخاب کنید:',
  'catalog.choosePlanWithTabs': '📦 {product} — اول مدت را انتخاب کنید، بعد پلن را:',
  'catalog.monthTab': '{n} ماه',
  'catalog.empty': 'فعلا محصولی موجود نیست. لطفا بعدا سر بزنید.',
  'catalog.noPlans': 'این محصول فعلا پلن فعالی ندارد.',

  // Wallet
  'wallet.balance': '👛 موجودی کیف پول شما: {balance}',
  'wallet.chargeButton': '➕ شارژ کیف پول',
  'wallet.choosePreset': 'مبلغ شارژ را انتخاب کنید:',
  'wallet.customAmount': '✏️ مبلغ دلخواه',
  'wallet.enterCustomAmount': 'مبلغ شارژ را به تومان وارد کنید (فقط عدد):',
  'wallet.invalidAmount': 'مبلغ معتبر نیست. لطفا فقط یک عدد مثبت بفرستید، مثلا 150000.',

  // Payment
  'payment.chooseMethod': 'مبلغ: {amount}\nروش پرداخت را انتخاب کنید:',
  'payment.methodManual': '💳 کارت به کارت',
  'payment.methodGateway': '🌐 درگاه آنلاین',
  'payment.gatewayUnavailable': 'درگاه آنلاین هنوز فعال نیست. لطفا از کارت به کارت استفاده کنید.',
  'payment.manualInstructions':
    '💳 پرداخت کارت به کارت\n\nمبلغ: {amount}\nشماره کارت: {card}\nبه نام: {holder}\n{extra}\nبعد از پرداخت، فقط یک عکس از رسید ارسال کنید.',
  'payment.manualBankLine': 'بانک: {bank}',
  'payment.receiptOnlyPhoto': 'لطفا رسید را فقط به صورت یک عکس بفرستید. متن یا فایل قابل قبول نیست.',
  'payment.receiptReceived':
    '✅ رسید دریافت شد. پرداخت #{id} به مبلغ {amount} در انتظار بررسی ادمین است. نتیجه به شما اطلاع داده می‌شود.',
  'payment.approvedUser':
    '✅ کیف پول شما {amount} شارژ شد.\nموجودی جدید: {balance}',
  'payment.rejectedUser':
    '❌ پرداخت #{id} به مبلغ {amount} رد شد. اگر فکر می‌کنید اشتباهی رخ داده، با پشتیبانی در تماس باشید.',

  // Checkout
  'checkout.confirm':
    '🛒 خلاصه خرید\n\nمحصول: {product}\nپلن: {plan}\nقیمت: {amount}\nموجودی کیف پول: {balance}\n\nخرید را تایید می‌کنید؟',
  'checkout.confirmButton': '✅ تایید خرید',
  'checkout.discountLine': 'تخفیف: {amount}-',
  'checkout.insufficient':
    'موجودی کیف پول شما کافی نیست.\nقیمت: {amount}\nموجودی: {balance}\nکمبود: {shortfall}\n\nبرای تکمیل خرید، دقیقا مبلغ کمبود را شارژ کنید.',
  'checkout.chargeShortfall': '➕ شارژ {amount}',
  'checkout.success': '✅ سفارش #{id} با موفقیت ثبت شد. مبلغ پرداخت‌شده: {amount}',
  'checkout.outOfStock': 'این پلن فعلا موجودی ندارد. لطفا بعدا تلاش کنید یا با پشتیبانی تماس بگیرید.',

  // Delivery
  'delivery.auto': '🎉 سرویس شما آماده است!\n\n{payload}\n\nهر زمان خواستید از بخش «سرویس‌های من» می‌توانید آن را ببینید.',
  'delivery.pending': '📦 سفارش #{id} ثبت شد. اطلاعات سرویس به زودی توسط تیم ما برای شما ارسال می‌شود.',
  'delivery.manualSent': '📬 تحویل سفارش #{id}:\n\n{payload}',

  // Orders
  'orders.title': '🛒 سفارش‌های شما — برای جزئیات روی هر کدام بزنید:',
  'orders.empty': 'هنوز سفارشی ندارید.',
  'orders.detail':
    '🛒 سفارش #{id}\n\nمحصول: {product}\nپلن: {plan}\nمبلغ کل: {amount}\nوضعیت: {status}\nتحویل: {delivery}\nتاریخ: {date}',

  // My Services
  'services.title': '🧾 سرویس‌های شما — برای جزئیات روی هر کدام بزنید:',
  'services.empty': 'هنوز سرویس تحویل‌شده‌ای ندارید.',
  'services.detail':
    '🧾 سرویس — سفارش #{id}\n\nمحصول: {product}\nپلن: {plan}\nتاریخ تحویل: {date}\n\n{payload}',

  // Discount
  'discount.prompt': '🎁 کد تخفیف خود را ارسال کنید:',
  'discount.invalid': 'این کد تخفیف معتبر نیست یا منقضی شده است.',
  'discount.applied': '✅ کد تخفیف {code} ذخیره شد و روی خرید بعدی شما اعمال می‌شود ({value}).',
  'discount.cleared': 'کد تخفیف ذخیره‌شده شما حذف شد.',
  'discount.percentValue': '{value}٪ تخفیف',
  'discount.fixedValue': '{value} تخفیف',

  // Support
  'support.prompt': '💬 پیام خود را برای پشتیبانی بنویسید. در اولین فرصت پاسخ داده می‌شود.',
  'support.received': '✅ پیام شما برای پشتیبانی ارسال شد. تیکت #{id}.',
  'support.adminReply': '💬 پاسخ پشتیبانی (تیکت #{id}):\n\n{message}',

  // Profile
  'profile.info':
    '👤 پروفایل شما\n\nنام: {name}\nآیدی تلگرام: {telegramId}\nیوزرنیم: {username}\nیوزرنیم فروشگاه: {displayUsername}\nزبان: {language}\nموجودی کیف پول: {balance}\nتعداد سفارش‌ها: {orders}',

  // Language
  'language.choose': '🌐 زبان خود را انتخاب کنید:',
  'language.set': '✅ زبان روی فارسی تنظیم شد.',

  // Admin (Telegram quick panel)
  'admin.notAllowed': 'شما ادمین نیستید.',
  'admin.panel': '🛠 پنل ادمین — یک عملیات انتخاب کنید:',
  'admin.pendingPayments': '💳 پرداخت‌های در انتظار',
  'admin.pendingDeliveries': '📦 تحویل‌های در انتظار',
  'admin.noPendingPayments': 'پرداخت در انتظاری وجود ندارد.',
  'admin.noPendingDeliveries': 'تحویل در انتظاری وجود ندارد.',
  'admin.receiptCaption':
    '💳 پرداخت #{id}\nکاربر: {name} (آیدی {telegramId})\nمبلغ: {amount}\nوضعیت: {status}',
  'admin.deliveryItem':
    '📦 تحویل سفارش #{orderId}\nکاربر: {name} (آیدی {telegramId})\nمحصول: {product} — {plan}\nبرای ارسال اطلاعات سرویس از پنل ادمین استفاده کنید.',
  'admin.approve': '✅ تایید',
  'admin.reject': '❌ رد',
  'admin.decisionApproved': '✅ پرداخت #{id} تایید شد.',
  'admin.decisionRejected': '❌ پرداخت #{id} رد شد.',
  'admin.alreadyDecided': 'پرداخت #{id} قبلا {status} شده است.',

  // Status labels
  'status.order.pending_payment': 'در انتظار پرداخت',
  'status.order.paid': 'پرداخت‌شده',
  'status.order.fulfilling': 'در حال آماده‌سازی',
  'status.order.delivered': 'تحویل‌شده',
  'status.order.cancelled': 'لغوشده',
  'status.order.refunded': 'مسترد‌شده',
  'status.payment.pending': 'در انتظار بررسی',
  'status.payment.approved': 'تاییدشده',
  'status.payment.rejected': 'ردشده',
  'status.payment.failed': 'ناموفق',
  'status.payment.cancelled': 'لغوشده',
  'status.delivery.pending': 'در انتظار تحویل',
  'status.delivery.sent': 'تحویل‌شده',
};
