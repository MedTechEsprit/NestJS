import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PharmaciensService } from './pharmaciens.service';
import { PharmaciensController } from './pharmaciens.controller';
import { Pharmacien, PharmacienSchema } from './schemas/pharmacien.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Pharmacien.name, schema: PharmacienSchema }]),
  ],
  controllers: [PharmaciensController],
  providers: [PharmaciensService],
  exports: [PharmaciensService],
})
export class PharmaciensModule {}
