import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  PatientSubscription,
  PatientSubscriptionDocument,
} from './schemas/patient-subscription.schema';
import {
  MedecinBoostSubscription,
  MedecinBoostSubscriptionDocument,
} from '../medecins/schemas/medecin-boost-subscription.schema';
import {
  RevenueCatWebhookEvent,
  RevenueCatWebhookEventDocument,
} from './schemas/revenuecat-webhook-event.schema';
import type { MedecinBoostType } from '../medecins/dto/activate-medecin-boost.dto';

const BOOST_PLANS: Record<MedecinBoostType, { label: string; days: number; price: number }> = {
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

type SyncSource = 'webhook' | 'verification' | 'backfill';

interface SyncContext {
  source: SyncSource;
  eventId?: string;
  eventType?: string;
  eventTimestampMs?: number;
}

@Injectable()
export class RevenueCatBillingService {
  private readonly logger = new Logger(RevenueCatBillingService.name);

  constructor(
    @InjectModel(PatientSubscription.name)
    private readonly subscriptionModel: Model<PatientSubscriptionDocument>,
    @InjectModel(MedecinBoostSubscription.name)
    private readonly medecinBoostSubscriptionModel: Model<MedecinBoostSubscriptionDocument>,
    @InjectModel(RevenueCatWebhookEvent.name)
    private readonly webhookEventModel: Model<RevenueCatWebhookEventDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {}

  getPremiumCatalog() {
    return {
      entitlementId: this.getPremiumEntitlementId(),
      productId: this.getPremiumProductId(),
      amount: Number(this.configService.get<string>('REVENUECAT_PREMIUM_AMOUNT') || '20'),
      currency: (this.configService.get<string>('REVENUECAT_PREMIUM_CURRENCY') || 'eur').toLowerCase(),
      planCode: 'premium_monthly',
      planName: 'Premium Mensuel',
    };
  }

  getBoostCatalog(boostType: MedecinBoostType) {
    const plan = BOOST_PLANS[boostType];
    return {
      entitlementId: this.getBoostEntitlementId(),
      productId: this.getBoostProductId(boostType),
      boostType,
      planName: plan.label,
      price: plan.price,
      days: plan.days,
      currency: (this.configService.get<string>('REVENUECAT_MEDECIN_BOOST_CURRENCY') || 'eur').toLowerCase(),
    };
  }

  async processWebhook(payload: any, authorizationHeader?: string) {
    const event = payload?.event;
    if (!event?.id || !event?.type) {
      throw new BadRequestException('Payload webhook RevenueCat invalide');
    }

    this.assertWebhookAuthorization(authorizationHeader);

    const existing = await this.webhookEventModel.findOne({ eventId: event.id }).lean();
    if (existing?.status === 'processed') {
      this.logger.warn(`Webhook RevenueCat duplique ignore: eventId=${event.id}`);
      return { received: true, duplicate: true, eventId: event.id };
    }

    const relatedAppUserIds = this.extractAppUserIds(event);
    const eventTimestampMs = this.toNumber(event.event_timestamp_ms);

    await this.webhookEventModel.findOneAndUpdate(
      { eventId: event.id },
      {
        eventId: event.id,
        eventType: String(event.type),
        provider: 'revenuecat',
        appUserId: typeof event.app_user_id === 'string' ? event.app_user_id : undefined,
        relatedAppUserIds,
        eventTimestampMs,
        status: 'processing',
        payload,
        errorMessage: null,
      },
      { upsert: true, new: true },
    );

    this.logger.log(
      `Webhook RevenueCat recu: eventId=${event.id} type=${event.type} users=${relatedAppUserIds.length}`,
    );

    try {
      for (const appUserId of relatedAppUserIds) {
        await this.syncByAppUserId(appUserId, {
          source: 'webhook',
          eventId: event.id,
          eventType: String(event.type),
          eventTimestampMs,
        });
      }

      await this.webhookEventModel.updateOne(
        { eventId: event.id },
        {
          $set: {
            status: 'processed',
            processedAt: new Date(),
          },
        },
      );

      return {
        received: true,
        duplicate: false,
        eventId: event.id,
        syncedAppUserIds: relatedAppUserIds,
      };
    } catch (error: any) {
      await this.webhookEventModel.updateOne(
        { eventId: event.id },
        {
          $set: {
            status: 'failed',
            errorMessage: error?.message || 'Erreur inconnue',
          },
        },
      );

      this.logger.error(
        `Erreur traitement webhook RevenueCat eventId=${event.id}: ${error?.message || error}`,
      );
      throw error;
    }
  }

  async syncPremiumForPatient(patientId: string, appUserIdHint?: string) {
    const context: SyncContext = { source: 'verification' };

    if (appUserIdHint && appUserIdHint !== patientId) {
      await this.syncByAppUserId(appUserIdHint, context);
    }

    await this.syncByAppUserId(patientId, context);

    const existing = await this.subscriptionModel
      .findOne({ patientId: new Types.ObjectId(patientId) })
      .select('revenueCatAppUserId')
      .lean();

    const mappedAppUserId = (existing as any)?.revenueCatAppUserId as string | undefined;
    if (mappedAppUserId && mappedAppUserId !== patientId) {
      await this.syncByAppUserId(mappedAppUserId, context);
    }
  }

  async syncBoostForMedecin(medecinId: string, appUserIdHint?: string) {
    const context: SyncContext = { source: 'verification' };

    if (appUserIdHint && appUserIdHint !== medecinId) {
      await this.syncByAppUserId(appUserIdHint, context);
    }

    await this.syncByAppUserId(medecinId, context);

    const existing = await this.medecinBoostSubscriptionModel
      .findOne({ medecinId: new Types.ObjectId(medecinId) })
      .select('revenueCatAppUserId')
      .lean();

    const mappedAppUserId = (existing as any)?.revenueCatAppUserId as string | undefined;
    if (mappedAppUserId && mappedAppUserId !== medecinId) {
      await this.syncByAppUserId(mappedAppUserId, context);
    }
  }

  async backfillRevenueCatState(limit = 1000) {
    const [patientSubs, medecinBoostSubs] = await Promise.all([
      this.subscriptionModel
        .find({})
        .select('patientId revenueCatAppUserId revenueCatOriginalAppUserId')
        .limit(limit)
        .lean(),
      this.medecinBoostSubscriptionModel
        .find({})
        .select('medecinId revenueCatAppUserId revenueCatOriginalAppUserId')
        .limit(limit)
        .lean(),
    ]);

    const appUserIds = new Set<string>();

    for (const sub of patientSubs as any[]) {
      if (sub?.patientId) {
        appUserIds.add(String(sub.patientId));
      }
      if (sub?.revenueCatAppUserId) {
        appUserIds.add(String(sub.revenueCatAppUserId));
      }
      if (sub?.revenueCatOriginalAppUserId) {
        appUserIds.add(String(sub.revenueCatOriginalAppUserId));
      }
    }

    for (const boost of medecinBoostSubs as any[]) {
      if (boost?.medecinId) {
        appUserIds.add(String(boost.medecinId));
      }
      if (boost?.revenueCatAppUserId) {
        appUserIds.add(String(boost.revenueCatAppUserId));
      }
      if (boost?.revenueCatOriginalAppUserId) {
        appUserIds.add(String(boost.revenueCatOriginalAppUserId));
      }
    }

    let processed = 0;
    let failed = 0;

    for (const appUserId of appUserIds) {
      try {
        await this.syncByAppUserId(appUserId, { source: 'backfill' });
        processed += 1;
      } catch (error: any) {
        failed += 1;
        this.logger.warn(
          `Backfill RevenueCat ignore pour appUserId=${appUserId}: ${error?.message || error}`,
        );
      }
    }

    return {
      totalCandidates: appUserIds.size,
      processed,
      failed,
    };
  }

  private async syncByAppUserId(appUserId: string, context: SyncContext) {
    if (!appUserId) {
      return;
    }

    const subscriber = await this.fetchSubscriber(appUserId);
    if (!subscriber) {
      return;
    }

    const allAppUserIds = this.extractAppUserIds(subscriber, appUserId);

    const [patientId, medecinId] = await Promise.all([
      this.findPatientIdByAppUserIds(allAppUserIds),
      this.findMedecinIdByAppUserIds(allAppUserIds),
    ]);

    if (!patientId && !medecinId) {
      this.logger.debug(
        `Aucun patient/medecin local trouve pour appUserIds=${allAppUserIds.join(',')}`,
      );
      return;
    }

    if (patientId) {
      await this.upsertPatientFromSubscriber(patientId, subscriber, allAppUserIds, context);
    }

    if (medecinId) {
      await this.upsertMedecinBoostFromSubscriber(medecinId, subscriber, allAppUserIds, context);
    }
  }

  private async upsertPatientFromSubscriber(
    patientId: string,
    subscriber: any,
    appUserIds: string[],
    context: SyncContext,
  ) {
    const patientObjectId = new Types.ObjectId(patientId);
    const existing = await this.subscriptionModel
      .findOne({ patientId: patientObjectId })
      .lean();

    const premiumCatalog = this.getPremiumCatalog();
    const premiumEntitlement =
      this.getEntitlementById(subscriber, premiumCatalog.entitlementId) ||
      this.getEntitlementByProduct(subscriber, [premiumCatalog.productId]);

    if (!existing && !premiumEntitlement) {
      return;
    }

    const now = new Date();
    const isActive = this.isEntitlementActive(premiumEntitlement, now);
    const subscribedAt =
      this.parseRevenueCatDate(premiumEntitlement?.purchase_date) ||
      (existing as any)?.subscribedAt ||
      undefined;

    let expiresAt = this.parseRevenueCatDate(premiumEntitlement?.expires_date);
    if (!isActive && !expiresAt && (existing as any)?.expiresAt) {
      expiresAt = new Date((existing as any).expiresAt);
    }

    const status = isActive ? 'active' : premiumEntitlement ? 'expired' : 'inactive';

    if (
      existing &&
      ((existing as any).status !== status || Boolean((existing as any).isActive) !== isActive)
    ) {
      this.logger.log(
        `Transition premium patient=${patientId} status=${(existing as any).status || 'none'}->${status}`,
      );
    }

    await this.subscriptionModel.findOneAndUpdate(
      { patientId: patientObjectId },
      {
        patientId: patientObjectId,
        planCode: premiumCatalog.planCode,
        planName: premiumCatalog.planName,
        amount: premiumCatalog.amount,
        currency: premiumCatalog.currency,
        isActive,
        status,
        subscribedAt,
        expiresAt,
        lastPaymentAt: subscribedAt || (isActive ? now : (existing as any)?.lastPaymentAt),
        billingProvider: 'revenuecat',
        revenueCatAppUserId: this.pickPreferredAppUserId(appUserIds, patientId),
        revenueCatOriginalAppUserId:
          subscriber?.original_app_user_id || (existing as any)?.revenueCatOriginalAppUserId,
        revenueCatEntitlementId: premiumCatalog.entitlementId,
        revenueCatProductId:
          premiumEntitlement?.product_identifier ||
          (existing as any)?.revenueCatProductId ||
          premiumCatalog.productId,
        latestVerificationId: context.eventId || (existing as any)?.latestVerificationId,
        lastRevenueCatEventTimestampMs:
          context.eventTimestampMs || (existing as any)?.lastRevenueCatEventTimestampMs,
        lastSyncedAt: now,
      },
      {
        upsert: true,
        new: true,
      },
    );
  }

  private async upsertMedecinBoostFromSubscriber(
    medecinId: string,
    subscriber: any,
    appUserIds: string[],
    context: SyncContext,
  ) {
    const medecinObjectId = new Types.ObjectId(medecinId);
    const existing = await this.medecinBoostSubscriptionModel
      .findOne({ medecinId: medecinObjectId })
      .lean();

    const boostEntitlementId = this.getBoostEntitlementId();
    const boostProductMap = this.getBoostProductMap();
    const boostProductIds = Object.keys(boostProductMap);

    const boostEntitlement =
      this.getEntitlementById(subscriber, boostEntitlementId) ||
      this.getEntitlementByProduct(subscriber, boostProductIds);

    const now = new Date();
    const isActive = this.isEntitlementActive(boostEntitlement, now);

    const productId =
      boostEntitlement?.product_identifier ||
      (existing as any)?.revenueCatProductId ||
      this.findLatestBoostProductFromSubscriber(subscriber, boostProductIds);

    const resolvedBoostType =
      (productId ? boostProductMap[productId] : undefined) ||
      ((existing as any)?.boostType as MedecinBoostType | undefined) ||
      'boost_7d';

    const plan = BOOST_PLANS[resolvedBoostType];
    const currency = (
      this.configService.get<string>('REVENUECAT_MEDECIN_BOOST_CURRENCY') ||
      (existing as any)?.currency ||
      'eur'
    ).toLowerCase();

    const activatedAt =
      this.parseRevenueCatDate(boostEntitlement?.purchase_date) ||
      (isActive ? now : (existing as any)?.activatedAt);

    let expiresAt = this.parseRevenueCatDate(boostEntitlement?.expires_date);
    if (isActive && !expiresAt) {
      expiresAt = new Date(now.getTime() + plan.days * 24 * 60 * 60 * 1000);
    }

    const status = isActive ? 'active' : boostEntitlement ? 'expired' : 'inactive';

    if (
      existing &&
      ((existing as any).status !== status || Boolean((existing as any).isActive) !== isActive)
    ) {
      this.logger.log(
        `Transition boost medecin=${medecinId} status=${(existing as any).status || 'none'}->${status}`,
      );
    }

    if (isActive) {
      await this.userModel.updateOne(
        {
          _id: medecinObjectId,
          role: { $regex: '^medecin$', $options: 'i' },
        },
        {
          $set: {
            isSuggested: true,
            boostType: resolvedBoostType,
            boostActivatedAt: activatedAt || now,
            boostExpiresAt: expiresAt,
          },
        },
      );
    } else {
      await this.userModel.updateOne(
        {
          _id: medecinObjectId,
          role: { $regex: '^medecin$', $options: 'i' },
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
    }

    await this.medecinBoostSubscriptionModel.findOneAndUpdate(
      { medecinId: medecinObjectId },
      {
        medecinId: medecinObjectId,
        boostType: resolvedBoostType,
        planName: plan.label,
        amount: plan.price,
        currency,
        isActive,
        status,
        activatedAt: isActive ? activatedAt || now : undefined,
        expiresAt,
        lastPaymentAt: activatedAt || (isActive ? now : (existing as any)?.lastPaymentAt),
        billingProvider: 'revenuecat',
        revenueCatAppUserId: this.pickPreferredAppUserId(appUserIds, medecinId),
        revenueCatOriginalAppUserId:
          subscriber?.original_app_user_id || (existing as any)?.revenueCatOriginalAppUserId,
        revenueCatEntitlementId: boostEntitlementId,
        revenueCatProductId: productId || this.getBoostProductId(resolvedBoostType),
        latestVerificationId: context.eventId || (existing as any)?.latestVerificationId,
        lastRevenueCatEventTimestampMs:
          context.eventTimestampMs || (existing as any)?.lastRevenueCatEventTimestampMs,
        lastSyncedAt: now,
      },
      {
        upsert: true,
        new: true,
      },
    );
  }

  private getEntitlementById(subscriber: any, entitlementId: string) {
    const entitlements = subscriber?.entitlements || {};
    return entitlements?.[entitlementId] || null;
  }

  private getEntitlementByProduct(subscriber: any, productIds: string[]) {
    const entitlements = subscriber?.entitlements || {};
    for (const entitlement of Object.values(entitlements) as any[]) {
      if (entitlement?.product_identifier && productIds.includes(entitlement.product_identifier)) {
        return entitlement;
      }
    }
    return null;
  }

  private findLatestBoostProductFromSubscriber(subscriber: any, productIds: string[]) {
    const subscriptions = subscriber?.subscriptions || {};

    let latestProductId: string | null = null;
    let latestPurchaseMs = 0;

    for (const [productId, sub] of Object.entries(subscriptions) as any[]) {
      if (!productIds.includes(productId)) {
        continue;
      }

      const purchaseMs = this.toDate(sub?.purchase_date)?.getTime() || 0;
      if (purchaseMs >= latestPurchaseMs) {
        latestPurchaseMs = purchaseMs;
        latestProductId = productId;
      }
    }

    return latestProductId;
  }

  private isEntitlementActive(entitlement: any, now: Date) {
    if (!entitlement) {
      return false;
    }

    const expiresAt = this.parseRevenueCatDate(entitlement.expires_date);
    if (!expiresAt) {
      return true;
    }

    return expiresAt.getTime() > now.getTime();
  }

  private parseRevenueCatDate(value?: string | null) {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date;
  }

  private toDate(value?: string | null) {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private async fetchSubscriber(appUserId: string) {
    const apiKey = this.configService.get<string>('REVENUECAT_SECRET_KEY');
    if (!apiKey) {
      throw new BadRequestException('REVENUECAT_SECRET_KEY non configuree');
    }

    const baseUrl =
      this.configService.get<string>('REVENUECAT_API_BASE_URL') ||
      'https://api.revenuecat.com/v1';

    try {
      const response = await axios.get(
        `${baseUrl.replace(/\/$/, '')}/subscribers/${encodeURIComponent(appUserId)}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 15000,
        },
      );

      return response.data?.subscriber || null;
    } catch (error: any) {
      const status = error?.response?.status;
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.message ||
        'Erreur RevenueCat';

      throw new BadRequestException(
        `Impossible de recuperer subscriber RevenueCat (${appUserId})${status ? ` [${status}]` : ''}: ${message}`,
      );
    }
  }

  private assertWebhookAuthorization(authorizationHeader?: string) {
    const expected = this.configService.get<string>('REVENUECAT_WEBHOOK_AUTH_SECRET');
    if (!expected) {
      throw new BadRequestException('REVENUECAT_WEBHOOK_AUTH_SECRET non configuree');
    }

    const actual = (authorizationHeader || '').trim();
    const isValid = actual === expected || actual === `Bearer ${expected}`;

    if (!isValid) {
      throw new BadRequestException('Authorization webhook RevenueCat invalide');
    }
  }

  private extractAppUserIds(source: any, fallbackId?: string) {
    const values = new Set<string>();

    const add = (value?: string | null) => {
      if (!value || typeof value !== 'string') {
        return;
      }
      const normalized = value.trim();
      if (!normalized) {
        return;
      }
      values.add(normalized);
    };

    if (fallbackId) {
      add(fallbackId);
    }

    add(source?.app_user_id);
    add(source?.original_app_user_id);

    const aliases = Array.isArray(source?.aliases) ? source.aliases : [];
    for (const alias of aliases) {
      add(alias);
    }

    const transferredFrom = Array.isArray(source?.transferred_from)
      ? source.transferred_from
      : [];
    for (const appUserId of transferredFrom) {
      add(appUserId);
    }

    const transferredTo = Array.isArray(source?.transferred_to)
      ? source.transferred_to
      : [];
    for (const appUserId of transferredTo) {
      add(appUserId);
    }

    return Array.from(values);
  }

  private async findPatientIdByAppUserIds(appUserIds: string[]) {
    const fromSubscription = await this.subscriptionModel
      .findOne({
        $or: [
          { revenueCatAppUserId: { $in: appUserIds } },
          { revenueCatOriginalAppUserId: { $in: appUserIds } },
        ],
      })
      .select('patientId')
      .lean();

    if ((fromSubscription as any)?.patientId) {
      return String((fromSubscription as any).patientId);
    }

    const objectIds = appUserIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (!objectIds.length) {
      return null;
    }

    const user = await this.userModel
      .findOne({
        _id: { $in: objectIds },
        role: { $regex: '^patient$', $options: 'i' },
      })
      .select('_id')
      .lean();

    return user?._id ? String(user._id) : null;
  }

  private async findMedecinIdByAppUserIds(appUserIds: string[]) {
    const fromBoostSubscription = await this.medecinBoostSubscriptionModel
      .findOne({
        $or: [
          { revenueCatAppUserId: { $in: appUserIds } },
          { revenueCatOriginalAppUserId: { $in: appUserIds } },
        ],
      })
      .select('medecinId')
      .lean();

    if ((fromBoostSubscription as any)?.medecinId) {
      return String((fromBoostSubscription as any).medecinId);
    }

    const objectIds = appUserIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (!objectIds.length) {
      return null;
    }

    const user = await this.userModel
      .findOne({
        _id: { $in: objectIds },
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .select('_id')
      .lean();

    return user?._id ? String(user._id) : null;
  }

  private getPremiumEntitlementId() {
    return this.configService.get<string>('REVENUECAT_PREMIUM_ENTITLEMENT_ID') || 'premium';
  }

  private getPremiumProductId() {
    return this.configService.get<string>('REVENUECAT_PREMIUM_PRODUCT_ID') || 'premium_monthly';
  }

  private getBoostEntitlementId() {
    return (
      this.configService.get<string>('REVENUECAT_MEDECIN_BOOST_ENTITLEMENT_ID') ||
      'doctor_boost'
    );
  }

  private getBoostProductMap(): Record<string, MedecinBoostType> {
    const map: Record<string, MedecinBoostType> = {};

    map[this.getBoostProductId('boost_7d')] = 'boost_7d';
    map[this.getBoostProductId('boost_15d')] = 'boost_15d';
    map[this.getBoostProductId('boost_30d')] = 'boost_30d';

    return map;
  }

  private getBoostProductId(boostType: MedecinBoostType) {
    if (boostType === 'boost_7d') {
      return this.configService.get<string>('REVENUECAT_BOOST_7D_PRODUCT_ID') || 'boost_7d';
    }

    if (boostType === 'boost_15d') {
      return this.configService.get<string>('REVENUECAT_BOOST_15D_PRODUCT_ID') || 'boost_15d';
    }

    return this.configService.get<string>('REVENUECAT_BOOST_30D_PRODUCT_ID') || 'boost_30d';
  }

  private pickPreferredAppUserId(appUserIds: string[], userId: string) {
    if (appUserIds.includes(userId)) {
      return userId;
    }

    return appUserIds[0] || userId;
  }

  private toNumber(value: any): number | undefined {
    if (value == null) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
