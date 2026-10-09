// ---------------------------------------------------------------------------
// Locale messages. Flat dot-keys, `{var}` interpolation supported by `t()`.
// UI chrome only — catalog content (product names/descriptions/colors) stays
// as-is from the API (English), per project decision.
// ---------------------------------------------------------------------------

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const defaultLocale: Locale = 'en';

type Dict = Record<string, string>;

const en: Dict = {
  // --- nav ---
  'nav.region': 'Egypt | English',
  'nav.regionTitle': 'Region',
  'nav.regionAlt': 'Egypt',
  'nav.openMenu': 'Open Menu',
  'nav.openBag': 'Open Shopping Bag',
  'nav.cartAlt': 'Cart',
  'nav.homeAlt': 'NOD Makeup home',
  'nav.menuTitle': 'Menu',
  'nav.home': 'Home',
  'nav.onDemand': 'On Demand',
  'nav.shop': 'Shop',
  'nav.story': 'The Story',
  'nav.switchLang': 'Switch language',

  // --- footer ---
  'footer.shopTitle': 'Shop',
  'footer.makeup': 'Makeup',
  'footer.helpTitle': 'Help & Information',
  'footer.shipping': 'Shipping & Delivery',
  'footer.returns': 'Returns & Refunds',
  'footer.legalTitle': 'Legal',
  'footer.privacy': 'Privacy Policy',
  'footer.terms': 'Terms of Service',
  'footer.socialTitle': 'Stay Connected',
  'footer.copyright': '© {year} NOD. All rights reserved.',

  // --- benefits bar ---
  'benefits.delivery': 'FAST DELIVERY',
  'benefits.returns': 'EASY RETURNS IN 14 DAYS',
  'benefits.gifts': 'GIFTS & OFFERS WITH nod',

  // --- stories ---
  'stories.title': 'Events',
  'stories.error': 'An unknown error occurred',

  // --- banner ---
  'banner.tagline': 'The lineup is here',
  'banner.title': 'NOD x the night',
  'banner.cta': 'Shop the collection',

  // --- hero section ---
  'hero.error': 'Could not load featured products at this time.',

  // --- hero product card ---
  'herocard.descFallback': 'Ultra-hydrating lip oils infused with botanical extracts for a natural, glass-like',
  'herocard.descHighlight': ' shine.',
  'herocard.descHighlightEn': ' shine.',
  'herocard.explore1': 'explore the colors',
  'herocard.explore2': 'options NOW!',
  'herocard.buyNow': 'BUY NOW',

  // --- product slider ---
  'slider.collection': 'COLLECTION',
  'slider.featured': 'Featured Products',
  'slider.noSlug': 'No collection slug was provided to the component.',
  'slider.notFound': "Sorry, the collection '{slug}' could not be found.",
  'slider.loadError': 'Could not load this collection. Please try again later.',
  'slider.empty': 'No products found in this collection.',

  // --- related products ---
  'related.title': 'You Might Also Like',

  // --- product card ---
  'card.save': 'Save {percent}%',
  'card.bestseller': 'BESTSELLER',
  'card.defaultShade': 'Default Shade',
  'card.addToBag': 'ADD TO BAG',
  'card.adding': 'ADDING...',
  'card.added': 'ADDED',

  // --- product page ---
  'pdp.loadError': 'Product could not be loaded.',
  'pdp.unavailable': 'This product is currently unavailable.',
  'pdp.dataIncomplete': 'Product data incomplete.',
  'pdp.details': 'Product Details',
  'pdp.quantity': 'Quantity',
  'pdp.outOfStock': 'Out of Stock',
  'pdp.adding': 'Adding...',
  'pdp.addToBag': 'Add to Shopping Bag',
  'pdp.buyNow': 'Buy Now',
  'pdp.off': '{percent}% OFF',
  'pdp.home': 'Home',
  'pdp.onlyLeft': 'Only {count} left',
  'pdp.inStock': 'In stock',
  'pdp.decreaseQty': 'Decrease quantity',
  'pdp.increaseQty': 'Increase quantity',
  'pdp.trustAuthentic': '100% authentic',
  'pdp.trustDelivery': 'Fast delivery',
  'pdp.trustReturns': 'Easy returns',

  // --- variant selector ---
  'variant.color': 'Color:',
  'variant.size': 'Size:',
  'variant.sku': 'SKU:',

  // --- cart ---
  // Every one of these replaced a popup. What is left is either a label for a
  // control, a refusal that sits next to the control that caused it, or a line
  // for the screen-reader live region. Nothing here is a notification to read
  // and dismiss.
  'cart.title': 'Shopping Bag',
  'cart.close': 'Close bag',
  'cart.empty': 'Your bag is empty.',
  'cart.continueShopping': 'Browse products',
  'cart.subtotal': 'Subtotal',
  'cart.checkout': 'Go to Checkout',
  'cart.removeItem': 'Remove item',
  'cart.decreaseQuantity': 'Decrease quantity',
  'cart.increaseQuantity': 'Increase quantity',
  'cart.addFailed': 'We could not add that to your bag. Please try again.',
  'cart.updateFailed': 'We could not change that quantity, so it has been put back.',
  'cart.removeFailed': 'We could not remove that item. Please try again.',
  'cart.announcedAdded': 'Added {count} item(s) to your bag.',
  'cart.announcedRemoved': 'Removed {count} item(s) from your bag.',

  // --- checkout ---
  'checkout.header': 'Complete your purchase',
  'checkout.shipping': 'Shipping Information',
  'checkout.fullName': 'Full Name',
  'checkout.phone': 'Phone Number',
  'checkout.address': 'Address',
  'checkout.governorate': 'Select Governorate...',
  'checkout.governorateSearch': 'Search or type your governorate...',
  'checkout.governorateNoResults': 'We do not deliver to that area yet.',
  'checkout.notes': 'Order Notes (optional)',
  'checkout.payment': 'Payment Method',
  'checkout.cod': 'Cash on Delivery',
  'checkout.continue': 'Continue Shopping',
  'checkout.placeOrder': 'Place Order ({total})',
  'checkout.discountCode': 'Discount code',
  'checkout.apply': 'Apply',
  'checkout.subtotal': 'Subtotal',
  'checkout.discount': 'Discount ({name})',
  'checkout.coupon.fixPhone': 'Add my number',
  'checkout.shippingCost': 'Shipping',
  'checkout.free': 'Free',
  'checkout.selectGov': 'Select governorate',
  'checkout.total': 'Total',
  'checkout.remove': 'Remove',
  // An empty bag is a page with the way out of it, not a redirect.
  'checkout.emptyCart.title': 'There is nothing in your bag',
  'checkout.emptyCart.body':
    'Your bag is empty, so there is no order to check out yet.',
  'checkout.emptyCart.cta': 'Continue shopping',
  'checkout.retry': 'Try again',
  // --- Per-field validation ---
  'checkout.err.nameRequired': 'Please enter your name.',
  'checkout.err.nameShort': 'Name must be at least 3 characters.',
  'checkout.err.phoneRequired': 'Please enter your phone number.',
  'checkout.err.phoneInvalid': 'Enter a valid Egyptian mobile number, e.g. 01012345678.',
  'checkout.err.addressRequired': 'Please enter your address.',
  'checkout.err.addressShort': 'Please add a bit more detail so the driver can find you.',
  'checkout.err.govRequired': 'Please choose your governorate.',
  'checkout.err.notesLong': 'Notes are limited to 500 characters.',
  // Shown beside the governorate list, with a retry button — without shipping
  // zones the total is wrong, so this is not a cosmetic failure.
  'checkout.err.zonesFailed':
    'We could not load the delivery areas, so shipping cost is not being calculated. Try again before placing your order.',
  'checkout.err.couponEmpty': 'Enter a discount code first.',
  'checkout.err.couponFailed': 'We could not check that code. Please try again.',
  'checkout.err.submit':
    'We could not place this order. Nothing was charged and nothing was ordered — please try again.',

  // --- Coupon refusals -----------------------------------------------------
  // One key per reason the API can report, and each one names the next move
  // rather than only the fault. A shopper told a code is "reserved for another
  // customer" with no indication of what to do is simply stuck; these say what
  // happened AND what to do about it, because each reason has a different way out.
  'checkout.coupon.notFound':
    'We do not recognise that code. Check it for typos, or continue without a discount.',
  'checkout.coupon.limitReached':
    'This code has already been used the maximum number of times. You can still place your order without it.',
  'checkout.coupon.personalizedNeedsPhone':
    'This code is personal to one customer, so it can only be checked against a phone number. Add your number above, then apply the code again.',
  'checkout.coupon.notOwned':
    'This code was issued to a different phone number. If that is your number, correct it above and try again; otherwise continue without it.',
  'checkout.coupon.applied': 'Code applied — {amount} off.',
  'checkout.coupon.remove': 'Remove code',
  'checkout.phoneHint': 'Egyptian mobile — the leading 0 is dropped for you.',
  'checkout.useLocation': 'Use my current location',
  'checkout.locating': 'Finding your location…',
  'checkout.geoFound': 'Location added to your address.',
  'checkout.geoFoundWithGov': 'Location added, and we deliver to {governorate}.',
  'checkout.geoGovUnmatched': 'Location added, but it is outside the areas we deliver to. Please choose your governorate.',
  'checkout.geo.unsupported': 'This browser cannot share your location.',
  'checkout.geo.insecure': 'Sharing a location needs a secure (https) connection.',
  'checkout.geo.denied': 'Your browser is blocking location access for this site. Re-allow it under the site settings in your browser, or type your address — it works the same.',
  'checkout.geo.denied.apple': 'Your browser is blocking location for this site. In Safari, open the page controls in the address bar, choose Website Settings, then set Location to Allow — otherwise type your address.',
  'checkout.geo.unavailable': 'Could not work out your location. Check that location services are switched on, or type your address instead.',
  'checkout.geo.timeout': 'Your location took too long to find. Please try again.',

  // --- shop ---
  'shop.all': 'Shop All',
  'shop.sortBy': 'Sort by:',
  'shop.sortNewest': 'Newest Arrivals',
  'shop.sortNameAsc': 'Name (A-Z)',
  'shop.sortNameDesc': 'Name (Z-A)',
  'shop.catAll': 'All',
  'shop.empty': 'No products found in this category.',
  'shop.viewAll': 'View All Products',
  'shop.error': 'Could not load products. Please try again.',

  // --- order success ---
  'order.loadError': 'Could not load order details.',
  'order.notFound': 'Order Not Found',
  'order.returnHome': 'Return Home',
  'order.thankYou': 'Thank You!',
  'order.placed': 'Your order has been placed successfully.',
  'order.number': 'Order Number',
  'order.totalAmount': 'Total Amount',
  'order.payment': 'Payment Method',
  'order.continueShopping': 'Continue Shopping',
  'order.emailNote': 'You will receive a confirmation call or email shortly.',
  'order.cashOnDelivery': 'Cash on Delivery',

  // --- about ---
  'about.title': 'The Story',
  'about.subtitle': 'Beauty made simple, honest, and beautifully you.',
  'about.ourStory': 'Our Story',
  'about.ourStoryBody':
    'nod was born from a simple belief: makeup should highlight who you already are, not hide it. We craft clean, high-performance formulas that feel weightless on the skin and effortless in your routine.',
  'about.standFor': 'What We Stand For',
  'about.clean': 'Clean Ingredients:',
  'about.cleanBody': 'Skin-loving formulas without unnecessary fillers.',
  'about.honest': 'Honest Prices:',
  'about.honestBody': 'Luxury-level quality at prices that make sense.',
  'about.everyday': 'Everyday Beauty:',
  'about.everydayBody': 'Products designed for real life, not just the shelf.',
  'about.site': 'About This Site',
  'about.siteBody':
    'This storefront is powered by a full microservices platform spanning the product catalog, media delivery, analytics, and order management. Every image, collection, and story you see here is served live from the backend.',

  // --- help: shipping ---
  'help.lastUpdated': 'Last Updated: November 27, 2025',
  'help.shipping.title': 'Shipping Policy',
  'help.shipping.s1.title': '1. Processing Time',
  'help.shipping.s1.body':
    'All nod orders are processed within 1-2 business days. Orders placed on weekends or holidays will be processed the following business day.',
  'help.shipping.s2.title': '2. Shipping Rates & Estimates',
  'help.shipping.s2.l1': 'Standard Shipping: 3-5 business days.',
  'help.shipping.s2.l2': 'Express Shipping: 1-2 business days.',
  'help.shipping.s3.title': '3. International Shipping',
  'help.shipping.s3.body':
    'We ship worldwide. Please note that International orders may be subject to import taxes, customs duties, and fees levied by the destination country. These charges are the responsibility of the recipient.',
  'help.shipping.s4.title': '4. Lost or Stolen Packages',
  'help.shipping.s4.body':
    'nod is not responsible for packages confirmed as delivered to the address entered at checkout. If your tracking says "Delivered" but you have not received it, please contact the shipping carrier directly.',

  // --- help: returns ---
  'help.returns.title': 'Return & Refund Policy',
  'help.returns.intro':
    'At nod, we pride ourselves on the exceptional quality of our luxury formulations. We want you to love your purchase, but we also prioritize the health and safety of our community.',
  'help.returns.s1.title': '1. Return Policy',
  'help.returns.s1.p1':
    'Due to the hygienic nature of cosmetic products, we cannot accept returns on opened or used items.',
  'help.returns.s1.l1': 'Eligibility: Returns are accepted within 14 days of the delivery date.',
  'help.returns.s1.l2':
    'Condition: To be eligible for a return, the item must be unopened, in its original packaging, with the safety seal intact.',
  'help.returns.s2.title': '2. Damaged or Defective Items',
  'help.returns.s2.body':
    'If you receive a damaged, defective, or incorrect item, please contact us immediately. We will arrange a replacement or a full refund at no cost to you.',
  'help.returns.s3.title': '3. Non-Returnable Items',
  'help.returns.s3.l1': 'Sale items or Gift Cards.',
  'help.returns.s3.l2': 'Products that have been opened, swatched, or tested.',

  // --- help: terms ---
  'help.terms.title': 'Terms of Service',
  'help.terms.s1.title': '1. Introduction',
  'help.terms.s1.body':
    'Welcome to nod. These Terms of Service govern your use of our website and the purchase of our luxury cosmetic products. By accessing our site or purchasing from us, you agree to be bound by these Terms.',
  'help.terms.s2.title': '2. Accuracy of Information & Colors',
  'help.terms.s2.body':
    'We strive to present our products as accurately as possible. However, the colors of makeup products (lipsticks, foundations, eyeshadows) as seen on your monitor or screen may differ from the actual product due to display settings and lighting. nod does not guarantee that your monitor\'s display of any color will be accurate.',
  'help.terms.s3.title': '3. Medical Disclaimer',
  'help.terms.s3.p1':
    'nod products are cosmetic in nature and are not intended to diagnose, treat, cure, or prevent any medical condition.',
  'help.terms.s3.l1':
    'Allergies: Please review the ingredient list on the product packaging or website before use. nod is not liable for any allergic reactions.',
  'help.terms.s3.l2': 'Patch Test: We strongly recommend performing a patch test before using any new product.',
  'help.terms.s4.title': '4. Intellectual Property',
  'help.terms.s4.body':
    'All content on this site—including the nod logo, brand identity, text, graphics, images, and software—is the property of nod and is protected by copyright and trademark laws.',
  'help.terms.s5.title': '5. Purchases & Pricing',
  'help.terms.s5.l1':
    'Resale Prohibited: Products are sold for personal use only. We reserve the right to limit quantities or cancel orders that appear to be for resale.',
  'help.terms.s5.l2': 'Pricing: Prices are subject to change without notice.',
  'help.terms.s6.title': '6. Limitation of Liability',
  'help.terms.s6.body':
    'To the fullest extent permitted by law, nod shall not be liable for any indirect, incidental, or consequential damages arising from the use of our products or website.',

  // --- help: privacy ---
  'help.privacy.title': 'Privacy Policy',
  'help.privacy.s1.title': '1. What We Collect',
  'help.privacy.s1.intro': 'When you visit nod, we collect:',
  'help.privacy.s1.l1': 'Personal Information: Name, email address, shipping address, and phone number.',
  'help.privacy.s1.l2':
    'Payment Information: Processed securely by third-party processors. nod does not store your full credit card info.',
  'help.privacy.s1.l3': 'Browsing Data: IP address, cookies, and device info.',
  'help.privacy.s2.title': '2. How We Use Your Information',
  'help.privacy.s2.l1': 'To process and fulfill your orders.',
  'help.privacy.s2.l2': 'To communicate with you regarding your order status.',
  'help.privacy.s2.l3': 'To send you luxury newsletters and exclusive offers (only if you opted in).',
  'help.privacy.s2.l4': 'To prevent fraud and improve our website security.',
  'help.privacy.s3.title': '3. Third-Party Sharing',
  'help.privacy.s3.body':
    'We do not sell your personal data. We share data only with trusted third parties necessary to operate our business (e.g., Shipping providers, Payment processors).',
  'help.privacy.s4.title': '4. Cookies',
  'help.privacy.s4.body':
    'We use cookies to remember your cart items and analyze site traffic. You can choose to disable cookies through your browser settings.',
  'help.privacy.contact': 'Questions? Contact us at privacy@nod.com',

  // --- offline ---
  'offline.metaTitle': 'Offline | NOD',
  'offline.title': 'You are offline',
  'offline.body':
    'This device lost its connection to the internet. Reconnect to Wi-Fi or mobile data, then try again.',
  'offline.retry': 'Try again',
  'offline.checking': 'Checking...',
  'offline.stillOffline': 'Still offline. Check your connection and try again.',

  // --- titles ---
  'titles.home': 'Home',
  'titles.shop': 'Shop All Products',
  'titles.collections': 'Our Collections',
  'titles.bestsellers': 'Bestsellers',
  'titles.story': 'The Story',
  'titles.checkout': 'Secure Checkout',
  'titles.orderConfirm': 'Order Confirmation',
  'titles.product': 'Product Details',
  'titles.brand': 'NOD',
  'titles.default': 'NOD | Premium Cosmetics',
};

