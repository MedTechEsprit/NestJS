import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios, { AxiosError } from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GlucoseService } from '../glucose/glucose.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { MedecinsService } from '../medecins/medecins.service';
import { PatientsService } from '../patients/patients.service';
import { Medecin, MedecinDocument } from '../medecins/schemas/medecin.schema';
import {
  AiDoctorChat,
  AiDoctorChatDocument,
} from './schemas/ai-doctor-chat.schema';
import {
  AiPrediction,
  AiPredictionDocument,
} from '../ai-prediction/schemas/ai-prediction.schema';

// MIGRATED TO GEMMA4
const OLLAMA_URL =
  process.env.OLLAMA_URL ??
  'https://semiexperimental-rolande-superbusily.ngrok-free.dev/v1/chat/completions';
const GLUCOSE_RECORDS_PER_PATIENT = 30;
const MEALS_PER_PATIENT = 10;
const MAX_PATIENTS_IN_CONTEXT = 20;

const REPORT_GLUCOSE_RECORDS = 90;
const REPORT_MEALS = 20;

const GEMINI_REPORT_SYSTEM_INSTRUCTION =
  `You are a senior diabetologist writing a professional clinical report for another physician.\n` +
  `Rules:\n` +
  `- Use only the provided patient data.\n` +
  `- If data is missing, explicitly write \"Not available\" instead of inventing.\n` +
  `- Keep medical tone, precise and actionable.\n` +
  `- Mention safety alerts and priorities first.\n` +
  `- Never prescribe exact medication doses.\n` +
  `- Return valid JSON only, no markdown, no extra text.\n`;

const SYSTEM_PROMPT_TEMPLATE =
  `You are MediAssist, an AI clinical decision support system for diabetologist doctors.\n` +
  `YOUR STRICT RULES:\n` +
  `You ONLY answer questions about diabetes management and patient analysis.\n` +
  `You NEVER prescribe medications — you suggest and alert only.\n` +
  `You ONLY have access to the doctor's own patients — never other patients.\n` +
  `Always end critical alerts with "Decision belongs to the treating physician."\n` +
  `Respond in the same language as the doctor's question.\n` +
  `Base ALL analysis strictly on the patient data provided.\n` +
  `Never invent or assume data not provided.\n` +
  `Flag immediately if any patient has: glucose > 250, HbA1c > 9%, ` +
  `or more than 5 nocturnal hypos in the last 30 days.\n\n` +
  `--- DOCTOR CONTEXT ---\n` +
  `Doctor: {DOCTOR_NAME}\n` +
  `Specialty: {SPECIALTY}\n` +
  `Total patients: {TOTAL_PATIENTS}\n` +
  `--- PATIENT DATA (injected at runtime) ---\n` +
  `{PATIENT_DATA}\n` +
  `--- END ---`;

/** Safe number coercion */
const toNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
};

@Injectable()
export class AiDoctorService {
  private readonly logger = new Logger(AiDoctorService.name);

  constructor(
    @InjectModel(AiDoctorChat.name)
    private readonly aiDoctorChatModel: Model<AiDoctorChatDocument>,
    @InjectModel('AiPrediction')
    private readonly aiPredictionModel: Model<AiPredictionDocument>,
    @InjectModel(Medecin.name)
    private readonly medecinModel: Model<MedecinDocument>,
    private readonly configService: ConfigService,
    private readonly glucoseService: GlucoseService,
    private readonly nutritionService: NutritionService,
    private readonly medecinsService: MedecinsService,
    private readonly patientsService: PatientsService,
  ) {}

  // ── Private: get doctor raw data directly from discriminator model ─────────

