import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DriverLocation } from '../entities/driver-location.entity';

interface LocationEvent {
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
}

@Injectable()
export class LocationBufferService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LocationBufferService.name);
  private readonly buffer: LocationEvent[] = [];
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 1000; // 1 second
  private flushTimer: NodeJS.Timeout;

  constructor(
    @InjectRepository(DriverLocation)
    private readonly locationRepository: Repository<DriverLocation>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.logger.log('Starting location buffer service...');
    this.startFlushTimer();
  }

  onModuleDestroy() {
    this.logger.log('Stopping location buffer service...');
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Flush remaining buffer on shutdown
    this.flushBuffer();
  }

  /**
   * Add location event to buffer
   * Triggers immediate broadcast via EventEmitter
   */
  addLocation(event: LocationEvent): void {
    this.buffer.push(event);

    // Emit real-time location update event
    this.eventEmitter.emit('location.updated', {
      driverId: event.driverId,
      latitude: event.latitude,
      longitude: event.longitude,
      accuracy: event.accuracy,
      heading: event.heading,
      speed: event.speed,
      timestamp: event.timestamp,
    });

    this.logger.debug(
      `Location buffered for driver ${event.driverId}. Buffer size: ${this.buffer.length}`,
    );

    // Flush if buffer is full
    if (this.buffer.length >= this.BATCH_SIZE) {
      this.logger.log(`Buffer full (${this.BATCH_SIZE}), flushing...`);
      this.flushBuffer();
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.logger.log(`Periodic flush triggered. Buffer size: ${this.buffer.length}`);
        this.flushBuffer();
      }
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Flush buffer to database
   * Batch insert all pending location events
   */
  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const eventsToFlush = this.buffer.splice(0, this.buffer.length);
    this.logger.log(`Flushing ${eventsToFlush.length} location events to database...`);

    try {
      const locations = eventsToFlush.map((event) =>
        this.locationRepository.create({
          driverId: event.driverId,
          latitude: event.latitude,
          longitude: event.longitude,
          accuracy: event.accuracy,
          heading: event.heading,
          speed: event.speed,
          timestamp: event.timestamp,
        }),
      );

      await this.locationRepository.save(locations);

      this.logger.log(`Successfully flushed ${locations.length} location events`);
    } catch (error) {
      this.logger.error(`Failed to flush location buffer:`, error.message);
      // Re-add events to buffer on failure
      this.buffer.unshift(...eventsToFlush);
    }
  }

  /**
   * Get buffer statistics
   */
  getStats(): { bufferSize: number; batchSize: number; flushInterval: number } {
    return {
      bufferSize: this.buffer.length,
      batchSize: this.BATCH_SIZE,
      flushInterval: this.FLUSH_INTERVAL_MS,
    };
  }

  /**
   * Force flush buffer (for testing or manual trigger)
   */
  async forceFlush(): Promise<void> {
    await this.flushBuffer();
  }
}
