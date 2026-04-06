import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Medecin, MedecinDocument } from './schemas/medecin.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateMedecinDto } from './dto/create-medecin.dto';
import { UpdateMedecinDto } from './dto/update-medecin.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { Role } from '../common/enums/role.enum';
import { StatutCompte } from '../common/enums/statut-compte.enum';
import { GlucoseService } from '../glucose/glucose.service';
import { 
  PatientWithStatusDto, 
  MyPatientsResponseDto, 
  PatientStatus, 
  RiskLevel 
} from './dto/patient-with-status.dto';
import { MedecinBoostType } from './dto/activate-medecin-boost.dto';
import {
  MedecinBoostSubscription,
  MedecinBoostSubscriptionDocument,
} from './schemas/medecin-boost-subscription.schema';
const Stripe = require('stripe');

const MEDECIN_BOOST_PLANS: Record<
  MedecinBoostType,
  { label: string; days: number; price: number }
> = {
  boost_7d: {
    label: 'Boost 7 jours',
    days: 7,
    price: 12,
  },
  boost_15d: {
    label: 'Boost 15 jours',
    days: 15,
    price: 20,
  },
  boost_30d: {
    label: 'Boost 30 jours',
    days: 30,
    price: 35,
  },
};

@Injectable()
export class MedecinsService {
  private readonly stripe: any | null;
  private readonly boostWebhookSecret: string;

  constructor(
    @InjectModel(Medecin.name) private medecinModel: Model<MedecinDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(MedecinBoostSubscription.name)
    private readonly medecinBoostSubscriptionModel: Model<MedecinBoostSubscriptionDocument>,
    private glucoseService: GlucoseService,
    private readonly configService: ConfigService,
  ) {
    const stripeSecret = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = stripeSecret
      ? new Stripe(stripeSecret, {
          apiVersion: '2024-06-20',
        })
      : null;
    this.boostWebhookSecret =
      this.configService.get<string>('STRIPE_MEDECIN_BOOST_WEBHOOK_SECRET') ||
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ||
      '';
  }

  async create(createMedecinDto: CreateMedecinDto): Promise<Partial<Medecin>> {
    const { email, motDePasse, numeroOrdre, ...rest } = createMedecinDto;

    // Vérifier si l'email existe déjà
    const existingMedecin = await this.medecinModel
      .findOne({ $or: [{ email: email.toLowerCase() }, { numeroOrdre }] })
      .exec();

    if (existingMedecin) {
      if (existingMedecin.email === email.toLowerCase()) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      throw new ConflictException('Ce numéro d\'ordre est déjà utilisé');
    }

    // Hasher le mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(motDePasse, saltRounds);

    const newMedecin = new this.medecinModel({
      ...rest,
      email: email.toLowerCase(),
      motDePasse: hashedPassword,
      numeroOrdre,
      role: Role.MEDECIN,
      statutCompte: StatutCompte.ACTIF,
      listePatients: [],
      noteMoyenne: 0,
    });

    const savedMedecin = await newMedecin.save();
    const medecinObj = savedMedecin.toObject() as Record<string, any>;
    const { motDePasse: _, ...medecinResponse } = medecinObj;

    return medecinResponse as Partial<Medecin>;
  }

