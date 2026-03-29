import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GlucoseService } from '../glucose/glucose.service';
import { NutritionService } from '../nutrition/nutrition.service';
import {
  AiPrediction,
  AiPredictionDocument,
  GlucoseSnapshot,
  MealSnapshot,
  PredictionResult,
} from './schemas/ai-prediction.schema';
import {
  AiFoodAnalysis,
  AiFoodAnalysisDocument,
} from '../ai-food-analyzer/schemas/ai-food-analysis.schema';

const GLUCOSE_RECORDS_LIMIT = 30;

const SYSTEM_PROMPT =
  `You are an expert endocrinologist AI specialized in glucose trend prediction ` +
  `for diabetic patients.\n` +
  `YOUR RULES:\n` +
  `Analyze the patient's glucose history and predict the trend for the next 2-4 hours.\n` +
  `Consider meal data if provided (post-meal prediction).\n` +
  `Be precise with numerical estimates based on the actual data patterns.\n` +
  `Flag critical situations immediately (predicted < 60 or > 250 mg/dL).\n` +
  `Respond ONLY with a valid JSON object — no markdown, no prose, no extra text.\n` +
  `Base ALL predictions strictly on the provided patient data.\n` +
  `If data is insufficient (< 3 records), still provide a best-effort estimate ` +
  `with lower confidence score.`;

/** Safe number coercion — avoids NaN in calculations */
const toNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
};

@Injectable()
export class AiPredictionService {
  private readonly logger = new Logger(AiPredictionService.name);

  constructor(
    @InjectModel(AiPrediction.name)
    private readonly aiPredictionModel: Model<AiPredictionDocument>,
    @InjectModel('AiFoodAnalysis')
    private readonly aiFoodAnalysisModel: Model<AiFoodAnalysisDocument>,
    private readonly glucoseService: GlucoseService,
    private readonly nutritionService: NutritionService,
    private readonly configService: ConfigService,
  ) {}

  // ── 1. Main prediction method ───────────────────────────────────────────────

  async predictTrend(
    patientId: string,
    mealId?: string | null,
  ): Promise<{
    predictionId: string;
    prediction: PredictionResult;
    glucoseSnapshot: GlucoseSnapshot;
    mealSnapshot: MealSnapshot | null;
    triggerType: string;
    createdAt: Date | undefined;
  }> {

    // Step 1 — Fetch data in parallel
    const fetchMeal =
      mealId
        ? this.nutritionService
            .findOneMeal(mealId, patientId)
            .catch(() => null)
        : Promise.resolve(null);

    const fetchAiAnalysis =
      mealId
        ? this.aiFoodAnalysisModel
            .findOne({ mealId: new Types.ObjectId(mealId) })
            .exec()
            .catch(() => null)
        : Promise.resolve(null);

    const [glucoseResult, meal, aiAnalysis] = await Promise.all([
      this.glucoseService
        .findMyRecords(patientId, { page: 1, limit: GLUCOSE_RECORDS_LIMIT })
        .catch(() => ({ data: [] as any[] })),
      fetchMeal,
      fetchAiAnalysis,
    ]);

    const records: { value: number; measuredAt: Date; period: string | null }[] =
      Array.isArray((glucoseResult as any).data)
        ? (glucoseResult as any).data
        : [];

    // Step 2 — Build glucoseSnapshot
    const glucoseSnapshot = this.buildGlucoseSnapshot(records);

    // Step 3 — Build mealSnapshot
    const mealSnapshot: MealSnapshot | null = meal
      ? {
          mealName: (meal as any).name ?? '',
          calories: toNum((meal as any).calories),
          carbs: toNum((meal as any).carbs),
          protein: toNum((meal as any).protein),
          fat: toNum((meal as any).fat),
          glycemicIndex:
            (aiAnalysis as any)?.analysisResult?.glycemicIndex ?? null,
        }
      : null;

    // Step 4 — Build prompt
    const glucoseHistory =
      records.length > 0
        ? records
            .map(
              (r) =>
                `${r.value} mg/dL (${r.period ?? 'unknown'}, ${new Date(r.measuredAt).toLocaleString()})`,
            )
            .join(' → ')
        : 'No glucose records.';

    const mealContext =
      mealId && meal
        ? `MEAL JUST CONSUMED: "${(meal as any).name}" — ` +
          `${toNum((meal as any).calories)}kcal, ${toNum((meal as any).carbs)}g carbs, ` +
          `${toNum((meal as any).protein)}g protein, ${toNum((meal as any).fat)}g fat. ` +
          `Glycemic index: ${(aiAnalysis as any)?.analysisResult?.glycemicIndex ?? 'unknown'}. ` +
          `Expected glucose impact from AI: ` +
          `${(aiAnalysis as any)?.detailedAdvice?.expectedGlucoseRise ?? 'unknown'}.`
        : 'NO MEAL DATA — manual prediction request.';

    const userPrompt =
      `PATIENT GLUCOSE HISTORY (most recent first, ${records.length} records): ` +
      `${glucoseHistory}. ` +
      `CURRENT STATS: Average=${glucoseSnapshot.average} mg/dL, ` +
      `Last value=${glucoseSnapshot.lastValue} mg/dL, ` +
      `Hypo episodes=${glucoseSnapshot.hypoglycemiaCount}, ` +
      `Hyper episodes=${glucoseSnapshot.hyperglycemiaCount}, ` +
      `Overall trend=${glucoseSnapshot.trend}. ` +
      `${mealContext} ` +
      `Predict glucose trend for next 2-4 hours. ` +
      `Respond with ONLY this JSON: ` +
      `{"trend":"increase|decrease|stable",` +
      `"confidence":85,` +
      `"estimatedValue2h":140,` +
      `"estimatedValue4h":130,` +
      `"riskLevel":"low|moderate|high|critical",` +
      `"riskType":"hypoglycemia_risk|hyperglycemia_risk|none",` +
      `"alerts":["alert if critical"],` +
      `"recommendations":["action 1","action 2","action 3"],` +
      `"timeToAction":"immediate|within_1h|monitor",` +
      `"explanation":"simple explanation for the patient",` +
      `"summary":"one sentence summary"}`;

    // Helper to detect template placeholders echoed back from Ollama
    const isTemplatePlaceholder = (val: unknown): boolean => {
      const str = String(val ?? '').toLowerCase().trim();
      return (
        str === 'action 1' || str === 'action 2' || str === 'action 3' ||
        str === 'alert if critical' ||
        str === 'simple explanation for the patient' ||
        str === 'one sentence summary'
      );
    };

    // Step 5 — Try Gemini first, then Ollama (never throw)
    let parsedPrediction: PredictionResult;
    let isFallback = false;

    // ── 5a. Try Gemini ──
    try {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiCandidates = this.getGeminiModelCandidates();

        for (const modelName of geminiCandidates) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: {
                responseMimeType: 'application/json',
              },
              systemInstruction: SYSTEM_PROMPT,
            });

