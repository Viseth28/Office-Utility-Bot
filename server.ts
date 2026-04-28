import express from "express";
import { Telegraf } from "telegraf";
import axios from "axios";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";
import cors from "cors";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
let bot: Telegraf | null = null;
const webhookPath = `/api/telegram-webhook`;

app.use(express.json());

// Webhook handler - Using direct handleUpdate for better Serverless compatibility
app.post(webhookPath, async (req, res) => {
  console.log(`Webhook triggered: POST ${webhookPath}`);
  try {
    const initializedBot = getBot();
    // express.json() has already parsed the body
    await initializedBot.handleUpdate(req.body, res);
    if (!res.writableEnded) {
       res.sendStatus(200);
    }
  } catch (err: any) {
    console.error("Webhook Update Error:", err);
    if (!res.writableEnded) {
      res.status(500).send("Bot update processing error");
    }
  }
});

interface LogEntry {
  id: string;
  timestamp: number;
  user: string;
  command: string;
  type: 'qr' | 'rate' | 'exchange' | 'pdf' | 'qr_gen';
}
const recentLogs: LogEntry[] = [];

function logRequest(ctx: any, command: string, type: 'qr' | 'rate' | 'exchange' | 'pdf' | 'qr_gen') {
  const user = ctx.from?.username ? `@${ctx.from.username}` : (ctx.from?.first_name || 'Unknown');
  recentLogs.unshift({
    id: Math.random().toString(36).substring(7),
    timestamp: Date.now(),
    user,
    command,
    type
  });
  if (recentLogs.length > 100) recentLogs.pop();
}

// PDF Session State
const pdfSessions = new Map<number, { fileIds: string[], timer?: NodeJS.Timeout }>();
const mediaGroups = new Map<string, { fileIds: string[], timer?: NodeJS.Timeout }>();

// Currency Cache
let cachedRates: { rates: any, timestamp: number } | null = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

async function getExchangeRates() {
  if (cachedRates && (Date.now() - cachedRates.timestamp < CACHE_DURATION)) {
    return cachedRates.rates;
  }
  try {
    const response = await axios.get("https://open.er-api.com/v6/latest/CNY", { timeout: 5000 });
    if (response.data && response.data.rates) {
      cachedRates = { rates: response.data.rates, timestamp: Date.now() };
      return response.data.rates;
    }
    throw new Error("Invalid response from exchange service");
  } catch (error) {
    console.error("Exchange Rate Error:", error);
    return cachedRates ? cachedRates.rates : null; // Fallback to stale if available
  }
}

// Lazy Bot Initialization
function getBot(): Telegraf {
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing. Please add it to your environment variables.");
  }
  if (!bot) {
    bot = new Telegraf(botToken);
    setupBot(bot);
  }
  return bot;
}

// Webhook handler is now moved above express.json()

