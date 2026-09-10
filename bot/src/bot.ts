import "dotenv/config";
import { Bot, GrammyError, HttpError } from "grammy";
import { handleStart, handleHelp } from "./handlers/command.js";
import { handleTextMessage, handleDownloadCallback } from "./handlers/message.js";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("❌ ERROR: TELEGRAM_BOT_TOKEN tidak ditemukan di file .env!");
  console.error("👉 Dapatkan token dari @BotFather di Telegram lalu isi di bot/.env");
  process.exit(1);
}

// Inisialisasi instance Bot grammY
const bot = new Bot(token);

// Daftarkan handler perintah dasar
bot.command("start", handleStart);
bot.command("help", handleHelp);

// Daftarkan handler callback query untuk tombol download
bot.callbackQuery(/^dl_(prd|readme):/, handleDownloadCallback);

// Daftarkan handler pesan teks untuk memproses ide proyek
bot.on("message:text", handleTextMessage);

// Global Error Handler agar bot tidak crash saat runtime
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`[Bot Error] Error pada update ${ctx.update.update_id}:`, err.error);

  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error pada request Telegram:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Gagal menghubungi server Telegram:", e);
  } else {
    console.error("Error tidak terduga:", e);
  }
});

// Penanganan graceful shutdown
const stopSignals = ["SIGINT", "SIGTERM"];
for (const signal of stopSignals) {
  process.once(signal, () => {
    console.log(`\n🛑 Menerima sinyal ${signal}. Menghentikan VibeDoc Bot secara aman...`);
    bot.stop();
  });
}

// Jalankan bot dengan Long Polling (cocok untuk local dev, Render, Railway, VPS)
async function startBot() {
  try {
    const botInfo = await bot.api.getMe();
    console.log("=========================================");
    console.log(`🤖 VibeDoc Telegram Bot Aktif!`);
    console.log(`👤 Username: @${botInfo.username}`);
    console.log(`⚡ AI Model: ${process.env.GEMINI_MODEL || "gemini-2.5-flash"}`);
    console.log(`🚀 Mode: Long Polling`);
    console.log("=========================================");

    await bot.start();
  } catch (error) {
    console.error("❌ Gagal menjalankan bot:", error);
    process.exit(1);
  }
}

startBot();
