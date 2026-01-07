import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateRestaurantStatusDto {
  @ApiProperty({ example: true, description: 'Open/Close restaurant' })
  @IsBoolean()
  isOpen: boolean;
}
