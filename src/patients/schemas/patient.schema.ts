import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { TypeDiabete } from '../../common/enums/type-diabete.enum';
import { Sexe } from '../../common/enums/sexe.enum';
import { ApiProperty } from '@nestjs/swagger';
import {
  ProfilMedical,
  ProfilMedicalSchema,
} from './profil-medical.schema';

export type PatientDocument = Patient & Document;

@Schema()
export class Patient extends User {
  // ── Informations de base (remplies à l'inscription) ────────────
  @ApiProperty({ description: 'Date de naissance' })
  @Prop()
  dateNaissance: Date;

  @ApiProperty({ enum: Sexe, description: 'Sexe du patient' })
  @Prop({ enum: Sexe })
  sexe: Sexe;

  @ApiProperty({ enum: TypeDiabete, description: 'Type de diabète' })
  @Prop({ enum: TypeDiabete })
  typeDiabete: TypeDiabete;

  @ApiProperty({ description: 'Groupe sanguin' })
  @Prop()
  groupeSanguin: string;

  // ── Sous-document profil médical complet ───────────────────────
  @ApiProperty({ description: 'Profil médical détaillé', type: ProfilMedical })
  @Prop({ type: ProfilMedicalSchema, default: {} })
  profilMedical: ProfilMedical;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);
