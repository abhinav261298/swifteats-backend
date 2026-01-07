import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiProperty({ example: 'Home' })
  @IsString()
  @MinLength(1, { message: 'Label must not be empty' })
  @MaxLength(50, { message: 'Label must not exceed 50 characters' })
  label: string;

  @ApiProperty({ example: '123 Main Street, Apartment 4B' })
  @IsString()
  @MinLength(5, { message: 'Street address must be at least 5 characters' })
  @MaxLength(200, { message: 'Street address must not exceed 200 characters' })
  street: string;

  @ApiProperty({ example: 'Mumbai' })
  @IsString()
  @MinLength(2, { message: 'City must be at least 2 characters' })
  @MaxLength(100, { message: 'City must not exceed 100 characters' })
  city: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  @MinLength(2, { message: 'State must be at least 2 characters' })
  @MaxLength(100, { message: 'State must not exceed 100 characters' })
  state: string;

  @ApiProperty({ example: '400001' })
  @IsString()
  @MinLength(5, { message: 'Postal code must be at least 5 characters' })
  @MaxLength(10, { message: 'Postal code must not exceed 10 characters' })
  postalCode: string;

  @ApiProperty({ example: 19.076, description: 'Latitude coordinate (-90 to 90)' })
  @IsNumber({}, { message: 'Latitude must be a number' })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  latitude: number;

  @ApiProperty({ example: 72.8777, description: 'Longitude coordinate (-180 to 180)' })
  @IsNumber({}, { message: 'Longitude must be a number' })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  longitude: number;

  @ApiPropertyOptional({ example: 'Apartment 4B, near the park', default: null })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Delivery instructions must not exceed 500 characters' })
  deliveryInstructions?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
