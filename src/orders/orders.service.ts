import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { FirebaseService } from '../firebase/firebase.service';

// ── Points Constants ──────────────────────────────────────────────
const POINTS = {
  ORDER_CONFIRMED: 10,
  ORDER_READY: 5,
  ORDER_PICKED_UP: 15,
  PER_ITEM_SOLD: 5,
  FAST_CONFIRM_BONUS: 3, // < 5 min
  FIRST_ORDER_OF_DAY: 5,
  MILESTONE_10_ORDERS: 50,
  MILESTONE_50_ORDERS: 150,
  MILESTONE_100_ORDERS: 300,
};

const BADGE_THRESHOLDS = {
  bronze: 0,
  silver: 100,
  gold: 500,
  platinum: 1000,
  diamond: 5000,
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectConnection() private connection: Connection,
    private readonly firebaseService: FirebaseService,
  ) {}

  async create(patientId: string, dto: CreateOrderDto): Promise<Order> {
    // Validate products and calculate total
    let totalPrice = 0;
    const orderItems: any[] = [];

    for (const item of dto.items) {
      const product = await this.productModel.findById(item.productId);
      if (!product) throw new NotFoundException(`Produit ${item.productId} non trouvé`);
      if (product.stock < item.quantity) {
        throw new BadRequestException(`Stock insuffisant pour ${product.name} (${product.stock} disponibles)`);
      }
      if (product.pharmacistId.toString() !== dto.pharmacistId) {
        throw new BadRequestException(`Le produit ${product.name} n'appartient pas à ce pharmacien`);
      }
      totalPrice += product.price * item.quantity;
      orderItems.push({
        productId: new Types.ObjectId(item.productId),
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
      });
    }

    // Decrement stock
    for (const item of dto.items) {
      await this.productModel.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity, totalSold: item.quantity },
      });
    }

    const order = new this.orderModel({
      patientId: new Types.ObjectId(patientId),
      pharmacistId: new Types.ObjectId(dto.pharmacistId),
      items: orderItems,
      totalPrice,
      patientNote: dto.patientNote || '',
    });
    const saved = await order.save();

    // Trigger: notify pharmacy when patient sends a new medication order.
    await this.firebaseService.sendToUser(
      dto.pharmacistId,
      'pharmacy',
      'Nouvelle ordonnance',
      'Un patient a passé une nouvelle commande.',
      {
        orderId: String((saved as any)._id),
        patientId: String(patientId),
        pharmacyId: String(dto.pharmacistId),
      },
    );

    return saved;
  }

  async findByPatient(patientId: string): Promise<Order[]> {
    return this.orderModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .populate('pharmacistId', 'nom prenom nomPharmacie')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByPharmacist(pharmacistId: string, status?: string): Promise<Order[]> {
    const filter: any = { pharmacistId: new Types.ObjectId(pharmacistId) };
    if (status) filter.status = status;
    return this.orderModel
      .find(filter)
      .populate('patientId', 'nom prenom email telephone')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(orderId: string, pharmacistId: string, newStatus: string, note?: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Commande non trouvée');
    if (order.pharmacistId.toString() !== pharmacistId) {
      throw new BadRequestException('Cette commande ne vous appartient pas');
    }

    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['ready', 'cancelled'],
      ready: ['picked_up'],
    };
    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Transition ${order.status} → ${newStatus} non autorisée`);
    }

    order.status = newStatus;
    if (note) order.pharmacistNote = note;

    // Award points
    let pointsEarned = 0;
    if (newStatus === 'confirmed') {
      pointsEarned += POINTS.ORDER_CONFIRMED;
      // Fast confirm bonus (< 5 min)
      const timeDiff = (Date.now() - (order as any).createdAt.getTime()) / 60000;
      if (timeDiff < 5) pointsEarned += POINTS.FAST_CONFIRM_BONUS;
    } else if (newStatus === 'ready') {
      pointsEarned += POINTS.ORDER_READY;
    } else if (newStatus === 'picked_up') {
      pointsEarned += POINTS.ORDER_PICKED_UP;
      pointsEarned += order.items.length * POINTS.PER_ITEM_SOLD;

      // First order of day bonus
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ordersToday = await this.orderModel.countDocuments({
        pharmacistId: order.pharmacistId,
        status: 'picked_up',
        updatedAt: { $gte: today },
      });
      if (ordersToday === 0) pointsEarned += POINTS.FIRST_ORDER_OF_DAY;

      // Milestone bonuses
      const totalCompleted = await this.orderModel.countDocuments({
        pharmacistId: order.pharmacistId,
        status: 'picked_up',
      });
      if (totalCompleted === 9) pointsEarned += POINTS.MILESTONE_10_ORDERS;
      if (totalCompleted === 49) pointsEarned += POINTS.MILESTONE_50_ORDERS;
      if (totalCompleted === 99) pointsEarned += POINTS.MILESTONE_100_ORDERS;
    }

    if (pointsEarned > 0) {
      order.pointsAwarded = (order.pointsAwarded || 0) + pointsEarned;
      await this._awardPoints(pharmacistId, pointsEarned, order.totalPrice, newStatus === 'picked_up');
    }

    // Trigger: notify patient when pharmacy updates order status.
    await this.firebaseService.sendToUser(
      String(order.patientId),
      'patient',
      'Mise à jour commande',
      `Votre commande est maintenant: ${newStatus}`,
      {
        orderId: String(order._id),
        patientId: String(order.patientId),
        pharmacyId: String(order.pharmacistId),
        status: String(newStatus),
      },
    );

    return order.save();
  }

  async cancelByPatient(orderId: string, patientId: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Commande non trouvée');
    if (order.patientId.toString() !== patientId) {
      throw new BadRequestException('Cette commande ne vous appartient pas');
    }
    if (order.status !== 'pending') {
      throw new BadRequestException('Seules les commandes en attente peuvent être annulées');
    }
    // Restore stock
    for (const item of order.items) {
      await this.productModel.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity, totalSold: -item.quantity },
      });
    }
    order.status = 'cancelled';

    // Trigger: notify pharmacy when patient cancels an order.
    await this.firebaseService.sendToUser(
      String(order.pharmacistId),
      'pharmacy',
      'Commande annulée',
      'Le patient a annulé une commande.',
      {
        orderId: String(order._id),
        patientId: String(order.patientId),
        pharmacyId: String(order.pharmacistId),
        status: 'cancelled',
      },
    );

    return order.save();
  }

  async getPharmacistStats(pharmacistId: string) {
    const pid = new Types.ObjectId(pharmacistId);
    const [totalOrders, completedOrders, pendingOrders, revenue] = await Promise.all([
      this.orderModel.countDocuments({ pharmacistId: pid }),
      this.orderModel.countDocuments({ pharmacistId: pid, status: 'picked_up' }),
      this.orderModel.countDocuments({ pharmacistId: pid, status: { $in: ['pending', 'confirmed', 'ready'] } }),
      this.orderModel.aggregate([
        { $match: { pharmacistId: pid, status: 'picked_up' } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ]),
    ]);
    return {
      totalOrders,
      completedOrders,
      pendingOrders,
      totalRevenue: revenue[0]?.total || 0,
    };
  }

  private async _awardPoints(pharmacistId: string, points: number, orderTotal: number, isCompleted: boolean) {
    const usersCollection = this.connection.collection('users');
    const update: any = { $inc: { points: points } };

    if (isCompleted) {
      update.$inc.totalRevenue = orderTotal;
      update.$inc.totalClients = 1;
    }

    await usersCollection.updateOne(
      { _id: new Types.ObjectId(pharmacistId) },
      update,
    );

    // Update badge level
    const pharmacist = await usersCollection.findOne({ _id: new Types.ObjectId(pharmacistId) });
    if (pharmacist) {
      const totalPoints = pharmacist.points || 0;
      let newBadge = 'bronze';
      if (totalPoints >= BADGE_THRESHOLDS.diamond) newBadge = 'diamond';
      else if (totalPoints >= BADGE_THRESHOLDS.platinum) newBadge = 'platinum';
      else if (totalPoints >= BADGE_THRESHOLDS.gold) newBadge = 'gold';
      else if (totalPoints >= BADGE_THRESHOLDS.silver) newBadge = 'silver';

      if (pharmacist.badgeLevel !== newBadge) {
        await usersCollection.updateOne(
          { _id: new Types.ObjectId(pharmacistId) },
          {
            $set: { badgeLevel: newBadge },
            $addToSet: { unlockedBadges: newBadge },
          },
        );
      }
    }
  }

  static getPointsConfig() {
    return { POINTS, BADGE_THRESHOLDS };
  }
}
