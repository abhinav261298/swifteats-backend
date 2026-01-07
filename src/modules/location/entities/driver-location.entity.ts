import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Driver } from '../../driver/entities/driver.entity';

@Entity('driver_locations')
@Index(['driverId', 'timestamp'])
@Index(['timestamp'])
export class DriverLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  driverId: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  accuracy: number; // meters

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  heading: number; // degrees

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  speed: number; // km/h

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driverId' })
  driver: Driver;
}
