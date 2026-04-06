import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AiFoodAnalyzerService } from './ai-food-analyzer.service';
import { AnalyzeFoodDto } from './dto/analyze-food.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { PremiumGuard } from '../subscriptions/guards/premium.guard';

@ApiTags('AI Food Analyzer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PremiumGuard)
@Controller('ai-food-analyzer')
export class AiFoodAnalyzerController {
  constructor(private readonly aiFoodAnalyzerService: AiFoodAnalyzerService) {}

  // ── GET /ai-food-analyzer/history ──────────────────────────────────────

  @Get('history')
  @Roles(Role.PATIENT)
  @ApiOperation({
    summary: 'Get my AI food analysis history (patient)',
    description: 'Returns a paginated list of all AI food analyses for the connected patient, sorted by most recent first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated AI analysis history',
    schema: {
      example: {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getHistory(
    @CurrentUser('_id') patientId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.aiFoodAnalyzerService.findHistory(
      patientId,
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  // ── GET /ai-food-analyzer/meal/:mealId ───────────────────────────────────

  @Get('meal/:mealId')
  @Roles(Role.PATIENT, Role.MEDECIN)
  @ApiOperation({
    summary: 'Get AI analysis linked to a specific meal',
    description: 'Returns the full AiFoodAnalysis document for the given meal ID. Only analyses created by the AI Food Analyzer endpoint are available.',
  })
  @ApiResponse({
    status: 200,
    description: 'AI analysis document',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No AI analysis found for this meal' })
  async findByMeal(@Param('mealId') mealId: string) {
    return this.aiFoodAnalyzerService.findByMeal(mealId);
  }

  // ── POST /ai-food-analyzer ───────────────────────────────────────────────

  @Post()
  @Roles(Role.PATIENT)
  @ApiOperation({
    summary: 'Analyze a food image and save it as a meal',
    description:
      'Sends the image URL to the FastAPI image analyzer, saves the result as a ' +
      'Meal (source=ai) in MongoDB, then returns the nutritional data and ' +
      'personalized AI advice based on the patient\'s glucose history. ' +
      'Use POST /nutrition/meals to enter meal data manually instead.',
  })
  @ApiResponse({
    status: 201,
    description: 'Food analyzed and meal saved successfully',
    schema: {
      example: {
        meal: {
          id: '664a1f...',
          name: 'Banana',
          eatenAt: '2026-02-22T10:30:00.000Z',
          calories: 89,
          carbs: 23,
          protein: 1.1,
          fat: 0.3,
          note: '[AI] High sugar content — consume in moderation.',
          source: 'ai',
          confidence: 90,
        },
        image_analysis: {
          food_name: 'Banana',
          calories: 89,
          carbs: 23,
          protein: 1.1,
          fat: 0.3,
          health_note: 'High sugar content — consume in moderation.',
        },
        ai_advice:
          'Given your recent high glucose readings, limit banana intake ...',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 503, description: 'Image analyzer service unavailable' })
  async analyze(
    @CurrentUser() user: UserDocument,
    @Body() body: AnalyzeFoodDto,
  ) {
    return this.aiFoodAnalyzerService.analyzeAndSave(
      String(user._id),
      body.image_url,
      body.user_message,
    );
  }
}
