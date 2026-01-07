import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from './entities/driver.entity';
import { User } from '../user/entities/user.entity';
import { CustomHttpException } from '../../common/exceptions';
import {
  CreateDriverDto,
  UpdateDriverDto,
  UpdateDriverStatusDto,
  UpdateDriverLocationDto,
} from './dto';
import { ApprovalStatus } from '../../common/constants';

@Injectable()
export class DriverService {
  private readonly logger = new Logger(DriverService.name);
  private readonly EARNING_PER_DELIVERY = 50; // ₹50 per delivery

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Create driver profile
   */
  async createDriverProfile(userId: string, createDriverDto: CreateDriverDto): Promise<Driver> {
    this.logger.log(`Creating driver profile for user: ${userId}`);

    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new CustomHttpException('USER_NOT_FOUND', 'User not found', 404);
    }

    // Check if driver profile already exists
    const existingDriver = await this.driverRepository.findOne({
      where: { userId },
    });

    if (existingDriver) {
      throw new CustomHttpException(
        'DRIVER_ALREADY_EXISTS',
        'Driver profile already exists for this user',
        400,
      );
    }

    // Check if license number already exists
    const duplicateLicense = await this.driverRepository.findOne({
      where: { licenseNumber: createDriverDto.licenseNumber },
    });

    if (duplicateLicense) {
      throw new CustomHttpException(
        'LICENSE_ALREADY_EXISTS',
        'This license number is already registered',
        400,
      );
    }

    // Check if vehicle number already exists
    const duplicateVehicle = await this.driverRepository.findOne({
      where: { vehicleNumber: createDriverDto.vehicleNumber },
    });

    if (duplicateVehicle) {
      throw new CustomHttpException(
        'VEHICLE_ALREADY_EXISTS',
        'This vehicle number is already registered',
        400,
      );
    }

    // Create driver profile
    const driver = this.driverRepository.create({
      userId,
      ...createDriverDto,
      approvalStatus: ApprovalStatus.PENDING,
      isOnline: false,
      isAvailable: true,
      totalDeliveries: 0,
      totalEarnings: 0,
      rating: 0,
      totalRatings: 0,
    });

    const savedDriver = await this.driverRepository.save(driver);
    this.logger.log(`Driver profile created: ${savedDriver.id}`);

