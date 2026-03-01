import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async create(pharmacistId: string, dto: CreateProductDto): Promise<Product> {
    const product = new this.productModel({
      ...dto,
      pharmacistId: new Types.ObjectId(pharmacistId),
    });
    return product.save();
  }

  async findByPharmacist(pharmacistId: string): Promise<Product[]> {
    return this.productModel
      .find({ pharmacistId: new Types.ObjectId(pharmacistId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAllActive(page = 1, limit = 20, search?: string, category?: string): Promise<{ data: Product[]; total: number }> {
    const filter: any = { isActive: true, stock: { $gt: 0 } };
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.productModel.find(filter)
        .populate('pharmacistId', 'nom prenom nomPharmacie adressePharmacie telephonePharmacie')
        .skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);
    return { data, total };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productModel.findById(id)
      .populate('pharmacistId', 'nom prenom nomPharmacie adressePharmacie telephonePharmacie');
    if (!product) throw new NotFoundException('Produit non trouvé');
    return product;
  }

  async update(id: string, pharmacistId: string, dto: UpdateProductDto): Promise<Product | null> {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Produit non trouvé');
    if (product.pharmacistId.toString() !== pharmacistId) {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres produits');
    }
    return this.productModel.findByIdAndUpdate(id, dto, { new: true }).exec();
  }

  async remove(id: string, pharmacistId: string): Promise<{ message: string }> {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Produit non trouvé');
    if (product.pharmacistId.toString() !== pharmacistId) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres produits');
    }
    await this.productModel.findByIdAndDelete(id);
    return { message: 'Produit supprimé avec succès' };
  }

  async decrementStock(productId: string, quantity: number): Promise<void> {
    await this.productModel.findByIdAndUpdate(productId, {
      $inc: { stock: -quantity, totalSold: quantity },
    });
  }
}
