import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import cacheConfig from './config/cache.config';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RestaurantModule } from './modules/restaurant/restaurant.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { DriverModule } from './modules/driver/driver.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { LocationModule } from './modules/location/location.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, cacheConfig],
      envFilePath: '.env',
    }),

    // Cache
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5 minutes default
      max: 1000, // max items in cache
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Event Emitter
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 10,
    }),

    // Database
    DatabaseModule,

    // Auth Module
    AuthModule,

    // User Module
    UserModule,

    // Restaurant Module
    RestaurantModule,

    // Order Module
    OrderModule,

    // Payment Module
    PaymentModule,

    // Driver Module
    DriverModule,

    // Delivery Module
    DeliveryModule,

    // Location Module
    LocationModule,

    // Additional modules will be added in subsequent tasks
  ],
  controllers: [AppController],
  providers: [
    // Global JWT authentication guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
