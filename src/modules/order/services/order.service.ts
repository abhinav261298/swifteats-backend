import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Restaurant } from '../../restaurant/entities/restaurant.entity';
import { MenuItem } from '../../restaurant/entities/menu-item.entity';
import { Address } from '../../user/entities/address.entity';
import { CreateOrderDto, OrderQueryDto, CancelOrderDto } from '../dto';
import {
  OrderStatus,
  PaymentMethod,
  RestaurantStatus,
  ApprovalStatus,
} from '../../../common/constants';
import { CustomHttpException } from '../../../common/exceptions';
import { OrderStateMachineService } from './order-state-machine.service';
import { PaymentService } from '../../payment/payment.service';

/**
 * Order Service
 * Handles order creation, management, and business logic
 */
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  // Business constants
  private readonly DELIVERY_FEE = 40; // ₹40 flat delivery fee
  private readonly TAX_RATE = 0.05; // 5% tax
  private readonly CANCELLATION_WINDOW_MS = 60 * 1000; // 1 minute in milliseconds

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoryRepository: Repository<OrderStatusHistory>,
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    private readonly stateMachine: OrderStateMachineService,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Create a new order
   */
  async createOrder(userId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    this.logger.log(`Creating order for user: ${userId}`);

    // 1. Validate restaurant
    await this.validateRestaurant(createOrderDto.restaurantId);

    // 2. Validate delivery address
    await this.validateDeliveryAddress(userId, createOrderDto.deliveryAddressId);

    // 3. Validate and fetch menu items
    const menuItemsData = await this.validateMenuItems(
      createOrderDto.restaurantId,
      createOrderDto.items,
    );

    // 4. Calculate totals
    const { subtotal, tax, total, orderItems, preparationTimeMins } = this.calculateOrderTotals(
      createOrderDto.items,
      menuItemsData,
    );

    // 5. Generate order number
    const orderNumber = this.generateOrderNumber();

    // 6. Create order entity
    const order = this.orderRepository.create({
      orderNumber,
      userId,
      restaurantId: createOrderDto.restaurantId,
      deliveryAddressId: createOrderDto.deliveryAddressId,
      status: this.stateMachine.getInitialStatus(),
      subtotal,
      deliveryFee: this.DELIVERY_FEE,
      tax,
      discount: 0, // TODO: Apply promo code discount
      total,
      promoCode: createOrderDto.promoCode,
      specialInstructions: createOrderDto.specialInstructions,
      preparationTimeMins,
      estimatedDeliveryTimeMins: preparationTimeMins + 30, // Add 30 mins for delivery
      items: orderItems,
    });

    // 7. Save order (cascade saves items)
    const savedOrder = await this.orderRepository.save(order);

    // 8. Create initial status history
    await this.createStatusHistory(savedOrder.id, OrderStatus.PENDING, userId, 'Order created');

    this.logger.log(`Order created successfully: ${orderNumber}`);

    // 9. Process payment asynchronously (non-blocking)
    // Payment processing happens in background with retry logic
    this.processPaymentAsync(savedOrder.id, createOrderDto.paymentMethod, total).catch((error) => {
      this.logger.error(`Payment processing failed for order ${savedOrder.id}:`, error);
    });

    // 10. Return order with relations
    const finalOrder = await this.orderRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['items', 'restaurant', 'deliveryAddress'],
    });

    if (!finalOrder) {
      throw new CustomHttpException(
        'ORDER_CREATION_FAILED',
        'Failed to retrieve created order',
        500,
      );
    }

    return finalOrder;
  }

  /**
   * Process payment asynchronously (non-blocking)
   */
  private async processPaymentAsync(
    orderId: string,
    paymentMethod: PaymentMethod,
    amount: number,
  ): Promise<void> {
    try {
      this.logger.log(`Starting payment processing for order: ${orderId}`);

      const payment = await this.paymentService.processPayment({
        orderId,
        paymentMethod,
        amount,
      });

      this.logger.log(
        `Payment completed for order ${orderId}: ${payment.status} (Transaction: ${payment.transactionId})`,
      );

      // Update order based on payment result
      // This would typically trigger order status updates via events
      // For now, we just log the result
      if (payment.status === 'FAILED') {
        this.logger.error(
          `Payment failed for order ${orderId} after retries. Reason: ${payment.failureReason}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error processing payment for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get order history for a user
   */
  async getOrderHistory(
    userId: string,
    queryDto: OrderQueryDto,
  ): Promise<{
    orders: Order[];
    total: number;
    page: number;
    limit: number;
  }> {
    this.logger.log(`Getting order history for user: ${userId}`);

    const { page = 1, limit = 10, status } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.restaurant', 'restaurant')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.userId = :userId', { userId })
      .orderBy('order.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    const [orders, total] = await queryBuilder.getManyAndCount();

    return {
      orders,
      total,
      page,
      limit,
    };
  }

  /**
   * Get order details by ID
   */
  async getOrderById(orderId: string, userId: string): Promise<Order> {
    this.logger.log(`Getting order: ${orderId} for user: ${userId}`);

    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['items', 'items.menuItem', 'restaurant', 'deliveryAddress', 'statusHistory'],
    });

    if (!order) {
      throw new CustomHttpException('ORDER_NOT_FOUND', 'Order not found', 404);
    }

    return order;
  }

  /**
   * Cancel an order (only within 1 minute of creation)
   */
  async cancelOrder(orderId: string, userId: string, cancelDto: CancelOrderDto): Promise<Order> {
    this.logger.log(`Cancelling order: ${orderId} by user: ${userId}`);

    // 1. Get order
    const order = await this.getOrderById(orderId, userId);

    // 2. Check if order can be cancelled
    if (!this.stateMachine.canBeCancelled(order.status)) {
      throw new CustomHttpException(
        'CANNOT_CANCEL_ORDER',
        `Order cannot be cancelled in ${order.status} status`,
        400,
      );
    }

    // 3. Check cancellation window (1 minute)
    const orderAge = Date.now() - order.createdAt.getTime();
    if (orderAge > this.CANCELLATION_WINDOW_MS) {
      const secondsElapsed = Math.floor(orderAge / 1000);
      throw new CustomHttpException(
        'CANCELLATION_WINDOW_EXPIRED',
        `Order can only be cancelled within 1 minute of creation. ${secondsElapsed} seconds have elapsed.`,
        400,
      );
    }

    // 4. Update order status
    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    order.cancellationReason = cancelDto.reason || 'Cancelled by customer';

    const updatedOrder = await this.orderRepository.save(order);

    // 5. Create status history
    await this.createStatusHistory(
      orderId,
      OrderStatus.CANCELLED,
      userId,
      cancelDto.reason || 'Cancelled by customer',
    );

    this.logger.log(`Order cancelled: ${orderId}`);

    return updatedOrder;
  }

  /**
   * Validate restaurant is available for ordering
   */
  private async validateRestaurant(restaurantId: string): Promise<Restaurant> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id: restaurantId },
    });

    if (!restaurant) {
      throw new CustomHttpException('RESTAURANT_NOT_FOUND', 'Restaurant not found', 404);
    }

    if (restaurant.status !== RestaurantStatus.ACTIVE) {
      throw new CustomHttpException('RESTAURANT_NOT_ACTIVE', 'Restaurant is not active', 400);
    }

    if (restaurant.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new CustomHttpException('RESTAURANT_NOT_APPROVED', 'Restaurant is not approved', 400);
    }

    if (!restaurant.isOpen) {
      throw new CustomHttpException('RESTAURANT_CLOSED', 'Restaurant is currently closed', 400);
    }

    return restaurant;
  }

  /**
   * Validate delivery address belongs to user
   */
  private async validateDeliveryAddress(userId: string, addressId: string): Promise<Address> {
    const address = await this.addressRepository.findOne({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new CustomHttpException(
        'ADDRESS_NOT_FOUND',
        'Delivery address not found or does not belong to you',
        404,
      );
    }

    return address;
  }

  /**
   * Validate menu items exist, are available, and belong to restaurant
   */
  private async validateMenuItems(
    restaurantId: string,
    orderItems: { menuItemId: string; quantity: number }[],
  ): Promise<MenuItem[]> {
    const menuItemIds = orderItems.map((item) => item.menuItemId);

    const menuItems = await this.menuItemRepository
      .createQueryBuilder('menuItem')
      .where('menuItem.id IN (:...ids)', { ids: menuItemIds })
      .andWhere('menuItem.restaurantId = :restaurantId', { restaurantId })
      .getMany();

    // Check all items were found
    if (menuItems.length !== menuItemIds.length) {
      const foundIds = menuItems.map((item) => item.id);
      const missingIds = menuItemIds.filter((id) => !foundIds.includes(id));
      throw new CustomHttpException(
        'MENU_ITEM_NOT_FOUND',
        `Menu items not found or do not belong to this restaurant: ${missingIds.join(', ')}`,
        404,
      );
    }

    // Check all items are available
    const unavailableItems = menuItems.filter((item) => !item.isAvailable);
    if (unavailableItems.length > 0) {
      const names = unavailableItems.map((item) => item.name).join(', ');
      throw new CustomHttpException(
        'MENU_ITEM_UNAVAILABLE',
        `The following items are currently unavailable: ${names}`,
        400,
      );
    }

    return menuItems;
  }

  /**
   * Calculate order totals
   */
  private calculateOrderTotals(
    orderItemDtos: { menuItemId: string; quantity: number; specialInstructions?: string }[],
    menuItems: MenuItem[],
  ): {
    subtotal: number;
    tax: number;
    total: number;
    orderItems: OrderItem[];
    preparationTimeMins: number;
  } {
    let subtotal = 0;
    let maxPreparationTime = 0;
    const orderItems: OrderItem[] = [];

    for (const itemDto of orderItemDtos) {
      const menuItem = menuItems.find((mi) => mi.id === itemDto.menuItemId);
      if (!menuItem) continue;

      const itemSubtotal = Number(menuItem.price) * itemDto.quantity;
      subtotal += itemSubtotal;

      // Track max preparation time
      if (menuItem.preparationTimeMins && menuItem.preparationTimeMins > maxPreparationTime) {
        maxPreparationTime = menuItem.preparationTimeMins;
      }

      // Create order item entity (will be saved with order cascade)
      const orderItem = this.orderItemRepository.create({
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        price: menuItem.price,
        quantity: itemDto.quantity,
        subtotal: itemSubtotal,
        specialInstructions: itemDto.specialInstructions,
      });

      orderItems.push(orderItem);
    }

    const tax = subtotal * this.TAX_RATE;
    const total = subtotal + this.DELIVERY_FEE + tax;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(total.toFixed(2)),
      orderItems,
      preparationTimeMins: maxPreparationTime,
    };
  }

  /**
   * Generate unique order number (ORD-YYYYMMDD-XXXXX)
   */
  private generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0');

    return `ORD-${year}${month}${day}-${random}`;
  }

  /**
   * Create status history entry
   */
  private async createStatusHistory(
    orderId: string,
    status: OrderStatus,
    changedBy: string,
    notes?: string,
  ): Promise<void> {
    const history = this.orderStatusHistoryRepository.create({
      orderId,
      status,
      changedBy,
      notes,
    });

    await this.orderStatusHistoryRepository.save(history);
  }
}
