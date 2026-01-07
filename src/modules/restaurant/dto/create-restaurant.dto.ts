import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEmail,
  IsOptional,
  IsNumber,
  Min,
  Max,
  Matches,
  IsInt,
} from 'class-validator';

export class CreateRestaurantDto {
  @ApiProperty({ example: 'The Great Indian Kitchen', description: 'Restaurant name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    example: 'Authentic Indian cuisine with a modern twist',
    description: 'Restaurant description',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: '+919876543210', description: 'Contact phone number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+91[0-9]{10}$/, { message: 'Phone must be in format +91XXXXXXXXXX' })
  phone: string;

  @ApiProperty({
    example: 'restaurant@example.com',
    description: 'Contact email',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '123 MG Road, Brigade Road', description: 'Full address' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(500)
  address: string;

  @ApiProperty({ example: 'Mumbai', description: 'City name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: 'Maharashtra', description: 'State name', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @ApiProperty({ example: '400001', description: 'Postal code', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  postalCode?: string;

  @ApiProperty({ example: 19.076, description: 'Latitude (-90 to 90)' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 72.8777, description: 'Longitude (-180 to 180)' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({
    example: 'Indian',
    description: 'Type of cuisine',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  cuisineType?: string;

  @ApiProperty({ example: '09:00', description: 'Opening time (HH:MM format)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Opening time must be in HH:MM format',
  })
  openingTime: string;

  @ApiProperty({ example: '22:00', description: 'Closing time (HH:MM format)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Closing time must be in HH:MM format',
  })
  closingTime: string;

  @ApiProperty({
    example: 30,
    description: 'Average preparation time in minutes',
    required: false,
  })
  @IsInt()
  @IsOptional()
  @Min(5)
  @Max(180)
  averagePreparationTimeMins?: number;

  @ApiProperty({
    example: 'https://example.com/restaurant-image.jpg',
    description: 'Restaurant image URL',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  imageUrl?: string;
}
