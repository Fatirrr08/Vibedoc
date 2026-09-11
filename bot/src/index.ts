import "dotenv/config";
import http from "node:http";
import { Bot, InputFile, Keyboard, InlineKeyboard, GrammyError, HttpError } from "grammy";
import { generateGroqContent } from "./groq.js";
import { DocType } from "./prompt.js";

// Health-check server opsional untuk cloud hosting (Render Free Web Service, Railway, Fly.io)
// Hanya aktif jika bot dijalankan mandiri (bukan dual mode bersama Next.js)
const cloudPort = process.env.PORT || process.env.HTTP_PORT;
if (cloudPort && process.env.IS_DUAL_MODE !== "true") {
  const server = http.createServer((_, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        bot: "VibeDoc Bot",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      })
    );
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️ Port ${cloudPort} sudah digunakan. Bot tetap berjalan tanpa standalone HTTP server.`);
    } else {
      console.error("⚠️ HTTP server error:", err);
    }
  });

  server.listen(Number(cloudPort), () => {
    console.log(`🌐 Cloud health-check HTTP server aktif di port ${cloudPort}`);
  });
}

const token = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

if (!token || token.trim() === "" || token === "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ") {
  console.error("❌ ERROR: BOT_TOKEN belum dikonfigurasi di file .env!");
  console.error("👉 Dapatkan token dari @BotFather di Telegram lalu isi BOT_TOKEN di bot/.env");
  process.exit(1);
}

// Inisialisasi Bot grammY
const bot = new Bot(token);

/**
 * State Machine Sesi Pengguna
 */
export type UserState = "IDLE" | "AWAITING_IDEA" | "CHAT_MODE";

export interface UserSession {
  state: UserState;
  selectedDocType?: DocType;
  pendingIdea?: string;
  lastActive: number;
}

const userSessions = new Map<number, UserSession>();

function getUserSession(userId: number): UserSession {
  let session = userSessions.get(userId);
  if (!session) {
    session = { state: "IDLE", lastActive: Date.now() };
    userSessions.set(userId, session);
  }
  session.lastActive = Date.now();
  return session;
}

// Bersihkan sesi lama yang tidak aktif > 12 jam
setInterval(() => {
  const now = Date.now();
  const maxAge = 12 * 60 * 60 * 1000;
  for (const [uid, sess] of userSessions.entries()) {
    if (now - sess.lastActive > maxAge) {
      userSessions.delete(uid);
    }
  }
}, 30 * 60 * 1000);

/**
 * Metadata konfigurasi per tipe dokumen
 */
const DOC_META: Record<
  DocType,
  { label: string; filename: string; icon: string; desc: string; buttonText: string }
> = {
  arch: {
    label: "ARCHITECTURE.md",
    filename: "ARCHITECTURE.md",
    icon: "🏗️",
    desc: "Tech stack, ERD Schema, API Endpoints & MVP Checklist",
    buttonText: "🏗️ ARCHITECTURE.md",
  },
  design: {
    label: "DESIGN.md",
    filename: "DESIGN.md",
    icon: "🎨",
    desc: "UI/UX Design System, Hex Colors, Komponen & User Flows",
    buttonText: "🎨 DESIGN.md",
  },
  agent: {
    label: "AGENT.md (.cursorrules)",
    filename: "AGENT.md",
    icon: "🤖",
    desc: "Aturan ketat AI Coder, TypeScript rules, Konvensi Folder & Naming",
    buttonText: "🤖 AGENT.md (.cursorrules)",
  },
  db: {
    label: "DATABASE.md",
    filename: "DATABASE.md",
    icon: "🗄️",
    desc: "Skema Database (Prisma/SQL), Relasi, Indexing & Sample Query",
    buttonText: "🗄️ DATABASE.md",
  },
  chat: {
    label: "Mode Brainstorming",
    filename: "BRAINSTORM.md",
    icon: "💬",
    desc: "Diskusi ide, rekomendasi stack, saran MVP & tanya-jawab teknis",
    buttonText: "💬 Mode Brainstorming / Tanya",
  },
};

/**
 * Custom Reply Keyboard Persisten (di bawah layar pengguna)
 */
export function getMainReplyKeyboard(): Keyboard {
  return new Keyboard()
    .text("🏗️ ARCHITECTURE.md")
    .text("🎨 DESIGN.md")
    .row()
    .text("🤖 AGENT.md (.cursorrules)")
    .text("🗄️ DATABASE.md")
    .row()
    .text("💬 Mode Brainstorming / Tanya")
    .text("💡 Contoh Ide")
    .row()
    .text("🔄 Reset / Mulai Ulang")
    .resized()
    .persistent();
}

/**
 * Helper untuk mengambil 3 baris teks pertama dokumen untuk preview
 */
function extractPreview(markdown: string): string {
  const lines = markdown
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  const previewSlice = lines.slice(0, 3);
  return previewSlice.length > 0
    ? previewSlice.join("\n")
    : "Spesifikasi arsitektur proyek software terstruktur.";
}

/**
 * Helper untuk mengirim pesan teks panjang secara aman dengan memecah pesan
 * jika melebihi batas 4096 karakter dari Telegram API.
 */
async function sendSafeMessage(
  ctx: any,
  text: string,
  replyMarkup?: InlineKeyboard
): Promise<void> {
  const MAX_CHUNK = 3800; // Buffer aman dari batas 4096 karakter Telegram

  if (text.length <= MAX_CHUNK) {
    try {
      await ctx.reply(text, {
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
      });
    } catch {
      await ctx.reply(text, {
        reply_markup: replyMarkup,
      });
    }
    return;
  }

  // Pecah teks berdasarkan baris / paragraf
  const chunks: string[] = [];
  let currentChunk = "";

  const lines = text.split("\n");
  for (const line of lines) {
    if ((currentChunk + "\n" + line).length > MAX_CHUNK) {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n" + line : line;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  // Kirim setiap potongan secara berurutan
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const markup = isLast ? replyMarkup : undefined;

    try {
      await ctx.reply(chunks[i], {
        parse_mode: "Markdown",
        reply_markup: markup,
      });
    } catch {
      await ctx.reply(chunks[i], {
        reply_markup: markup,
      });
    }
  }
}

/**
 * Pesan Sambutan / Bantuan
 */
const welcomeMessage = `
👋 <b>Selamat datang di VibeDoc Bot!</b> 🚀

