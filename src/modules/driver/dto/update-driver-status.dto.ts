import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDriverStatusDto {
  @ApiProperty({
    description: 'Driver online status',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  isOnline: boolean;
}
