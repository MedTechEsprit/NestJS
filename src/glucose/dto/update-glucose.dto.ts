import { PartialType } from '@nestjs/swagger';
import { CreateGlucoseDto } from './create-glucose.dto';

export class UpdateGlucoseDto extends PartialType(CreateGlucoseDto) {}
