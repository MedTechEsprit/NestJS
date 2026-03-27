import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { AiPattern, AiPatternDocument } from './schemas/ai-pattern.schema';
import { GlucoseService } from '../glucose/glucose.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { PatternQueryDto } from './dto/pattern-query.dto';

const OLLAMA_URL =
  process.env.OLLAMA_URL ?? 'http://localhost:11434/api/generate';
const RECORDS_LIMIT = 500;
const MEALS_LIMIT = 200;
const MIN_RECORDS_REQUIRED = 10;
const OLLAMA_TIMEOUT = 240_000;

const PATTERN_SYSTEM_PROMPT =
  `You are an expert endocrinologist and data analyst ` +
  `specialized in diabetic glucose pattern recognition.\n` +
  `Your job is to analyze 30-day glucose data and identify dangerous patterns.\n` +
  `RULES:\n` +
  `1. Respond ONLY with a valid JSON object — no markdown, no prose, no explanation.\n` +
  `2. Base ALL analysis strictly on the statistical data provided.\n` +
  `3. Never invent data not present in the input.\n` +
  `4. Be precise with numerical values — use the exact numbers from the input stats.\n` +
  `5. riskLevel must be one of: 'low' | 'moderate' | 'high' | 'critical'\n` +
  `6. trend must be one of: 'improving' | 'stable' | 'worsening' | 'critical'\n` +
  `7. controlLevel must be one of: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical'\n` +
  `8. urgencyLevel must be one of: 'routine' | 'soon' | 'urgent' | 'emergency'`;

@Injectable()
export class AiPatternService {
  private readonly logger = new Logger(AiPatternService.name);

  constructor(
    @InjectModel(AiPattern.name)
    private readonly aiPatternModel: Model<AiPatternDocument>,
    private readonly glucoseService: GlucoseService,
    private readonly nutritionService: NutritionService,
  ) {}

  // ── Utility helpers ──────────────────────────────────────────────────────

  private avg(values: number[]): number {
    if (!values.length) return 0;
    return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  }

  private isInDayRange(
    date: Date,
    fromDay: number,
    toDay: number,
    thirtyDaysAgo: Date,
  ): boolean {
    const target = new Date(date);
    const diffDays = Math.floor(
      (target.getTime() - thirtyDaysAgo.getTime()) / (24 * 60 * 60 * 1000),
    );
    return diffDays >= fromDay - 1 && diffDays <= toDay - 1;
  }

  private parseOllamaJson(text: string, logContext = ''): any {
    this.logger.debug(`[parseOllamaJson${logContext}] raw length=${text.length}, first 300 chars: ${text.slice(0, 300)}`);

    let cleaned = text;

    // 1. Strip markdown code fences
    cleaned = cleaned.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

    // 2. Strip // line comments (outside strings — approximate but covers LLM output)
    cleaned = cleaned.replace(/\/\/[^\n]*/g, '');

    // 3. Strip /* */ block comments
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

    // 4. Extract outermost { ... } block
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error(`No JSON object found. Raw snippet: ${text.slice(0, 200)}`);
    }
    cleaned = cleaned.slice(start, end + 1);

    // 5. Fix trailing commas before } or ]
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

