import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantController } from './restaurant.controller';
import { RestaurantOwnerController } from './restaurant-owner.controller';
import { RestaurantOrderController } from './restaurant-order.controller';
import { RestaurantService } from './restaurant.service';
import { MenuService } from './menu.service';
import { Restaurant } from './entities/restaurant.entity';
import { MenuItem } from './entities/menu-item.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../order/entities/order.entity';
import { OrderStatusHistory } from '../order/entities/order-status-history.entity';
import { AuthModule } from '../auth/auth.module';
import { OrderModule } from '../order/order.module';
import { DeliveryModule } from '../delivery/delivery.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Restaurant, MenuItem, User, Order, OrderStatusHistory]),
    AuthModule,
    OrderModule,
    DeliveryModule,
  ],
  controllers: [RestaurantController, RestaurantOwnerController, RestaurantOrderController],
  providers: [RestaurantService, MenuService],
  exports: [RestaurantService, MenuService],
})
export class RestaurantModule {}
