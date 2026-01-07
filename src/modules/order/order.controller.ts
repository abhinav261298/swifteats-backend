import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrderService } from './services/order.service';
import { CreateOrderDto, OrderQueryDto, CancelOrderDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Order } from './entities/order.entity';
import { PaymentService } from '../payment/payment.service';
import { Payment } from '../payment/entities/payment.entity';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or restaurant closed' })
  @ApiResponse({ status: 404, description: 'Restaurant or menu items not found' })
  async createOrder(
    @CurrentUser('userId') userId: string,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<Order> {
    this.logger.log(`Create order request from user: ${userId}`);
    return this.orderService.createOrder(userId, createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get order history' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'DELIVERED', 'CANCELLED'] })
  @ApiResponse({ status: 200, description: 'Order history retrieved' })
  async getOrderHistory(@CurrentUser('userId') userId: string, @Query() queryDto: OrderQueryDto) {
    this.logger.log(`Get order history for user: ${userId}`);
    return this.orderService.getOrderHistory(userId, queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details by ID (includes payment info)' })
  @ApiResponse({ status: 200, description: 'Order details retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderById(
    @CurrentUser('userId') userId: string,
    @Param('id') orderId: string,
  ): Promise<Order & { payment: Payment | null }> {
    this.logger.log(`Get order details: ${orderId} for user: ${userId}`);
    const order = await this.orderService.getOrderById(orderId, userId);
    const payment = await this.paymentService.getPaymentByOrderId(orderId);

    return {
      ...order,
      payment: payment || null,
    };
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order (within 1 minute of creation)' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cancellation window expired or invalid status' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancelOrder(
    @CurrentUser('userId') userId: string,
    @Param('id') orderId: string,
    @Body() cancelDto: CancelOrderDto,
  ): Promise<Order> {
    this.logger.log(`Cancel order: ${orderId} by user: ${userId}`);
    return this.orderService.cancelOrder(orderId, userId, cancelDto);
  }
}
