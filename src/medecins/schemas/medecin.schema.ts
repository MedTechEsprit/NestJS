import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { ApiProperty } from '@nestjs/swagger';

export type MedecinDocument = Medecin & Document;

@Schema()
export class Medecin extends User {
  @ApiProperty({ description: 'Spécialité du médecin' })
  @Prop({ required: true })
  specialite: string;

  @ApiProperty({ description: 'Numéro d\'ordre des médecins' })
  @Prop({ required: true, unique: true })
  numeroOrdre: string;

  @ApiProperty({ description: 'Années d\'expérience' })
  @Prop({ default: 0 })
  anneesExperience: number;

  @ApiProperty({ description: 'Nom de la clinique' })
  @Prop()
  clinique: string;

  @ApiProperty({ description: 'Adresse du cabinet' })
  @Prop()
  adresseCabinet: string;

  @ApiProperty({ description: 'Description du médecin' })
  @Prop()
  description: string;

  @ApiProperty({ description: 'Tarif de consultation en €' })
  @Prop()
  tarifConsultation: number;

  @ApiProperty({ description: 'Disponibilité du médecin' })
  @Prop({ type: Object })
  disponibilite: Record<string, any>;

  @ApiProperty({ description: 'Liste des patients (ObjectId)', type: [String] })
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Patient' }], default: [] })
  listePatients: Types.ObjectId[];

  @ApiProperty({ description: 'Note moyenne' })
  @Prop({ default: 0, min: 0, max: 5 })
  noteMoyenne: number;

  @ApiProperty({ description: 'Type d\'abonnement plateforme' })
  @Prop()
  abonnementPlateforme: string;
}

export const MedecinSchema = SchemaFactory.createForClass(Medecin);

// Index pour la recherche
MedecinSchema.index({ specialite: 1 });
MedecinSchema.index({ numeroOrdre: 1 }, { unique: true });
