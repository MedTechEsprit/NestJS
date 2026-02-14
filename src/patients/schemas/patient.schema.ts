import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { TypeDiabete } from '../../common/enums/type-diabete.enum';
import { Sexe } from '../../common/enums/sexe.enum';
import { ApiProperty } from '@nestjs/swagger';

export type PatientDocument = Patient & Document;

@Schema()
export class Patient extends User {
  // Informations personnelles
  @ApiProperty({ description: 'Date de naissance' })
  @Prop()
  dateNaissance: Date;

  @ApiProperty({ enum: Sexe, description: 'Sexe du patient' })
  @Prop({ enum: Sexe })
  sexe: Sexe;

  @ApiProperty({ description: 'Taille en cm' })
  @Prop()
  taille: number;

  @ApiProperty({ description: 'Poids en kg' })
  @Prop()
  poids: number;

  @ApiProperty({ enum: TypeDiabete, description: 'Type de diabète' })
  @Prop({ enum: TypeDiabete })
  typeDiabete: TypeDiabete;

  @ApiProperty({ description: 'Date de diagnostic du diabète' })
  @Prop()
  dateDiagnostic: Date;

  @ApiProperty({ description: 'Liste des allergies', type: [String] })
  @Prop({ type: [String], default: [] })
  allergies: string[];

  @ApiProperty({ description: 'Liste des maladies chroniques', type: [String] })
  @Prop({ type: [String], default: [] })
  maladiesChroniques: string[];

  // Données médicales
  @ApiProperty({ description: 'Objectif glycémie minimum (mg/dL)' })
  @Prop()
  objectifGlycemieMin: number;

  @ApiProperty({ description: 'Objectif glycémie maximum (mg/dL)' })
  @Prop()
  objectifGlycemieMax: number;

  @ApiProperty({ description: 'Traitement actuel' })
  @Prop()
  traitementActuel: string;

  @ApiProperty({ description: 'Type d\'insuline utilisé' })
  @Prop()
  typeInsuline: string;

  @ApiProperty({ description: 'Fréquence d\'injection par jour' })
  @Prop()
  frequenceInjection: number;

  @ApiProperty({ description: 'Niveau d\'activité physique' })
  @Prop()
  niveauActivitePhysique: string;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);
