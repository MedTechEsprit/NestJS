import { Controller, Post, Body, UseGuards } from '@nestjs/common';
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

@ApiTags('AI Food Analyzer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-food-analyzer')
export class AiFoodAnalyzerController {
  constructor(private readonly aiFoodAnalyzerService: AiFoodAnalyzerService) {}

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