Asisten Software Architect & Tech Lead pribadi kamu untuk <i>vibe coding</i>. Gunakan menu keyboard di bawah untuk memilih dokumen teknis yang ingin kamu buat:

📋 <b>Pilihan Dokumen & Fitur:</b>
• 🏗️ <b>ARCHITECTURE.md</b> - Tech stack, ERD Prisma/SQL, API endpoints, MVP Checklist.
• 🎨 <b>DESIGN.md</b> - Color palette (Hex), Typography, Component breakdown, User flows.
• 🤖 <b>AGENT.md (.cursorrules)</b> - Pedoman coding ketat untuk Cursor, Copilot & Windsurf.
• 🗄️ <b>DATABASE.md</b> - Skema lengkap Prisma/SQL, indexing, relasi tabel & sample query.
• 💬 <b>Mode Brainstorming</b> - Diskusi santai, saran scope MVP 1-2 hari, & perbandingan stack.
• 💡 <b>Contoh Ide</b> - Inspirasi template ide proyek siap pakai.

👇 <b>Pilih tombol di menu bawah untuk memulai!</b>
`.trim();

/**
 * Command /start, /help, /menu
 */
bot.command(["start", "help", "menu"], async (ctx) => {
  const userId = ctx.from?.id ?? 0;
  const session = getUserSession(userId);
  session.state = "IDLE";
  delete session.selectedDocType;

  await ctx.reply(welcomeMessage, {
    parse_mode: "HTML",
    reply_markup: getMainReplyKeyboard(),
  });
});

/**
 * Command /reset
 */
bot.command("reset", async (ctx) => {
  const userId = ctx.from?.id ?? 0;
  const session = getUserSession(userId);
  session.state = "IDLE";
  delete session.selectedDocType;

  await ctx.reply("🔄 <b>Sesi berhasil direset ke awal.</b>\nSilakan pilih menu di bawah:", {
    parse_mode: "HTML",
    reply_markup: getMainReplyKeyboard(),
  });
});

/**
 * Handler Tombol: 🔄 Reset / Mulai Ulang
 */
bot.hears("🔄 Reset / Mulai Ulang", async (ctx) => {
  const userId = ctx.from?.id ?? 0;
  const session = getUserSession(userId);
  session.state = "IDLE";
  delete session.selectedDocType;

  await ctx.reply("🔄 <b>Sesi berhasil direset.</b>\nSilakan pilih dokumen yang ingin kamu buat di menu bawah:", {
    parse_mode: "HTML",
    reply_markup: getMainReplyKeyboard(),
  });
});

/**
 * Handler Tombol: 💡 Contoh Ide
 */
bot.hears("💡 Contoh Ide", async (ctx) => {
  const examplesMessage = `
