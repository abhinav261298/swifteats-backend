# Architecture Document
## SwiftEats - Real-Time Food Delivery Platform

**Version:** 1.0  
**Date:** January 3, 2026  
**Architecture Pattern:** Modular Monolith (PostgreSQL-Only Stack)

---

## 1. Executive Summary

SwiftEats is built as a **modular monolith** optimized for MVP deployment with only PostgreSQL as the external dependency. The architecture is designed to handle:
- **500 orders/minute** at peak load
- **2,000 GPS events/second** from 10,000 concurrent drivers
- **P99 < 200ms** response time for menu browsing
- **99.9% uptime** with graceful degradation

### Key Architectural Decisions

| Requirement | Solution | Justification |
|-------------|----------|---------------|
| **High-throughput caching** | NestJS Cache Manager (in-memory) + PostgreSQL Materialized Views | No Redis needed, sufficient for single-instance MVP |
| **GPS event streaming** | EventEmitter + Batch PostgreSQL Inserts | Real-time broadcast via WebSocket, persistent storage via batching |
| **Async order processing** | pg-boss (PostgreSQL-backed queue) | Reliable job queue without RabbitMQ/Kafka |
| **Real-time tracking** | Socket.io + EventEmitter | WebSocket for customer tracking, room-based broadcasting |
| **Rate limiting** | @nestjs/throttler (in-memory) | Simple, effective for single instance |
| **Session management** | PostgreSQL + in-memory cache | Persistent sessions with fast lookups |

---

## 2. System Architecture Overview

### 2.1 High-Level Architecture Diagram