function setupBot(bot: Telegraf) {
  bot.start((ctx) => {
    ctx.reply("Welcome! Send me your name (e.g., /viseth) to get your QR code, or send an amount in CNY (e.g., 100) to check the current exchange rate in KHR and USD.\n\nType /help for more details.");
  });

  bot.command('ping', (ctx) => {
    ctx.reply('pong! Bot is alive and well on ' + (isProd ? 'Production' : 'Development'));
  });

  bot.help((ctx) => {
    const helpMessage = `
🤖 *Telegram Utility Bot Help* 🤖

Here are the features you can use:

📸 *1. QR Code Retrieval*
Send a slash \`/\` followed by a registered name to get their KHQR code.
*Example:* \`/viseth\`

💱 *2. Currency Conversion (CNY ➡️ USD & KHR)*
Send any number to fetch live exchange rates and convert it from Chinese Yuan (CNY) to US Dollars (USD) and Cambodian Riel (KHR).
*Example:* \`102\`

📈 *3. Realtime Exchange Rate*
Use the \`/rate\` command to view the live exchange rate for 1 CNY to USD and KHR.

💧 *4. Water Refill*
Use \`/water\` to randomly pick someone from the team to refill the water!

📄 *5. Image to PDF*
Send multiple photos as an album (Media Group) for instant conversion, or use \`/pdf\` to start a session and send photos one by one. Use \`/done\` to finish.

✨ *6. QR Code Maker*
Type \`/qr\` followed by a link or text to instantly generate a QR code image.
*Example:* \`/qr https://google.com\`

Need anything else? Just type a command!
    `;
    ctx.replyWithMarkdown(helpMessage);
  });

  // --- PDF Logic ---

  const generateAndSendPDF = async (ctx: any, fileIds: string[]) => {
    if (fileIds.length === 0) return;
    const statusMsg = await ctx.reply("⏳ ខ្ញុំកំពុងបង្កើត PDF សម្រាប់អ្នក... សូមរង់ចាំបន្តិច។ (Generating PDF...)");
    
    try {
      const doc = new PDFDocument({ autoFirstPage: false });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      
      for (const fileId of fileIds) {
        const file = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const imgBuffer = Buffer.from(response.data);
        
        const img = (doc as any).openImage(imgBuffer);
        doc.addPage({ size: [img.width, img.height] });
        doc.image(imgBuffer, 0, 0);
      }
      
      doc.end();
      
      await new Promise((resolve) => doc.on('end', resolve));
      const finalBuffer = Buffer.concat(buffers);
      
      await ctx.replyWithDocument({ 
        source: finalBuffer, 
        filename: `Images_${Date.now()}.pdf` 
      });
      
      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    } catch (error) {
      console.error("PDF Generation error:", error);
      ctx.reply("❌ មានបញ្ហាក្នុងការបង្កើត PDF។ (Error generating PDF)");
    }
  };

  bot.command('pdf', (ctx) => {
    logRequest(ctx, '/pdf', 'pdf');
    const userId = ctx.from.id;
    pdfSessions.set(userId, { fileIds: [] });
    ctx.reply("📄 របៀបប្រើ៖ សូមផ្ញើរូបភាពមកខ្ញុំ (ម្នាក់ម្តងៗ ឬជាអាល់ប៊ុម)។ រួចហើយវាយពាក្យ /done ដើម្បីបញ្ចប់។\n(Ready! Send me photos, then type /done when finished.)");
  });

  bot.command('done', async (ctx) => {
    const userId = ctx.from.id;
    const session = pdfSessions.get(userId);
    if (!session || session.fileIds.length === 0) {
      return ctx.reply("⚠️ អ្នកមិនទាន់បានផ្ញើរូបភាពនៅឡើយទេ។ (No photos sent yet.)");
    }
    
    pdfSessions.delete(userId);
    await generateAndSendPDF(ctx, session.fileIds);
  });

  bot.on('photo', async (ctx, next) => {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;
    const mediaGroupId = ctx.message.media_group_id;
    const userId = ctx.from.id;

    // 1. Check if in an active /pdf session
    const session = pdfSessions.get(userId);
    if (session) {
      session.fileIds.push(fileId);
      return;
    }

    // 2. Handle Media Groups (Albums)
    if (mediaGroupId) {
      let group = mediaGroups.get(mediaGroupId);
      if (!group) {
        group = { fileIds: [] };
        mediaGroups.set(mediaGroupId, group);
      }
      group.fileIds.push(fileId);

      if (group.timer) clearTimeout(group.timer);
      group.timer = setTimeout(async () => {
        const finalGroup = mediaGroups.get(mediaGroupId);
        if (finalGroup) {
          mediaGroups.delete(mediaGroupId);
          logRequest(ctx, 'album to pdf', 'pdf');
          await generateAndSendPDF(ctx, finalGroup.fileIds);
        }
      }, 1500); // Wait 1.5s for all messages in the album to arrive
      return;
    }

    return next();
  });

  bot.on('document', async (ctx, next) => {
    const docFile = ctx.message.document;
    const mime = docFile.mime_type;
    if (!mime || !mime.startsWith('image/')) return next();

    const fileId = docFile.file_id;
    const mediaGroupId = ctx.message.media_group_id;
    const userId = ctx.from.id;

    // 1. Check if in an active /pdf session
    const session = pdfSessions.get(userId);
    if (session) {
      session.fileIds.push(fileId);
      return;
    }

    // 2. Handle Media Groups (Albums)
    if (mediaGroupId) {
      let group = mediaGroups.get(mediaGroupId);
      if (!group) {
        group = { fileIds: [] };
        mediaGroups.set(mediaGroupId, group);
      }
      group.fileIds.push(fileId);

      if (group.timer) clearTimeout(group.timer);
      group.timer = setTimeout(async () => {
        const finalGroup = mediaGroups.get(mediaGroupId);
        if (finalGroup) {
          mediaGroups.delete(mediaGroupId);
          logRequest(ctx, 'album to pdf', 'pdf');
          await generateAndSendPDF(ctx, finalGroup.fileIds);
        }
      }, 1500); 
      return;
    }

    return next();
  });

  // --- End PDF Logic ---

  bot.command('qr', async (ctx) => {
    const text = ctx.message.text.replace('/qr', '').trim();
    if (!text) {
      return ctx.reply("⚠️ សូមបញ្ចូល Link ឬអត្ថបទបន្ទាប់ពីពាក្យ /qr\n(Usage: /qr [link or text])");
    }

    logRequest(ctx, `/qr ${text}`, 'qr_gen');
    const statusMsg = await ctx.reply("⏳ កំពុងបង្កើត QR Code... (Generating...)");

    try {
      const qrBuffer = await QRCode.toBuffer(text, {
        margin: 2,
        width: 1024,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      await ctx.replyWithPhoto({ source: qrBuffer }, {
        caption: `✅ តំណភ្ជាប់របស់អ្នក (Generated QR for): \n${text}`
      });

      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    } catch (err) {
      console.error("QR Generation error:", err);
      ctx.reply("❌ មានបញ្ហាក្នុងការបង្កើត QR Code។ (Error generating QR)");
    }
  });

  bot.command('water', async (ctx) => {
    logRequest(ctx, '/water', 'qr');
    try {
      const dirs = [
        path.join(process.cwd(), "public", "KHQR"),
        path.join(process.cwd(), "dist", "KHQR")
      ];
      
      let allNames: string[] = [];
      for (const dir of dirs) {
        if (fs.existsSync(dir)) {
          try {
            const files = fs.readdirSync(dir);
            const names = files
              .filter(f => !f.startsWith('.') && f !== 'README.md')
              .map(f => path.parse(f).name);
            allNames = [...allNames, ...names];
          } catch (e) {
            console.warn("Dir read failed, using fallbacks");
          }
        }
      }
      
      if (allNames.length === 0) {
        allNames = FALLBACK_QR_NAMES;
      }
      
      const uniqueNames = Array.from(new Set(allNames));
      
      if (uniqueNames.length === 0) {
        ctx.reply("រកមិនឃើញសមាជិកក្នុងបញ្ជី QR ទេ។");
        return;
      }
      
      const randomName = uniqueNames[Math.floor(Math.random() * uniqueNames.length)];
      const upperName = randomName.toUpperCase();
      
      const messages = [
        `💧 អស់ទឹកហើយ លើកទឹកផង *${upperName}*`,
        `🚰 លើកទឹកមួយ ប្រយ័ត្នខូចម៉ាស៊ីន *${upperName}*`,
        `🌊 ស្រេកទឹកណាស់ *${upperName}* លើកទឹកមួយមក!`,
        `🧤 ហាមខ្ជិល! *${upperName}* ដល់វេនលើកទឹកហើយ`,
        `🏃‍♂️💨 Admin ឃ្លានទឹក! *${upperName}* ប្រញាប់លើកទឹកបន្តិចមក`,
        `🥛 កុំឱ្យម៉ាស៊ីនស្ងួត! *${upperName}* ទៅលើកទឹកភ្លាម!`,
        `🧊 ទឹកអស់ហើយបង *${upperName}* អើយ ជួយលើកផង!`,
        `🤨 ម៉េចក៏ទឹកអស់ចឹង? *${upperName}* នៅឯណា? មកលើកទឹក!`,
        `🙏 សូមអញ្ចើញលោកបង *${upperName}* មកលើកទឹកបន្តិចមក!`,
        `📢 ប្រកាសអាសន្ន! ទឹកអស់ហើយ! *${upperName}* រត់ទៅលើកទឹកម្នាក់ឯងទៅ!`,
        `🥵 អាកាសធាតុក្តៅ ទឹកក៏អស់! *${upperName}* ជួយសង្រ្គោះគ្នាផង!`,
        `🤖 Bot ពិនិត្យឃើញថា *${upperName}* ទំនេរជាងគេ... ទៅលើកទឹកទៅ!`
      ];
      
      const response = messages[Math.floor(Math.random() * messages.length)];
      ctx.reply(response, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error("Error in /water command:", error);
      ctx.reply("មានបញ្ហាក្នុងការជ្រើសរើសអ្នកលើកទឹក។");
    }
  });

  bot.command('rate', async (ctx) => {
    logRequest(ctx, '/rate', 'rate');
    await handleRateRequest(ctx);
  });

  // Alias for groups where people just type "rate"
  bot.hears(/^rate$/i, async (ctx) => {
    logRequest(ctx, 'rate', 'rate');
    await handleRateRequest(ctx);
  });

  async function handleRateRequest(ctx: any) {
    try {
      const rates = await getExchangeRates();
      if (rates) {
        const rateUSD = rates.USD;
        const rateKHR = rates.KHR;
        ctx.reply(`📊 *Current Exchange Rates* 📊\n\n1 CNY 🇨🇳 = ${rateUSD.toFixed(4)} USD 💵\n1 CNY 🇨🇳 = ${rateKHR.toLocaleString()} KHR ៛\n\n(Rates updated every 10 mins)`, { parse_mode: 'Markdown' });
      } else {
        ctx.reply("⚠️ Sorry, I couldn't fetch exchange rates right now. Please try again later.");
      }
    } catch (error) {
      ctx.reply("❌ Error connecting to the exchange rate service.");
    }
  }

  // Exchange handler: Supports numbers like 100, /100, 100.5, /100.5 @botname
  bot.hears(/^(?:\/)?(\d+(?:\.\d+)?)(?:\s*@[a-zA-Z0-9_]+)?$/, async (ctx) => {
    const text = ctx.match[1];
    const amount = parseFloat(text);
    
    // Protection against crazy numbers
    if (amount > 10000000) {
      return ctx.reply("⚠️ That amount is too high for me to process.");
    }

    logRequest(ctx, text, 'exchange');
    try {
      const rates = await getExchangeRates();
      if (rates) {
        const rateUSD = rates.USD;
        const rateKHR = rates.KHR;

        const convertedUSD = (amount * rateUSD).toFixed(2);
        const convertedKHR = Math.round(amount * rateKHR).toLocaleString();

        const amountPlus3 = amount * 1.03;
        const convertedUSDPlus3 = (amountPlus3 * rateUSD).toFixed(2);
        const convertedKHRPlus3 = Math.round(amountPlus3 * rateKHR).toLocaleString();

        const response = `
💰 *Calculation for ${amount.toLocaleString()} CNY*

💵 *Standard Rate:*
  • USD: **$${convertedUSD}**
  • KHR: **៛${convertedKHR}**

✨ *+3% (PDD/Fees) Rate:*
  • USD: **$${convertedUSDPlus3}**
  • KHR: **៛${convertedKHRPlus3}**

_(Rates cached for 10 mins)_
        `.trim();

        ctx.reply(response, { parse_mode: 'Markdown' });
      } else {
        ctx.reply("⚠️ Exchange service unavailable.");
      }
    } catch (error) {
      ctx.reply("❌ Error processing exchange.");
    }
  });

  // QR handler: Supports /name @botname, but ignores purely numeric strings to avoid conflict with exchange
  bot.hears(/^\/(?!\d+$)([a-zA-Z0-9_\-]+)(?:\s*@[a-zA-Z0-9_]+)?$/, async (ctx) => {
    const name = ctx.match[1].toLowerCase();
    logRequest(ctx, `/${name}`, 'qr');
    const exts = ['.png', '.jpg', '.jpeg'];
    let qrPath = null;
    
    const dirs = [
      path.join(process.cwd(), "public", "KHQR"),
      path.join(process.cwd(), "dist", "KHQR")
    ];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      for (const ext of exts) {
        const p = path.join(dir, `${name}${ext}`);
        if (fs.existsSync(p)) {
          qrPath = p;
          break;
        }
      }
      if (qrPath) break;
    }
    
    if (qrPath) {
      try {
        await ctx.replyWithPhoto({ source: fs.createReadStream(qrPath) });
      } catch (error) {
        console.error("Error sending photo:", error);
        ctx.reply("Sorry, there was an error sending your QR code.");
      }
    } else {
      // Fallback for Vercel Static deployment where fs fails
      const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
      if (vercelUrl) {
        try {
          await ctx.replyWithPhoto({ url: `${vercelUrl}/KHQR/${name}.jpg` });
        } catch (e) {
          ctx.reply(`Sorry, no QR code found for /${name}.`);
        }
      } else {
        ctx.reply(`Sorry, no QR code found for /${name}. Please make sure the file exists in the KHQR folder.`);
      }
    }
  });
}

const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

if (isProd) {
  if (appUrl) {
    console.log(`Setting up webhook at: ${appUrl}/api/telegram-webhook`);
    // Note: This might throw if token is missing, handled by check
    if (botToken) {
      getBot().telegram.setWebhook(`${appUrl}/api/telegram-webhook`).catch(err => {
        console.error("Failed to set webhook on startup:", err.message);
      });
    }
  }
} else {
  console.log("Dev mode: Starting with polling...");
  if (botToken) {
    const activeBot = getBot();
    activeBot.telegram.deleteWebhook({ drop_pending_updates: true }).then(() => {
      activeBot.launch().catch(console.error);
    });
    process.once("SIGINT", () => bot?.stop("SIGINT"));
    process.once("SIGTERM", () => bot?.stop("SIGTERM"));
  } else {
    console.warn("TELEGRAM_BOT_TOKEN not found. Bot will not start.");
  }
}

app.get("/api/test-bot", async (req, res) => {
  try {
    const activeBot = getBot();
    const me = await activeBot.telegram.getMe();
    res.json({ success: true, bot: me });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// User-executable webhook bind (Prod only)
app.get("/api/set-webhook", async (req, res) => {
  try {
    const activeBot = getBot();
    const host = req.get('host') || "";
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    
    let hostUrl = "";
    if (process.env.APP_URL) {
      hostUrl = process.env.APP_URL;
    } else if (process.env.VERCEL_URL) {
      hostUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      hostUrl = `${protocol}://${host}`;
    }
    
    // Ensure no trailing slash
    hostUrl = hostUrl.replace(/\/$/, "");
    
    const url = `${hostUrl}${webhookPath}`;
    console.log(`Setting webhook to: ${url}`);
    
    await activeBot.telegram.setWebhook(url, {
      drop_pending_updates: true,
      allowed_updates: ["message", "callback_query"]
    });
    
    const info = await activeBot.telegram.getWebhookInfo();
    res.json({ 
      success: true, 
      message: `Webhook successfully bound to ${url}`,
      info 
    });
  } catch (e: any) {
    console.error("Webhook set failed:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// User-executable reset bot (dev only)
app.get("/api/reset-bot", async (req, res) => {
  try {
    const activeBot = getBot();
    await activeBot.telegram.deleteWebhook({ drop_pending_updates: true });
    if (!isProd) {
      await activeBot.stop();
      setTimeout(() => {
        activeBot.launch().catch(console.error);
      }, 1000);
      res.send("Webhook cleared and bot restart initiated (Polling).");
    } else {
      const hostUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `https://${req.get('host')}`;
      const url = `${hostUrl}${webhookPath}`;
      await activeBot.telegram.setWebhook(url);
      res.send(`Webhook reset to ${url}`);
    }
  } catch (e: any) {
    res.status(500).send(`Reset failed: ${e.message}`);
  }
});

// Fallback list for Vercel where fs.readdirSync might fail on public/dist folders
const FALLBACK_QR_NAMES = ["viseth", "chhenghak", "chhuney", "g1", "glenn", "heng", "limey", "litchi", "pien"];

app.get("/api/status", (req, res) => {
  res.json({ botTokenSet: !!botToken, status: "Running", isProd });
});

app.get("/api/qrcodes", (req, res) => {
  const dirs = [
    path.join(process.cwd(), "public", "KHQR"),
    path.join(process.cwd(), "dist", "KHQR")
  ];
  let files: string[] = [];
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      try {
        files = fs.readdirSync(dir).filter(f => f.match(/\.(png|jpg|jpeg)$/i));
        if (files.length > 0) break;
      } catch (e) {
        // ignore
      }
    }
  }
  
  if (files.length === 0) {
    // Return extensions as well for UI compatibility if it expects full names
    files = FALLBACK_QR_NAMES.map(n => `${n}.jpg`);
  }
  
  res.json({ files });
});

app.get("/api/logs", (req, res) => {
  res.json({ logs: recentLogs });
});

if (!isProd) {
  (async () => {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Development Server running on http://localhost:${PORT}`);
    });
  })();
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Production Server running on port ${PORT}`);
    });
  }
}

export default app;
