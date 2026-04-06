import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminJwtGuard } from './guards/admin-jwt.guard';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('auth/login')
  @ApiOperation({ summary: 'Connexion admin statique (admin/admin)' })
  login(@Body() dto: AdminLoginDto) {
    const result = this.adminService.login(dto.username, dto.password);
    if (!result) {
      throw new UnauthorizedException('Identifiants admin invalides');
    }
    return result;
  }

  @Get('dashboard/stats')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Statistiques globales du dashboard admin' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les utilisateurs (admin)' })
  listUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: string,
  ) {
    return this.adminService.listUsers(page || 1, limit || 20, role);
  }

  @Patch('users/:id/status')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour le statut compte utilisateur' })
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: { statutCompte: 'ACTIF' | 'INACTIF' | 'SUSPENDU' },
  ) {
    if (!body?.statutCompte) {
      throw new BadRequestException('statutCompte est requis');
    }
    return this.adminService.updateUserStatus(id, body.statutCompte);
  }

  @Get('products')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les produits (admin)' })
  listProducts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.listProducts(page || 1, limit || 20, search);
  }

  @Get('orders')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les commandes (admin)' })
  listOrders(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.listOrders(page || 1, limit || 20, status);
  }

  @Patch('orders/:id/status')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour le statut d\'une commande (admin)' })
  updateOrderStatus(@Param('id') id: string, @Body() body: { status: string }) {
    if (!body?.status) {
      throw new BadRequestException('status est requis');
    }
    return this.adminService.updateOrderStatus(id, body.status);
  }

  @Patch('products/:id/status')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activer / désactiver un produit' })
  updateProductStatus(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    if (typeof body?.isActive !== 'boolean') {
      throw new BadRequestException('isActive doit être un booléen');
    }
    return this.adminService.updateProductStatus(id, body.isActive);
  }

  @Get('subscriptions')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les abonnements patients (admin)' })
  listSubscriptions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.listSubscriptions(page || 1, limit || 20, status);
  }

  @Get('boosts')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les boosts médecins (admin)' })
  listBoosts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.listMedecinBoosts(page || 1, limit || 20, status);
  }

  @Get('complaints')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les réclamations (admin)' })
  listComplaints(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.listComplaints(page || 1, limit || 20, status);
  }

  @Get('complaints/:id')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulter le détail complet d\'une réclamation' })
  getComplaintById(@Param('id') id: string) {
    return this.adminService.getComplaintById(id);
  }

  @Patch('complaints/:id/status')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour statut réclamation (admin)' })
  updateComplaintStatus(
    @Param('id') id: string,
    @Body() body: { status: 'open' | 'in_progress' | 'resolved' | 'rejected'; adminNote?: string },
  ) {
    if (!body?.status) {
      throw new BadRequestException('status est requis');
    }
    return this.adminService.updateComplaintStatus(id, body.status, body.adminNote);
  }
}