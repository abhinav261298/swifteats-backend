import { Controller, Get, Query, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { RestaurantService } from './restaurant.service';
import { RestaurantQueryDto } from './dto';
import { Public } from '../../common/decorators';
import { Restaurant } from './entities/restaurant.entity';
import { MenuItem } from './entities/menu-item.entity';

@ApiTags('Restaurants (Customer)')
@Controller('restaurants')
export class RestaurantController {
  private readonly logger = new Logger(RestaurantController.name);

  constructor(private readonly restaurantService: RestaurantService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse nearby restaurants (Public)' })
  @ApiQuery({ name: 'latitude', required: false, type: Number })
  @ApiQuery({ name: 'longitude', required: false, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'Radius in km' })
  @ApiQuery({ name: 'cuisineType', required: false, type: String })
  @ApiQuery({ name: 'isOpen', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Restaurants retrieved' })
  async findNearbyRestaurants(@Query() queryDto: RestaurantQueryDto) {
    this.logger.log(`Browse restaurants request with filters: ${JSON.stringify(queryDto)}`);
    return this.restaurantService.findNearbyRestaurants(queryDto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get restaurant details (Public)' })
  @ApiResponse({ status: 200, description: 'Restaurant details retrieved', type: Restaurant })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getRestaurantById(@Param('id') id: string): Promise<Restaurant> {
    this.logger.log(`Get restaurant details: ${id}`);
    return this.restaurantService.findRestaurantById(id);
  }

  @Public()
  @Get(':id/menu')
  @ApiOperation({ summary: 'Get restaurant menu (Public)' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Menu retrieved', type: [MenuItem] })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getRestaurantMenu(
    @Param('id') id: string,
    @Query('category') category?: string,
  ): Promise<MenuItem[]> {
    this.logger.log(`Get menu for restaurant: ${id}, category: ${category || 'all'}`);
    return this.restaurantService.getRestaurantMenu(id, category);
  }
}
