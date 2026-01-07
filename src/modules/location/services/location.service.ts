import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DriverLocation } from '../entities/driver-location.entity';
import { Driver } from '../../driver/entities/driver.entity';
import { LocationBufferService } from './location-buffer.service';
import { UpdateLocationDto } from '../dto';
import { CustomHttpException } from '../../../common/exceptions';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);
  private readonly LOCATION_RETENTION_DAYS = 7;

  constructor(
    @InjectRepository(DriverLocation)
    private readonly locationRepository: Repository<DriverLocation>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    private readonly locationBuffer: LocationBufferService,
  ) {}

  /**
   * Update driver location (buffered)
   * Updates current location in drivers table
   * Adds to buffer for batch insert to history
   */
  async updateDriverLocation(driverId: string, locationDto: UpdateLocationDto): Promise<void> {
    this.logger.debug(`Updating location for driver: ${driverId}`);

    // Verify driver exists
    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
    });

    if (!driver) {
      throw new CustomHttpException('DRIVER_NOT_FOUND', 'Driver not found', 404);
    }

    // Update current location in drivers table
    await this.driverRepository.update(driverId, {
      currentLatitude: locationDto.latitude,
      currentLongitude: locationDto.longitude,
      lastLocationUpdate: new Date(),
    });

    // Add to buffer for batch insert to history
    this.locationBuffer.addLocation({
      driverId,
      latitude: locationDto.latitude,
      longitude: locationDto.longitude,
      accuracy: locationDto.accuracy,
      heading: locationDto.heading,
      speed: locationDto.speed,
      timestamp: new Date(),
    });

    this.logger.debug(
      `Location updated for driver ${driverId}: (${locationDto.latitude}, ${locationDto.longitude})`,
    );
  }

  /**
   * Get driver's recent location history
   */
  async getDriverLocationHistory(driverId: string, limit: number = 100): Promise<DriverLocation[]> {
    return this.locationRepository.find({
      where: { driverId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get driver's current location
   */
  async getDriverCurrentLocation(driverId: string): Promise<{
    latitude: number;
    longitude: number;
    lastUpdate: Date;
  } | null> {
    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
      select: ['currentLatitude', 'currentLongitude', 'lastLocationUpdate'],
    });

    if (!driver || !driver.currentLatitude || !driver.currentLongitude) {
      return null;
    }

    return {
      latitude: Number(driver.currentLatitude),
      longitude: Number(driver.currentLongitude),
      lastUpdate: driver.lastLocationUpdate,
    };
  }

  /**
   * Get location history for a specific time range
   */
  async getLocationHistoryByTimeRange(
    driverId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<DriverLocation[]> {
    return this.locationRepository
      .createQueryBuilder('location')
      .where('location.driverId = :driverId', { driverId })
      .andWhere('location.timestamp >= :startTime', { startTime })
      .andWhere('location.timestamp <= :endTime', { endTime })
      .orderBy('location.timestamp', 'ASC')
      .getMany();
  }

  /**
   * Clean up old location data
   * Runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldLocations(): Promise<void> {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.LOCATION_RETENTION_DAYS);

    this.logger.log(
      `Cleaning up location data older than ${this.LOCATION_RETENTION_DAYS} days (before ${retentionDate.toISOString()})`,
    );

    try {
      const result = await this.locationRepository.delete({
        timestamp: LessThan(retentionDate),
      });

      this.logger.log(`Successfully deleted ${result.affected || 0} old location records`);
    } catch (error) {
      this.logger.error(`Failed to cleanup old locations:`, error.message);
    }
  }

  /**
   * Get buffer statistics
   */
  getBufferStats() {
    return this.locationBuffer.getStats();
  }
}
