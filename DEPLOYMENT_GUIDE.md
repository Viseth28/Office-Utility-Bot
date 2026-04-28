# Telegram Bot Deployment Guide - Fixed Issues & Setup

## Problems Fixed ✅

### 1. **Critical: Incorrect Webhook Middleware Configuration** 
- **Issue**: Line 54 was using `app.use(bot.webhookCallback(webhookPath))` which made it a global middleware for ALL requests
- **Fix**: Changed to `app.post(webhookPath, bot.webhookCallback(webhookPath))` so only webhook POST requests are handled
- **Impact**: Bot now properly receives and responds to messages from Telegram

### 2. **Security: Hardcoded Bot Token Exposed**
- **Issue**: Bot token was visible in source code on line 21
- **Fix**: Removed fallback token, now only uses environment variable `TELEGRAM_BOT_TOKEN`
- **Impact**: Token is no longer exposed in your repository

### 3. **Webhook Setup Error Handling**
- **Issue**: Webhook was set without proper error logging
- **Fix**: Added detailed logging and error handling for webhook setup
- **Impact**: You can now see if webhook setup fails and why

### 4. **Vercel Configuration**
- **Issue**: Redundant rewrite rules could cause routing issues
- **Fix**: Updated vercel.json to properly route API calls and static files
- **Impact**: Cleaner request routing on Vercel

---

## How to Deploy (Complete Steps)

### Step 1: Set Environment Variables on Vercel

Go to your Vercel project settings and add:

```
TELEGRAM_BOT_TOKEN=<your_bot_token_from_BotFather>
```

**How to get your bot token:**
1. Chat with [@BotFather](https://t.me/botfather) on Telegram
2. Create a new bot with `/newbot`
3. Copy the token (format: `XXXXXXXXX:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`)

### Step 2: Build & Deploy

```bash
npm run build
git add .
git commit -m "Fix bot webhook configuration"
git push
```

Vercel will automatically deploy. Monitor the build logs for any errors.

### Step 3: Verify Webhook Setup

Once deployed, visit:
```
https://your-vercel-url.vercel.app/api/set-webhook
```

You should see:
```
SUCCESS: Webhook bound to https://your-vercel-url.vercel.app/api/telegram-webhook
```

If it fails, check:
1. Is `TELEGRAM_BOT_TOKEN` set in Vercel environment variables?
2. Is your bot token valid?
3. Check Vercel deployment logs for errors

### Step 4: Test Your Bot

Send a message to your bot:
- `/start` - Should get welcome message
- `/help` - Should get help message  
- `/qr https://google.com` - Should generate QR code
- `100` - Should convert CNY to USD/KHR
- `/rate` - Should show exchange rates

---

## Architecture & How It Works Now

```
Telegram User sends message
         ↓
Telegram Servers send POST to /api/telegram-webhook
         ↓
Vercel routes /api/* → server.ts (Express app)
         ↓
Express: app.post('/api/telegram-webhook', bot.webhookCallback(...))
         ↓
Telegraf library processes update & sends response back to user
```

---

## Troubleshooting

### Bot doesn't respond to messages
1. Check Vercel logs: `vercel logs`
2. Verify webhook is set: Visit `/api/set-webhook` endpoint
3. Verify bot token in environment variables is correct
4. Check that bot is actually receiving requests in logs

### New messages not working after deployment
1. Run `/api/reset-bot` endpoint to clear webhook
2. Then run `/api/set-webhook` to set webhook again
3. Or use BotFather's `/setwebhook` command if needed

### "Bot token not configured" error
Ensure `TELEGRAM_BOT_TOKEN` environment variable is set in Vercel

### Webhook returns 200 but no reply
Check Express logs to see if handlers are firing. Add logs in bot command handlers if needed.

---

## File Changes Summary

- `server.ts` Line 54: ✅ Fixed webhook middleware
- `server.ts` Line 21: ✅ Removed hardcoded token
- `server.ts` Lines 415-423: ✅ Improved webhook setup logging
- `vercel.json`: ✅ Fixed routing configuration

---

## Environment Variables Checklist

- [ ] `TELEGRAM_BOT_TOKEN` - Set in Vercel
- [ ] `VERCEL_URL` - Automatically set by Vercel (don't set manually)
- Optional: `APP_URL` - For local development or custom domain

---

Need help? Check the server logs on Vercel or test locally with `npm run dev`
