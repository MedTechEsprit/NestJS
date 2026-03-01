import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AiPatternDocument = AiPattern & Document;

@Schema({ timestamps: true, collection: 'ai_patterns' })
export class AiPattern {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ required: true, enum: ['manual', 'cron'] })
  triggerType: string;

  @Prop({
    type: {
      from: Date,
      to: Date,
      totalDays: Number,
      totalRecords: Number,
    },
    required: true,
  })
  analysisPeriod: {
    from: Date;
    to: Date;
    totalDays: number;
    totalRecords: number;
  };

  @Prop({
    type: {
      avgGlucose: Number,
      minGlucose: Number,
      maxGlucose: Number,
      hba1cEstimate: Number,
      timeInRange: Number,
      hypoglycemiaCount: Number,
      hyperglycemiaCount: Number,
      weeklyAverages: {
        week1: Number,
        week2: Number,
        week3: Number,
        week4: Number,
      },
    },
    required: true,
  })
  globalStats: {
    avgGlucose: number;
    minGlucose: number;
    maxGlucose: number;
    hba1cEstimate: number;
    timeInRange: number;
    hypoglycemiaCount: number;
    hyperglycemiaCount: number;
    weeklyAverages: { week1: number; week2: number; week3: number; week4: number };
  };

  @Prop({
    type: {
      detected: Boolean,
      frequency: Number,
      avgTimeOfOccurrence: String,
      riskLevel: String,
      affectedDays: [String],
      recommendation: String,
    },
    required: true,
  })
  nocturnalHypoglycemia: {
    detected: boolean;
    frequency: number;
    avgTimeOfOccurrence: string;
    riskLevel: string;
    affectedDays: string[];
    recommendation: string;
  };

  @Prop({
    type: {
      detected: Boolean,
      frequency: Number,
      avgSpikeValue: Number,
      mostAffectedPeriod: String,
      avgCarbsOnSpikedMeals: Number,
      riskLevel: String,
      recommendation: String,
    },
    required: true,
  })
  postMealSpikes: {
    detected: boolean;
    frequency: number;
    avgSpikeValue: number;
    mostAffectedPeriod: string;
    avgCarbsOnSpikedMeals: number;
    riskLevel: string;
    recommendation: string;
  };

  @Prop({
    type: {
      detected: Boolean,
      highRiskHours: [String],
      highRiskDays: [String],
      lowRiskHours: [String],
      pattern: String,
      recommendation: String,
    },
    required: true,
  })
  riskTimeWindows: {
    detected: boolean;
    highRiskHours: string[];
    highRiskDays: string[];
    lowRiskHours: string[];
    pattern: string;
    recommendation: string;
  };

  @Prop({
    type: {
      detected: Boolean,
      trend: String,
      week1Avg: Number,
      week2Avg: Number,
      week3Avg: Number,
      week4Avg: Number,
      hba1cEstimate: Number,
      timeInRange: Number,
      riskLevel: String,
      recommendation: String,
    },
    required: true,
  })
  glycemicControlDegradation: {
    detected: boolean;
    trend: string;
    week1Avg: number;
    week2Avg: number;
    week3Avg: number;
    week4Avg: number;
    hba1cEstimate: number;
    timeInRange: number;
    riskLevel: string;
    recommendation: string;
  };

  @Prop({
    type: {
      controlLevel: String,
      criticalPatternsCount: Number,
      doctorConsultationNeeded: Boolean,
      urgencyLevel: String,
      topPriorities: [String],
      summary: String,
    },
    required: true,
  })
  overallAssessment: {
    controlLevel: string;
    criticalPatternsCount: number;
    doctorConsultationNeeded: boolean;
    urgencyLevel: string;
    topPriorities: string[];
    summary: string;
  };

  @Prop({ default: false })
  isFallback: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const AiPatternSchema = SchemaFactory.createForClass(AiPattern);

AiPatternSchema.index({ patientId: 1, createdAt: -1 });
AiPatternSchema.index({ patientId: 1, triggerType: 1, createdAt: -1 });
