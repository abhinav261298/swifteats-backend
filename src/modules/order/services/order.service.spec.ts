import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderService } from './order.service';
import { OrderStateMachineService } from './order-state-machine.service';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Restaurant } from '../../restaurant/entities/restaurant.entity';
import { MenuItem } from '../../restaurant/entities/menu-item.entity';
import { Address } from '../../user/entities/address.entity';
import {
  OrderStatus,
  RestaurantStatus,
  ApprovalStatus,
  PaymentMethod,
} from '../../../common/constants';
import { CustomHttpException } from '../../../common/exceptions';
import { CreateOrderDto } from '../dto';
import { PaymentService } from '../../payment/payment.service';

describe('OrderService', () => {
  let service: OrderService;
  let orderRepository: jest.Mocked<Repository<Order>>;
  let orderItemRepository: jest.Mocked<Repository<OrderItem>>;
  let orderStatusHistoryRepository: jest.Mocked<Repository<OrderStatusHistory>>;
  let restaurantRepository: jest.Mocked<Repository<Restaurant>>;
  let menuItemRepository: jest.Mocked<Repository<MenuItem>>;
  let addressRepository: jest.Mocked<Repository<Address>>;
  let stateMachine: OrderStateMachineService;
  let paymentService: jest.Mocked<PaymentService>;

  const mockRestaurant = {
    id: 'restaurant-uuid',
    status: RestaurantStatus.ACTIVE,
    approvalStatus: ApprovalStatus.APPROVED,
    isOpen: true,
  } as Restaurant;

  const mockMenuItem = {
    id: 'menu-item-uuid',
    name: 'Burger',
    price: 150,
    isAvailable: true,
    preparationTimeMins: 15,
    restaurantId: 'restaurant-uuid',
  } as MenuItem;

  const mockAddress = {
    id: 'address-uuid',
    userId: 'user-uuid',
    label: 'Home',
  } as Address;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        OrderStateMachineService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OrderStatusHistory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Restaurant),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(MenuItem),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Address),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: PaymentService,
          useValue: {
            processPayment: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderRepository = module.get(getRepositoryToken(Order));
    orderItemRepository = module.get(getRepositoryToken(OrderItem));
    orderStatusHistoryRepository = module.get(getRepositoryToken(OrderStatusHistory));
    restaurantRepository = module.get(getRepositoryToken(Restaurant));
    menuItemRepository = module.get(getRepositoryToken(MenuItem));
    addressRepository = module.get(getRepositoryToken(Address));
    stateMachine = module.get<OrderStateMachineService>(OrderStateMachineService);
    paymentService = module.get(PaymentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    const createOrderDto: CreateOrderDto = {
      restaurantId: 'restaurant-uuid',
      deliveryAddressId: 'address-uuid',
      items: [{ menuItemId: 'menu-item-uuid', quantity: 2 }],
      paymentMethod: PaymentMethod.CARD,
    };

    it('should create order successfully', async () => {
      const mockOrder = {
        id: 'order-uuid',
        orderNumber: 'ORD-20260104-12345',
        userId: 'user-uuid',
        subtotal: 300,
        deliveryFee: 40,
        tax: 15,
        total: 355,
      } as Order;

      restaurantRepository.findOne.mockResolvedValue(mockRestaurant);
      addressRepository.findOne.mockResolvedValue(mockAddress);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockMenuItem]),
      };
      menuItemRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      orderItemRepository.create.mockReturnValue({} as OrderItem);
      orderRepository.create.mockReturnValue(mockOrder);
      orderRepository.save.mockResolvedValue(mockOrder);
      orderRepository.findOne.mockResolvedValue(mockOrder);
      orderStatusHistoryRepository.create.mockReturnValue({} as OrderStatusHistory);
      orderStatusHistoryRepository.save.mockResolvedValue({} as OrderStatusHistory);

      const result = await service.createOrder('user-uuid', createOrderDto);

      expect(result).toBeDefined();
      expect(restaurantRepository.findOne).toHaveBeenCalled();
      expect(addressRepository.findOne).toHaveBeenCalled();
      expect(orderRepository.save).toHaveBeenCalled();
    });

    it('should throw error when restaurant not found', async () => {
      restaurantRepository.findOne.mockResolvedValue(null);

      await expect(service.createOrder('user-uuid', createOrderDto)).rejects.toThrow(
        CustomHttpException,
      );
    });

    it('should throw error when restaurant is closed', async () => {
      const closedRestaurant = { ...mockRestaurant, isOpen: false };
      restaurantRepository.findOne.mockResolvedValue(closedRestaurant as Restaurant);

      await expect(service.createOrder('user-uuid', createOrderDto)).rejects.toThrow(
        CustomHttpException,
      );
    });

    it('should throw error when restaurant is not active', async () => {
      const inactiveRestaurant = { ...mockRestaurant, status: RestaurantStatus.INACTIVE };
      restaurantRepository.findOne.mockResolvedValue(inactiveRestaurant as Restaurant);

      await expect(service.createOrder('user-uuid', createOrderDto)).rejects.toThrow(
        CustomHttpException,
      );
    });

    it('should throw error when menu item is unavailable', async () => {
      restaurantRepository.findOne.mockResolvedValue(mockRestaurant);
      addressRepository.findOne.mockResolvedValue(mockAddress);

      const unavailableMenuItem = { ...mockMenuItem, isAvailable: false };
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([unavailableMenuItem]),
      };
      menuItemRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await expect(service.createOrder('user-uuid', createOrderDto)).rejects.toThrow(
        CustomHttpException,
      );
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order within 1 minute window', async () => {
      const mockOrder = {
        id: 'order-uuid',
        userId: 'user-uuid',
        status: OrderStatus.PENDING,
        createdAt: new Date(), // Just created
      } as Order;

      orderRepository.findOne.mockResolvedValue(mockOrder);
      orderRepository.save.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      } as Order);
      orderStatusHistoryRepository.create.mockReturnValue({} as OrderStatusHistory);
      orderStatusHistoryRepository.save.mockResolvedValue({} as OrderStatusHistory);

      const result = await service.cancelOrder('order-uuid', 'user-uuid', {});

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(orderRepository.save).toHaveBeenCalled();
    });

    it('should throw error when cancellation window expired', async () => {
      const oldDate = new Date();
      oldDate.setMinutes(oldDate.getMinutes() - 5); // 5 minutes ago

      const mockOrder = {
        id: 'order-uuid',
        userId: 'user-uuid',
        status: OrderStatus.PENDING,
        createdAt: oldDate,
      } as Order;

      orderRepository.findOne.mockResolvedValue(mockOrder);

      await expect(service.cancelOrder('order-uuid', 'user-uuid', {})).rejects.toThrow(
        CustomHttpException,
      );
    });

    it('should throw error when order cannot be cancelled', async () => {
      const mockOrder = {
        id: 'order-uuid',
        userId: 'user-uuid',
        status: OrderStatus.DELIVERED,
        createdAt: new Date(),
      } as Order;

      orderRepository.findOne.mockResolvedValue(mockOrder);

      await expect(service.cancelOrder('order-uuid', 'user-uuid', {})).rejects.toThrow(
        CustomHttpException,
      );
    });
  });

  describe('getOrderById', () => {
    it('should return order when found', async () => {
      const mockOrder = {
        id: 'order-uuid',
        userId: 'user-uuid',
      } as Order;

      orderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.getOrderById('order-uuid', 'user-uuid');

      expect(result).toEqual(mockOrder);
      expect(orderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'order-uuid', userId: 'user-uuid' },
        relations: ['items', 'items.menuItem', 'restaurant', 'deliveryAddress', 'statusHistory'],
      });
    });

    it('should throw error when order not found', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      await expect(service.getOrderById('order-uuid', 'user-uuid')).rejects.toThrow(
        CustomHttpException,
      );
    });
  });

  describe('getOrderHistory', () => {
    it('should return paginated order history', async () => {
      const mockOrders = [{ id: 'order-1' }, { id: 'order-2' }] as Order[];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockOrders, 2]),
      };

      orderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getOrderHistory('user-uuid', { page: 1, limit: 10 });

      expect(result.orders).toEqual(mockOrders);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });
});
