import { IsString, IsEnum, IsOptional, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleType } from '../../../common/constants';

export class UpdateDriverDto {
  @ApiProperty({
    description: 'Driver license number',
    example: 'DL-1234567890123',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(10, 50)
  licenseNumber?: string;

  @ApiProperty({
    description: 'Vehicle type',
    enum: VehicleType,
    example: VehicleType.BIKE,
    required: false,
  })
  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;

  @ApiProperty({
    description: 'Vehicle registration number',
    example: 'KA-01-AB-1234',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(5, 50)
  @Matches(/^[A-Z]{2}-\d{2}-[A-Z]{1,2}-\d{4}$/, {
    message: 'Vehicle number must be in format: XX-00-XX-0000',
  })
  vehicleNumber?: string;

  @ApiProperty({
    description: 'Vehicle model name',
    example: 'Honda Activa 6G',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(2, 100)
  vehicleModel?: string;
}
