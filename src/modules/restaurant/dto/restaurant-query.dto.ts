import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsBoolean, Min, Max } from 'class-validator';

export class RestaurantQueryDto {
  @ApiProperty({
    example: 19.076,
    description: 'User latitude for distance calculation',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({
    example: 72.8777,
    description: 'User longitude for distance calculation',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({
    example: 5,
    description: 'Search radius in kilometers',
    required: false,
    default: 10,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0.1)
  @Max(50)
  radius?: number;

  @ApiProperty({
    example: 'Indian',
    description: 'Filter by cuisine type',
    required: false,
  })
  @IsString()
  @IsOptional()
  cuisineType?: string;

  @ApiProperty({
    example: true,
    description: 'Filter only open restaurants',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isOpen?: boolean;

  @ApiProperty({
    example: 'pizza',
    description: 'Search by restaurant name',
    required: false,
  })
  @IsString()
  @IsOptional()
  search?: string;
}