```
                    ┌─────────────────────────────────────┐
                    │       Client Applications            │
                    │  (Customer, Restaurant, Driver Apps) │
                    └────────────┬────────────────────────┘
                                 │ HTTPS/WSS
                    ┌────────────┴────────────────────────┐
                    │         API Gateway Layer            │
                    │  • Rate Limiting (@nestjs/throttler) │
                    │  • CORS Handling                     │
                    │  • Request Logging                   │
                    └────────────┬────────────────────────┘
                                 │
┌────────────────────────────────┴────────────────────────────────────────┐
│                        NestJS Application Server                         │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    In-Memory Cache Layer                          │  │
│  │  • Restaurants & Menus (5 min TTL)                               │  │
│  │  • User Sessions (5 min TTL)                                     │  │
│  │  • Active Drivers List (1 min TTL)                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─────────────┬─────────────┬─────────────┬──────────────────────┐    │
│  │   Auth      │    User     │ Restaurant  │       Order          │    │
│  │  Module     │   Module    │   Module    │      Module          │    │
│  │             │             │             │                      │    │
│  │ • JWT Auth  │ • CRUD      │ • Profile   │ • State Machine     │    │
│  │ • Sessions  │ • Addresses │ • Menus     │ • pg-boss Workers   │    │
│  │ • Guards    │ • Roles     │ • Status    │ • Payment (Mock)    │    │
│  └─────────────┴─────────────┴─────────────┴──────────────────────┘    │
│                                                                          │
│  ┌─────────────┬─────────────┬─────────────┬──────────────────────┐    │
│  │   Driver    │  Delivery   │  Location   │    Notification      │    │
│  │  Module     │   Module    │   Module    │      Module          │    │
│  │             │             │             │                      │    │
│  │ • Profile   │ • Assignment│ • GPS       │ • In-app Events     │    │
│  │ • Status    │ • Tracking  │ • Buffer    │ • Event Driven      │    │
│  │ • Earnings  │ • History   │ • Broadcast │ • User Subscriptions│    │
│  └─────────────┴─────────────┴─────────────┴──────────────────────┘    │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Real-Time System Layer                         │  │
│  │  ┌──────────────────┐          ┌──────────────────────────────┐  │  │
│  │  │  EventEmitter    │  ──────> │  WebSocket Gateway           │  │  │
│  │  │  (GPS Stream)    │          │  (Socket.io)                 │  │  │
│  │  │  • Buffer events │          │  • Room Management           │  │  │
│  │  │  • Batch write   │          │  • Live Location Broadcast   │  │  │
│  │  └──────────────────┘          └──────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Background Job System (pg-boss)                │  │
│  │  • Order Processing Workflow                                     │  │
│  │  • Driver Assignment (Nearest Algorithm)                         │  │
│  │  • Payment Processing (Mock)                                     │  │
│  │  • Notification Dispatch                                         │  │
│  │  • Batch GPS Data Persistence                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────┬───────────────────────────────────────────────────────────┘
               │
               │ TypeORM (Connection Pool: max 50)
               │
┌──────────────┴───────────────────────────────────────────────────────────┐
│                          PostgreSQL 16 with PostGIS                       │
│  ┌──────────────────────┬──────────────────────┬──────────────────────┐  │
│  │  Core Tables         │  pg-boss Tables      │  Materialized Views  │  │
│  │  • users             │  • job                │  • restaurant_menu_  │  │
│  │  • restaurants       │  • archive            │    cache             │  │
│  │  • menu_items        │  • schedule           │  • active_drivers_   │  │
│  │  • orders            │                       │    cache             │  │
│  │  • drivers           │                       │                      │  │
│  │  • deliveries        │                       │                      │  │
│  │  • driver_locations  │                       │                      │  │
│  │  • payments          │                       │                      │  │
│  │  • sessions          │                       │                      │  │
│  │  • notifications     │                       │                      │  │
│  └──────────────────────┴──────────────────────┴──────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                      Indexes & Optimizations                        │  │
│  │  • GiST indexes for geospatial queries (PostGIS)                  │  │
│  │  • B-tree indexes on foreign keys and status columns             │  │
│  │  • Partial indexes for active/available entities                 │  │
│  │  • Connection pooling (50 connections)                           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Architecture

### 3.1 Module Structure

```
src/
├── modules/
│   ├── auth/                    # Authentication & Authorization
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── dto/
│   │
│   ├── user/                    # User Management (All Roles)
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── entities/
│   │   │   ├── user.entity.ts
│   │   │   └── address.entity.ts
│   │   └── dto/
│   │
│   ├── restaurant/              # Restaurant Operations
│   │   ├── restaurant.controller.ts
│   │   ├── restaurant.service.ts
│   │   ├── menu.controller.ts
│   │   ├── menu.service.ts
│   │   ├── entities/
│   │   │   ├── restaurant.entity.ts
│   │   │   └── menu-item.entity.ts
│   │   └── dto/
│   │
│   ├── order/                   # Order Management
│   │   ├── order.controller.ts
│   │   ├── order.service.ts
│   │   ├── order-state.service.ts  # State machine
│   │   ├── entities/
│   │   │   ├── order.entity.ts
│   │   │   └── order-item.entity.ts
│   │   └── dto/
│   │
│   ├── payment/                 # Mock Payment Service
│   │   ├── payment.service.ts
│   │   ├── entities/
│   │   │   └── payment.entity.ts
│   │   └── dto/
│   │
│   ├── driver/                  # Driver Operations
│   │   ├── driver.controller.ts
│   │   ├── driver.service.ts
│   │   ├── entities/
│   │   │   └── driver.entity.ts
│   │   └── dto/
│   │
│   ├── delivery/                # Delivery Management
│   │   ├── delivery.controller.ts
│   │   ├── delivery.service.ts
│   │   ├── driver-assignment.service.ts
│   │   ├── entities/
│   │   │   └── delivery.entity.ts
│   │   └── dto/
│   │
│   ├── location/                # GPS Tracking
│   │   ├── location.controller.ts
│   │   ├── location.service.ts
│   │   ├── location-buffer.service.ts
│   │   ├── location.gateway.ts     # WebSocket
│   │   ├── entities/
│   │   │   └── driver-location.entity.ts
│   │   └── dto/
│   │
│   ├── notification/            # Notifications
│   │   ├── notification.controller.ts
│   │   ├── notification.service.ts
│   │   ├── entities/
│   │   │   └── notification.entity.ts
│   │   └── dto/
│   │
│   ├── admin/                   # Admin Operations
│   │   ├── admin.controller.ts
│   │   ├── admin.service.ts
│   │   └── dto/
│   │
│   └── jobs/                    # Background Jobs (pg-boss)
│       ├── jobs.module.ts
│       ├── jobs.service.ts
│       └── workers/
│           ├── order-processing.worker.ts
│           ├── driver-assignment.worker.ts
│           ├── payment-processing.worker.ts
│           ├── notification.worker.ts
│           └── location-batch.worker.ts
│
├── common/                      # Shared Code
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── current-user.decorator.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── guards/
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   └── transform.interceptor.ts
│   ├── pipes/
│   │   └── validation.pipe.ts
│   ├── exceptions/
│   │   └── custom-exceptions.ts
│   ├── constants/
│   │   ├── order-status.enum.ts
│   │   └── user-roles.enum.ts
│   └── utils/
│       ├── distance.util.ts
│       └── date.util.ts
│
├── config/                      # Configuration
│   ├── database.config.ts
│   ├── jwt.config.ts
│   ├── cache.config.ts
│   └── app.config.ts
│
├── database/                    # Database Setup
│   ├── migrations/
│   └── seeds/
│
└── main.ts                      # Application Entry Point
```

---

## 4. Data Flow Diagrams

### 4.1 Order Placement Flow

```
Customer App
    │
    ├─ POST /api/v1/orders
    ↓
