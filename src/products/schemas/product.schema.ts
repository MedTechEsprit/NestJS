import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  @ApiProperty({ description: 'ID du pharmacien propriétaire' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  pharmacistId: Types.ObjectId;

  @ApiProperty({ description: 'Nom du produit' })
  @Prop({ required: true })
  name: string;

  @ApiProperty({ description: 'Description du produit' })
  @Prop({ default: '' })
  description: string;

  @ApiProperty({ description: 'Prix en DZD' })
  @Prop({ required: true, min: 0 })
  price: number;

  @ApiProperty({ description: 'Catégorie', enum: ['medicament', 'supplement', 'materiel', 'hygiene', 'autre'] })
  @Prop({ required: true, enum: ['medicament', 'supplement', 'materiel', 'hygiene', 'autre'] })
  category: string;

  @ApiProperty({ description: 'Quantité en stock' })
  @Prop({ default: 0, min: 0 })
  stock: number;

  @ApiProperty({ description: 'URL de l\'image' })
  @Prop({ default: '' })
  imageUrl: string;

  @ApiProperty({ description: 'Nécessite une ordonnance' })
  @Prop({ default: false })
  requiresPrescription: boolean;

  @ApiProperty({ description: 'Dosage' })
  @Prop({ default: '' })
  dosage: string;

  @ApiProperty({ description: 'Fabricant' })
  @Prop({ default: '' })
  manufacturer: string;

  @ApiProperty({ description: 'Forme (comprimé, sirop, etc.)' })
  @Prop({ default: '' })
  form: string;

  @ApiProperty({ description: 'Produit actif' })
  @Prop({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Nombre de ventes' })
  @Prop({ default: 0 })
  totalSold: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ category: 1 });
ProductSchema.index({ pharmacistId: 1, isActive: 1 });
