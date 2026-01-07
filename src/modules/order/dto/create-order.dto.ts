import {
  IsUUID,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsOptional,
  IsString,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderItemDto } from './order-item.dto';
import { PaymentMethod } from '../../../common/constants';

export class CreateOrderDto {
  @ApiProperty({ example: 'uuid-of-restaurant' })
  @IsUUID()
  restaurantId: string;

  @ApiProperty({ example: 'uuid-of-delivery-address' })
  @IsUUID()
  deliveryAddressId: string;

  @ApiProperty({
    type: [OrderItemDto],
    example: [{ menuItemId: 'uuid', quantity: 2, specialInstructions: 'Extra spicy' }],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CARD })
  @IsEnum(PaymentMethod, { message: 'Invalid payment method' })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'Please ring the doorbell', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialInstructions?: string;

  @ApiPropertyOptional({ example: 'WELCOME10', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  promoCode?: string;
}
