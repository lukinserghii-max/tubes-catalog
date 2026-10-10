import manifest from "@/data/ai-images.json";

// Запис маніфесту, який формує scripts/generate_product_images.mjs
export type AiImage = { src: string; model: string; mode: "generate" | "edit"; prompt: string; page: number; createdAt: string };

const images = manifest as Record<string, AiImage>;

export function getAiImage(slug: string): AiImage | undefined {
  return images[slug];
}

// Картинка для картки: AI-версія, якщо фото з PDF немає або воно було очищене через --edit
export function cardImage(slug: string, pdfImage: string): { image: string; aiImage: boolean } {
  const ai = images[slug];
  if (ai && (!pdfImage || ai.mode === "edit")) return { image: ai.src, aiImage: true };
  return { image: pdfImage, aiImage: false };
}