┌───────────────────────────────────────┐
│     Order Controller                  │
│  • Validate order data (DTO)         │
│  • Check restaurant availability     │
│  • Calculate totals                  │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│     Order Service                     │
│  • Create order (PENDING status)     │
│  • Save to PostgreSQL                │
│  • Emit 'order.created' job          │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│     pg-boss: order.created            │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│  Payment Worker                       │
│  • Process mock payment               │
│  • Update payment status              │
│  • Emit 'order.payment.success'      │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│  pg-boss: order.payment.success       │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│  Notification Worker                  │
│  • Notify restaurant (in-app)        │
│  • Update order status                │
└───────────────────────────────────────┘
```

### 4.2 Restaurant Accepts Order Flow

```
Restaurant App
    │
    ├─ PATCH /api/v1/restaurant/orders/:id/accept
    ↓
┌───────────────────────────────────────┐
│  Restaurant Controller                │
│  • Validate acceptance                │
│  • Check deadline (15 mins)          │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│  Order Service                        │
│  • Update order status:               │
│    RESTAURANT_ACCEPTED                │
│  • Set prep time                      │
│  • Emit 'driver.assignment' job      │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│  pg-boss: driver.assignment           │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│  Driver Assignment Worker             │
│  • Find nearest available driver      │
│    (PostGIS query)                    │
│  • Create delivery record             │
│  • Mark driver unavailable            │
│  • Update order status:               │
│    DRIVER_ASSIGNED                    │
│  • Emit 'driver.notify' job          │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│  Notification Worker                  │
│  • Notify driver (in-app)            │
│  • Notify customer (driver assigned) │
└───────────────────────────────────────┘
```

### 4.3 Real-Time GPS Tracking Flow

```
Driver App (sends location every 5 seconds)
    │
    ├─ POST /api/v1/driver/location
    ↓
┌───────────────────────────────────────┐
│  Location Controller                  │
│  • Validate GPS data                  │
│  • Check driver authentication        │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│  Location Service                     │
│  • Update driver current location     │
│    (PostgreSQL)                       │
│  • Add to in-memory buffer            │
│  • Emit 'location.update' event      │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│  EventEmitter                         │
└───┬────────────────────────┬──────────┘
    ↓                        ↓
