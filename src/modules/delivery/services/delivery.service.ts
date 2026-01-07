import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Delivery } from '../entities/delivery.entity';
import { Order } from '../../order/entities/order.entity';
import { DriverService } from '../../driver/driver.service';
import { CustomHttpException } from '../../../common/exceptions';
import { DeliveryStatus } from '../../../common/constants';
import { CreateDeliveryDto } from '../dto';
import { DriverAssignmentService } from './driver-assignment.service';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);
  private readonly DEFAULT_DRIVER_EARNINGS = 50; // ₹50 per delivery

  constructor(
    @InjectRepository(Delivery)
    private readonly deliveryRepository: Repository<Delivery>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly driverService: DriverService,
    private readonly driverAssignmentService: DriverAssignmentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create delivery and assign driver automatically
   */
  async createDeliveryWithAssignment(
    orderId: string,
    pickupLat: number,
    pickupLng: number,
    deliveryLat: number,
    deliveryLng: number,
  ): Promise<Delivery> {
    this.logger.log(`Creating delivery for order: ${orderId}`);

    // Check if delivery already exists
    const existing = await this.deliveryRepository.findOne({
      where: { orderId },
    });

    if (existing) {
      throw new CustomHttpException(
        'DELIVERY_ALREADY_EXISTS',
        'Delivery already exists for this order',
        400,
      );
    }

    // Find and assign nearest driver
    const assignment = await this.driverAssignmentService.findAndAssignDriver(pickupLat, pickupLng);

    // Calculate distance and duration
    const distance = this.calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);

    const duration = this.driverAssignmentService.estimateDeliveryDuration(distance);

    // Create delivery
    const delivery = this.deliveryRepository.create({
      orderId,
      driverId: assignment.driver.id,
      pickupLatitude: pickupLat,
      pickupLongitude: pickupLng,
      deliveryLatitude: deliveryLat,
      deliveryLongitude: deliveryLng,
      distanceKm: distance,
      estimatedDurationMins: duration,
      driverEarnings: this.DEFAULT_DRIVER_EARNINGS,
      status: DeliveryStatus.ASSIGNED,
    });

    const savedDelivery = await this.deliveryRepository.save(delivery);

    this.logger.log(
      `Delivery created: ${savedDelivery.id}, Driver: ${assignment.driver.id}, Distance: ${distance.toFixed(2)}km, ETA: ${duration}mins`,
    );

    // Emit delivery created event
    this.eventEmitter.emit('delivery.created', {
      deliveryId: savedDelivery.id,
      orderId,
      driverId: assignment.driver.id,
      distance,
      duration,
    });

    return this.getDeliveryById(savedDelivery.id);
  }

  /**
   * Create delivery manually (for testing or admin)
   */
  async createDelivery(createDeliveryDto: CreateDeliveryDto): Promise<Delivery> {
    this.logger.log(`Creating manual delivery for order: ${createDeliveryDto.orderId}`);

    // Check if order exists
    const order = await this.orderRepository.findOne({
      where: { id: createDeliveryDto.orderId },
    });

    if (!order) {
      throw new CustomHttpException('ORDER_NOT_FOUND', 'Order not found', 404);
    }

    // Check if delivery already exists
    const existing = await this.deliveryRepository.findOne({
      where: { orderId: createDeliveryDto.orderId },
    });

    if (existing) {
      throw new CustomHttpException(
        'DELIVERY_ALREADY_EXISTS',
        'Delivery already exists for this order',
        400,
      );
    }

    // Calculate distance
    const distance = this.calculateDistance(
      createDeliveryDto.pickupLatitude,
      createDeliveryDto.pickupLongitude,
      createDeliveryDto.deliveryLatitude,
      createDeliveryDto.deliveryLongitude,
    );

    const duration = this.driverAssignmentService.estimateDeliveryDuration(distance);

    const delivery = this.deliveryRepository.create({
      ...createDeliveryDto,
      distanceKm: distance,
      estimatedDurationMins: duration,
      status: DeliveryStatus.ASSIGNED,
    });

    // Mark driver as busy
    await this.driverService.setDriverBusy(createDeliveryDto.driverId);

    const savedDelivery = await this.deliveryRepository.save(delivery);

    this.logger.log(`Manual delivery created: ${savedDelivery.id}`);

    return this.getDeliveryById(savedDelivery.id);
  }

  /**
   * Get delivery by ID
   */
  async getDeliveryById(deliveryId: string): Promise<Delivery> {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: ['order', 'driver', 'driver.user'],
    });

    if (!delivery) {
      throw new CustomHttpException('DELIVERY_NOT_FOUND', 'Delivery not found', 404);
    }

    return delivery;
  }

  /**
   * Get delivery by order ID
   */
  async getDeliveryByOrderId(orderId: string): Promise<Delivery> {
    const delivery = await this.deliveryRepository.findOne({
      where: { orderId },
      relations: ['order', 'driver', 'driver.user'],
    });

    if (!delivery) {
      throw new CustomHttpException('DELIVERY_NOT_FOUND', 'Delivery not found', 404);
    }

    return delivery;
  }

  /**
   * Get driver's active delivery
   */
  async getActiveDeliveryForDriver(driverId: string): Promise<Delivery | null> {
    if (!driverId) {
      return null;
    }

    const delivery = await this.deliveryRepository.findOne({
      where: {
        driverId,
        status: DeliveryStatus.ASSIGNED,
      },
      relations: ['order', 'order.restaurant', 'order.user'],
    });

    if (!delivery) {
      // Check other active statuses
      return await this.deliveryRepository.findOne({
        where: { driverId },
        relations: ['order', 'order.restaurant', 'order.user'],
        order: { updatedAt: 'DESC' },
      });
    }

    return delivery;
  }

  /**
   * Get driver's delivery history
   */
  async getDeliveryHistoryForDriver(driverId: string, limit: number = 20): Promise<Delivery[]> {
    return this.deliveryRepository.find({
      where: { driverId },
      relations: ['order'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Update delivery status with validation
   */
  async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus,
    failureReason?: string,
  ): Promise<Delivery> {
    this.logger.log(`Updating delivery ${deliveryId} to status: ${status}`);

    const delivery = await this.getDeliveryById(deliveryId);

    // Validate status transition
    this.validateStatusTransition(delivery.status, status);

    // Update status and timestamps
    delivery.status = status;

    switch (status) {
      case DeliveryStatus.ACCEPTED:
        delivery.acceptedAt = new Date();
        break;
      case DeliveryStatus.ARRIVED_AT_RESTAURANT:
        delivery.arrivedAtRestaurantAt = new Date();
        break;
      case DeliveryStatus.PICKED_UP:
        delivery.pickedUpAt = new Date();
        break;
      case DeliveryStatus.ARRIVED_AT_CUSTOMER:
        delivery.arrivedAtCustomerAt = new Date();
        break;
      case DeliveryStatus.DELIVERED:
        delivery.deliveredAt = new Date();
        // Mark driver as available and update earnings
        await this.driverService.setDriverAvailable(delivery.driverId);
        await this.driverService.updateDriverEarnings(
          delivery.driverId,
          Number(delivery.driverEarnings),
        );
        break;
      case DeliveryStatus.FAILED:
        delivery.failureReason = failureReason || 'Delivery failed';
        // Mark driver as available
        await this.driverService.setDriverAvailable(delivery.driverId);
        break;
    }

    const updated = await this.deliveryRepository.save(delivery);

    this.logger.log(`Delivery ${deliveryId} updated to ${status} at ${new Date().toISOString()}`);

    // Emit delivery status changed event
    this.eventEmitter.emit('delivery.status.changed', {
      deliveryId: updated.id,
      orderId: updated.orderId,
      previousStatus: delivery.status,
      newStatus: status,
      driverId: updated.driverId,
    });

    return this.getDeliveryById(deliveryId);
  }

  /**
   * Accept delivery (driver accepts the assignment)
   */
  async acceptDelivery(deliveryId: string, driverId: string): Promise<Delivery> {
    const delivery = await this.getDeliveryById(deliveryId);

    // Verify driver
    if (delivery.driverId !== driverId) {
      throw new CustomHttpException(
        'UNAUTHORIZED_DRIVER',
        'This delivery is not assigned to you',
        403,
      );
    }

    // Verify current status
    if (delivery.status !== DeliveryStatus.ASSIGNED) {
      throw new CustomHttpException(
        'INVALID_STATUS',
        'Delivery has already been accepted or is in progress',
        400,
      );
    }

    return this.updateDeliveryStatus(deliveryId, DeliveryStatus.ACCEPTED);
  }

  /**
   * Mark arrived at restaurant
   */
  async arrivedAtRestaurant(deliveryId: string, driverId: string): Promise<Delivery> {
    const delivery = await this.getDeliveryById(deliveryId);

    if (delivery.driverId !== driverId) {
      throw new CustomHttpException(
        'UNAUTHORIZED_DRIVER',
        'This delivery is not assigned to you',
        403,
      );
    }

    if (delivery.status !== DeliveryStatus.ACCEPTED) {
      throw new CustomHttpException('INVALID_STATUS', 'Delivery must be accepted first', 400);
    }

    return this.updateDeliveryStatus(deliveryId, DeliveryStatus.ARRIVED_AT_RESTAURANT);
  }

  /**
   * Mark picked up from restaurant
   */
  async pickedUp(deliveryId: string, driverId: string): Promise<Delivery> {
    const delivery = await this.getDeliveryById(deliveryId);

    if (delivery.driverId !== driverId) {
      throw new CustomHttpException(
        'UNAUTHORIZED_DRIVER',
        'This delivery is not assigned to you',
        403,
      );
    }

    if (delivery.status !== DeliveryStatus.ARRIVED_AT_RESTAURANT) {
      throw new CustomHttpException(
        'INVALID_STATUS',
        'Driver must arrive at restaurant first',
        400,
      );
    }

    return this.updateDeliveryStatus(deliveryId, DeliveryStatus.PICKED_UP);
  }

  /**
   * Mark arrived at customer
   */
  async arrivedAtCustomer(deliveryId: string, driverId: string): Promise<Delivery> {
    const delivery = await this.getDeliveryById(deliveryId);

    if (delivery.driverId !== driverId) {
      throw new CustomHttpException(
        'UNAUTHORIZED_DRIVER',
        'This delivery is not assigned to you',
        403,
      );
    }

    if (delivery.status !== DeliveryStatus.PICKED_UP) {
      throw new CustomHttpException('INVALID_STATUS', 'Order must be picked up first', 400);
    }

    return this.updateDeliveryStatus(deliveryId, DeliveryStatus.ARRIVED_AT_CUSTOMER);
  }

  /**
   * Mark delivery as delivered
   */
  async delivered(deliveryId: string, driverId: string): Promise<Delivery> {
    const delivery = await this.getDeliveryById(deliveryId);

    if (delivery.driverId !== driverId) {
      throw new CustomHttpException(
        'UNAUTHORIZED_DRIVER',
        'This delivery is not assigned to you',
        403,
      );
    }

    if (delivery.status !== DeliveryStatus.ARRIVED_AT_CUSTOMER) {
      throw new CustomHttpException('INVALID_STATUS', 'Driver must arrive at customer first', 400);
    }

    return this.updateDeliveryStatus(deliveryId, DeliveryStatus.DELIVERED);
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(currentStatus: DeliveryStatus, newStatus: DeliveryStatus): void {
    const validTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
      [DeliveryStatus.ASSIGNED]: [DeliveryStatus.ACCEPTED, DeliveryStatus.FAILED],
      [DeliveryStatus.ACCEPTED]: [DeliveryStatus.ARRIVED_AT_RESTAURANT, DeliveryStatus.FAILED],
      [DeliveryStatus.ARRIVED_AT_RESTAURANT]: [DeliveryStatus.PICKED_UP, DeliveryStatus.FAILED],
      [DeliveryStatus.PICKED_UP]: [DeliveryStatus.ARRIVED_AT_CUSTOMER, DeliveryStatus.FAILED],
      [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.ARRIVED_AT_CUSTOMER, DeliveryStatus.FAILED],
      [DeliveryStatus.ARRIVED_AT_CUSTOMER]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
      [DeliveryStatus.DELIVERED]: [],
      [DeliveryStatus.FAILED]: [],
    };

    const allowed = validTransitions[currentStatus];

    if (!allowed.includes(newStatus)) {
      throw new CustomHttpException(
        'INVALID_STATUS_TRANSITION',
        `Cannot transition from ${currentStatus} to ${newStatus}`,
        400,
      );
    }
  }

  /**
   * Calculate distance using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
