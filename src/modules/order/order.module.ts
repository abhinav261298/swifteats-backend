import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './services/order.service';
import { OrderStateMachineService } from './services/order-state-machine.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Restaurant } from '../restaurant/entities/restaurant.entity';
import { MenuItem } from '../restaurant/entities/menu-item.entity';
import { Address } from '../user/entities/address.entity';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderStatusHistory, Restaurant, MenuItem, Address]),
    PaymentModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderStateMachineService],
  exports: [OrderService, OrderStateMachineService],
})
export class OrderModule {}
