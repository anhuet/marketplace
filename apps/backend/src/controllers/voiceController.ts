import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { parseVoiceListing } from '../services/voiceParseService';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // OpenAI Whisper hard limit

/**
 * POST /api/v1/listings/voice-parse
 * Accepts an audio recording (multipart/form-data, field: `audio`) describing
 * a listing in English or German. Runs Whisper + GPT to extract structured
 * fields (title, description, price, category, condition).
 * Auth required: Yes
 */
export async function parseVoiceListingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const file = req.file as Express.Multer.File | undefined;

    if (!file) {
      throw new AppError(400, 'VALIDATION_ERROR', 'No audio file provided');
    }
    if (file.size > MAX_AUDIO_BYTES) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Audio file must not exceed 25 MB');
    }
    if (!file.mimetype.startsWith('audio/') && !file.mimetype.startsWith('video/')) {
      // Some mobile recorders report video/mp4 even for audio-only m4a — accept both.
      throw new AppError(400, 'VALIDATION_ERROR', 'Only audio recordings are accepted');
    }

    const result = await parseVoiceListing(file.buffer, file.originalname, file.mimetype);

    res.json(result);
  } catch (err) {
    next(err);
  }
}
