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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/diabetes'),
    AuthModule,
    UsersModule,
    PatientsModule,
    MedecinsModule,
    PharmaciensModule,
    SessionsModule,
    GlucoseModule,
    NutritionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
