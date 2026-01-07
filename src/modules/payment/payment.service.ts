import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Order } from '../order/entities/order.entity';
import { ProcessPaymentDto } from './dto';
import { PaymentStatus } from '../../common/constants';
import { CustomHttpException } from '../../common/exceptions';

/**
 * Payment Service
 * Handles mock payment processing with retry logic
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  // Mock payment configuration
  private readonly SUCCESS_RATE = 0.9; // 90% success rate
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Process payment for an order with retry logic
   */
  async processPayment(processPaymentDto: ProcessPaymentDto): Promise<Payment> {
    const { orderId, paymentMethod, amount } = processPaymentDto;

    this.logger.log(`Processing payment for order: ${orderId}, amount: ₹${amount}`);

    // Check if payment already exists
    const existingPayment = await this.paymentRepository.findOne({
      where: { orderId },
    });

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.SUCCESS) {
        this.logger.log(`Payment already processed successfully for order: ${orderId}`);
        return existingPayment;
      }
      // If payment exists but failed, retry it
      return this.retryPayment(existingPayment);
    }

    // Create new payment record
    const payment = this.paymentRepository.create({
      orderId,
      paymentMethod,
      amount,
      status: PaymentStatus.PENDING,
      retryCount: 0,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Attempt payment processing with retries
    return this.attemptPaymentWithRetry(savedPayment);
  }

  /**
   * Attempt payment processing with exponential backoff retry
   */
  private async attemptPaymentWithRetry(payment: Payment): Promise<Payment> {
    const currentPayment = payment;

    for (let attempt = 0; attempt < this.MAX_RETRY_ATTEMPTS; attempt++) {
      this.logger.log(
        `Payment attempt ${attempt + 1}/${this.MAX_RETRY_ATTEMPTS} for payment: ${payment.id}`,
      );

      // Update status to PROCESSING
      currentPayment.status = PaymentStatus.PROCESSING;
      await this.paymentRepository.save(currentPayment);

      // Simulate payment processing
      const result = await this.mockPaymentGateway();

      if (result.success) {
        // Payment successful
        currentPayment.status = PaymentStatus.SUCCESS;
        currentPayment.transactionId = result.transactionId || null;
        currentPayment.processedAt = new Date();
        currentPayment.failureReason = null;

        await this.paymentRepository.save(currentPayment);

        this.logger.log(
          `Payment successful for order: ${payment.orderId}, transaction: ${result.transactionId}`,
        );

        return currentPayment;
      } else {
        // Payment failed
        currentPayment.retryCount = attempt + 1;
        currentPayment.failureReason = result.error || 'Unknown error';
        currentPayment.status = PaymentStatus.PENDING; // Back to pending for retry

        await this.paymentRepository.save(currentPayment);

        this.logger.warn(
          `Payment attempt ${attempt + 1} failed for order: ${payment.orderId}, reason: ${result.error}`,
        );

        // If not last attempt, wait before retry (exponential backoff)
        if (attempt < this.MAX_RETRY_ATTEMPTS - 1) {
          const delay = this.RETRY_DELAYS[attempt];
          this.logger.log(`Retrying payment in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted - mark as failed
    currentPayment.status = PaymentStatus.FAILED;
    await this.paymentRepository.save(currentPayment);

    this.logger.error(
      `Payment failed after ${this.MAX_RETRY_ATTEMPTS} attempts for order: ${payment.orderId}`,
    );

    return currentPayment;
  }

  /**
   * Retry an existing failed payment
   */
  private async retryPayment(payment: Payment): Promise<Payment> {
    this.logger.log(`Retrying payment: ${payment.id} for order: ${payment.orderId}`);

    // Reset for retry
    payment.status = PaymentStatus.PENDING;
    payment.retryCount = 0;
    payment.failureReason = null;

    const savedPayment = await this.paymentRepository.save(payment);
    return this.attemptPaymentWithRetry(savedPayment);
  }

  /**
   * Mock payment gateway simulation
   * Returns success 90% of the time
   */
  private async mockPaymentGateway(): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    // Simulate processing delay
    await this.sleep(500);

    const random = Math.random();

    if (random < this.SUCCESS_RATE) {
      // Success (90% chance)
      return {
        success: true,
        transactionId: this.generateTransactionId(),
      };
    } else {
      // Failure (10% chance)
      const errors = [
        'Insufficient funds',
        'Card declined',
        'Network timeout',
        'Invalid card details',
        'Bank service unavailable',
      ];
      const randomError = errors[Math.floor(Math.random() * errors.length)];

      return {
        success: false,
        error: randomError,
      };
    }
  }

  /**
   * Generate mock transaction ID
   */
  private generateTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `TXN-${timestamp}-${random}`;
  }

  /**
   * Get payment by order ID
   */
  async getPaymentByOrderId(orderId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { orderId },
      relations: ['order'],
    });
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['order'],
    });

    if (!payment) {
      throw new CustomHttpException('PAYMENT_NOT_FOUND', 'Payment not found', 404);
    }

    return payment;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get payment statistics (for testing/monitoring)
   */
  async getPaymentStats(): Promise<{
    total: number;
    successful: number;
    failed: number;
    pending: number;
    successRate: number;
  }> {
    const [total, successful, failed, pending] = await Promise.all([
      this.paymentRepository.count(),
      this.paymentRepository.count({ where: { status: PaymentStatus.SUCCESS } }),
      this.paymentRepository.count({ where: { status: PaymentStatus.FAILED } }),
      this.paymentRepository.count({ where: { status: PaymentStatus.PENDING } }),
    ]);

    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      total,
      successful,
      failed,
      pending,
      successRate: Number(successRate.toFixed(2)),
    };
  }
}
