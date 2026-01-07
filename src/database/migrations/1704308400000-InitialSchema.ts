import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1704308400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable PostGIS extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS cube`);

    // Create ENUM types
    await queryRunner.query(`
      CREATE TYPE user_role_enum AS ENUM ('CUSTOMER', 'RESTAURANT', 'DRIVER', 'ADMIN')
    `);

    await queryRunner.query(`
      CREATE TYPE restaurant_status_enum AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'CLOSED')
    `);

    await queryRunner.query(`
      CREATE TYPE approval_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED')
    `);

    await queryRunner.query(`
      CREATE TYPE order_status_enum AS ENUM (
        'PENDING', 'RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP',
        'DRIVER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'FAILED'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE payment_method_enum AS ENUM ('CARD', 'UPI', 'WALLET', 'COD')
    `);

    await queryRunner.query(`
      CREATE TYPE payment_status_enum AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED')
    `);

    await queryRunner.query(`
      CREATE TYPE vehicle_type_enum AS ENUM ('BIKE', 'SCOOTER', 'CAR')
    `);

    await queryRunner.query(`
      CREATE TYPE delivery_status_enum AS ENUM (
        'ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_RESTAURANT', 'PICKED_UP',
        'IN_TRANSIT', 'ARRIVED_AT_CUSTOMER', 'DELIVERED', 'FAILED'
      )
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL UNIQUE,
        role user_role_enum NOT NULL DEFAULT 'CUSTOMER',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "lastLoginAt" TIMESTAMP NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_users_email ON users(email)`);
    await queryRunner.query(`CREATE INDEX idx_users_phone ON users(phone)`);

    // Create addresses table
    await queryRunner.query(`
      CREATE TABLE addresses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        label VARCHAR(50) NOT NULL,
        street TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NULL,
        "postalCode" VARCHAR(20) NULL,
        latitude DECIMAL(10, 7) NOT NULL,
        longitude DECIMAL(10, 7) NOT NULL,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT fk_addresses_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_addresses_user_id ON addresses("userId")`);

    // Create restaurants table
    await queryRunner.query(`
      CREATE TABLE restaurants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "ownerId" UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        phone VARCHAR(20) NOT NULL UNIQUE,
        email VARCHAR(255) NULL,
        address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NULL,
        "postalCode" VARCHAR(20) NULL,
        latitude DECIMAL(10, 7) NOT NULL,
        longitude DECIMAL(10, 7) NOT NULL,
        "cuisineType" VARCHAR(100) NULL,
        rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
        "totalReviews" INTEGER NOT NULL DEFAULT 0,
        "isOpen" BOOLEAN NOT NULL DEFAULT false,
        status restaurant_status_enum NOT NULL DEFAULT 'PENDING',
        "approvalStatus" approval_status_enum NOT NULL DEFAULT 'PENDING',
        "approvalNotes" TEXT NULL,
        "approvedAt" TIMESTAMP NULL,
        "openingTime" VARCHAR(10) NOT NULL DEFAULT '09:00',
        "closingTime" VARCHAR(10) NOT NULL DEFAULT '22:00',
        "averagePreparationTimeMins" INTEGER NOT NULL DEFAULT 30,
        "imageUrl" VARCHAR(500) NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT fk_restaurants_owner FOREIGN KEY ("ownerId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_restaurants_status_open ON restaurants(status, "isOpen")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_restaurants_location ON restaurants(latitude, longitude)`,
    );

    // Create menu_items table
    await queryRunner.query(`
      CREATE TABLE menu_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "restaurantId" UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        price DECIMAL(10, 2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        "isAvailable" BOOLEAN NOT NULL DEFAULT true,
        "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
        "isVegan" BOOLEAN NOT NULL DEFAULT false,
        "imageUrl" VARCHAR(500) NULL,
        "preparationTimeMins" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT fk_menu_items_restaurant FOREIGN KEY ("restaurantId") REFERENCES restaurants(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_menu_items_restaurant_available ON menu_items("restaurantId", "isAvailable")`,
    );
    await queryRunner.query(`CREATE INDEX idx_menu_items_category ON menu_items(category)`);

    // Create orders table
    await queryRunner.query(`
      CREATE TABLE orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderNumber" VARCHAR(50) NOT NULL UNIQUE,
        "userId" UUID NOT NULL,
        "restaurantId" UUID NOT NULL,
        "deliveryAddressId" UUID NOT NULL,
        status order_status_enum NOT NULL DEFAULT 'PENDING',
        subtotal DECIMAL(10, 2) NOT NULL,
        "deliveryFee" DECIMAL(10, 2) NOT NULL,
        tax DECIMAL(10, 2) NOT NULL,
        discount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        total DECIMAL(10, 2) NOT NULL,
        "promoCode" VARCHAR(50) NULL,
        "estimatedDeliveryTimeMins" INTEGER NULL,
        "preparationTimeMins" INTEGER NULL,
        "specialInstructions" TEXT NULL,
        "acceptedAt" TIMESTAMP NULL,
        "readyAt" TIMESTAMP NULL,
        "pickedUpAt" TIMESTAMP NULL,
        "deliveredAt" TIMESTAMP NULL,
        "cancelledAt" TIMESTAMP NULL,
        "cancellationReason" TEXT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT fk_orders_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_orders_restaurant FOREIGN KEY ("restaurantId") REFERENCES restaurants(id),
        CONSTRAINT fk_orders_address FOREIGN KEY ("deliveryAddressId") REFERENCES addresses(id)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_orders_user_id ON orders("userId")`);
    await queryRunner.query(`CREATE INDEX idx_orders_restaurant_id ON orders("restaurantId")`);
    await queryRunner.query(`CREATE INDEX idx_orders_status ON orders(status)`);
    await queryRunner.query(`CREATE INDEX idx_orders_order_number ON orders("orderNumber")`);
    await queryRunner.query(`CREATE INDEX idx_orders_created_at ON orders("createdAt")`);

    // Create order_items table
    await queryRunner.query(`
      CREATE TABLE order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderId" UUID NOT NULL,
        "menuItemId" UUID NOT NULL,
        "itemName" VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        "specialInstructions" TEXT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT fk_order_items_order FOREIGN KEY ("orderId") REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_order_items_menu_item FOREIGN KEY ("menuItemId") REFERENCES menu_items(id)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_order_items_order_id ON order_items("orderId")`);

    // Create order_status_history table
    await queryRunner.query(`
      CREATE TABLE order_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderId" UUID NOT NULL,
        status order_status_enum NOT NULL,
        notes TEXT NULL,
        "changedBy" UUID NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT fk_order_status_history_order FOREIGN KEY ("orderId") REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_order_status_history_order_id ON order_status_history("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_order_status_history_created_at ON order_status_history("createdAt")`,
    );

    // Create payments table
    await queryRunner.query(`
      CREATE TABLE payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderId" UUID NOT NULL UNIQUE,
        "paymentMethod" payment_method_enum NOT NULL,
        status payment_status_enum NOT NULL DEFAULT 'PENDING',
        amount DECIMAL(10, 2) NOT NULL,
        "transactionId" VARCHAR(100) NULL UNIQUE,
        "failureReason" TEXT NULL,
        "retryCount" INTEGER NOT NULL DEFAULT 0,
        "processedAt" TIMESTAMP NULL,
        "refundedAt" TIMESTAMP NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT fk_payments_order FOREIGN KEY ("orderId") REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_payments_order_id ON payments("orderId")`);
    await queryRunner.query(`CREATE INDEX idx_payments_status ON payments(status)`);
    await queryRunner.query(
      `CREATE INDEX idx_payments_transaction_id ON payments("transactionId")`,
    );

    // Create drivers table
    await queryRunner.query(`
      CREATE TABLE drivers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL UNIQUE,
        "licenseNumber" VARCHAR(50) NOT NULL UNIQUE,
        "vehicleType" vehicle_type_enum NOT NULL,
        "vehicleNumber" VARCHAR(50) NOT NULL,
        "vehicleModel" VARCHAR(100) NULL,
        "isOnline" BOOLEAN NOT NULL DEFAULT false,
        "isAvailable" BOOLEAN NOT NULL DEFAULT true,
        "approvalStatus" approval_status_enum NOT NULL DEFAULT 'PENDING',
        "approvalNotes" TEXT NULL,
        "approvedAt" TIMESTAMP NULL,
        "currentLatitude" DECIMAL(10, 7) NULL,
        "currentLongitude" DECIMAL(10, 7) NULL,
        "lastLocationUpdate" TIMESTAMP NULL,
        "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
        rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
        "totalRatings" INTEGER NOT NULL DEFAULT 0,
        "totalEarnings" DECIMAL(10, 2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT fk_drivers_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_drivers_user_id ON drivers("userId")`);
    await queryRunner.query(
      `CREATE INDEX idx_drivers_online_available ON drivers("isOnline", "isAvailable")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_drivers_location ON drivers("currentLatitude", "currentLongitude")`,
    );

    // Create deliveries table
    await queryRunner.query(`
      CREATE TABLE deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderId" UUID NOT NULL UNIQUE,
        "driverId" UUID NOT NULL,
        status delivery_status_enum NOT NULL DEFAULT 'ASSIGNED',
        "pickupLatitude" DECIMAL(10, 7) NOT NULL,
        "pickupLongitude" DECIMAL(10, 7) NOT NULL,
        "deliveryLatitude" DECIMAL(10, 7) NOT NULL,
        "deliveryLongitude" DECIMAL(10, 7) NOT NULL,
        "distanceKm" DECIMAL(6, 2) NULL,
        "estimatedDurationMins" INTEGER NULL,
        "driverEarnings" DECIMAL(10, 2) NOT NULL,
        "acceptedAt" TIMESTAMP NULL,
        "arrivedAtRestaurantAt" TIMESTAMP NULL,
        "pickedUpAt" TIMESTAMP NULL,
        "arrivedAtCustomerAt" TIMESTAMP NULL,
        "deliveredAt" TIMESTAMP NULL,
        "failureReason" TEXT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT fk_deliveries_order FOREIGN KEY ("orderId") REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_deliveries_driver FOREIGN KEY ("driverId") REFERENCES drivers(id)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_deliveries_order_id ON deliveries("orderId")`);
    await queryRunner.query(`CREATE INDEX idx_deliveries_driver_id ON deliveries("driverId")`);
    await queryRunner.query(`CREATE INDEX idx_deliveries_status ON deliveries(status)`);

    // Create driver_locations table (time-series data)
    await queryRunner.query(`
      CREATE TABLE driver_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "driverId" UUID NOT NULL,
        latitude DECIMAL(10, 7) NOT NULL,
        longitude DECIMAL(10, 7) NOT NULL,
        accuracy DECIMAL(6, 2) NULL,
        heading DECIMAL(6, 2) NULL,
        speed DECIMAL(6, 2) NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT fk_driver_locations_driver FOREIGN KEY ("driverId") REFERENCES drivers(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_driver_locations_driver_timestamp ON driver_locations("driverId", timestamp)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_driver_locations_timestamp ON driver_locations(timestamp)`,
    );

    // Create sessions table
    await queryRunner.query(`
      CREATE TABLE sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "tokenHash" VARCHAR(255) NOT NULL UNIQUE,
        "expiresAt" TIMESTAMP NOT NULL,
        "ipAddress" VARCHAR(100) NULL,
        "userAgent" TEXT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT fk_sessions_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_sessions_user_id ON sessions("userId")`);
    await queryRunner.query(`CREATE INDEX idx_sessions_token_hash ON sessions("tokenHash")`);
    await queryRunner.query(`CREATE INDEX idx_sessions_expires_at ON sessions("expiresAt")`);

    // Create notifications table
    await queryRunner.query(`
      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        data JSONB NULL,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "readAt" TIMESTAMP NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT fk_notifications_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_notifications_user_read ON notifications("userId", "isRead")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_notifications_created_at ON notifications("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS notifications CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS sessions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS driver_locations CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS deliveries CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS drivers CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS payments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS order_status_history CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS order_items CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS orders CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS menu_items CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS restaurants CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS addresses CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS users CASCADE`);

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE IF EXISTS delivery_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS vehicle_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS payment_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS payment_method_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS order_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS approval_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS restaurant_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role_enum`);

    // Drop extensions
    await queryRunner.query(`DROP EXTENSION IF EXISTS earthdistance CASCADE`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS cube`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS postgis`);
  }
}
