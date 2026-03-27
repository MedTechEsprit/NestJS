import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GlucoseService } from './glucose.service';
import { GlucoseController } from './glucose.controller';
import { Glucose, GlucoseSchema } from './schemas/glucose.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Glucose.name, schema: GlucoseSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [GlucoseController],
  providers: [GlucoseService],
  exports: [GlucoseService],
})
export class GlucoseModule {}
