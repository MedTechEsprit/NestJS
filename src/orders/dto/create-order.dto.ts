import { IsString, IsArray, IsOptional, IsNumber, IsMongoId, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty() @IsMongoId() productId: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
}

export class CreateOrderDto {
  @ApiProperty() @IsMongoId() pharmacistId: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ required: false }) @IsString() @IsOptional() patientNote?: string;
}
