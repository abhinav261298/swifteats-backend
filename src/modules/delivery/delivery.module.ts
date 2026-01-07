import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './services/delivery.service';
import { DriverAssignmentService } from './services/driver-assignment.service';
import { Delivery } from './entities/delivery.entity';
import { Driver } from '../driver/entities/driver.entity';
import { Order } from '../order/entities/order.entity';
import { DriverModule } from '../driver/driver.module';

@Module({
  imports: [TypeOrmModule.forFeature([Delivery, Driver, Order]), DriverModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, DriverAssignmentService],
  exports: [DeliveryService, DriverAssignmentService],
})
export class DeliveryModule {}
