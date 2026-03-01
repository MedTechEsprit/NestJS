import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AiPatternService } from './ai-pattern.service';
import { PatternQueryDto } from './dto/pattern-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('AI Pattern Analysis')
@Controller('ai-pattern')
export class AiPatternController {
  constructor(private readonly service: AiPatternService) {}

  // POST /api/ai-pattern — manual trigger by patient
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analyser les patterns glycémiques des 30 derniers jours' })
  @ApiResponse({ status: 201, description: 'Analyse créée avec succès' })
  @ApiResponse({ status: 400, description: 'Pas assez de données (min 10 mesures)' })
  @ApiResponse({ status: 503, description: 'Ollama indisponible — fallback utilisé' })
  async analyze(@CurrentUser('_id') patientId: string) {
    return this.service.analyzePatterns(String(patientId), 'manual');
  }

  // GET /api/ai-pattern/latest
  @Get('latest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT, Role.MEDECIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer la dernière analyse de patterns' })
  async getLatest(@CurrentUser('_id') patientId: string) {
    return this.service.getLatestAnalysis(String(patientId));
  }

  // GET /api/ai-pattern/history
  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT, Role.MEDECIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Historique des analyses de patterns' })
  @ApiQuery({ name: 'triggerType', required: false, enum: ['manual', 'cron'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getHistory(
    @CurrentUser('_id') patientId: string,
    @Query() query: PatternQueryDto,
  ) {
    return this.service.getHistory(String(patientId), query);
  }

  // GET /api/ai-pattern/:id
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT, Role.MEDECIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Détail d'une analyse de patterns" })
  async getById(
    @Param('id') id: string,
    @CurrentUser('_id') patientId: string,
  ) {
    return this.service.getById(id, String(patientId));
  }
}