const ar: Dict = {
  // --- nav ---
  'nav.region': 'مصر | العربية',
  'nav.regionTitle': 'المنطقة',
  'nav.regionAlt': 'مصر',
  'nav.openMenu': 'فتح القائمة',
  'nav.openBag': 'فتح حقيبة التسوق',
  'nav.cartAlt': 'السلة',
  'nav.homeAlt': 'الصفحة الرئيسية ل NOD Makeup',
  'nav.menuTitle': 'القائمة',
  'nav.home': 'الرئيسية',
  'nav.onDemand': 'الأكثر طلباً',
  'nav.shop': 'المتجر',
  'nav.story': 'قصتنا',
  'nav.switchLang': 'تغيير اللغة',

  // --- footer ---
  'footer.shopTitle': 'تسوق',
  'footer.makeup': 'مستحضرات التجميل',
  'footer.helpTitle': 'المساعدة والمعلومات',
  'footer.shipping': 'الشحن والتوصيل',
  'footer.returns': 'الإرجاع والاسترداد',
  'footer.legalTitle': 'قانوني',
  'footer.privacy': 'سياسة الخصوصية',
  'footer.terms': 'شروط الخدمة',
  'footer.socialTitle': 'تابعنا',
  'footer.copyright': '© {year} نود. جميع الحقوق محفوظة.',

  // --- benefits bar ---
  'benefits.delivery': 'توصيل سريع',
  'benefits.returns': 'إرجاع سهل خلال 14 يوماً',
  'benefits.gifts': 'هدايا وعروض مع nod',

  // --- stories ---
  'stories.title': 'الفعاليات',
  'stories.error': 'حدث خطأ غير معروف',

  // --- banner ---
  'banner.tagline': 'التشكيلة وصلت',
  'banner.title': 'نود × الليلة',
  'banner.cta': 'تسوقي المجموعة',

  // --- hero section ---
  'hero.error': 'تعذر تحميل المنتجات المميزة حالياً.',

  // --- hero product card ---
  'herocard.descFallback': 'زيوت شفاه فائقة الترطيب بخلاصات نباتية لمظهر طبيعي',
  'herocard.descHighlight': ' زجاجي.',
  'herocard.descHighlightEn': ' shine.',
  'herocard.explore1': 'اكتشفي الألوان',
  'herocard.explore2': 'الخيارات الآن!',
  'herocard.buyNow': 'اشتري الآن',

  // --- product slider ---
  'slider.collection': 'تشكيلة',
  'slider.featured': 'منتجات مميزة',
  'slider.noSlug': 'لم يتم توفير رابط المجموعة للمكوّن.',
  'slider.notFound': 'عذراً، تعذر العثور على المجموعة "{slug}".',
  'slider.loadError': 'تعذر تحميل هذه المجموعة. حاول مرة أخرى لاحقاً.',
  'slider.empty': 'لا توجد منتجات في هذه المجموعة.',

  // --- related products ---
  'related.title': 'قد يعجبك أيضاً',

  // --- product card ---
  'card.save': 'وفّري {percent}%',
  'card.bestseller': 'الأكثر مبيعاً',
  'card.defaultShade': 'اللون الافتراضي',
  'card.addToBag': 'أضف إلى الحقيبة',
  'card.adding': 'جارٍ الإضافة...',
  'card.added': 'تمت الإضافة',

  // --- product page ---
  'pdp.loadError': 'تعذر تحميل المنتج.',
  'pdp.unavailable': 'هذا المنتج غير متوفر حالياً.',
  'pdp.dataIncomplete': 'بيانات المنتج غير مكتملة.',
  'pdp.details': 'تفاصيل المنتج',
  'pdp.quantity': 'الكمية',
  'pdp.outOfStock': 'نفدت الكمية',
  'pdp.adding': 'جارٍ الإضافة...',
  'pdp.addToBag': 'أضف إلى حقيبة التسوق',
  'pdp.buyNow': 'اشتري الآن',
  'pdp.off': 'خصم {percent}%',
  'pdp.home': 'الرئيسية',
  'pdp.onlyLeft': 'بقي {count} فقط',
  'pdp.inStock': 'متوفر',
  'pdp.decreaseQty': 'تقليل الكمية',
  'pdp.increaseQty': 'زيادة الكمية',
  'pdp.trustAuthentic': 'أصلي ١٠٠٪',
  'pdp.trustDelivery': 'توصيل سريع',
  'pdp.trustReturns': 'إرجاع سهل',

  // --- variant selector ---
  'variant.color': 'اللون:',
  'variant.size': 'المقاس:',
  'variant.sku': 'SKU:',

  // --- cart ---
  'cart.title': 'حقيبة التسوق',
  'cart.close': 'إغلاق الحقيبة',
  'cart.empty': 'حقيبتك فارغة.',
  'cart.continueShopping': 'تصفّحي المنتجات',
  'cart.subtotal': 'المجموع الفرعي',
  'cart.checkout': 'إتمام الشراء',
  'cart.removeItem': 'إزالة المنتج',
  'cart.decreaseQuantity': 'إنقاص الكمية',
  'cart.increaseQuantity': 'زيادة الكمية',
  'cart.addFailed': 'تعذّرت إضافة المنتج إلى حقيبتك. من فضلك حاولي مرة أخرى.',
  'cart.updateFailed': 'تعذّر تغيير الكمية، فعُدَّت إلى ما كانت عليه.',
  'cart.removeFailed': 'تعذّرت إزالة المنتج. من فضلك حاولي مرة أخرى.',
  'cart.announcedAdded': 'تمت إضافة {count} منتج إلى حقيبتك.',
  'cart.announcedRemoved': 'تمت إزالة {count} منتج من حقيبتك.',

  // --- checkout ---
  'checkout.header': 'أكملي عملية الشراء',
  'checkout.shipping': 'معلومات الشحن',
  'checkout.fullName': 'الاسم الكامل',
  'checkout.phone': 'رقم الهاتف',
  'checkout.address': 'العنوان',
  'checkout.governorate': 'اختر المحافظة...',
  'checkout.governorateSearch': 'ابحثي أو اكتبي المحافظة...',
  'checkout.governorateNoResults': 'لا نوصل إلى هذه المنطقة حتى الآن.',
  'checkout.notes': 'ملاحظات الطلب (اختياري)',
  'checkout.payment': 'طريقة الدفع',
  'checkout.cod': 'الدفع عند الاستلام',
  'checkout.continue': 'متابعة التسوق',
  'checkout.placeOrder': 'تأكيد الطلب ({total})',
  'checkout.discountCode': 'كود الخصم',
  'checkout.apply': 'تطبيق',
  'checkout.subtotal': 'المجموع الفرعي',
  'checkout.discount': 'الخصم ({name})',
  'checkout.coupon.fixPhone': 'أضيفي رقمي',
  'checkout.shippingCost': 'الشحن',
  'checkout.free': 'مجاني',
  'checkout.selectGov': 'اختر المحافظة',
  'checkout.total': 'الإجمالي',
  'checkout.remove': 'إزالة',
  'checkout.emptyCart.title': 'لا يوجد شيء في حقيبتك',
  'checkout.emptyCart.body': 'حقيبتك فارغة، فما زال هناك طلب لإتمامه.',
  'checkout.emptyCart.cta': 'متابعة التسوق',
  'checkout.retry': 'حاولي مرة أخرى',
  // --- أخطاء الحقول ---
  'checkout.err.nameRequired': 'من فضلك أدخلي اسمك.',
  'checkout.err.nameShort': 'الاسم يجب أن يكون 3 أحرف على الأقل.',
  'checkout.err.phoneRequired': 'من فضلك أدخلي رقم الهاتف.',
  'checkout.err.phoneInvalid': 'أدخلي رقم موبايل مصري صحيح، مثال: ٠١٠١٢٣٤٥٦٧٨.',
  'checkout.err.addressRequired': 'من فضلك أدخلي العنوان.',
  'checkout.err.addressShort': 'أضيفي تفاصيل أكثر حتى يتمكّن المندوب من الوصول إليك.',
  'checkout.err.govRequired': 'من فضلك اختاري المحافظة.',
  'checkout.err.notesLong': 'الملاحظات محدودة بـ 500 حرف.',
  'checkout.err.zonesFailed':
    'تعذر تحميل مناطق التوصيل، لذلك لا يتم احتساب الشحن. من فضلك حاولي مرة أخرى قبل تأكيد الطلب.',
  'checkout.err.couponEmpty': 'أدخلي كود الخصم أولًا.',
  'checkout.err.couponFailed': 'تعذّر التحقق من الكود. من فضلك حاولي مرة أخرى.',
  'checkout.err.submit':
    'تعذّر تأكيد الطلب. لم يتم خصم أي مبلغ ولم يتم تسجيل أي طلب — من فضلك حاولي مرة أخرى.',

  // --- رفض كود الخصم ---
  // كل سبب يقول ما حدث و ALSO ما يمكن فعله، لأن لكل سبب طريقة مختلفة للخروج
  // منه. رسالة تفيد بأن الكود محجوز لعميل آخر دون توضيح الخطوة التالية تترك
  // المتسوّق في حيرة.
  'checkout.coupon.notFound':
    'لا نعرف هذا الكود. تأكدي من كتابته بشكل صحيح، أو يمكنك إتمام الطلب بدون خصم.',
  'checkout.coupon.limitReached':
    'تم استخدام هذا الكود بالحد الأقصى المسموح. لا يزال بإمكانك إتمام الطلب بدونه.',
  'checkout.coupon.personalizedNeedsPhone':
    'هذا الكود شخصي لعميل واحد، لذلك لا يمكن التحقق منه بدون رقم هاتف. أضيفي رقمك في الأعلى ثم أعيدي تطبيق الكود.',
  'checkout.coupon.notOwned':
    'تم إصدار هذا الكود لرقم هاتف مختلف. إذا كان هذا رقمك، صحّحيه في الأعلى وحاولي مرة أخرى؛ وإلا يمكنك المتابعة بدونه.',
  'checkout.coupon.applied': 'تم تطبيق الكود — خصم {amount}.',
  'checkout.coupon.remove': 'إزالة الكود',
  'checkout.phoneHint': 'رقم موبايل مصري — سيتم تجاهل الصفر الأول تلقائياً.',
  'checkout.useLocation': 'استخدمي موقعي الحالي',
  'checkout.locating': 'جارٍ تحديد موقعك…',
  'checkout.geoFound': 'تمت إضافة الموقع إلى عنوانك.',
  'checkout.geoFoundWithGov': 'تمت إضافة الموقع، ونوصّل إلى {governorate}.',
  'checkout.geoGovUnmatched': 'تمت إضافة الموقع، لكنه خارج المناطق التي نوصّل إليها. من فضلك اختاري المحافظة.',
  'checkout.geo.unsupported': 'لا يمكن لهذا المتصفح مشاركة موقعك.',
  'checkout.geo.insecure': 'تتطلب مشاركة الموقع اتصالاً آمناً (https).',
  'checkout.geo.denied': 'متصفحك يمنع الوصول إلى الموقع. فعّليه من إعدادات المواقع في المتصفح، أو اكتبي عنوانك — سيعمل بنفس الطريقة.',
  'checkout.geo.denied.apple': 'متصفحك يمنع الوصول إلى الموقع. في سفاري، افتحي قائمة الصفحة في شريط العنوان، ثم اختاري «إعدادات الموقع»، واضغطي «سماح» على الموقع — أو اكتبي عنوانك.',
  'checkout.geo.unavailable': 'تعذّر تحديد موقعك. تأكدي من تشغيل خدمة تحديد الموقع، أو اكتبي عنوانك مباشرة.',
  'checkout.geo.timeout': 'استغرق تحديد موقعك وقتًا طويلاً. من فضلك حاولي مرة أخرى.',

  // --- shop ---
  'shop.all': 'تسوق الكل',
  'shop.sortBy': 'ترتيب حسب:',
  'shop.sortNewest': 'الأحدث',
  'shop.sortNameAsc': 'الاسم (أ-ي)',
  'shop.sortNameDesc': 'الاسم (ي-أ)',
  'shop.catAll': 'الكل',
  'shop.empty': 'لا توجد منتجات في هذا التصنيف.',
  'shop.viewAll': 'عرض جميع المنتجات',
  'shop.error': 'تعذر تحميل المنتجات. حاول مرة أخرى.',

  // --- order success ---
  'order.loadError': 'تعذر تحميل تفاصيل الطلب.',
  'order.notFound': 'الطلب غير موجود',
  'order.returnHome': 'العودة إلى الرئيسية',
  'order.thankYou': 'شكراً لك!',
  'order.placed': 'تم إرسال طلبك بنجاح.',
  'order.number': 'رقم الطلب',
  'order.totalAmount': 'إجمالي المبلغ',
  'order.payment': 'طريقة الدفع',
  'order.continueShopping': 'متابعة التسوق',
  'order.emailNote': 'سنتواصل معك قريباً لتأكيد الطلب.',
  'order.cashOnDelivery': 'الدفع عند الاستلام',

  // --- about ---
  'about.title': 'قصتنا',
  'about.subtitle': 'جمال بسيط وصادق، وأنتِ بجمالك.',
  'about.ourStory': 'قصتنا',
  'about.ourStoryBody':
    'وُلدت nod من فكرة بسيطة: المكياج يجب أن يُبرز من أنتِ بالفعل، لا أن يخفيها. نبتكر تركيبات نظيفة عالية الأداء تشعرك بالخفة على البشرة وسهولة في روتينك اليومي.',
  'about.standFor': 'ما نؤمن به',
  'about.clean': 'مكونات نظيفة:',
  'about.cleanBody': 'تركيبات تحب البشرة دون إضافات غير ضرورية.',
  'about.honest': 'أسعار صادقة:',
  'about.honestBody': 'جودة بمستوى الفخامة بأسعار منطقية.',
  'about.everyday': 'جمال يومي:',
  'about.everydayBody': 'منتجات مصممة للحياة الواقعية، وليس للرفوف فقط.',
  'about.site': 'عن هذا الموقع',
  'about.siteBody':
    'يعمل هذا المتجر على منصة ميكروسيرفيسز متكاملة تشمل كتالوج المنتجات وتوصيل الوسائط والتحليلات وإدارة الطلبات. كل صورة وتشكيلة وقصة تراها هنا تُقدَّم مباشرة من الخوادم.',

  // --- help: shipping ---
  'help.lastUpdated': 'آخر تحديث: 27 نوفمبر 2025',
  'help.shipping.title': 'سياسة الشحن',
  'help.shipping.s1.title': '1. مدة التجهيز',
  'help.shipping.s1.body':
    'تتم معالجة جميع طلبات nod خلال 1-2 يوم عمل. تُعالَج الطلبات المقدمة في عطلات نهاية الأسبوع أو العطلات الرسمية في يوم العمل التالي.',
  'help.shipping.s2.title': '2. أسعار وتقديرات الشحن',
  'help.shipping.s2.l1': 'الشحن القياسي: 3-5 أيام عمل.',
  'help.shipping.s2.l2': 'الشحن السريع: 1-2 يوم عمل.',
  'help.shipping.s3.title': '3. الشحن الدولي',
  'help.shipping.s3.body':
    'نشحن إلى جميع أنحاء العالم. يرجى العلم أن الطلبات الدولية قد تخضع لضرائب استيراد ورسوم جمركية تفرضها الدولة الوجهة، وتقع هذه الرسوم على عاتق المستلم.',
  'help.shipping.s4.title': '4. الطرود المفقودة أو المسروقة',
  'help.shipping.s4.body':
    'لا تتحمل nod مسؤولية الطرود التي تم تأكيد تسليمها إلى العنوان المُدخل عند الدفع. إذا أظهر التتبع "تم التسليم" ولم يصلك الطرد، يرجى التواصل مع شركة الشحن مباشرة.',

  // --- help: returns ---
  'help.returns.title': 'سياسة الإرجاع والاسترداد',
  'help.returns.intro':
    'في nod، نفخر بالجودة الاستثنائية لتركيباتنا الفاخرة. نريدك أن تحب مشترياتك، لكننا نضع في الأولوية صحة وسلامة مجتمعنا.',
  'help.returns.s1.title': '1. سياسة الإرجاع',
  'help.returns.s1.p1':
    'نظراً للطبيعة الصحية لمستحضرات التجميل، لا يمكننا قبول إرجاع المنتجات المفتوحة أو المستخدمة.',
  'help.returns.s1.l1': 'الأهلية: يتم قبول الإرجاع خلال 14 يوماً من تاريخ الاستلام.',
  'help.returns.s1.l2': 'الحالة: يجب أن يكون المنتج غير مفتوح وبتغليفه الأصلي مع سلامة الختم.',
  'help.returns.s2.title': '2. المنتجات التالفة أو المعيبة',
  'help.returns.s2.body':
    'إذا استلمت منتجاً تالفاً أو معيباً أو غير صحيح، يرجى التواصل معنا فوراً وسنقوم بترتيب استبدال أو استرداد كامل دون أي تكلفة عليك.',
  'help.returns.s3.title': '3. المنتجات غير القابلة للإرجاع',
  'help.returns.s3.l1': 'المنتجات المخفضة أو بطاقات الهدايا.',
  'help.returns.s3.l2': 'المنتجات التي تم فتحها أو تجربتها أو اختبارها.',

  // --- help: terms ---
  'help.terms.title': 'شروط الخدمة',
  'help.terms.s1.title': '1. مقدمة',
  'help.terms.s1.body':
    'مرحباً بك في nod. تحكم هذه الشروط استخدامك لموقعنا وشراء منتجاتنا التجميلية الفاخرة. بوصولك إلى موقعنا أو شرائك منا، فإنك توافق على الالتزام بهذه الشروط.',
  'help.terms.s2.title': '2. دقة المعلومات والألوان',
  'help.terms.s2.body':
    'نسعى لتقديم منتجاتنا بأكبر قدر ممكن من الدقة. ومع ذلك، قد تختلف ألوان مستحضرات التجميل (أحمر الشفاه، كريم الأساس، ظلال العيون) كما تظهر على شاشتك عن المنتج الفعلي بسبب إعدادات العرض والإضاءة. لا تضمن nod دقة عرض الألوان على شاشتك.',
  'help.terms.s3.title': '3. إخلاء مسؤولية طبية',
  'help.terms.s3.p1':
    'منتجات nod تجميلية بطبيعتها وليست مخصصة لتشخيص أو علاج أو شفاء أو الوقاية من أي حالة طبية.',
  'help.terms.s3.l1':
    'الحساسية: يرجى مراجعة قائمة المكونات على عبوة المنتج أو الموقع قبل الاستخدام. لا تتحمل nod أي مسؤولية عن الحساسية.',
  'help.terms.s3.l2': 'اختبار الحساسية: ننصح بشدة بإجراء اختبار على منطقة صغيرة قبل استخدام أي منتج جديد.',
  'help.terms.s4.title': '4. الملكية الفكرية',
  'help.terms.s4.body':
    'جميع المحتويات في هذا الموقع — بما في ذلك شعار nod وهويتها ونصوصها ورسوماتها وصورها وبرمجياتها — ملك لـ nod ومحمية بموجب قوانين حقوق النشر والعلامات التجارية.',
  'help.terms.s5.title': '5. المشتريات والأسعار',
  'help.terms.s5.l1':
    'حظر إعادة البيع: تُباع المنتجات للاستخدام الشخصي فقط. نحتفظ بالحق في تقييد الكميات أو إلغاء الطلبات التي تبدو لأغراض إعادة البيع.',
  'help.terms.s5.l2': 'الأسعار: تخضع الأسعار للتغيير دون إشعار.',
  'help.terms.s6.title': '6. حدود المسؤولية',
  'help.terms.s6.body':
    'إلى أقصى حد يسمح به القانون، لا تتحمل nod أي مسؤولية عن الأضرار غير المباشرة أو العرضية أو التبعية الناشئة عن استخدام منتجاتنا أو موقعنا.',

  // --- help: privacy ---
  'help.privacy.title': 'سياسة الخصوصية',
  'help.privacy.s1.title': '1. ما نقوم بجمعه',
  'help.privacy.s1.intro': 'عند زيارتك لـ nod، نقوم بجمع:',
  'help.privacy.s1.l1': 'المعلومات الشخصية: الاسم والبريد الإلكتروني وعنوان الشحن ورقم الهاتف.',
  'help.privacy.s1.l2':
    'معلومات الدفع: تتم معالجتها بأمان عبر مزودي خدمات خارجيين. لا تخزن nod بيانات بطاقتك الائتمانية الكاملة.',
  'help.privacy.s1.l3': 'بيانات التصفح: عنوان IP وملفات تعريف الارتباط ومعلومات الجهاز.',
  'help.privacy.s2.title': '2. كيف نستخدم معلوماتك',
  'help.privacy.s2.l1': 'لمعالجة طلباتك وتنفيذها.',
  'help.privacy.s2.l2': 'للتواصل معك بخصوص حالة طلبك.',
  'help.privacy.s2.l3': 'لإرسال نشرات وعروض حصرية لك (فقط إذا وافقت).',
  'help.privacy.s2.l4': 'لمنع الاحتيال وتحسين أمان الموقع.',
  'help.privacy.s3.title': '3. المشاركة مع أطراف ثالثة',
  'help.privacy.s3.body':
    'نحن لا نبيع بياناتك الشخصية. نشارك البيانات فقط مع الأطراف الثالثة الموثوقة اللازمة لتشغيل أعمالنا (مثل شركات الشحن ومزودي الدفع).',
  'help.privacy.s4.title': '4. ملفات تعريف الارتباط',
  'help.privacy.s4.body':
    'نستخدم ملفات تعريف الارتباط لتذكُّر عناصر سلة التسوق الخاصة بك وتحليل حركة الموقع. يمكنك تعطيلها من إعدادات المتصفح.',
  'help.privacy.contact': 'لديك أسئلة؟ تواصل معنا على privacy@nod.com',

  // --- offline ---
  'offline.metaTitle': 'بلا اتصال | نود',
  'offline.title': 'لا يوجد اتصال بالإنترنت',
  'offline.body':
    'انقطع اتصال جهازك بالإنترنت. أعد الاتصال بشبكة Wi-Fi أو بيانات الهاتف ثم حاول مرة أخرى.',
  'offline.retry': 'إعادة المحاولة',
  'offline.checking': 'جارٍ التحقق...',
  'offline.stillOffline': 'لا يزال الاتصال منقطعاً. تحقق من الشبكة وحاول مرة أخرى.',

  // --- titles ---
  'titles.home': 'الرئيسية',
  'titles.shop': 'جميع المنتجات',
  'titles.collections': 'تشكيلاتنا',
  'titles.bestsellers': 'الأكثر مبيعاً',
  'titles.story': 'قصتنا',
  'titles.checkout': 'إتمام الشراء الآمن',
  'titles.orderConfirm': 'تأكيد الطلب',
  'titles.product': 'تفاصيل المنتج',
  'titles.brand': 'NOD',
  'titles.default': 'نود | مستحضرات تجميل فاخرة',
};

export const messages: Record<Locale, Dict> = { en, ar };