import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DeliveryStatus } from '../../../common/constants';
import { Order } from '../../order/entities/order.entity';
import { Driver } from '../../driver/entities/driver.entity';

@Entity('deliveries')
@Index(['orderId'], { unique: true })
@Index(['driverId'])
@Index(['status'])
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  orderId: string;

  @Column({ type: 'uuid' })
  driverId: string;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.ASSIGNED,
  })
  status: DeliveryStatus;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  pickupLatitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  pickupLongitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  deliveryLatitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  deliveryLongitude: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  distanceKm: number;

  @Column({ type: 'int', nullable: true })
  estimatedDurationMins: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  driverEarnings: number;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  arrivedAtRestaurantAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  pickedUpAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  arrivedAtCustomerAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => Driver)
  @JoinColumn({ name: 'driverId' })
  driver: Driver;
}
