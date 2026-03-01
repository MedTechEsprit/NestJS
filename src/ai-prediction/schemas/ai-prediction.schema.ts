import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type AiPredictionDocument = AiPrediction & Document;

// ── Sub-schemas (no _id) ─────────────────────────────────────────────────────

@Schema({ _id: false })
export class GlucoseSnapshot {
  @ApiProperty() @Prop({ required: true }) recordsUsed: number;
  @ApiProperty() @Prop({ required: true }) average: number;
  @ApiProperty() @Prop({ required: true }) lastValue: number;
  @ApiProperty() @Prop({ required: true }) lastMeasuredAt: Date;
  @ApiProperty() @Prop({ required: true }) min: number;
  @ApiProperty() @Prop({ required: true }) max: number;
  @ApiProperty() @Prop({ required: true }) hypoglycemiaCount: number;
  @ApiProperty() @Prop({ required: true }) hyperglycemiaCount: number;
  @ApiProperty() @Prop({ required: true }) trend: string;
}
export const GlucoseSnapshotSchema = SchemaFactory.createForClass(GlucoseSnapshot);

@Schema({ _id: false })
export class MealSnapshot {
  @ApiProperty() @Prop({ default: '' })  mealName: string;
  @ApiProperty() @Prop({ default: 0 })   calories: number;
  @ApiProperty() @Prop({ default: 0 })   carbs: number;
  @ApiProperty() @Prop({ default: 0 })   protein: number;
  @ApiProperty() @Prop({ default: 0 })   fat: number;
  @ApiProperty() @Prop({ type: String, default: null }) glycemicIndex: string | null;
}
export const MealSnapshotSchema = SchemaFactory.createForClass(MealSnapshot);

@Schema({ _id: false })
export class PredictionResult {
  @ApiProperty() @Prop({ required: true }) trend: string;
  @ApiProperty() @Prop({ required: true }) confidence: number;
  @ApiProperty() @Prop({ required: true }) estimatedValue2h: number;
  @ApiProperty() @Prop({ required: true }) estimatedValue4h: number;
  @ApiProperty() @Prop({ required: true }) riskLevel: string;
  @ApiProperty() @Prop({ required: true }) riskType: string;
  @ApiProperty({ type: [String] }) @Prop({ type: [String], default: [] }) alerts: string[];
  @ApiProperty({ type: [String] }) @Prop({ type: [String], default: [] }) recommendations: string[];
  @ApiProperty() @Prop({ required: true }) timeToAction: string;
  @ApiProperty() @Prop({ required: true }) explanation: string;
  @ApiProperty() @Prop({ required: true }) summary: string;
}
export const PredictionResultSchema = SchemaFactory.createForClass(PredictionResult);

// ── Main schema ──────────────────────────────────────────────────────────────

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'ai_predictions',
})
export class AiPrediction {
  @ApiProperty({ type: String })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @ApiProperty({ type: String, required: false })
  @Prop({ type: Types.ObjectId, ref: 'Meal', default: null })
  mealId: Types.ObjectId | null;

  @ApiProperty({ enum: ['manual', 'post_meal'] })
  @Prop({ required: true, enum: ['manual', 'post_meal'] })
  triggerType: string;

  @ApiProperty({ type: GlucoseSnapshot })
  @Prop({ type: GlucoseSnapshotSchema, required: true })
  glucoseSnapshot: GlucoseSnapshot;

  @ApiProperty({ type: MealSnapshot, required: false })
  @Prop({ type: MealSnapshotSchema, default: null })
  mealSnapshot: MealSnapshot | null;

  @ApiProperty({ type: PredictionResult })
  @Prop({ type: PredictionResultSchema, required: true })
  prediction: PredictionResult;

  @ApiProperty()
  @Prop({ default: false })
  isFallback: boolean;

  @ApiProperty()
  createdAt?: Date;
}

export const AiPredictionSchema = SchemaFactory.createForClass(AiPrediction);

// Indexes
AiPredictionSchema.index({ patientId: 1, createdAt: -1 });
AiPredictionSchema.index({ patientId: 1, triggerType: 1, createdAt: -1 });