  async findAll(
    paginationDto: PaginationDto,
    specialite?: string,
  ): Promise<PaginatedResult<Partial<Medecin>>> {
    await this.refreshExpiredBoosts();

    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // Use userModel with case-insensitive role filter
    const filter: any = { role: { $regex: '^medecin$', $options: 'i' } };
    if (specialite) {
      filter.specialite = { $regex: specialite, $options: 'i' };
    }

    const [medecins, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-motDePasse')
        .populate('listePatients', 'nom prenom email')
        .skip(skip)
        .limit(limit)
        .sort({ isSuggested: -1, boostExpiresAt: -1, noteMoyenne: -1, createdAt: -1 })
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      data: medecins,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Partial<Medecin>> {
    await this.refreshExpiredBoosts();

    // Use userModel with case-insensitive role filter
    const medecin = await this.userModel
      .findOne({
        _id: id,
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .select('-motDePasse')
      .populate('listePatients', 'nom prenom email telephone typeDiabete')
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    return medecin;
  }

  async update(
    id: string,
    updateMedecinDto: UpdateMedecinDto,
  ): Promise<Partial<Medecin>> {
    const medecin = await this.userModel
      .findOne({
        _id: id,
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    // Hasher le nouveau mot de passe si fourni
    if (updateMedecinDto.motDePasse) {
      const saltRounds = 10;
      updateMedecinDto.motDePasse = await bcrypt.hash(
        updateMedecinDto.motDePasse,
        saltRounds,
      );
    }

    // Convertir les IDs de patients en ObjectId
    if (updateMedecinDto.listePatients) {
      (updateMedecinDto as any).listePatients = updateMedecinDto.listePatients.map(
        (patientId) => new Types.ObjectId(patientId),
      );
    }

    const updatedMedecin = await this.userModel
      .findByIdAndUpdate(id, updateMedecinDto, { new: true })
      .select('-motDePasse')
      .populate('listePatients', 'nom prenom email')
      .exec();

    if (!updatedMedecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    return updatedMedecin;
  }

  async remove(id: string): Promise<{ message: string }> {
    const medecin = await this.userModel
      .findOne({
        _id: id,
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    await this.userModel.findByIdAndDelete(id).exec();

    return { message: 'Médecin supprimé avec succès' };
  }

  async getMyDoctors(patientId: string): Promise<any[]> {
    await this.refreshExpiredBoosts();

    const doctors = await this.userModel
      .find({
        role: { $regex: '^medecin$', $options: 'i' },
        listePatients: new Types.ObjectId(patientId),
      })
      .select('nom prenom email telephone specialite clinique adresseCabinet description noteMoyenne photoProfil isSuggested boostType boostExpiresAt')
      .sort({ isSuggested: -1, boostExpiresAt: -1, noteMoyenne: -1 })
      .lean()
      .exec();
    return doctors;
  }

  getBoostPlans() {
    const currency = (
      this.configService.get<string>('STRIPE_MEDECIN_BOOST_CURRENCY') || 'eur'
    ).toUpperCase();

    return Object.entries(MEDECIN_BOOST_PLANS).map(([boostType, plan]) => ({
      boostType,
      label: plan.label,
      days: plan.days,
      price: plan.price,
      currency,
    }));
  }

  async createBoostCheckoutSession(
    medecinId: string,
    boostType: MedecinBoostType,
    successUrl?: string,
    cancelUrl?: string,
  ) {
    const plan = MEDECIN_BOOST_PLANS[boostType];
    if (!plan) {
      throw new BadRequestException('Type de boost médecin invalide');
    }

    const stripe = this.getStripeClient();
    const medecin = await this.userModel
      .findOne({
        _id: new Types.ObjectId(medecinId),
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const medecinObjectId = new Types.ObjectId(medecinId);
    let boostSub = await this.medecinBoostSubscriptionModel.findOne({ medecinId: medecinObjectId });

    const defaultClientUrl = this.configService.get<string>('STRIPE_CLIENT_URL') || 'http://localhost:5173';
    const stripeSuccessUrl =
      successUrl || `${defaultClientUrl}/doctor-boost-success?session_id={CHECKOUT_SESSION_ID}`;
    const stripeCancelUrl = cancelUrl || `${defaultClientUrl}/doctor-boost-cancel`;

    const customerId = await this.ensureStripeCustomer(medecin, boostSub?.stripeCustomerId);
    const currency = (
      this.configService.get<string>('STRIPE_MEDECIN_BOOST_CURRENCY') || 'eur'
    ).toLowerCase();
    const unitAmount = currency === 'tnd' ? Math.round(plan.price * 1000) : Math.round(plan.price * 100);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      payment_method_types: ['card'],
      success_url: stripeSuccessUrl,
      cancel_url: stripeCancelUrl,
      client_reference_id: medecinId,
      metadata: {
        medecinId,
        boostType,
        planLabel: plan.label,
        planDays: String(plan.days),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: `DiabCare ${plan.label}`,
              description: `Mise en avant profil médecin suggéré pendant ${plan.days} jours`,
            },
          },
        },
      ],
    });

    if (!boostSub) {
      boostSub = new this.medecinBoostSubscriptionModel({
        medecinId: medecinObjectId,
        boostType,
        planName: plan.label,
        amount: plan.price,
        currency,
      });
    }

    boostSub.boostType = boostType;
    boostSub.planName = plan.label;
    boostSub.amount = plan.price;
    boostSub.currency = currency;
    boostSub.stripeCustomerId = customerId;
    boostSub.latestCheckoutSessionId = session.id;
    boostSub.status = 'pending_checkout';
    boostSub.isActive = false;
    await boostSub.save();

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      boostType,
      label: plan.label,
      price: plan.price,
      currency: currency.toUpperCase(),
      publishableKey: this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') || '',
    };
  }

  async verifyBoostCheckoutSession(medecinId: string, sessionId: string) {
    const stripe = this.getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const metadataMedecinId = session.metadata?.medecinId || session.client_reference_id;
    if (!metadataMedecinId || metadataMedecinId !== medecinId) {
      throw new BadRequestException('Session Stripe invalide pour ce médecin');
    }

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return this.getBoostStatus(medecinId);
    }

    await this.syncBoostFromCheckoutSession(session.id);
    return this.getBoostStatus(medecinId);
  }

  async verifyLatestBoostCheckoutSession(medecinId: string) {
    const boostSub = await this.medecinBoostSubscriptionModel.findOne({
      medecinId: new Types.ObjectId(medecinId),
    });

    if (!boostSub?.latestCheckoutSessionId) {
      return this.getBoostStatus(medecinId);
    }

    return this.verifyBoostCheckoutSession(medecinId, boostSub.latestCheckoutSessionId);
  }

  async handleBoostWebhook(rawBody: Buffer, signature: string) {
    const stripe = this.getStripeClient();
    if (!this.boostWebhookSecret) {
      throw new BadRequestException('Secret webhook Stripe boost médecin non configuré');
    }

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, this.boostWebhookSecret);
    } catch {
      throw new BadRequestException('Signature Stripe invalide');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      if (session?.id) {
        await this.syncBoostFromCheckoutSession(session.id);
      }
    }

    return { received: true };
  }

  async getBoostStatus(medecinId: string) {
    await this.refreshExpiredBoosts();

    const [medecin, boostSub] = await Promise.all([
      this.userModel
        .findOne({
          _id: new Types.ObjectId(medecinId),
          role: { $regex: '^medecin$', $options: 'i' },
        })
        .select('isSuggested boostType boostActivatedAt boostExpiresAt')
        .lean()
        .exec(),
      this.medecinBoostSubscriptionModel
        .findOne({ medecinId: new Types.ObjectId(medecinId) })
        .lean()
        .exec(),
    ]);

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const boostData = medecin as any;
    const now = new Date();
    const isActive =
      boostData.isSuggested === true &&
      boostData.boostType &&
      boostData.boostType !== 'free' &&
      boostData.boostExpiresAt &&
      new Date(boostData.boostExpiresAt).getTime() > now.getTime();

    const remainingMs = isActive
      ? new Date(boostData.boostExpiresAt).getTime() - now.getTime()
      : 0;
    const remainingDays = isActive
      ? Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
      : 0;

    return {
      isActive,
      isSuggested: isActive,
      boostType: isActive ? boostData.boostType : 'free',
      startsAt: isActive ? boostData.boostActivatedAt : null,
      expiresAt: isActive ? boostData.boostExpiresAt : null,
      remainingDays,
      price:
        isActive && boostData.boostType && MEDECIN_BOOST_PLANS[boostData.boostType as MedecinBoostType]
          ? MEDECIN_BOOST_PLANS[boostData.boostType as MedecinBoostType].price
          : null,
      currency: ((boostSub as any)?.currency || this.configService.get<string>('STRIPE_MEDECIN_BOOST_CURRENCY') || 'eur').toUpperCase(),
      paymentStatus: (boostSub as any)?.status || 'inactive',
      latestCheckoutSessionId: (boostSub as any)?.latestCheckoutSessionId || null,
      lastPaymentAt: (boostSub as any)?.lastPaymentAt || null,
    };
  }

  private async refreshExpiredBoosts(): Promise<void> {
    const now = new Date();
    await this.userModel.updateMany(
      {
        role: { $regex: '^medecin$', $options: 'i' },
        isSuggested: true,
        boostExpiresAt: { $lte: now },
      },
      {
        $set: {
          isSuggested: false,
          boostType: 'free',
        },
        $unset: {
          boostActivatedAt: '',
          boostExpiresAt: '',
        },
      },
    );

    await this.medecinBoostSubscriptionModel.updateMany(
      {
        isActive: true,
        expiresAt: { $lte: now },
      },
      {
        $set: {
          isActive: false,
          status: 'expired',
        },
      },
    );
  }

  private getStripeClient() {
    if (!this.stripe) {
      throw new BadRequestException(
        'Paiement Stripe indisponible: STRIPE_SECRET_KEY non configurée',
      );
    }

    return this.stripe;
  }

  private async ensureStripeCustomer(user: any, existingCustomerId?: string) {
    const stripe = this.getStripeClient();
    if (existingCustomerId) {
      return existingCustomerId;
    }

    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.prenom || ''} ${user.nom || ''}`.trim(),
      metadata: {
        medecinId: String(user._id),
      },
    });

    return customer.id;
  }

  private async syncBoostFromCheckoutSession(sessionId: string) {
    const stripe = this.getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const medecinId =
      (session.metadata?.medecinId as string | undefined) ||
      (session.client_reference_id as string | undefined);
    const boostType = session.metadata?.boostType as MedecinBoostType | undefined;

    if (!medecinId || !boostType) {
      return;
    }

    const plan = MEDECIN_BOOST_PLANS[boostType];
    if (!plan) {
      return;
    }

    const paymentPaid = session.payment_status === 'paid' || session.status === 'complete';
    if (!paymentPaid) {
      return;
    }

    const medecinObjectId = new Types.ObjectId(medecinId);
    const existingMedecin = await this.userModel
      .findOne({
        _id: medecinObjectId,
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .select('boostExpiresAt')
      .lean()
      .exec();

    if (!existingMedecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const now = new Date();
    const currentExpiry = (existingMedecin as any).boostExpiresAt
      ? new Date((existingMedecin as any).boostExpiresAt)
      : null;
    const startAt = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
    const expiresAt = new Date(startAt.getTime() + plan.days * 24 * 60 * 60 * 1000);

    const currency = session.currency || this.configService.get<string>('STRIPE_MEDECIN_BOOST_CURRENCY') || 'eur';
    const amountTotal = session.amount_total || 0;
    const normalizedAmount = currency.toLowerCase() === 'tnd' ? amountTotal / 1000 : amountTotal / 100;

    await this.userModel.updateOne(
      { _id: medecinObjectId },
      {
        $set: {
          isSuggested: true,
          boostType,
          boostActivatedAt: now,
          boostExpiresAt: expiresAt,
        },
      },
    );

    await this.medecinBoostSubscriptionModel.findOneAndUpdate(
      { medecinId: medecinObjectId },
      {
        medecinId: medecinObjectId,
        boostType,
        planName: plan.label,
        amount: normalizedAmount,
        currency: currency.toLowerCase(),
        isActive: true,
        status: 'paid',
        activatedAt: now,
        expiresAt,
        lastPaymentAt: new Date(),
        stripeCustomerId:
          typeof session.customer === 'string' ? session.customer : session.customer?.id,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id,
        latestCheckoutSessionId: session.id,
      },
      {
        upsert: true,
        new: true,
      },
    );
  }

  async addPatient(medecinId: string, patientId: string): Promise<Partial<Medecin>> {
    // Verify doctor exists
    const medecin = await this.userModel
      .findOne({
        _id: new Types.ObjectId(medecinId),
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const patientObjectId = new Types.ObjectId(patientId);

    // Use collection.updateOne directly to bypass schema strict mode
    // This ensures the listePatients field is added even if not in base schema
    const result = await this.userModel.collection.updateOne(
      { _id: new Types.ObjectId(medecinId) },
      { $addToSet: { listePatients: patientObjectId } }
    );

    if (result.modifiedCount === 0 && result.matchedCount === 0) {
      throw new NotFoundException('Médecin non trouvé');
    }

    // Return updated doctor
    const updatedMedecin = await this.userModel.findById(medecinId).lean().exec();
    return updatedMedecin as Partial<Medecin>;
  }

  async removePatient(medecinId: string, patientId: string): Promise<Partial<Medecin>> {
    const medecin = await this.userModel
      .findOne({
        _id: medecinId,
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const patientObjectId = new Types.ObjectId(patientId);
    const listePatients = ((medecin as any).listePatients || []).filter(
      (p: Types.ObjectId) => !p.equals(patientObjectId),
    );

    const updatedMedecin = await this.userModel
      .findByIdAndUpdate(
        medecinId,
        { listePatients },
        { new: true }
      )
      .select('-motDePasse')
      .populate('listePatients', 'nom prenom email')
      .exec();

    if (!updatedMedecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    return updatedMedecin;
  }

  async hasPatientAccess(medecinId: string, patientId: string): Promise<boolean> {
    const medecin = await this.userModel.collection.findOne({
      _id: new Types.ObjectId(medecinId),
      role: { $regex: '^medecin$', $options: 'i' } as any,
    });

    if (!medecin) {
      return false;
    }

    const listePatients = ((medecin as any)?.listePatients || []).map((id: any) => id.toString());
    const isLinkedPatient = listePatients.includes(patientId);

    if (!isLinkedPatient) {
      return false;
    }

    const accessMap = (medecin as any)?.patientAccessMap || {};
    const explicitAccess = accessMap[patientId];

    return explicitAccess == null ? true : Boolean(explicitAccess);
  }

  async setPatientAccess(medecinId: string, patientId: string, enabled: boolean): Promise<void> {
    const medecin = await this.userModel.collection.findOne({
      _id: new Types.ObjectId(medecinId),
      role: { $regex: '^medecin$', $options: 'i' } as any,
    });

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const listePatients = ((medecin as any)?.listePatients || []).map((id: any) => id.toString());
    if (!listePatients.includes(patientId)) {
      throw new NotFoundException('Patient non lié à ce médecin');
    }

    await this.userModel.collection.updateOne(
      { _id: new Types.ObjectId(medecinId) },
      { $set: { [`patientAccessMap.${patientId}`]: enabled } },
    );
  }

  async updateNote(id: string, note: number): Promise<Partial<Medecin>> {
    const medecin = await this.userModel
      .findOne({
        _id: id,
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    // Simple moyenne avec la note existante (à améliorer avec un système de reviews)
    const noteMoyenne = ((medecin as any).noteMoyenne + note) / 2;
    await this.userModel.findByIdAndUpdate(id, { noteMoyenne }).exec();

    const medecinObj = medecin.toObject() as Record<string, any>;
    const { motDePasse: _, ...medecinResponse } = medecinObj;

    return medecinResponse as Partial<Medecin>;
  }

  async getMyPatients(
    medecinId: string,
    paginationDto: PaginationDto,
    statusFilter?: string,
    searchQuery?: string,
  ): Promise<MyPatientsResponseDto> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // Get the doctor with patient list - explicitly select listePatients field
    const medecin = await this.userModel
      .findOne({
        _id: medecinId,
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .select('+listePatients')
      .lean()
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const listePatients = (medecin as any).listePatients || [];
    
    if (listePatients.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        statusCounts: { stable: 0, attention: 0, critical: 0 },
      };
    }

    // Build filter for patients
    const patientFilter: any = {
      _id: { $in: listePatients },
      role: { $regex: '^patient$', $options: 'i' },
    };

    // Add search filter if provided
    if (searchQuery && searchQuery.trim() !== '') {
      patientFilter.$or = [
        { nom: { $regex: searchQuery, $options: 'i' } },
        { prenom: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    // Get all matching patients
    const patients = await this.userModel
      .find(patientFilter)
      .select('nom prenom email telephone photoProfil dateNaissance typeDiabete objectifGlycemieMin objectifGlycemieMax')
      .exec();

    // Enrich patients with health status
    const enrichedPatients = await Promise.all(
      patients.map(async (patient) => {
        const patientObj = patient.toObject() as any;
        
        // Calculate age
        let age: number | undefined;
        if (patientObj.dateNaissance) {
          const birthDate = new Date(patientObj.dateNaissance);
          const today = new Date();
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
        }

        // Get latest glucose readings (last 7 days)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const recentReadings = await this.glucoseService.findByDateRange(
          patientObj._id.toString(),
          oneWeekAgo,
          new Date(),
        );

        // Calculate status and get last reading
        const { status, lastReading } = this.calculatePatientStatus(
          recentReadings,
          patientObj.objectifGlycemieMin,
          patientObj.objectifGlycemieMax,
        );

        // Generate initials
        const initials = `${patientObj.prenom?.charAt(0) || ''}${patientObj.nom?.charAt(0) || ''}`.toUpperCase();

        return {
          _id: patientObj._id.toString(),
          prenom: patientObj.prenom,
          nom: patientObj.nom,
          email: patientObj.email,
          telephone: patientObj.telephone,
          photoProfil: patientObj.photoProfil,
          dateNaissance: patientObj.dateNaissance,
          age,
          typeDiabete: patientObj.typeDiabete,
          status,
          lastReading,
          initials,
        };
      }),
    );

    // Filter by status if provided
    let filteredPatients = enrichedPatients;
    if (statusFilter && statusFilter !== 'all') {
      filteredPatients = enrichedPatients.filter(
        (p) => p.status === statusFilter,
      );
    }

    // Calculate status counts
    const statusCounts = {
      stable: enrichedPatients.filter((p) => p.status === PatientStatus.STABLE).length,
      attention: enrichedPatients.filter((p) => p.status === PatientStatus.ATTENTION).length,
      critical: enrichedPatients.filter((p) => p.status === PatientStatus.CRITICAL).length,
    };

    // Apply pagination
    const total = filteredPatients.length;
    const paginatedPatients = filteredPatients.slice(skip, skip + limit);

    return {
      data: paginatedPatients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts,
    };
  }

  private calculatePatientStatus(
    readings: any[],
    minTarget?: number,
    maxTarget?: number,
  ): { status: PatientStatus; lastReading?: any } {
    if (!readings || readings.length === 0) {
      return {
        status: PatientStatus.STABLE,
        lastReading: undefined,
      };
    }

    // Get the most recent reading
    const latestReading = readings[0];

    // Default targets if not set (typical ranges)
    const min = minTarget || 70;
    const max = maxTarget || 180;

    // Calculate average of recent readings
    const avgValue = readings.reduce((sum, r) => sum + r.value, 0) / readings.length;

    // Determine risk level for last reading
    let riskLevel: RiskLevel;
    if (latestReading.value < min - 20 || latestReading.value > max + 50) {
      riskLevel = RiskLevel.HIGH;
    } else if (latestReading.value < min || latestReading.value > max) {
      riskLevel = RiskLevel.MEDIUM;
    } else {
      riskLevel = RiskLevel.LOW;
    }

    // Determine overall status
    let status: PatientStatus;
    if (avgValue < min - 20 || avgValue > max + 50) {
      status = PatientStatus.CRITICAL;
    } else if (avgValue < min - 10 || avgValue > max + 30) {
      status = PatientStatus.ATTENTION;
    } else {
      status = PatientStatus.STABLE;
    }

    return {
      status,
      lastReading: {
        value: latestReading.value,
        measuredAt: latestReading.measuredAt,
        riskLevel,
      },
    };
  }

  async toggleAccountStatus(medecinId: string): Promise<Partial<Medecin>> {
    const medecin = await this.userModel
      .findOne({
        _id: new Types.ObjectId(medecinId),
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    // Toggle between ACTIF and INACTIF
    const currentStatus = (medecin as any).statutCompte;
    const newStatus = currentStatus === StatutCompte.ACTIF 
      ? StatutCompte.INACTIF 
      : StatutCompte.ACTIF;

    const updatedMedecin = await this.userModel
      .findByIdAndUpdate(
        medecinId,
        { statutCompte: newStatus },
        { new: true }
      )
      .select('-motDePasse')
      .lean()
      .exec();

    if (!updatedMedecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    return updatedMedecin as Partial<Medecin>;
  }

  async getAccountStatus(medecinId: string): Promise<{ 
    statutCompte: StatutCompte; 
    isActive: boolean;
    _id: string;
    nom: string;
    prenom: string;
    email: string;
  }> {
    const medecin = await this.userModel
      .findOne({
        _id: new Types.ObjectId(medecinId),
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .select('statutCompte nom prenom email')
      .lean()
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const medecinData = medecin as any;
    
    return {
      statutCompte: medecinData.statutCompte,
      isActive: medecinData.statutCompte === StatutCompte.ACTIF,
      _id: medecinData._id.toString(),
      nom: medecinData.nom,
      prenom: medecinData.prenom,
      email: medecinData.email,
    };
  }
}
