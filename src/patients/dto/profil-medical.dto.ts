import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProfilMedicalDto {
  // ── Informations personnelles complémentaires ──────────────────
  @ApiPropertyOptional({ example: 175, description: 'Taille en cm' })
  @IsOptional()
  @IsNumber()
  taille?: number;

  @ApiPropertyOptional({ example: 70, description: 'Poids en kg' })
  @IsOptional()
  @IsNumber()
  poids?: number;

  @ApiPropertyOptional({ description: "Contact d'urgence" })
  @IsOptional()
  @IsString()
  contactUrgence?: string;

  // ── Détails diabète ────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Date de diagnostic du diabète' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateDiagnostic?: Date;

  @ApiPropertyOptional({ description: 'Glycémie à jeun moyenne (mg/dL)' })
  @IsOptional()
  @IsNumber()
  glycemieAJeunMoyenne?: number;

  @ApiPropertyOptional({ description: 'Dernier HbA1c (%)' })
  @IsOptional()
  @IsNumber()
  dernierHba1c?: number;

  @ApiPropertyOptional({ description: 'Fréquence de mesure glycémie' })
  @IsOptional()
  @IsString()
  frequenceMesureGlycemie?: string;

  // ── Traitement ─────────────────────────────────────────────────
  @ApiPropertyOptional({ description: "Prend de l'insuline" })
  @IsOptional()
  @IsBoolean()
  prendInsuline?: boolean;

  @ApiPropertyOptional({ description: "Type d'insuline utilisé" })
  @IsOptional()
  @IsString()
  typeInsuline?: string;

  @ApiPropertyOptional({ description: 'Dose quotidienne insuline (UI)' })
  @IsOptional()
  @IsNumber()
  doseQuotidienneInsuline?: number;

  @ApiPropertyOptional({ description: "Fréquence d'injection par jour" })
  @IsOptional()
  @IsNumber()
  frequenceInjection?: number;

  @ApiPropertyOptional({
    description: 'Antidiabétiques oraux',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  antidiabetiquesOraux?: string[];

  @ApiPropertyOptional({
    description: 'Traitements actuels (liste)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  traitements?: string[];

  @ApiPropertyOptional({ description: 'Utilise un capteur de glucose' })
  @IsOptional()
  @IsBoolean()
  utiliseCapteurGlucose?: boolean;

  // ── Antécédents médicaux ───────────────────────────────────────
  @ApiPropertyOptional({ description: 'Antécédents familiaux de diabète' })
  @IsOptional()
  @IsBoolean()
  antecedentsFamiliauxDiabete?: boolean;

  @ApiPropertyOptional({ description: 'Hypertension' })
  @IsOptional()
  @IsBoolean()
  hypertension?: boolean;

  @ApiPropertyOptional({ description: 'Maladies cardiovasculaires' })
  @IsOptional()
  @IsBoolean()
  maladiesCardiovasculaires?: boolean;

  @ApiPropertyOptional({ description: 'Problèmes rénaux' })
  @IsOptional()
  @IsBoolean()
  problemesRenaux?: boolean;

  @ApiPropertyOptional({ description: 'Problèmes oculaires (rétinopathie)' })
  @IsOptional()
  @IsBoolean()
  problemesOculaires?: boolean;

  @ApiPropertyOptional({ description: 'Neuropathie diabétique' })
  @IsOptional()
  @IsBoolean()
  neuropathieDiabetique?: boolean;

  // ── Complications actuelles ────────────────────────────────────
  @ApiPropertyOptional({ description: 'Pied diabétique' })
  @IsOptional()
  @IsBoolean()
  piedDiabetique?: boolean;

  @ApiPropertyOptional({ description: 'Ulcères' })
  @IsOptional()
  @IsBoolean()
  ulceres?: boolean;

  @ApiPropertyOptional({ description: 'Hypoglycémies fréquentes' })
  @IsOptional()
  @IsBoolean()
  hypoglycemiesFrequentes?: boolean;

  @ApiPropertyOptional({ description: 'Hyperglycémies fréquentes' })
  @IsOptional()
  @IsBoolean()
  hyperglycemiesFrequentes?: boolean;

  @ApiPropertyOptional({ description: 'Hospitalisations récentes' })
  @IsOptional()
  @IsBoolean()
  hospitalisationsRecentes?: boolean;

  // ── Analyses biologiques ───────────────────────────────────────
  @ApiPropertyOptional({ description: 'Cholestérol total (g/L)' })
  @IsOptional()
  @IsNumber()
  cholesterolTotal?: number;

  @ApiPropertyOptional({ description: 'HDL (g/L)' })
  @IsOptional()
  @IsNumber()
  hdl?: number;

  @ApiPropertyOptional({ description: 'LDL (g/L)' })
  @IsOptional()
  @IsNumber()
  ldl?: number;

  @ApiPropertyOptional({ description: 'Triglycérides (g/L)' })
  @IsOptional()
  @IsNumber()
  triglycerides?: number;

  @ApiPropertyOptional({ description: 'Créatinine (mg/L)' })
  @IsOptional()
  @IsNumber()
  creatinine?: number;

  @ApiPropertyOptional({ description: 'Micro-albuminurie (mg/L)' })
  @IsOptional()
  @IsNumber()
  microAlbuminurie?: number;

  // ── Allergies & infos critiques ────────────────────────────────
  @ApiPropertyOptional({
    description: 'Liste des allergies médicamenteuses',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @ApiPropertyOptional({
    description: 'Autres maladies chroniques',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  maladiesChroniques?: string[];

  // ── Mode de vie ────────────────────────────────────────────────
  @ApiPropertyOptional({ description: "Niveau d'activité physique" })
  @IsOptional()
  @IsString()
  niveauActivitePhysique?: string;

  @ApiPropertyOptional({ description: 'Habitudes alimentaires' })
  @IsOptional()
  @IsString()
  habitudesAlimentaires?: string;

  @ApiPropertyOptional({ description: 'Tabac (oui/non/ancien)' })
  @IsOptional()
  @IsString()
  tabac?: string;

  // ── Objectifs glycémie ─────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Objectif glycémie minimum (mg/dL)' })
  @IsOptional()
  @IsNumber()
  objectifGlycemieMin?: number;

  @ApiPropertyOptional({ description: 'Objectif glycémie maximum (mg/dL)' })
  @IsOptional()
  @IsNumber()
  objectifGlycemieMax?: number;

  @ApiPropertyOptional({ description: 'Traitement actuel (texte libre)' })
  @IsOptional()
  @IsString()
  traitementActuel?: string;

  // ── Flag ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Profil médical complété' })
  @IsOptional()
  @IsBoolean()
  profilMedicalComplete?: boolean;
}