            const result = await model.generateContent(userPrompt);
            const text = result.response.text();
            const clean = text.replace(/```json|```/g, '').trim();
            const p = JSON.parse(clean) as Partial<PredictionResult>;

            // Reject if template placeholders detected
            const hasTemplatePlaceholders =
              (Array.isArray(p.recommendations) && p.recommendations.some(isTemplatePlaceholder)) ||
              (Array.isArray(p.alerts) && p.alerts.some(isTemplatePlaceholder));
            if (hasTemplatePlaceholders) {
              this.logger.warn(
                `Gemini model ${modelName} returned template placeholders. Trying next model.`,
              );
              continue;
            }

            parsedPrediction = {
              trend: typeof p.trend === 'string' ? p.trend : 'stable',
              confidence: toNum(p.confidence, 50),
              estimatedValue2h: toNum(p.estimatedValue2h, glucoseSnapshot.lastValue),
              estimatedValue4h: toNum(p.estimatedValue4h, glucoseSnapshot.lastValue),
              riskLevel: typeof p.riskLevel === 'string' ? p.riskLevel : 'low',
              riskType: typeof p.riskType === 'string' ? p.riskType : 'none',
              alerts: Array.isArray(p.alerts) ? p.alerts : [],
              recommendations: Array.isArray(p.recommendations) ? p.recommendations : [],
              timeToAction: typeof p.timeToAction === 'string' ? p.timeToAction : 'monitor',
              explanation: typeof p.explanation === 'string' ? p.explanation : '',
              summary: typeof p.summary === 'string' ? p.summary : '',
            };

