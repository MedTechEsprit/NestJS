import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NutritionService } from '../nutrition/nutrition.service';
import { GlucoseService } from '../glucose/glucose.service';
import { PatientsService } from '../patients/patients.service';
import { AiPredictionService } from '../ai-prediction/ai-prediction.service';
import { MealSource } from '../nutrition/schemas/meal.schema';
import {
  AiFoodAnalysis,
  AiFoodAnalysisDocument,
  DetailedAdvice,
} from './schemas/ai-food-analysis.schema';

/** Subset of patient data used to personalise the AI prompt */
interface PatientContext {
  typeDiabete?: string;
  sexe?: string;
  poids?: number;
  taille?: number;
  dernierHba1c?: number;
  glycemieAJeunMoyenne?: number;
  prendInsuline?: boolean;
  typeInsuline?: string;
  doseQuotidienneInsuline?: number;
  antidiabetiquesOraux?: string[];
  traitements?: string[];
  hypertension?: boolean;
  maladiesCardiovasculaires?: boolean;
  problemesRenaux?: boolean;
  hypoglycemiesFrequentes?: boolean;
}

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llava';
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
  /** MongoDB _id of the AiFoodAnalysis document saved for this meal */
  aiAnalysisId: string | null;
}

@Injectable()
export class AiFoodAnalyzerService {
  private readonly logger = new Logger(AiFoodAnalyzerService.name);

