const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("=========================================");
console.log("🚀 Memulai VibeDoc Production Services...");
console.log("=========================================");

// 1. Jalankan Telegram Bot di background
const botScript = path.join(__dirname, "bot", "dist", "index.js");
if (fs.existsSync(botScript)) {
  console.log("🤖 Menjalankan VibeDoc Telegram Bot di background...");
  const botProcess = spawn("node", [botScript], {
    stdio: "inherit",
    env: process.env,
  });

  botProcess.on("error", (err) => {
    console.error("❌ Gagal menjalankan Telegram Bot:", err);
  });

  botProcess.on("exit", (code) => {
    console.log(`⚠️ Telegram Bot berhenti dengan exit code ${code}`);
  });
} else {
  console.warn("⚠️ File bot/dist/index.js tidak ditemukan, Telegram Bot dilewati.");
}

// 2. Jalankan Next.js Web Server untuk melayani request HTTP port di Render
const port = process.env.PORT || "3000";
console.log(`🌐 Menjalankan Next.js Web Server di port ${port}...`);
const nextServer = spawn("npx", ["next", "start", "-p", port], {
  stdio: "inherit",
  env: process.env,
});

nextServer.on("close", (code) => {
  process.exit(code ?? 0);
});

// Penanganan graceful shutdown
["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    console.log(`\n🛑 Menerima sinyal ${signal}. Menghentikan semua service...`);
    process.exit(0);
  });
});