┌───────────────┐    ┌──────────────────────┐
│ WebSocket     │    │ Location Buffer      │
│ Gateway       │    │ Service              │
│               │    │                      │
│ • Get orderId │    │ • Buffer in memory   │
│   for driver  │    │ • Batch insert to    │
│ • Broadcast   │    │   driver_locations   │
│   to room     │    │   table every 1 sec  │
│   'order:xyz' │    │   or 100 events      │
└───────────────┘    └──────────────────────┘
    ↓
Customer App (receives real-time updates via WebSocket)
```

---

## 5. Technology Stack Details

### 5.1 Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20.x LTS | Runtime environment |
| **TypeScript** | 5.x | Type-safe development |
| **NestJS** | 10.x | Application framework |
| **PostgreSQL** | 16.x | Primary database |
| **PostGIS** | 3.4 | Geospatial queries |
| **TypeORM** | 0.3.x | ORM and migrations |
| **pg-boss** | 9.x | PostgreSQL-backed job queue |
| **Socket.io** | 4.x | WebSocket server |
| **class-validator** | 0.14.x | DTO validation |
| **@nestjs/cache-manager** | 2.x | In-memory caching |
| **@nestjs/throttler** | 5.x | Rate limiting |
| **Winston** | 3.x | Structured logging |
| **Jest** | 29.x | Testing framework |
| **Swagger** | 7.x | API documentation |

### 5.2 NPM Dependencies

```json
{
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/typeorm": "^10.0.1",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/websockets": "^10.3.0",
    "@nestjs/platform-socket.io": "^10.3.0",
    "@nestjs/cache-manager": "^2.1.1",
    "@nestjs/throttler": "^5.1.1",
    "@nestjs/swagger": "^7.1.17",
    "typeorm": "^0.3.19",
    "pg": "^8.11.3",
    "pg-boss": "^9.0.3",
    "cache-manager": "^5.3.2",
    "socket.io": "^4.6.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "bcrypt": "^5.1.1",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/schematics": "^10.1.0",
    "@nestjs/testing": "^10.3.0",
    "@types/node": "^20.10.0",
    "@types/jest": "^29.5.11",
    "@types/bcrypt": "^5.0.2",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}
```

---

## 6. Performance Optimizations

### 6.1 Caching Strategy

**Layer 1: In-Memory Cache (NestJS Cache Manager)**
```typescript
// Cache configuration
CacheModule.register({
  ttl: 300,           // 5 minutes default
  max: 1000,          // Max 1000 items
  isGlobal: true
})

// Usage
@UseInterceptors(CacheInterceptor)
@Get('restaurants/:id/menu')
async getMenu(@Param('id') id: string) {
  // Cached for 5 minutes
}
```

**Cache Keys:**
- `restaurant:${id}` - Restaurant details (10 min TTL)
- `menu:${restaurantId}` - Menu items (5 min TTL)
- `session:${userId}` - User session (5 min TTL)
- `drivers:available` - Available drivers list (1 min TTL)

**Cache Invalidation:**
- On menu update → Clear `menu:${restaurantId}`
- On restaurant status change → Clear `restaurant:${id}`
- On driver status change → Clear `drivers:available`

**Layer 2: PostgreSQL Materialized Views**
```sql
-- Restaurant menu cache
CREATE MATERIALIZED VIEW restaurant_menu_cache AS
SELECT 
  r.id, r.name, r.is_open, r.latitude, r.longitude,
  json_agg(
    json_build_object(
      'id', m.id, 
      'name', m.name, 
      'price', m.price,
      'category', m.category,
      'isAvailable', m.is_available
    )
  ) as menu_items
FROM restaurants r
LEFT JOIN menu_items m ON m.restaurant_id = r.id AND m.is_available = true
WHERE r.status = 'ACTIVE'
GROUP BY r.id;

