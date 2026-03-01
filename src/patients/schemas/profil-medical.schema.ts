import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ _id: false })
export class ProfilMedical {
  // ── Informations personnelles complémentaires ──────────────────
  @ApiProperty({ description: 'Taille en cm' })
  @Prop()
  taille: number;

  @ApiProperty({ description: 'Poids en kg' })
  @Prop()
  poids: number;

  @ApiProperty({ description: "Contact d'urgence" })
  @Prop()
  contactUrgence: string;

  // ── Détails diabète ────────────────────────────────────────────
  @ApiProperty({ description: 'Date de diagnostic du diabète' })
  @Prop()
  dateDiagnostic: Date;

  @ApiProperty({ description: 'Glycémie à jeun moyenne (mg/dL)' })
  @Prop()
  glycemieAJeunMoyenne: number;

  @ApiProperty({ description: 'Dernier HbA1c (%)' })
  @Prop()
  dernierHba1c: number;

  @ApiProperty({ description: 'Fréquence de mesure glycémie' })
  @Prop()
  frequenceMesureGlycemie: string;

  // ── Traitement actuel ──────────────────────────────────────────
  @ApiProperty({ description: "Prend de l'insuline" })
  @Prop({ default: false })
  prendInsuline: boolean;

  @ApiProperty({ description: "Type d'insuline utilisé" })
  @Prop()
  typeInsuline: string;

  @ApiProperty({ description: 'Dose quotidienne insuline (UI)' })
  @Prop()
  doseQuotidienneInsuline: number;

  @ApiProperty({ description: "Fréquence d'injection par jour" })
  @Prop()
  frequenceInjection: number;

  @ApiProperty({ description: 'Antidiabétiques oraux', type: [String] })
  @Prop({ type: [String], default: [] })
  antidiabetiquesOraux: string[];

  @ApiProperty({ description: 'Traitements actuels (liste)', type: [String] })
  @Prop({ type: [String], default: [] })
  traitements: string[];

  @ApiProperty({ description: 'Utilise un capteur de glucose' })
  @Prop({ default: false })
  utiliseCapteurGlucose: boolean;

  // ── Antécédents médicaux ───────────────────────────────────────
  @ApiProperty({ description: 'Antécédents familiaux de diabète' })
  @Prop({ default: false })
  antecedentsFamiliauxDiabete: boolean;

  @ApiProperty({ description: 'Hypertension' })
  @Prop({ default: false })
  hypertension: boolean;

  @ApiProperty({ description: 'Maladies cardiovasculaires' })
  @Prop({ default: false })
  maladiesCardiovasculaires: boolean;

  @ApiProperty({ description: 'Problèmes rénaux' })
  @Prop({ default: false })
  problemesRenaux: boolean;

  @ApiProperty({ description: 'Problèmes oculaires (rétinopathie)' })
  @Prop({ default: false })
  problemesOculaires: boolean;

  @ApiProperty({ description: 'Neuropathie diabétique' })
  @Prop({ default: false })
  neuropathieDiabetique: boolean;

  // ── Complications actuelles ────────────────────────────────────
  @ApiProperty({ description: 'Pied diabétique' })
  @Prop({ default: false })
  piedDiabetique: boolean;

  @ApiProperty({ description: 'Ulcères' })
  @Prop({ default: false })
  ulceres: boolean;

  @ApiProperty({ description: 'Hypoglycémies fréquentes' })
  @Prop({ default: false })
  hypoglycemiesFrequentes: boolean;

  @ApiProperty({ description: 'Hyperglycémies fréquentes' })
  @Prop({ default: false })
  hyperglycemiesFrequentes: boolean;

  @ApiProperty({ description: 'Hospitalisations récentes' })
  @Prop({ default: false })
  hospitalisationsRecentes: boolean;

  // ── Analyses biologiques ───────────────────────────────────────
  @ApiProperty({ description: 'Cholestérol total (g/L)' })
  @Prop()
  cholesterolTotal: number;

  @ApiProperty({ description: 'HDL (g/L)' })
  @Prop()
  hdl: number;

  @ApiProperty({ description: 'LDL (g/L)' })
  @Prop()
  ldl: number;

  @ApiProperty({ description: 'Triglycérides (g/L)' })
  @Prop()
  triglycerides: number;

  @ApiProperty({ description: 'Créatinine (mg/L)' })
  @Prop()
  creatinine: number;

  @ApiProperty({ description: 'Micro-albuminurie (mg/L)' })
  @Prop()
  microAlbuminurie: number;

  // ── Allergies & infos critiques ────────────────────────────────
  @ApiProperty({
    description: 'Liste des allergies médicamenteuses',
    type: [String],
  })
  @Prop({ type: [String], default: [] })
  allergies: string[];

  @ApiProperty({
    description: 'Autres maladies chroniques',
    type: [String],
  })
  @Prop({ type: [String], default: [] })
  maladiesChroniques: string[];

  // ── Mode de vie ────────────────────────────────────────────────
  @ApiProperty({ description: "Niveau d'activité physique" })
  @Prop()
  niveauActivitePhysique: string;

  @ApiProperty({ description: 'Habitudes alimentaires' })
  @Prop()
  habitudesAlimentaires: string;

  @ApiProperty({ description: 'Tabac (oui/non/ancien)' })
  @Prop()
  tabac: string;

  // ── Objectifs glycémie ─────────────────────────────────────────
  @ApiProperty({ description: 'Objectif glycémie minimum (mg/dL)' })
  @Prop()
  objectifGlycemieMin: number;

  @ApiProperty({ description: 'Objectif glycémie maximum (mg/dL)' })
  @Prop()
  objectifGlycemieMax: number;

  @ApiProperty({ description: 'Traitement actuel (texte libre)' })
  @Prop()
  traitementActuel: string;

  // ── Flag ───────────────────────────────────────────────────────
  @ApiProperty({ description: 'Le patient a complété le formulaire médical' })
  @Prop({ default: false })
  profilMedicalComplete: boolean;
}

export const ProfilMedicalSchema =
  SchemaFactory.createForClass(ProfilMedical);
