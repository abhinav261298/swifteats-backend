import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverAssignmentService } from './driver-assignment.service';
import { Driver } from '../../driver/entities/driver.entity';
import { DriverService } from '../../driver/driver.service';
import { CustomHttpException } from '../../../common/exceptions';
import { ApprovalStatus, VehicleType } from '../../../common/constants';

describe('DriverAssignmentService', () => {
  let service: DriverAssignmentService;
  let driverRepository: jest.Mocked<Repository<Driver>>;
  let driverService: jest.Mocked<DriverService>;

  const mockDriver = {
    id: 'driver-uuid',
    userId: 'user-uuid',
    isOnline: true,
    isAvailable: true,
    approvalStatus: ApprovalStatus.APPROVED,
    currentLatitude: 12.9716,
    currentLongitude: 77.5946,
    vehicleType: VehicleType.BIKE,
    totalDeliveries: 10,
    totalEarnings: 500,
  } as Driver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverAssignmentService,
        {
          provide: getRepositoryToken(Driver),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: DriverService,
          useValue: {
            findAvailableDrivers: jest.fn(),
            setDriverBusy: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DriverAssignmentService>(DriverAssignmentService);
    driverRepository = module.get(getRepositoryToken(Driver));
    driverService = module.get(DriverService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAndAssignDriver', () => {
    it('should find and assign nearest driver within initial radius', async () => {
      const restaurantLat = 12.9716;
      const restaurantLng = 77.5946;

      driverService.findAvailableDrivers.mockResolvedValue([mockDriver]);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockDriver),
      };

      driverRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      driverService.setDriverBusy.mockResolvedValue(undefined);

      const result = await service.findAndAssignDriver(restaurantLat, restaurantLng);

      expect(result).toBeDefined();
      expect(result.driver).toEqual(mockDriver);
      expect(result.distance).toBeLessThan(1);
      expect(result.searchRadius).toBe(5);
      expect(driverService.setDriverBusy).toHaveBeenCalledWith(mockDriver.id);
    });

    it('should retry with larger radius if no drivers found initially', async () => {
      const restaurantLat = 12.9716;
      const restaurantLng = 77.5946;

      driverService.findAvailableDrivers
        .mockResolvedValueOnce([]) // No drivers in 5km
        .mockResolvedValueOnce([mockDriver]); // Driver found in 10km

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockDriver),
      };

      driverRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      driverService.setDriverBusy.mockResolvedValue(undefined);

      const result = await service.findAndAssignDriver(restaurantLat, restaurantLng);

      expect(result).toBeDefined();
      expect(result.driver).toEqual(mockDriver);
      expect(result.searchRadius).toBe(10);
      expect(driverService.findAvailableDrivers).toHaveBeenCalledTimes(2);
    });

    it('should throw error if no drivers available within max radius', async () => {
      const restaurantLat = 12.9716;
      const restaurantLng = 77.5946;

      driverService.findAvailableDrivers.mockResolvedValue([]);

      await expect(service.findAndAssignDriver(restaurantLat, restaurantLng)).rejects.toThrow(
        CustomHttpException,
      );
    });

    it('should skip locked driver and try next one', async () => {
      const restaurantLat = 12.9716;
      const restaurantLng = 77.5946;

      const driver2 = { ...mockDriver, id: 'driver-2' };

      driverService.findAvailableDrivers.mockResolvedValue([mockDriver, driver2]);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValueOnce(null) // First driver locked
          .mockResolvedValueOnce(driver2), // Second driver available
      };

      driverRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      driverService.setDriverBusy.mockResolvedValue(undefined);

      const result = await service.findAndAssignDriver(restaurantLat, restaurantLng);

      expect(result).toBeDefined();
      expect(result.driver.id).toBe('driver-2');
      expect(driverService.setDriverBusy).toHaveBeenCalledWith('driver-2');
    });
  });

  describe('estimateDeliveryDuration', () => {
    it('should estimate duration correctly for short distance', () => {
      const distance = 2; // 2 km
      const duration = service.estimateDeliveryDuration(distance);

      // 2km at 20km/h = 6 mins + 10 mins (pickup + dropoff) = 16 mins
      expect(duration).toBe(16);
    });

    it('should estimate duration correctly for long distance', () => {
      const distance = 10; // 10 km
      const duration = service.estimateDeliveryDuration(distance);

      // 10km at 20km/h = 30 mins + 10 mins = 40 mins
      expect(duration).toBe(40);
    });

    it('should round up duration', () => {
      const distance = 1.5; // 1.5 km
      const duration = service.estimateDeliveryDuration(distance);

      // 1.5km at 20km/h = 4.5 mins + 10 mins = 14.5 mins -> 15 mins
      expect(duration).toBe(15);
    });
  });

  describe('distance calculation', () => {
    it('should calculate distance between two points correctly', () => {
      const lat1 = 12.9716;
      const lon1 = 77.5946;
      const lat2 = 12.9816;
      const lon2 = 77.6046;

      // Call private method via reflection
      const distance = (service as any).calculateDistance(lat1, lon1, lat2, lon2);

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(2); // Should be ~1.5 km
    });

    it('should return 0 for same coordinates', () => {
      const lat = 12.9716;
      const lon = 77.5946;

      const distance = (service as any).calculateDistance(lat, lon, lat, lon);

      expect(distance).toBe(0);
    });
  });
});
