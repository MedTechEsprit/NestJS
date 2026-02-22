import { Module } from '@nestjs/common';
import { PharmaciensService } from './pharmaciens.service';
import { PharmaciensController } from './pharmaciens.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    // Import AuthModule to access Pharmacien discriminator model
    AuthModule,
  ],
  controllers: [PharmaciensController],
  providers: [PharmaciensService],
  exports: [PharmaciensService],
})
export class PharmaciensModule {}
