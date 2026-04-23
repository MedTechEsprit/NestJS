import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { ApiProperty } from '@nestjs/swagger';

export type PharmacienDocument = Pharmacien & Document;

@Schema({ timestamps: true })
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

  // ============ NOUVEAUX CHAMPS AJOUTÉS ============

  // Localisation géospatiale (GeoJSON - complètement optionnel)
  @ApiProperty({ description: 'Localisation de la pharmacie (GeoJSON Point) - Optionnel', required: false })
  @Prop({
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number],
    },
  })
  location?: {
    type: string;
    coordinates?: [number, number]; // [longitude, latitude]
  };

  @ApiProperty({ description: 'Latitude (copie pratique de location.coordinates[1])', required: false })
  @Prop({ type: Number })
  latitude?: number;

  @ApiProperty({ description: 'Longitude (copie pratique de location.coordinates[0])', required: false })
  @Prop({ type: Number })
  longitude?: number;

  // Système de points et badges
  @ApiProperty({ description: 'Points accumulés', default: 0 })
  @Prop({ default: 0 })
  points: number;

  @ApiProperty({ description: 'Niveau de badge', enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'] })
  @Prop({ default: 'bronze', enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'] })
  badgeLevel: string;

  @ApiProperty({ description: 'Liste des badges débloqués', type: [String] })
  @Prop({ type: [String], default: [] })
  unlockedBadges: string[];

  // Statistiques avancées
  @ApiProperty({ description: 'Nombre total de demandes reçues' })
  @Prop({ default: 0 })
  totalRequestsReceived: number;

  @ApiProperty({ description: 'Nombre total de demandes acceptées' })
  @Prop({ default: 0 })
  totalRequestsAccepted: number;

  @ApiProperty({ description: 'Nombre total de demandes refusées' })
  @Prop({ default: 0 })
  totalRequestsDeclined: number;

  @ApiProperty({ description: 'Nombre total de clients' })
  @Prop({ default: 0 })
  totalClients: number;

  @ApiProperty({ description: 'Revenu total généré' })
  @Prop({ default: 0 })
  totalRevenue: number;

  @ApiProperty({ description: 'Temps de réponse moyen (en minutes)' })
  @Prop({ default: 0 })
  averageResponseTime: number;

  @ApiProperty({ description: 'Note moyenne recalculée depuis les avis' })
  @Prop({ default: 0 })
  averageRating: number;

  @ApiProperty({ description: 'Nombre total d\'avis' })
  @Prop({ default: 0 })
  totalReviews: number;

  // Horaires de travail structurés
  @ApiProperty({ description: 'Horaires de travail hebdomadaires' })
  @Prop({
    type: Object,
    default: {
      monday: { open: '08:00', close: '19:00', isOpen: true },
      tuesday: { open: '08:00', close: '19:00', isOpen: true },
      wednesday: { open: '08:00', close: '19:00', isOpen: true },
      thursday: { open: '08:00', close: '19:00', isOpen: true },
      friday: { open: '08:00', close: '19:00', isOpen: true },
      saturday: { open: '09:00', close: '13:00', isOpen: true },
      sunday: { open: '', close: '', isOpen: false },
    },
  })
  workingHours: {
    monday: { open: string; close: string; isOpen: boolean };
    tuesday: { open: string; close: string; isOpen: boolean };
    wednesday: { open: string; close: string; isOpen: boolean };
    thursday: { open: string; close: string; isOpen: boolean };
    friday: { open: string; close: string; isOpen: boolean };
    saturday: { open: string; close: string; isOpen: boolean };
    sunday: { open: string; close: string; isOpen: boolean };
  };

  @ApiProperty({ description: 'Pharmacie de garde actuellement' })
  @Prop({ default: false })
  isOnDuty: boolean;

  // Paramètres de notification
  @ApiProperty({ description: 'Notifications push activées' })
  @Prop({ default: true })
  notificationsPush: boolean;

  @ApiProperty({ description: 'Notifications email activées' })
  @Prop({ default: true })
  notificationsEmail: boolean;

  @ApiProperty({ description: 'Notifications SMS activées' })
  @Prop({ default: true })
  notificationsSMS: boolean;

  // Visibilité et boost
  @ApiProperty({ description: 'Rayon de visibilité (en km)' })
  @Prop({ default: 5 })
  visibilityRadius: number;

  @ApiProperty({ description: 'Image de profil de la pharmacie' })
  @Prop()
  profileImage?: string;
}

export const PharmacienSchema = SchemaFactory.createForClass(Pharmacien);

// Index pour la recherche
PharmacienSchema.index({ numeroOrdre: 1 }, { unique: true });
PharmacienSchema.index({ nomPharmacie: 1 });
// Index géospatial pour la recherche de proximité (sparse pour éviter erreurs si location manquant)
PharmacienSchema.index({ location: '2dsphere' }, { sparse: true });