-- Refresh every 5 minutes via cron job
REFRESH MATERIALIZED VIEW CONCURRENTLY restaurant_menu_cache;
```

### 6.2 Database Optimizations

**Connection Pooling:**
```typescript
// TypeORM configuration
{
  type: 'postgres',
  poolSize: 50,              // Max connections
  extra: {
    max: 50,
    min: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  }
}
```

**Critical Indexes:**
```sql
-- Geospatial indexes (PostGIS)
CREATE INDEX idx_restaurants_location ON restaurants 
  USING GIST(ll_to_earth(latitude, longitude));

CREATE INDEX idx_drivers_location ON drivers 
  USING GIST(ll_to_earth(current_latitude, current_longitude));

-- Performance indexes
CREATE INDEX idx_drivers_available ON drivers(is_available, is_online) 
  WHERE is_available = true AND is_online = true;

CREATE INDEX idx_menu_items_available ON menu_items(restaurant_id, is_available) 
  WHERE is_available = true;

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);

-- Time-series optimization
CREATE INDEX idx_driver_locations_driver_time ON driver_locations(driver_id, timestamp DESC);
```

**Query Optimization Examples:**

*Nearest Restaurant Query (P99 < 200ms):*
```sql
SELECT 
  r.*,
  earth_distance(
    ll_to_earth(r.latitude, r.longitude),
    ll_to_earth($1, $2)
  ) / 1000 as distance_km
FROM restaurants r
WHERE 
  r.status = 'ACTIVE' 
  AND r.is_open = true
  AND earth_box(ll_to_earth($1, $2), 5000) @> ll_to_earth(r.latitude, r.longitude)
ORDER BY distance_km
LIMIT 20;
```

*Nearest Available Driver Query:*
```sql
SELECT 
  d.id, d.user_id,
  earth_distance(
    ll_to_earth(d.current_latitude, d.current_longitude),
    ll_to_earth($1, $2)
  ) / 1000 as distance_km
FROM drivers d
WHERE 
  d.is_online = true 
  AND d.is_available = true
  AND earth_box(ll_to_earth($1, $2), 10000) @> ll_to_earth(d.current_latitude, d.current_longitude)
ORDER BY distance_km
LIMIT 1
FOR UPDATE SKIP LOCKED;  -- Prevent race condition
```

### 6.3 GPS Event Handling (2,000 events/sec)

**Buffering Strategy:**
```typescript
@Injectable()
export class LocationBufferService implements OnModuleInit {
  private buffer: DriverLocation[] = [];
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_INTERVAL = 1000; // 1 second
  
  onModuleInit() {
    // Flush buffer every 1 second or 100 events
    setInterval(() => this.flushBuffer(), this.BATCH_INTERVAL);
  }
  
  async addLocation(location: DriverLocation) {
    // 1. Add to buffer
    this.buffer.push(location);
    
    // 2. Emit for real-time (WebSocket)
    this.eventEmitter.emit('location.update', location);
    
    // 3. Update driver current location in cache
    await this.cacheManager.set(
      `driver:location:${location.driverId}`,
      location,
      10 // 10 seconds TTL
    );
    
    // 4. Batch insert if buffer full
    if (this.buffer.length >= this.BATCH_SIZE) {
      await this.flushBuffer();
    }
  }
  
  private async flushBuffer() {
    if (this.buffer.length === 0) return;
    
    const locations = [...this.buffer];
    this.buffer = [];
    
    // Bulk insert to PostgreSQL
    await this.driverLocationRepo
      .createQueryBuilder()
      .insert()
      .values(locations)
      .execute();
  }
}
```

**Expected Performance:**
- Real-time WebSocket delivery: <100ms
- PostgreSQL persistence: Batched every 1 second
- Data loss risk: Max 1 second of data if server crashes (acceptable for MVP)

---

## 7. Background Job System (pg-boss)

### 7.1 Job Queue Architecture

```typescript
// Job types
enum JobType {
  ORDER_CREATED = 'order.created',
  PAYMENT_PROCESSING = 'payment.processing',
  DRIVER_ASSIGNMENT = 'driver.assignment',
  NOTIFICATION_SEND = 'notification.send',
  LOCATION_BATCH = 'location.batch'
}

