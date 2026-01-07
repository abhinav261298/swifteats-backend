import { IsUUID, IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty({ example: 'uuid-of-menu-item' })
  @IsUUID()
  menuItemId: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;

  @ApiPropertyOptional({ example: 'No onions please', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialInstructions?: string;
}
