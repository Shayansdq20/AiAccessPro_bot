/**
 * Built-in English bot copy. Every key can be overridden from the admin
 * panel (/bot-texts) via the `bot_messages` setting; empty overrides fall
 * back to these defaults.
 */
export const en = {
  // Main reply-keyboard menu buttons
  'menu.products': '📦 Products',
  'menu.wallet': '👛 Wallet',
  'menu.myServices': '🧾 My Services',
  'menu.orders': '🛒 Orders',
  'menu.discount': '🎁 Discount Code',
  'menu.referral': '👥 Invite Friends',
  'menu.support': '💬 Support',
  'menu.profile': '👤 Profile',
  'menu.language': '🌐 Language',

  // Common
  'common.back': '⬅️ Back',
  'common.cancel': '❌ Cancel',
  'common.home': '🏠 Main Menu',
  'common.cancelled': 'Cancelled. Back to the main menu.',
  'common.error': 'Something went wrong. Please try again.',
  'common.useMenu': 'Please use the menu buttons below 👇',
  'common.rateLimited': 'You are doing that too fast. Please wait a moment and try again.',

  // Start
  'start.welcome':
    'Hi {name} 👋\nWelcome to Pro Ai Access — your store for premium digital services.\nUse the menu below to get started.',

  // Catalog
  'catalog.chooseCategory': '🗂 Choose a category:',
  'catalog.chooseProduct': '📦 {category} — choose a product:',
  'catalog.choosePlan': '📦 {product} — choose a plan:',
  'catalog.choosePlanWithTabs': '📦 {product} — pick a duration, then a plan:',
  'catalog.monthTab': '{n} month',
  'catalog.empty': 'No products are available right now. Please check back later.',
  'catalog.noPlans': 'This product has no active plans right now.',

  // Wallet
  'wallet.balance': '👛 Your wallet balance: {balance}',
  'wallet.chargeButton': '➕ Charge Wallet',
  'wallet.choosePreset': 'Choose a top-up amount:',
  'wallet.customAmount': '✏️ Custom amount',
  'wallet.enterCustomAmount': 'Enter the top-up amount in Toman (numbers only):',
  'wallet.invalidAmount': 'That is not a valid amount. Please send a positive number, e.g. 150000.',

  // Payment
  'payment.chooseMethod': 'Amount: {amount}\nChoose a payment method:',
  'payment.methodManual': '💳 Card-to-card transfer',
  'payment.methodGateway': '🌐 Online gateway',
  'payment.gatewayUnavailable': 'The online gateway is not available yet. Please use card-to-card transfer.',
  'payment.manualInstructions':
    '💳 Card-to-card payment\n\nAmount: {amount}\nCard number: {card}\nCard holder: {holder}\n{extra}\nAfter paying, send exactly one photo of your receipt.',
  'payment.manualBankLine': 'Bank: {bank}',
  'payment.receiptOnlyPhoto': 'Please send your receipt as a single photo. Text or files are not accepted.',
  'payment.receiptReceived':
    '✅ Receipt received. Payment #{id} for {amount} is now waiting for admin review. You will be notified once it is checked.',
  'payment.approvedUser':
    '✅ Your wallet was charged {amount}.\nNew balance: {balance}',
  'payment.rejectedUser':
    '❌ Your payment #{id} for {amount} was rejected. If you believe this is a mistake, contact support.',

  // Checkout
  'checkout.confirm':
    '🛒 Purchase summary\n\nProduct: {product}\nPlan: {plan}\n\n{priceBlock}\nWallet balance: {balance}\n\nConfirm the purchase?',
  'checkout.confirmButton': '✅ Confirm purchase',
  'checkout.pricePlain': '💵 Price: {amount}',
  'checkout.priceDiscounted':
    '💵 Original price: {subtotal}\n🎁 Discount ({code}): -{discount}\n✅ You pay: {total}',
  'checkout.discountRejected':
    '⚠️ Discount code {code} was not applied ({reason}). You can add it in "Discount Code".',
  'checkout.applyDiscount': '🎁 Have a discount code?',
  'checkout.successDiscount': '✅ Order #{id} placed. You paid {amount} (saved {discount} with {code}).',
  'checkout.discountLine': 'Discount: -{amount}',
  'discount.reason.not_found': 'code not found',
  'discount.reason.inactive': 'code disabled',
  'discount.reason.expired': 'expired',
  'discount.reason.max_uses': 'usage limit reached',
  'discount.reason.max_uses_per_user': 'you already used it',
  'discount.reason.min_order': 'order total too low',
  'checkout.insufficient':
    'Your wallet balance is not enough.\nPrice: {amount}\nBalance: {balance}\nShortfall: {shortfall}\n\nCharge exactly the shortfall to complete this purchase.',
  'checkout.chargeShortfall': '➕ Charge {amount}',
  'checkout.success': '✅ Order #{id} was placed successfully. Amount paid: {amount}',
  'checkout.outOfStock':
    'This plan is currently out of stock. Please try again later or contact support.',

  // Delivery
  'delivery.auto': '🎉 Your service is ready!\n\n{payload}\n\nYou can always find it under "My Services".',
  'delivery.pending':
    '📦 Your order #{id} is registered. The service details will be sent to you by our team shortly.',
  'delivery.manualSent': '📬 Delivery for order #{id}:\n\n{payload}',
  'delivery.vpnReady': '🎉 Your VPN service is ready!',
  'delivery.vpnVolume': '📦 Volume: {gb} GB',
  'delivery.vpnDuration': '⏰ Duration: {months} month(s)',
  'delivery.vpnSubLabel': '📡 Subscription link (all locations, auto-updates):',
  'delivery.vpnConfigsHeader': '🔧 Configs (tap any to copy):',
  'delivery.vpnNotes':
    'Scan the QR code, or copy the subscription link into your app (v2rayNG, Streisand, …). Check "My Services" anytime for your remaining traffic.',
  'services.traffic': '📊 Usage: {used} GB of {total} GB',

  // Orders
  'orders.title': '🛒 Your orders — tap one for details:',
  'orders.empty': 'You have no orders yet.',
  'orders.detail':
    '🛒 Order #{id}\n\nProduct: {product}\nPlan: {plan}\nTotal: {amount}\nStatus: {status}\nDelivery: {delivery}\nDate: {date}',

  // My Services
  'services.title': '🧾 Your services — tap one for details:',
  'services.empty': 'You have no delivered services yet.',
  'services.detail':
    '🧾 Service — order #{id}\n\nProduct: {product}\nPlan: {plan}\nDelivered: {date}\n\n{payload}',

  // Discount
  'discount.prompt': '🎁 Send your discount code:',
  'discount.invalid': 'This discount code is not valid or has expired.',
  'discount.applied':
    '✅ Discount code {code} saved. It will be applied to your next purchase ({value}).',
  'discount.cleared': 'Your saved discount code was removed.',
  'discount.percentValue': '{value}% off',
  'discount.fixedValue': '{value} off',

  // Referral
  'referral.screen':
    '👥 Invite Friends\n\nShare your personal link. When {required} friends each buy at least {minSpend}, you get {reward} added to your wallet.\n\n🔗 Your link:\n{link}\n\n📊 Invited: {invited} | Qualified: {qualified}/{required}\n💰 Rewards earned: {earned}',
  'referral.anySpend': 'a product',
  'referral.noProgram':
    '👥 Invite Friends\n\n🔗 Your link:\n{link}\n\n📊 Invited: {invited}\n\nNo active referral reward right now — invite anyway, rewards may return soon!',
  'referral.rewardEarned':
    '🎉 Referral reward!\n{amount} was added to your wallet for inviting friends.\nNew balance: {balance}',

  // Support
  'support.prompt': '💬 Write your message for support. It will be answered as soon as possible.',
  'support.received': '✅ Your message was sent to support. Ticket #{id}.',
  'support.adminReply': '💬 Support reply (ticket #{id}):\n\n{message}',

  // Profile
  'profile.info':
    '👤 Your profile\n\nName: {name}\nTelegram ID: {telegramId}\nUsername: {username}\nStore username: {displayUsername}\nLanguage: {language}\nWallet balance: {balance}\nOrders: {orders}',

  // Language
  'language.choose': '🌐 Choose your language:',
  'language.set': '✅ Language set to English.',

  // Admin (Telegram quick panel)
  'admin.notAllowed': 'You are not an admin.',
  'admin.panel': '🛠 Admin panel — choose an action:',
  'admin.pendingPayments': '💳 Pending payments',
  'admin.pendingDeliveries': '📦 Pending deliveries',
  'admin.noPendingPayments': 'No pending payments.',
  'admin.noPendingDeliveries': 'No pending deliveries.',
  'admin.receiptCaption':
    '💳 Payment #{id}\nUser: {name} (ID {telegramId})\nAmount: {amount}\nStatus: {status}',
  'admin.deliveryItem':
    '📦 Delivery for order #{orderId}\nUser: {name} (ID {telegramId})\nProduct: {product} — {plan}\nUse the admin panel to send the service details.',
  'admin.approve': '✅ Approve',
  'admin.reject': '❌ Reject',
  'admin.decisionApproved': '✅ Payment #{id} approved.',
  'admin.decisionRejected': '❌ Payment #{id} rejected.',
  'admin.alreadyDecided': 'Payment #{id} was already {status}.',

  // Status labels
  'status.order.pending_payment': 'Pending payment',
  'status.order.paid': 'Paid',
  'status.order.fulfilling': 'Being prepared',
  'status.order.delivered': 'Delivered',
  'status.order.cancelled': 'Cancelled',
  'status.order.refunded': 'Refunded',
  'status.payment.pending': 'Pending review',
  'status.payment.approved': 'Approved',
  'status.payment.rejected': 'Rejected',
  'status.payment.failed': 'Failed',
  'status.payment.cancelled': 'Cancelled',
  'status.delivery.pending': 'Waiting for delivery',
  'status.delivery.sent': 'Delivered',
} as const;

export type MessageKey = keyof typeof en;
