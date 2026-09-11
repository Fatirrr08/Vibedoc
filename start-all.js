const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("=========================================");
console.log("🚀 Memulai VibeDoc Production Services...");
console.log("=========================================");

let isShuttingDown = false;
let botProcess = null;
let restartTimeout = null;

// 1. Jalankan Telegram Bot di background dengan fitur Auto-Respawn
const botScript = path.join(__dirname, "bot", "dist", "index.js");

function startBot() {
  if (isShuttingDown) return;

  if (!fs.existsSync(botScript)) {
    console.warn("⚠️ File bot/dist/index.js tidak ditemukan, Telegram Bot dilewati.");
    return;
  }

  console.log("🤖 Menjalankan VibeDoc Telegram Bot di background...");

  // Hindari bentrok port: bot tidak boleh mengikat PORT yang sama dengan Next.js
  const botEnv = { ...process.env, IS_DUAL_MODE: "true" };
  delete botEnv.PORT;
  delete botEnv.HTTP_PORT;

  botProcess = spawn("node", [botScript], {
    stdio: "inherit",
    env: botEnv,
  });

  botProcess.on("error", (err) => {
    console.error("❌ Gagal menjalankan Telegram Bot:", err);
  });

  botProcess.on("exit", (code, signal) => {
    botProcess = null;
    if (isShuttingDown) {
      console.log(`🛑 Telegram Bot dimatikan (code: ${code}, signal: ${signal}).`);
      return;
    }

    console.warn(
      `⚠️ Telegram Bot terhenti (code: ${code}, signal: ${signal}). Me-restart otomatis dalam 5 detik...`
    );
    restartTimeout = setTimeout(() => {
      startBot();
    }, 5000);
  });
}

startBot();

// 2. Jalankan Next.js Web Server untuk melayani request HTTP port di Render
const port = process.env.PORT || "3000";
console.log(`🌐 Menjalankan Next.js Web Server di port ${port}...`);
const nextServer = spawn("npx", ["next", "start", "-p", port], {
  stdio: "inherit",
  env: process.env,
});

nextServer.on("close", (code) => {
  if (!isShuttingDown) {
    console.log(`⚠️ Next.js Web Server tertutup dengan code ${code}`);
    isShuttingDown = true;
    if (restartTimeout) clearTimeout(restartTimeout);
    if (botProcess) {
      try {
        botProcess.kill("SIGTERM");
      } catch {}
    }
    process.exit(code ?? 0);
  }
});

// Penanganan graceful shutdown
["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    console.log(`\n🛑 Menerima sinyal ${signal}. Menghentikan semua service...`);
    isShuttingDown = true;
    if (restartTimeout) clearTimeout(restartTimeout);
    if (botProcess) {
      try {
        botProcess.kill("SIGTERM");
      } catch {}
    }
    if (nextServer) {
      try {
        nextServer.kill("SIGTERM");
      } catch {}
    }
    process.exit(0);
  });
});
