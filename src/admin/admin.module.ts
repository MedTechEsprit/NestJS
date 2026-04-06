import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Complaint, ComplaintSchema } from '../complaints/schemas/complaint.schema';
import {
  PatientSubscription,
  PatientSubscriptionSchema,
} from '../subscriptions/schemas/patient-subscription.schema';
import {
  MedecinBoostSubscription,
  MedecinBoostSubscriptionSchema,
} from '../medecins/schemas/medecin-boost-subscription.schema';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Complaint.name, schema: ComplaintSchema },
      { name: PatientSubscription.name, schema: PatientSubscriptionSchema },
      {
        name: MedecinBoostSubscription.name,
        schema: MedecinBoostSubscriptionSchema,
      },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminJwtGuard],
})
export class AdminModule {}