💡 <b>Inspirasi Contoh Ide Proyek Siap Pakai:</b>

Kamu bisa langsung <i>copy</i> salah satu contoh ide di bawah, lalu pilih tombol dokumen di menu bawah untuk membuatnya:

1️⃣ <b>AI Bookmark & Web Summary:</b>
<code>Aplikasi web AI Bookmark Manager dengan Next.js 15, Supabase, Tailwind CSS, dan Groq Llama 3 untuk auto-summary artikel web dan tagging otomatis</code>

2️⃣ <b>SaaS Kasir & Inventaris UMKM:</b>
<code>Aplikasi kasir (POS) dan stok gudang toko kelontong berbasis Next.js App Router, PostgreSQL, Prisma ORM, dan scan barcode kamera</code>

3️⃣ <b>Job Portal Freelance Developer:</b>
<code>Platform pencocokan job freelance developer remote dengan autentikasi GitHub, PostgreSQL, Drizzle ORM, filter tech stack, dan integrasi Midtrans</code>

👇 <i>Pilih salah satu tombol dokumen di menu bawah, lalu kirim ide di atas!</i>
`.trim();

  await ctx.reply(examplesMessage, {
    parse_mode: "HTML",
    reply_markup: getMainReplyKeyboard(),
  });
});

/**
 * Handler Tombol: 💬 Mode Brainstorming / Tanya
 */
bot.hears("💬 Mode Brainstorming / Tanya", async (ctx) => {
  const userId = ctx.from?.id ?? 0;
  const session = getUserSession(userId);
  session.state = "CHAT_MODE";
  session.selectedDocType = "chat";

  const chatWelcome = `
💬 <b>Mode Brainstorming Aktif!</b>

Kamu bebas bertanya apa saja seputar software architecture, minta saran fitur MVP 1-2 hari, perbandingan tech stack (misal: <i>Supabase vs Firebase</i>), atau konsultasi skema database.

Aku akan membalas langsung via pesan chat biasa.

<i>Silakan ketik pertanyaan atau konsep idemu di bawah!</i>
(Tekan tombol menu lain di bawah jika ingin membuat file dokumen fisik atau mereset).
`.trim();

  await ctx.reply(chatWelcome, {
    parse_mode: "HTML",
    reply_markup: getMainReplyKeyboard(),
  });
});

/**
 * Handler Tombol Dokumen Generator:
 * - 🏗️ ARCHITECTURE.md
 * - 🎨 DESIGN.md
 * - 🤖 AGENT.md (.cursorrules)
 * - 🗄️ DATABASE.md
 */
const docButtonMap: Record<string, DocType> = {
  "🏗️ ARCHITECTURE.md": "arch",
  "🎨 DESIGN.md": "design",
  "🤖 AGENT.md (.cursorrules)": "agent",
  "🗄️ DATABASE.md": "db",
};

bot.hears(
  ["🏗️ ARCHITECTURE.md", "🎨 DESIGN.md", "🤖 AGENT.md (.cursorrules)", "🗄️ DATABASE.md"],
  async (ctx) => {
    const text = ctx.message?.text?.trim() || "";
    const docType = docButtonMap[text] || "arch";
    const meta = DOC_META[docType];

    const userId = ctx.from?.id ?? 0;
    const session = getUserSession(userId);
    session.state = "AWAITING_IDEA";
    session.selectedDocType = docType;

    const promptMessage = `
