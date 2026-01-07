import { IsNumber, IsNotEmpty, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLocationDto {
  @ApiProperty({
    description: 'Latitude',
    example: 12.9716,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: 'Longitude',
    example: 77.5946,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({
    description: 'GPS accuracy in meters',
    example: 10,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  accuracy?: number;

  @ApiProperty({
    description: 'Heading/bearing in degrees',
    example: 180,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiProperty({
    description: 'Speed in km/h',
    example: 25,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  speed?: number;
}
