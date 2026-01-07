import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { LocationController } from './location.controller';
import { LocationService } from './services/location.service';
import { LocationBufferService } from './services/location-buffer.service';
import { LocationGateway } from './gateways/location.gateway';
import { DriverLocation } from './entities/driver-location.entity';
import { Driver } from '../driver/entities/driver.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DriverLocation, Driver]), ScheduleModule.forRoot()],
  controllers: [LocationController],
  providers: [LocationService, LocationBufferService, LocationGateway],
  exports: [LocationService, LocationBufferService, LocationGateway],
})
export class LocationModule {}
