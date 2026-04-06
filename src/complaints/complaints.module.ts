import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComplaintsService } from './complaints.service';
import { ComplaintsController } from './complaints.controller';
import { Complaint, ComplaintSchema } from './schemas/complaint.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Complaint.name, schema: ComplaintSchema }]),
    AuthModule,
  ],
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
  exports: [ComplaintsService, MongooseModule],
})
export class ComplaintsModule {}