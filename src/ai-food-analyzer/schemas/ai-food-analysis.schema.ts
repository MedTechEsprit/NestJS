import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type AiFoodAnalysisDocument = AiFoodAnalysis & Document;

// ── Sub-schemas (no _id) ─────────────────────────────────────────────────────

@Schema({ _id: false })
export class AnalysisResult {
  @ApiProperty({ description: 'Nom de l\'aliment identifié' })
  @Prop({ required: true })
  name: string;

  @ApiProperty({ description: 'Liste des ingrédients détectés', type: [String] })
  @Prop({ type: [String], default: [] })
  ingredients: string[];

  @ApiProperty({ description: 'Calories (kcal)' })
  @Prop({ default: 0 })
  calories: number;

  @ApiProperty({ description: 'Glucides en grammes' })
  @Prop({ default: 0 })
  carbs: number;

  @ApiProperty({ description: 'Protéines en grammes' })
  @Prop({ default: 0 })
  protein: number;

  @ApiProperty({ description: 'Lipides en grammes' })
  @Prop({ default: 0 })
  fat: number;

  @ApiProperty({ description: 'Index glycémique estimé (bas/moyen/élevé)' })
  @Prop({ default: '' })
  glycemicIndex: string;

  @ApiProperty({ description: 'Conseil nutritionnel de l\'analyseur image' })
  @Prop({ default: '' })
  diabeticAdvice: string;

  @ApiProperty({ description: 'Score de confiance du modèle IA (0-100)' })
  @Prop({ default: 0 })
  confidence: number;
}

export const AnalysisResultSchema = SchemaFactory.createForClass(AnalysisResult);

// ── ─────────────────────────────────────────────────────────────────────────

@Schema({ _id: false })
export class GlucoseContextEntry {
  @ApiProperty({ description: 'Valeur de glycémie en mg/dL' })
  @Prop()
  value: number;

  @ApiProperty({ description: 'Date de la mesure' })
  @Prop()
  measuredAt: Date;

  @ApiProperty({ description: 'Période de mesure (fasting, after_meal…)' })
  @Prop()
  period: string;
}

export const GlucoseContextEntrySchema = SchemaFactory.createForClass(GlucoseContextEntry);

// ── ─────────────────────────────────────────────────────────────────────────

@Schema({ _id: false })
export class DetailedAdvice {
  @ApiProperty({ description: 'Impact sur la glycémie' })
  @Prop({ default: '' })
  glucoseImpact: string;

  @ApiProperty({ description: 'Estimation de la hausse glycémique attendue' })
  @Prop({ default: '' })
  expectedGlucoseRise: string;

  @ApiProperty({ description: 'Niveau de risque (faible/modéré/élevé)' })
  @Prop({ default: '' })
  riskLevel: string;

  @ApiProperty({ description: 'Risque personnalisé basé sur l\'historique du patient' })
  @Prop({ default: '' })
  personalizedRisk: string;

  @ApiProperty({ description: 'Recommandations nutritionnelles', type: [String] })
  @Prop({ type: [String], default: [] })
  recommendations: string[];

  @ApiProperty({ description: 'Conseil sur la taille de la portion' })
  @Prop({ default: '' })
  portionAdvice: string;

  @ApiProperty({ description: 'Conseil sur le timing de consommation' })
  @Prop({ default: '' })
  timingAdvice: string;

  @ApiProperty({ description: 'Suggestions d\'alternatives alimentaires', type: [String] })
  @Prop({ type: [String], default: [] })
  alternativeSuggestions: string[];

  @ApiProperty({ description: 'Recommandation d\'exercice post-repas' })
  @Prop({ default: '' })
  exerciseRecommendation: string;

  @ApiProperty({ description: 'Résumé global des conseils IA' })
  @Prop({ default: '' })
  summary: string;
}

export const DetailedAdviceSchema = SchemaFactory.createForClass(DetailedAdvice);

// ── Main schema ──────────────────────────────────────────────────────────────

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'ai_food_analyses',
})
export class AiFoodAnalysis {
  @ApiProperty({ description: 'Référence au repas créé (1:1)', type: String })
  @Prop({ type: Types.ObjectId, ref: 'Meal', required: true, unique: true })
  mealId: Types.ObjectId;

  @ApiProperty({ description: 'Référence au patient', type: String })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @ApiProperty({ description: 'URL de l\'image analysée', required: false })
  @Prop({ type: String, default: null })
  imageUrl: string | null;

  @ApiProperty({ description: 'Résultat de l\'analyse image (LLaVA 1er appel)', type: AnalysisResult })
  @Prop({ type: AnalysisResultSchema, required: true })
  analysisResult: AnalysisResult;

  @ApiProperty({ description: 'Contexte glycémique utilisé pour les conseils', type: [GlucoseContextEntry] })
  @Prop({ type: [GlucoseContextEntrySchema], default: [] })
  glucoseContext: GlucoseContextEntry[];

  @ApiProperty({ description: 'Conseils détaillés personnalisés (LLaVA 2ème appel)', type: DetailedAdvice })
  @Prop({ type: DetailedAdviceSchema, required: true })
  detailedAdvice: DetailedAdvice;

  @ApiProperty({ description: 'true si le 2ème appel IA a échoué et le fallback a été utilisé' })
  @Prop({ default: false })
  isFallback: boolean;

  @ApiProperty({ description: 'Date de création' })
  createdAt?: Date;
}

export const AiFoodAnalysisSchema = SchemaFactory.createForClass(AiFoodAnalysis);

// ── Indexes ──────────────────────────────────────────────────────────────────
AiFoodAnalysisSchema.index({ patientId: 1, createdAt: -1 });
// { mealId: 1 } unique index is already created by @Prop({ unique: true })
