import { Telegraf } from 'telegraf';
import { AdminActionType, DiscountType } from '@prisma/client';
import prisma from '../config/prismaClient'; 
import dotenv from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_TELEGRAM_ID = parseInt(process.env.TELEGRAM_ADMIN_CHAT_ID || '');

// Bot-driven edits (stock/stories) attribute their admin_logs to the first admin.
// Resolved lazily (admin ids are UUIDs now; a fixed id no longer exists).
let botAdminId: string | null = null;
const resolveBotAdminId = async (): Promise<string | null> => {
    if (botAdminId) return botAdminId;
    const admin = await prisma.admin.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
    botAdminId = admin?.id ?? null;
    return botAdminId;
};

// Media service URL is env-only (MEDIA_BASE_URL). Never a hardcoded default.
const MEDIA_BASE_URL = process.env.MEDIA_BASE_URL as string;
const STORY_UPLOAD_ENDPOINT = `${MEDIA_BASE_URL}/api/upload-story`;

// We initialize the bot instance but don't launch yet
export const bot = new Telegraf(BOT_TOKEN);


async function uploadToMediaServer(telegramFileUrl: string, fileName: string) {
    const response = await axios({ method: 'GET', url: telegramFileUrl, responseType: 'stream' });
    const form = new FormData();
    form.append('media', response.data, {
        filename: fileName,
        contentType: fileName.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'
    });
    
    const uploadRes = await axios.post(`${MEDIA_BASE_URL}/api/upload-story`, form, {
        headers: form.getHeaders()
    });
    return uploadRes.data; 
}
// --- HELPER: SYSTEM LOGGING ---
async function recordAction(ctx: any, { type, resource, id, details }: any) {
    try {
        const adminId = await resolveBotAdminId();
        if (!adminId) return;
        const log = await prisma.adminLog.create({
            data: { adminId, actionType: type, targetResource: resource, targetId: id, details }
        });
        await ctx.replyWithHTML(`✅ <b>LOGGED: #${log.id}</b>\n<code>${type}</code> on <code>${resource}</code>`);
    } catch (err) { console.error("Logging Error", err); }
}

