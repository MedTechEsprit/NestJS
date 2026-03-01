import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type OrderDocument = Order & Document;

@Schema()
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  productName: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ timestamps: true })
export class Order {
  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  pharmacistId: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @ApiProperty()
  @Prop({ required: true, min: 0 })
  totalPrice: number;

  @ApiProperty({ enum: ['pending', 'confirmed', 'ready', 'picked_up', 'cancelled'] })
  @Prop({ default: 'pending', enum: ['pending', 'confirmed', 'ready', 'picked_up', 'cancelled'] })
  status: string;

  @ApiProperty()
  @Prop({ default: '' })
  patientNote: string;

  @ApiProperty()
  @Prop({ default: '' })
  pharmacistNote: string;

  @ApiProperty()
  @Prop({ default: 0 })
  pointsAwarded: number;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ patientId: 1, status: 1 });
OrderSchema.index({ pharmacistId: 1, status: 1 });
