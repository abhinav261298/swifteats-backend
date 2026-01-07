import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverService } from './driver.service';
import { Driver } from './entities/driver.entity';
import { User } from '../user/entities/user.entity';
import { CustomHttpException } from '../../common/exceptions';
import { VehicleType, ApprovalStatus, UserRole } from '../../common/constants';
import { CreateDriverDto, UpdateDriverDto, UpdateDriverLocationDto } from './dto';

describe('DriverService', () => {
  let service: DriverService;
  let driverRepository: jest.Mocked<Repository<Driver>>;
  let userRepository: jest.Mocked<Repository<User>>;

  const mockUser = {
    id: 'user-uuid',
    email: 'driver@test.com',
    role: UserRole.DRIVER,
  } as User;

  const mockDriver = {
    id: 'driver-uuid',
    userId: 'user-uuid',
    licenseNumber: 'DL-1234567890123',
    vehicleType: VehicleType.BIKE,
    vehicleNumber: 'KA-01-AB-1234',
    vehicleModel: 'Honda Activa',
    isOnline: false,
    isAvailable: true,
    approvalStatus: ApprovalStatus.APPROVED,
    currentLatitude: 12.9716,
    currentLongitude: 77.5946,
    totalDeliveries: 10,
    totalEarnings: 500,
    rating: 4.5,
    totalRatings: 10,
    user: mockUser,
  } as Driver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverService,
        {
          provide: getRepositoryToken(Driver),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DriverService>(DriverService);
    driverRepository = module.get(getRepositoryToken(Driver));
    userRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDriverProfile', () => {
    const createDriverDto: CreateDriverDto = {
      licenseNumber: 'DL-1234567890123',
      vehicleType: VehicleType.BIKE,
      vehicleNumber: 'KA-01-AB-1234',
      vehicleModel: 'Honda Activa',
    };

    it('should create driver profile successfully', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      driverRepository.findOne
        .mockResolvedValueOnce(null) // No existing driver
        .mockResolvedValueOnce(null) // No duplicate license
        .mockResolvedValueOnce(null) // No duplicate vehicle
        .mockResolvedValueOnce(mockDriver); // getDriverProfile call
      driverRepository.create.mockReturnValue(mockDriver);
      driverRepository.save.mockResolvedValue(mockDriver);

      const result = await service.createDriverProfile('user-uuid', createDriverDto);

      expect(result).toEqual(mockDriver);
      expect(driverRepository.create).toHaveBeenCalledWith({
        userId: 'user-uuid',
        ...createDriverDto,
        approvalStatus: ApprovalStatus.PENDING,
        isOnline: false,
        isAvailable: true,
        totalDeliveries: 0,
        totalEarnings: 0,
        rating: 0,
        totalRatings: 0,
      });
    });

    it('should throw error if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.createDriverProfile('user-uuid', createDriverDto)).rejects.toThrow(
        CustomHttpException,
      );
    });

    it('should throw error if driver profile already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      driverRepository.findOne.mockResolvedValue(mockDriver);

      await expect(service.createDriverProfile('user-uuid', createDriverDto)).rejects.toThrow(
        CustomHttpException,
      );
    });

    it('should throw error if license number already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      driverRepository.findOne
        .mockResolvedValueOnce(null) // No existing driver
        .mockResolvedValueOnce(mockDriver); // Duplicate license

      await expect(service.createDriverProfile('user-uuid', createDriverDto)).rejects.toThrow(
        CustomHttpException,
      );
    });

    it('should throw error if vehicle number already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      driverRepository.findOne
        .mockResolvedValueOnce(null) // No existing driver
        .mockResolvedValueOnce(null) // No duplicate license
        .mockResolvedValueOnce(mockDriver); // Duplicate vehicle

      await expect(service.createDriverProfile('user-uuid', createDriverDto)).rejects.toThrow(
        CustomHttpException,
      );
    });
  });

  describe('getDriverProfile', () => {
    it('should return driver profile', async () => {
      driverRepository.findOne.mockResolvedValue(mockDriver);

      const result = await service.getDriverProfile('user-uuid');

      expect(result).toEqual(mockDriver);
      expect(driverRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        relations: ['user'],
      });
    });

    it('should throw error when driver not found', async () => {
      driverRepository.findOne.mockResolvedValue(null);

      await expect(service.getDriverProfile('user-uuid')).rejects.toThrow(CustomHttpException);
    });
  });

  describe('updateDriverProfile', () => {
    const updateDriverDto: UpdateDriverDto = {
      vehicleModel: 'New Model',
    };

    it('should update driver profile successfully', async () => {
      driverRepository.findOne.mockResolvedValue(mockDriver);
      driverRepository.save.mockResolvedValue({
        ...mockDriver,
        ...updateDriverDto,
      });

      const result = await service.updateDriverProfile('user-uuid', updateDriverDto);

      expect(driverRepository.save).toHaveBeenCalled();
      expect(result.vehicleModel).toBe(updateDriverDto.vehicleModel);
    });

    it('should throw error if new license number already exists', async () => {
      const duplicateDriver = { ...mockDriver, id: 'other-driver-uuid' };
      driverRepository.findOne
        .mockResolvedValueOnce(mockDriver) // Get driver profile
        .mockResolvedValueOnce(duplicateDriver); // Duplicate license check

      await expect(
        service.updateDriverProfile('user-uuid', {
          licenseNumber: 'DL-9999999999999',
        }),
      ).rejects.toThrow(CustomHttpException);
    });

    it('should throw error if new vehicle number already exists', async () => {
      const duplicateDriver = { ...mockDriver, id: 'other-driver-uuid' };
      driverRepository.findOne
        .mockResolvedValueOnce(mockDriver) // Get driver profile
        .mockResolvedValueOnce(duplicateDriver); // Duplicate vehicle

      await expect(
        service.updateDriverProfile('user-uuid', {
          vehicleNumber: 'KA-01-XY-9999',
        }),
      ).rejects.toThrow(CustomHttpException);
    });
  });

  describe('updateDriverStatus', () => {
    it('should set driver online successfully', async () => {
      const onlineDriver = { ...mockDriver, isOnline: true, isAvailable: true };
      driverRepository.findOne.mockResolvedValue(mockDriver);
      driverRepository.save.mockResolvedValue(onlineDriver);

      const result = await service.updateDriverStatus('user-uuid', {
        isOnline: true,
      });

      expect(result.isOnline).toBe(true);
      expect(result.isAvailable).toBe(true);
    });

    it('should set driver offline successfully', async () => {
      const onlineDriver = { ...mockDriver, isOnline: true };
      const offlineDriver = { ...mockDriver, isOnline: false, isAvailable: true };

      driverRepository.findOne.mockResolvedValue(onlineDriver);
      driverRepository.save.mockResolvedValue(offlineDriver);

      const result = await service.updateDriverStatus('user-uuid', {
        isOnline: false,
      });

      expect(result.isOnline).toBe(false);
      expect(result.isAvailable).toBe(true);
    });

    it('should throw error if driver not approved', async () => {
      const pendingDriver = { ...mockDriver, approvalStatus: ApprovalStatus.PENDING };
      driverRepository.findOne.mockResolvedValue(pendingDriver);

      await expect(service.updateDriverStatus('user-uuid', { isOnline: true })).rejects.toThrow(
        CustomHttpException,
      );
    });
  });

  describe('updateDriverLocation', () => {
    const locationDto: UpdateDriverLocationDto = {
      latitude: 13.0827,
      longitude: 80.2707,
    };

    it('should update driver location successfully', async () => {
      driverRepository.findOne.mockResolvedValue(mockDriver);
      driverRepository.save.mockResolvedValue({
        ...mockDriver,
        currentLatitude: locationDto.latitude,
        currentLongitude: locationDto.longitude,
      });

      const result = await service.updateDriverLocation('user-uuid', locationDto);

      expect(result.currentLatitude).toBe(locationDto.latitude);
      expect(result.currentLongitude).toBe(locationDto.longitude);
      expect(driverRepository.save).toHaveBeenCalled();
    });
  });

  describe('setDriverBusy', () => {
    it('should set driver as busy', async () => {
      driverRepository.findOne.mockResolvedValue(mockDriver);
      driverRepository.save.mockResolvedValue({ ...mockDriver, isAvailable: false });

      await service.setDriverBusy('driver-uuid');

      expect(driverRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isAvailable: false }),
      );
    });

    it('should throw error if driver not found', async () => {
      driverRepository.findOne.mockResolvedValue(null);

      await expect(service.setDriverBusy('driver-uuid')).rejects.toThrow(CustomHttpException);
    });
  });

  describe('setDriverAvailable', () => {
    it('should set driver as available if online', async () => {
      const onlineDriver = { ...mockDriver, isOnline: true, isAvailable: false };
      driverRepository.findOne.mockResolvedValue(onlineDriver);
      driverRepository.save.mockResolvedValue({ ...onlineDriver, isAvailable: true });

      await service.setDriverAvailable('driver-uuid');

      expect(driverRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isAvailable: true }),
      );
    });

    it('should not set available if driver is offline', async () => {
      const offlineDriver = { ...mockDriver, isOnline: false };
      driverRepository.findOne.mockResolvedValue(offlineDriver);

      await service.setDriverAvailable('driver-uuid');

      expect(driverRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error if driver not found', async () => {
      driverRepository.findOne.mockResolvedValue(null);

      await expect(service.setDriverAvailable('driver-uuid')).rejects.toThrow(CustomHttpException);
    });
  });

  describe('updateDriverEarnings', () => {
    it('should update earnings with default amount', async () => {
      driverRepository.findOne.mockResolvedValue(mockDriver);
      driverRepository.save.mockResolvedValue({
        ...mockDriver,
        totalEarnings: 550,
        totalDeliveries: 11,
      });

      await service.updateDriverEarnings('driver-uuid');

      expect(driverRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          totalEarnings: 550,
          totalDeliveries: 11,
        }),
      );
    });

    it('should update earnings with custom amount', async () => {
      const freshDriver = {
        ...mockDriver,
        totalEarnings: 500,
        totalDeliveries: 10,
      };
      driverRepository.findOne.mockResolvedValue(freshDriver);
      driverRepository.save.mockResolvedValue({
        ...freshDriver,
        totalEarnings: 600,
        totalDeliveries: 11,
      } as Driver);

      await service.updateDriverEarnings('driver-uuid', 100);

      expect(driverRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          totalEarnings: 600,
          totalDeliveries: 11,
        }),
      );
    });

    it('should throw error if driver not found', async () => {
      driverRepository.findOne.mockResolvedValue(null);

      await expect(service.updateDriverEarnings('driver-uuid')).rejects.toThrow(
        CustomHttpException,
      );
    });
  });

  describe('getDriverEarnings', () => {
    it('should return driver earnings and statistics', async () => {
      const freshDriver = {
        ...mockDriver,
        totalEarnings: 500,
        totalDeliveries: 10,
      };
      driverRepository.findOne.mockResolvedValue(freshDriver);

      const result = await service.getDriverEarnings('user-uuid');

      expect(result).toEqual({
        totalEarnings: 500,
        totalDeliveries: 10,
        averagePerDelivery: 50,
        rating: 4.5,
        totalRatings: 10,
      });
    });

    it('should return zero average when no deliveries', async () => {
      const newDriver = { ...mockDriver, totalEarnings: 0, totalDeliveries: 0 };
      driverRepository.findOne.mockResolvedValue(newDriver);

      const result = await service.getDriverEarnings('user-uuid');

      expect(result.averagePerDelivery).toBe(0);
    });
  });

  describe('findAvailableDrivers', () => {
    it('should find available drivers within radius', async () => {
      const nearbyDriver = {
        ...mockDriver,
        currentLatitude: 12.9816, // ~1km from search location
        currentLongitude: 77.6046,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([nearbyDriver]),
      };

      driverRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAvailableDrivers(12.9716, 77.5946, 5);

      expect(result).toHaveLength(1);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should return empty array when no drivers found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      driverRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAvailableDrivers(12.9716, 77.5946, 5);

      expect(result).toHaveLength(0);
    });

    it('should filter drivers outside radius', async () => {
      const farDriver = {
        ...mockDriver,
        currentLatitude: 13.0827, // Chennai coordinates (far from Bangalore)
        currentLongitude: 80.2707,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([farDriver]),
      };

      driverRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAvailableDrivers(12.9716, 77.5946, 5);

      expect(result).toHaveLength(0); // Chennai is ~300km from Bangalore
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance correctly', () => {
      // Distance from Bangalore to Chennai
      const distance = (service as any).calculateDistance(12.9716, 77.5946, 13.0827, 80.2707);

      expect(distance).toBeGreaterThan(280); // ~290 km
      expect(distance).toBeLessThan(300);
    });

    it('should return 0 for same coordinates', () => {
      const distance = (service as any).calculateDistance(12.9716, 77.5946, 12.9716, 77.5946);

      expect(distance).toBe(0);
    });
  });
});
