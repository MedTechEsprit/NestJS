import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PharmaciensService } from './pharmaciens.service';
import { PharmaciensController } from './pharmaciens.controller';
import { AuthModule } from '../auth/auth.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';

@Module({
  imports: [
    // Import AuthModule to access Pharmacien discriminator model
    AuthModule,
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
  ],
  controllers: [PharmaciensController],
  providers: [PharmaciensService],
  exports: [PharmaciensService],
})
export class PharmaciensModule {}