            this.logger.debug(`Prediction model used: Gemini/${modelName}`);
            return {
              predictionId: String(
                (
                  await this.aiPredictionModel.create({
                    patientId: new Types.ObjectId(patientId),
                    mealId: mealId ? new Types.ObjectId(mealId) : null,
                    triggerType: mealId ? 'post_meal' : 'manual',
                    glucoseSnapshot,
                    mealSnapshot,
                    prediction: parsedPrediction,
                    isFallback: false,
                  })
                )._id,
              ),
              prediction: parsedPrediction,
              glucoseSnapshot,
              mealSnapshot: mealSnapshot,
              triggerType: mealId ? 'post_meal' : 'manual',
              createdAt: new Date(),
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const isModelNotFound =
              message.includes('[404 Not Found]') ||
              /model[s]?\/.+\s+is\s+not\s+found/i.test(message);

            if (isModelNotFound) {
              this.logger.warn(`Gemini model not available: ${modelName}. Trying next.`);
              continue;
            }

            this.logger.debug(`Gemini model ${modelName} failed: ${message}`);
            continue;
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Gemini prediction failed, falling back to Ollama: ${String(err)}`);
    }

    // ── 5b. Fallback to Ollama ──
    try {
      let raw = '';
      const modelCandidates = this.getPredictionModelCandidates();
      const ollamaUrl =
        this.configService.get<string>('OLLAMA_URL') ??
        'http://localhost:11434/api/generate';

      for (const modelName of modelCandidates) {
        try {
          const { data } = await axios.post(
            ollamaUrl,
            { model: modelName, system: SYSTEM_PROMPT, prompt: userPrompt, stream: false },
            { timeout: 240_000, headers: { 'Content-Type': 'application/json' } },
          );
          raw = ((data as { response?: string }).response ?? '').trim();
          this.logger.debug(`Prediction model used: Ollama/${modelName}`);
          break;
        } catch (err) {
          if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const payload = JSON.stringify(err.response?.data ?? {});
            const isModelNotFound =
              status === 404 && /model\s+'.*'\s+not\s+found/i.test(payload);

            if (isModelNotFound) {
              this.logger.warn(`Prediction model not found: ${modelName}. Trying next model.`);
              continue;
            }
          }
          throw err;
        }
      }

      if (!raw) {
        throw new Error(`No usable Ollama prediction model found. Tried: ${modelCandidates.join(', ')}`);
      }

      const stripped = raw.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
      const match = stripped.match(/\{[\s\S]*\}/);

      if (!match) throw new Error('No JSON object in Ollama response');

      const jsonPayload = this.repairMalformedJson(match[0]);
      const p = JSON.parse(jsonPayload) as Partial<PredictionResult>;

      // Reject if Ollama echoed back template placeholders instead of real values
      const hasTemplatePlaceholders =
        (Array.isArray(p.recommendations) && p.recommendations.some(isTemplatePlaceholder)) ||
        (Array.isArray(p.alerts) && p.alerts.some(isTemplatePlaceholder));
      if (hasTemplatePlaceholders) {
        throw new Error('Response contains template placeholders — model did not process the prompt correctly');
      }

      parsedPrediction = {
        trend: typeof p.trend === 'string' ? p.trend : 'stable',
        confidence: toNum(p.confidence, 50),
        estimatedValue2h: toNum(p.estimatedValue2h, glucoseSnapshot.lastValue),
        estimatedValue4h: toNum(p.estimatedValue4h, glucoseSnapshot.lastValue),
        riskLevel: typeof p.riskLevel === 'string' ? p.riskLevel : 'low',
        riskType: typeof p.riskType === 'string' ? p.riskType : 'none',
        alerts: Array.isArray(p.alerts) ? p.alerts : [],
        recommendations: Array.isArray(p.recommendations) ? p.recommendations : [],
        timeToAction: typeof p.timeToAction === 'string' ? p.timeToAction : 'monitor',
        explanation: typeof p.explanation === 'string' ? p.explanation : '',
        summary: typeof p.summary === 'string' ? p.summary : '',
      };
    } catch (err) {
      const reason = axios.isAxiosError(err)
        ? `${(err as any).code ?? 'AxiosError'}: ${(err as any).message}`
        : String(err);
      this.logger.warn(`Both Gemini and Ollama failed — using fallback. Reason: ${reason}`);
      parsedPrediction = this.fallbackPrediction(glucoseSnapshot, mealSnapshot);
      isFallback = true;
    }

    // Step 6 — Persist
    const saved = await this.aiPredictionModel.create({
      patientId: new Types.ObjectId(patientId),
      mealId: mealId ? new Types.ObjectId(mealId) : null,
      triggerType: mealId ? 'post_meal' : 'manual',
      glucoseSnapshot,
      mealSnapshot,
      prediction: parsedPrediction,
      isFallback,
    });

    // Step 7 — Return
    return {
      predictionId: String(saved._id),
      prediction: parsedPrediction,
      glucoseSnapshot,
      mealSnapshot: mealSnapshot,
      triggerType: saved.triggerType,
      createdAt: saved.createdAt,
    };
  }

  // ── 2. Fallback (local, never throws) ──────────────────────────────────────

  fallbackPrediction(
    glucoseSnapshot: GlucoseSnapshot,
    mealSnapshot?: MealSnapshot | null,
  ): PredictionResult {
    const lastValue = toNum(glucoseSnapshot.lastValue);
    let trend = 'stable';
    let estimatedValue2h = lastValue;
    let riskLevel = 'low';
    let riskType = 'none';

    if (mealSnapshot && toNum(mealSnapshot.carbs) > 50) {
      trend = 'increase';
      estimatedValue2h = lastValue + 40;
    } else if (mealSnapshot && toNum(mealSnapshot.carbs) > 30) {
      trend = 'increase';
      estimatedValue2h = lastValue + 20;
    }

    if (lastValue < 80) {
      trend = 'decrease';
      riskLevel = 'high';
      riskType = 'hypoglycemia_risk';
    }

    if (lastValue > 200) {
      riskLevel = 'high';
      riskType = 'hyperglycemia_risk';
    }

    if (estimatedValue2h > 250 || estimatedValue2h < 60) {
      riskLevel = 'critical';
    }

    return {
      trend,
      confidence: 40,
      estimatedValue2h,
      estimatedValue4h: estimatedValue2h - 10,
      riskLevel,
      riskType,
      alerts:
        riskLevel === 'critical'
          ? ['Consultez votre médecin immédiatement']
          : [],
      recommendations: [
        'Mesurez votre glycémie maintenant',
        'Vérifiez dans 1 heure',
        'Consultez votre médecin si symptômes',
      ],
      timeToAction: riskLevel === 'critical' ? 'immediate' : 'monitor',
      explanation: 'Prédiction basée sur vos données récentes.',
      summary: `Glycémie actuelle: ${lastValue} mg/dL. Surveillance recommandée.`,
    };
  }

  // ── 3. History ──────────────────────────────────────────────────────────────

  async getHistory(
    patientId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    data: AiPredictionDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const filter = { patientId: new Types.ObjectId(patientId) };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.aiPredictionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.aiPredictionModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── 4. Get by ID ────────────────────────────────────────────────────────────

  async getById(
    predictionId: string,
    requesterId: string,
  ): Promise<AiPredictionDocument> {
    const doc = await this.aiPredictionModel
      .findById(predictionId)
      .exec();

    if (!doc) {
      throw new NotFoundException(`Prediction ${predictionId} not found.`);
    }

    if (String(doc.patientId) !== requesterId) {
      throw new ForbiddenException(
        'You do not have access to this prediction.',
      );
    }

    return doc;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private buildGlucoseSnapshot(
    records: { value: number; measuredAt: Date; period: string | null }[],
  ): GlucoseSnapshot {
    if (records.length === 0) {
      return {
        recordsUsed: 0,
        average: 0,
        lastValue: 0,
        lastMeasuredAt: new Date(),
        min: 0,
        max: 0,
        hypoglycemiaCount: 0,
        hyperglycemiaCount: 0,
        trend: 'stable',
      };
    }

    const values = records.map((r) => toNum(r.value));
    const average = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const sorted = [...records].sort(
      (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
    );
    const latest = sorted[0];

    // Trend: compare avg of older half vs newer half
    const half = Math.floor(values.length / 2);
    let trend = 'stable';
    if (values.length >= 4) {
      const olderAvg =
        values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
      const newerAvg =
        values.slice(0, half).reduce((a, b) => a + b, 0) / half;
      if (newerAvg > olderAvg + 10)  trend = 'worsening';
      else if (newerAvg < olderAvg - 10) trend = 'improving';
    }

    return {
      recordsUsed: records.length,
      average,
      lastValue: toNum(latest.value),
      lastMeasuredAt: latest.measuredAt,
      min: Math.min(...values),
      max: Math.max(...values),
      hypoglycemiaCount: values.filter((v) => v < 70).length,
      hyperglycemiaCount: values.filter((v) => v > 180).length,
      trend,
    };
  }

  private getPredictionModelCandidates(): string[] {
    const ordered = [
      process.env.OLLAMA_TEXT_MODEL,
      process.env.OLLAMA_MODEL,
      'llava:latest',
      'llama3.1:8b',
      'llama3.2:3b',
      'llama3.1',
      'llama3.2',
      'mistral:7b',
      'qwen2.5:7b',
      'llava:13b',
    ].filter((v): v is string => Boolean(v && v.trim()));

    return [...new Set(ordered.map((v) => v.trim()))];
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

  private repairMalformedJson(input: string): string {
    // Some local models output invalid escape sequences in JSON strings.
    return input.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
  }
}
