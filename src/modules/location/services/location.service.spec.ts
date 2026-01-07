import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationService } from './location.service';
import { LocationBufferService } from './location-buffer.service';
import { DriverLocation } from '../entities/driver-location.entity';
import { Driver } from '../../driver/entities/driver.entity';
import { CustomHttpException } from '../../../common/exceptions';

describe('LocationService', () => {
  let service: LocationService;
  let locationRepository: jest.Mocked<Repository<DriverLocation>>;
  let driverRepository: jest.Mocked<Repository<Driver>>;
  let locationBuffer: jest.Mocked<LocationBufferService>;

  const mockDriver = {
    id: 'driver-uuid',
    userId: 'user-uuid',
    currentLatitude: 12.9716,
    currentLongitude: 77.5946,
    lastLocationUpdate: new Date(),
  } as Driver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        {
          provide: getRepositoryToken(DriverLocation),
          useValue: {
            find: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Driver),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: LocationBufferService,
          useValue: {
            addLocation: jest.fn(),
            getStats: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LocationService>(LocationService);
    locationRepository = module.get(getRepositoryToken(DriverLocation));
    driverRepository = module.get(getRepositoryToken(Driver));
    locationBuffer = module.get(LocationBufferService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateDriverLocation', () => {
    it('should update driver location successfully', async () => {
      const locationDto = {
        latitude: 12.9816,
        longitude: 77.6046,
        accuracy: 10,
        heading: 180,
        speed: 25,
      };

      driverRepository.findOne.mockResolvedValue(mockDriver);
      driverRepository.update.mockResolvedValue({ affected: 1 } as any);
      locationBuffer.addLocation.mockReturnValue(undefined);

      await service.updateDriverLocation('driver-uuid', locationDto);

      expect(driverRepository.update).toHaveBeenCalledWith('driver-uuid', {
        currentLatitude: locationDto.latitude,
        currentLongitude: locationDto.longitude,
        lastLocationUpdate: expect.any(Date),
      });

      expect(locationBuffer.addLocation).toHaveBeenCalledWith({
        driverId: 'driver-uuid',
        latitude: locationDto.latitude,
        longitude: locationDto.longitude,
        accuracy: locationDto.accuracy,
        heading: locationDto.heading,
        speed: locationDto.speed,
        timestamp: expect.any(Date),
      });
    });

    it('should throw error if driver not found', async () => {
      const locationDto = {
        latitude: 12.9816,
        longitude: 77.6046,
      };

      driverRepository.findOne.mockResolvedValue(null);

      await expect(service.updateDriverLocation('invalid-uuid', locationDto)).rejects.toThrow(
        CustomHttpException,
      );
    });
  });

  describe('getDriverLocationHistory', () => {
    it('should return location history for driver', async () => {
      const mockLocations = [
        {
          id: 'loc-1',
          driverId: 'driver-uuid',
          latitude: 12.9716,
          longitude: 77.5946,
          timestamp: new Date(),
        },
        {
          id: 'loc-2',
          driverId: 'driver-uuid',
          latitude: 12.9816,
          longitude: 77.6046,
          timestamp: new Date(),
        },
      ] as DriverLocation[];

      locationRepository.find.mockResolvedValue(mockLocations);

      const result = await service.getDriverLocationHistory('driver-uuid', 100);

      expect(result).toEqual(mockLocations);
      expect(locationRepository.find).toHaveBeenCalledWith({
        where: { driverId: 'driver-uuid' },
        order: { timestamp: 'DESC' },
        take: 100,
      });
    });

    it('should use default limit if not provided', async () => {
      locationRepository.find.mockResolvedValue([]);

      await service.getDriverLocationHistory('driver-uuid');

      expect(locationRepository.find).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });
  });

  describe('getDriverCurrentLocation', () => {
    it('should return current location for driver', async () => {
      driverRepository.findOne.mockResolvedValue(mockDriver);

      const result = await service.getDriverCurrentLocation('driver-uuid');

      expect(result).toEqual({
        latitude: Number(mockDriver.currentLatitude),
        longitude: Number(mockDriver.currentLongitude),
        lastUpdate: mockDriver.lastLocationUpdate,
      });
    });

    it('should return null if driver not found', async () => {
      driverRepository.findOne.mockResolvedValue(null);

      const result = await service.getDriverCurrentLocation('invalid-uuid');

      expect(result).toBeNull();
    });

    it('should return null if location not available', async () => {
      const driverWithoutLocation = {
        ...mockDriver,
        currentLatitude: null,
        currentLongitude: null,
      };

      driverRepository.findOne.mockResolvedValue(driverWithoutLocation as any);

      const result = await service.getDriverCurrentLocation('driver-uuid');

      expect(result).toBeNull();
    });
  });

  describe('getLocationHistoryByTimeRange', () => {
    it('should return location history within time range', async () => {
      const startTime = new Date('2026-01-01T00:00:00Z');
      const endTime = new Date('2026-01-02T00:00:00Z');

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      locationRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.getLocationHistoryByTimeRange('driver-uuid', startTime, endTime);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('location.driverId = :driverId', {
        driverId: 'driver-uuid',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('location.timestamp >= :startTime', {
        startTime,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('location.timestamp <= :endTime', {
        endTime,
      });
    });
  });

  describe('cleanupOldLocations', () => {
    it('should delete old location records', async () => {
      locationRepository.delete.mockResolvedValue({ affected: 100 } as any);

      await service.cleanupOldLocations();

      expect(locationRepository.delete).toHaveBeenCalledWith({
        timestamp: expect.any(Object),
      });
    });

    it('should handle cleanup errors gracefully', async () => {
      locationRepository.delete.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(service.cleanupOldLocations()).resolves.not.toThrow();
    });
  });

  describe('getBufferStats', () => {
    it('should return buffer statistics', () => {
      const mockStats = {
        bufferSize: 10,
        batchSize: 100,
        flushInterval: 1000,
      };

      locationBuffer.getStats.mockReturnValue(mockStats);

      const result = service.getBufferStats();

      expect(result).toEqual(mockStats);
    });
  });
});
