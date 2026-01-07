import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '../../../common/constants';
import { CustomHttpException } from '../../../common/exceptions';

/**
 * Order State Machine Service
 * Manages order status transitions and enforces business rules
 */
@Injectable()
export class OrderStateMachineService {
  private readonly logger = new Logger(OrderStateMachineService.name);

  /**
   * Valid status transitions map
   * Key: Current status
   * Value: Array of allowed next statuses
   */
  private readonly validTransitions: Map<OrderStatus, OrderStatus[]> = new Map([
    [
      OrderStatus.PENDING,
      [OrderStatus.RESTAURANT_ACCEPTED, OrderStatus.CANCELLED, OrderStatus.FAILED],
    ],
    [OrderStatus.RESTAURANT_ACCEPTED, [OrderStatus.PREPARING, OrderStatus.CANCELLED]],
    [OrderStatus.PREPARING, [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED]],
    [OrderStatus.READY_FOR_PICKUP, [OrderStatus.DRIVER_ASSIGNED, OrderStatus.CANCELLED]],
    [OrderStatus.DRIVER_ASSIGNED, [OrderStatus.PICKED_UP, OrderStatus.CANCELLED]],
    [OrderStatus.PICKED_UP, [OrderStatus.IN_TRANSIT]],
    [OrderStatus.IN_TRANSIT, [OrderStatus.DELIVERED, OrderStatus.FAILED]],
    [OrderStatus.DELIVERED, []], // Terminal state
    [OrderStatus.CANCELLED, []], // Terminal state
    [OrderStatus.FAILED, []], // Terminal state
  ]);

  /**
   * Check if a status transition is valid
   */
  canTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
    const allowedTransitions = this.validTransitions.get(currentStatus) || [];
    return allowedTransitions.includes(newStatus);
  }

  /**
   * Validate and perform status transition
   * @throws CustomHttpException if transition is invalid
   */
  validateTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
    this.logger.log(`Validating transition: ${currentStatus} -> ${newStatus}`);

    if (currentStatus === newStatus) {
      throw new CustomHttpException(
        'INVALID_STATUS_TRANSITION',
        `Order is already in ${currentStatus} status`,
        400,
      );
    }

    if (!this.canTransition(currentStatus, newStatus)) {
      const allowedStatuses = this.validTransitions.get(currentStatus) || [];
      throw new CustomHttpException(
        'INVALID_STATUS_TRANSITION',
        `Cannot transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowedStatuses.join(', ') || 'none'}`,
        400,
      );
    }

    this.logger.log(`Valid transition: ${currentStatus} -> ${newStatus}`);
  }

  /**
   * Get all allowed next statuses for a given current status
   */
  getAllowedNextStatuses(currentStatus: OrderStatus): OrderStatus[] {
    return this.validTransitions.get(currentStatus) || [];
  }

  /**
   * Check if a status is terminal (no further transitions allowed)
   */
  isTerminalStatus(status: OrderStatus): boolean {
    const allowedTransitions = this.validTransitions.get(status) || [];
    return allowedTransitions.length === 0;
  }

  /**
   * Check if cancellation is allowed from current status
   */
  canBeCancelled(currentStatus: OrderStatus): boolean {
    return this.canTransition(currentStatus, OrderStatus.CANCELLED);
  }

  /**
   * Get the initial status for a new order
   */
  getInitialStatus(): OrderStatus {
    return OrderStatus.PENDING;
  }
}
