import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from '../../driver/entities/driver.entity';
import { DriverService } from '../../driver/driver.service';
import { CustomHttpException } from '../../../common/exceptions';

export interface DriverAssignmentResult {
  driver: Driver;
  distance: number;
  searchRadius: number;
}

@Injectable()
export class DriverAssignmentService {
  private readonly logger = new Logger(DriverAssignmentService.name);
  private readonly INITIAL_SEARCH_RADIUS_KM = 5;
  private readonly MAX_SEARCH_RADIUS_KM = 20;
  private readonly RADIUS_INCREMENT_KM = 5;

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    private readonly driverService: DriverService,
  ) {}

  /**
   * Find and assign nearest available driver
   * Retries with increasing radius if no driver found
   */
  async findAndAssignDriver(
    restaurantLat: number,
    restaurantLng: number,
  ): Promise<DriverAssignmentResult> {
    this.logger.log(`Finding driver near (${restaurantLat}, ${restaurantLng})`);

    let currentRadius = this.INITIAL_SEARCH_RADIUS_KM;

    while (currentRadius <= this.MAX_SEARCH_RADIUS_KM) {
      this.logger.log(`Searching for drivers within ${currentRadius}km`);

      const drivers = await this.driverService.findAvailableDrivers(
        restaurantLat,
        restaurantLng,
        currentRadius,
      );

      if (drivers.length > 0) {
        // Find nearest driver
        const driverWithDistance = drivers.map((driver) => ({
          driver,
          distance: this.calculateDistance(
            restaurantLat,
            restaurantLng,
            Number(driver.currentLatitude),
            Number(driver.currentLongitude),
          ),
        }));

        // Sort by distance
        driverWithDistance.sort((a, b) => a.distance - b.distance);

        const nearest = driverWithDistance[0];

        this.logger.log(
          `Found ${drivers.length} drivers, nearest is ${nearest.driver.id} at ${nearest.distance.toFixed(2)}km`,
        );

        // Try to lock driver (prevents race condition)
        const locked = await this.lockDriver(nearest.driver.id);

        if (locked) {
          return {
            driver: nearest.driver,
            distance: nearest.distance,
            searchRadius: currentRadius,
          };
        } else {
          this.logger.warn(`Driver ${nearest.driver.id} already assigned, trying next...`);
          // Continue to next driver in the list
          for (let i = 1; i < driverWithDistance.length; i++) {
            const attempt = driverWithDistance[i];
            const attemptLocked = await this.lockDriver(attempt.driver.id);
            if (attemptLocked) {
              return {
                driver: attempt.driver,
                distance: attempt.distance,
                searchRadius: currentRadius,
              };
            }
          }
        }
      }

      // No drivers found or all busy, expand radius
      currentRadius += this.RADIUS_INCREMENT_KM;
      this.logger.log(
        `No available drivers in ${currentRadius - this.RADIUS_INCREMENT_KM}km, expanding to ${currentRadius}km`,
      );
    }

    // No drivers found within max radius
    throw new CustomHttpException(
      'NO_DRIVERS_AVAILABLE',
      `No drivers available within ${this.MAX_SEARCH_RADIUS_KM}km`,
      503,
    );
  }

  /**
   * Lock driver to prevent race condition
   * Uses database row locking with SKIP LOCKED
   */
  private async lockDriver(driverId: string): Promise<boolean> {
    try {
      // Use FOR UPDATE SKIP LOCKED to prevent race conditions
      const driver = await this.driverRepository
        .createQueryBuilder('driver')
        .where('driver.id = :driverId', { driverId })
        .andWhere('driver.isOnline = :isOnline', { isOnline: true })
        .andWhere('driver.isAvailable = :isAvailable', { isAvailable: true })
        .setLock('pessimistic_write')
        .getOne();

      if (!driver) {
        return false;
      }

      // Mark driver as busy
      await this.driverService.setDriverBusy(driverId);

      this.logger.log(`Driver ${driverId} locked and marked as busy`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to lock driver ${driverId}:`, error.message);
      return false;
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
    const distance = R * c;
    return distance;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Estimate delivery duration based on distance
   * Assumes average speed of 20 km/h for bikes
   */
  estimateDeliveryDuration(distanceKm: number): number {
    const AVERAGE_SPEED_KMH = 20;
    const PICKUP_TIME_MINS = 5;
    const DROPOFF_TIME_MINS = 5;

    const travelTimeMins = (distanceKm / AVERAGE_SPEED_KMH) * 60;
    return Math.ceil(travelTimeMins + PICKUP_TIME_MINS + DROPOFF_TIME_MINS);
  }
}