${meta.icon} <b>Mode Pembuatan ${meta.label} Aktif!</b>

Silakan <b>ketik atau tempel ide proyek kamu sekarang</b>. Aku akan langsung buatkan file <code>${meta.filename}</code> yang siap diunduh!

📌 <b>Cakupan Dokumen:</b> ${meta.desc}

<i>Contoh: "Aplikasi web kasir UMKM dengan Next.js, Supabase, dan scanner barcode"</i>
`.trim();

    await ctx.reply(promptMessage, {
      parse_mode: "HTML",
      reply_markup: getMainReplyKeyboard(),
    });
  }
);

/**
 * General Text Message Handler
 * Menangani input ide proyek berdasarkan state sesi pengguna
 */
bot.on("message:text", async (ctx) => {
  if (!ctx.chat) return;

  const text = ctx.message.text.trim();

  // Abaikan command
  if (text.startsWith("/")) return;

  const userId = ctx.from?.id ?? 0;
  const session = getUserSession(userId);

  // 1. JIKA USER SEDANG DALAM STATE 'CHAT_MODE' (Brainstorming)
  if (session.state === "CHAT_MODE") {
    await ctx.replyWithChatAction("typing");
    const statusMsg = await ctx.reply("⚡ <i>Menganalisis ide & menyusun saran arsitektur...</i>", {
      parse_mode: "HTML",
      reply_parameters: { message_id: ctx.message.message_id },
    });

    try {
      const result = await generateGroqContent(text, "chat");

      // Keyboard inline follow-up untuk konversi ke file
      const followUpKeyboard = new InlineKeyboard()
        .text("🏗️ ARCHITECTURE.md", "quick_arch")
        .text("🎨 DESIGN.md", "quick_design")
        .row()
        .text("🗄️ DATABASE.md", "quick_db")
        .text("🤖 AGENT.md", "quick_agent");

      // Simpan ide terakhir di sesi agar bisa langsung di-generate via tombol inline
      session.pendingIdea = text;

      // Kirim hasil chat secara aman (auto-split jika panjang > 4096 karakter)
      await sendSafeMessage(ctx, result.content, followUpKeyboard);

      // Hapus pesan status loading setelah pesan sukses terkirim
      try {
        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
      } catch {}
    } catch (error: unknown) {
      console.error("[Chat Error]:", error);
      const errMsg = error instanceof Error ? error.message : "Terjadi kesalahan.";
      try {
        await ctx.api.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          `❌ <b>Gagal Memproses Diskusi</b>\n\n${errMsg}`,
          { parse_mode: "HTML" }
        );
      } catch {
        await ctx.reply(`❌ <b>Gagal Memproses Diskusi</b>\n\n${errMsg}`, {
          parse_mode: "HTML",
        });
      }
    }
    return;
  }

  // 2. JIKA USER SEDANG DALAM STATE 'AWAITING_IDEA' (Membuat Dokumen Fisik)
  if (session.state === "AWAITING_IDEA") {
    // Validasi panjang ide
    if (text.length < 8) {
      await ctx.reply(
        "⚠️ <b>Deskripsi ide terlalu singkat.</b>\n\nMohon tuliskan minimal 1 kalimat jelas tentang ide proyekmu (contoh: <i>'Web inventaris stok toko kelontong dengan Next.js dan Supabase'</i>).",
        { parse_mode: "HTML" }
      );
      return;
    }

    const docType = session.selectedDocType || "arch";
    const meta = DOC_META[docType];

    await ctx.replyWithChatAction("typing");
    const statusMsg = await ctx.reply(
      `⏳ <b>Sedang meracik ${meta.icon} ${meta.label}...</b>\n<i>${meta.desc}</i>`,
      { parse_mode: "HTML" }
    );

    try {
      const result = await generateGroqContent(text, docType);
      const fileBuffer = Buffer.from(result.content, "utf-8");
      const preview = extractPreview(result.content);

      // Deep link share
      const botUsername = ctx.me.username || "VibeDocbot";
      const shareText = `Saya baru saja merancang spesifikasi ${meta.filename} menggunakan VibeDoc Bot! 🚀 Coba sekarang:`;
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
        `https://t.me/${botUsername}`
      )}&text=${encodeURIComponent(shareText)}`;

      const shareKeyboard = new InlineKeyboard().url("🚀 Bagikan ke Teman", shareUrl);

      await ctx.replyWithChatAction("upload_document");

      const caption = `
