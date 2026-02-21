import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Meal, MealDocument, MealSource } from './schemas/meal.schema';
import { FoodItem, FoodItemDocument } from './schemas/food-item.schema';
import { CreateMealDto } from './dto/create-meal.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { CreateFoodItemDto } from './dto/create-food-item.dto';
import { UpdateFoodItemDto } from './dto/update-food-item.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { Glucose, GlucoseDocument } from '../glucose/schemas/glucose.schema';

@Injectable()
export class NutritionService {
  constructor(
    @InjectModel(Meal.name) private mealModel: Model<MealDocument>,
    @InjectModel(FoodItem.name) private foodItemModel: Model<FoodItemDocument>,
    @InjectModel(Glucose.name) private glucoseModel: Model<GlucoseDocument>,
  ) {}

  // ============ MEAL CRUD OPERATIONS ============

  async createMeal(patientId: string, createMealDto: CreateMealDto): Promise<Meal> {
    const newMeal = new this.mealModel({
      ...createMealDto,
      patientId: new Types.ObjectId(patientId),
      source: createMealDto.source || MealSource.MANUAL,
    });

    return await newMeal.save();
  }

  async findAllMeals(
    patientId: string,
    startDate?: Date,
    endDate?: Date,
    paginationDto?: PaginationDto,
  ): Promise<PaginatedResult<Meal> | Meal[]> {
    const filter: any = { patientId: new Types.ObjectId(patientId) };

    if (startDate && endDate) {
      filter.eatenAt = { $gte: startDate, $lte: endDate };
    }

    if (paginationDto) {
      const { page = 1, limit = 10 } = paginationDto;
      const skip = (page - 1) * limit;

      const [meals, total] = await Promise.all([
        this.mealModel
          .find(filter)
          .sort({ eatenAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.mealModel.countDocuments(filter).exec(),
      ]);

      return {
        data: meals,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    return await this.mealModel.find(filter).sort({ eatenAt: -1 }).exec();
  }

  async findOneMeal(id: string, patientId: string): Promise<Meal> {
    const meal = await this.mealModel
      .findOne({
        _id: id,
        patientId: new Types.ObjectId(patientId),
      })
      .exec();

    if (!meal) {
      throw new NotFoundException('Repas non trouvé');
    }

    return meal;
  }

  async updateMeal(
    id: string,
    patientId: string,
    updateMealDto: UpdateMealDto,
  ): Promise<Meal> {
    const meal = await this.mealModel
      .findOneAndUpdate(
        {
          _id: id,
          patientId: new Types.ObjectId(patientId),
        },
        { $set: updateMealDto },
        { new: true },
      )
      .exec();

    if (!meal) {
      throw new NotFoundException('Repas non trouvé');
    }

    return meal;
  }

  async removeMeal(id: string, patientId: string): Promise<{ message: string }> {
    const result = await this.mealModel
      .deleteOne({
        _id: id,
        patientId: new Types.ObjectId(patientId),
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Repas non trouvé');
    }

    // Delete associated food items
    await this.foodItemModel
      .deleteMany({
        mealId: new Types.ObjectId(id),
        patientId: new Types.ObjectId(patientId),
      })
      .exec();

    return { message: 'Repas supprimé avec succès' };
  }

  // ============ FOOD ITEM CRUD OPERATIONS ============

  async addFoodItem(
    mealId: string,
    patientId: string,
    createFoodItemDto: CreateFoodItemDto,
  ): Promise<FoodItem> {
    // Verify meal exists and belongs to patient
    await this.findOneMeal(mealId, patientId);

    const newFoodItem = new this.foodItemModel({
      ...createFoodItemDto,
      mealId: new Types.ObjectId(mealId),
      patientId: new Types.ObjectId(patientId),
    });

    return await newFoodItem.save();
  }

  async findFoodItemsByMeal(mealId: string, patientId: string): Promise<FoodItem[]> {
    // Verify meal exists and belongs to patient
    await this.findOneMeal(mealId, patientId);

    return await this.foodItemModel
      .find({
        mealId: new Types.ObjectId(mealId),
        patientId: new Types.ObjectId(patientId),
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateFoodItem(
    id: string,
    mealId: string,
    patientId: string,
    updateFoodItemDto: UpdateFoodItemDto,
  ): Promise<FoodItem> {
    const foodItem = await this.foodItemModel
      .findOneAndUpdate(
        {
          _id: id,
          mealId: new Types.ObjectId(mealId),
          patientId: new Types.ObjectId(patientId),
        },
        { $set: updateFoodItemDto },
        { new: true },
      )
      .exec();

    if (!foodItem) {
      throw new NotFoundException('Aliment non trouvé');
    }

    return foodItem;
  }

  async removeFoodItem(id: string, mealId: string, patientId: string): Promise<{ message: string }> {
    const result = await this.foodItemModel
      .deleteOne({
        _id: id,
        mealId: new Types.ObjectId(mealId),
        patientId: new Types.ObjectId(patientId),
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Aliment non trouvé');
    }

    return { message: 'Aliment supprimé avec succès' };
  }

  // ============ ANALYTICS ============

  async getDailyCarbs(patientId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const stats = await this.mealModel
      .aggregate([
        {
          $match: {
            patientId: new Types.ObjectId(patientId),
            eatenAt: { $gte: startOfDay, $lte: endOfDay },
          },
        },
        {
          $group: {
            _id: null,
            totalCarbs: { $sum: '$carbs' },
            totalProtein: { $sum: '$protein' },
            totalFat: { $sum: '$fat' },
            totalCalories: { $sum: '$calories' },
            mealCount: { $sum: 1 },
          },
        },
      ])
      .exec();

    if (!stats || stats.length === 0) {
      return {
        date: date.toISOString().split('T')[0],
        totalCarbs: 0,
        totalProtein: 0,
        totalFat: 0,
        totalCalories: 0,
        mealCount: 0,
      };
    }

    return {
      date: date.toISOString().split('T')[0],
      totalCarbs: Math.round(stats[0].totalCarbs * 10) / 10,
      totalProtein: Math.round((stats[0].totalProtein || 0) * 10) / 10,
      totalFat: Math.round((stats[0].totalFat || 0) * 10) / 10,
      totalCalories: Math.round((stats[0].totalCalories || 0) * 10) / 10,
      mealCount: stats[0].mealCount,
    };
  }

  async getWeeklyMacros(patientId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const stats = await this.mealModel
      .aggregate([
        {
          $match: {
            patientId: new Types.ObjectId(patientId),
            eatenAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            totalCarbs: { $sum: '$carbs' },
            totalProtein: { $sum: '$protein' },
            totalFat: { $sum: '$fat' },
            totalCalories: { $sum: '$calories' },
            mealCount: { $sum: 1 },
          },
        },
      ])
      .exec();

    if (!stats || stats.length === 0) {
      return {
        totalCarbs: 0,
        totalProtein: 0,
        totalFat: 0,
        totalCalories: 0,
        mealCount: 0,
        averageCarbsPerDay: 0,
      };
    }

    const totalCarbs = stats[0].totalCarbs;
    const totalProtein = stats[0].totalProtein || 0;
    const totalFat = stats[0].totalFat || 0;
    const totalCalories = stats[0].totalCalories || 0;

    return {
      totalCarbs: Math.round(totalCarbs * 10) / 10,
      totalProtein: Math.round(totalProtein * 10) / 10,
      totalFat: Math.round(totalFat * 10) / 10,
      totalCalories: Math.round(totalCalories * 10) / 10,
      mealCount: stats[0].mealCount,
      averageCarbsPerDay: Math.round((totalCarbs / 7) * 10) / 10,
    };
  }

  async getMealSpikes(patientId: string, startDate?: Date, endDate?: Date) {
    const filter: any = { patientId: new Types.ObjectId(patientId) };

    if (startDate && endDate) {
      filter.eatenAt = { $gte: startDate, $lte: endDate };
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filter.eatenAt = { $gte: thirtyDaysAgo };
    }

    const meals = await this.mealModel.find(filter).sort({ eatenAt: -1 }).exec();

    const mealSpikes = await Promise.all(
      meals.map(async (meal) => {
        // Find glucose readings 1-2 hours after meal
        const oneHourAfter = new Date(meal.eatenAt);
        oneHourAfter.setHours(oneHourAfter.getHours() + 1);

        const twoHoursAfter = new Date(meal.eatenAt);
        twoHoursAfter.setHours(twoHoursAfter.getHours() + 2);

        const glucoseReadings = await this.glucoseModel
          .find({
            patientId: new Types.ObjectId(patientId),
            measuredAt: { $gte: oneHourAfter, $lte: twoHoursAfter },
          })
          .sort({ measuredAt: 1 })
          .exec();

        let postMealGlucose: number | null = null;
        let spike: number | null = null;

        if (glucoseReadings.length > 0) {
          // Take the first reading in the 1-2 hour window
          const glucoseValue = glucoseReadings[0].value;
          postMealGlucose = glucoseValue;

          // Try to find a reading before the meal to calculate spike
          const beforeMeal = new Date(meal.eatenAt);
          beforeMeal.setMinutes(beforeMeal.getMinutes() - 30);

          const preMealReadings = await this.glucoseModel
            .find({
              patientId: new Types.ObjectId(patientId),
              measuredAt: { $gte: beforeMeal, $lte: meal.eatenAt },
            })
            .sort({ measuredAt: -1 })
            .limit(1)
            .exec();

          if (preMealReadings.length > 0) {
            const spikeValue = glucoseValue - preMealReadings[0].value;
            spike = spikeValue;
          }
        }

        return {
          mealId: meal._id,
          mealName: meal.name,
          eatenAt: meal.eatenAt,
          carbs: meal.carbs,
          postMealGlucose,
          spike: spike !== null ? Math.round(spike * 10) / 10 : null,
        };
      }),
    );

    return mealSpikes;
  }

  async getTargets(patientId: string) {
    // Get today's totals
    const today = new Date();
    const dailyStats = await this.getDailyCarbs(patientId, today);

    // Default targets (can be customized per patient in the future)
    const defaultCarbsTarget = 200; // grams per day
    const defaultCaloriesTarget = 2000; // calories per day

    const carbsExceeded = dailyStats.totalCarbs > defaultCarbsTarget;
    const caloriesExceeded = dailyStats.totalCalories > defaultCaloriesTarget;

    return {
      date: dailyStats.date,
      dailyCarbs: dailyStats.totalCarbs,
      dailyCalories: dailyStats.totalCalories,
      carbsTarget: defaultCarbsTarget,
      caloriesTarget: defaultCaloriesTarget,
      carbsExceeded,
      caloriesExceeded,
      carbsRemaining: Math.max(0, defaultCarbsTarget - dailyStats.totalCarbs),
      caloriesRemaining: Math.max(0, defaultCaloriesTarget - dailyStats.totalCalories),
      warnings: [
        ...(carbsExceeded ? ['Objectif de glucides dépassé'] : []),
        ...(caloriesExceeded ? ['Objectif de calories dépassé'] : []),
      ],
    };
  }
}
