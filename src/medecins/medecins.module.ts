import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MedecinsService } from './medecins.service';
import { MedecinsController } from './medecins.controller';
import { Medecin, MedecinSchema } from './schemas/medecin.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Medecin.name, schema: MedecinSchema }]),
  ],
  controllers: [MedecinsController],
  providers: [MedecinsService],
  exports: [MedecinsService],
})
export class MedecinsModule {}
