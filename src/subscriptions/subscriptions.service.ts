import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
const Stripe = require('stripe');
import {
  PatientSubscription,
  PatientSubscriptionDocument,
} from './schemas/patient-subscription.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class SubscriptionsService {
  private readonly stripe: any | null;
  private readonly webhookSecret: string;

  constructor(
    @InjectModel(PatientSubscription.name)
    private readonly subscriptionModel: Model<PatientSubscriptionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {
    const stripeSecret = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = stripeSecret
      ? new Stripe(stripeSecret, {
          apiVersion: '2024-06-20',
        })
      : null;
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
  }

  async getMySubscription(patientId: string) {
    const sub = await this.subscriptionModel.findOne({
      patientId: new Types.ObjectId(patientId),
    });

    if (!sub) {
      return {
        isActive: false,
        status: 'inactive',
        planName: 'Premium Mensuel',
        amount: 20,
        currency: 'eur',
        subscribedAt: null,
        expiresAt: null,
        latestCheckoutSessionId: null,
      };
    }

    return {
      isActive: sub.isActive,
      status: sub.status,
      planName: sub.planName,
      amount: sub.amount,
      currency: sub.currency,
      subscribedAt: sub.subscribedAt,
      expiresAt: sub.expiresAt,
      latestCheckoutSessionId: sub.latestCheckoutSessionId,
    };
  }

  async createCheckoutSession(
    patientId: string,
    successUrl?: string,
    cancelUrl?: string,
  ) {
    const stripe = this.getStripeClient();
    const user = await this.userModel.findById(patientId).lean();
    if (!user) {
      throw new NotFoundException('Patient introuvable');
    }

    const patientObjectId = new Types.ObjectId(patientId);
    let sub = await this.subscriptionModel.findOne({ patientId: patientObjectId });

    const defaultClientUrl = this.configService.get<string>('STRIPE_CLIENT_URL') || 'http://localhost:5173';
    const stripeSuccessUrl =
      successUrl || `${defaultClientUrl}/premium-success?session_id={CHECKOUT_SESSION_ID}`;
    const stripeCancelUrl = cancelUrl || `${defaultClientUrl}/premium-cancel`;

    const customerId = await this.ensureStripeCustomer(user, sub?.stripeCustomerId);
    const currency = (this.configService.get<string>('STRIPE_PREMIUM_CURRENCY') || 'eur').toLowerCase();
    const amount = Number(this.configService.get<string>('STRIPE_PREMIUM_AMOUNT') || '20');

    const unitAmount = currency === 'tnd' ? Math.round(amount * 1000) : Math.round(amount * 100);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      success_url: stripeSuccessUrl,
      cancel_url: stripeCancelUrl,
      client_reference_id: patientId,
      metadata: {
        patientId,
        planCode: 'premium_monthly',
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            recurring: {
              interval: 'month',
            },
            product_data: {
              name: 'DiabCare Premium',
              description: 'Accès complet aux fonctionnalités IA patient',
            },
          },
        },
      ],
    });

    if (!sub) {
      sub = new this.subscriptionModel({
        patientId: patientObjectId,
        planCode: 'premium_monthly',
        planName: 'Premium Mensuel',
        amount,
        currency,
      });
    }

    sub.stripeCustomerId = customerId;
    sub.latestCheckoutSessionId = session.id;
    sub.status = 'pending_checkout';
    await sub.save();

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      publishableKey: this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') || '',
    };
  }

  async verifyCheckoutSession(patientId: string, sessionId: string) {
    const stripe = this.getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    const metadataPatientId = session.metadata?.patientId || session.client_reference_id;
    if (!metadataPatientId || metadataPatientId !== patientId) {
      throw new BadRequestException('Session Stripe invalide pour ce patient');
    }

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return {
        isActive: false,
        status: 'pending_payment',
      };
    }

    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!subscriptionId) {
      throw new InternalServerErrorException('Subscription Stripe non trouvée');
    }

    await this.syncStripeSubscription(patientId, subscriptionId);
    return this.getMySubscription(patientId);
  }

  async verifyLatestCheckoutSession(patientId: string) {
    const sub = await this.subscriptionModel.findOne({
      patientId: new Types.ObjectId(patientId),
    });

    if (!sub?.latestCheckoutSessionId) {
      return this.getMySubscription(patientId);
    }

    return this.verifyCheckoutSession(patientId, sub.latestCheckoutSessionId);
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const stripe = this.getStripeClient();
    if (!this.webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET non configuré');
    }

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new BadRequestException('Signature Stripe invalide');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const patientId = session.metadata?.patientId || session.client_reference_id;
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;

        if (patientId && subscriptionId) {
          await this.syncStripeSubscription(patientId, subscriptionId);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as any;
        await this.syncByStripeSubscription(stripeSub);
        break;
      }

      default:
        break;
    }

    return { received: true };
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
        patientId: String(user._id),
      },
    });

    return customer.id;
  }

  private async syncStripeSubscription(patientId: string, stripeSubscriptionId: string) {
    const stripe = this.getStripeClient();
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    await this.upsertSubscriptionFromStripe(patientId, stripeSub);
  }

  private getStripeClient() {
    if (!this.stripe) {
      throw new BadRequestException(
        'Paiement Stripe indisponible: STRIPE_SECRET_KEY non configurée',
      );
    }

    return this.stripe;
  }

  private async syncByStripeSubscription(stripeSub: any) {
    const existing = await this.subscriptionModel.findOne({
      stripeSubscriptionId: stripeSub.id,
    });

    const patientId =
      existing?.patientId?.toString() ||
      (stripeSub.metadata?.patientId as string | undefined) ||
      '';

    if (!patientId) {
      return;
    }

    await this.upsertSubscriptionFromStripe(patientId, stripeSub);
  }

  private async upsertSubscriptionFromStripe(patientId: string, stripeSub: any) {
    const patientObjectId = new Types.ObjectId(patientId);
    const isActive = ['active', 'trialing'].includes(stripeSub.status);

    const periodEndSeconds =
      (stripeSub as any).current_period_end ||
      (stripeSub.items.data[0] as any)?.current_period_end ||
      null;

    const expiresAt = periodEndSeconds ? new Date(periodEndSeconds * 1000) : undefined;

    const amountUnit = stripeSub.items.data[0]?.price?.unit_amount || 0;
    const currency = (stripeSub.items.data[0]?.price?.currency || 'eur').toLowerCase();
    const amount = currency === 'tnd' ? amountUnit / 1000 : amountUnit / 100;

    await this.subscriptionModel.findOneAndUpdate(
      { patientId: patientObjectId },
      {
        patientId: patientObjectId,
        planCode: 'premium_monthly',
        planName: 'Premium Mensuel',
        amount,
        currency,
        isActive,
        status: stripeSub.status,
        subscribedAt: stripeSub.created ? new Date(stripeSub.created * 1000) : new Date(),
        expiresAt,
        lastPaymentAt: new Date(),
        stripeCustomerId:
          typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id,
        stripeSubscriptionId: stripeSub.id,
      },
      {
        upsert: true,
        new: true,
      },
    );
  }
}