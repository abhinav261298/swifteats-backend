import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Restaurant } from './entities/restaurant.entity';
import { MenuItem } from './entities/menu-item.entity';
import {
  CreateRestaurantDto,
  UpdateRestaurantDto,
  RestaurantQueryDto,
  UpdateRestaurantStatusDto,
} from './dto';
import { RestaurantStatus, ApprovalStatus } from '../../common/constants';
import { CustomHttpException, UserNotFoundException } from '../../common/exceptions';
import { User } from '../user/entities/user.entity';

@Injectable()
export class RestaurantService {
  private readonly logger = new Logger(RestaurantService.name);

  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * Find restaurants with location-based search using PostGIS
   */
  async findNearbyRestaurants(
    queryDto: RestaurantQueryDto,
  ): Promise<Array<Restaurant & { distance?: number | null }>> {
    this.logger.log(`Finding restaurants with filters: ${JSON.stringify(queryDto)}`);

    const { latitude, longitude, radius = 10, cuisineType, isOpen, search } = queryDto;

    let query = this.restaurantRepository
      .createQueryBuilder('restaurant')
      .select([
        'restaurant.id',
        'restaurant.name',
        'restaurant.description',
        'restaurant.phone',
        'restaurant.address',
        'restaurant.city',
        'restaurant.state',
        'restaurant.postalCode',
        'restaurant.latitude',
        'restaurant.longitude',
        'restaurant.cuisineType',
        'restaurant.rating',
        'restaurant.totalReviews',
        'restaurant.isOpen',
        'restaurant.openingTime',
        'restaurant.closingTime',
        'restaurant.averagePreparationTimeMins',
        'restaurant.imageUrl',
      ])
      .where('restaurant.status = :status', { status: RestaurantStatus.ACTIVE })
      .andWhere('restaurant.approvalStatus = :approvalStatus', {
        approvalStatus: ApprovalStatus.APPROVED,
      });

    // Filter by open status
    if (isOpen !== undefined) {
      query = query.andWhere('restaurant.isOpen = :isOpen', { isOpen });
    }

    // Filter by cuisine type
    if (cuisineType) {
      query = query.andWhere('LOWER(restaurant.cuisineType) = LOWER(:cuisineType)', {
        cuisineType,
      });
    }

    // Search by name
    if (search) {
      query = query.andWhere('LOWER(restaurant.name) LIKE LOWER(:search)', {
        search: `%${search}%`,
      });
    }

    // If location provided, calculate distance and filter by radius
    if (latitude !== undefined && longitude !== undefined) {
      // Haversine formula for distance calculation (in km)
      const distanceFormula = `(6371 * acos(cos(radians(:latitude)) * cos(radians(restaurant.latitude)) * 
           cos(radians(restaurant.longitude) - radians(:longitude)) + 
           sin(radians(:latitude)) * sin(radians(restaurant.latitude))))`;

      query = query
        .addSelect(distanceFormula, 'distance')
        .setParameter('latitude', latitude)
        .setParameter('longitude', longitude)
        .andWhere(`${distanceFormula} <= :radius`, { radius })
        .orderBy('distance', 'ASC');
    } else {
      // If no location, order by rating
      query = query.orderBy('restaurant.rating', 'DESC');
    }

    const results = await query.getRawAndEntities();

    // Map results to include distance
    return results.raw.map((raw, index) => {
      const restaurant = results.entities[index];
      return {
        ...restaurant,
        distance: raw.distance ? parseFloat(parseFloat(raw.distance).toFixed(2)) : null,
      };
    });
  }

  /**
   * Get restaurant by ID (customer view)
   */
  async findRestaurantById(restaurantId: string): Promise<Restaurant> {
    this.logger.log(`Finding restaurant: ${restaurantId}`);

    const restaurant = await this.restaurantRepository.findOne({
      where: {
        id: restaurantId,
        status: RestaurantStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
      },
    });

    if (!restaurant) {
      throw new CustomHttpException(
        'RESTAURANT_NOT_FOUND',
        'Restaurant not found or not available',
        404,
      );
    }

    return restaurant;
  }

