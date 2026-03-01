import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ── Marketplace (patients browse) ──────────────────────────────

  @Get('marketplace')
  @Roles(Role.PATIENT, Role.MEDECIN, Role.PHARMACIEN)
  @ApiOperation({ summary: 'Browse all available products' })
  @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false }) @ApiQuery({ name: 'category', required: false })
  marketplace(
    @Query('page') page?: number, @Query('limit') limit?: number,
    @Query('search') search?: string, @Query('category') category?: string,
  ) {
    return this.productsService.findAllActive(page || 1, limit || 20, search, category);
  }

  // ── Pharmacist CRUD ────────────────────────────────────────────

  @Post('pharmacist/:pharmacistId')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Add a new product (pharmacist)' })
  create(@Param('pharmacistId') pharmacistId: string, @Body() dto: CreateProductDto) {
    return this.productsService.create(pharmacistId, dto);
  }

  @Get('pharmacist/:pharmacistId')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Get all my products (pharmacist)' })
  findMyProducts(@Param('pharmacistId') pharmacistId: string) {
    return this.productsService.findByPharmacist(pharmacistId);
  }

  @Get(':id')
  @Roles(Role.PATIENT, Role.MEDECIN, Role.PHARMACIEN)
  @ApiOperation({ summary: 'Get product details' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id/pharmacist/:pharmacistId')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Update a product (pharmacist)' })
  update(
    @Param('id') id: string,
    @Param('pharmacistId') pharmacistId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, pharmacistId, dto);
  }

  @Delete(':id/pharmacist/:pharmacistId')
  @Roles(Role.PHARMACIEN)
  @ApiOperation({ summary: 'Delete a product (pharmacist)' })
  remove(@Param('id') id: string, @Param('pharmacistId') pharmacistId: string) {
    return this.productsService.remove(id, pharmacistId);
  }
}
