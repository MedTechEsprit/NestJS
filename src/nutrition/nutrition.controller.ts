import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NutritionService } from './nutrition.service';
import { CreateMealDto } from './dto/create-meal.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { CreateFoodItemDto } from './dto/create-food-item.dto';
import { UpdateFoodItemDto } from './dto/update-food-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Nutrition')
@Controller('nutrition')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  // ============ MEAL ENDPOINTS ============

  @Post('meals')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Créer un nouveau repas' })
  @ApiResponse({ status: 201, description: 'Repas créé avec succès' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  createMeal(
    @CurrentUser('_id') patientId: string,
    @Body() createMealDto: CreateMealDto,
  ) {
    return this.nutritionService.createMeal(patientId, createMealDto);
  }

  @Get('meals')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Récupérer tous les repas avec filtres optionnels' })
  @ApiQuery({ name: 'start', required: false, description: 'Date de début (ISO 8601)' })
  @ApiQuery({ name: 'end', required: false, description: 'Date de fin (ISO 8601)' })
  @ApiQuery({ name: 'page', required: false, description: 'Numéro de page' })
  @ApiQuery({ name: 'limit', required: false, description: 'Nombre d\'éléments par page' })
  @ApiResponse({ status: 200, description: 'Liste des repas' })
  findAllMeals(
    @CurrentUser('_id') patientId: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query() paginationDto?: PaginationDto,
  ) {
    const startDate = start ? new Date(start) : undefined;
    const endDate = end ? new Date(end) : undefined;

    // Only use pagination if page or limit is provided
    const usePagination = paginationDto && (paginationDto.page || paginationDto.limit);

    return this.nutritionService.findAllMeals(
      patientId,
      startDate,
      endDate,
      usePagination ? paginationDto : undefined,
    );
  }

  @Get('meals/:id')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Récupérer un repas spécifique' })
  @ApiResponse({ status: 200, description: 'Repas trouvé' })
  @ApiResponse({ status: 404, description: 'Repas non trouvé' })
  findOneMeal(
    @Param('id') id: string,
    @CurrentUser('_id') patientId: string,
  ) {
    return this.nutritionService.findOneMeal(id, patientId);
  }

  @Patch('meals/:id')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Mettre à jour un repas' })
  @ApiResponse({ status: 200, description: 'Repas mis à jour' })
  @ApiResponse({ status: 404, description: 'Repas non trouvé' })
  updateMeal(
    @Param('id') id: string,
    @CurrentUser('_id') patientId: string,
    @Body() updateMealDto: UpdateMealDto,
  ) {
    return this.nutritionService.updateMeal(id, patientId, updateMealDto);
  }

  @Delete('meals/:id')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Supprimer un repas' })
  @ApiResponse({ status: 200, description: 'Repas supprimé' })
  @ApiResponse({ status: 404, description: 'Repas non trouvé' })
  removeMeal(
    @Param('id') id: string,
    @CurrentUser('_id') patientId: string,
  ) {
    return this.nutritionService.removeMeal(id, patientId);
  }

  // ============ FOOD ITEM ENDPOINTS ============

  @Post('meals/:mealId/foods')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Ajouter un aliment à un repas' })
  @ApiResponse({ status: 201, description: 'Aliment ajouté avec succès' })
  @ApiResponse({ status: 404, description: 'Repas non trouvé' })
  addFoodItem(
    @Param('mealId') mealId: string,
    @CurrentUser('_id') patientId: string,
    @Body() createFoodItemDto: CreateFoodItemDto,
  ) {
    return this.nutritionService.addFoodItem(mealId, patientId, createFoodItemDto);
  }

  @Get('meals/:mealId/foods')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Récupérer tous les aliments d\'un repas' })
  @ApiResponse({ status: 200, description: 'Liste des aliments' })
  @ApiResponse({ status: 404, description: 'Repas non trouvé' })
  findFoodItemsByMeal(
    @Param('mealId') mealId: string,
    @CurrentUser('_id') patientId: string,
  ) {
    return this.nutritionService.findFoodItemsByMeal(mealId, patientId);
  }

  @Patch('meals/:mealId/foods/:id')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Mettre à jour un aliment' })
  @ApiResponse({ status: 200, description: 'Aliment mis à jour' })
  @ApiResponse({ status: 404, description: 'Aliment non trouvé' })
  updateFoodItem(
    @Param('id') id: string,
    @Param('mealId') mealId: string,
    @CurrentUser('_id') patientId: string,
    @Body() updateFoodItemDto: UpdateFoodItemDto,
  ) {
    return this.nutritionService.updateFoodItem(id, mealId, patientId, updateFoodItemDto);
  }

  @Delete('meals/:mealId/foods/:id')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Supprimer un aliment' })
  @ApiResponse({ status: 200, description: 'Aliment supprimé' })
  @ApiResponse({ status: 404, description: 'Aliment non trouvé' })
  removeFoodItem(
    @Param('id') id: string,
    @Param('mealId') mealId: string,
    @CurrentUser('_id') patientId: string,
  ) {
    return this.nutritionService.removeFoodItem(id, mealId, patientId);
  }

  // ============ ANALYTICS ENDPOINTS ============

  @Get('stats/daily-carbs')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Somme des glucides par jour' })
  @ApiQuery({ name: 'date', required: true, description: 'Date au format YYYY-MM-DD' })
  @ApiResponse({ status: 200, description: 'Statistiques quotidiennes' })
  getDailyCarbs(
    @CurrentUser('_id') patientId: string,
    @Query('date') date: string,
  ) {
    const targetDate = new Date(date);
    return this.nutritionService.getDailyCarbs(patientId, targetDate);
  }

  @Get('stats/weekly-macros')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Somme des macronutriments des 7 derniers jours' })
  @ApiResponse({ status: 200, description: 'Statistiques hebdomadaires' })
  getWeeklyMacros(@CurrentUser('_id') patientId: string) {
    return this.nutritionService.getWeeklyMacros(patientId);
  }

  @Get('stats/meals/spike')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Corrélation repas-glycémie (1-2h après)' })
  @ApiQuery({ name: 'start', required: false, description: 'Date de début (ISO 8601)' })
  @ApiQuery({ name: 'end', required: false, description: 'Date de fin (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Pics de glycémie post-repas' })
  getMealSpikes(
    @CurrentUser('_id') patientId: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const startDate = start ? new Date(start) : undefined;
    const endDate = end ? new Date(end) : undefined;
    return this.nutritionService.getMealSpikes(patientId, startDate, endDate);
  }

  @Get('stats/targets')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Comparaison avec les objectifs quotidiens' })
  @ApiResponse({ status: 200, description: 'Progression vers les objectifs' })
  getTargets(@CurrentUser('_id') patientId: string) {
    return this.nutritionService.getTargets(patientId);
  }
}
