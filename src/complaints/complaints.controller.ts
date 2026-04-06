import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';

@ApiTags('Complaints')
@Controller('complaints')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une réclamation (tout utilisateur connecté)' })
  create(@CurrentUser() user: any, @Body() dto: CreateComplaintDto) {
    return this.complaintsService.create(user._id.toString(), user.role, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Lister mes réclamations' })
  findMine(@CurrentUser() user: any) {
    return this.complaintsService.findMine(user._id.toString());
  }
}