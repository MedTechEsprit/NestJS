import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

const GLUCOSE_FETCH_LIMIT = 50;

type DetectionConfidence = 'high' | 'medium' | 'low';
type MealContext = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'unknown';
type ImageQuality = 'good' | 'acceptable' | 'poor';
type PreparationType =
  | 'raw'
  | 'grilled'
  | 'fried'
  | 'boiled'
  | 'baked'
  | 'unknown';

export interface OllamaDetectedItem {
  name: string;
  estimated_quantity: string;
  preparation: PreparationType;
  confidence: DetectionConfidence;
}

export interface OllamaDetectionResult {
  detected_items: OllamaDetectedItem[];
  meal_context: MealContext;
  image_quality: ImageQuality;
}

export interface GeminiFoodDetail {
  name: string;
  quantity: string;
  calories_kcal: number;
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  glycemic_index: number;
  diabetic_flag: 'safe' | 'moderate' | 'caution' | 'avoid';
  flag_reason: string;
}

export interface GeminiReport {
  meal_name: string;
  meal_summary: {
    total_calories_kcal: number;
    total_carbs_g: number;
    total_protein_g: number;
    total_fat_g: number;
    total_fiber_g: number;
    total_sugar_g: number;
    glycemic_index: number;
    glycemic_load: number;
  };
  foods_detail: GeminiFoodDetail[];
  diabetic_assessment: {
    overall_risk: 'low' | 'moderate' | 'high';
    blood_sugar_impact: string;
    expected_glucose_rise: string;
    insulin_consideration: string;
    portion_advice: string;
    timing_advice: string;
    exercise_recommendation: string;
    recommendations: string[];
    alternative_suggestions: string[];
  };
  summary: string;
  warnings: string[];
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
  ollama_detection: OllamaDetectionResult;
  report: GeminiReport;
  isFallback: boolean;
  /** MongoDB _id of the AiFoodAnalysis document saved for this meal */
  aiAnalysisId: string | null;
}

