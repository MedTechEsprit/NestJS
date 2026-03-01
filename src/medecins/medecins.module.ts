import { Module } from '@nestjs/common';
import { MedecinsService } from './medecins.service';
import { MedecinsController } from './medecins.controller';
import { AuthModule } from '../auth/auth.module';
import { GlucoseModule } from '../glucose/glucose.module';

@Module({
  imports: [
    // Import AuthModule to access Medecin discriminator model
    AuthModule,
    GlucoseModule,
  ],
  controllers: [MedecinsController],
  providers: [MedecinsService],
  exports: [MedecinsService],
})
export class MedecinsModule {}
