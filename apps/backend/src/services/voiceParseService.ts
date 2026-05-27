import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../lib/prisma';

const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'] as const;
type Condition = (typeof CONDITIONS)[number];

export interface VoiceParseResult {
  transcript: string;
  detectedLanguage: string;
  title: string;
  description: string;
  price: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  condition: Condition | null;
}

let cachedClient: OpenAI | null = null;
function getClient(): OpenAI {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AppError(
        503,
        'VOICE_PARSE_UNAVAILABLE',
        'Voice parsing is not configured on the server',
      );
    }
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}

/**
 * Transcribe an audio buffer using Whisper. Auto-detects German or English.
 * Returns the raw transcript and the detected language code.
 */
async function transcribe(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<{ text: string; language: string }> {
  const client = getClient();
  const file = await toFile(buffer, filename, { type: mimeType });

  // verbose_json gives us the detected language for later validation/logging.
  const response = await client.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'verbose_json',
    // Restrict auto-detect to the two supported languages by providing a prompt hint.
    // (Whisper's `language` param forces a single language — we want auto-detect,
    // so we instead leave it unset and rely on the model to pick DE or EN from audio.)
    prompt:
      'Transcribe accurately. The speaker may use English or German to describe a marketplace item, its condition, and price.',
    temperature: 0,
  });

  // verbose_json shape: { text, language, ... }
  const text = (response as unknown as { text: string }).text;
  const language = (response as unknown as { language?: string }).language ?? 'en';
  return { text, language };
}

/**
 * Use GPT to extract structured listing fields from a free-form transcript.
 * Returns nullable fields when the transcript does not contain the info.
 */
async function extractFields(
  transcript: string,
  categories: { id: string; name: string; slug: string }[],
): Promise<{
  title: string;
  description: string;
  price: string | null;
  categorySlug: string | null;
  condition: Condition | null;
}> {
  const client = getClient();

  const categoryList = categories.map((c) => `- ${c.slug} (${c.name})`).join('\n');

  const systemPrompt = `You extract second-hand marketplace listing fields from a user's spoken description.
The user speaks English or German. Always reply with the listing fields in the same language as the transcript.

Return ONLY valid JSON matching this schema (no markdown, no commentary):
{
  "title": string,         // 3-100 chars, short headline (e.g. "Blue Schneider Pen")
  "description": string,   // 10-1000 chars, item description in the same language as the transcript
  "price": string | null,  // numeric string with dot decimal (e.g. "2.00"). null if the user did not mention a price.
  "categorySlug": string | null, // exactly one slug from the list below, or null if none clearly fits
  "condition": "NEW" | "LIKE_NEW" | "GOOD" | "FAIR" | "POOR" | null
}

Condition guide:
- NEW: never used / brand new / nagelneu / unbenutzt
- LIKE_NEW: used once or twice / wie neu
- GOOD: used but works fine / gut / in gutem Zustand
- FAIR: visible wear / okay
- POOR: heavily worn / kaputt / defekt

Price guide: strip currency symbols. "2€" -> "2.00". "around 50 dollars" -> "50.00". If unclear, return null.

Available category slugs:
${categoryList}

If no category clearly fits, use "other" if it is in the list, otherwise null.`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Transcript:\n"""${transcript}"""` },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new AppError(502, 'VOICE_PARSE_FAILED', 'Voice parsing returned an empty result');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError(502, 'VOICE_PARSE_FAILED', 'Voice parsing returned invalid JSON');
  }

  const title = typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 100) : '';
  const description =
    typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 1000) : '';

  const rawPrice = parsed.price;
  let price: string | null = null;
  if (typeof rawPrice === 'string' && rawPrice.trim() !== '') {
    const normalized = rawPrice.replace(',', '.').replace(/[^\d.]/g, '');
    const n = Number(normalized);
    if (!isNaN(n) && n >= 0) {
      price = n.toFixed(2);
    }
  } else if (typeof rawPrice === 'number' && rawPrice >= 0) {
    price = rawPrice.toFixed(2);
  }

  const rawCategorySlug = parsed.categorySlug;
  let categorySlug: string | null = null;
  if (typeof rawCategorySlug === 'string') {
    const match = categories.find((c) => c.slug === rawCategorySlug);
    if (match) categorySlug = match.slug;
  }

  const rawCondition = parsed.condition;
  let condition: Condition | null = null;
  if (typeof rawCondition === 'string' && (CONDITIONS as readonly string[]).includes(rawCondition)) {
    condition = rawCondition as Condition;
  }

  return { title, description, price, categorySlug, condition };
}

/**
 * Full pipeline: audio buffer -> transcript -> structured listing fields.
 */
export async function parseVoiceListing(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<VoiceParseResult> {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });

  const { text: transcript, language } = await transcribe(buffer, filename, mimeType);

  if (!transcript || transcript.trim().length < 2) {
    throw new AppError(
      400,
      'VOICE_PARSE_EMPTY',
      'Could not detect speech in the recording. Please try again.',
    );
  }

  const fields = await extractFields(transcript, categories);

  const matchedCategory = fields.categorySlug
    ? (categories.find((c) => c.slug === fields.categorySlug) ?? null)
    : null;

  return {
    transcript,
    detectedLanguage: language,
    title: fields.title,
    description: fields.description,
    price: fields.price,
    categoryId: matchedCategory?.id ?? null,
    categorySlug: matchedCategory?.slug ?? null,
    condition: fields.condition,
  };
}