// pg-boss configuration
const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL,
  retryLimit: 3,
  retryDelay: 5,
  expireInSeconds: 3600,
  archiveCompletedAfterSeconds: 86400
});
```

### 7.2 Job Workflows

**Order Processing Workflow:**
```
order.created
    ↓
payment.processing (Mock payment)
    ↓
order.payment.success
    ↓
notification.send (Restaurant)
    ↓
driver.assignment (Find nearest driver)
    ↓
notification.send (Driver + Customer)
```

**Job Handlers:**
```typescript
// Order created handler
boss.work('order.created', async (job) => {
  const { orderId } = job.data;
  
  // Process mock payment
  await paymentService.processPayment(orderId);
  
  // Emit next job
  await boss.send('order.payment.success', { orderId });
});

// Driver assignment handler
boss.work('driver.assignment', async (job) => {
  const { orderId, restaurantLocation } = job.data;
  
  // Find nearest available driver
  const driver = await driverService.findNearestAvailable(restaurantLocation);
  
  if (!driver) {
    // Retry with larger radius
    throw new Error('No driver available');
  }
  
  // Create delivery
  await deliveryService.assignDriver(orderId, driver.id);
});
```

---

## 8. Security Architecture

### 8.1 Authentication Flow

```
User Login Request
    ↓
┌─────────────────────────────┐
│  Auth Controller            │
│  • Validate credentials     │
└────────┬────────────────────┘
         ↓
┌─────────────────────────────┐
│  Auth Service               │
│  • Query user from DB       │
│  • Compare bcrypt password  │
│  • Generate JWT token       │
│  • Create session record    │
│  • Delete old sessions      │
│    (single device)          │
└────────┬────────────────────┘
         ↓
┌─────────────────────────────┐
│  Return JWT Token           │
│  {                          │
│    sub: userId,             │
│    email,                   │
│    role,                    │
│    jti: uuid,               │
│    exp: now + 5 mins        │
│  }                          │
└─────────────────────────────┘
```

### 8.2 Authorization Guards

```typescript
// JWT Auth Guard (validates token)
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // 1. Validate JWT signature and expiration
    const isValid = await super.canActivate(context);
    if (!isValid) return false;
    
    // 2. Check session exists in DB (single device)
    const user = request.user;
    const session = await this.sessionRepo.findOne({
      where: { 
        userId: user.sub,
        tokenHash: hash(user.jti)
      }
    });
    
    return !!session && !session.isExpired();
  }
}

// Roles Guard (checks user role)
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    return requiredRoles.includes(user.role);
  }
}

// Usage
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER', 'ADMIN')
@Get('orders')
async getOrders() {...}
```

### 8.3 Rate Limiting

```typescript
// Global rate limiting
ThrottlerModule.forRoot([
  {
    ttl: 60000,        // 1 minute
    limit: 100,        // 100 requests per IP
  }
])