    // 6. Strip ANY non-JSON text after a bare numeric JSON value
    //    Only matches when the number is a direct value (after "key": N ...)
    //    NOT inside a string. Examples fixed:
    //      "avgSpikeValue": 205 mg/dL   → "avgSpikeValue": 205
    //      "frequency": 8 spikes detected → "frequency": 8
    //      "hba1cEstimate": 7.2 (est.)  → "hba1cEstimate": 7.2
    //    Does NOT corrupt "avgTimeOfOccurrence": "04:30 AM"
    cleaned = cleaned.replace(
      /("[\w]+")\s*:\s*(\d+(?:\.\d+)?)\s+[^,}\]\n"]+/g,
      '$1: $2',
    );

    // 6. Fix unquoted true/false/null values that may be written as words (already valid JSON,
    //    but sometimes LLMs write True/False/None — Python style)
    cleaned = cleaned
      .replace(/:\s*True\b/g, ': true')
      .replace(/:\s*False\b/g, ': false')
      .replace(/:\s*None\b/g, ': null');

    // 7. Fix single-quoted string keys and values
    cleaned = cleaned.replace(/([{,\[]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'\s*:/g, '$1"$2":');
    cleaned = cleaned.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"');

    // 8. Collapse literal newlines inside string values (between opening " and closing ")
    //    Replace \n inside strings with \\n so JSON.parse accepts it
    cleaned = cleaned.replace(/"((?:[^"\\]|\\.)*)"/gs, (_, inner: string) => {
      const escaped = inner
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      return `"${escaped}"`;
    });

    // 9. First parse attempt
    try {
      return JSON.parse(cleaned);
    } catch (e1) {
      this.logger.debug(`[parseOllamaJson] first parse failed: ${(e1 as Error).message}. Cleaned snippet: ${cleaned.slice(0, 400)}`);
    }

    // 10. Second attempt: strip all control characters except standard whitespace
    const sanitized = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    try {
      return JSON.parse(sanitized);
    } catch (e2) {
      this.logger.warn(`[parseOllamaJson] both parse attempts failed: ${(e2 as Error).message}`);
      throw e2;
    }
  }

  // ── Main: analyzePatterns ────────────────────────────────────────────────

  async analyzePatterns(
    patientId: string,
    triggerType: 'manual' | 'cron',
  ): Promise<AiPatternDocument> {
    // ── Step 1: Fetch data ───────────────────────────────────────────────
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [records, mealsRaw] = await Promise.all([
      this.glucoseService
        .findByDateRange(patientId, thirtyDaysAgo, now)
        .catch(() => [] as any[]),
      this.nutritionService
        .findAllMeals(patientId, thirtyDaysAgo, now)
        .catch(() => [] as any[]),
    ]);

    const meals: any[] = Array.isArray(mealsRaw)
      ? mealsRaw
      : (mealsRaw as any).data ?? [];

    if ((records as any[]).length < MIN_RECORDS_REQUIRED) {
      throw new BadRequestException(
        'Pas assez de données pour analyser les patterns (minimum 10 mesures requises).',
      );
    }

    const recs: any[] = records as any[];

    // ── Step 2: Compute local stats ──────────────────────────────────────

    const dayNames = [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday',
      'Thursday', 'Friday', 'Saturday',
    ];

    // Group by hour
    const recordsByHour: Record<string, number[]> = {};
    recs.forEach((r) => {
      const hour = new Date(r.measuredAt).getHours().toString().padStart(2, '0');
      if (!recordsByHour[hour]) recordsByHour[hour] = [];
      recordsByHour[hour].push(Number(r.value));
    });
    const hourlyAverages = Object.entries(recordsByHour)
      .map(([hour, values]) => ({
        hour,
        avg: this.avg(values),
        count: values.length,
      }))
      .sort((a, b) => b.avg - a.avg);

    // Group by day of week
    const recordsByDay: Record<string, number[]> = {};
    recs.forEach((r) => {
      const day = dayNames[new Date(r.measuredAt).getDay()];
      if (!recordsByDay[day]) recordsByDay[day] = [];
      recordsByDay[day].push(Number(r.value));
    });

    // Group by week (relative to 30 days ago)
    const week1Records = recs.filter((r) =>
      this.isInDayRange(r.measuredAt, 1, 7, thirtyDaysAgo),
    );
    const week2Records = recs.filter((r) =>
      this.isInDayRange(r.measuredAt, 8, 14, thirtyDaysAgo),
    );
    const week3Records = recs.filter((r) =>
      this.isInDayRange(r.measuredAt, 15, 21, thirtyDaysAgo),
    );
    const week4Records = recs.filter((r) =>
      this.isInDayRange(r.measuredAt, 22, 30, thirtyDaysAgo),
    );
    const weeklyAverages = {
      week1: this.avg(week1Records.map((r) => Number(r.value))),
      week2: this.avg(week2Records.map((r) => Number(r.value))),
      week3: this.avg(week3Records.map((r) => Number(r.value))),
      week4: this.avg(week4Records.map((r) => Number(r.value))),
    };

    // Nocturnal records (22h-06h)
    const nocturnalRecords = recs.filter((r) => {
      const h = new Date(r.measuredAt).getHours();
      return h >= 22 || h <= 6;
    });
    const nocturnalHypos = nocturnalRecords.filter((r) => Number(r.value) < 70);
    const nocturnalHypoDays = [
      ...new Set(
        nocturnalHypos.map((r) => dayNames[new Date(r.measuredAt).getDay()]),
      ),
    ];
    const avgHypoHour =
      nocturnalHypos.length > 0
        ? Math.round(
            nocturnalHypos.reduce(
              (s, r) => s + new Date(r.measuredAt).getHours(),
              0,
            ) / nocturnalHypos.length,
          )
        : 2;
    const avgHypoTime = `0${avgHypoHour}:30 AM`;

    // Post-meal spikes
    const postMealRecords = recs.filter((r) => r.period === 'after_meal');
    const postMealSpikes = postMealRecords.filter((r) => Number(r.value) > 180);
    const avgSpikeValue = this.avg(postMealSpikes.map((r) => Number(r.value)));

    const spikesByPeriod = {
      after_breakfast: 0,
      after_lunch: 0,
      after_dinner: 0,
    };
    postMealSpikes.forEach((r) => {
      const h = new Date(r.measuredAt).getHours();
      if (h >= 7 && h < 11) spikesByPeriod.after_breakfast++;
      else if (h >= 11 && h < 15) spikesByPeriod.after_lunch++;
      else if (h >= 18 && h < 23) spikesByPeriod.after_dinner++;
    });
    const mostAffectedPeriod = (
      Object.entries(spikesByPeriod).sort(([, a], [, b]) => b - a)[0][0]
    );

    const avgDailyCarbs =
      meals.length > 0
        ? Math.round(
            meals.reduce((s, m) => s + (m.carbs ?? 0), 0) / meals.length,
          )
        : 0;
    const highCarbMeals = meals.filter((m) => (m.carbs ?? 0) > 60).length;

    // Global stats
    const allValues = recs.map((r) => Number(r.value));
    const avgGlucose = this.avg(allValues);
    const minGlucose = Math.min(...allValues);
    const maxGlucose = Math.max(...allValues);
    const hba1cEstimate =
      Math.round(((avgGlucose + 46.7) / 28.7) * 10) / 10;
    const inRangeCount = recs.filter(
      (r) => Number(r.value) >= 70 && Number(r.value) <= 180,
    ).length;
    const timeInRange = Math.round((inRangeCount / recs.length) * 100);
    const hypoglycemiaCount = recs.filter((r) => Number(r.value) < 70).length;
    const hyperglycemiaCount = recs.filter((r) => Number(r.value) > 180).length;

    // Overall trend
    let overallTrend = 'stable';
    if (weeklyAverages.week4 > weeklyAverages.week1 + 15)
      overallTrend = 'worsening';
    else if (weeklyAverages.week1 > weeklyAverages.week4 + 15)
      overallTrend = 'improving';

    // Risk hours
    const highRiskHours = hourlyAverages
      .filter((h) => h.count >= 2 && (h.avg > 180 || h.avg < 70))
      .slice(0, 3)
      .map(
        (h) =>
          `${h.hour}:00-${String(parseInt(h.hour) + 2).padStart(2, '0')}:00`,
      );
    const lowRiskHours = hourlyAverages
      .filter((h) => h.count >= 2 && h.avg >= 80 && h.avg <= 140)
      .slice(-3)
      .map(
        (h) =>
          `${h.hour}:00-${String(parseInt(h.hour) + 2).padStart(2, '0')}:00`,
      );
    const highRiskDays = Object.entries(recordsByDay)
      .map(([day, vals]) => ({ day, avg: this.avg(vals) }))
      .filter((d) => d.avg > 180 || d.avg < 70)
      .map((d) => d.day);

    // Bundle all local stats so fallback can use them
    const localStats = {
      avgGlucose, minGlucose, maxGlucose, hba1cEstimate, timeInRange,
      hypoglycemiaCount, hyperglycemiaCount, weeklyAverages,
      nocturnalHypos, nocturnalHypoDays, avgHypoTime,
      postMealSpikes, avgSpikeValue, mostAffectedPeriod, avgDailyCarbs,
      overallTrend, highRiskHours, lowRiskHours, highRiskDays,
      hourlyAverages, recordsByDay,
      week1Records, week2Records, week3Records, week4Records,
    };

    // ── Step 3: Build Ollama prompt ──────────────────────────────────────
    const statsContext = [
      `PATIENT 30-DAY GLUCOSE ANALYSIS:`,
      `Total records analyzed: ${recs.length}`,
      `Analysis period: last 30 days`,
      `Overall average: ${avgGlucose} mg/dL`,
      `Min: ${minGlucose} mg/dL | Max: ${maxGlucose} mg/dL`,
      `HbA1c estimate: ${hba1cEstimate}%`,
      `Time in range (70-180 mg/dL): ${timeInRange}%`,
      `Total hypoglycemia episodes (<70): ${hypoglycemiaCount}`,
      `Total hyperglycemia episodes (>180): ${hyperglycemiaCount}`,
      ``,
      `WEEKLY PROGRESSION (detecting degradation):`,
      `Week 1 (days 1-7):   ${weeklyAverages.week1} mg/dL (${week1Records.length} records)`,
      `Week 2 (days 8-14):  ${weeklyAverages.week2} mg/dL (${week2Records.length} records)`,
      `Week 3 (days 15-21): ${weeklyAverages.week3} mg/dL (${week3Records.length} records)`,
      `Week 4 (days 22-30): ${weeklyAverages.week4} mg/dL (${week4Records.length} records)`,
      `Overall trend: ${overallTrend}`,
      ``,
      `NOCTURNAL HYPOGLYCEMIA PATTERN (22h-06h):`,
      `Total nocturnal records: ${nocturnalRecords.length}`,
      `Hypoglycemia episodes at night (<70 mg/dL): ${nocturnalHypos.length}`,
      `Nocturnal hypo rate: ${
        nocturnalRecords.length > 0
          ? Math.round((nocturnalHypos.length / nocturnalRecords.length) * 100)
          : 0
      }%`,
      `Most affected days: ${nocturnalHypoDays.join(', ') || 'none'}`,
      `Average time of occurrence: ${avgHypoTime}`,
      ``,
      `POST-MEAL SPIKE PATTERN:`,
      `Total post-meal records: ${postMealRecords.length}`,
      `Spikes >180 mg/dL after meals: ${postMealSpikes.length}`,
      `Spike rate: ${
        postMealRecords.length > 0
          ? Math.round((postMealSpikes.length / postMealRecords.length) * 100)
          : 0
      }%`,
      `Average spike value: ${avgSpikeValue} mg/dL`,
      `Most affected meal period: ${mostAffectedPeriod}`,
      ``,
      `HOURLY RISK PROFILE (hours with ≥2 records, sorted by avg):`,
      ...hourlyAverages
        .filter((h) => h.count >= 2)
        .slice(0, 6)
        .map((h) => `  ${h.hour}:00 → avg ${h.avg} mg/dL (${h.count} records)`),
      ``,
      `DAILY RISK PROFILE:`,
      ...Object.entries(recordsByDay).map(
        ([day, vals]) => `  ${day}: avg ${this.avg(vals)} mg/dL`,
      ),
      ``,
      `NUTRITION DATA (last 30 days):`,
      `Total meals logged: ${meals.length}`,
      `Average meal carbs: ${avgDailyCarbs}g`,
      `High carb meals (>60g carbs): ${highCarbMeals}`,
    ].join('\n');

    const userPrompt =
      statsContext +
      `\n\nBased on the above 30-day statistics, analyze all 4 patterns.\n` +
      `Respond with ONLY this JSON structure (no markdown, no extra text):\n` +
      `{\n` +
      `  "nocturnalHypoglycemia": {\n` +
      `    "detected": true or false,\n` +
      `    "frequency": exact number from stats,\n` +
      `    "avgTimeOfOccurrence": "HH:MM AM/PM",\n` +
      `    "riskLevel": "low|moderate|high|critical",\n` +
      `    "affectedDays": ["day1", "day2"],\n` +
      `    "recommendation": "specific actionable advice"\n` +
      `  },\n` +
      `  "postMealSpikes": {\n` +
      `    "detected": true or false,\n` +
      `    "frequency": exact number from stats,\n` +
      `    "avgSpikeValue": exact number,\n` +
      `    "mostAffectedPeriod": "after_breakfast|after_lunch|after_dinner",\n` +
      `    "avgCarbsOnSpikedMeals": number,\n` +
      `    "riskLevel": "low|moderate|high|critical",\n` +
      `    "recommendation": "specific actionable advice"\n` +
      `  },\n` +
      `  "riskTimeWindows": {\n` +
      `    "detected": true or false,\n` +
      `    "highRiskHours": ["HH:00-HH:00"],\n` +
      `    "highRiskDays": ["day1"],\n` +
      `    "lowRiskHours": ["HH:00-HH:00"],\n` +
      `    "pattern": "one sentence describing the pattern",\n` +
      `    "recommendation": "specific actionable advice"\n` +
      `  },\n` +
      `  "glycemicControlDegradation": {\n` +
      `    "detected": true or false,\n` +
      `    "trend": "improving|stable|worsening|critical",\n` +
      `    "week1Avg": number,\n` +
      `    "week2Avg": number,\n` +
      `    "week3Avg": number,\n` +
      `    "week4Avg": number,\n` +
      `    "hba1cEstimate": number,\n` +
      `    "timeInRange": number,\n` +
      `    "riskLevel": "low|moderate|high|critical",\n` +
      `    "recommendation": "specific actionable advice"\n` +
      `  },\n` +
      `  "overallAssessment": {\n` +
      `    "controlLevel": "excellent|good|acceptable|poor|critical",\n` +
      `    "criticalPatternsCount": number,\n` +
      `    "doctorConsultationNeeded": true or false,\n` +
      `    "urgencyLevel": "routine|soon|urgent|emergency",\n` +
      `    "topPriorities": ["priority 1", "priority 2", "priority 3"],\n` +
      `    "summary": "2-3 sentences summary for the patient"\n` +
      `  }\n` +
      `}`;

    // ── Step 4: Call Ollama with model fallback ──────────────────────────
    let parsedResult: any;
    let isFallback = false;
    const modelCandidates = this.getOllamaPatternModelCandidates();

    try {
      for (const modelName of modelCandidates) {
        try {
          const { data } = await axios.post(
            OLLAMA_URL,
            { model: modelName, system: PATTERN_SYSTEM_PROMPT, prompt: userPrompt, stream: false },
            { timeout: OLLAMA_TIMEOUT, headers: { 'Content-Type': 'application/json' } },
          );
          const text = ((data as any).response ?? '').trim();
          if (!text) throw new Error('Empty response from Ollama');
          this.logger.debug(`Pattern model used: ${modelName}`);
          parsedResult = this.parseOllamaJson(text, ` patient=${patientId}`);
          break;
        } catch (err) {
          if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const payload = JSON.stringify(err.response?.data ?? {});
            const isModelNotFound =
              status === 404 && /model\s+'.*'\s+not\s+found/i.test(payload);

            if (isModelNotFound) {
              this.logger.warn(`Pattern model not found: ${modelName}. Trying next model.`);
              continue;
            }
          }
          throw err;
        }
      }
    } catch (err) {
      this.logger.warn(
        `Ollama unavailable, using fallback pattern analysis: ${String(err)}`,
      );
      parsedResult = this.fallbackPatternAnalysis(localStats);
      isFallback = true;
    }

    // ── Step 5: Save & return ────────────────────────────────────────────
    const saved = await this.aiPatternModel.create({
      patientId: new Types.ObjectId(patientId),
      triggerType,
      analysisPeriod: {
        from: thirtyDaysAgo,
        to: now,
        totalDays: 30,
        totalRecords: recs.length,
      },
      globalStats: {
        avgGlucose,
        minGlucose,
        maxGlucose,
        hba1cEstimate,
        timeInRange,
        hypoglycemiaCount,
        hyperglycemiaCount,
        weeklyAverages,
      },
      nocturnalHypoglycemia: parsedResult.nocturnalHypoglycemia,
      postMealSpikes: parsedResult.postMealSpikes,
      riskTimeWindows: parsedResult.riskTimeWindows,
      glycemicControlDegradation: parsedResult.glycemicControlDegradation,
      overallAssessment: parsedResult.overallAssessment,
      isFallback,
    });

    return saved;
  }

  // ── Fallback: pure local analysis, must never throw ──────────────────────

  private fallbackPatternAnalysis(stats: any): any {
    try {
      const {
        nocturnalHypos, nocturnalHypoDays, avgHypoTime,
        postMealSpikes, avgSpikeValue, mostAffectedPeriod, avgDailyCarbs,
        overallTrend, weeklyAverages, highRiskHours, lowRiskHours, highRiskDays,
        hba1cEstimate, timeInRange,
      } = stats;

      // nocturnal
      const noctFreq: number = nocturnalHypos?.length ?? 0;
      const noctRisk =
        noctFreq >= 5 ? 'high' : noctFreq >= 2 ? 'moderate' : 'low';

      // post-meal
      const spikeFreq: number = postMealSpikes?.length ?? 0;
      const spikeRisk =
        avgSpikeValue > 220 ? 'high' : avgSpikeValue > 190 ? 'moderate' : 'low';

      // degradation
      const degraded = overallTrend === 'worsening';
      const hba1c: number = hba1cEstimate ?? 0;
      const tir: number = timeInRange ?? 0;
      const degradRisk =
        hba1c > 8 ? 'high' : hba1c > 7 ? 'moderate' : 'low';

      // risk windows
      const hasRiskWindows = (highRiskHours?.length ?? 0) > 0;

      // overall
      const criticalRisks = [noctRisk, spikeRisk, degradRisk].filter(
        (r) => r === 'high' || r === 'critical',
      ).length;
      const doctorNeeded = criticalRisks >= 2 || hba1c > 8;
      const urgency =
        criticalRisks >= 3
          ? 'emergency'
          : criticalRisks >= 2
          ? 'urgent'
          : doctorNeeded
          ? 'soon'
          : 'routine';
      const controlLevel =
        tir >= 70 && hba1c < 7
          ? 'good'
          : tir >= 50
          ? 'acceptable'
          : hba1c > 9
          ? 'critical'
          : 'poor';

      const topPriorities: string[] = [];
      if (noctFreq > 0)
        topPriorities.push('Monitor and adjust nighttime glucose management');
      if (spikeFreq > 0)
        topPriorities.push('Review carbohydrate intake at meals');
      if (degraded) topPriorities.push('Address worsening glycemic trend');
      while (topPriorities.length < 3)
        topPriorities.push('Continue regular glucose monitoring');

      return {
        nocturnalHypoglycemia: {
          detected: noctFreq > 0,
          frequency: noctFreq,
          avgTimeOfOccurrence: avgHypoTime ?? '02:30 AM',
          riskLevel: noctRisk,
          affectedDays: nocturnalHypoDays ?? [],
          recommendation:
            noctRisk === 'high'
              ? 'Consult your doctor immediately about nocturnal hypoglycemia management.'
              : noctRisk === 'moderate'
              ? 'Consider a bedtime snack and alert your doctor at next visit.'
              : 'Continue monitoring nighttime glucose levels.',
        },
        postMealSpikes: {
          detected: spikeFreq > 0,
          frequency: spikeFreq,
          avgSpikeValue: avgSpikeValue ?? 0,
          mostAffectedPeriod: mostAffectedPeriod ?? 'after_dinner',
          avgCarbsOnSpikedMeals: avgDailyCarbs ?? 0,
          riskLevel: spikeRisk,
          recommendation:
            spikeRisk === 'high'
              ? 'Significantly reduce carbohydrate intake and contact your diabetes team.'
              : spikeRisk === 'moderate'
              ? 'Reduce portion sizes and high-glycemic foods at affected meals.'
              : 'Monitor post-meal readings and adjust diet as needed.',
        },
        riskTimeWindows: {
          detected: hasRiskWindows,
          highRiskHours: highRiskHours ?? [],
          highRiskDays: highRiskDays ?? [],
          lowRiskHours: lowRiskHours ?? [],
          pattern: 'Calculated from local statistics',
          recommendation: hasRiskWindows
            ? 'Plan activities and meals carefully during identified high-risk time windows.'
            : 'No specific high-risk time windows detected — continue regular monitoring.',
        },
        glycemicControlDegradation: {
          detected: degraded,
          trend: overallTrend ?? 'stable',
          week1Avg: weeklyAverages?.week1 ?? 0,
          week2Avg: weeklyAverages?.week2 ?? 0,
          week3Avg: weeklyAverages?.week3 ?? 0,
          week4Avg: weeklyAverages?.week4 ?? 0,
          hba1cEstimate: hba1c,
          timeInRange: tir,
          riskLevel: degradRisk,
          recommendation: degraded
            ? 'Your glucose control is worsening. Schedule an appointment with your doctor soon.'
            : 'Maintain current management and continue regular monitoring.',
        },
        overallAssessment: {
          controlLevel,
          criticalPatternsCount: criticalRisks,
          doctorConsultationNeeded: doctorNeeded,
          urgencyLevel: urgency,
          topPriorities: topPriorities.slice(0, 3),
          summary:
            `Your 30-day glucose analysis shows ${controlLevel} overall control ` +
            `with an estimated HbA1c of ${hba1c}% and ${tir}% time in range. ` +
            `${doctorNeeded ? 'A consultation with your doctor is recommended.' : 'Keep up your current management plan.'}`,
        },
      };
    } catch {
      // Absolute last resort — should never happen
      return {
        nocturnalHypoglycemia: {
          detected: false, frequency: 0, avgTimeOfOccurrence: '02:30 AM',
          riskLevel: 'low', affectedDays: [],
          recommendation: 'Continue regular monitoring.',
        },
        postMealSpikes: {
          detected: false, frequency: 0, avgSpikeValue: 0,
          mostAffectedPeriod: 'after_dinner', avgCarbsOnSpikedMeals: 0,
          riskLevel: 'low', recommendation: 'Continue regular monitoring.',
        },
        riskTimeWindows: {
          detected: false, highRiskHours: [], highRiskDays: [],
          lowRiskHours: [], pattern: 'Data analysis unavailable.',
          recommendation: 'Continue regular monitoring.',
        },
        glycemicControlDegradation: {
          detected: false, trend: 'stable', week1Avg: 0, week2Avg: 0,
          week3Avg: 0, week4Avg: 0, hba1cEstimate: 0, timeInRange: 0,
          riskLevel: 'low', recommendation: 'Continue regular monitoring.',
        },
        overallAssessment: {
          controlLevel: 'acceptable', criticalPatternsCount: 0,
          doctorConsultationNeeded: false, urgencyLevel: 'routine',
          topPriorities: ['Continue regular glucose monitoring'],
          summary: 'Fallback analysis — please re-run once data is available.',
        },
      };
    }
  }

  private getOllamaPatternModelCandidates(): string[] {
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

  // ── getLatestAnalysis ────────────────────────────────────────────────────

  async getLatestAnalysis(patientId: string): Promise<AiPatternDocument | null> {
    return this.aiPatternModel
      .findOne({ patientId: new Types.ObjectId(patientId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  // ── getHistory ───────────────────────────────────────────────────────────

  async getHistory(
    patientId: string,
    query: PatternQueryDto,
  ): Promise<{
    data: AiPatternDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filter: Record<string, unknown> = {
      patientId: new Types.ObjectId(patientId),
    };
    if (query.triggerType) filter.triggerType = query.triggerType;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.aiPatternModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.aiPatternModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  // ── getById ──────────────────────────────────────────────────────────────

  async getById(id: string, patientId: string): Promise<AiPatternDocument> {
    const doc = await this.aiPatternModel
      .findOne({
        _id: new Types.ObjectId(id),
        patientId: new Types.ObjectId(patientId),
      })
      .exec();
    if (!doc) throw new NotFoundException('Analyse de patterns introuvable.');
    return doc;
  }
}
