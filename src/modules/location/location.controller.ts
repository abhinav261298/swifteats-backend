import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LocationService } from './services/location.service';
import { UpdateLocationDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants';

@ApiTags('Location (Driver)')
@Controller('driver/location')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.DRIVER)
export class LocationController {
  private readonly logger = new Logger(LocationController.name);

  constructor(private readonly locationService: LocationService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update driver GPS location' })
  @ApiResponse({ status: 204, description: 'Location updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid location data' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  async updateLocation(
    @CurrentUser('driverId') driverId: string,
    @Body() updateLocationDto: UpdateLocationDto,
  ): Promise<void> {
    this.logger.debug(
      `Driver ${driverId} updating location: (${updateLocationDto.latitude}, ${updateLocationDto.longitude})`,
    );

    await this.locationService.updateDriverLocation(driverId, updateLocationDto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get driver location history' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of records to retrieve (default: 100)',
  })
  @ApiResponse({ status: 200, description: 'Location history retrieved' })
  async getHistory(@CurrentUser('driverId') driverId: string, @Query('limit') limit?: number) {
    this.logger.log(`Getting location history for driver: ${driverId}`);

    return this.locationService.getDriverLocationHistory(
      driverId,
      limit ? parseInt(limit.toString(), 10) : 100,
    );
  }

  @Get('current')
  @ApiOperation({ summary: 'Get driver current location' })
  @ApiResponse({ status: 200, description: 'Current location retrieved' })
  @ApiResponse({ status: 404, description: 'Location not available' })
  async getCurrentLocation(@CurrentUser('driverId') driverId: string) {
    this.logger.log(`Getting current location for driver: ${driverId}`);

    return this.locationService.getDriverCurrentLocation(driverId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get location buffer statistics' })
  @ApiResponse({ status: 200, description: 'Buffer statistics retrieved' })
  async getBufferStats() {
    return this.locationService.getBufferStats();
  }
}