// Per-endpoint rate limiting
@Throttle({ default: { ttl: 60000, limit: 10 } })
@Post('orders')
async createOrder() {...}
```

---

## 9. Monitoring & Observability

### 9.1 Structured Logging (Winston)

```typescript
// Logger configuration
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Log format
{
  "timestamp": "2026-01-03T00:47:40.000Z",
  "level": "info",
  "message": "Order created successfully",
  "context": "OrderService",
  "correlationId": "req-12345",
  "userId": "uuid",
  "orderId": "uuid",
  "duration": 125
}
```

### 9.2 Health Check Endpoint

```typescript
@Get('health')
async healthCheck() {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await this.checkDatabase(),
      pgBoss: await this.checkPgBoss(),
      cache: await this.checkCache()
    },
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeConnections: this.getActiveConnections()
    }
  };
}
```

---

## 10. Scalability & Future Considerations

### 10.1 Current MVP Limitations

| Aspect | MVP Approach | Limitation | Future Solution |
|--------|--------------|------------|-----------------|
| **Caching** | In-memory | Not shared across instances | Migrate to Redis Cluster |
| **GPS Storage** | Buffered batching | Risk of data loss | Migrate to Kafka + ClickHouse |
| **Job Queue** | pg-boss | Lower throughput than RabbitMQ | Migrate to RabbitMQ/SQS |
| **WebSocket** | Single instance | No load balancing | Redis adapter for Socket.io |
| **Rate Limiting** | In-memory | Not distributed | Redis-backed throttler |
| **Database** | Single instance | Single point of failure | Master-replica setup |

### 10.2 Horizontal Scaling Path

**Phase 1: MVP (Current)**
- Single NestJS instance
- Single PostgreSQL instance
- In-memory caching

**Phase 2: Initial Scale (>1000 orders/min)**
- Multiple NestJS instances behind load balancer
- Sticky sessions for WebSocket
- PostgreSQL read replicas
- Introduce Redis for shared cache

**Phase 3: High Scale (>5000 orders/min)**
- Microservices architecture
- Kafka for event streaming
- RabbitMQ for job queues
- Redis Cluster
- PostgreSQL sharding
- CDN for static assets

---

## 11. Deployment Architecture

### 11.1 Docker Compose Setup

```yaml
version: '3.8'

services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: swifteats
      POSTGRES_USER: swifteats_user
      POSTGRES_PASSWORD: secure_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U swifteats_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  pgadmin:
    image: dpage/pgadmin4:latest
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@swifteats.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

  app:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - NODE_ENV=development
      - PORT=4000
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=swifteats
      - DB_USER=swifteats_user
      - DB_PASSWORD=secure_password
      - JWT_SECRET=change-in-production
      - JWT_EXPIRATION=5m
    ports:
      - "4000:4000"
    volumes:
      - ./src:/app/src
    command: npm run start:dev

  gps-simulator:
    build:
      context: .
      dockerfile: Dockerfile.simulator
    depends_on:
      - app
    environment:
      - API_BASE_URL=http://app:4000
      - NUM_DRIVERS=50
      - EVENTS_PER_SECOND=10

volumes:
  postgres_data:
```

---

## 12. Testing Strategy

### 12.1 Test Pyramid

```
                    ┌──────────────┐
                    │     E2E      │  (10% - Critical flows)
                    │   Tests      │
                    └──────────────┘
                 ┌────────────────────┐
                 │   Integration      │  (30% - API endpoints)
                 │      Tests         │
                 └────────────────────┘
            ┌───────────────────────────┐
            │      Unit Tests           │  (60% - Business logic)
            │   (Service, Utils)        │
            └───────────────────────────┘
```

### 12.2 Coverage Requirements

- **Overall:** >85%
- **Services:** >90%
- **Controllers:** >80%
- **Utilities:** >95%

---

## 13. Success Criteria

The architecture will be considered successful when:

✅ **Performance Targets Met**
- P99 menu browse < 200ms
- 500 orders/minute processed successfully
- 2,000 GPS events/second ingested (local test: 10 events/sec)

✅ **Reliability Achieved**
- 99.9% uptime during testing
- Graceful degradation when payment service fails
- No data loss for critical transactions (orders, payments)

✅ **Scalability Demonstrated**
- Load tests pass for target throughput
- System recovers from failures automatically
- Clear migration path to distributed architecture

✅ **Maintainability Verified**
- >85% test coverage
- Complete API documentation
- All modules independently testable

---

**End of Architecture Document**
