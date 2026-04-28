import express from "express";
import { Telegraf } from "telegraf";
import axios from "axios";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const botToken = process.env.TELEGRAM_BOT_TOKEN || "8364240851:AAGs5TPBO-A8kZu5k-QNu9648PYrLLdptCg";
const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL;
let bot: Telegraf | null = null;
const webhookPath = `/api/telegram-webhook`;

if (botToken) {
  bot = new Telegraf(botToken);
  
  // ALWAYS mount the webhook middleware so manual webhooks work everywhere
  app.use(bot.webhookCallback(webhookPath));

  bot.start((ctx) => {
    ctx.reply("Welcome! Send me your name (e.g., /viseth) to get your QR code, or send an amount in CNY (e.g., 100) to check the current exchange rate in KHR and USD.\n\nType /help for more details.");
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

Need anything else? Just type a command!
    `;
    ctx.replyWithMarkdown(helpMessage);
  });

  bot.hears(/^\/([a-zA-Z0-9_\-]+)$/, async (ctx) => {
    const name = ctx.match[1].toLowerCase();
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

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();
    const amount = parseFloat(text);

    if (!isNaN(amount) && text.match(/^\d+(\.\d+)?$/)) {
      try {
        const response = await axios.get("https://open.er-api.com/v6/latest/CNY");
        if (response.data && response.data.rates) {
          const rateUSD = response.data.rates.USD;
          const rateKHR = response.data.rates.KHR;

          const convertedUSD = (amount * rateUSD).toFixed(2);
          const convertedKHR = (amount * rateKHR).toLocaleString();

          ctx.reply(`${amount} CNY 🇨🇳 is approximately:\n\n💵 ${convertedUSD} USD\n៛ ${convertedKHR} KHR\n\n(Rates updated dynamically)`);
        } else {
          ctx.reply("Sorry, I couldn't fetch exchange rates right now.");
        }
      } catch (error) {
        console.error("Error fetching exchange rates:", error);
        ctx.reply("Error connecting to the exchange rate service.");
      }
    }
  });

  const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (isProd) {
    if (appUrl) {
      bot.telegram.setWebhook(`${appUrl}${webhookPath}`).catch(console.error);
    }
  } else {
    // In dev, clear webhook before polling to avoid 409 conflict
    bot.telegram.deleteWebhook({ drop_pending_updates: true }).then(() => {
      bot!.launch().catch(e => {
        if (e.response && e.response.error_code === 409) {
          console.log("Polling failed with 409 because a webhook is actively set. Your webhook will handle requests instead.");
        } else {
          console.error("Bot launch failed:", e);
        }
      });
    }).catch(console.error);
    process.once("SIGINT", () => bot?.stop("SIGINT"));
    process.once("SIGTERM", () => bot?.stop("SIGTERM"));
  }
} else {
  console.warn("TELEGRAM_BOT_TOKEN is not set. Bot will not start.");
}

// User-executable webhook bind
app.get("/api/set-webhook", async (req, res) => {
  if (!bot) return res.status(400).send("Bot token not configured.");
  const hostUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `https://${req.get('host')}`;
  const url = `${hostUrl}${webhookPath}`;
  try {
    await bot.telegram.setWebhook(url);
    res.send(`SUCCESS: Webhook bound to ${url}. The bot should now be fully functional!`);
  } catch (e: any) {
    res.status(500).send(`FAILED to set webhook: ${e.message}`);
  }
});

app.get("/api/status", (req, res) => {
  res.json({ botTokenSet: !!botToken, status: "Running" });
});

app.get("/api/qrcodes", (req, res) => {
  const dirs = [
    path.join(process.cwd(), "public", "KHQR"),
    path.join(process.cwd(), "dist", "KHQR")
  ];
  let files: string[] = [];
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      files = fs.readdirSync(dir).filter(f => f.match(/\.(png|jpg|jpeg)$/i));
      break;
    }
  }
  res.json({ files });
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
