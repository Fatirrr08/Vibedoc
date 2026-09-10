import { GoogleGenAI } from "@google/genai";
import { ARCHITECT_SYSTEM_PROMPT, buildArchitectPrompt } from "./prompt.js";

const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
let cachedAi: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY belum dikonfigurasi pada environment bot. Silakan isi file .env terlebih dahulu."
    );
  }

  if (!cachedAi) {
    cachedAi = new GoogleGenAI({ apiKey });
  }

  return cachedAi;
}

/**
 * Memanggil Gemini API untuk menghasilkan dokumen spesifikasi teknis Markdown.
 */
export async function generateProjectSpec(rawIdea: string): Promise<string> {
  const ai = getAiClient();

  try {
    const prompt = buildArchitectPrompt(rawIdea);

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        systemInstruction: ARCHITECT_SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text || text.trim().length === 0) {
      throw new Error("Gemini mengembalikan teks kosong.");
    }

    return text.trim();
  } catch (err: unknown) {
    console.error("Error saat memanggil Gemini API:", err);

    if (err instanceof Error) {
      if (err.message.includes("429") || err.message.toLowerCase().includes("rate limit")) {
        throw new Error(
          "Kuota request Gemini API sedang penuh (Rate Limit). Silakan coba lagi dalam 1-2 menit."
        );
      }
      if (err.message.includes("API key not valid") || err.message.includes("403")) {
        throw new Error(
          "GEMINI_API_KEY tidak valid atau tidak memiliki izin akses. Cek konfigurasi key Anda."
        );
      }
      throw new Error(`Gagal memproses AI: ${err.message}`);
    }

    throw new Error("Terjadi kesalahan tidak terduga saat menghubungi AI service.");
  }
}
