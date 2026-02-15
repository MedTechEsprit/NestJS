import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { ApiProperty } from '@nestjs/swagger';

export type PharmacienDocument = Pharmacien & Document;

// Note: No @Schema() decorator for discriminator schemas
export class Pharmacien extends User {
  @ApiProperty({ description: 'Numéro d\'ordre des pharmaciens' })
  @Prop({ required: true, unique: true })
  numeroOrdre: string;

  @ApiProperty({ description: 'Nom de la pharmacie' })
  @Prop({ required: true })
  nomPharmacie: string;

  @ApiProperty({ description: 'Adresse de la pharmacie' })
  @Prop()
  adressePharmacie: string;

  @ApiProperty({ description: 'Horaires d\'ouverture' })
  @Prop({ type: Object })
  horaires: Record<string, any>;

  @ApiProperty({ description: 'Téléphone de la pharmacie' })
  @Prop()
  telephonePharmacie: string;

  @ApiProperty({ description: 'Services proposés', type: [String] })
  @Prop({ type: [String], default: [] })
  servicesProposes: string[];

  @ApiProperty({ description: 'Liste des médicaments disponibles', type: [String] })
  @Prop({ type: [String], default: [] })
  listeMedicamentsDisponibles: string[];

  @ApiProperty({ description: 'Note moyenne' })
  @Prop({ default: 0, min: 0, max: 5 })
  noteMoyenne: number;
}

export const PharmacienSchema = SchemaFactory.createForClass(Pharmacien);

// Index for pharmacy name search (numeroOrdre already has unique index from @Prop)
PharmacienSchema.index({ nomPharmacie: 1 });
