import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { MedecinsModule } from './medecins/medecins.module';
import { PharmaciensModule } from './pharmaciens/pharmaciens.module';
import { SessionsModule } from './sessions/sessions.module';
import { MedicationRequestsModule } from './medication-requests/medication-requests.module';
import { ReviewsModule } from './reviews/reviews.module';
import { BoostsModule } from './boosts/boosts.module';
import { ActivitiesModule } from './activities/activities.module';
import { CronModule } from './cron/cron.module';

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
    MedicationRequestsModule,
    ReviewsModule,
    BoostsModule,
    ActivitiesModule,
    CronModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
