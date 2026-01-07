import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LocationBufferService } from './location-buffer.service';
import { DriverLocation } from '../entities/driver-location.entity';

describe('LocationBufferService', () => {
  let service: LocationBufferService;
  let locationRepository: jest.Mocked<Repository<DriverLocation>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationBufferService,
        {
          provide: getRepositoryToken(DriverLocation),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LocationBufferService>(LocationBufferService);
    locationRepository = module.get(getRepositoryToken(DriverLocation));
    eventEmitter = module.get(EventEmitter2);

    // Initialize the service
    service.onModuleInit();
  });

  afterEach(async () => {
    // Clean up
    await service.onModuleDestroy();
    jest.clearAllMocks();
  });

  describe('addLocation', () => {
    it('should add location to buffer and emit event', () => {
      const locationEvent = {
        driverId: 'driver-uuid',
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 10,
        heading: 180,
        speed: 25,
        timestamp: new Date(),
      };

      service.addLocation(locationEvent);

      const stats = service.getStats();
      expect(stats.bufferSize).toBe(1);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'location.updated',
        expect.objectContaining({
          driverId: locationEvent.driverId,
          latitude: locationEvent.latitude,
          longitude: locationEvent.longitude,
        }),
      );
    });

    it('should flush buffer when size reaches batch limit', async () => {
      locationRepository.create.mockImplementation((data) => data as DriverLocation);
      locationRepository.save.mockResolvedValue([] as any);

      // Add 100 locations to trigger auto-flush
      for (let i = 0; i < 100; i++) {
        service.addLocation({
          driverId: 'driver-uuid',
          latitude: 12.9716,
          longitude: 77.5946,
          timestamp: new Date(),
        });
      }

      // Wait for flush
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = service.getStats();
      expect(stats.bufferSize).toBe(0);
      expect(locationRepository.save).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return buffer statistics', () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty('bufferSize');
      expect(stats).toHaveProperty('batchSize');
      expect(stats).toHaveProperty('flushInterval');
      expect(stats.batchSize).toBe(100);
      expect(stats.flushInterval).toBe(1000);
    });
  });

  describe('forceFlush', () => {
    it('should flush buffer immediately', async () => {
      locationRepository.create.mockImplementation((data) => data as DriverLocation);
      locationRepository.save.mockResolvedValue([] as any);

      // Add some locations
      service.addLocation({
        driverId: 'driver-uuid',
        latitude: 12.9716,
        longitude: 77.5946,
        timestamp: new Date(),
      });

      await service.forceFlush();

      const stats = service.getStats();
      expect(stats.bufferSize).toBe(0);
      expect(locationRepository.save).toHaveBeenCalled();
    });
  });

  describe('periodic flush', () => {
    it('should flush buffer periodically', async () => {
      locationRepository.create.mockImplementation((data) => data as DriverLocation);
      locationRepository.save.mockResolvedValue([] as any);

      // Add a location
      service.addLocation({
        driverId: 'driver-uuid',
        latitude: 12.9716,
        longitude: 77.5946,
        timestamp: new Date(),
      });

      // Wait for periodic flush (1 second)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const stats = service.getStats();
      expect(stats.bufferSize).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      locationRepository.create.mockImplementation((data) => data as DriverLocation);
      locationRepository.save.mockRejectedValue(new Error('Database error'));

      // Add location
      service.addLocation({
        driverId: 'driver-uuid',
        latitude: 12.9716,
        longitude: 77.5946,
        timestamp: new Date(),
      });

      // Force flush
      await service.forceFlush();

      // Buffer should be restored on error
      const stats = service.getStats();
      expect(stats.bufferSize).toBe(1);
    });
  });
});
