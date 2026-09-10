import { Context, InputFile, InlineKeyboard } from "grammy";
import { generateProjectSpec } from "../gemini.js";
import type { GeneratedDocCache } from "../types.js";

// Cache in-memory sederhana untuk dokumen yang baru dibuat (maks 100 entri)
const docCache = new Map<string, GeneratedDocCache>();

function cleanDocCache() {
  if (docCache.size > 100) {
    const oldestKey = docCache.keys().next().value;
    if (oldestKey) docCache.delete(oldestKey);
  }
}

function extractProjectTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].replace(/Project Overview & Objective/i, "VibeDoc Project").trim();
  }
  return "Project Spec";
}

function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30);
}

/**
 * Handler utama saat pengguna mengirim pesan teks berisi ide proyek.
 */
export async function handleTextMessage(ctx: Context): Promise<void> {
  if (!ctx.chat) return;

  const text = ctx.message?.text?.trim();

  // Validasi input
  if (!text) {
    await ctx.reply("⚠️ Mohon kirimkan deskripsi teks untuk ide proyek Anda.");
    return;
  }

  // Abaikan pesan yang merupakan command
  if (text.startsWith("/")) {
    return;
  }

  if (text.length < 5) {
    await ctx.reply(
      "⚠️ Ide proyek terlalu singkat. Mohon jelaskan ide kamu minimal 1 kalimat (contoh: <i>'Web kasir UMKM berbasis Next.js dan Supabase'</i>).",
      { parse_mode: "HTML" }
    );
    return;
  }

  // Tampilkan feedback loading ke pengguna
  await ctx.replyWithChatAction("typing");
  const statusMessage = await ctx.reply(
    "⚡ <i>Menganalisis konsep dan merancang arsitektur software dengan Gemini 2.5 Flash...</i>",
    { parse_mode: "HTML" }
  );

  try {
    const markdown = await generateProjectSpec(text);
    const title = extractProjectTitle(markdown);
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Simpan ke memory cache
    cleanDocCache();
    docCache.set(docId, {
      id: docId,
      title,
      markdown,
      createdAt: Date.now(),
    });

    const fileBuffer = Buffer.from(markdown, "utf-8");
    const charCount = markdown.length;
    const estTokens = Math.ceil(charCount / 4);

    // Dapatkan username bot untuk URL share
    const botUsername = ctx.me?.username || "VibeDocBot";
    const shareText = `Saya baru saja membuat arsitektur teknis proyek "${title}" dengan VibeDoc Bot! 🚀 Coba botnya sekarang:`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${botUsername}`)}&text=${encodeURIComponent(shareText)}`;

    // Buat Inline Keyboard
    const keyboard = new InlineKeyboard()
      .text("📄 Unduh PRD.md", `dl_prd:${docId}`)
      .text("📘 Unduh README.md", `dl_readme:${docId}`)
      .row()
      .url("🚀 Share ke Teman", shareUrl);

    // Update status action ke upload_document
    await ctx.replyWithChatAction("upload_document");

    // Kirim attachment file dokumen langsung ke chat
    await ctx.replyWithDocument(new InputFile(fileBuffer, "PRD.md"), {
      caption: `
✅ <b>Dokumen Arsitektur Siap!</b>

📌 <b>Proyek:</b> ${title}
📊 <b>Ukuran:</b> ${charCount} karakter (~${estTokens} tokens)
⚡ <b>Engine:</b> Gemini 2.5 Flash

File <code>PRD.md</code> terlampir di atas dan siap dibuka di VS Code / Cursor / Windsurf.
Gunakan tombol di bawah untuk mengunduh varian lain atau membagikannya.
`.trim(),
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    // Hapus pesan status loading
    try {
      await ctx.api.deleteMessage(ctx.chat.id, statusMessage.message_id);
    } catch {
      // Abaikan jika pesan status sudah dihapus
    }
  } catch (error: unknown) {
    console.error("Gagal memproses ide pengguna:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan pada server bot.";

    // Edit pesan status menjadi pesan error
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      `❌ <b>Gagal Menyusun Dokumen</b>\n\n${errorMessage}\n\n<i>Silakan coba beberapa saat lagi atau ubah sedikit deskripsi ide Anda.</i>`,
      { parse_mode: "HTML" }
    );
  }
}

/**
 * Handler callback query untuk tombol unduh varian file.
 */
export async function handleDownloadCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const [action, docId] = data.split(":");
  const doc = docCache.get(docId);

  if (!doc) {
    await ctx.answerCallbackQuery({
      text: "Sesi file telah kedaluwarsa. Silakan kirimkan ide Anda kembali.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({ text: "Menyiapkan berkas..." });
  await ctx.replyWithChatAction("upload_document");

  const buffer = Buffer.from(doc.markdown, "utf-8");
  const filename = action === "dl_readme" ? "README.md" : "PRD.md";

  await ctx.replyWithDocument(new InputFile(buffer, filename), {
    caption: `📁 Berkas <code>${filename}</code> untuk proyek <b>${doc.title}</b>`,
    parse_mode: "HTML",
  });
}
