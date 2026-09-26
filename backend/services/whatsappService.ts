import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { createPostOrderDiscount } from './discountGenerator';

// --- CONFIGURATION ---
const MIN_DELAY_MS = 15000;
const MAX_DELAY_MS = 40000;

// --- GLOBAL STATE ---
export let whatsappClient: Client;
let isReady = false;

// Health prober used by /readyz.
export const isWhatsAppReady = () => isReady;

interface QueueItem {
    to: string;
    message: string;
}
const messageQueue: QueueItem[] = [];
let isProcessingQueue = false;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const getRandomDelay = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

// --- 1. INITIALIZE CLIENT ---
export const initWhatsApp = async () => {
    console.log('🔄 [WhatsApp] Initializing Client...');

    whatsappClient = new Client({
        authStrategy: new LocalAuth({
            dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--no-zygote',
                '--disable-gpu'
            ],
        }
    });

    whatsappClient.on('qr', (qr) => {
        console.log('');
        console.log('╔══════════════════════════════════════════╗');
        console.log('║        WHATSAPP QR CODE - SCAN ME        ║');
        console.log('╠══════════════════════════════════════════╣');
        qrcode.generate(qr, { small: true });
        console.log('╚══════════════════════════════════════════╝');
        console.log('');
    });

    whatsappClient.on('authenticated', () => {
        console.log('🔐 [WhatsApp] Authenticated successfully.');
    });

    whatsappClient.on('auth_failure', (msg) => {
        console.error('❌ [WhatsApp] Authentication failed:', msg);
        isReady = false;
    });

    whatsappClient.on('ready', () => {
        console.log('');
        console.log('✅ [WhatsApp] Client is READY and listening for messages.');
        console.log('');
        isReady = true;
        processQueue();
    });

    whatsappClient.on('loading_screen', (percent, message) => {
        console.log(`⏳ [WhatsApp] Loading: ${percent}% - ${message}`);
    });

    whatsappClient.on('change_state', (state) => {
        console.log(`🔄 [WhatsApp] State changed: ${state}`);
    });

    whatsappClient.on('disconnected', async (reason) => {
        isReady = false;
        console.log('⚠️ [WhatsApp] Disconnected. Reason:', reason);
        console.log('🔄 [WhatsApp] Attempting to reconnect in 5s...');
        await sleep(5000);
        try {
            await whatsappClient.initialize();
        } catch (e) {
            console.error('❌ [WhatsApp] Reconnect failed:', e);
        }
    });

    // Start the client
    try {
        await whatsappClient.initialize();
    } catch (err) {
        console.error('❌ [WhatsApp] Failed to initialize:', err);
        throw err;
    }
};

// --- 2. QUEUE PROCESSOR ---
const processQueue = async () => {
    if (isProcessingQueue || messageQueue.length === 0) return;
    isProcessingQueue = true;

    console.log(`📬 [WhatsApp] Queue processor started. ${messageQueue.length} message(s) pending.`);

    while (messageQueue.length > 0) {
        if (!isReady) {
            console.log('⏳ [WhatsApp] Client not ready. Waiting 5s...');
            await sleep(5000);
            continue;
        }

        const item = messageQueue[0];

        try {
            let formattedPhone = item.to.replace(/\D/g, '');
            if (formattedPhone.startsWith('01')) formattedPhone = '2' + formattedPhone;
            const chatId = `${formattedPhone}@c.us`;

            console.log(`📤 [WhatsApp] Sending to ${item.to}...`);
            await whatsappClient.sendMessage(chatId, item.message, { sendSeen: false });

            console.log(`✅ [WhatsApp] Sent to ${item.to}. (Remaining: ${messageQueue.length - 1})`);
            messageQueue.shift();

            if (messageQueue.length > 0) {
                const delay = getRandomDelay(MIN_DELAY_MS, MAX_DELAY_MS);
                console.log(`⏳ [WhatsApp] Waiting ${delay / 1000}s before next message...`);
                await sleep(delay);
            }

        } catch (error) {
            console.error(`❌ [WhatsApp] Failed to send to ${item.to}:`, error);
            messageQueue.shift();
        }
    }

    isProcessingQueue = false;
    console.log('📭 [WhatsApp] Queue empty. Processor stopped.');
};

// --- 3. PUBLIC SENDER ---
export const sendWhatsAppMessage = async (to: string, message: string) => {
    messageQueue.push({ to, message });
    console.log(`📥 [WhatsApp] Message queued for ${to}. Queue size: ${messageQueue.length}`);
    processQueue();
    return true;
};

// --- 4. BUSINESS LOGIC ---
export const sendOrderThankYouWithReward = async (
    customerName: string,
    customerPhone: string,
    orderNumber: string
) => {
    try {
        const generatedCode = await createPostOrderDiscount(customerPhone, customerName);
        const message = `Hi ${customerName}! 👋\n\nThank you for placing your order (${orderNumber}) with NOD! We are excited to get it to you.\n\n🎁 *A Gift For You:*\nHere is a special discount code for your NEXT order: *${generatedCode}*\n\nThis code is valid for one use only. Enjoy!`;
        console.log(`🎁 [WhatsApp] Sending order thank you + reward to ${customerName} (${customerPhone}) for order ${orderNumber}`);
        await sendWhatsAppMessage(customerPhone, message);
    } catch (error) {
        console.error("⚠️ [WhatsApp] Background Task Failed: Could not process Thank You Reward.", error);
    }
};
