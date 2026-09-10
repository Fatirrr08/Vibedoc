import Groq from "groq-sdk";
import { DocType, getSystemPrompt, buildUserPrompt } from "./prompt.js";

export interface GroqTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GroqGenerationResult {
  content: string;
  docType: DocType;
  usage: GroqTokenUsage;
}

let cachedGroq: Groq | null = null;

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "gsk_your_groq_api_key_here") {
    throw new Error(
      "GROQ_API_KEY belum dikonfigurasi. Dapatkan API key di https://console.groq.com/keys lalu isi di file .env."
    );
  }

  if (!cachedGroq) {
    cachedGroq = new Groq({ apiKey });
  }

  return cachedGroq;
}

/**
 * Memanggil Groq Cloud API dengan pemilihan System Prompt dinamis
 * sesuai tipe dokumen ('arch' | 'design' | 'agent' | 'chat').
 */
export async function generateGroqContent(
  rawIdea: string,
  docType: DocType = "arch"
): Promise<GroqGenerationResult> {
  const groq = getGroqClient();
  const requestedModel = process.env.GROQ_MODEL || "groq/compound";
  const candidateModels = [
    requestedModel,
    "groq/compound",
    "groq/compound-mini",
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
  ];

  const uniqueModels = Array.from(new Set(candidateModels));
  const systemPrompt = getSystemPrompt(docType);
  const userPrompt = buildUserPrompt(rawIdea, docType);

  // Sesuaikan parameter berdasarkan mode (chat vs dokumen teknis)
  const isChat = docType === "chat";
  const temperature = isChat ? 0.5 : 0.2;
  const maxTokens = isChat ? 1500 : 2200;

  try {
    let lastError: unknown = null;

    for (const model of uniqueModels) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          temperature,
          max_completion_tokens: maxTokens,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
        });

        const choice = completion.choices?.[0];
        const content = choice?.message?.content?.trim();

        if (!content) {
          throw new Error("Groq tidak mengembalikan output konten teks.");
        }

        const usage: GroqTokenUsage = {
          promptTokens: completion.usage?.prompt_tokens ?? 0,
          completionTokens: completion.usage?.completion_tokens ?? 0,
          totalTokens: completion.usage?.total_tokens ?? 0,
        };

        return {
          content,
          docType,
          usage,
        };
      } catch (err: unknown) {
        lastError = err;
        const errStr = err instanceof Error ? err.message.toLowerCase() : "";

        // Jika model 404 (tidak tersedia) ATAU 429 (rate limit habis), otomatis coba model cadangan berikutnya
        if (
          errStr.includes("404") ||
          errStr.includes("model_not_found") ||
          errStr.includes("does not exist") ||
          errStr.includes("429") ||
          errStr.includes("rate_limit_exceeded") ||
          errStr.includes("rate limit")
        ) {
          console.warn(
            `[Groq Warning] Model "${model}" terkena kendala (rate limit / not found). Mencoba fallback model berikutnya...`
          );
          continue;
        }

        // Jika error fatal (misal API key 401 tidak valid), langsung lempar
        throw err;
      }
    }

    throw lastError;
  } catch (error: unknown) {
    console.error("[Groq API Error]:", error);

    if (error instanceof Error) {
      const errLower = error.message.toLowerCase();

      // Tangani HTTP 429 (Rate limit)
      if (
        errLower.includes("429") ||
        errLower.includes("rate limit") ||
        errLower.includes("rate_limit_exceeded")
      ) {
        throw new Error(
          "⏳ Kuota request Groq API sedang mencapai batas (Rate Limit). Silakan tunggu sekitar 1 menit sebelum mencoba lagi."
        );
      }

      // Tangani error API key (401 / Unauthorized)
      if (
        errLower.includes("401") ||
        errLower.includes("invalid api key") ||
        errLower.includes("unauthorized")
      ) {
        throw new Error(
          "🔑 GROQ_API_KEY tidak valid atau kadaluarsa. Pastikan API key di file .env sudah benar."
        );
      }

      // Tangani downtime / service unavailable (500 / 503)
      if (
        errLower.includes("500") ||
        errLower.includes("503") ||
        errLower.includes("service unavailable")
      ) {
        throw new Error(
          "🛠️ Server Groq sedang mengalami gangguan sementara. Silakan coba kembali sesaat lagi."
        );
      }

      throw new Error(`Gagal memproses AI: ${error.message}`);
    }

    throw new Error("Terjadi kesalahan tidak terduga saat menghubungi layanan Groq AI.");
  }
}