${meta.icon} <b>${meta.filename} Siap Diunduh!</b>

🔍 <b>Preview Ringkas:</b>
<code>${preview.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>

📊 <b>Token Terpakai:</b>
• Input: ${result.usage.promptTokens} | Output: ${result.usage.completionTokens}
• Total: <b>${result.usage.totalTokens} tokens</b>

💡 <i>File terlampir siap dibuka langsung di VS Code, Cursor, atau Windsurf.</i>
`.trim();

      await ctx.replyWithDocument(new InputFile(fileBuffer, meta.filename), {
        caption,
        parse_mode: "HTML",
        reply_markup: shareKeyboard,
      });

      // Hapus pesan status loading
      try {
        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
      } catch {}

      // Kembalikan state ke IDLE setelah selesai membuat dokumen
      session.state = "IDLE";
      session.pendingIdea = text;

      await ctx.reply(
        `✅ <b>${meta.filename} berhasil dibuat!</b>\n\nIngin membuat dokumen lainnya untuk proyek ini? Tekan tombol pilihanmu di keyboard bawah:`,
        { parse_mode: "HTML", reply_markup: getMainReplyKeyboard() }
      );
    } catch (error: unknown) {
      console.error(`[Gen Error ${docType}]:`, error);
      const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan pada bot.";
      try {
        await ctx.api.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          `❌ <b>Gagal Menyusun ${meta.label}</b>\n\n${errorMessage}\n\n<i>Silakan coba beberapa saat lagi.</i>`,
          { parse_mode: "HTML" }
        );
      } catch {
        await ctx.reply(`❌ <b>Gagal Menyusun ${meta.label}</b>\n\n${errorMessage}`, {
          parse_mode: "HTML",
        });
      }
    }
    return;
  }

  // 3. JIKA USER SEDANG DALAM STATE 'IDLE' (Kirim teks tanpa pencet tombol menu terlebih dahulu)
  if (text.length >= 8) {
    session.pendingIdea = text;
    const previewText = text.length > 120 ? `${text.slice(0, 117)}...` : text;

    const guideMsg = `
💡 <b>Ide Proyek Diterima!</b>

<blockquote><i>"${previewText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}"</i></blockquote>

Silakan <b>tekan salah satu tombol di menu bawah</b> untuk memilih tipe dokumen yang ingin kamu hasilkan:
• 🏗️ <b>ARCHITECTURE.md</b>
• 🎨 <b>DESIGN.md</b>
• 🤖 <b>AGENT.md (.cursorrules)</b>
• 🗄️ <b>DATABASE.md</b>
• 💬 <b>Mode Brainstorming / Tanya</b>
`.trim();

    await ctx.reply(guideMsg, {
      parse_mode: "HTML",
      reply_parameters: { message_id: ctx.message.message_id },
      reply_markup: getMainReplyKeyboard(),
    });
    return;
  }

  await ctx.reply(
    "Silakan pilih menu dokumen di keyboard bawah atau ketik ide proyek kamu secara lengkap.",
    { reply_markup: getMainReplyKeyboard() }
  );
});

/**
 * Handler Callback Query untuk tombol Quick Generate dari mode chat
 */
bot.callbackQuery(/^quick_(arch|design|agent|db)$/, async (ctx) => {
  if (!ctx.chat) return;

  const docTypeMap: Record<string, DocType> = {
    quick_arch: "arch",
    quick_design: "design",
    quick_agent: "agent",
    quick_db: "db",
  };

  const action = ctx.match[0];
  const docType = docTypeMap[action] || "arch";
  const meta = DOC_META[docType];

  const userId = ctx.from?.id ?? 0;
  const session = getUserSession(userId);

  // Ambil ide dari pendingIdea atau reply_to_message
  let idea = session.pendingIdea;
  if (!idea && ctx.callbackQuery.message?.reply_to_message && "text" in ctx.callbackQuery.message.reply_to_message) {
    idea = ctx.callbackQuery.message.reply_to_message.text;
  }

  if (!idea) {
    await ctx.answerCallbackQuery({
      text: "⚠️ Ide proyek belum tersimpan. Silakan tekan tombol menu di keyboard bawah lalu ketik ide Anda.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({ text: `Menyiapkan ${meta.label}...` });
  await ctx.replyWithChatAction("typing");

  const statusMsg = await ctx.reply(
    `⏳ <b>Sedang menyusun ${meta.icon} ${meta.label} dari ide diskusi...</b>`,
    { parse_mode: "HTML" }
  );

  try {
    const result = await generateGroqContent(idea, docType);
    const fileBuffer = Buffer.from(result.content, "utf-8");
    const preview = extractPreview(result.content);

    const botUsername = ctx.me.username || "VibeDocbot";
    const shareText = `Saya baru saja merancang ${meta.filename} dengan VibeDoc Bot! 🚀 Coba sekarang:`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
      `https://t.me/${botUsername}`
    )}&text=${encodeURIComponent(shareText)}`;

    const shareKeyboard = new InlineKeyboard().url("🚀 Bagikan ke Teman", shareUrl);

    await ctx.replyWithChatAction("upload_document");

    const caption = `
