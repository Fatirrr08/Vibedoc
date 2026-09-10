export interface BotConfig {
  botToken: string;
  geminiApiKey: string;
  geminiModel: string;
}

export interface GeneratedDocCache {
  id: string;
  title: string;
  markdown: string;
  createdAt: number;
}
