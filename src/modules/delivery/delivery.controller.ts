import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { DeliveryService } from './services/delivery.service';
import { Delivery } from './entities/delivery.entity';
import { JwtAuthGuard } from '../auth/guards';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants';

@ApiTags('Delivery (Driver)')
@Controller('driver/deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.DRIVER)
export class DeliveryController {
  private readonly logger = new Logger(DeliveryController.name);

  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('active')
  @ApiOperation({ summary: "Get driver's active delivery" })
  @ApiResponse({ status: 200, description: 'Active delivery retrieved' })
  @ApiResponse({ status: 404, description: 'No active delivery found' })
  async getActiveDelivery(@CurrentUser('driverId') driverId: string): Promise<Delivery | null> {
    this.logger.log(`Getting active delivery for driver: ${driverId}`);
    return this.deliveryService.getActiveDeliveryForDriver(driverId);
  }

  @Get()
  @ApiOperation({ summary: "Get driver's delivery history" })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of deliveries to retrieve (default: 20)',
  })
  @ApiResponse({ status: 200, description: 'Delivery history retrieved' })
  async getDeliveryHistory(
    @CurrentUser('driverId') driverId: string,
    @Query('limit') limit?: number,
  ): Promise<Delivery[]> {
    this.logger.log(`Getting delivery history for driver: ${driverId}`);
    return this.deliveryService.getDeliveryHistoryForDriver(
      driverId,
      limit ? parseInt(limit.toString(), 10) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get delivery details by ID' })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  @ApiResponse({ status: 200, description: 'Delivery details retrieved' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  async getDeliveryById(@Param('id') id: string): Promise<Delivery> {
    this.logger.log(`Getting delivery: ${id}`);
    return this.deliveryService.getDeliveryById(id);
  }

  @Patch(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept delivery assignment' })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  @ApiResponse({ status: 200, description: 'Delivery accepted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status or already accepted' })
  @ApiResponse({ status: 403, description: 'Delivery not assigned to this driver' })
  async acceptDelivery(
    @Param('id') id: string,
    @CurrentUser('driverId') driverId: string,
  ): Promise<Delivery> {
    this.logger.log(`Driver ${driverId} accepting delivery: ${id}`);
    return this.deliveryService.acceptDelivery(id, driverId);
  }

  @Patch(':id/arrived-restaurant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark arrived at restaurant' })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  @ApiResponse({ status: 200, description: 'Arrival at restaurant marked' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 403, description: 'Delivery not assigned to this driver' })
  async arrivedAtRestaurant(
    @Param('id') id: string,
    @CurrentUser('driverId') driverId: string,
  ): Promise<Delivery> {
    this.logger.log(`Driver ${driverId} arrived at restaurant for delivery: ${id}`);
    return this.deliveryService.arrivedAtRestaurant(id, driverId);
  }

  @Patch(':id/picked-up')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark order picked up from restaurant' })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  @ApiResponse({ status: 200, description: 'Order picked up marked' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 403, description: 'Delivery not assigned to this driver' })
  async pickedUp(
    @Param('id') id: string,
    @CurrentUser('driverId') driverId: string,
  ): Promise<Delivery> {
    this.logger.log(`Driver ${driverId} picked up delivery: ${id}`);
    return this.deliveryService.pickedUp(id, driverId);
  }

  @Patch(':id/arrived-customer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark arrived at customer location' })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  @ApiResponse({ status: 200, description: 'Arrival at customer marked' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 403, description: 'Delivery not assigned to this driver' })
  async arrivedAtCustomer(
    @Param('id') id: string,
    @CurrentUser('driverId') driverId: string,
  ): Promise<Delivery> {
    this.logger.log(`Driver ${driverId} arrived at customer for delivery: ${id}`);
    return this.deliveryService.arrivedAtCustomer(id, driverId);
  }

  @Patch(':id/delivered')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark delivery as completed' })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  @ApiResponse({ status: 200, description: 'Delivery marked as completed' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 403, description: 'Delivery not assigned to this driver' })
  async delivered(
    @Param('id') id: string,
    @CurrentUser('driverId') driverId: string,
  ): Promise<Delivery> {
    this.logger.log(`Driver ${driverId} completed delivery: ${id}`);
    return this.deliveryService.delivered(id, driverId);
  }
}