  private async getDoctorRaw(
    doctorId: string,
  ): Promise<{
    nom: string;
    prenom: string;
    specialite: string;
    listePatients: string[];
    patients: Array<{ id: string; name: string }>;
  }> {
    const doc = await this.medecinModel
      .findById(doctorId)
      .populate({ path: 'listePatients', select: 'nom prenom', strictPopulate: false })
      .lean()
      .exec();

    if (!doc) {
      throw new ForbiddenException('Médecin introuvable.');
    }

    const raw = doc as any;
    const patients: Array<{ id: string; name: string }> = (
      (raw.listePatients ?? []) as any[]
    ).map((p: any) => {
      if (p && typeof p === 'object' && p._id) {
        return {
          id: String(p._id),
          name: `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || String(p._id),
        };
      }
      return { id: String(p), name: String(p) };
    });

    return {
      nom: raw.nom ?? '',
      prenom: raw.prenom ?? '',
      specialite: raw.specialite ?? 'Diabétologue',
      listePatients: patients.map((p) => p.id),
      patients,
    };
  }

  // ── 1. Chat about a single patient ─────────────────────────────────────────

  async chatAboutPatient(
    doctorId: string,
    patientId: string,
    message: string,
  ): Promise<{
    response: string;
    queryType: string;
    patientId: string;
    context: { patientsAnalyzed: number; recordsAnalyzed: number };
  }> {
    // Step 1 — Verify ownership
    const doctor = await this.getDoctorRaw(doctorId);
    if (!doctor.listePatients.includes(patientId)) {
      throw new ForbiddenException('Ce patient ne fait pas partie de vos patients.');
    }

    // Step 2 — Doctor info
    const doctorName = `Dr. ${doctor.prenom} ${doctor.nom}`.trim();
    const specialty = doctor.specialite;

    // Step 3 — Detailed patient data
    const [glucoseResult, mealsResult] = await Promise.all([
      this.glucoseService
        .findMyRecords(patientId, { page: 1, limit: GLUCOSE_RECORDS_PER_PATIENT })
        .catch(() => ({ data: [] as any[] })),
      this.nutritionService
        .findAllMeals(patientId, undefined, undefined, { page: 1, limit: MEALS_PER_PATIENT })
        .catch(() => ({ data: [] as any[] })),
    ]);

    const records: any[] = (glucoseResult as any).data ?? [];
    const meals: any[] = (mealsResult as any).data ?? [];

    // ProfilMedical via patient summary
    const patientDisplayName =
      doctor.patients.find((p) => p.id === patientId)?.name ?? patientId;
    const patientSummary = await this.buildPatientSummary(patientId, patientDisplayName).catch(
      () => `Patient ${patientDisplayName} — data unavailable`,
    );

    // Full records detail
    const recordsDetail =
      records.length > 0
        ? records
            .map(
              (r) =>
                `${toNum(r.value)} mg/dL (${r.period ?? '?'}, ${new Date(r.measuredAt).toLocaleString()})`,
            )
            .join(' | ')
        : 'No glucose records.';

    const mealsDetail =
      meals.length > 0
        ? meals
            .map(
              (m) =>
                `${m.name}: ${toNum(m.calories)}kcal carbs:${toNum(m.carbs)}g ` +
                `(${new Date(m.eatenAt).toLocaleDateString()})`,
            )
            .join(' | ')
        : 'No meals logged.';

    const patientData =
      `${patientSummary}\n` +
      `DETAILED GLUCOSE (last ${records.length}): ${recordsDetail}\n` +
      `DETAILED MEALS (last ${meals.length}): ${mealsDetail}`;

    // Step 4 — Build system prompt
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{DOCTOR_NAME}', doctorName)
      .replace('{SPECIALTY}', specialty)
      .replace('{TOTAL_PATIENTS}', String(doctor.listePatients.length))
      .replace('{PATIENT_DATA}', patientData);

    // Step 5 — Call Ollama
    const aiResponse = await this.callOllama(systemPrompt, message, 240_000);

    // Step 6 — Persist
    await this.aiDoctorChatModel
      .create({
        doctorId: new Types.ObjectId(doctorId),
        patientId: new Types.ObjectId(patientId),
        queryType: 'single_patient',
        message,
        response: aiResponse,
        contextSnapshot: {
          patientsAnalyzed: 1,
          recordsAnalyzed: records.length,
          dataFrom: records.length > 0 ? new Date(records[records.length - 1].measuredAt) : null,
          dataTo: records.length > 0 ? new Date(records[0].measuredAt) : null,
        },
      })
      .catch((err: unknown) =>
        this.logger.warn(`AiDoctorChat persist failed: ${err}`),
      );

    return {
      response: aiResponse,
      queryType: 'single_patient',
      patientId,
      context: { patientsAnalyzed: 1, recordsAnalyzed: records.length },
    };
  }

  // ── 2. Chat about all patients ──────────────────────────────────────────────

  async chatAboutAllPatients(
    doctorId: string,
    message: string,
  ): Promise<{
    response: string;
    queryType: string;
    context: {
      patientsAnalyzed: number;
      urgentPatientsCount: number;
      recordsAnalyzed: number;
    };
  }> {
    const doctor = await this.getDoctorRaw(doctorId);
    const rawList = doctor.listePatients;

    if (rawList.length === 0) {
      throw new BadRequestException('Vous n\'avez pas encore de patients assignés.');
    }

    // Limit to most recent MAX_PATIENTS
    const patientObjs = doctor.patients.slice(-MAX_PATIENTS_IN_CONTEXT);

    const doctorName = `Dr. ${doctor.prenom} ${doctor.nom}`.trim();
    const specialty = doctor.specialite;

    // Build summaries in parallel
    const summaries = await Promise.all(
      patientObjs.map(({ id, name }) =>
        this.buildPatientSummary(id, name).catch(
          () => `Patient ${name} — data unavailable`,
        ),
      ),
    );

    const urgentPatients = summaries.filter((s) => s.includes('URGENT FLAGS:'));

    const urgentHeader =
      urgentPatients.length > 0
        ? `⚠️ URGENT: ${urgentPatients.length} patient(s) require immediate attention\n\n`
        : '';

    const patientData =
      urgentHeader +
      `PATIENT LIST SUMMARY (${patientObjs.length} patients):\n` +
      summaries.map((s, i) => `${i + 1}. ${s}`).join('\n');

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{DOCTOR_NAME}', doctorName)
      .replace('{SPECIALTY}', specialty)
      .replace('{TOTAL_PATIENTS}', String(rawList.length))
      .replace('{PATIENT_DATA}', patientData);

    const aiResponse = await this.callOllama(systemPrompt, message, 240_000);

    await this.aiDoctorChatModel
      .create({
        doctorId: new Types.ObjectId(doctorId),
        patientId: null,
        queryType: 'all_patients',
        message,
        response: aiResponse,
        contextSnapshot: {
          patientsAnalyzed: patientObjs.length,
          recordsAnalyzed: 0,
          dataFrom: null,
          dataTo: null,
        },
      })
      .catch((err: unknown) =>
        this.logger.warn(`AiDoctorChat persist failed: ${err}`),
      );

    return {
      response: aiResponse,
      queryType: 'all_patients',
      context: {
        patientsAnalyzed: patientObjs.length,
        urgentPatientsCount: urgentPatients.length,
        recordsAnalyzed: 0,
      },
    };
  }

  // ── 3. Urgent check (no Ollama) ─────────────────────────────────────────────

  async urgentCheck(doctorId: string): Promise<{
    urgentPatients: {
      patientId: string;
      patientName: string;
      flags: string[];
      lastGlucose: number | null;
      avgGlucose: number;
      recommendation: string;
    }[];
    totalPatientsChecked: number;
    urgentCount: number;
    checkedAt: Date;
  }> {
    const doctor = await this.getDoctorRaw(doctorId);
    const rawList = doctor.listePatients;

    const patientObjs = doctor.patients;

    // Build summaries in parallel (local only, no Ollama)
    const results = await Promise.all(
      patientObjs.map(async ({ id, name }) => {
        const summary = await this.buildPatientSummary(id).catch(
          () => '',
        );
        const stats = await this.getPatientRawStats(id).catch(() => null);
        return { id, name, summary, stats };
      }),
    );

    const urgentPatients = results
      .filter((r) => r.summary.includes('URGENT FLAGS:'))
      .map((r) => {
        // Extract flags from summary text
        const flagMatch = r.summary.match(/URGENT FLAGS: (.+)$/);
        const flags = flagMatch
          ? flagMatch[1].split(', ').map((f) => f.trim())
          : [];
        return {
          patientId: r.id,
          patientName: r.name,
          flags,
          lastGlucose: r.stats?.lastValue ?? null,
          avgGlucose: r.stats?.average ?? 0,
          recommendation: 'Consultation immédiate recommandée',
        };
      });

    // Persist as urgent_check entry (no response from Ollama)
    await this.aiDoctorChatModel
      .create({
        doctorId: new Types.ObjectId(doctorId),
        patientId: null,
        queryType: 'urgent_check',
        message: 'URGENT_CHECK_AUTO',
        response: `${urgentPatients.length} urgent patient(s) detected out of ${patientObjs.length} checked.`,
        contextSnapshot: {
          patientsAnalyzed: patientObjs.length,
          recordsAnalyzed: 0,
          dataFrom: null,
          dataTo: null,
        },
      })
      .catch((err: unknown) =>
        this.logger.warn(`AiDoctorChat urgent persist failed: ${err}`),
      );

    return {
      urgentPatients,
      totalPatientsChecked: patientObjs.length,
      urgentCount: urgentPatients.length,
      checkedAt: new Date(),
    };
  }

  // ── 4. Chat history ─────────────────────────────────────────────────────────

  async getChatHistory(
    doctorId: string,
    patientId?: string,
    page = 1,
    limit = 10,
  ): Promise<{
    data: AiDoctorChatDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const filter: Record<string, unknown> = {
      doctorId: new Types.ObjectId(doctorId),
    };
    if (patientId) {
      filter.patientId = new Types.ObjectId(patientId);
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.aiDoctorChatModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.aiDoctorChatModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── 5. Gemini medical report (single patient) ──────────────────────────────

  async generatePatientMedicalReport(
    doctorId: string,
    patientId: string,
  ): Promise<{
    patientId: string;
    generatedAt: string;
    sourceMetrics: {
      glucoseRecordsAnalyzed: number;
      mealsAnalyzed: number;
      hasPrediction: boolean;
    };
    report: {
      title: string;
      executiveSummary: string;
      patientOverview: string[];
      clinicalFindings: string[];
      riskAssessment: string[];
      treatmentPlan: string[];
      lifestylePlan: string[];
      followUpPlan: string[];
      alerts: string[];
      physicianNotes: string;
    };
  }> {
    const doctor = await this.getDoctorRaw(doctorId);
    if (!doctor.listePatients.includes(patientId)) {
      throw new ForbiddenException('Ce patient ne fait pas partie de vos patients.');
    }

    const [patientRaw, glucoseResult, mealsResult, lastPrediction] = await Promise.all([
      this.patientsService.findOne(patientId),
      this.glucoseService
        .findMyRecords(patientId, { page: 1, limit: REPORT_GLUCOSE_RECORDS })
        .catch(() => ({ data: [] as any[] })),
      this.nutritionService
        .findAllMeals(patientId, undefined, undefined, { page: 1, limit: REPORT_MEALS })
        .catch(() => ({ data: [] as any[] })),
      this.aiPredictionModel
        .findOne({ patientId: new Types.ObjectId(patientId) })
        .sort({ createdAt: -1 })
        .lean()
        .exec()
        .catch(() => null),
    ]);

    const patient = (patientRaw ?? {}) as Record<string, unknown>;
    const records: any[] = (glucoseResult as any)?.data ?? [];
    const meals: any[] = (mealsResult as any)?.data ?? [];

    const values = records.map((r) => toNum(r?.value)).filter((v) => v > 0);
    const avgGlucose =
      values.length > 0
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : null;
    const estimatedHbA1c =
      avgGlucose !== null ? Number(((avgGlucose + 46.7) / 28.7).toFixed(1)) : null;

    const patientDisplayName =
      `${String(patient.prenom ?? '').trim()} ${String(patient.nom ?? '').trim()}`.trim() ||
      doctor.patients.find((p) => p.id === patientId)?.name ||
      patientId;

    const report = await this.generateGeminiMedicalReport({
      doctor,
      patient,
      patientId,
      patientDisplayName,
      glucoseRecords: records,
      meals,
      lastPrediction,
      avgGlucose,
      estimatedHbA1c,
    });

    return {
      patientId,
      generatedAt: new Date().toISOString(),
      sourceMetrics: {
        glucoseRecordsAnalyzed: records.length,
        mealsAnalyzed: meals.length,
        hasPrediction: Boolean(lastPrediction),
      },
      report,
    };
  }

  // ── Private: build compact patient summary ──────────────────────────────────

  private async buildPatientSummary(patientId: string, patientName?: string): Promise<string> {
    const [glucoseResult, mealsResult, lastPrediction] = await Promise.all([
      this.glucoseService
        .findMyRecords(patientId, { page: 1, limit: GLUCOSE_RECORDS_PER_PATIENT })
        .catch(() => ({ data: [] as any[] })),
      this.nutritionService
        .findAllMeals(patientId, undefined, undefined, {
          page: 1,
          limit: MEALS_PER_PATIENT,
        })
        .catch(() => ({ data: [] as any[] })),
      this.aiPredictionModel
        .findOne({ patientId: new Types.ObjectId(patientId) })
        .sort({ createdAt: -1 })
        .lean()
        .exec()
        .catch(() => null),
    ]);

    const records: any[] = (glucoseResult as any).data ?? [];
    const meals: any[] = (mealsResult as any).data ?? [];

    // Calculate stats
    const values = records.map((r) => toNum(r.value));
    const avgGlucose =
      values.length > 0
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : 0;
    const hba1cEstimate =
      avgGlucose > 0
        ? ((avgGlucose + 46.7) / 28.7).toFixed(1)
        : 'N/A';
    const inRange = values.filter((v) => v >= 70 && v <= 180).length;
    const timeInRange =
      values.length > 0
        ? Math.round((inRange / values.length) * 100)
        : 0;
    const hypoCount = values.filter((v) => v < 70).length;
    const hyperCount = values.filter((v) => v > 180).length;
    const lastGlucose = values[0] ?? null;

    // Trend
    const half = Math.floor(values.length / 2);
    let trend = 'stable';
    if (values.length >= 4) {
      const olderAvg =
        values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
      const newerAvg =
        values.slice(0, half).reduce((a, b) => a + b, 0) / half;
      if (newerAvg > olderAvg + 10) trend = 'worsening';
      else if (newerAvg < olderAvg - 10) trend = 'improving';
    }

    // Urgent flags
    const urgentFlags: string[] = [];
    if (avgGlucose > 200) urgentFlags.push('⚠️ AVERAGE > 200 mg/dL');
    if (parseFloat(hba1cEstimate) > 9) urgentFlags.push('🚨 HbA1c > 9%');
    if (hypoCount > 5) urgentFlags.push('🚨 MORE THAN 5 HYPOS');
    if (lastGlucose !== null && lastGlucose > 250)
      urgentFlags.push('🚨 LAST VALUE > 250 mg/dL');

    const predictionSummary = (lastPrediction as any)?.prediction?.summary ?? 'not analyzed';
    const lastMeal = meals[0];

    const displayName = patientName && patientName !== patientId
      ? `${patientName} (ID: ${patientId})`
      : patientId;

    return (
      `PATIENT: ${displayName} | ` +
      `Avg glucose: ${avgGlucose} mg/dL | ` +
      `HbA1c est: ${hba1cEstimate}% | ` +
      `Time in range: ${timeInRange}% | ` +
      `Hypos: ${hypoCount} | Hypers: ${hyperCount} | ` +
      `Last value: ${lastGlucose ?? 'N/A'} mg/dL | ` +
      `Trend: ${trend} | ` +
      `Last meal: ${lastMeal?.name ?? 'none'} (${toNum(lastMeal?.carbs)}g carbs) | ` +
      `Last prediction: ${predictionSummary} | ` +
      (urgentFlags.length > 0
        ? `URGENT FLAGS: ${urgentFlags.join(', ')}`
        : 'No urgent flags')
    );
  }

  private async generateGeminiMedicalReport(args: {
    doctor: {
      nom: string;
      prenom: string;
      specialite: string;
      listePatients: string[];
      patients: Array<{ id: string; name: string }>;
    };
    patient: Record<string, unknown>;
    patientId: string;
    patientDisplayName: string;
    glucoseRecords: any[];
    meals: any[];
    lastPrediction: unknown;
    avgGlucose: number | null;
    estimatedHbA1c: number | null;
  }): Promise<{
    title: string;
    executiveSummary: string;
    patientOverview: string[];
    clinicalFindings: string[];
    riskAssessment: string[];
    treatmentPlan: string[];
    lifestylePlan: string[];
    followUpPlan: string[];
    alerts: string[];
    physicianNotes: string;
  }> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new HttpException(
        'Configuration Gemini manquante (GEMINI_API_KEY).',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const profilMedical = (args.patient.profilMedical ?? {}) as Record<string, unknown>;
    const glucoseCompact = args.glucoseRecords.slice(0, 30).map((r) => ({
      value: toNum(r?.value),
      measuredAt: r?.measuredAt,
      period: r?.period ?? 'unknown',
    }));
    const mealsCompact = args.meals.slice(0, 15).map((m) => ({
      name: m?.name ?? 'Unknown',
      carbs: toNum(m?.carbs),
      calories: toNum(m?.calories),
      protein: toNum(m?.protein),
      fat: toNum(m?.fat),
      eatenAt: m?.eatenAt,
    }));

    const payload = {
      generatedAt: new Date().toISOString(),
      doctor: {
        id: 'doctor-context',
        name: `Dr. ${args.doctor.prenom} ${args.doctor.nom}`.trim(),
        specialty: args.doctor.specialite,
      },
      patient: {
        id: args.patientId,
        fullName: args.patientDisplayName,
        sexe: args.patient.sexe ?? null,
        dateNaissance: args.patient.dateNaissance ?? null,
        typeDiabete: args.patient.typeDiabete ?? null,
        groupeSanguin: args.patient.groupeSanguin ?? null,
        profilMedical,
      },
      analytics: {
        averageGlucoseMgDl: args.avgGlucose,
        estimatedHbA1c: args.estimatedHbA1c,
        recordsCount: args.glucoseRecords.length,
        mealsCount: args.meals.length,
      },
      recentGlucose: glucoseCompact,
      recentMeals: mealsCompact,
      latestPrediction: args.lastPrediction ?? null,
    };

    const prompt =
      `Generate a detailed medical report in French for this patient.\n` +
      `Output MUST be a strict JSON object with exactly these keys:\n` +
      `{\n` +
      `  \"title\": string,\n` +
      `  \"executiveSummary\": string,\n` +
      `  \"patientOverview\": string[],\n` +
      `  \"clinicalFindings\": string[],\n` +
      `  \"riskAssessment\": string[],\n` +
      `  \"treatmentPlan\": string[],\n` +
      `  \"lifestylePlan\": string[],\n` +
      `  \"followUpPlan\": string[],\n` +
      `  \"alerts\": string[],\n` +
      `  \"physicianNotes\": string\n` +
      `}\n` +
      `If any section has no data, return one explicit sentence in French in that section.\n` +
      `Patient JSON:\n${JSON.stringify(payload, null, 2)}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelCandidates = this.getGeminiModelCandidates();
    let lastError: unknown = null;

    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
          },
          systemInstruction: GEMINI_REPORT_SYSTEM_INSTRUCTION,
        });

        const result = await model.generateContent(prompt);
        const rawText = result.response.text();
        const clean = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean) as Record<string, unknown>;
        return this.normalizeMedicalReport(parsed, args.patientDisplayName);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const isApiKeyRejected =
          message.includes('reported as leaked') ||
          message.includes('PERMISSION_DENIED') ||
          message.includes('[403 Forbidden]');

        if (isApiKeyRejected) {
          throw new HttpException(
            'Cle Gemini invalide ou revoquee. Generez une nouvelle GEMINI_API_KEY puis redemarrez le backend.',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }

        const isQuotaExceeded =
          message.includes('429 Too Many Requests') ||
          message.includes('Quota exceeded') ||
          message.includes('rate-limits') ||
          message.includes('limit: 0');

        if (isQuotaExceeded) {
          throw new HttpException(
            'Quota Gemini depasse ou inactif (limit=0). Activez la facturation/quotas du projet Google AI ou utilisez une autre cle API.',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }

        const isModelNotFound =
          message.includes('[404 Not Found]') ||
          /model[s]?\/.+\s+is\s+not\s+found/i.test(message) ||
          message.includes('is not found for API version');

        if (isModelNotFound) {
          this.logger.warn(`Gemini model not available: ${modelName}. Trying next model.`);
          continue;
        }

        this.logger.warn(`Gemini report generation failed on model ${modelName}: ${message}`);
      }
    }

    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    throw new HttpException(
      `Erreur Gemini lors de la génération du rapport médical: ${reason}`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private normalizeMedicalReport(
    source: Record<string, unknown>,
    patientDisplayName: string,
  ): {
    title: string;
    executiveSummary: string;
    patientOverview: string[];
    clinicalFindings: string[];
    riskAssessment: string[];
    treatmentPlan: string[];
    lifestylePlan: string[];
    followUpPlan: string[];
    alerts: string[];
    physicianNotes: string;
  } {
    const toStr = (v: unknown, fallback: string): string => {
      if (typeof v === 'string' && v.trim().length > 0) return v.trim();
      return fallback;
    };

    const toStrArray = (v: unknown, fallback: string): string[] => {
      if (Array.isArray(v)) {
        const out = v
          .map((x) => String(x ?? '').trim())
          .filter((x) => x.length > 0);
        if (out.length > 0) return out;
      }
      return [fallback];
    };

    return {
      title: toStr(source.title, `Rapport Medical Detaille - ${patientDisplayName}`),
      executiveSummary: toStr(
        source.executiveSummary,
        'Resume clinique indisponible temporairement.',
      ),
      patientOverview: toStrArray(
        source.patientOverview,
        'Donnees generales du patient non disponibles.',
      ),
      clinicalFindings: toStrArray(
        source.clinicalFindings,
        'Constat clinique detaille non disponible.',
      ),
      riskAssessment: toStrArray(
        source.riskAssessment,
        'Evaluation du risque non disponible.',
      ),
      treatmentPlan: toStrArray(
        source.treatmentPlan,
        'Plan therapeutique a confirmer en consultation.',
      ),
      lifestylePlan: toStrArray(
        source.lifestylePlan,
        'Mesures de mode de vie non detaillees.',
      ),
      followUpPlan: toStrArray(
        source.followUpPlan,
        'Plan de suivi a definir.',
      ),
      alerts: toStrArray(
        source.alerts,
        'Aucune alerte critique explicite sur les donnees disponibles.',
      ),
      physicianNotes: toStr(
        source.physicianNotes,
        'La decision finale appartient au medecin traitant.',
      ),
    };
  }

  private getGeminiModelCandidates(): string[] {
    const configuredRaw = this.configService.get<string>('GEMINI_MODEL')?.trim();
    const configured = configuredRaw
      ? configuredRaw.replace(/^models\//i, '').trim()
      : undefined;

    const normalizedConfigured =
      configured === 'gemini-1.5-flash-latest' ? 'gemini-1.5-flash' : configured;

    const ordered = [
      normalizedConfigured,
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ].filter((v): v is string => Boolean(v));

    return [...new Set(ordered)];
  }

  /** Returns raw numeric stats for a patient (used by urgentCheck) */
  private async getPatientRawStats(
    patientId: string,
  ): Promise<{ lastValue: number; average: number } | null> {
    const result = await this.glucoseService
      .findMyRecords(patientId, { page: 1, limit: GLUCOSE_RECORDS_PER_PATIENT })
      .catch(() => null);
    if (!result) return null;
    const values: number[] = ((result as any).data ?? []).map((r: any) =>
      toNum(r.value),
    );
    if (values.length === 0) return null;
    return {
      lastValue: values[0],
      average: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    };
  }

  // ── Private: Ollama call ────────────────────────────────────────────────────

  private async callOllama(
    system: string,
    prompt: string,
    timeout: number,
  ): Promise<string> {
    const modelCandidates = this.getOllamaDoctorModelCandidates();
    for (const modelName of modelCandidates) {
      try {
        // MIGRATED TO GEMMA4
        const { data } = await axios.post(
          OLLAMA_URL,
          {
            model: modelName,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
            stream: false,
          },
          { timeout, headers: { 'Content-Type': 'application/json' } },
        );
        // MIGRATED TO GEMMA4
        const text =
          (
            (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]
              ?.message?.content ?? ''
          ).trim();
        if (!text) throw new Error('Empty response from Ollama');
        this.logger.debug(`Doctor model used: ${modelName}`);
        return text;
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          const payload = JSON.stringify(err.response?.data ?? {});
          const isModelNotFound =
            status === 404 && /model\s+'.*'\s+not\s+found/i.test(payload);

          if (isModelNotFound) {
            this.logger.warn(`Doctor model not found: ${modelName}. Trying next model.`);
            continue;
          }
        }
        throw err;
      }
    }
    throw new Error(`No usable Ollama doctor model found. Tried: ${modelCandidates.join(', ')}`);
  }

  private getOllamaDoctorModelCandidates(): string[] {
    // MIGRATED TO GEMMA4
    return ['gemma4:e4b'];
  }
}
