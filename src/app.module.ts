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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/diabetes'),
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
    BoostsModule,
    ActivitiesModule,
    AppointmentsModule,
    ConversationsModule,
    MessagesModule,
    PatientRequestsModule,
    NotificationsModule,
    CronModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
