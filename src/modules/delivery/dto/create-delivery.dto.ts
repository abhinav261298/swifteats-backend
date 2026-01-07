import { IsUUID, IsNumber, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDeliveryDto {
  @ApiProperty({
    description: 'Order ID',
    example: 'order-uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'Driver ID',
    example: 'driver-uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  driverId: string;

  @ApiProperty({
    description: 'Pickup latitude (restaurant)',
    example: 12.9716,
  })
  @IsNumber()
  @IsNotEmpty()
  pickupLatitude: number;

  @ApiProperty({
    description: 'Pickup longitude (restaurant)',
    example: 77.5946,
  })
  @IsNumber()
  @IsNotEmpty()
  pickupLongitude: number;

  @ApiProperty({
    description: 'Delivery latitude (customer)',
    example: 12.9816,
  })
  @IsNumber()
  @IsNotEmpty()
  deliveryLatitude: number;

  @ApiProperty({
    description: 'Delivery longitude (customer)',
    example: 77.6046,
  })
  @IsNumber()
  @IsNotEmpty()
  deliveryLongitude: number;

  @ApiProperty({
    description: 'Driver earnings for this delivery',
    example: 50,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  driverEarnings: number;
}
