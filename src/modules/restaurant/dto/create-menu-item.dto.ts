import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  IsBoolean,
  IsOptional,
  IsInt,
} from 'class-validator';

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Butter Chicken', description: 'Menu item name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    example: 'Tender chicken in rich tomato and butter sauce',
    description: 'Item description',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 350.0, description: 'Price in INR' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 'Main Course', description: 'Category of the item' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  category: string;

  @ApiProperty({ example: true, description: 'Is item available', required: false })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @ApiProperty({ example: true, description: 'Is item vegetarian', required: false })
  @IsBoolean()
  @IsOptional()
  isVegetarian?: boolean;

  @ApiProperty({ example: false, description: 'Is item vegan', required: false })
  @IsBoolean()
  @IsOptional()
  isVegan?: boolean;

  @ApiProperty({
    example: 'https://example.com/butter-chicken.jpg',
    description: 'Item image URL',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  imageUrl?: string;

  @ApiProperty({
    example: 20,
    description: 'Preparation time in minutes',
    required: false,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Min(180)
  preparationTimeMins?: number;
}
