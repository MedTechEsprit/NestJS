import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../common/enums/role.enum';
import { StatutCompte } from '../../common/enums/statut-compte.enum';
import { ApiProperty } from '@nestjs/swagger';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  discriminatorKey: 'role',
  collection: 'users',
})
export class User {
  @ApiProperty({ description: 'Nom de l\'utilisateur' })
  @Prop({ required: true })
  nom: string;

  @ApiProperty({ description: 'Prénom de l\'utilisateur' })
  @Prop({ required: true })
  prenom: string;

  @ApiProperty({ description: 'Email de l\'utilisateur' })
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  motDePasse: string;

  @ApiProperty({ description: 'Numéro de téléphone' })
  @Prop()
  telephone: string;

  @ApiProperty({ description: 'URL de la photo de profil' })
  @Prop()
  photoProfil: string;

  @ApiProperty({ enum: Role, description: 'Rôle de l\'utilisateur' })
  @Prop({ required: true, enum: Role })
  role: Role;

  @ApiProperty({ enum: StatutCompte, description: 'Statut du compte' })
  @Prop({ default: StatutCompte.ACTIF, enum: StatutCompte })
  statutCompte: StatutCompte;

  @ApiProperty({ description: 'Date de création' })
  createdAt?: Date;

  @ApiProperty({ description: 'Date de mise à jour' })
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Index pour la recherche par email
UserSchema.index({ email: 1 }, { unique: true });
