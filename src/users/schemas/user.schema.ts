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

  @ApiProperty({ description: 'Liste des tokens FCM de l\'utilisateur', type: [String] })
  @Prop({ type: [String], default: [] })
  fcmTokens: string[];

  // Note: role field is managed automatically by Mongoose discriminatorKey
  // It's defined here for TypeScript typing but not as a @Prop
  @ApiProperty({ enum: Role, description: 'Rôle de l\'utilisateur' })
  role: Role;

  @ApiProperty({ enum: StatutCompte, description: 'Statut du compte' })
  @Prop({ default: StatutCompte.ACTIF, enum: StatutCompte })
  statutCompte: StatutCompte;

  @ApiProperty({ description: 'Profil suggéré (mise en avant)' })
  @Prop({ default: false })
  isSuggested: boolean;

  @ApiProperty({ description: 'Type de boost actif', enum: ['free', 'boost_7d', 'boost_15d', 'boost_30d', 'boost_24h', 'boost_week', 'boost_month'] })
  @Prop({
    default: 'free',
    enum: ['free', 'boost_7d', 'boost_15d', 'boost_30d', 'boost_24h', 'boost_week', 'boost_month'],
  })
  boostType: string;

  @ApiProperty({ description: 'Date d\'activation du boost' })
  @Prop()
  boostActivatedAt?: Date;

  @ApiProperty({ description: 'Date d\'expiration du boost' })
  @Prop()
  boostExpiresAt?: Date;

  @ApiProperty({ description: 'Date de création' })
  createdAt?: Date;

  @ApiProperty({ description: 'Date de mise à jour' })
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Note: email index already created via @Prop({ unique: true })
