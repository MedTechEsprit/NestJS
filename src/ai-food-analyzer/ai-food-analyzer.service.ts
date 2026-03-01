import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { NutritionService } from '../nutrition/nutrition.service';
import { GlucoseService } from '../glucose/glucose.service';
import { MealSource } from '../nutrition/schemas/meal.schema';

const FASTAPI_ANALYZER_URL = 'http://localhost:8000/analyze-image';
const FASTAPI_CHAT_URL = 'http://127.0.0.1:8001/chat';
const GLUCOSE_FETCH_LIMIT = 50;

export interface ImageAnalysisResult {
  food_name: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  health_note: string;
}

export interface FoodAnalyzerResponse {
  meal: {
    id: string;
    name: string;
    eatenAt: Date;
    calories: number | undefined;
    carbs: number;
    protein: number | undefined;
    fat: number | undefined;
    note: string | undefined;
    source: MealSource;
    confidence: number | undefined;
  };
  image_analysis: ImageAnalysisResult;
  ai_advice: string;
}

@Injectable()
export class AiFoodAnalyzerService {
  private readonly logger = new Logger(AiFoodAnalyzerService.name);

  constructor(
    private readonly nutritionService: NutritionService,
    private readonly glucoseService: GlucoseService,
  ) {}

  async analyzeAndSave(
    patientId: string,
    imageUrl: string,
    userMessage?: string,
  ): Promise<FoodAnalyzerResponse> {
    // ── 1. Call FastAPI image analyzer ─────────────────────────────────
    const analysis = await this.callImageAnalyzer(imageUrl);

    // ── 2. Persist the meal in MongoDB with source = 'ai' ──────────────
    const savedMeal = await this.nutritionService.createMeal(patientId, {
      name: analysis.food_name,
      eatenAt: new Date(),
      carbs: analysis.carbs ?? 0,
      protein: analysis.protein ?? undefined,
      fat: analysis.fat ?? undefined,
      calories: analysis.calories ?? undefined,
      note: analysis.health_note
        ? `[AI] ${analysis.health_note}`
        : '[AI analysé]',
      source: MealSource.AI,
      confidence: 90, // FastAPI analysis is considered high confidence
    });

    // ── 3. Fetch recent glucose records for personalized AI advice ──────
    const glucoseResult = await this.glucoseService.findMyRecords(patientId, {
      page: 1,
      limit: GLUCOSE_FETCH_LIMIT,
    });

    const glucoseRecords = glucoseResult.data.map((r) => ({
      value: r.value,
      measuredAt: r.measuredAt,
      period: r.period ?? null,
      note: r.note ?? null,
    }));

    // ── 4. Build AI chat prompt combining image analysis + user message ─
    const prompt =
      `Food analyzed: ${analysis.food_name}. ` +
      `Nutritional values — calories: ${analysis.calories ?? 'N/A'}, ` +
      `carbs: ${analysis.carbs}g, protein: ${analysis.protein ?? 'N/A'}g, ` +
      `fat: ${analysis.fat ?? 'N/A'}g. ` +
      `Health note from analyzer: "${analysis.health_note}". ` +
      (userMessage ? `User question: "${userMessage}". ` : '') +
      `Based on the patient's glucose records above, give concise diabetic-aware dietary advice.`;

    const aiAdvice = await this.callAiChat(prompt, glucoseRecords);

    // ── 5. Return combined response ─────────────────────────────────────
    return {
      meal: {
        id: String((savedMeal as any)._id),
        name: savedMeal.name,
        eatenAt: savedMeal.eatenAt,
        calories: savedMeal.calories,
        carbs: savedMeal.carbs,
        protein: savedMeal.protein,
        fat: savedMeal.fat,
        note: savedMeal.note,
        source: savedMeal.source,
        confidence: savedMeal.confidence,
      },
      image_analysis: analysis,
      ai_advice: aiAdvice,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /**
   * Downloads the image from the URL into memory, base64-encodes it, then
   * sends it to the FastAPI analyzer as { image_base64: "..." }.
   * No temp files, no shared filesystem — works across separate machines.
   */
  private async callImageAnalyzer(imageUrl: string): Promise<ImageAnalysisResult> {
    // ── Step 1: download image into memory ──────────────────────────────
    let base64Image: string;
    try {
      const response = await axios.get<ArrayBuffer>(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 20_000,
      });
      base64Image = Buffer.from(response.data).toString('base64');
    } catch (error) {
      this.logger.error(`Failed to download image from URL: ${imageUrl} — ${error}`);
      throw new HttpException(
        'Could not download the provided image URL. Please check the URL and try again.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // ── Step 2: send base64 to FastAPI ───────────────────────────────────
    let rawData: unknown;
    try {
      const { data } = await axios.post(
        FASTAPI_ANALYZER_URL,
        { image_base64: base64Image },
        { timeout: 60_000, headers: { 'Content-Type': 'application/json' } },
      );
      rawData = data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosErr = error as AxiosError;
        if (!axiosErr.response) {
          this.logger.error(`Image analyzer unreachable: ${axiosErr.message}`);
          throw new HttpException(
            'Image analyzer service is currently unavailable.',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        this.logger.error(
          `Image analyzer error ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data)}`,
        );
        throw new HttpException(
          'Image analyzer returned an error.',
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw new HttpException(
        'Unexpected error calling image analyzer.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.debug(`Image analyzer raw response: ${JSON.stringify(rawData)}`);

    // ── Step 3: unwrap { "analysis": {...} } and validate ────────────────
    if (!rawData || typeof rawData !== 'object') {
      throw new HttpException(
        'Image analyzer returned an invalid response.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const outer = rawData as Record<string, unknown>;

    // FastAPI wraps result in { "analysis": { food_name, ... } }
    const inner =
      outer['analysis'] && typeof outer['analysis'] === 'object'
        ? (outer['analysis'] as Record<string, unknown>)
        : outer; // fall back to flat shape for compatibility

    if (typeof inner['food_name'] !== 'string') {
      this.logger.error(
        `Missing food_name in analyzer response: ${JSON.stringify(rawData)}`,
      );
      throw new HttpException(
        'Image analyzer returned an invalid response — missing food_name.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      food_name: (inner['food_name'] as string) || 'Unknown food',
      calories: Number(inner['calories'] ?? 0),
      carbs: Number(inner['carbs'] ?? 0),
      protein: Number(inner['protein'] ?? 0),
      fat: Number(inner['fat'] ?? 0),
      health_note: String(inner['health_note'] ?? ''),
    };
  }

  private async callAiChat(
    prompt: string,
    glucoseRecords: object[],
  ): Promise<string> {
    try {
      const { data } = await axios.post(
        FASTAPI_CHAT_URL,
        { user_message: prompt, glucose_records: glucoseRecords },
        { timeout: 30_000, headers: { 'Content-Type': 'application/json' } },
      );

      if (!data) return 'No AI advice available.';

      if (typeof data === 'string' && data.trim()) return data.trim();

      if (typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        const text =
          obj['response'] ?? obj['message'] ?? obj['answer'] ?? obj['text'];
        if (typeof text === 'string' && text.trim()) return text.trim();
      }

      return 'No AI advice available.';
    } catch (error) {
      // AI advice is optional — log but don't fail the whole request
      if (axios.isAxiosError(error)) {
        this.logger.warn(`AI chat call failed: ${error.message}`);
      }
      return 'AI advice unavailable at the moment.';
    }
  }
}
