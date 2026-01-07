import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DriverService } from './driver.service';
import {
  CreateDriverDto,
  UpdateDriverDto,
  UpdateDriverStatusDto,
  UpdateDriverLocationDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../../common/constants';
import { Driver } from './entities/driver.entity';

@ApiTags('Driver')
@Controller('driver')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.DRIVER)
export class DriverController {
  private readonly logger = new Logger(DriverController.name);

  constructor(private readonly driverService: DriverService) {}

  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create driver profile' })
  @ApiResponse({ status: 201, description: 'Driver profile created successfully' })
  @ApiResponse({ status: 400, description: 'Driver profile already exists or invalid data' })
  async createProfile(
    @CurrentUser('userId') userId: string,
    @Body() createDriverDto: CreateDriverDto,
  ): Promise<Driver> {
    this.logger.log(`Creating driver profile for user: ${userId}`);
    return this.driverService.createDriverProfile(userId, createDriverDto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get driver profile' })
  @ApiResponse({ status: 200, description: 'Driver profile retrieved' })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  async getProfile(@CurrentUser('userId') userId: string): Promise<Driver> {
    this.logger.log(`Getting driver profile for user: ${userId}`);
    return this.driverService.getDriverProfile(userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update driver profile' })
  @ApiResponse({ status: 200, description: 'Driver profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() updateDriverDto: UpdateDriverDto,
  ): Promise<Driver> {
    this.logger.log(`Updating driver profile for user: ${userId}`);
    return this.driverService.updateDriverProfile(userId, updateDriverDto);
  }

  @Patch('status')
  @ApiOperation({ summary: 'Toggle driver online/offline status' })
  @ApiResponse({ status: 200, description: 'Driver status updated successfully' })
  @ApiResponse({ status: 403, description: 'Driver not approved' })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  async updateStatus(
    @CurrentUser('userId') userId: string,
    @Body() updateStatusDto: UpdateDriverStatusDto,
  ): Promise<Driver> {
    this.logger.log(
      `Updating driver status for user: ${userId} to ${updateStatusDto.isOnline ? 'online' : 'offline'}`,
    );
    return this.driverService.updateDriverStatus(userId, updateStatusDto);
  }

  @Patch('location')
  @ApiOperation({ summary: 'Update driver current location' })
  @ApiResponse({ status: 200, description: 'Driver location updated successfully' })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  async updateLocation(
    @CurrentUser('userId') userId: string,
    @Body() locationDto: UpdateDriverLocationDto,
  ): Promise<Driver> {
    this.logger.log(`Updating driver location for user: ${userId}`);
    return this.driverService.updateDriverLocation(userId, locationDto);
  }

  @Get('earnings')
  @ApiOperation({ summary: 'Get driver earnings and statistics' })
  @ApiResponse({ status: 200, description: 'Driver earnings retrieved' })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  async getEarnings(@CurrentUser('userId') userId: string): Promise<{
    totalEarnings: number;
    totalDeliveries: number;
    averagePerDelivery: number;
    rating: number;
    totalRatings: number;
  }> {
    this.logger.log(`Getting driver earnings for user: ${userId}`);
    return this.driverService.getDriverEarnings(userId);
  }
}