    return this.getDriverProfile(userId);
  }

  /**
   * Get driver profile by user ID
   */
  async getDriverProfile(userId: string): Promise<Driver> {
    this.logger.log(`Getting driver profile for user: ${userId}`);

    const driver = await this.driverRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!driver) {
      throw new CustomHttpException('DRIVER_NOT_FOUND', 'Driver profile not found', 404);
    }

    return driver;
  }

  /**
   * Update driver profile
   */
  async updateDriverProfile(userId: string, updateDriverDto: UpdateDriverDto): Promise<Driver> {
    this.logger.log(`Updating driver profile for user: ${userId}`);

    const driver = await this.getDriverProfile(userId);

    // Check license number uniqueness if being updated
    if (updateDriverDto.licenseNumber && updateDriverDto.licenseNumber !== driver.licenseNumber) {
      const duplicateLicense = await this.driverRepository.findOne({
        where: { licenseNumber: updateDriverDto.licenseNumber },
      });

      if (duplicateLicense) {
        throw new CustomHttpException(
          'LICENSE_ALREADY_EXISTS',
          'This license number is already registered',
          400,
        );
      }
    }

    // Check vehicle number uniqueness if being updated
    if (updateDriverDto.vehicleNumber && updateDriverDto.vehicleNumber !== driver.vehicleNumber) {
      const duplicateVehicle = await this.driverRepository.findOne({
        where: { vehicleNumber: updateDriverDto.vehicleNumber },
      });

      if (duplicateVehicle) {
        throw new CustomHttpException(
          'VEHICLE_ALREADY_EXISTS',
          'This vehicle number is already registered',
          400,
        );
      }
    }

    // Update driver
    Object.assign(driver, updateDriverDto);
    await this.driverRepository.save(driver);

    this.logger.log(`Driver profile updated: ${driver.id}`);
    return this.getDriverProfile(userId);
  }

  /**
   * Update driver online/offline status
   */
  async updateDriverStatus(
    userId: string,
    updateStatusDto: UpdateDriverStatusDto,
  ): Promise<Driver> {
    this.logger.log(
      `Updating driver status for user: ${userId} to ${updateStatusDto.isOnline ? 'online' : 'offline'}`,
    );

    const driver = await this.getDriverProfile(userId);

    // Check if driver is approved
    if (driver.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new CustomHttpException(
        'DRIVER_NOT_APPROVED',
        'Driver profile must be approved before going online',
        403,
      );
    }

    // If going offline, set as unavailable
    if (!updateStatusDto.isOnline) {
      driver.isOnline = false;
      driver.isAvailable = true; // Reset to available when offline
    } else {
      driver.isOnline = true;
      driver.isAvailable = true; // Available when going online
    }

    await this.driverRepository.save(driver);

    this.logger.log(
      `Driver status updated: ${driver.id} - Online: ${driver.isOnline}, Available: ${driver.isAvailable}`,
    );

    return this.getDriverProfile(userId);
  }

  /**
   * Update driver location
   */
  async updateDriverLocation(
    userId: string,
    locationDto: UpdateDriverLocationDto,
  ): Promise<Driver> {
    this.logger.log(`Updating driver location for user: ${userId}`);

    const driver = await this.getDriverProfile(userId);

    // Update location
    driver.currentLatitude = locationDto.latitude;
    driver.currentLongitude = locationDto.longitude;
    driver.lastLocationUpdate = new Date();

    await this.driverRepository.save(driver);

    this.logger.log(
      `Driver location updated: ${driver.id} - Lat: ${locationDto.latitude}, Lng: ${locationDto.longitude}`,
    );

    return driver;
  }

  /**
   * Set driver as busy (assigned to order)
   */
  async setDriverBusy(driverId: string): Promise<void> {
    this.logger.log(`Setting driver as busy: ${driverId}`);

    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
    });

    if (!driver) {
      throw new CustomHttpException('DRIVER_NOT_FOUND', 'Driver not found', 404);
    }

    driver.isAvailable = false;
    await this.driverRepository.save(driver);

    this.logger.log(`Driver marked as busy: ${driverId}`);
  }

  /**
   * Set driver as available (after delivery completion)
   */
  async setDriverAvailable(driverId: string): Promise<void> {
    this.logger.log(`Setting driver as available: ${driverId}`);

    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
    });

    if (!driver) {
      throw new CustomHttpException('DRIVER_NOT_FOUND', 'Driver not found', 404);
    }

    // Only set available if driver is still online
    if (driver.isOnline) {
      driver.isAvailable = true;
      await this.driverRepository.save(driver);
      this.logger.log(`Driver marked as available: ${driverId}`);
    } else {
      this.logger.log(`Driver ${driverId} is offline, not marking as available`);
    }
  }

  /**
   * Update driver earnings after delivery completion
   */
  async updateDriverEarnings(driverId: string, amount?: number): Promise<void> {
    this.logger.log(`Updating driver earnings: ${driverId}`);

    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
    });

    if (!driver) {
      throw new CustomHttpException('DRIVER_NOT_FOUND', 'Driver not found', 404);
    }

    const earningAmount = amount || this.EARNING_PER_DELIVERY;

    driver.totalEarnings = Number(driver.totalEarnings) + earningAmount;
    driver.totalDeliveries += 1;

    await this.driverRepository.save(driver);

    this.logger.log(
      `Driver earnings updated: ${driverId} - Total: ₹${driver.totalEarnings}, Deliveries: ${driver.totalDeliveries}`,
    );
  }

  /**
   * Get driver earnings
   */
  async getDriverEarnings(userId: string): Promise<{
    totalEarnings: number;
    totalDeliveries: number;
    averagePerDelivery: number;
    rating: number;
    totalRatings: number;
  }> {
    this.logger.log(`Getting driver earnings for user: ${userId}`);

    const driver = await this.getDriverProfile(userId);

    const averagePerDelivery =
      driver.totalDeliveries > 0 ? Number(driver.totalEarnings) / driver.totalDeliveries : 0;

    return {
      totalEarnings: Number(driver.totalEarnings),
      totalDeliveries: driver.totalDeliveries,
      averagePerDelivery: Math.round(averagePerDelivery * 100) / 100,
      rating: Number(driver.rating),
      totalRatings: driver.totalRatings,
    };
  }

  /**
   * Find available drivers near a location
   */
  async findAvailableDrivers(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
  ): Promise<Driver[]> {
    this.logger.log(
      `Finding available drivers near (${latitude}, ${longitude}) within ${radiusKm}km`,
    );

    // Find drivers who are online, available, and approved
    const drivers = await this.driverRepository
      .createQueryBuilder('driver')
      .where('driver.isOnline = :isOnline', { isOnline: true })
      .andWhere('driver.isAvailable = :isAvailable', { isAvailable: true })
      .andWhere('driver.approvalStatus = :approvalStatus', {
        approvalStatus: ApprovalStatus.APPROVED,
      })
      .andWhere('driver.currentLatitude IS NOT NULL')
      .andWhere('driver.currentLongitude IS NOT NULL')
      .getMany();

    // Filter by distance (simple Haversine calculation)
    const nearbyDrivers = drivers.filter((driver) => {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        Number(driver.currentLatitude),
        Number(driver.currentLongitude),
      );
      return distance <= radiusKm;
    });

    this.logger.log(`Found ${nearbyDrivers.length} available drivers nearby`);

    return nearbyDrivers;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
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
}
