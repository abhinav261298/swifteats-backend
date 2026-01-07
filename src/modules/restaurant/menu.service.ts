import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MenuItem } from './entities/menu-item.entity';
import { Restaurant } from './entities/restaurant.entity';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto';
import { CustomHttpException } from '../../common/exceptions';

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * Clear menu cache for a restaurant
   */
  private async clearMenuCache(restaurantId: string): Promise<void> {
    // Clear all menu caches for this restaurant
    const cacheKeys = [
      `restaurant:${restaurantId}:menu:all`,
      // Note: We clear the general cache, category-specific caches expire naturally
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache cleared: ${key}`);
    }
  }

  /**
   * Get all menu items for owner's restaurant
   */
  async getOwnerMenu(ownerId: string): Promise<MenuItem[]> {
    this.logger.log(`Getting menu for owner: ${ownerId}`);

    const restaurant = await this.restaurantRepository.findOne({
      where: { ownerId },
    });

    if (!restaurant) {
      throw new CustomHttpException(
        'RESTAURANT_NOT_FOUND',
        'No restaurant found for this owner',
        404,
      );
    }

    return this.menuItemRepository.find({
      where: { restaurantId: restaurant.id },
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Create menu item
   */
  async createMenuItem(ownerId: string, createMenuItemDto: CreateMenuItemDto): Promise<MenuItem> {
    this.logger.log(`Creating menu item for owner: ${ownerId}`);

    const restaurant = await this.restaurantRepository.findOne({
      where: { ownerId },
    });

    if (!restaurant) {
      throw new CustomHttpException(
        'RESTAURANT_NOT_FOUND',
        'No restaurant found for this owner',
        404,
      );
    }

    const menuItem = this.menuItemRepository.create({
      ...createMenuItemDto,
      restaurantId: restaurant.id,
    });

    const savedItem = await this.menuItemRepository.save(menuItem);

    // Clear menu cache
    await this.clearMenuCache(restaurant.id);
    this.logger.log(`Menu cache invalidated for restaurant: ${restaurant.id}`);

    return savedItem;
  }

  /**
   * Update menu item
   */
  async updateMenuItem(
    ownerId: string,
    menuItemId: string,
    updateMenuItemDto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    this.logger.log(`Updating menu item: ${menuItemId} for owner: ${ownerId}`);

    const restaurant = await this.restaurantRepository.findOne({
      where: { ownerId },
    });

    if (!restaurant) {
      throw new CustomHttpException(
        'RESTAURANT_NOT_FOUND',
        'No restaurant found for this owner',
        404,
      );
    }

    const menuItem = await this.menuItemRepository.findOne({
      where: { id: menuItemId, restaurantId: restaurant.id },
    });

    if (!menuItem) {
      throw new CustomHttpException(
        'MENU_ITEM_NOT_FOUND',
        'Menu item not found or does not belong to your restaurant',
        404,
      );
    }

    Object.assign(menuItem, updateMenuItemDto);
    const updatedItem = await this.menuItemRepository.save(menuItem);

    // Clear menu cache
    await this.clearMenuCache(restaurant.id);
    this.logger.log(`Menu cache invalidated for restaurant: ${restaurant.id}`);

    return updatedItem;
  }

  /**
   * Delete menu item
   */
  async deleteMenuItem(ownerId: string, menuItemId: string): Promise<void> {
    this.logger.log(`Deleting menu item: ${menuItemId} for owner: ${ownerId}`);

    const restaurant = await this.restaurantRepository.findOne({
      where: { ownerId },
    });

    if (!restaurant) {
      throw new CustomHttpException(
        'RESTAURANT_NOT_FOUND',
        'No restaurant found for this owner',
        404,
      );
    }

    const menuItem = await this.menuItemRepository.findOne({
      where: { id: menuItemId, restaurantId: restaurant.id },
    });

    if (!menuItem) {
      throw new CustomHttpException(
        'MENU_ITEM_NOT_FOUND',
        'Menu item not found or does not belong to your restaurant',
        404,
      );
    }

    await this.menuItemRepository.remove(menuItem);

    // Clear menu cache
    await this.clearMenuCache(restaurant.id);
    this.logger.log(`Menu item deleted: ${menuItemId}, cache invalidated`);
  }

  /**
   * Get menu item by ID (with ownership check)
   */
  async getMenuItem(ownerId: string, menuItemId: string): Promise<MenuItem> {
    this.logger.log(`Getting menu item: ${menuItemId} for owner: ${ownerId}`);

    const restaurant = await this.restaurantRepository.findOne({
      where: { ownerId },
    });

    if (!restaurant) {
      throw new CustomHttpException(
        'RESTAURANT_NOT_FOUND',
        'No restaurant found for this owner',
        404,
      );
    }

    const menuItem = await this.menuItemRepository.findOne({
      where: { id: menuItemId, restaurantId: restaurant.id },
    });

    if (!menuItem) {
      throw new CustomHttpException(
        'MENU_ITEM_NOT_FOUND',
        'Menu item not found or does not belong to your restaurant',
        404,
      );
    }

    return menuItem;
  }
}
