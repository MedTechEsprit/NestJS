import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NutritionService } from './nutrition.service';
import { NutritionController } from './nutrition.controller';
import { Meal, MealSchema } from './schemas/meal.schema';
import { FoodItem, FoodItemSchema } from './schemas/food-item.schema';
import { Glucose, GlucoseSchema } from '../glucose/schemas/glucose.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meal.name, schema: MealSchema },
      { name: FoodItem.name, schema: FoodItemSchema },
      { name: Glucose.name, schema: GlucoseSchema },
    ]),
  ],
  controllers: [NutritionController],
  providers: [NutritionService],
  exports: [NutritionService],
})
export class NutritionModule {}
