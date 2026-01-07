import { IsEnum, IsString, IsOptional, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeliveryStatus } from '../../../common/constants';

export class UpdateDeliveryStatusDto {
  @ApiProperty({
    description: 'Delivery status',
    enum: DeliveryStatus,
    example: DeliveryStatus.ACCEPTED,
  })
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;

  @ApiProperty({
    description: 'Failure reason (required if status is FAILED)',
    example: 'Customer not available',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(5, 500)
  failureReason?: string;
}
