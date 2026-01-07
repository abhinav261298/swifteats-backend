import {
  Controller,
  Patch,
  Param,
  Get,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, OrderStatus } from '../../common/constants';
import { OrderStateMachineService } from '../order/services/order-state-machine.service';
import { DeliveryService } from '../delivery/services/delivery.service';
import { Order } from '../order/entities/order.entity';
import { OrderStatusHistory } from '../order/entities/order-status-history.entity';
import { CustomHttpException } from '../../common/exceptions';

@ApiTags('Restaurant Orders')
@Controller('restaurant/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.RESTAURANT)
export class RestaurantOrderController {
  private readonly logger = new Logger(RestaurantOrderController.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderStatusHistory)
    private readonly statusHistoryRepository: Repository<OrderStatusHistory>,
    private readonly stateMachine: OrderStateMachineService,
    private readonly deliveryService: DeliveryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get orders for restaurant' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async getRestaurantOrders(@CurrentUser('restaurantId') restaurantId: string): Promise<Order[]> {
    if (!restaurantId) {
      throw new CustomHttpException(
        'RESTAURANT_NOT_FOUND',
        'Restaurant profile not found for this user',
        404,
      );
    }

    return this.orderRepository.find({
      where: { restaurantId },
      relations: ['items', 'items.menuItem', 'user', 'deliveryAddress'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  @Patch(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept order and trigger driver assignment' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order accepted and driver assigned successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid order status' })
  @ApiResponse({ status: 403, description: 'Order does not belong to this restaurant' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 503, description: 'No drivers available' })
  async acceptOrder(
    @Param('id') orderId: string,
    @CurrentUser('restaurantId') restaurantId: string,
  ): Promise<Order> {
    this.logger.log(`Restaurant ${restaurantId} accepting order: ${orderId}`);

    if (!restaurantId) {
      throw new CustomHttpException(
        'RESTAURANT_NOT_FOUND',
        'Restaurant profile not found for this user',
        404,
      );
    }

    // Get order details
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['restaurant', 'deliveryAddress'],
    });

    if (!order) {
      throw new CustomHttpException('ORDER_NOT_FOUND', 'Order not found', 404);
    }

    // Verify order belongs to this restaurant
    if (order.restaurantId !== restaurantId) {
      throw new CustomHttpException(
        'UNAUTHORIZED',
        'Order does not belong to this restaurant',
        403,
      );
    }

    // Validate status transition
    this.stateMachine.validateTransition(order.status, OrderStatus.RESTAURANT_ACCEPTED);

    // Update order status
    order.status = OrderStatus.RESTAURANT_ACCEPTED;
    await this.orderRepository.save(order);

    // Save status history
    const statusHistory = this.statusHistoryRepository.create({
      orderId,
      status: OrderStatus.RESTAURANT_ACCEPTED,
    });
    await this.statusHistoryRepository.save(statusHistory);

    // Trigger driver assignment
    try {
      await this.deliveryService.createDeliveryWithAssignment(
        orderId,
        Number(order.restaurant.latitude),
        Number(order.restaurant.longitude),
        Number(order.deliveryAddress.latitude),
        Number(order.deliveryAddress.longitude),
      );

      this.logger.log(`Driver assigned for order: ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to assign driver for order ${orderId}:`, error.message);
      // Order is still accepted, but no driver assigned yet
      // This could trigger retry logic or notification
    }

    const updatedOrder = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.menuItem', 'restaurant', 'deliveryAddress', 'statusHistory'],
    });

    if (!updatedOrder) {
      throw new CustomHttpException('ORDER_NOT_FOUND', 'Order not found after update', 404);
    }

    return updatedOrder;
  }

  @Patch(':id/ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark order as ready for pickup' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order marked as ready' })
  @ApiResponse({ status: 400, description: 'Invalid order status' })
  @ApiResponse({ status: 403, description: 'Order does not belong to this restaurant' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async markOrderReady(
    @Param('id') orderId: string,
    @CurrentUser('restaurantId') restaurantId: string,
  ): Promise<Order> {
    this.logger.log(`Restaurant ${restaurantId} marking order ready: ${orderId}`);

    if (!restaurantId) {
      throw new CustomHttpException(
        'RESTAURANT_NOT_FOUND',
        'Restaurant profile not found for this user',
        404,
      );
    }

    // Get order details
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new CustomHttpException('ORDER_NOT_FOUND', 'Order not found', 404);
    }

    // Verify order belongs to this restaurant
    if (order.restaurantId !== restaurantId) {
      throw new CustomHttpException(
        'UNAUTHORIZED',
        'Order does not belong to this restaurant',
        403,
      );
    }

    // Validate status transition
    this.stateMachine.validateTransition(order.status, OrderStatus.READY_FOR_PICKUP);

    // Update order status
    order.status = OrderStatus.READY_FOR_PICKUP;
    await this.orderRepository.save(order);

    // Save status history
    const statusHistory = this.statusHistoryRepository.create({
      orderId,
      status: OrderStatus.READY_FOR_PICKUP,
    });
    await this.statusHistoryRepository.save(statusHistory);

    this.logger.log(`Order ${orderId} marked as ready for pickup`);

    const updatedOrder = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.menuItem', 'restaurant', 'deliveryAddress', 'statusHistory'],
    });

    if (!updatedOrder) {
      throw new CustomHttpException('ORDER_NOT_FOUND', 'Order not found after update', 404);
    }

    return updatedOrder;
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order rejected successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order status' })
  @ApiResponse({ status: 403, description: 'Order does not belong to this restaurant' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async rejectOrder(
    @Param('id') orderId: string,
    @CurrentUser('restaurantId') restaurantId: string,
  ): Promise<Order> {
    this.logger.log(`Restaurant ${restaurantId} rejecting order: ${orderId}`);

    if (!restaurantId) {
      throw new CustomHttpException(
        'RESTAURANT_NOT_FOUND',
        'Restaurant profile not found for this user',
        404,
      );
    }

    // Get order details
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new CustomHttpException('ORDER_NOT_FOUND', 'Order not found', 404);
    }

    // Verify order belongs to this restaurant
    if (order.restaurantId !== restaurantId) {
      throw new CustomHttpException(
        'UNAUTHORIZED',
        'Order does not belong to this restaurant',
        403,
      );
    }

    // Validate status transition
    this.stateMachine.validateTransition(order.status, OrderStatus.CANCELLED);

    // Update order status
    order.status = OrderStatus.CANCELLED;
    await this.orderRepository.save(order);

    // Save status history
    const statusHistory = this.statusHistoryRepository.create({
      orderId,
      status: OrderStatus.CANCELLED,
      notes: 'Rejected by restaurant',
    });
    await this.statusHistoryRepository.save(statusHistory);

    // TODO: Trigger refund if payment was made

    this.logger.log(`Order ${orderId} rejected`);

    const updatedOrder = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.menuItem', 'restaurant', 'deliveryAddress', 'statusHistory'],
    });

    if (!updatedOrder) {
      throw new CustomHttpException('ORDER_NOT_FOUND', 'Order not found after update', 404);
    }

    return updatedOrder;
  }
}
