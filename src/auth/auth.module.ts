import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Connection } from 'mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Patient, PatientSchema } from '../patients/schemas/patient.schema';
import { Medecin, MedecinSchema } from '../medecins/schemas/medecin.schema';
import { Pharmacien, PharmacienSchema } from '../pharmaciens/schemas/pharmacien.schema';
import { Role } from '../common/enums/role.enum';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'diabetes-secret-key',
        signOptions: {
          expiresIn: 604800, // 7 days in seconds
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
    ]),
    SessionsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService, 
    JwtStrategy,
    // Custom providers for discriminator models
    {
      provide: getModelToken(Patient.name),
      useFactory: (userModel) => {
        // Vérifier si le discriminator existe déjà
        if (userModel.discriminators && userModel.discriminators[Role.PATIENT]) {
          return userModel.discriminators[Role.PATIENT];
        }
        return userModel.discriminator(Role.PATIENT, PatientSchema);
      },
      inject: [getModelToken(User.name)],
    },
    {
      provide: getModelToken(Medecin.name),
      useFactory: (userModel) => {
        // Vérifier si le discriminator existe déjà
        if (userModel.discriminators && userModel.discriminators[Role.MEDECIN]) {
          return userModel.discriminators[Role.MEDECIN];
        }
        return userModel.discriminator(Role.MEDECIN, MedecinSchema);
      },
      inject: [getModelToken(User.name)],
    },
    {
      provide: getModelToken(Pharmacien.name),
      useFactory: (userModel) => {
        // Vérifier si le discriminator existe déjà
        if (userModel.discriminators && userModel.discriminators[Role.PHARMACIEN]) {
          return userModel.discriminators[Role.PHARMACIEN];
        }
        return userModel.discriminator(Role.PHARMACIEN, PharmacienSchema);
      },
      inject: [getModelToken(User.name)],
    },
  ],
  exports: [
    AuthService, 
    JwtStrategy, 
    PassportModule, 
    MongooseModule,
    // Export discriminator model tokens so other modules can inject them
    getModelToken(Patient.name),
    getModelToken(Medecin.name),
    getModelToken(Pharmacien.name),
  ],
})
export class AuthModule {}