  constructor(
    @InjectModel(AiFoodAnalysis.name)
    private readonly aiFoodAnalysisModel: Model<AiFoodAnalysisDocument>,
    private readonly nutritionService: NutritionService,
    private readonly glucoseService: GlucoseService,
    private readonly patientsService: PatientsService,
    private readonly aiPredictionService: AiPredictionService,
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

    // ── 3. Fetch glucose records + patient profile in parallel ─────────
    const [glucoseResult, patientRaw] = await Promise.all([
      this.glucoseService.findMyRecords(patientId, { page: 1, limit: GLUCOSE_FETCH_LIMIT }),
      this.patientsService.findOne(patientId).catch(() => null),
    ]);

    const glucoseRecords: { value: number; measuredAt: Date; period: string | null; note?: string | null }[] =
      glucoseResult.data.map((r) => ({
        value: r.value,
        measuredAt: r.measuredAt,
        period: r.period ?? null,
        note: r.note ?? null,
      }));

    // Extract relevant patient fields for the prompt
    const pm = (patientRaw as any)?.profilMedical ?? {};
    const patientCtx: PatientContext = {
      typeDiabete:            (patientRaw as any)?.typeDiabete,
      sexe:                   (patientRaw as any)?.sexe,
      poids:                  pm.poids,
      taille:                 pm.taille,
      dernierHba1c:           pm.dernierHba1c,
      glycemieAJeunMoyenne:   pm.glycemieAJeunMoyenne,
      prendInsuline:          pm.prendInsuline,
      typeInsuline:           pm.typeInsuline,
      doseQuotidienneInsuline: pm.doseQuotidienneInsuline,
      antidiabetiquesOraux:   pm.antidiabetiquesOraux,
      traitements:            pm.traitements,
      hypertension:           pm.hypertension,
      maladiesCardiovasculaires: pm.maladiesCardiovasculaires,
      problemesRenaux:        pm.problemesRenaux,
      hypoglycemiesFrequentes: pm.hypoglycemiesFrequentes,
    };

    // ── 4. Generate personalised AI advice ──────────────────────────────
    const { detailedAdvice, isFallback } = await this.generateDetailedAdvice(
      analysis,
      glucoseRecords,
      patientCtx,
      userMessage,
    );

    // ── 5. Return combined response ─────────────────────────────────────
    const mealId = (savedMeal as any)._id as Types.ObjectId;

    // ── 5b. Persist AI analysis document (silent on failure) ────────────
    let aiAnalysisId: string | null = null;
    try {
      const glucoseContext = glucoseRecords.map((r) => ({
        value: r.value,
        measuredAt: r.measuredAt,
        period: r.period ?? '',
      }));

      const savedAnalysis = await this.aiFoodAnalysisModel.create({
        mealId,
        patientId: new Types.ObjectId(patientId),
        imageUrl: imageUrl ?? null,
        analysisResult: {
          name: analysis.food_name,
          ingredients: [],
          calories: analysis.calories ?? 0,
          carbs: analysis.carbs ?? 0,
          protein: analysis.protein ?? 0,
          fat: analysis.fat ?? 0,
          glycemicIndex: '',
          diabeticAdvice: analysis.health_note ?? '',
          confidence: 90,
        },
        glucoseContext,
        detailedAdvice,
        isFallback,
      });

      aiAnalysisId = String(savedAnalysis._id);
    } catch (err) {
      this.logger.warn(
        `AiFoodAnalysis persistence failed for meal ${String(mealId)}: ${(err as Error).message}`,
      );
    }

    // ── 5c. Fire-and-forget auto-prediction (never blocks the response) ────
    this.aiPredictionService
      .predictTrend(patientId, String(mealId))
      .catch((err: unknown) =>
        this.logger.warn(`Auto-prediction failed for meal ${String(mealId)}: ${err}`),
      );

    return {
      meal: {
        id: String(mealId),
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
      ai_advice: detailedAdvice.summary,
      aiAnalysisId,
    };
  }

  // ── Query methods ──────────────────────────────────────────────────────────

  async findByMeal(mealId: string): Promise<AiFoodAnalysisDocument> {
    const doc = await this.aiFoodAnalysisModel
      .findOne({ mealId: new Types.ObjectId(mealId) })
      .exec();

    if (!doc) {
      throw new NotFoundException(
        `No AI analysis found for meal ID ${mealId}`,
      );
    }
    return doc;
  }

  async findHistory(
    patientId: string,
    page: number,
    limit: number,
  ): Promise<{ data: AiFoodAnalysisDocument[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const filter = { patientId: new Types.ObjectId(patientId) };

    const [data, total] = await Promise.all([
      this.aiFoodAnalysisModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.aiFoodAnalysisModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /**
   * Downloads the image from the URL into memory, base64-encodes it, then
   * sends it to the Ollama LLaVA model running in Docker on port 11434.
   * Asks LLaVA to respond with a structured JSON nutrition analysis.
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

    // ── Step 2: send base64 image to Ollama LLaVA ───────────────────────
    const ollamaPrompt =
      'Analyze this food image. Respond ONLY with a valid JSON object — no extra text, ' +
      'no markdown, no explanation. Use exactly this format:\n' +
      '{\n' +
      '  "food_name": "name of the food or dish",\n' +
      '  "calories": <estimated kcal per serving as a number>,\n' +
      '  "carbs": <grams of carbohydrates as a number>,\n' +
      '  "protein": <grams of protein as a number>,\n' +
      '  "fat": <grams of fat as a number>,\n' +
      '  "health_note": "brief dietary note relevant to diabetic patients"\n' +
      '}';

    let ollamaResponseText: string;
    try {
      const { data } = await axios.post(
        OLLAMA_URL,
        {
          model: OLLAMA_MODEL,
          prompt: ollamaPrompt,
          images: [base64Image],
          stream: false,
        },
        { timeout: 120_000, headers: { 'Content-Type': 'application/json' } },
      );
      ollamaResponseText = (data as { response: string }).response ?? '';
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosErr = error as AxiosError;
        if (!axiosErr.response) {
          const reason = axiosErr.code ?? axiosErr.message ?? 'no response';
          this.logger.error(`Ollama unreachable (${OLLAMA_URL}): ${reason}`);
          throw new HttpException(
            'Image analyzer service (Ollama) is currently unavailable. Make sure the Docker container is running.',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        this.logger.error(
          `Ollama error ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data)}`,
        );
        throw new HttpException(
          'Ollama returned an error.',
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw new HttpException(
        'Unexpected error calling Ollama.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.debug(`Ollama raw response: ${ollamaResponseText}`);

    // ── Step 3: parse JSON from LLaVA response ───────────────────────────
    // LLaVA may wrap JSON in markdown code blocks — strip them first
    const cleaned = ollamaResponseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Extract the first { ... } JSON block in case there is surrounding text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      this.logger.error(`LLaVA did not return JSON. Raw: ${ollamaResponseText}`);
      throw new HttpException(
        'Image analyzer could not parse the food. Please try with a clearer image.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      this.logger.error(`Failed to JSON.parse LLaVA response: ${jsonMatch[0]}`);
      throw new HttpException(
        'Image analyzer returned malformed data.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      food_name: String(parsed['food_name'] ?? 'Unknown food'),
      calories: Number(parsed['calories'] ?? 0),
      carbs: Number(parsed['carbs'] ?? 0),
      protein: Number(parsed['protein'] ?? 0),
      fat: Number(parsed['fat'] ?? 0),
      health_note: String(parsed['health_note'] ?? ''),
    };
  }

  /** Default empty advice returned on failure */
  private static readonly FALLBACK_ADVICE: DetailedAdvice = {
    glucoseImpact: '',
    expectedGlucoseRise: '',
    riskLevel: '',
    personalizedRisk: '',
    recommendations: [],
    portionAdvice: '',
    timingAdvice: '',
    alternativeSuggestions: [],
    exerciseRecommendation: '',
    summary: 'AI advice unavailable at the moment.',
  };

  /**
   * Asks Ollama to return a JSON object with all DetailedAdvice fields
   * personalised to the patient's profile and glucose history.
   */
  private async generateDetailedAdvice(
    analysis: ImageAnalysisResult,
    glucoseRecords: { value: number; measuredAt: Date; period: string | null; note?: string | null }[],
    patient: PatientContext,
    userMessage?: string,
  ): Promise<{ detailedAdvice: DetailedAdvice; isFallback: boolean }> {

    // ── Patient profile ───────────────────────────────────────────────
    const profileParts: string[] = [];
    if (patient.typeDiabete)      profileParts.push(`diabetes:${patient.typeDiabete}`);
    if (patient.sexe)             profileParts.push(`sex:${patient.sexe}`);
    if (patient.poids && patient.taille) {
      const bmi = (patient.poids / Math.pow(patient.taille / 100, 2)).toFixed(1);
      profileParts.push(`BMI:${bmi}`);
    }
    if (patient.dernierHba1c)         profileParts.push(`HbA1c:${patient.dernierHba1c}%`);
    if (patient.glycemieAJeunMoyenne) profileParts.push(`fastingGlucose:${patient.glycemieAJeunMoyenne}mg/dL`);
    if (patient.prendInsuline) {
      const dose = patient.doseQuotidienneInsuline ? `${patient.doseQuotidienneInsuline}UI` : '';
      profileParts.push(`insulin:${patient.typeInsuline ?? 'yes'}${dose ? ' ' + dose : ''}`);
    }
    if (patient.antidiabetiquesOraux?.length)
      profileParts.push(`oralMeds:${patient.antidiabetiquesOraux.join('+') }`);
    const flags: string[] = [
      patient.hypertension             && 'hypertension',
      patient.maladiesCardiovasculaires && 'CVD',
      patient.problemesRenaux          && 'kidneyDisease',
      patient.hypoglycemiesFrequentes  && 'frequentHypos',
    ].filter(Boolean) as string[];
    if (flags.length) profileParts.push(`comorbidities:${flags.join(',')}`);

    // ── Glucose summary ───────────────────────────────────────────────
    let glucoseSummary = 'none';
    if (glucoseRecords.length > 0) {
      const recent = glucoseRecords.slice(0, 8);
      const avg = Math.round(recent.reduce((s, r) => s + r.value, 0) / recent.length);
      const list = recent.map((r) => `${r.value}(${r.period ?? '?'})`).join(',');
      glucoseSummary = `avg:${avg} readings:${list}`;
    }

    // ── Prompt (kept short to minimise token count / latency) ─────────
    const userQ = userMessage ? ` UserQuestion:"${userMessage}"` : '';
    const fullPrompt =
      `You are a diabetes dietitian. Respond ONLY with a single valid JSON object, no markdown, no extra text.\n` +
      `Patient: ${profileParts.join(' | ')}\n` +
      `RecentGlucose: ${glucoseSummary}\n` +
      `Food: ${analysis.food_name} ${analysis.calories}kcal carbs:${analysis.carbs}g protein:${analysis.protein}g fat:${analysis.fat}g${userQ}\n` +
      `Return exactly this JSON structure (all values in English, arrays have 2-3 items):\n` +
      `{"glucoseImpact":"...","expectedGlucoseRise":"...","riskLevel":"low|moderate|high",` +
      `"personalizedRisk":"...","recommendations":["...","..."],` +
      `"portionAdvice":"...","timingAdvice":"...",` +
      `"alternativeSuggestions":["...","..."],"exerciseRecommendation":"...","summary":"..."}`;

    try {
      const { data } = await axios.post(
        OLLAMA_URL,
        { model: OLLAMA_MODEL, prompt: fullPrompt, stream: false },
        { timeout: 180_000, headers: { 'Content-Type': 'application/json' } },
      );

      const raw = ((data as { response?: string }).response ?? '').trim();

      // Strip markdown fences if present, then extract first {...}
      const stripped = raw.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('Ollama advice: no JSON object found in response, storing as summary');
        return {
          detailedAdvice: { ...AiFoodAnalyzerService.FALLBACK_ADVICE, summary: raw || 'No advice.' },
          isFallback: true,
        };
      }

      let parsed: Partial<DetailedAdvice>;
      try {
        parsed = JSON.parse(jsonMatch[0]) as Partial<DetailedAdvice>;
      } catch {
        this.logger.warn('Ollama advice: JSON.parse failed, storing raw as summary');
        return {
          detailedAdvice: { ...AiFoodAnalyzerService.FALLBACK_ADVICE, summary: raw },
          isFallback: true,
        };
      }

      // Merge parsed fields with defaults so no field is ever missing
      const detailedAdvice: DetailedAdvice = {
        glucoseImpact:          typeof parsed.glucoseImpact === 'string'          ? parsed.glucoseImpact          : '',
        expectedGlucoseRise:    typeof parsed.expectedGlucoseRise === 'string'    ? parsed.expectedGlucoseRise    : '',
        riskLevel:              typeof parsed.riskLevel === 'string'              ? parsed.riskLevel              : '',
        personalizedRisk:       typeof parsed.personalizedRisk === 'string'       ? parsed.personalizedRisk       : '',
        recommendations:        Array.isArray(parsed.recommendations)             ? parsed.recommendations        : [],
        portionAdvice:          typeof parsed.portionAdvice === 'string'          ? parsed.portionAdvice          : '',
        timingAdvice:           typeof parsed.timingAdvice === 'string'           ? parsed.timingAdvice           : '',
        alternativeSuggestions: Array.isArray(parsed.alternativeSuggestions)      ? parsed.alternativeSuggestions : [],
        exerciseRecommendation: typeof parsed.exerciseRecommendation === 'string' ? parsed.exerciseRecommendation : '',
        summary:                typeof parsed.summary === 'string'                ? parsed.summary                : '',
      };

      return { detailedAdvice, isFallback: false };

    } catch (error) {
      const reason = axios.isAxiosError(error)
        ? `${(error as AxiosError).code ?? 'AxiosError'}: ${(error as AxiosError).message}`
        : String(error);
      this.logger.error(`Ollama advice call failed — ${reason}`);
      return { detailedAdvice: AiFoodAnalyzerService.FALLBACK_ADVICE, isFallback: true };
    }
  }
}
