import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Complaint, ComplaintDocument } from '../complaints/schemas/complaint.schema';
import {
  PatientSubscription,
  PatientSubscriptionDocument,
} from '../subscriptions/schemas/patient-subscription.schema';
import {
  MedecinBoostSubscription,
  MedecinBoostSubscriptionDocument,
} from '../medecins/schemas/medecin-boost-subscription.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Complaint.name) private complaintModel: Model<ComplaintDocument>,
    @InjectModel(PatientSubscription.name)
    private patientSubscriptionModel: Model<PatientSubscriptionDocument>,
    @InjectModel(MedecinBoostSubscription.name)
    private medecinBoostSubscriptionModel: Model<MedecinBoostSubscriptionDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  login(username: string, password: string) {
    if (username !== 'admin' || password !== 'admin') {
      return null;
    }

    const payload = {
      sub: 'static-admin',
      role: 'ADMIN',
      isAdmin: true,
      username: 'admin',
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET') || 'diabetes-secret-key',
      expiresIn: '12h',
    });

    return {
      admin: { username: 'admin', role: 'ADMIN' },
      accessToken,
    };
  }

  async getDashboardStats() {
    const [
      totalUsers,
      userRoles,
      activeUsers,
      totalProducts,
      activeProducts,
      totalOrders,
      completedOrders,
      complaintStats,
      revenueAgg,
      totalSubscriptions,
      activeSubscriptions,
      subscriptionStats,
      totalBoosts,
      activeBoosts,
      boostStats,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      this.userModel.countDocuments({ statutCompte: 'ACTIF' }),
      this.productModel.countDocuments(),
      this.productModel.countDocuments({ isActive: true }),
      this.orderModel.countDocuments(),
      this.orderModel.countDocuments({ status: 'picked_up' }),
      this.complaintModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.orderModel.aggregate([
        { $match: { status: 'picked_up' } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ]),
      this.patientSubscriptionModel.countDocuments(),
      this.patientSubscriptionModel.countDocuments({ isActive: true }),
      this.patientSubscriptionModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.medecinBoostSubscriptionModel.countDocuments(),
      this.medecinBoostSubscriptionModel.countDocuments({ isActive: true }),
      this.medecinBoostSubscriptionModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const usersByRole: Record<string, number> = {};
    userRoles.forEach((item) => {
      usersByRole[item._id] = item.count;
    });

    const complaintsByStatus: Record<string, number> = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
    };
    complaintStats.forEach((item) => {
      complaintsByStatus[item._id] = item.count;
    });

    const subscriptionsByStatus: Record<string, number> = {};
    subscriptionStats.forEach((item) => {
      subscriptionsByStatus[item._id || 'unknown'] = item.count;
    });

    const boostsByStatus: Record<string, number> = {};
    boostStats.forEach((item) => {
      boostsByStatus[item._id || 'unknown'] = item.count;
    });

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        byRole: usersByRole,
      },
      products: {
        total: totalProducts,
        active: activeProducts,
      },
      orders: {
        total: totalOrders,
        completed: completedOrders,
        revenue: revenueAgg[0]?.total || 0,
      },
      complaints: {
        total:
          complaintsByStatus.open +
          complaintsByStatus.in_progress +
          complaintsByStatus.resolved +
          complaintsByStatus.rejected,
        byStatus: complaintsByStatus,
      },
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        byStatus: subscriptionsByStatus,
      },
      boosts: {
        total: totalBoosts,
        active: activeBoosts,
        byStatus: boostsByStatus,
      },
    };
  }

  async listUsers(page = 1, limit = 20, role?: string) {
    const filter: any = {};
    if (role) filter.role = role;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-motDePasse')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async updateUserStatus(userId: string, statutCompte: string) {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { statutCompte }, { new: true })
      .select('-motDePasse')
      .exec();

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  async listProducts(page = 1, limit = 20, search?: string) {
    const filter: any = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.productModel
        .find(filter)
        .populate('pharmacistId', 'nom prenom nomPharmacie email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.productModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async updateProductStatus(productId: string, isActive: boolean) {
    const product = await this.productModel
      .findByIdAndUpdate(productId, { isActive }, { new: true })
      .populate('pharmacistId', 'nom prenom nomPharmacie email')
      .exec();

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    return product;
  }

  async listComplaints(page = 1, limit = 20, status?: string) {
    const filter: any = {};
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.complaintModel
        .find(filter)
        .populate('userId', 'nom prenom email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.complaintModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async listOrders(page = 1, limit = 20, status?: string) {
    const filter: any = {};
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .populate('patientId', 'nom prenom email')
        .populate('pharmacistId', 'nom prenom email nomPharmacie')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.orderModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async updateOrderStatus(orderId: string, status: string) {
    const order = await this.orderModel
      .findByIdAndUpdate(orderId, { status }, { new: true })
      .populate('patientId', 'nom prenom email')
      .populate('pharmacistId', 'nom prenom email nomPharmacie')
      .exec();

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    return order;
  }

  async listSubscriptions(page = 1, limit = 20, status?: string) {
    const filter: any = {};
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.patientSubscriptionModel
        .find(filter)
        .populate('patientId', 'nom prenom email role statutCompte')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.patientSubscriptionModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async listMedecinBoosts(page = 1, limit = 20, status?: string) {
    const filter: any = {};
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.medecinBoostSubscriptionModel
        .find(filter)
        .populate('medecinId', 'nom prenom email role statutCompte isSuggested boostType boostExpiresAt')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.medecinBoostSubscriptionModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async getComplaintById(complaintId: string) {
    const complaint = await this.complaintModel
      .findById(complaintId)
      .populate('userId', 'nom prenom email role telephone statutCompte createdAt')
      .lean();

    if (!complaint) {
      throw new NotFoundException('Réclamation non trouvée');
    }

    return complaint;
  }

  async updateComplaintStatus(complaintId: string, status: string, adminNote?: string) {
    const complaint = await this.complaintModel
      .findByIdAndUpdate(
        complaintId,
        { status, adminNote: adminNote || '' },
        { new: true },
      )
      .populate('userId', 'nom prenom email role')
      .exec();

    if (!complaint) {
      throw new NotFoundException('Réclamation non trouvée');
    }

    return complaint;
  }
}