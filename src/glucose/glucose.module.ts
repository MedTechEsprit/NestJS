import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GlucoseService } from './glucose.service';
import { GlucoseController } from './glucose.controller';
import { Glucose, GlucoseSchema } from './schemas/glucose.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Glucose.name, schema: GlucoseSchema }]),
  ],
  controllers: [GlucoseController],
  providers: [GlucoseService],
  exports: [GlucoseService],
})
export class GlucoseModule {}