export const initTelegramBot = async () => {
    // 1. Check for token to avoid 404 crash
    if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_TOKEN' || BOT_TOKEN.length < 10) {
        console.error("❌ TELEGRAM_BOT_TOKEN is missing or invalid in .env. Bot service skipped.");
        return;
    }

    try {
        // --- SECURITY MIDDLEWARE ---
        bot.use(async (ctx, next) => {
            if (ctx.from?.id !== ADMIN_TELEGRAM_ID) return ctx.reply("⛔ Unauthorized access.");
            return next();
        });

// --- COMMAND: START (DASHBOARD v2.0) ---
        bot.start((ctx) => {
            ctx.replyWithHTML(`
🚀 <b>SYSTEM ROOT TERMINAL v2.0</b>

<b>📊 ANALYTICS & TRAFFIC</b>
/stats - Full business & traffic report
/live - Real-time active sessions
/timeline - System audit trail (Table Mode)

<b>📦 ORDER MANAGEMENT</b>
/order [Order#] - Deep dive (Items, Financials, Tx)
/status [Order#] [ID] - Update order status

<b>🏷️ INVENTORY CONTROL</b>
/stock [ID] [Value] - Update stock levels
<i>Note: Supports math (e.g., /stock 45 +10 or -5)</i>

<b>🎁 MARKETING & PROMOS</b>
/reward [Phone] [Val] [f/p] [Uses] [Cat] - Advanced coupon
/stories - Manage and view active stories

<b>📱 DIRECT STORY UPLOAD</b>
To upload to Media Server:
1. Attach a Photo or Video.
2. Add caption: <code>/story [bundle_name]</code>
3. Send to bot.

<b>📜 ADMIN</b>
/logs - View last 10 raw admin actions
            `);
        });

        // --- 1. ADVANCED STATS ---
        bot.command('stats', async (ctx) => {
            try {
                const [sales, visits, live, products] = await Promise.all([
                    prisma.order.aggregate({ _sum: { totalPrice: true, totalDiscount: true }, _count: { id: true } }),
                    prisma.siteVisit.count(),
                    prisma.liveSession.count(),
                    prisma.product.count({ where: { isActive: true } })
                ]);

                ctx.replyWithHTML(`
📈 <b>BUSINESS PERFORMANCE</b>
<pre>
Revenue:     EGP ${sales._sum.totalPrice?.toFixed(2) || 0}
Discounts:   EGP ${sales._sum.totalDiscount?.toFixed(2) || 0}
Orders:      ${sales._count.id}
Active Prods:${products}
</pre>
🌐 <b>SITE TRAFFIC</b>
<pre>
Total Visits: ${visits}
Live Now:     ${live} users
</pre>
                `);
            } catch (e: any) { ctx.reply("Error: " + e.message); }
        });

        // --- 2. DEEP ORDER DETAILS ---
        bot.command('order', async (ctx) => {
            const orderNumber = ctx.message.text.split(' ')[1];
            if (!orderNumber) return ctx.reply("Usage: /order ORD-123");

            try {
                const order = await prisma.order.findUnique({
                    where: { orderNumber },
                    include: {
                        items: { include: { product: true, variant: true } },
                        status: true,
                        transactions: true,
                        appliedDiscounts: { include: { discount: true } }
                    }
                });

                if (!order) return ctx.reply("❌ Order not found.");

                const itemList = order.items.map(i => `• ${i.product.name} (${i.variant.size || 'N/A'})\n  Qty: ${i.quantity} @ EGP ${i.priceAtPurchase}`).join('\n');
                const txStatus = order.transactions.map(t => `💳 ${t.status}: EGP ${t.amount} (${t.transactionDate.toLocaleTimeString()})`).join('\n');

                ctx.replyWithHTML(`
🧾 <b>ORDER #${order.orderNumber}</b>
Status: <b>${order.status.statusName}</b>
Date: ${order.createdAt.toLocaleString()}

👤 <b>CUSTOMER</b>
Name: ${order.customerName}
Phone: <code>${order.customerPhoneNumber}</code>

🛒 <b>ITEMS</b>
${itemList}

💰 <b>FINANCIALS</b>
Subtotal: EGP ${Number(order.totalPrice) + Number(order.totalDiscount) - Number(order.shippingCost)}
Shipping: EGP ${order.shippingCost}
Discount: -EGP ${order.totalDiscount}
<b>TOTAL:   EGP ${order.totalPrice}</b>

💳 <b>TRANSACTIONS</b>
${txStatus || 'No transactions recorded.'}
                `);
            } catch (e: any) { ctx.reply("Error: " + e.message); }
        });

        // --- 3. AUDIT TIMELINE ---
bot.command('timeline', async (ctx) => {
            try {
                const logs = await prisma.adminLog.findMany({
                    take: 12,
                    orderBy: { createdAt: 'desc' },
                    include: { admin: true }
                });

                if (logs.length === 0) return ctx.reply("📭 No audit logs found.");

                // Helper to align columns: Full Enum names can be long, so we use a larger padding (20)
                const pad = (str: string, len: number) => {
                    const cleanStr = str.substring(0, len);
                    return cleanStr + ' '.repeat(len - cleanStr.length);
                };

                // 1. Build Table Header (Extended width for full Action names)
                let table = `<b>🕒 SYSTEM AUDIT TRAIL (FULL)</b>\n`;
                table += `<pre>\n`;
                table += `TIME  | ADMIN      | ACTION\n`;
                table += `------|------------|-------------------------\n`;

                // 2. Process Rows
                logs.forEach(l => {
                    const time = l.createdAt.toLocaleTimeString('en-EG', { 
                        hour12: false, 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    const adminName = l.admin.firstName;
                    
                    // Displaying the raw Enum name from the DB (e.g., PRODUCT_UPDATE, ORDER_STATUS_UPDATE)
                    const fullAction = l.actionType;

                    table += `${time} | ${pad(adminName, 10)} | ${pad(fullAction, 20)}\n`;
                });
                table += `</pre>\n`;

                // 3. Deep Detail Section (Recent 3 Modifications)
                table += `<b>🔍 DEEP INSPECTION:</b>\n`;
                
                logs.slice(0, 3).forEach(l => {
                    const emoji = l.actionType.includes('DELETE') ? '🗑' : (l.actionType.includes('CREATE') ? '➕' : '🔄');
                    
                    let detailMsg = '';
                    if (l.details && typeof l.details === 'object') {
                        const d = l.details as any;
                        if (d.old_status || d.new_status) {
                            detailMsg = `Status Change: ${d.old_status} ➔ ${d.new_status}`;
                        } else if (d.new_stock) {
                            detailMsg = `Stock Level: ${d.new_stock} units`;
                        } else if (d.coupon) {
                            detailMsg = `Coupon Code: ${d.coupon}`;
                        } else if (d.path) {
                            detailMsg = `File: ...${d.path.slice(-20)}`;
                        } else {
                            detailMsg = `Target: ${l.targetResource || 'System'} (#${l.targetId})`;
                        }
                    }

                    table += `${emoji} <b>${l.actionType}</b>\n└ <i>${detailMsg}</i>\n`;
                });

                // 4. System Statistics
                const totalActions = await prisma.adminLog.count();
                table += `\nTotal recorded actions: <code>${totalActions}</code>`;

                await ctx.replyWithHTML(table);

            } catch (e: any) {
                console.error("Timeline Error:", e);
                ctx.reply("❌ Error fetching timeline.");
            }
        });

        // --- 4. LIVE TRAFFIC ---
        bot.command('live', async (ctx) => {
            const count = await prisma.liveSession.count();
            const sessions = await prisma.liveSession.findMany({ take: 5, orderBy: { lastActive: 'desc' } });
            let msg = `🔥 <b>LIVE TRAFFIC: ${count} Users</b>\n\n`;
            sessions.forEach(s => { msg += `👤 <code>${s.sessionId.slice(0, 10)}...</code>\n   Last: ${s.lastActive.toLocaleTimeString()}\n`; });
            ctx.replyWithHTML(msg);
        });

        // --- 5. STOCK UPDATE ---
bot.command('stock', async (ctx) => {
            const [, idStr, valueStr] = ctx.message.text.split(' ');

            if (!idStr || !valueStr) {
                return ctx.replyWithHTML(`
❌ <b>Missing Arguments</b>
Usage: <code>/stock [ID] [Value]</code>

<b>Examples:</b>
• Set fixed: <code>/stock 45 100</code>
• Add stock: <code>/stock 45 +10</code>
• Remove stock: <code>/stock 45 -5</code>
                `);
            }

            const variantId = idStr;
            const inputVal = valueStr.trim();

            try {
                // 1. Fetch current state first
                const current = await prisma.productVariant.findUnique({
                    where: { id: variantId },
                    include: { product: true }
                });

                if (!current) return ctx.reply(`❌ Variant ID #${variantId} not found.`);

                // 2. Determine Logic: Fixed vs Relative (+/-)
                let newQty: number;
                const isRelative = inputVal.startsWith('+') || inputVal.startsWith('-');
                
                if (isRelative) {
                    newQty = current.stockQuantity + parseInt(inputVal);
                } else {
                    newQty = parseInt(inputVal);
                }

                // 3. Safety Check: Don't allow negative stock
                if (newQty < 0) {
                    return ctx.reply(`⚠️ Math Error: Result would be ${newQty}. Stock cannot be negative.`);
                }

                // 4. Perform Update
                const updated = await prisma.productVariant.update({
                    where: { id: variantId },
                    data: { stockQuantity: newQty },
                    include: { product: true }
                });

                // 5. UI: Generate Status Icons
                const statusIcon = updated.stockQuantity === 0 
                    ? '🚫 OUT OF STOCK' 
                    : (updated.stockQuantity < 5 ? '⚠️ LOW STOCK' : '✅ IN STOCK');

                const changeLabel = isRelative 
                    ? `(Changed by ${inputVal})` 
                    : `(Updated from ${current.stockQuantity})`;

                // 6. Build Advanced Receipt
                const receipt = `
📦 <b>INVENTORY UPDATE</b>
-----------------------------
<b>Product:</b>  ${updated.product.name}
<b>Variant:</b>  ${updated.size || 'Default'} | ${updated.colorName || 'N/A'}
<b>SKU:</b>      <code>${updated.sku}</code>
-----------------------------
<b>Previous:</b> ${current.stockQuantity} units
<b>Current:</b>  <b>${updated.stockQuantity} units</b>
<b>Mode:</b>     ${changeLabel}
<b>Status:</b>   ${statusIcon}
-----------------------------
<i>Database synchronized successfully.</i>
                `;

                await ctx.replyWithHTML(receipt);

                // 7. Advanced Logging
                await recordAction(ctx, {
                    type: 'PRODUCT_UPDATE',
                    resource: 'PRODUCT_VARIANT',
                    id: updated.id,
                    details: {
                        product: updated.product.name,
                        sku: updated.sku,
                        old_qty: current.stockQuantity,
                        new_qty: updated.stockQuantity,
                        math: isRelative ? 'Relative' : 'Fixed'
                    }
                });

            } catch (e: any) {
                console.error("Stock Update Error:", e);
                ctx.reply(`❌ System Error: ${e.message}`);
            }
        });

        // --- 6. REWARD SYSTEM ---
bot.command('reward', async (ctx) => {
            // Format: /reward [phone] [value] [type: f/p] [usages] [category]
            const args = ctx.message.text.split(' ');
            const [, phone, value, typeStr, usages, cat] = args;

            if (!phone || !value) {
                return ctx.replyWithHTML(`
🎁 <b>Advanced Reward Manager</b>
Usage: <code>/reward [Phone] [Value] [Type] [Usages] [Category]</code>

<b>Options:</b>
• <b>Type:</b> <code>f</code> (Fixed EGP), <code>p</code> (Percentage %)
• <b>Usages:</b> Number of times it can be used (default: 1)
• <b>Category:</b> e.g., <code>VIP</code>, <code>COMPENSATION</code>, <code>LOYALTY</code>

<b>Examples:</b>
• Quick 50 EGP: <code>/reward 010xxx 50</code>
• 20% Discount (3 uses): <code>/reward 010xxx 20 p 3 VIP</code>
                `);
            }

            try {
                // 1. Logic for Discount Type
                const isPercent = typeStr?.toLowerCase() === 'p';
                const discountType: DiscountType = isPercent ? 'PERCENTAGE' : 'FIXED_AMOUNT';
                const symbol = isPercent ? '%' : 'EGP';

                // 2. Generate a Professional Code
                // Format: PREFIX-PHONE-RANDOM
                const randomStr = Math.random().toString(36).substring(7).toUpperCase();
                const code = `RW-${phone.slice(-4)}-${randomStr}`;

                // 3. Database Operation
                const discount = await prisma.discount.create({
                    data: {
                        name: `${cat || 'REWARD'} | ${phone}`,
                        couponCode: code,
                        type: discountType,
                        value: parseInt(value),
                        assignedPhone: phone,
                        maxUsages: parseInt(usages) || 1,
                        currentUsages: 0,
                        isActive: true,
                        category: (cat || 'CLIENT_REWARD').toUpperCase(),
                    }
                });

                // 4. Advanced Receipt
                const receipt = `
🎊 <b>REWARD COUPON CREATED</b>
-----------------------------
<b>Code:</b>      <code>${discount.couponCode}</code>
<b>Value:</b>     ${discount.value}${symbol}
<b>Type:</b>      ${discountType.replace('_', ' ')}
-----------------------------
👤 <b>TARGET CUSTOMER</b>
<b>Phone:</b>     <code>${discount.assignedPhone}</code>
<b>Limit:</b>     ${discount.maxUsages} Usage(s)
<b>Category:</b>  #${discount.category}
-----------------------------
✅ <i>Locked to customer phone number.
Ready for immediate use.</i>
                `;

                await ctx.replyWithHTML(receipt);

                // 5. Audit Log
                await recordAction(ctx, {
                    type: 'DISCOUNT_CREATE',
                    resource: 'DISCOUNT',
                    id: discount.id,
                    details: {
                        code: discount.couponCode,
                        phone: discount.assignedPhone,
                        val: discount.value,
                        type: discountType,
                        usages: discount.maxUsages
                    }
                });

            } catch (e: any) {
                console.error("Reward Error:", e);
                ctx.replyWithHTML(`❌ <b>Database Error:</b>\n<code>${e.message}</code>`);
            }
        });
// --- 1. ADVANCED STORY LIST (Interactive Table) ---
// Synchronized with your Media Server's 'handleStoryUpload' and Multer 'media' field
// --- 1. ADVANCED STORY LIST (Interactive Table) ---
    bot.command('stories', async (ctx) => {
        try {
            const stories = await prisma.story.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10, // Keep table readable on mobile
                include: { admin: true }
            });

            if (stories.length === 0) return ctx.reply("📭 No active stories found.");

            const pad = (s: string, l: number) => s.substring(0, l).padEnd(l);

            let msg = `📱 <b>STORY CONTENT MANAGER</b>\n`;
            msg += `<pre>\n`;
            msg += `ID  | BUNDLE     | TYPE | VIEWS\n`;
            msg += `----|------------|------|------\n`;

            const keyboard: any[] = [];

            stories.forEach(s => {
                const type = s.mediaType.toUpperCase().substring(0, 4);
                const views = s.viewCount.toString();
                // Extract first 10 chars of bundle name
                const bnd = s.bundleId ? s.bundleId.substring(0, 10) : 'SINGLE';

                msg += `${pad(s.id.toString(), 3)} | ${pad(bnd, 10)} | ${pad(type, 4)} | ${pad(views, 4)}\n`;

                keyboard.push([
                    { text: `👁 View #${s.id}`, url: s.mediaUrl },
                    { text: `🗑 Delete #${s.id}`, callback_data: `del_story_${s.id}` }
                ]);
            });

            msg += `</pre>\n<i>Admin: ${stories[0]?.admin.firstName}</i>`;

            await ctx.replyWithHTML(msg, {
                reply_markup: { inline_keyboard: keyboard }
            });

        } catch (e: any) { 
            console.error(e);
            ctx.reply("❌ Error: " + e.message); 
        }
    });

    // --- 2. ADVANCED MEDIA HANDLER (DIRECT UPLOAD & BUNDLING) ---
    // Usage: Attach photo/video and use caption: /story [OptionalName]
    bot.on(['photo', 'video'], async (ctx) => {
        const message = ctx.message;
        // TypeScript Safety Check
        if (!message || !('caption' in message) || !message.caption?.startsWith('/story')) return;

        try {
            await ctx.reply(`⏳ Processing via Optimized Media Server...`);

            let fileId = '';
            let isVideo = false;
            let thumbId: string | null = null;

            // Type-safe property access
            if ('video' in message && message.video) {
                fileId = message.video.file_id;
                isVideo = true;
                thumbId = message.video.thumbnail?.file_id || null;
            } else if ('photo' in message && message.photo) {
                fileId = message.photo[message.photo.length - 1].file_id;
                isVideo = false;
            }

            if (!fileId) return ctx.reply("❌ Could not resolve file ID.");

            // 1. Get Link from Telegram
            const link = await ctx.telegram.getFileLink(fileId);
            
            // 2. Stream Main Media to Media Server
            const fileName = `tg-story-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
            const serverData = await uploadToMediaServer(link.href, fileName);

            // 3. Handle Video Thumbnail (Sync with React Logic)
            let finalThumbUrl = serverData.thumbnailUrl || null;
            if (isVideo && thumbId && !finalThumbUrl) {
                const tLink = await ctx.telegram.getFileLink(thumbId);
                const thumbData = await uploadToMediaServer(tLink.href, `tg-thumb-${Date.now()}.jpg`);
                finalThumbUrl = thumbData.url;
            }

            // 4. Resolve Bundle ID (Automatic Grouping)
            const [, customName] = message.caption.split(' ');
            const bundleId = customName || (message as any).media_group_id || `BND-${Date.now().toString().slice(-6)}`;

            // 5. Save to Prisma (Strings only)
            const botAdminId = await resolveBotAdminId();
            if (!botAdminId) throw new Error('No admin account exists to own bot-uploaded stories.');
            const story = await prisma.story.create({
                data: {
                    adminId: botAdminId,
                    mediaUrl: String(serverData.url), 
                    thumbnailUrl: finalThumbUrl ? String(finalThumbUrl) : null,
                    mediaType: isVideo ? 'video' : 'image',
                    bundleId: String(bundleId),
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), 
                    viewCount: 0,
                    clickCount: 0
                }
            });

            await ctx.replyWithHTML(`✅ <b>Story Live!</b>\nID: #${story.id}\nBundle: <code>${bundleId}</code>`);

            await recordAction(ctx, { 
                type: 'STORY_CREATE', 
                resource: 'STORY', 
                id: story.id, 
                details: { bundleId, url: serverData.url, type: isVideo ? 'VIDEO' : 'IMAGE' } 
            });

        } catch (err: any) {
            console.error("Upload Failed:", err.message);
            ctx.reply(`❌ Upload Failed: ${err.message}`);
        }
    });

    // --- 3. DELETE HANDLER (WITH SERVER CLEANUP) ---
    bot.action(/del_story_([0-9a-f-]{36})/, async (ctx) => {
        const storyId = ctx.match[1];
        try {
            const story = await prisma.story.findUnique({ where: { id: storyId } });
            if (!story) return ctx.answerCbQuery("Story already deleted.");

            // 1. Attempt to cleanup file on Media Server
            try {
                const relativePath = story.mediaUrl.replace(`${MEDIA_BASE_URL}/`, '');
                await axios.post(`${MEDIA_BASE_URL}/api/delete`, { filePath: relativePath }, {
                    headers: {
                        'x-media-api-key': process.env.MEDIA_API_KEY || '',
                    },
                });
            } catch (e) {
                console.warn("Media server file cleanup skipped or failed.");
            }

            // 2. Delete from DB
            await prisma.story.delete({ where: { id: storyId } });
            
            // 3. Audit & Notification
            await recordAction(ctx, { 
                type: 'STORY_DELETE', 
                resource: 'STORY', 
                id: storyId, 
                details: { bundle: story.bundleId, path: story.mediaUrl } 
            });

            await ctx.answerCbQuery("Story Purged");
            await ctx.editMessageText(`✅ <b>Story #${storyId} purged from system.</b>\nBundle: <code>${story.bundleId}</code>`, { parse_mode: 'HTML' });

        } catch (e: any) { 
            console.error(e);
            ctx.answerCbQuery("Error: " + e.message); 
        }
    });

        // 7. LAUNCH (bot.launch() starts polling and never resolves — do NOT await)
        bot.launch();
        console.log("🚀 Telegram Advanced Root Terminal initialized.");

    } catch (err: any) {
        console.error("❌ FAILED TO LAUNCH TELEGRAM BOT:");
        if (err.response && err.response.error_code === 404) {
            console.error("   CAUSE: Invalid Bot Token (404 Not Found).");
        } else {
            console.error("   DETAILS:", err.message);
        }
        // No throw here - allows Express to continue running
    }
};

// Handle stop signals (guarded: telegraf throws "Bot is not running!"
// when stop() is called on a bot that was never launched, e.g. no token)
const stopBot = (signal: string) => {
    try {
        bot.stop(signal);
    } catch {
        /* bot never launched — nothing to stop */
    }
};
process.once('SIGINT', () => stopBot('SIGINT'));
process.once('SIGTERM', () => stopBot('SIGTERM'));