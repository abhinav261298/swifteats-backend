import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MenuService } from './menu.service';
import { MenuItem } from './entities/menu-item.entity';
import { Restaurant } from './entities/restaurant.entity';
import { CustomHttpException } from '../../common/exceptions';
import { RestaurantStatus, ApprovalStatus } from '../../common/constants';

describe('MenuService', () => {
  let service: MenuService;
  let menuItemRepository: jest.Mocked<Repository<MenuItem>>;
  let restaurantRepository: jest.Mocked<Repository<Restaurant>>;

  const mockRestaurant = {
    id: 'restaurant-uuid-123',
    ownerId: 'user-uuid-123',
    name: 'Test Restaurant',
    status: RestaurantStatus.ACTIVE,
    approvalStatus: ApprovalStatus.APPROVED,
  } as Restaurant;

  const mockMenuItem = {
    id: 'menu-item-uuid-123',
    restaurantId: 'restaurant-uuid-123',
    name: 'Butter Chicken',
    description: 'Tender chicken in rich tomato sauce',
    price: 350.0,
    category: 'Main Course',
    isAvailable: true,
    isVegetarian: false,
    isVegan: false,
    preparationTimeMins: 20,
  } as MenuItem;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        {
          provide: getRepositoryToken(MenuItem),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Restaurant),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            reset: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MenuService>(MenuService);
    menuItemRepository = module.get(getRepositoryToken(MenuItem));
    restaurantRepository = module.get(getRepositoryToken(Restaurant));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOwnerMenu', () => {
    it('should return menu items for owner restaurant', async () => {
      restaurantRepository.findOne.mockResolvedValue(mockRestaurant);
      menuItemRepository.find.mockResolvedValue([mockMenuItem]);

      const result = await service.getOwnerMenu('user-uuid-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockMenuItem);
      expect(restaurantRepository.findOne).toHaveBeenCalledWith({
        where: { ownerId: 'user-uuid-123' },
      });
      expect(menuItemRepository.find).toHaveBeenCalledWith({
        where: { restaurantId: 'restaurant-uuid-123' },
        order: { category: 'ASC', name: 'ASC' },
      });
    });

    it('should throw CustomHttpException when restaurant not found', async () => {
      restaurantRepository.findOne.mockResolvedValue(null);

      await expect(service.getOwnerMenu('user-uuid-123')).rejects.toThrow(CustomHttpException);
      expect(menuItemRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('createMenuItem', () => {
    const createDto = {
      name: 'Paneer Tikka',
      description: 'Grilled cottage cheese',
      price: 280.0,
      category: 'Appetizer',
      isVegetarian: true,
      isVegan: false,
      preparationTimeMins: 15,
    };

    it('should create menu item successfully', async () => {
      restaurantRepository.findOne.mockResolvedValue(mockRestaurant);
      menuItemRepository.create.mockReturnValue(mockMenuItem as any);
      menuItemRepository.save.mockResolvedValue(mockMenuItem);

      const result = await service.createMenuItem('user-uuid-123', createDto as any);

      expect(result).toEqual(mockMenuItem);
      expect(menuItemRepository.create).toHaveBeenCalledWith({
        ...createDto,
        restaurantId: 'restaurant-uuid-123',
      });
      expect(menuItemRepository.save).toHaveBeenCalledWith(mockMenuItem);
    });

    it('should throw CustomHttpException when restaurant not found', async () => {
      restaurantRepository.findOne.mockResolvedValue(null);

      await expect(service.createMenuItem('user-uuid-123', createDto as any)).rejects.toThrow(
        CustomHttpException,
      );
      expect(menuItemRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateMenuItem', () => {
    const updateDto = {
      price: 380.0,
      description: 'Premium butter chicken',
    };

    it('should update menu item successfully', async () => {
      restaurantRepository.findOne.mockResolvedValue(mockRestaurant);
      menuItemRepository.findOne.mockResolvedValue(mockMenuItem);
      menuItemRepository.save.mockResolvedValue({ ...mockMenuItem, ...updateDto });

      const result = await service.updateMenuItem(
        'user-uuid-123',
        'menu-item-uuid-123',
        updateDto as any,
      );

      expect(result.price).toBe(380.0);
      expect(result.description).toBe('Premium butter chicken');
      expect(menuItemRepository.save).toHaveBeenCalled();
    });

    it('should throw CustomHttpException when restaurant not found', async () => {
      restaurantRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateMenuItem('user-uuid-123', 'menu-item-uuid-123', updateDto as any),
      ).rejects.toThrow(CustomHttpException);
    });

    it('should throw CustomHttpException when menu item not found', async () => {
      restaurantRepository.findOne.mockResolvedValue(mockRestaurant);
      menuItemRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateMenuItem('user-uuid-123', 'menu-item-uuid-123', updateDto as any),
      ).rejects.toThrow(CustomHttpException);
    });

    it('should throw CustomHttpException when menu item belongs to different restaurant', async () => {
      const otherMenuItem = { ...mockMenuItem, restaurantId: 'other-restaurant-id' };
      restaurantRepository.findOne.mockResolvedValue(mockRestaurant);
      menuItemRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateMenuItem('user-uuid-123', 'menu-item-uuid-123', updateDto as any),
      ).rejects.toThrow(CustomHttpException);
    });
  });

  describe('deleteMenuItem', () => {
    it('should delete menu item successfully', async () => {
      restaurantRepository.findOne.mockResolvedValue(mockRestaurant);
      menuItemRepository.findOne.mockResolvedValue(mockMenuItem);
      menuItemRepository.remove.mockResolvedValue(mockMenuItem);

      await service.deleteMenuItem('user-uuid-123', 'menu-item-uuid-123');

      expect(menuItemRepository.remove).toHaveBeenCalledWith(mockMenuItem);
    });

    it('should throw CustomHttpException when restaurant not found', async () => {
      restaurantRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteMenuItem('user-uuid-123', 'menu-item-uuid-123')).rejects.toThrow(
        CustomHttpException,
      );
      expect(menuItemRepository.remove).not.toHaveBeenCalled();
    });

    it('should throw CustomHttpException when menu item not found', async () => {
      restaurantRepository.findOne.mockResolvedValue(mockRestaurant);
      menuItemRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteMenuItem('user-uuid-123', 'menu-item-uuid-123')).rejects.toThrow(
        CustomHttpException,
      );
      expect(menuItemRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('getMenuItem', () => {
    it('should return menu item when found', async () => {
      restaurantRepository.findOne.mockResolvedValue(mockRestaurant);
      menuItemRepository.findOne.mockResolvedValue(mockMenuItem);

      const result = await service.getMenuItem('user-uuid-123', 'menu-item-uuid-123');

      expect(result).toEqual(mockMenuItem);
      expect(menuItemRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'menu-item-uuid-123', restaurantId: 'restaurant-uuid-123' },
      });
    });

    it('should throw CustomHttpException when restaurant not found', async () => {
      restaurantRepository.findOne.mockResolvedValue(null);

      await expect(service.getMenuItem('user-uuid-123', 'menu-item-uuid-123')).rejects.toThrow(
        CustomHttpException,
      );
    });

    it('should throw CustomHttpException when menu item not found', async () => {
      restaurantRepository.findOne.mockResolvedValue(mockRestaurant);
      menuItemRepository.findOne.mockResolvedValue(null);

      await expect(service.getMenuItem('user-uuid-123', 'menu-item-uuid-123')).rejects.toThrow(
        CustomHttpException,
      );
    });
  });
});
