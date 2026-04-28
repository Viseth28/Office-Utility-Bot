import express from "express";
import { createServer as createViteServer } from "vite";
import { Telegraf } from "telegraf";
import axios from "axios";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  let bot: Telegraf | null = null;
  
  if (botToken) {
    bot = new Telegraf(botToken);

    // Provide generic response to /start
    bot.start((ctx) => {
      ctx.reply("Welcome! Send me your name (e.g., /viseth) to get your QR code, or send an amount in CNY (e.g., 100) to check the current exchange rate in KHR and USD.");
    });

    // Handle commands like /viseth
    bot.hears(/^\/([a-zA-Z0-9_\-]+)$/, async (ctx) => {
      const name = ctx.match[1].toLowerCase();
      
      const exts = ['.png', '.jpg', '.jpeg'];
      let qrPath = null;
      for (const ext of exts) {
        const p = path.join(process.cwd(), "public", "KHQR", `${name}${ext}`);
        if (fs.existsSync(p)) {
          qrPath = p;
          break;
        }
      }
      
      if (qrPath) {
        try {
          await ctx.replyWithPhoto({ source: fs.createReadStream(qrPath) });
        } catch (error) {
          console.error("Error sending photo:", error);
          ctx.reply("Sorry, there was an error sending your QR code.");
        }
      } else {
        ctx.reply(`Sorry, no QR code found for /${name}. Please make sure the file exists in the KHQR folder.`);
      }
    });

    // Handle numbers for exchange rates (CNY -> KHR, USD)
    bot.on("text", async (ctx) => {
      const text = ctx.message.text.trim();
      const amount = parseFloat(text);

      if (!isNaN(amount) && text.match(/^\d+(\.\d+)?$/)) {
        try {
          // Fetch open exchange rates with CNY as base
          const response = await axios.get("https://open.er-api.com/v6/latest/CNY");
          if (response.data && response.data.rates) {
            const rateUSD = response.data.rates.USD;
            const rateKHR = response.data.rates.KHR;

            const convertedUSD = (amount * rateUSD).toFixed(2);
            const convertedKHR = (amount * rateKHR).toLocaleString(); // Add commas

            ctx.reply(`${amount} CNY 🇨🇳 is approximately:\n\n💵 ${convertedUSD} USD\n៛ ${convertedKHR} KHR\n\n(Rates updated dynamically)`);
          } else {
            ctx.reply("Sorry, I couldn't fetch exchange rates right now.");
          }
        } catch (error) {
          console.error("Error fetching exchange rates:", error);
          ctx.reply("Error connecting to the exchange rate service.");
        }
      } else {
         // Not a number, maybe they just typed something else
         // we can just ignore or give a hint
      }
    });

    const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

    if (appUrl && process.env.NODE_ENV === "production") {
      const webhookPath = `/api/telegram-webhook`;
      // We must tell Telegram to send updates to this URL
      bot.telegram.setWebhook(`${appUrl}${webhookPath}`);
      // Mount the webhook middleware to Express
      app.use(bot.webhookCallback(webhookPath));
      console.log(`Telegram Webhook configured at ${appUrl}${webhookPath}`);
    } else {
      // For Dev/Testing or local, use polling
      bot.launch().catch(e => console.error("Bot launch failed (maybe no token or duplicate instance):", e));
      console.log("Telegram bot started in polling mode.");
    }
    
    // Enable graceful stop
    process.once("SIGINT", () => bot?.stop("SIGINT"));
    process.once("SIGTERM", () => bot?.stop("SIGTERM"));
  } else {
    console.warn("TELEGRAM_BOT_TOKEN is not set. Bot will not start.");
  }

  // API Route for the frontend to check bot status
  app.get("/api/status", (req, res) => {
    res.json({ 
      botTokenSet: !!process.env.TELEGRAM_BOT_TOKEN,
      status: "Running" 
    });
  });

  // API to upload/manage QR codes in public/KHQR/ folder
  app.get("/api/qrcodes", (req, res) => {
    const dir = path.join(process.cwd(), "public", "KHQR");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const files = fs.readdirSync(dir).filter(f => f.match(/\.(png|jpg|jpeg)$/i));
    res.json({ files });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (!botToken) {
        console.log("No TELEGRAM_BOT_TOKEN provided. Please set it in Settings/Secrets.");
    } else {
        console.log("Telegram bot is running.");
    }
  });
}

startServer();