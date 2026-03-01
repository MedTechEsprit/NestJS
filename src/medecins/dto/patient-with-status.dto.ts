import { ApiProperty } from '@nestjs/swagger';
import { TypeDiabete } from '../../common/enums/type-diabete.enum';

export enum PatientStatus {
  STABLE = 'stable',
  ATTENTION = 'attention',
  CRITICAL = 'critical',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export class LastReadingInfo {
  @ApiProperty({ description: 'Valeur de glycémie en mg/dL' })
  value?: number;

  @ApiProperty({ description: 'Date de la mesure' })
  measuredAt?: Date;

  @ApiProperty({ enum: RiskLevel, description: 'Niveau de risque' })
  riskLevel?: RiskLevel;
}

export class PatientWithStatusDto {
  @ApiProperty({ description: 'ID du patient' })
  _id: string;

  @ApiProperty({ description: 'Prénom du patient' })
  prenom: string;

  @ApiProperty({ description: 'Nom du patient' })
  nom: string;

  @ApiProperty({ description: 'Email du patient' })
  email: string;

  @ApiProperty({ description: 'Téléphone du patient' })
  telephone?: string;

  @ApiProperty({ description: 'Date de naissance' })
  dateNaissance?: Date;

  @ApiProperty({ description: 'Âge en années' })
  age?: number;

  @ApiProperty({ enum: TypeDiabete, description: 'Type de diabète' })
  typeDiabete?: TypeDiabete;

  @ApiProperty({ enum: PatientStatus, description: 'Statut de santé du patient' })
  status: PatientStatus;

  @ApiProperty({ type: LastReadingInfo, description: 'Dernière mesure de glycémie' })
  lastReading?: LastReadingInfo;

  @ApiProperty({ description: 'Initiales du patient' })
  initials: string;
}

export class MyPatientsResponseDto {
  @ApiProperty({ type: [PatientWithStatusDto], description: 'Liste des patients' })
  data: PatientWithStatusDto[];

  @ApiProperty({ description: 'Nombre total de patients' })
  total: number;

  @ApiProperty({ description: 'Page actuelle' })
  page: number;

  @ApiProperty({ description: 'Limite par page' })
  limit: number;

  @ApiProperty({ description: 'Nombre total de pages' })
  totalPages: number;

  @ApiProperty({ description: 'Compteurs par statut' })
  statusCounts: {
    stable: number;
    attention: number;
    critical: number;
  };
}
