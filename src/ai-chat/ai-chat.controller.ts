import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AiChatService } from './ai-chat.service';
import { AiChatDto } from './dto/ai-chat.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('AI Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-chat')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post()
  @Roles(Role.PATIENT, Role.MEDECIN)
  @ApiOperation({
    summary: 'Chat with MediBot — spécialisé diabète & nutrition',
    description:
      'Envoie un message à MediBot, l\'assistant IA diabète. ' +
      'La réponse est personnalisée grâce aux données réelles du patient ' +
      '(glycémie, repas). Répond uniquement aux questions sur le diabète et la nutrition.',
  })
  @ApiResponse({
    status: 201,
    description: 'Réponse IA retournée avec succès',
    schema: {
      example: {
        response: 'Votre glycémie post-repas de 180 mg/dL est légèrement élevée...',
        context: {
          glucoseStats: { average: 145, min: 80, max: 210, trend: 'stable' },
          nutritionStats: { avgDailyCalories: 1800, avgDailyCarbs: 220 },
          recordsUsed: { glucoseCount: 15, mealsCount: 8 },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Message invalide (trop court ou trop long)' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle non autorisé' })
  @ApiResponse({ status: 503, description: 'Service Ollama indisponible' })
  async chat(
    @CurrentUser('_id') userId: string,
    @Body() dto: AiChatDto,
  ) {
    return this.aiChatService.chat(String(userId), dto.message);
  }
}
