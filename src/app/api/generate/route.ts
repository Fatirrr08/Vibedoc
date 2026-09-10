import { NextRequest } from "next/server";
import { getGeminiClient, DEFAULT_GEMINI_MODEL } from "@/lib/gemini";
import { ARCHITECT_SYSTEM_PROMPT, buildArchitectUserPrompt } from "@/lib/prompts/architect-prompt";
import { generateDocSchema } from "@/types/document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return Response.json(
        {
          success: false,
          error: "INVALID_BODY",
          message: "Request body harus berupa JSON yang valid.",
        },
        { status: 400 }
      );
    }

    const validation = generateDocSchema.safeParse(body);
    if (!validation.success) {
      return Response.json(
        {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Format input tidak valid.",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const inputData = validation.data;
    const client = getGeminiClient();
    const userPrompt = buildArchitectUserPrompt(inputData);

    const responseStream = await client.models.generateContentStream({
      model: DEFAULT_GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      config: {
        systemInstruction: ARCHITECT_SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (streamError) {
          console.error("Stream generation error:", streamError);
          controller.error(streamError);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error: unknown) {
    console.error("API /api/generate error:", error);
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan internal pada server.";

    return Response.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message,
      },
      { status: 500 }
    );
  }
}