  /**
   * Get restaurant menu (customer view) with caching
   */
  async getRestaurantMenu(restaurantId: string, category?: string): Promise<MenuItem[]> {
    this.logger.log(`Getting menu for restaurant: ${restaurantId}`);

    // Generate cache key
    const cacheKey = category
      ? `restaurant:${restaurantId}:menu:${category.toLowerCase()}`
      : `restaurant:${restaurantId}:menu:all`;

    // Try to get from cache
    const cachedMenu = await this.cacheManager.get<MenuItem[]>(cacheKey);
    if (cachedMenu) {
      this.logger.debug(`Menu served from cache: ${cacheKey}`);
      return cachedMenu;
    }

    // Verify restaurant exists and is active
    await this.findRestaurantById(restaurantId);

    const queryBuilder = this.menuItemRepository
      .createQueryBuilder('menuItem')
      .where('menuItem.restaurantId = :restaurantId', { restaurantId })
      .andWhere('menuItem.isAvailable = :isAvailable', { isAvailable: true })
      .orderBy('menuItem.category', 'ASC')
      .addOrderBy('menuItem.name', 'ASC');

    if (category) {
      queryBuilder.andWhere('LOWER(menuItem.category) = LOWER(:category)', { category });
    }

    const menuItems = await queryBuilder.getMany();

    // Cache the result (TTL: 5 minutes = 300 seconds)
    await this.cacheManager.set(cacheKey, menuItems, 300000);
    this.logger.debug(`Menu cached: ${cacheKey}`);

    return menuItems;
  }

  /**
   * Get restaurant profile for owner
   */
  async getOwnerRestaurant(ownerId: string): Promise<Restaurant> {
    this.logger.log(`Getting restaurant for owner: ${ownerId}`);

    const restaurant = await this.restaurantRepository.findOne({
      where: { ownerId },
      relations: ['menuItems'],
    });

    if (!restaurant) {
      throw new CustomHttpException(
        'RESTAURANT_NOT_FOUND',
        'No restaurant found for this owner',
        404,
      );
    }

    return restaurant;
  }

  /**
   * Create restaurant (owner registration)
   */
  async createRestaurant(
    ownerId: string,
    createRestaurantDto: CreateRestaurantDto,
  ): Promise<Restaurant> {
    this.logger.log(`Creating restaurant for owner: ${ownerId}`);

    // Verify owner exists and is a restaurant role
    const owner = await this.userRepository.findOne({ where: { id: ownerId } });
    if (!owner) {
      throw new UserNotFoundException(ownerId);
    }

    // Check if owner already has a restaurant
    const existingRestaurant = await this.restaurantRepository.findOne({
      where: { ownerId },
    });

    if (existingRestaurant) {
      throw new CustomHttpException(
        'RESTAURANT_ALREADY_EXISTS',
        'Owner already has a restaurant',
        409,
      );
    }

    // Check phone uniqueness
    const existingPhone = await this.restaurantRepository.findOne({
      where: { phone: createRestaurantDto.phone },
    });

    if (existingPhone) {
      throw new CustomHttpException('PHONE_ALREADY_EXISTS', 'Phone number already registered', 409);
    }

    const restaurant = this.restaurantRepository.create({
      ...createRestaurantDto,
      ownerId,
      status: RestaurantStatus.PENDING,
      approvalStatus: ApprovalStatus.PENDING,
    });

    return this.restaurantRepository.save(restaurant);
  }

  /**
   * Update restaurant profile (owner)
   */
  async updateRestaurant(
    ownerId: string,
    updateRestaurantDto: UpdateRestaurantDto,
  ): Promise<Restaurant> {
    this.logger.log(`Updating restaurant for owner: ${ownerId}`);

    const restaurant = await this.getOwnerRestaurant(ownerId);

    // Check phone uniqueness if being updated
    if (updateRestaurantDto.phone && updateRestaurantDto.phone !== restaurant.phone) {
      const existingPhone = await this.restaurantRepository.findOne({
        where: { phone: updateRestaurantDto.phone },
      });

      if (existingPhone) {
        throw new CustomHttpException(
          'PHONE_ALREADY_EXISTS',
          'Phone number already registered',
          409,
        );
      }
    }

    Object.assign(restaurant, updateRestaurantDto);
    return this.restaurantRepository.save(restaurant);
  }

  /**
   * Update restaurant open/close status
   */
  async updateRestaurantStatus(
    ownerId: string,
    updateStatusDto: UpdateRestaurantStatusDto,
  ): Promise<Restaurant> {
    this.logger.log(
      `Updating restaurant status for owner: ${ownerId}, isOpen: ${updateStatusDto.isOpen}`,
    );

    const restaurant = await this.getOwnerRestaurant(ownerId);

    // Only allow status toggle if restaurant is approved and active
    if (restaurant.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new CustomHttpException(
        'RESTAURANT_NOT_APPROVED',
        'Cannot change status until restaurant is approved',
        403,
      );
    }

    if (restaurant.status !== RestaurantStatus.ACTIVE) {
      throw new CustomHttpException(
        'RESTAURANT_NOT_ACTIVE',
        'Restaurant must be active to change open/close status',
        403,
      );
    }

    restaurant.isOpen = updateStatusDto.isOpen;
    return this.restaurantRepository.save(restaurant);
  }
}