const GEMINI_SYSTEM_INSTRUCTION = `You are a clinical nutrition expert specialized in diabetes management.

You will receive a JSON list of food items detected visually from a meal photo,
with approximate quantities only. No nutritional data has been calculated yet.

YOUR RESPONSIBILITIES:
1. **MANDATORY: Estimate ALL nutritional values** (calories, carbs, protein, fat, fiber, sugar)
   based on detected items and quantities using USDA / Ciqual databases.
   - NEVER RETURN ZERO except when genuinely impossible (e.g., sugar_g=0 for a steak)
   - EVERY food item in foods_detail MUST have calories > 0
   - meal_summary totals MUST be greater than 0 if any items detected
   - If uncertain, estimate conservatively but include non-zero values
2. Calculate glycemic index and glycemic load for each item and the full meal
3. Assess diabetic risk using the patient medical context and recent glucose data
4. Generate personalized recommendations
5. Populate ALL fields; leave no fields empty or zero unless mathematically justified

STRICT RULES:
- Respond ONLY with a valid JSON object, no markdown, no explanation, no preamble
- Respond with EXACTLY this top-level structure and keys:
  {
    "meal_name": string,
    "meal_summary": {
      "total_calories_kcal": number,
      "total_carbs_g": number,
      "total_protein_g": number,
      "total_fat_g": number,
      "total_fiber_g": number,
      "total_sugar_g": number,
      "glycemic_index": number,
      "glycemic_load": number
    },
    "foods_detail": [
      {
        "name": string,
        "quantity": string,
        "calories_kcal": number,
        "carbs_g": number,
        "protein_g": number,
        "fat_g": number,
        "fiber_g": number,
        "sugar_g": number,
        "glycemic_index": number,
        "diabetic_flag": "safe" | "moderate" | "caution" | "avoid",
        "flag_reason": string
      }
    ],
    "diabetic_assessment": {
      "overall_risk": "low" | "moderate" | "high",
      "blood_sugar_impact": string,
      "expected_glucose_rise": string,
      "insulin_consideration": string,
      "portion_advice": string,
      "timing_advice": string,
      "exercise_recommendation": string,
      "recommendations": string[],
      "alternative_suggestions": string[]
    },
    "summary": string,
    "warnings": string[]
  }
- Do NOT rename keys (forbidden examples: patient_insights, meal_glycemic_index, estimated_quantity)
- No empty strings allowed for: summary, blood_sugar_impact, expected_glucose_rise, insulin_consideration, portion_advice, timing_advice, exercise_recommendation, flag_reason
- foods_detail MUST contain entries for EVERY detected item
- total_calories_kcal must be > 0 if any food detected
- diabetic_flag must be exactly: "safe" | "moderate" | "caution" | "avoid"
- overall_risk must be exactly: "low" | "moderate" | "high"
- recommendations array: minimum 3 items
- alternative_suggestions array: minimum 2 items
- warnings array: empty array [] if no warnings, never omit the field
- If a detected item has confidence "low", still estimate but add a warning`;

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
    private readonly configService: ConfigService,
  ) {}

  async analyzeAndSave(
    patientId: string,
    imageUrl: string,
    userMessage?: string,
  ): Promise<FoodAnalyzerResponse> {
    const ollamaDetection = await this.callImageAnalyzer(imageUrl);

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

    const { report, isFallback } = await this.generateGeminiReport(
      ollamaDetection,
      glucoseRecords,
      patientCtx,
      userMessage,
    );

    const savedMeal = await this.nutritionService.createMeal(patientId, {
      name: report.meal_name,
      eatenAt: new Date(),
      carbs: Number(report.meal_summary.total_carbs_g),
      protein: Number(report.meal_summary.total_protein_g),
      fat: Number(report.meal_summary.total_fat_g),
      calories: Number(report.meal_summary.total_calories_kcal),
      note: `[AI] ${report.summary}`,
      source: MealSource.AI,
      confidence: this.computeMealConfidence(ollamaDetection.detected_items),
    });

    const mealId = (savedMeal as any)._id as Types.ObjectId;

    let aiAnalysisId: string | null = null;
    try {
      const glucoseContext = glucoseRecords.map((r) => ({
        value: r.value,
        measuredAt: r.measuredAt,
        period: r.period ?? '',
      }));

      const firstFood = report.foods_detail[0];
      const detailedAdvice: DetailedAdvice = {
        glucoseImpact: report.diabetic_assessment.blood_sugar_impact,
        expectedGlucoseRise: report.diabetic_assessment.expected_glucose_rise,
        riskLevel: report.diabetic_assessment.overall_risk,
        personalizedRisk: report.diabetic_assessment.insulin_consideration,
        recommendations: report.diabetic_assessment.recommendations,
        portionAdvice: report.diabetic_assessment.portion_advice,
        timingAdvice: report.diabetic_assessment.timing_advice,
        alternativeSuggestions: report.diabetic_assessment.alternative_suggestions,
        exerciseRecommendation: report.diabetic_assessment.exercise_recommendation,
        summary: report.summary,
      };

      const savedAnalysis = await this.aiFoodAnalysisModel.create({
        mealId,
        patientId: new Types.ObjectId(patientId),
        imageUrl: imageUrl ?? null,
        analysisResult: {
          name: report.meal_name,
          ingredients: ollamaDetection.detected_items.map((i) => i.name),
          calories: Number(report.meal_summary.total_calories_kcal),
          carbs: Number(report.meal_summary.total_carbs_g),
          protein: Number(report.meal_summary.total_protein_g),
          fat: Number(report.meal_summary.total_fat_g),
          glycemicIndex: String(report.meal_summary.glycemic_index),
          diabeticAdvice: firstFood?.flag_reason ?? report.summary,
          confidence: this.computeMealConfidence(ollamaDetection.detected_items),
        },
        glucoseContext,
        detailedAdvice,
        ollamaDetection,
        fullReport: report,
        isFallback,
      });

      aiAnalysisId = String(savedAnalysis._id);
    } catch (err) {
      this.logger.warn(
        `AiFoodAnalysis persistence failed for meal ${String(mealId)}: ${(err as Error).message}`,
      );
    }

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
      ollama_detection: ollamaDetection,
      report,
      isFallback,
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

  private async callImageAnalyzer(imageUrl: string): Promise<OllamaDetectionResult> {
    let base64Image: string;
    try {
      let referer = '';
      try {
        referer = new URL(imageUrl).origin + '/';
      } catch {
        referer = '';
      }

      const response = await axios.get<ArrayBuffer>(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 20_000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          ...(referer ? { Referer: referer } : {}),
        },
      });
      base64Image = Buffer.from(response.data).toString('base64');
    } catch (error) {
      this.logger.error(`Failed to download image from URL: ${imageUrl} — ${error}`);
      throw new HttpException(
        'Could not download the provided image URL. Please check the URL and try again.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const ollamaUrl =
      this.configService.get<string>('OLLAMA_URL') ??
      'http://localhost:11434/api/generate';
    const candidateModels = this.getOllamaVisionModelCandidates();

    const ollamaPrompt =
      'Analyze this food image and do visual detection only. Respond ONLY with a valid JSON object. ' +
      'Do NOT calculate nutrition. Do NOT give medical advice. Use exactly this format:\n' +
      '{\n' +
      '  "detected_items": [\n' +
      '    {\n' +
      '      "name": "food item name in english",\n' +
      '      "estimated_quantity": "visual estimate e.g. 1 bowl",\n' +
      '      "preparation": "raw | grilled | fried | boiled | baked | unknown",\n' +
      '      "confidence": "high | medium | low"\n' +
      '    }\n' +
      '  ],\n' +
      '  "meal_context": "breakfast | lunch | dinner | snack | unknown",\n' +
      '  "image_quality": "good | acceptable | poor"\n' +
      '}';

    let ollamaResponseText: string;
    const notFoundModels: string[] = [];
    ollamaResponseText = '';
    for (const modelName of candidateModels) {
      try {
        const { data } = await axios.post(
          ollamaUrl,
          {
            model: modelName,
            prompt: ollamaPrompt,
            images: [base64Image],
            stream: false,
          },
          { timeout: 360_000, headers: { 'Content-Type': 'application/json' } },
        );
        ollamaResponseText = (data as { response: string }).response ?? '';
        this.logger.debug(`Ollama vision model used: ${modelName}`);
        break;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const axiosErr = error as AxiosError;

          if (!axiosErr.response) {
            const reason = axiosErr.code ?? axiosErr.message ?? 'no response';
            this.logger.error(`Ollama unreachable (${ollamaUrl}): ${reason}`);
            throw new HttpException(
              'Image analyzer service (Ollama) is currently unavailable. Make sure the Docker container is running.',
              HttpStatus.SERVICE_UNAVAILABLE,
            );
          }

          const status = axiosErr.response.status;
          const responseText = JSON.stringify(axiosErr.response.data);
          const isModelNotFound =
            status === 404 &&
            /model\s+'.*'\s+not\s+found/i.test(responseText);

          if (isModelNotFound) {
            notFoundModels.push(modelName);
            this.logger.warn(`Ollama model not found: ${modelName}. Trying next fallback model.`);
            continue;
          }

          this.logger.error(`Ollama error ${status}: ${responseText}`);
          throw new HttpException('Ollama returned an error.', HttpStatus.BAD_GATEWAY);
        }

        throw new HttpException(
          'Unexpected error calling Ollama.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    if (!ollamaResponseText) {
      const configuredModel = this.configService.get<string>('OLLAMA_MODEL') ?? 'llava:13b';
      throw new HttpException(
        `No usable Ollama vision model found. Tried: ${[...new Set(notFoundModels)].join(', ') || configuredModel}. Pull a model (e.g. 'ollama pull ${configuredModel}') or set OLLAMA_MODEL.`,
        HttpStatus.SERVICE_UNAVAILABLE,
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

    const rawItems = Array.isArray(parsed['detected_items']) ? parsed['detected_items'] : [];
    const detected_items: OllamaDetectedItem[] = rawItems.map((item) => {
      const obj = (item ?? {}) as Record<string, unknown>;
      return {
        name: String(obj['name'] ?? 'unknown item'),
        estimated_quantity: String(obj['estimated_quantity'] ?? 'unknown quantity'),
        preparation: this.normalizePreparation(obj['preparation']),
        confidence: this.normalizeConfidence(obj['confidence']),
      };
    });

    return {
      detected_items,
      meal_context: this.normalizeMealContext(parsed['meal_context']),
      image_quality: this.normalizeImageQuality(parsed['image_quality']),
    };
  }

  private getOllamaVisionModelCandidates(): string[] {
    const configured = this.configService.get<string>('OLLAMA_MODEL')?.trim();
    const ordered = [
      configured,
      'llava:13b',
      'llava:latest',
      'llava',
      'bakllava:latest',
      'bakllava',
    ].filter((v): v is string => Boolean(v));

    return [...new Set(ordered)];
  }

  private static readonly FALLBACK_REPORT: GeminiReport = {
    meal_name: 'Unknown meal',
    meal_summary: {
      total_calories_kcal: 0,
      total_carbs_g: 0,
      total_protein_g: 0,
      total_fat_g: 0,
      total_fiber_g: 0,
      total_sugar_g: 0,
      glycemic_index: 0,
      glycemic_load: 0,
    },
    foods_detail: [
      {
        name: 'unknown item',
        quantity: 'unknown quantity',
        calories_kcal: 0,
        carbs_g: 0,
        protein_g: 0,
        fat_g: 0,
        fiber_g: 0,
        sugar_g: 0,
        glycemic_index: 0,
        diabetic_flag: 'moderate',
        flag_reason: 'Gemini report unavailable.',
      },
    ],
    diabetic_assessment: {
      overall_risk: 'moderate',
      blood_sugar_impact: 'Unable to estimate impact right now.',
      expected_glucose_rise: 'Unknown',
      insulin_consideration: 'Consult your clinician before dosing changes.',
      portion_advice: 'Use a conservative portion.',
      timing_advice: 'Prefer taking this meal with close monitoring.',
      exercise_recommendation: 'Consider a light walk after meal if possible.',
      recommendations: [
        'Monitor glucose closely for 2-4 hours.',
        'Prefer smaller portions.',
        'Consult your care team if values rise significantly.',
      ],
      alternative_suggestions: [
        'Choose higher fiber alternatives.',
        'Pair with lean protein.',
      ],
    },
    summary: 'AI report unavailable at the moment. Please monitor glucose closely.',
    warnings: ['Gemini report generation failed. Values are fallback placeholders.'],
  };

  private async generateGeminiReport(
    detection: OllamaDetectionResult,
    glucoseRecords: { value: number; measuredAt: Date; period: string | null; note?: string | null }[],
    patient: PatientContext,
    userMessage?: string,
  ): Promise<{ report: GeminiReport; isFallback: boolean }> {
    const bmi =
      patient.poids && patient.taille
        ? Number((patient.poids / Math.pow(patient.taille / 100, 2)).toFixed(1))
        : null;
    const medications = [
      ...(patient.antidiabetiquesOraux ?? []),
      ...(patient.traitements ?? []),
      ...(patient.prendInsuline ? ['insulin'] : []),
    ];
    const comorbidities = [
      patient.hypertension ? 'hypertension' : null,
      patient.maladiesCardiovasculaires ? 'cardiovascular_disease' : null,
      patient.problemesRenaux ? 'kidney_disease' : null,
      patient.hypoglycemiesFrequentes ? 'frequent_hypoglycemia' : null,
    ].filter((v): v is string => Boolean(v));

    const recentGlucose = glucoseRecords.slice(0, 10).map((g) => ({
      value: g.value,
      measuredAt: g.measuredAt,
      period: g.period ?? 'unknown',
    }));

    const patientPayload = {
      typeDiabete: patient.typeDiabete ?? 'unknown',
      sexe: patient.sexe ?? 'unknown',
      bmi,
      hba1c: patient.dernierHba1c ?? null,
      medications,
      comorbidities,
    };

    const userPrompt =
      `FOOD ITEMS DETECTED FROM IMAGE (visual detection only, no nutrition calculated yet):\n` +
      `${JSON.stringify(detection, null, 2)}\n\n` +
      `PATIENT MEDICAL CONTEXT:\n` +
      `${JSON.stringify(patientPayload, null, 2)}\n\n` +
      `RECENT GLUCOSE READINGS (last 10):\n` +
      `${JSON.stringify(recentGlucose, null, 2)}\n\n` +
      `${userMessage ? `PATIENT MESSAGE: ${userMessage}\n\n` : ''}` +
      `Calculate all nutritional values and generate the complete diabetic report.\n` +
      `IMPORTANT: Use the exact required field names from system rules; no aliases and no empty critical strings.\n` +
      `Return only the JSON object, nothing else.`;

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY is missing. Using fallback report.');
      return { report: AiFoodAnalyzerService.FALLBACK_REPORT, isFallback: true };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const candidates = this.getGeminiModelCandidates();
      let lastError: unknown = null;

      for (const modelName of candidates) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              responseMimeType: 'application/json',
            },
            systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
          });

          const result = await model.generateContent(userPrompt);
          const text = result.response.text();
          this.logGeminiRawResponse(text, modelName);
          const clean = text.replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(clean) as GeminiReport;
          const normalized = this.normalizeGeminiReport(parsed);
          const completeness = this.validateGeminiCompleteness(normalized);
          if (!completeness.ok) {
            this.logger.warn(
              `Gemini response incomplete (model=${modelName}): ${completeness.missing.join(', ')}. Trying next model.`,
            );
            continue;
          }
          
          // ── Detect if response is essentially empty (all zeros + no foods) ──
          const isEmpty = this.isGeminiResponseEmpty(normalized);
          if (isEmpty) {
            this.logger.warn(
              `Gemini returned valid JSON but with zero nutritional data (calories=0, foods_detail=[]). Model: ${modelName}. Treating as failed response.`,
            );
            continue; // Try next model
          }
          
          this.logger.debug(`Gemini model used: ${modelName}`);
          return { report: normalized, isFallback: false };
        } catch (err) {
          lastError = err;
          const message = err instanceof Error ? err.message : String(err);
          const isModelNotFound =
            message.includes('[404 Not Found]') ||
            /model[s]?\/.+\s+is\s+not\s+found/i.test(message) ||
            message.includes('is not found for API version');

          if (isModelNotFound) {
            this.logger.warn(`Gemini model not available: ${modelName}. Trying fallback model.`);
            continue;
          }

          throw err;
        }
      }

      throw new Error(
        `No usable Gemini model found. Tried: ${candidates.join(', ')}. Last error: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Gemini report generation failed: ${reason}`);
      return { report: AiFoodAnalyzerService.FALLBACK_REPORT, isFallback: true };
    }
  }

  private getGeminiModelCandidates(): string[] {
    const configured = this.configService.get<string>('GEMINI_MODEL')?.trim();
    const ordered = [
      configured,
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
    ].filter((v): v is string => Boolean(v));

    return [...new Set(ordered)];
  }

  private logGeminiRawResponse(rawText: string, modelName: string): void {
    const nodeEnv = (this.configService.get<string>('NODE_ENV') ?? 'development').toLowerCase();
    const isProd = nodeEnv === 'production';

    if (isProd) {
      this.logger.debug(
        `Gemini raw response received (model=${modelName}, chars=${rawText.length}). Content omitted in production.`,
      );
      return;
    }

    const MAX_LOG_LEN = 6000;
    const truncated = rawText.length > MAX_LOG_LEN;
    const safeText = (truncated ? rawText.slice(0, MAX_LOG_LEN) : rawText).replace(
      /AIza[0-9A-Za-z\-_]{20,}/g,
      '[REDACTED_API_KEY]',
    );

    this.logger.debug(
      `Gemini raw response (model=${modelName}${truncated ? ', truncated=true' : ''}): ${safeText}`,
    );

    // Additional diagnostic: log if response looks empty
    if (rawText && rawText.length < 100) {
      this.logger.warn(
        `⚠️  Gemini response is suspiciously short (${rawText.length} chars): ${rawText}`,
      );
    }

    // Parse to check structure in debug mode
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      const obj = JSON.parse(clean) as Record<string, unknown>;
      const summary = (obj['meal_summary'] ?? {}) as Record<string, unknown>;
      const caloriesValue = summary['total_calories_kcal'];
      const foodsCount = Array.isArray(obj['foods_detail']) ? obj['foods_detail'].length : 0;
      
      this.logger.debug(
        `Gemini structure check: calories=${caloriesValue}, foods_detail.length=${foodsCount}`,
      );
    } catch {
      // Ignore parse errors at this stage
    }
  }

  private computeMealConfidence(items: OllamaDetectedItem[]): number {
    if (!items.length) return 60;
    const map: Record<DetectionConfidence, number> = {
      high: 90,
      medium: 70,
      low: 50,
    };
    const avg =
      items.reduce((sum, item) => sum + map[this.normalizeConfidence(item.confidence)], 0) /
      items.length;
    return Math.round(avg);
  }

  private normalizeConfidence(value: unknown): DetectionConfidence {
    const v = String(value ?? '').toLowerCase();
    if (v === 'high' || v === 'medium' || v === 'low') return v;
    return 'medium';
  }

  private normalizePreparation(value: unknown): PreparationType {
    const v = String(value ?? '').toLowerCase();
    if (v === 'raw' || v === 'grilled' || v === 'fried' || v === 'boiled' || v === 'baked') {
      return v;
    }
    return 'unknown';
  }

  private normalizeMealContext(value: unknown): MealContext {
    const v = String(value ?? '').toLowerCase();
    if (v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack') return v;
    return 'unknown';
  }

  private normalizeImageQuality(value: unknown): ImageQuality {
    const v = String(value ?? '').toLowerCase();
    if (v === 'good' || v === 'acceptable' || v === 'poor') return v;
    return 'acceptable';
  }

  private normalizeGeminiReport(parsed: GeminiReport): GeminiReport {
    const raw = parsed as unknown as Record<string, unknown>;

    // Support alternate model shape observed in production logs:
    // { summary: {...}, itemized_nutrition: [...], meal_report: {...} }
    const altSummary = (raw['summary'] ?? {}) as Record<string, unknown>;
    const altItems = Array.isArray(raw['itemized_nutrition'])
      ? (raw['itemized_nutrition'] as Array<Record<string, unknown>>)
      : [];
    const altMealReport = (raw['meal_report'] ?? {}) as Record<string, unknown>;

    const hasAlternateShape =
      altItems.length > 0 ||
      Object.keys(altMealReport).length > 0 ||
      (Object.keys(altSummary).length > 0 && typeof raw['meal_name'] !== 'string');

    const mappedFromAlt: Partial<GeminiReport> = hasAlternateShape
      ? {
          meal_name: this.inferMealNameFromItems(altItems),
          meal_summary: {
            total_calories_kcal: Number(altSummary['calories'] ?? 0),
            total_carbs_g: Number(altSummary['carbs'] ?? 0),
            total_protein_g: Number(altSummary['protein'] ?? 0),
            total_fat_g: Number(altSummary['fat'] ?? 0),
            total_fiber_g: Number(altSummary['fiber'] ?? 0),
            total_sugar_g: Number(altSummary['sugar'] ?? 0),
            glycemic_index: Number(altSummary['glycemic_index'] ?? 0),
            glycemic_load: Number(altSummary['glycemic_load'] ?? 0),
          },
          foods_detail: altItems.map((it) => ({
            name: String(it['name'] ?? 'unknown item'),
            quantity: String(it['estimated_quantity'] ?? it['quantity'] ?? 'unknown quantity'),
            calories_kcal: Number(it['calories'] ?? it['calories_kcal'] ?? 0),
            carbs_g: Number(it['carbs'] ?? it['carbs_g'] ?? 0),
            protein_g: Number(it['protein'] ?? it['protein_g'] ?? 0),
            fat_g: Number(it['fat'] ?? it['fat_g'] ?? 0),
            fiber_g: Number(it['fiber'] ?? it['fiber_g'] ?? 0),
            sugar_g: Number(it['sugar'] ?? it['sugar_g'] ?? 0),
            glycemic_index: Number(it['glycemic_index'] ?? 0),
            diabetic_flag: this.normalizeDiabeticFlag(altSummary['diabetic_flag']),
            flag_reason: '',
          })),
          diabetic_assessment: {
            overall_risk: this.normalizeOverallRisk(altSummary['overall_risk']),
            blood_sugar_impact: this.toSafeString(altMealReport['summary']),
            expected_glucose_rise: '',
            insulin_consideration: '',
            portion_advice: '',
            timing_advice: '',
            exercise_recommendation: '',
            recommendations: Array.isArray(altMealReport['recommendations'])
              ? (altMealReport['recommendations'] as unknown[]).map((x) => String(x))
              : [],
            alternative_suggestions: Array.isArray(altMealReport['alternative_suggestions'])
              ? (altMealReport['alternative_suggestions'] as unknown[]).map((x) => String(x))
              : [],
          },
          summary: this.toSafeString(altMealReport['summary']),
          warnings: Array.isArray(altMealReport['warnings'])
            ? (altMealReport['warnings'] as unknown[]).map((x) => String(x))
            : [],
        }
      : {};

    const source = {
      ...parsed,
      ...mappedFromAlt,
    } as GeminiReport;

    const sourceRaw = source as unknown as Record<string, unknown>;
    const sourceMealSummary = (sourceRaw['meal_summary'] ?? {}) as Record<string, unknown>;
    const patientInsights = (sourceRaw['patient_insights'] ?? raw['patient_insights'] ?? {}) as Record<
      string,
      unknown
    >;
    const patientRiskFactors = Array.isArray(patientInsights['risk_factors_identified'])
      ? (patientInsights['risk_factors_identified'] as unknown[]).map((x) => String(x)).filter(Boolean)
      : [];

    const fallbackBloodSugarImpact = patientRiskFactors.length > 0 ? patientRiskFactors.join(' ') : '';
    const fallbackSummary =
      this.toSafeString(source.summary) ||
      this.toSafeString((sourceRaw['meal_report'] as Record<string, unknown> | undefined)?.['summary']) ||
      patientRiskFactors[0] ||
      '';

    const foods = Array.isArray(source.foods_detail) ? source.foods_detail : [];
    const insightRecommendations = Array.isArray(patientInsights['recommendations'])
      ? (patientInsights['recommendations'] as unknown[]).map((x) => String(x)).filter(Boolean)
      : [];
    const insightAlternatives = Array.isArray(patientInsights['alternative_suggestions'])
      ? (patientInsights['alternative_suggestions'] as unknown[]).map((x) => String(x)).filter(Boolean)
      : [];

    const mergedRecommendations = [
      ...(source.diabetic_assessment?.recommendations ?? []),
      ...insightRecommendations,
    ].filter((x, i, arr) => Boolean(x) && arr.indexOf(x) === i);

    const recommendations =
      mergedRecommendations.length >= 3
        ? mergedRecommendations
        : [
            ...mergedRecommendations,
            'Prefer balanced portions.',
            'Monitor glucose after the meal.',
            'Adjust next meal to lower glycemic load.',
          ].slice(0, 3);

    const mergedAlternatives = [
      ...(source.diabetic_assessment?.alternative_suggestions ?? []),
      ...insightAlternatives,
    ].filter((x, i, arr) => Boolean(x) && arr.indexOf(x) === i);

    const alternatives =
      mergedAlternatives.length >= 2
        ? mergedAlternatives
        : [
            ...mergedAlternatives,
            'Choose a higher-fiber option.',
            'Pair with lean protein.',
          ].slice(0, 2);

    return {
      meal_name:
        this.toSafeString(source.meal_name) ||
        this.inferMealNameFromItems(foods as unknown as Array<Record<string, unknown>>) ||
        'Unknown meal',
      meal_summary: {
        total_calories_kcal: Number(source.meal_summary?.total_calories_kcal ?? 0),
        total_carbs_g: Number(source.meal_summary?.total_carbs_g ?? 0),
        total_protein_g: Number(source.meal_summary?.total_protein_g ?? 0),
        total_fat_g: Number(source.meal_summary?.total_fat_g ?? 0),
        total_fiber_g: Number(source.meal_summary?.total_fiber_g ?? 0),
        total_sugar_g: Number(source.meal_summary?.total_sugar_g ?? 0),
        glycemic_index: Number(
          source.meal_summary?.glycemic_index ?? sourceMealSummary['meal_glycemic_index'] ?? 0,
        ),
        glycemic_load: Number(
          source.meal_summary?.glycemic_load ?? sourceMealSummary['meal_glycemic_load'] ?? 0,
        ),
      },
      foods_detail: foods.map((f) => ({
        name: String(f.name ?? 'unknown item'),
        quantity: String((f as unknown as Record<string, unknown>)['quantity'] ?? (f as unknown as Record<string, unknown>)['estimated_quantity'] ?? 'unknown quantity'),
        calories_kcal: Number(f.calories_kcal ?? 0),
        carbs_g: Number(f.carbs_g ?? 0),
        protein_g: Number(f.protein_g ?? 0),
        fat_g: Number(f.fat_g ?? 0),
        fiber_g: Number(f.fiber_g ?? 0),
        sugar_g: Number(f.sugar_g ?? 0),
        glycemic_index: Number(f.glycemic_index ?? 0),
        diabetic_flag: this.normalizeDiabeticFlag(
          f.diabetic_flag ?? patientInsights['diabetic_flag'],
        ),
        flag_reason: String(f.flag_reason ?? patientRiskFactors[0] ?? ''),
      })),
      diabetic_assessment: {
        overall_risk: this.normalizeOverallRisk(
          source.diabetic_assessment?.overall_risk ?? patientInsights['overall_risk'],
        ),
        blood_sugar_impact:
          this.toSafeString(source.diabetic_assessment?.blood_sugar_impact) ||
          fallbackBloodSugarImpact,
        expected_glucose_rise: this.toSafeString(source.diabetic_assessment?.expected_glucose_rise),
        insulin_consideration: this.toSafeString(source.diabetic_assessment?.insulin_consideration),
        portion_advice: this.toSafeString(source.diabetic_assessment?.portion_advice),
        timing_advice: this.toSafeString(source.diabetic_assessment?.timing_advice),
        exercise_recommendation: this.toSafeString(source.diabetic_assessment?.exercise_recommendation),
        recommendations,
        alternative_suggestions: alternatives,
      },
      summary: fallbackSummary,
      warnings: (() => {
        const topLevel = Array.isArray(source.warnings)
          ? source.warnings.map((w) => String(w)).filter(Boolean)
          : [];
        const insight = Array.isArray(patientInsights['warnings'])
          ? (patientInsights['warnings'] as unknown[]).map((w) => String(w)).filter(Boolean)
          : [];
        return [...new Set([...topLevel, ...insight])];
      })(),
    };
  }

  private toSafeString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  }

  private inferMealNameFromItems(items: Array<Record<string, unknown>>): string {
    const names = items
      .map((i) => this.toSafeString(i['name']))
      .filter((n) => n.length > 0)
      .slice(0, 3);

    return names.length > 0 ? names.join(' + ') : 'Unknown meal';
  }

  private normalizeDiabeticFlag(value: unknown): 'safe' | 'moderate' | 'caution' | 'avoid' {
    const v = String(value ?? '').toLowerCase();
    if (v === 'safe' || v === 'moderate' || v === 'caution' || v === 'avoid') return v;
    return 'moderate';
  }

  private normalizeOverallRisk(value: unknown): 'low' | 'moderate' | 'high' {
    const v = String(value ?? '').toLowerCase();
    if (v === 'low' || v === 'moderate' || v === 'high') return v;
    return 'moderate';
  }

  /**
   * Checks if a normalized Gemini report is essentially empty:
   * - All macro values are 0
   * - foods_detail array is empty or contains only zero-calorie items
   * - meal_name is "Unknown meal"
   * 
   * Empty responses indicate Gemini failed to extract/calculate nutrition data
   * and should trigger fallback to the next model.
   */
  private isGeminiResponseEmpty(report: GeminiReport): boolean {
    const summary = report.meal_summary ?? {};
    const foodsDetail = report.foods_detail ?? [];
    
    // Check if all macros are zero
    const allMacrosZero =
      (summary.total_calories_kcal ?? 0) === 0 &&
      (summary.total_carbs_g ?? 0) === 0 &&
      (summary.total_protein_g ?? 0) === 0 &&
      (summary.total_fat_g ?? 0) === 0;
    
    // Check if foods list is empty or all have zero calories
    const noFoods =
      !Array.isArray(foodsDetail) ||
      foodsDetail.length === 0 ||
      foodsDetail.every((f) => (f?.calories_kcal ?? 0) === 0);
    
    // Check if meal name is generic fallback
    const isGenericName =
      !report.meal_name ||
      report.meal_name === 'Unknown meal' ||
      report.meal_name.trim().length === 0;
    
    // If all three conditions are true, it's an empty response
    return allMacrosZero && noFoods && isGenericName;
  }

  private validateGeminiCompleteness(
    report: GeminiReport,
  ): { ok: boolean; missing: string[] } {
    const missing: string[] = [];

    if (!this.toSafeString(report.meal_name)) missing.push('meal_name');
    if (!this.toSafeString(report.summary)) missing.push('summary');

    const s = report.meal_summary ?? ({} as GeminiReport['meal_summary']);
    const summaryKeys: Array<keyof GeminiReport['meal_summary']> = [
      'total_calories_kcal',
      'total_carbs_g',
      'total_protein_g',
      'total_fat_g',
      'total_fiber_g',
      'total_sugar_g',
      'glycemic_index',
      'glycemic_load',
    ];
    for (const key of summaryKeys) {
      if (!Number.isFinite(Number(s[key]))) {
        missing.push(`meal_summary.${key}`);
      }
    }

    const d = report.diabetic_assessment;
    if (!d) {
      missing.push('diabetic_assessment');
    } else {
      const requiredTextFields: Array<keyof GeminiReport['diabetic_assessment']> = [
        'blood_sugar_impact',
        'expected_glucose_rise',
        'insulin_consideration',
        'portion_advice',
        'timing_advice',
        'exercise_recommendation',
      ];
      for (const key of requiredTextFields) {
        if (!this.toSafeString(d[key])) {
          missing.push(`diabetic_assessment.${key}`);
        }
      }

      if (!Array.isArray(d.recommendations) || d.recommendations.length < 3) {
        missing.push('diabetic_assessment.recommendations');
      }

      if (!Array.isArray(d.alternative_suggestions) || d.alternative_suggestions.length < 2) {
        missing.push('diabetic_assessment.alternative_suggestions');
      }
    }

    if (!Array.isArray(report.foods_detail) || report.foods_detail.length === 0) {
      missing.push('foods_detail');
    } else {
      for (let i = 0; i < report.foods_detail.length; i++) {
        const item = report.foods_detail[i];
        if (!this.toSafeString(item.name)) missing.push(`foods_detail[${i}].name`);
        if (!this.toSafeString(item.quantity) || item.quantity === 'unknown quantity') {
          missing.push(`foods_detail[${i}].quantity`);
        }
        if (!this.toSafeString(item.flag_reason)) missing.push(`foods_detail[${i}].flag_reason`);
      }
    }

    if (!Array.isArray(report.warnings)) {
      missing.push('warnings');
    }

    return { ok: missing.length === 0, missing };
  }
}
