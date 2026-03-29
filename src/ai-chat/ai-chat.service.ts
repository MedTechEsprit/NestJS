import {
  Injectable,
  HttpException,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { GlucoseService } from '../glucose/glucose.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { Meal } from '../nutrition/schemas/meal.schema';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434/api/generate';
const GLUCOSE_RECORDS_LIMIT = 20;
const MEALS_LIMIT = 10;

const SYSTEM_PROMPT_TEMPLATE = `Tu es MediBot, un assistant médical IA chaleureux et compétent, spécialisé dans l'accompagnement des patients diabétiques.

Ton rôle :
- Répondre à TOUTES les questions liées au diabète, à la glycémie, à l'insuline, à la nutrition, aux repas, au sport, au mode de vie, au stress, au sommeil, et à la santé en général des diabétiques.
- Utiliser les données réelles du patient ci-dessous pour personnaliser tes réponses.
- Répondre dans la MÊME langue que la question du patient (français, arabe, anglais, etc.).
- Être encourageant, clair et pratique. Éviter le jargon médical excessif.
- Préciser que tu ne remplaces pas un médecin quand c'est pertinent.
- Recommander de consulter un médecin si la glycémie dépasse 250 ou descend sous 60 mg/dL.

Règle unique de refus : si la question n'a AUCUN rapport avec la santé (ex: politique, sport professionnel, programmation, météo, divertissement), réponds : "Je suis spécialisé dans le diabète et la santé. Posez-moi une question sur votre glycémie, nutrition ou traitement !"

--- DONNÉES DU PATIENT ---
GLYCÉMIE RÉCENTE :
{GLUCOSE_RECORDS}
STATISTIQUES GLYCÉMIE :
{GLUCOSE_STATS}
REPAS RÉCENTS :
{RECENT_MEALS}
STATISTIQUES NUTRITION :
{NUTRITION_STATS}
--- FIN DES DONNÉES ---`;

export interface GlucoseStats {
  average: number;
  min: number;
  max: number;
  hypoglycemiaCount: number;
  hyperglycemiaCount: number;
  lastValue: number;
  lastMeasuredAt: string;
  trend: string;
}

export interface NutritionStats {
  avgDailyCalories: number;
  avgDailyCarbs: number;
  avgDailyProtein: number;
  avgDailyFat: number;
  totalMealsLogged: number;
  lastMealName: string;
  lastMealAt: string;
  lastMealCarbs: number;
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private readonly glucoseService: GlucoseService,
    private readonly nutritionService: NutritionService,
  ) {}

  async chat(
    userId: string,
    message: string,
  ): Promise<{
    response: string;
    context: {
      glucoseStats: GlucoseStats | null;
      nutritionStats: NutritionStats | null;
      recordsUsed: { glucoseCount: number; mealsCount: number };
    };
  }> {
    // Step 1 — Validate
    if (!message || message.trim().length < 2) {
      throw new BadRequestException('Message must be at least 2 characters long.');
    }
    if (message.length > 1000) {
      throw new BadRequestException('Message must not exceed 1000 characters.');
    }

    // Step 2 — Fetch patient data in parallel
    const [glucoseResult, mealsResult] = await Promise.all([
      this.glucoseService
        .findMyRecords(userId, { page: 1, limit: GLUCOSE_RECORDS_LIMIT })
        .catch(() => ({ data: [] as any[] })),
      this.nutritionService
        .findAllMeals(userId, undefined, undefined, { page: 1, limit: MEALS_LIMIT })
        .catch(() => ({ data: [] as any[] })),
    ]);

    const glucoseRecords: { value: number; measuredAt: Date; period: string | null }[] =
      Array.isArray((glucoseResult as any).data) ? (glucoseResult as any).data : [];

    const mealsPaginated = mealsResult as PaginatedResult<Meal>;
    const meals: Meal[] = Array.isArray(mealsPaginated.data) ? mealsPaginated.data : [];

    // Step 3 — Compute stats
    const glucoseStats = this.computeGlucoseStats(glucoseRecords);
    const nutritionStats = this.computeNutritionStats(meals);

    // Step 4 — Build context texts
    const glucoseRecordsText =
      glucoseRecords.length > 0
        ? glucoseRecords
            .map(
              (r) =>
                `${r.value} mg/dL (${r.period ?? 'unknown'}, ${new Date(r.measuredAt).toLocaleDateString()})`,
            )
            .join(' | ')
        : 'No glucose records available yet.';

    const recentMealsText =
      meals.length > 0
        ? meals
            .map(
              (m) =>
                `${m.name}: ${m.calories ?? 0}kcal, ${m.carbs}g carbs` +
                ` (${new Date((m as any).eatenAt).toLocaleDateString()})`,
            )
            .join(' | ')
        : 'No meals logged yet.';

    const glucoseStatsText = glucoseStats
      ? `Average: ${glucoseStats.average} mg/dL | Last: ${glucoseStats.lastValue} mg/dL | ` +
        `Min: ${glucoseStats.min} | Max: ${glucoseStats.max} | ` +
        `Hypo episodes (<70): ${glucoseStats.hypoglycemiaCount} | ` +
        `Hyper episodes (>180): ${glucoseStats.hyperglycemiaCount} | ` +
        `Trend: ${glucoseStats.trend}`
      : 'No glucose statistics available yet.';

    const nutritionStatsText = nutritionStats
      ? `Avg daily calories: ${nutritionStats.avgDailyCalories} kcal | ` +
        `Avg daily carbs: ${nutritionStats.avgDailyCarbs}g | ` +
        `Avg daily protein: ${nutritionStats.avgDailyProtein}g | ` +
        `Last meal: "${nutritionStats.lastMealName}" (${nutritionStats.lastMealCarbs}g carbs)`
      : 'No nutrition statistics available yet.';

    // Step 5 — Inject data into system prompt
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE
      .replace('{GLUCOSE_RECORDS}', glucoseRecordsText)
      .replace('{GLUCOSE_STATS}', glucoseStatsText)
      .replace('{RECENT_MEALS}', recentMealsText)
      .replace('{NUTRITION_STATS}', nutritionStatsText);

    // Step 6 — Call Ollama with model fallback
    let aiResponse: string = '';
    const modelCandidates = this.getOllamaChatModelCandidates();
    let lastError: unknown = null;

    try {
      for (const modelName of modelCandidates) {
        try {
          const { data } = await axios.post(
            OLLAMA_URL,
            { model: modelName, system: systemPrompt, prompt: message, stream: false },
            { timeout: 240_000, headers: { 'Content-Type': 'application/json' } },
          );
          aiResponse = ((data as { response?: string }).response ?? '').trim();
          if (!aiResponse) throw new Error('Empty response from Ollama');
          this.logger.debug(`Chat model used: ${modelName}`);
          break;
        } catch (err) {
          lastError = err;
          if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const payload = JSON.stringify(err.response?.data ?? {});
            const isModelNotFound =
              status === 404 && /model\s+'.*'\s+not\s+found/i.test(payload);

            if (isModelNotFound) {
              this.logger.warn(`Chat model not found: ${modelName}. Trying next model.`);
              continue;
            }
          }
          throw err;
        }
      }

      if (!aiResponse) {
        throw new Error(`No usable Ollama chat model found. Tried: ${modelCandidates.join(', ')}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosErr = error as AxiosError;
        if (!axiosErr.response || axiosErr.code === 'ECONNREFUSED') {
          this.logger.error(`Ollama unreachable: ${axiosErr.code} — ${axiosErr.message}`);
          throw new HttpException(
            "Le service IA (Ollama) n'est pas disponible. Vérifiez qu'Ollama tourne sur http://localhost:11434.",
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        if (axiosErr.code === 'ECONNABORTED') {
          this.logger.error(`Ollama timeout: ${axiosErr.message}`);
          throw new HttpException(
            'Le service IA est temporairement indisponible. Réessayez dans quelques instants.',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        this.logger.error(
          `Ollama HTTP ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data)}`,
        );
        throw new HttpException(
          'Le service IA a retourné une erreur. Réessayez dans quelques instants.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      this.logger.error(`Unexpected Ollama error: ${String(error)}`);
      throw new HttpException('Une erreur inattendue est survenue.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Step 7 — Return
    return {
      response: aiResponse,
      context: {
        glucoseStats,
        nutritionStats,
        recordsUsed: {
          glucoseCount: glucoseRecords.length,
          mealsCount: meals.length,
        },
      },
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private computeGlucoseStats(
    records: { value: number; measuredAt: Date; period: string | null }[],
  ): GlucoseStats | null {
    if (records.length === 0) return null;

    const values = records.map((r) => r.value);
    const average = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const hypoglycemiaCount = values.filter((v) => v < 70).length;
    const hyperglycemiaCount = values.filter((v) => v > 180).length;

    const sorted = [...records].sort(
      (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
    );
    const latest = sorted[0];

    // Trend: compare avg of older half vs newer half of records
    const half = Math.floor(values.length / 2);
    let trend = 'stable';
    if (values.length >= 4) {
      const olderAvg =
        values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
      const newerAvg = values.slice(0, half).reduce((a, b) => a + b, 0) / half;
      if (newerAvg < olderAvg - 5) trend = 'improving';
      else if (newerAvg > olderAvg + 5) trend = 'worsening';
    }

    return {
      average,
      min,
      max,
      hypoglycemiaCount,
      hyperglycemiaCount,
      lastValue: latest.value,
      lastMeasuredAt: new Date(latest.measuredAt).toLocaleString(),
      trend,
    };
  }

  private computeNutritionStats(meals: Meal[]): NutritionStats | null {
    if (meals.length === 0) return null;

    const totalCalories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
    const totalCarbs = meals.reduce((s, m) => s + (m.carbs ?? 0), 0);
    const totalProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
    const totalFat = meals.reduce((s, m) => s + (m.fat ?? 0), 0);

    const days =
      new Set(meals.map((m) => new Date((m as any).eatenAt).toLocaleDateString())).size || 1;

    const last = meals[0]; // sorted by eatenAt desc
    return {
      avgDailyCalories: Math.round(totalCalories / days),
      avgDailyCarbs: Math.round(totalCarbs / days),
      avgDailyProtein: Math.round(totalProtein / days),
      avgDailyFat: Math.round(totalFat / days),
      totalMealsLogged: meals.length,
      lastMealName: last.name,
      lastMealAt: new Date((last as any).eatenAt).toLocaleString(),
      lastMealCarbs: last.carbs ?? 0,
    };
  }

  private getOllamaChatModelCandidates(): string[] {
    const ordered = [
      'llava:latest',
      'llava:13b',
      'llava',
      'llama3.1:8b',
      'llama3.2:3b',
      'llama3.1',
      'llama3.2',
      'mistral:7b',
      'qwen2.5:7b',
    ].filter((v): v is string => Boolean(v && v.trim()));

    return [...new Set(ordered.map((v) => v.trim()))];
  }
}
