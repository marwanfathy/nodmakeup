import axios from 'axios';

// Telegram Credentials (env-only; secrets never live in source)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID as string;
const ADMIN_PANEL = process.env.ADMIN_PANEL_URL;
export interface OrderNotificationData {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhoneNumber: string;
    shippingGovernorate: string;
    shippingAddress: string;
    
    // Financials
    originalSubtotal: number;   
    productDiscount: number;    
    couponDiscount: number;     
    shippingPrice: number;
    totalPrice: number;
    
    // Meta
    couponCode?: string;
    couponName?: string;
}

export const sendNewOrderAlert = async (orderData: OrderNotificationData) => {
    try {
        // --- 1. Format Product Discount Line ---
        let prodDiscountLine = '';
        if (orderData.productDiscount > 0) {
            prodDiscountLine = `Prod. Save: -EGP ${orderData.productDiscount}\n`;
        }

        // --- 2. Format Coupon Discount Line ---
        let couponLine = '';
        if (orderData.couponDiscount > 0) {
            const label = orderData.couponName || orderData.couponCode || 'Promo';
            couponLine = `Coupon (${label}): -EGP ${orderData.couponDiscount}\n`;
        }

        // --- 3. Build Receipt (Using HTML) ---
        // <pre> tag creates the specific "code block" look for the receipt
        const message = `
🚨 <b>NEW ORDER RECEIVED</b>

<pre>
Order No:  #${orderData.orderNumber}
Date:      ${new Date().toLocaleDateString('en-EG')}
-----------------------------
👤 CUSTOMER
Name:  ${orderData.customerName}
Phone: ${orderData.customerPhoneNumber}

🚚 SHIPPING
City:  ${orderData.shippingGovernorate}
Addr:  ${orderData.shippingAddress || 'No Address'}

🧾 PAYMENT DETAILS
Items Price: EGP ${orderData.originalSubtotal}
${prodDiscountLine}${couponLine}Shipping:    EGP ${orderData.shippingPrice}
-----------------------------
TOTAL:       EGP ${orderData.totalPrice}
</pre>

👉 <a href="${ADMIN_PANEL}/admin/orders/${orderData.id}">Manage Order in Admin Panel</a>
`;

        // --- 4. Send Request ---
        const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
        
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML', // Important: Tells Telegram to read <b> and <pre> tags
            disable_web_page_preview: true // Keeps the chat clean
        });

        console.log('✅ Telegram receipt sent.');

    } catch (error) {
        console.error('❌ Failed to send Telegram notification:', error);
    }
};