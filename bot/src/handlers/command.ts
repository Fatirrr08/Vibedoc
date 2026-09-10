import type { Context } from "grammy";

export async function handleStart(ctx: Context): Promise<void> {
  const userName = ctx.from?.first_name || "Developer";

  const message = `
👋 Halo, <b>${userName}</b>! Selamat datang di <b>VibeDoc Bot</b> 🚀

Saya adalah asisten Software Architect pribadi kamu untuk <i>vibe coding</i>. Cukup kirimkan ide proyek software kamu, dan saya akan merancangnya menjadi dokumen spesifikasi teknis lengkap yang siap pakai!

📋 <b>Dokumen yang Dihasilkan Meliputi:</b>
1. Project Overview & Core Value
2. Architecture & Tech Stack (dengan diagram Mermaid)
3. Core Features & Scope MVP
4. Database Schema / Data Structure
5. API Spec & Key Workflows
6. Step-by-Step Implementation Guide
7. Conventions & Folder Structure

💡 <b>Cara Pakai:</b>
Langsung ketik dan kirimkan konsep ide kamu di chat ini.

<i>Contoh:</i>
<code>Aplikasi web AI Bookmark manager dengan Next.js 15, Supabase, Tailwind CSS, dan Gemini API untuk auto-summary artikel web</code>

Ketik /help untuk panduan lebih lanjut.
`.trim();

  await ctx.reply(message, { parse_mode: "HTML" });
}

export async function handleHelp(ctx: Context): Promise<void> {
  const message = `
📖 <b>Panduan Penggunaan VibeDoc Bot</b>

<b>Tips mendapatkan hasil dokumen terbaik:</b>
1. <b>Sebutkan Domain/Ide Utama:</b> Apa masalah yang diselesaikan?
2. <b>Sebutkan Tech Stack (Opsional):</b> Misal Next.js, Go, Flutter, PostgreSQL. Jika tidak disebutkan, bot akan merekomendasikan stack modern terbaik.
3. <b>Sebutkan Target Pengguna:</b> Misal: solo creator, UMKM, developer.

<b>Fitur Bot:</b>
• 📄 <b>Download Langsung:</b> Dokumen langsung dikirim sebagai attachment <code>.md</code>.
• 🔄 <b>Format PRD & README:</b> Bisa diunduh sebagai <code>PRD.md</code> atau <code>README.md</code>.
• 🚀 <b>Share ke Teman:</b> Bagikan bot dan ide proyek ke rekan tim kamu.

Ketik atau tempel ide proyek kamu sekarang untuk mencoba!
`.trim();

  await ctx.reply(message, { parse_mode: "HTML" });
}
