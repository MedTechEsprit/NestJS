import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { MedecinsModule } from './medecins/medecins.module';
import { PharmaciensModule } from './pharmaciens/pharmaciens.module';
import { SessionsModule } from './sessions/sessions.module';
import { GlucoseModule } from './glucose/glucose.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { MedicationRequestsModule } from './medication-requests/medication-requests.module';
import { ReviewsModule } from './reviews/reviews.module';
import { BoostsModule } from './boosts/boosts.module';
import { ActivitiesModule } from './activities/activities.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { PatientRequestsModule } from './patient-requests/patient-requests.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CronModule } from './cron/cron.module';
import { ScheduleModule } from '@nestjs/schedule/dist/schedule.module';
import { RatingsModule } from './ratings/ratings.module';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { AiFoodAnalyzerModule } from './ai-food-analyzer/ai-food-analyzer.module';
import { AiPredictionModule } from './ai-prediction/ai-prediction.module';
import { AiDoctorModule } from './ai-doctor/ai-doctor.module';
import { AiPatternModule } from './ai-pattern/ai-pattern.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI as string),
    ScheduleModule.forRoot(),

    AuthModule,
    UsersModule,
    PatientsModule,
    MedecinsModule,
    PharmaciensModule,
    SessionsModule,
    GlucoseModule,
    NutritionModule,
    MedicationRequestsModule,
    ReviewsModule,
    RatingsModule,
    BoostsModule,
    ActivitiesModule,
    AppointmentsModule,
    ConversationsModule,
    MessagesModule,
    PatientRequestsModule,
    NotificationsModule,
    CronModule,
    AiChatModule,
    AiFoodAnalyzerModule,
    AiPredictionModule,
    AiDoctorModule,
    AiPatternModule,
    ProductsModule,
    OrdersModule,
    SubscriptionsModule,
    ComplaintsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