${meta.icon} <b>${meta.filename} Siap Diunduh!</b>

🔍 <b>Preview Ringkas:</b>
<code>${preview.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>

📊 <b>Token Terpakai:</b> ${result.usage.totalTokens} tokens

💡 <i>File terlampir siap dibuka langsung di VS Code / Cursor.</i>
`.trim();

    await ctx.replyWithDocument(new InputFile(fileBuffer, meta.filename), {
      caption,
      parse_mode: "HTML",
      reply_markup: shareKeyboard,
    });

    try {
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
    } catch {}
  } catch (error: unknown) {
    console.error("[Quick Gen Error]:", error);
    const msg = error instanceof Error ? error.message : "Terjadi kesalahan.";
    try {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `❌ <b>Gagal Menyusun ${meta.label}</b>\n\n${msg}`,
        { parse_mode: "HTML" }
      );
    } catch {
      await ctx.reply(`❌ Gagal: ${msg}`);
    }
  }
});

/**
 * Global Error Handler untuk menangani error runtime grammY
 */
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`[Global Error] Update ${ctx.update.update_id} error:`, err.error);

  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Telegram API Error:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Telegram Network HTTP Error:", e);
  } else {
    console.error("Unknown Error:", e);
  }
});

let isStopping = false;

/**
 * Graceful Shutdown
 */
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
for (const signal of signals) {
  process.once(signal, () => {
    isStopping = true;
    console.log(`\n🛑 Menerima sinyal ${signal}. Menghentikan VibeDoc Bot secara aman...`);
    try {
      bot.stop();
    } catch {}
  });
}

/**
 * Tangani uncaught errors pada level process agar tidak langsung exit mendadak
 */
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ [Process Unhandled Rejection]:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("⚠️ [Process Uncaught Exception]:", error);
});

/**
 * Jalankan Bot menggunakan Polling dengan mekanisme Auto-Reconnect
 */
async function start() {
  while (!isStopping) {
    try {
      const botInfo = await bot.api.getMe();
      console.log("=========================================");
      console.log(`🤖 VibeDoc Bot (Reply Keyboard & State Machine) Aktif!`);
      console.log(`👤 Username: @${botInfo.username}`);
      console.log(`⚡ LLM: Groq (Multi-Prompt Router)`);
      console.log(`🚀 Mode: Long Polling`);
      console.log("=========================================");

      await bot.start({
        onStart: (info) => {
          console.log(`✅ Polling aktif untuk @${info.username}`);
        },
      });
    } catch (err) {
      if (isStopping) break;
      console.error("❌ Kendala koneksi/polling pada Telegram Bot:", err);
      console.log("⏳ Mencoba menyambung kembali ke Telegram dalam 5 detik...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

start();
