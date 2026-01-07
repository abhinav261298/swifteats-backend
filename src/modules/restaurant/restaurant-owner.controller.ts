import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RestaurantService } from './restaurant.service';
import { MenuService } from './menu.service';
import {
  CreateRestaurantDto,
  UpdateRestaurantDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  UpdateRestaurantStatusDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Restaurant } from './entities/restaurant.entity';
import { MenuItem } from './entities/menu-item.entity';

@ApiTags('Restaurant Management (Owner)')
@Controller('restaurant')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class RestaurantOwnerController {
  private readonly logger = new Logger(RestaurantOwnerController.name);

  constructor(
    private readonly restaurantService: RestaurantService,
    private readonly menuService: MenuService,
  ) {}

  // ==================== Restaurant Profile ====================

  @Get('profile')
  @ApiOperation({ summary: 'Get own restaurant profile' })
  @ApiResponse({ status: 200, description: 'Restaurant profile retrieved', type: Restaurant })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser('userId') ownerId: string): Promise<Restaurant> {
    this.logger.log(`Get restaurant profile for owner: ${ownerId}`);
    return this.restaurantService.getOwnerRestaurant(ownerId);
  }

  @Post('profile')
  @ApiOperation({ summary: 'Create restaurant profile (first-time setup)' })
  @ApiResponse({ status: 201, description: 'Restaurant created', type: Restaurant })
  @ApiResponse({ status: 409, description: 'Restaurant already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createProfile(
    @CurrentUser('userId') ownerId: string,
    @Body() createRestaurantDto: CreateRestaurantDto,
  ): Promise<Restaurant> {
    this.logger.log(`Create restaurant for owner: ${ownerId}`);
    return this.restaurantService.createRestaurant(ownerId, createRestaurantDto);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update restaurant profile' })
  @ApiResponse({ status: 200, description: 'Restaurant updated', type: Restaurant })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @CurrentUser('userId') ownerId: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
  ): Promise<Restaurant> {
    this.logger.log(`Update restaurant for owner: ${ownerId}`);
    return this.restaurantService.updateRestaurant(ownerId, updateRestaurantDto);
  }

  @Patch('status')
  @ApiOperation({ summary: 'Toggle restaurant open/closed status' })
  @ApiResponse({ status: 200, description: 'Status updated', type: Restaurant })
  @ApiResponse({ status: 403, description: 'Restaurant not approved or not active' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateStatus(
    @CurrentUser('userId') ownerId: string,
    @Body() updateStatusDto: UpdateRestaurantStatusDto,
  ): Promise<Restaurant> {
    this.logger.log(`Update restaurant status for owner: ${ownerId}`);
    return this.restaurantService.updateRestaurantStatus(ownerId, updateStatusDto);
  }

  // ==================== Menu Management ====================

  @Get('menu')
  @ApiOperation({ summary: 'Get own restaurant menu' })
  @ApiResponse({ status: 200, description: 'Menu retrieved', type: [MenuItem] })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMenu(@CurrentUser('userId') ownerId: string): Promise<MenuItem[]> {
    this.logger.log(`Get menu for owner: ${ownerId}`);
    return this.menuService.getOwnerMenu(ownerId);
  }

  @Post('menu')
  @ApiOperation({ summary: 'Create menu item' })
  @ApiResponse({ status: 201, description: 'Menu item created', type: MenuItem })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createMenuItem(
    @CurrentUser('userId') ownerId: string,
    @Body() createMenuItemDto: CreateMenuItemDto,
  ): Promise<MenuItem> {
    this.logger.log(`Create menu item for owner: ${ownerId}`);
    return this.menuService.createMenuItem(ownerId, createMenuItemDto);
  }

  @Patch('menu/:id')
  @ApiOperation({ summary: 'Update menu item' })
  @ApiResponse({ status: 200, description: 'Menu item updated', type: MenuItem })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateMenuItem(
    @CurrentUser('userId') ownerId: string,
    @Param('id') menuItemId: string,
    @Body() updateMenuItemDto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    this.logger.log(`Update menu item: ${menuItemId} for owner: ${ownerId}`);
    return this.menuService.updateMenuItem(ownerId, menuItemId, updateMenuItemDto);
  }

  @Delete('menu/:id')
  @ApiOperation({ summary: 'Delete menu item' })
  @ApiResponse({ status: 204, description: 'Menu item deleted' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteMenuItem(
    @CurrentUser('userId') ownerId: string,
    @Param('id') menuItemId: string,
  ): Promise<void> {
    this.logger.log(`Delete menu item: ${menuItemId} for owner: ${ownerId}`);
    await this.menuService.deleteMenuItem(ownerId, menuItemId);
  }
}
