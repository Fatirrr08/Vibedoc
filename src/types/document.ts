import { z } from "zod";

export const generateDocSchema = z.object({
  idea: z
    .string()
    .trim()
    .min(5, "Deskripsi ide proyek minimal 5 karakter.")
    .max(3000, "Deskripsi ide proyek maksimal 3000 karakter."),
  techPreferences: z.string().trim().max(500).optional().default(""),
  targetAudience: z.string().trim().max(500).optional().default(""),
});

export type GenerateDocInput = z.infer<typeof generateDocSchema>;

export interface GenerateDocErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: unknown;
}
