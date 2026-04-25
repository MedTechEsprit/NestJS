import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Patient, PatientDocument } from '../patients/schemas/patient.schema';
import { Medecin, MedecinDocument } from '../medecins/schemas/medecin.schema';
import { Pharmacien, PharmacienDocument } from '../pharmaciens/schemas/pharmacien.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { RegisterMedecinDto } from './dto/register-medecin.dto';
import { RegisterPharmacienDto } from './dto/register-pharmacien.dto';
import { Role } from '../common/enums/role.enum';
import { StatutCompte } from '../common/enums/statut-compte.enum';
import { SessionsService } from '../sessions/sessions.service';
import { GoogleMobileLoginDto } from './dto/google-mobile-login.dto';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  private googleWebClientId: string | null;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Patient.name) private patientModel: Model<PatientDocument>,
    @InjectModel(Medecin.name) private medecinModel: Model<MedecinDocument>,
    @InjectModel(Pharmacien.name) private pharmacienModel: Model<PharmacienDocument>,
    private jwtService: JwtService,
    private sessionsService: SessionsService,
    private configService: ConfigService,
  ) {}

  onModuleInit() {
    const clientIds = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_IDS') || '';
    this.googleWebClientId = this.configService.get<string>('GOOGLE_WEB_CLIENT_ID') || null;

    const audience = [
      ...clientIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
      ...(this.googleWebClientId ? [this.googleWebClientId] : []),
    ];

    this.googleClient = new OAuth2Client(audience.length > 0 ? audience[0] : undefined);
  }

  /**
   * Register a new patient
   */
  async registerPatient(
    registerDto: RegisterPatientDto,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: Partial<Patient>; accessToken: string }> {
    const { email, motDePasse, ...patientData } = registerDto;

    // Check if email already exists
    await this.checkEmailExists(email);

    // Hash password
    const hashedPassword = await this.hashPassword(motDePasse);

    // Create patient with discriminator (role is auto-set by discriminator)
    const newPatient = new this.patientModel({
      ...patientData,
      ...this.normalizeCoordinates(
        registerDto.latitude,
        registerDto.longitude,
        registerDto.location,
      ),
      email: email.toLowerCase(),
      motDePasse: hashedPassword,
      statutCompte: StatutCompte.ACTIF,
    });

    const savedPatient = await newPatient.save();

    // Generate JWT and create session
    return this.generateAuthResponse(savedPatient, deviceInfo, ipAddress, userAgent);
  }

  /**
   * Register a new medecin
   */
  async registerMedecin(
    registerDto: RegisterMedecinDto,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: Partial<Medecin>; accessToken: string }> {
    const { email, motDePasse, numeroOrdre, ...medecinData } = registerDto;

    // Check if email already exists
    await this.checkEmailExists(email);

    // Check if numeroOrdre already exists
    const existingMedecin = await this.medecinModel.findOne({ numeroOrdre }).exec();
    if (existingMedecin) {
      throw new ConflictException('Ce numéro d\'ordre est déjà utilisé');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(motDePasse);

    // Create medecin with discriminator (role is auto-set by discriminator)
    const newMedecin = new this.medecinModel({
      ...medecinData,
      numeroOrdre,
      email: email.toLowerCase(),
      motDePasse: hashedPassword,
      statutCompte: StatutCompte.ACTIF,
      anneesExperience: registerDto.anneesExperience || 0,
      listePatients: [],
      noteMoyenne: 0,
    });

    const savedMedecin = await newMedecin.save();

    // Generate JWT and create session
    return this.generateAuthResponse(savedMedecin, deviceInfo, ipAddress, userAgent);
  }

  /**
   * Register a new pharmacien
   */
  async registerPharmacien(
    registerDto: RegisterPharmacienDto,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: Partial<Pharmacien>; accessToken: string }> {
    const { email, motDePasse, numeroOrdre, ...pharmacienData } = registerDto;

    // Check if email already exists
    await this.checkEmailExists(email);

    // Check if numeroOrdre already exists
    const existingPharmacien = await this.pharmacienModel.findOne({ numeroOrdre }).exec();
    if (existingPharmacien) {
      throw new ConflictException('Ce numéro d\'ordre est déjà utilisé');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(motDePasse);

    // Create pharmacien with discriminator (role is auto-set by discriminator)
    const newPharmacien = new this.pharmacienModel({
      ...pharmacienData,
      numeroOrdre,
      ...this.normalizeCoordinates(
        registerDto.latitude,
        registerDto.longitude,
        registerDto.location,
      ),
      email: email.toLowerCase(),
      motDePasse: hashedPassword,
      statutCompte: StatutCompte.ACTIF,
      servicesProposes: registerDto.servicesProposes || [],
      listeMedicamentsDisponibles: registerDto.listeMedicamentsDisponibles || [],
      noteMoyenne: 0,
    });

    const savedPharmacien = await newPharmacien.save();

    // Keep only canonical location fields on pharmacy documents.
    await this.pharmacienModel
      .updateOne({ _id: savedPharmacien._id }, { $unset: { pharmacyLocation: '' } })
      .exec();

    // Generate JWT and create session
    return this.generateAuthResponse(savedPharmacien, deviceInfo, ipAddress, userAgent);
  }

  /**
   * Login user (unified for all roles)
   */
  async login(
    loginDto: LoginDto,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: Partial<User>; accessToken: string }> {
    const { email, motDePasse } = loginDto;

    // Find user by email
    const user = await this.userModel.findOne({ email: email.toLowerCase() }).exec();

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(motDePasse, user.motDePasse);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Generate JWT and create session
    return this.generateAuthResponse(user, deviceInfo, ipAddress, userAgent);
  }

  async loginWithGoogleMobile(
    googleLoginDto: GoogleMobileLoginDto,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: Partial<User>; accessToken: string }> {
    const payload = await this.verifyGoogleIdToken(googleLoginDto.idToken);

    const email = payload.email?.toLowerCase();
    if (!email) {
      throw new UnauthorizedException('Impossible de lire l\'email Google');
    }

    let user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      const requestedRole = googleLoginDto.role || Role.PATIENT;
      if (requestedRole !== Role.PATIENT) {
        throw new BadRequestException(
          'La création Google automatique est disponible uniquement pour le rôle PATIENT',
        );
      }

      const [prenom, ...nomRest] = (payload.name || '').trim().split(' ').filter(Boolean);
      const generatedPassword = await this.hashPassword(`google_${payload.sub}_${Date.now()}`);

      const newPatient = new this.patientModel({
        nom: nomRest.join(' ') || prenom || 'Utilisateur',
        prenom: prenom || 'Google',
        email,
        motDePasse: generatedPassword,
        photoProfil: payload.picture,
        statutCompte: StatutCompte.ACTIF,
      });

      user = await newPatient.save();
    }

    return this.generateAuthResponse(user, deviceInfo, ipAddress, userAgent);
  }

  async validateUser(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId).exec();
  }

  async getProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    const { motDePasse: _, ...userResponse } = user.toObject();

    return userResponse;
  }

  /**
   * Private helper: Check if email already exists
   */
  private async checkEmailExists(email: string): Promise<void> {
    const existingUser = await this.userModel.findOne({ email: email.toLowerCase() }).exec();
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }
  }

  /**
   * Private helper: Hash password
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  private async verifyGoogleIdToken(idToken: string) {
    const configuredClientIds = [
      ...(this.configService
        .get<string>('GOOGLE_OAUTH_CLIENT_IDS', '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)),
      ...(this.googleWebClientId ? [this.googleWebClientId] : []),
    ];

    if (configuredClientIds.length === 0) {
      throw new BadRequestException(
        'Configuration Google manquante: GOOGLE_WEB_CLIENT_ID ou GOOGLE_OAUTH_CLIENT_IDS',
      );
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: configuredClientIds,
      });

      const payload = ticket.getPayload();

      if (!payload || !payload.email_verified) {
        throw new UnauthorizedException('Token Google invalide ou email non vérifié');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Token Google invalide');
    }
  }

  private normalizeCoordinates(
    latitude?: number,
    longitude?: number,
    location?: { type: 'Point'; coordinates: [number, number] },
  ) {
    let resolvedLatitude = latitude;
    let resolvedLongitude = longitude;
    let resolvedLocation = location;

    if (
      (!resolvedLocation || !Array.isArray(resolvedLocation.coordinates)) &&
      resolvedLatitude != null &&
      resolvedLongitude != null
    ) {
      resolvedLocation = {
        type: 'Point',
        coordinates: [resolvedLongitude, resolvedLatitude],
      };
    }

    if (
      resolvedLocation &&
      Array.isArray(resolvedLocation.coordinates) &&
      resolvedLocation.coordinates.length >= 2
    ) {
      const [lng, lat] = resolvedLocation.coordinates;
      if (typeof lat === 'number') resolvedLatitude = lat;
      if (typeof lng === 'number') resolvedLongitude = lng;
    }

    return {
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
      location: resolvedLocation,
    };
  }

  /**
   * Private helper: Generate JWT token and create session
   */
  private async generateAuthResponse(
    user: UserDocument,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: Partial<User>; accessToken: string }> {
    // Generate JWT token
    const userId = (user._id as any).toString();
    const payload = {
      sub: userId,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.sessionsService.createSession(
      userId,
      accessToken,
      expiresAt,
      deviceInfo,
      ipAddress,
      userAgent,
    );

    // Return user without password
    const { motDePasse: _, ...userResponse } = user.toObject();

    return {
      user: userResponse,
      accessToken,
    };
  }
}
