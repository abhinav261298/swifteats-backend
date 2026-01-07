# Technical Product Requirements Document (PRD)
## SwiftEats - Real-Time Food Delivery Platform

**Version:** 2.0 (Final - PostgreSQL-Only)  
**Date:** January 3, 2026  
**Tech Stack:** Node.js + TypeScript + NestJS + PostgreSQL (Single Dependency)

---

## 1. Technology Stack Finalized (PostgreSQL-Only Architecture)

| Component | Technology | Version | Justification |
|-----------|-----------|---------|---------------|
| **Runtime** | Node.js | 20.x LTS | Latest stable, excellent async performance |
| **Language** | TypeScript | 5.x | Type safety, maintainability |
| **Framework** | NestJS | 10.x | Enterprise architecture, modular, DI, decorators |
| **Database** | PostgreSQL | 16.x | ACID, JSON support, PostGIS for geo-queries |
| **ORM** | TypeORM | 0.3.x | TypeScript native, migrations, relations |
| **Cache** | @nestjs/cache-manager | 2.x | In-memory caching (no Redis required) |
| **Job Queue** | pg-boss | 9.x | PostgreSQL-backed queue (no RabbitMQ required) |
| **Event Streaming** | EventEmitter + Buffer | Native | In-memory streaming (no Kafka required) |
| **WebSocket** | Socket.io | 4.x | Mature, fallback support, rooms |
| **Rate Limiting** | @nestjs/throttler | 5.x | In-memory rate limiting |
| **Validation** | class-validator | 0.14.x | Decorator-based DTOs |
| **Testing** | Jest + Supertest | 29.x | Built-in NestJS support |
| **API Docs** | Swagger/OpenAPI | 7.x | Auto-generated from decorators |
| **Logging** | Winston | 3.x | Structured logging, transports |

**Note:** This architecture uses **only PostgreSQL** as external dependency, eliminating Redis, Kafka, and RabbitMQ for MVP simplicity.

---

## 2. System Architecture

### 2.1 Approach
**Modular Monolith** with microservices-ready design
- Single deployment for MVP simplicity
- Clear module boundaries for future extraction
- Independent scaling via horizontal replication

### 2.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   API Gateway Layer                      │
│              (Rate Limiting + Auth Guards)               │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                  NestJS Application                      │
│  ┌──────────┬───────────┬──────────┬──────────────┐     │
│  │Customer  │Restaurant │  Driver  │    Admin     │     │
│  │ Module   │  Module   │  Module  │    Module    │     │
│  └────┬─────┴─────┬─────┴────┬─────┴───────┬──────┘     │
│       │           │          │             │            │
│  ┌────┴───────────┴──────────┴─────────────┴──────┐     │
│  │         Order Processing Core Module           │     │
│  └────┬───────────┬──────────┬──────────┬─────────┘     │
│       │           │          │          │                │
│  ┌────┴─────┬─────┴────┬─────┴─────┬────┴──────────┐    │
│  │ Payment  │  Driver  │Notification│   Caching     │    │
│  │ Service  │Assignment│  Service   │   Service     │    │
│  │ (Mock)   │ Service  │            │   (Redis)     │    │
│  └──────────┴──────────┴────────────┴───────────────┘    │
│  ┌──────────────────────────────────────────────────┐    │
│  │      Real-Time Tracking Module (WebSocket)       │    │
│  └──────────────────────────────────────────────────┘    │
└──────┬─────────────┬────────────┬───────────┬───────────┘
       │             │            │           │
  ┌────┴────┐  ┌─────┴─────┐ ┌───┴──────┐ ┌──┴────┐
  │PostgreSQL  │   Redis   │ │RabbitMQ  │ │ Kafka │
  │   (DB)   │  │ (Cache)   │ │(Queues)  │ │ (GPS) │
  └──────────┘  └───────────┘ └──────────┘ └───────┘
```

### 2.3 Core Modules

1. **Auth Module** - JWT auth, role guards, session management (5-min timeout, single device)
2. **User Module** - Customer/Restaurant/Driver/Admin entities
3. **Restaurant Module** - Profiles, menu management, 5km radius
4. **Order Module** - Order lifecycle, state machine, 1-min cancellation window
5. **Delivery Module** - Driver assignment (nearest algo), tracking
6. **Location Module** - GPS ingestion (Kafka), real-time broadcast (WebSocket)
7. **Notification Module** - In-app notifications, event-driven
8. **Admin Module** - Manual approvals, analytics

---

## 3. Database Schema (PostgreSQL)

### 3.1 Core Tables

**users**
- id (UUID, PK), email (unique), password (bcrypt), role (enum), name, phone, is_active, timestamps

**addresses**
- id (UUID, PK), user_id (FK), street, city, latitude, longitude, is_default, timestamps

**restaurants**
- id (UUID, PK), user_id (FK, unique), name, description, cuisine_type[], latitude, longitude, service_radius_km (default 5.0), status (PENDING/ACTIVE/INACTIVE/CLOSED), is_open, opening/closing_time, approval_status, timestamps

**menu_items**
- id (UUID, PK), restaurant_id (FK), name, description, category, price, is_available, is_veg, allergens[], preparation_time_mins, timestamps

**orders**
- id (UUID, PK), order_number (unique), user_id (FK), restaurant_id (FK), delivery_address_id (FK), status (enum state machine), subtotal, delivery_fee, tax_amount, discount_amount, total_amount, estimated_delivery_time, restaurant_acceptance_deadline (created_at + 15 mins), cancellation_allowed_until (created_at + 1 min), timestamps

**order_items**
- id (UUID, PK), order_id (FK), menu_item_id (FK), quantity, unit_price, total_price, item_name (snapshot), customizations (JSON), timestamps

**drivers**
- id (UUID, PK), user_id (FK, unique), vehicle_type, vehicle_number, license_number, is_online, is_available, current_latitude, current_longitude, total_deliveries, earnings_per_delivery (default 50.00), approval_status, timestamps

**deliveries**
- id (UUID, PK), order_id (FK, unique), driver_id (FK), status (enum), assigned_at, accepted_at, picked_up_at, delivered_at, driver_earnings, distance_km, timestamps

**driver_locations** (time-series)
- id (UUID, PK), driver_id (FK), latitude, longitude, accuracy, heading, speed, timestamp
- *Retention: 30 days*

**payments**
- id (UUID, PK), order_id (FK, unique), amount, payment_method (CARD/UPI/WALLET/COD), payment_status (enum), mock_transaction_id (unique), gateway_response (JSONB), initiated_at, completed_at, timestamps

**sessions**
- id (UUID, PK), user_id (FK), token_hash (JWT jti hashed), device_info (JSONB), ip_address, expires_at, created_at

**notifications**
- id (UUID, PK), user_id (FK), order_id (FK), type, title, message, is_read, created_at

**order_status_history**
- id (UUID, PK), order_id (FK), from_status, to_status, changed_by (FK), changed_by_role, notes, timestamp

### 3.2 Key Indexes

```sql
-- Performance critical indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_restaurants_location ON restaurants USING GIST(ll_to_earth(latitude, longitude));
CREATE INDEX idx_drivers_available ON drivers(is_available, is_online) WHERE is_available = true AND is_online = true;
CREATE INDEX idx_menu_items_available ON menu_items(restaurant_id, is_available) WHERE is_available = true;
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_driver_locations_driver_time ON driver_locations(driver_id, timestamp DESC);
```

### 3.3 PostGIS Extension
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS earthdistance;
CREATE EXTENSION IF NOT EXISTS cube;
```

---

## 4. API Specifications

### 4.1 Response Format

```typescript
// Success
{ "success": true, "data": {...}, "timestamp": "ISO-8601" }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": {} }, "timestamp": "ISO-8601" }

// Paginated
{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }, "timestamp": "ISO-8601" }
```

### 4.2 Key Endpoints (Summary)

**Auth:** `/api/v1/auth`
- POST /register, /login, /logout
- GET /me

**Customer:** `/api/v1`
- GET /restaurants (with lat/lng filters, paginated)
- GET /restaurants/:id/menu (cached 5 mins)
- POST /orders
- GET /orders, /orders/:id, /orders/:id/track
- PATCH /orders/:id/cancel (within 1 min)

**Restaurant:** `/api/v1/restaurant`
- GET/PATCH /profile
- PATCH /status (toggle open/closed)
- GET/POST/PATCH/DELETE /menu/:id
- GET /orders
- PATCH /orders/:id/accept (deadline: 15 mins)
- PATCH /orders/:id/reject
- PATCH /orders/:id/ready

**Driver:** `/api/v1/driver`
- GET/PATCH /profile
- PATCH /status (toggle online/offline)
- GET /deliveries, /deliveries/active
- PATCH /deliveries/:id/accept
- PATCH /deliveries/:id/picked-up
- PATCH /deliveries/:id/delivered
- POST /location (Kafka producer)

**Admin:** `/api/v1/admin`
- GET/PATCH /restaurants/:id/approve
- GET/PATCH /drivers/:id/approve
- GET /orders, /analytics/overview

**WebSocket:** `/tracking` (Socket.io)
- Client: join:order, leave:order
- Server: location:update, order:status:changed

---

## 5. Performance Optimization

### 5.1 Caching Strategy (Redis)

| Cache Key | TTL | Invalidation |
|-----------|-----|--------------|
| `menu:{restaurantId}` | 5 mins | On menu update |
| `restaurant:{id}` | 10 mins | On profile update |
| `restaurants:list:{lat}:{lng}` | 2 mins | - |
| `driver:location:{driverId}` | 10 secs | On location update |
| `order:{orderId}` | 1 min | On status change |
| `session:{userId}` | 5 mins | On logout |

**Pattern:** Cache-aside with write-through invalidation

### 5.2 Database Optimization

**Menu Browse Query (P99 < 200ms):**
```sql
-- Use PostGIS for nearby restaurants
SELECT *, earth_distance(ll_to_earth(latitude, longitude), ll_to_earth($1, $2)) as distance
FROM restaurants
WHERE status = 'ACTIVE' AND is_open = true
  AND earth_box(ll_to_earth($1, $2), 5000) @> ll_to_earth(latitude, longitude)
ORDER BY distance LIMIT 20;
```

**Nearest Driver Query:**
```sql
SELECT id, earth_distance(ll_to_earth(current_latitude, current_longitude), ll_to_earth($1, $2)) as distance
FROM drivers
WHERE is_online = true AND is_available = true
ORDER BY distance LIMIT 1;
```

### 5.3 Connection Pooling

- **PostgreSQL:** max 100, min 10
- **Redis:** max 50, min 5

---

## 6. Real-Time Location Tracking

### 6.1 Flow

```
Driver App → POST /api/v1/driver/location → Kafka Producer
                                                  ↓
                                         Kafka Topic (driver-locations)
                                                  ↓
                                          Kafka Consumer
                                           ↓           ↓
                                    Redis (latest)   PostgreSQL (batch)
                                           ↓
                                    WebSocket Broadcast
                                           ↓
                                    Customer App (live)
```

### 6.2 Kafka Configuration

- **Topic:** `driver-locations`
- **Partitions:** 10
- **Replication:** 1 (MVP)
- **Retention:** 24 hours
- **Compression:** Snappy

**Message Schema:**
```json
{
  "driverId": "uuid",
  "orderId": "uuid",
  "latitude": 19.0760,
  "longitude": 72.8777,
  "accuracy": 10.5,
  "heading": 45.0,
  "speed": 30.5,
  "timestamp": 1704145860000
}
```

### 6.3 WebSocket Rooms

- `order:{orderId}` - Customers tracking orders
- Broadcast: `io.to(order:${orderId}).emit('location:update', data)`

---

## 7. Order Processing Workflow

### 7.1 State Machine

```
PENDING → RESTAURANT_ACCEPTED → PREPARING → READY_FOR_PICKUP
            ↓                                        ↓
      DRIVER_ASSIGNED ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←
            ↓
       PICKED_UP → IN_TRANSIT → DELIVERED

Cancellation: PENDING → CANCELLED (within 1 min)
```

### 7.2 RabbitMQ Queues

1. **order.created** → Payment Service (mock payment)
2. **order.payment.success** → Restaurant Notification
3. **order.restaurant.accepted** → Driver Assignment Service
4. **order.driver.assigned** → Driver Notification
5. **order.picked_up** → Enable tracking
6. **order.status.changed** (fanout) → Logging, analytics, notifications

**Retry:** Max 3 attempts, exponential backoff, DLQ for failures

---

## 8. Security Implementation

### 8.1 JWT Authentication

**Token Structure:**
```json
{
  "sub": "userId",
  "email": "user@example.com",
  "role": "CUSTOMER",
  "jti": "unique-token-id",
  "iat": 1704145860,
  "exp": 1704146160
}
```

**Session Enforcement:**
- Store jti hash in sessions table
- Single device login (delete old sessions on new login)
- 5-minute expiration (env configurable)

### 8.2 Authorization (RBAC)

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER', 'ADMIN')
async getOrders() {...}
```

### 8.3 Input Validation (DTOs)

```typescript
export class CreateOrderDto {
  @IsUUID()
  restaurantId: string;

  @IsArray()
  @ValidateNested({ each: true })
  items: OrderItemDto[];
}
```

### 8.4 Rate Limiting

- Per IP: 100 req/min
- Per User: 200 req/min
- Critical endpoints (order placement): 10 req/min

---

## 9. Testing Strategy

### 9.1 Unit Tests (Jest)
- **Target:** >85% coverage
- Mock all external dependencies (DB, Redis, RabbitMQ, Kafka)
- Test both happy and error paths

### 9.2 Integration Tests
- Test complete order flow
- Use test database + test queues
- Mock external services only

### 9.3 Load Testing (Artillery/K6)

**Scenario 1: Menu Browse**
- Target: P99 < 200ms
- Load: 50 concurrent requests/sec for 60 seconds

**Scenario 2: Order Placement**
- Target: 500 orders/minute
- Load: 8.33 orders/sec for 60 seconds

**Scenario 3: GPS Data**
- Simulate 50 drivers
- 10 events/second total
- Monitor Kafka lag and WebSocket delivery

---

## 10. Deployment (Docker Compose)

### 10.1 Services

1. **postgres** (postgis/postgis:16-3.4)
2. **redis** (redis:7-alpine)
3. **rabbitmq** (rabbitmq:3.13-management)
4. **zookeeper** (confluent zookeeper)
5. **kafka** (confluent kafka)
6. **app** (NestJS application)
7. **gps-simulator** (50 drivers, 10 events/sec)

### 10.2 Key Environment Variables

```env
NODE_ENV=development
PORT=4000
DB_HOST=postgres
REDIS_HOST=redis
RABBITMQ_URL=amqp://admin:admin@rabbitmq:5672
KAFKA_BROKERS=kafka:9092
JWT_SECRET=change-in-production
JWT_EXPIRATION=5m
ORDER_CANCELLATION_WINDOW_MINS=1
RESTAURANT_ACCEPTANCE_TIMEOUT_MINS=15
DELIVERY_FEE=40.00
TAX_RATE=0.05
```

---

## 11. GPS Simulator Specifications

**Requirements:**
- Simulate 50 concurrent drivers
- Generate 10 GPS events/second (total)
- Realistic movement (20-40 km/h, road-like paths)
- Start/stop control
- Maharashtra geographic bounds

**Implementation:**
- Separate Node.js service
- Register 50 drivers on startup
- Send location updates via POST /api/v1/driver/location
- Distribute events evenly (send 2 driver updates every 200ms)

---

## 12. Monitoring & Logging

### 12.1 Logging (Winston)

**Format:**
```json
{
  "timestamp": "ISO-8601",
  "level": "info",
  "message": "Order created",
  "context": "OrderService",
  "trace": "correlation-id",
  "userId": "uuid",
  "metadata": {}
}
```

**Correlation ID:** Generated per request, passed through all services

### 12.2 Health Check

**GET /health**
```json
{
  "status": "healthy",
  "services": {
    "database": "up",
    "redis": "up",
    "rabbitmq": "up",
    "kafka": "up"
  }
}
```

---

## 13. Technical Questions & Clarifications

### 13.1 Database & Scaling

**Q1:** Should we implement database partitioning for `driver_locations` table?
- **Option A:** Partition by month (complex setup)
- **Option B:** Single table with 30-day retention (simpler)
- **Your Input:** Which approach? Option B, keep it simple

**Q2:** PostgreSQL connection pool sizing?
- **Concern:** 100 connections/service * 1 service = 100 (PostgreSQL default max is 100)
- **Question:** Should we reduce pool size or increase PostgreSQL max_connections? Option A, reduce pool size

**Q3:** Should we implement read replicas for PostgreSQL?
- **For MVP:** Not needed
- **Future:** When read QPS > 5000
- **Confirm?** Option A, not needed for MVP

### 13.2 Real-Time System

**Q4:** Kafka consumer group strategy?
- **Option A:** Single consumer group with 10 consumers (parallel processing)
- **Option B:** Multiple consumer groups (tracking + analytics)
- **Recommendation:** Option A for MVP, add analytics later
- **Your Input:** I dont have KAFKA setup, suggest some node js in built alternatives or other libraries

**Q5:** GPS data retention in PostgreSQL?
- **Option A:** 7 days only
- **Option B:** 30 days hot + archive
- **Option C:** Indefinite
- **Recommendation:** Option B
- **Your Input:** Confirm retention period? Option A, 7 days only

**Q6:** WebSocket scaling strategy?
- **Option A:** Sticky sessions via load balancer
- **Option B:** Redis adapter for Socket.io (multi-instance support)
- **Recommendation:** Option A for MVP
- **Your Input:** Option A, sticky sessions via load balancer

### 13.3 Security & Sessions

**Q7:** Should we implement refresh tokens?
- **Current:** JWT expires in 5 minutes, re-login required
- **Alternative:** Access token (5 min) + Refresh token (7 days) for better UX
- **Your Input:** Implement refresh tokens or keep simple? Option A, keep simple - JWT expires in 5 minutes, re-login required

**Q8:** CORS configuration for development?
- **Option A:** Allow all origins (`*`)
- **Option B:** Restrict to specific frontend URL
- **Recommendation:** Option A for MVP, restrict in production
- **Your Input:** Option A, Allow all origins (`*`)

### 13.4 Testing & CI/CD

**Q9:** Should build fail if test coverage < 85%?
- **Option A:** Fail build (strict enforcement)
- **Option B:** Warning only
- **Recommendation:** Option A
- **Your Input:** Agree? Option A, Fail build (strict enforcement)

**Q10:** Should we include Postman/Newman tests in CI/CD?
- **Proposed:** Run Postman collection on every build
- **Your Input:** Include automated API tests or manual only? Option A, Run Postman collection on every build

### 13.5 DevOps

**Q11:** Should docker-compose include development tools?
- **pgAdmin** (port 5050) for PostgreSQL management
- **Redis Commander** (port 8081) for Redis management
- **Kafka UI** (port 8080) for Kafka management
- **Your Input:** Include these or keep minimal? Option A, Include these but I dont have redis host or kafka  or ra  it MQ setup. I only have postgres setup in my local

**Q12:** Docker image optimization?
- **Proposed:** Multi-stage build with `node:20-alpine` base
- **Expected size:** <500MB
- **Your Input:** Any specific requirements? Option A, Multi-stage build with `node:20-alpine` base

### 13.6 Error Handling

**Q13:** Circuit breaker for mock payment service?
- **Proposed:** Yes, with 50% error threshold, 30s reset timeout
- **Fallback:** Mark payment as PENDING, retry via cron job
- **Your Input:** Implement circuit breaker or simple retry? Simple retry

**Q14:** Dead Letter Queue (DLQ) handling?
- **Option A:** Manual review via admin panel
- **Option B:** Automated retry after threshold time
- **Recommendation:** Option A for MVP
- **Your Input:** Confirm approach? Option A, Manual review via admin panel

### 13.7 Performance

**Q15:** Should we implement materialized views for menu caching in PostgreSQL?
- **Benefit:** Faster queries for restaurant+menu
- **Trade-off:** Refresh complexity
- **Alternative:** Redis caching sufficient
- **Your Input:** Implement or rely on Redis only? Can we explore some inbuit library/frameworks for caching? 

**Q16:** Rate limiting storage?
- **Option A:** Redis (distributed, consistent)
- **Option B:** In-memory (simple, single instance)
- **Recommendation:** Redis for horizontal scaling
- **Your Input:**  In memory but I dont have redis setup so we have to think of something else

### 13.8 Business Logic

**Q17:** Estimated delivery time calculation?
- **Formula:** Preparation time + Distance/Average speed + Buffer
- **Example:** 25 mins prep + 5 km/30 kmph (10 mins) + 5 mins buffer = 40 mins
- **Your Input:** Confirm formula or provide alternative? Confirmed formula

**Q18:** What happens if no driver accepts delivery within timeout?
- **Option A:** Retry assignment with increased radius
- **Option B:** Mark order as FAILED, refund customer
- **Option C:** Queue and wait indefinitely
- **Recommendation:** Option A (retry with 10km, 15km radius)
- **Your Input:** Confirm strategy? Option A, Retry assignment with increased radius

**Q19:** Payment failure retry mechanism?
- **Proposed:** Retry 3 times with exponential backoff (1s, 5s, 15s)
- **After 3 failures:** Mark order as FAILED, allow manual retry
- **Your Input:** Confirm retry logic? Yes

**Q20:** Discount/promo code implementation?
- **Scope:** Apply discount before payment
- **Types:** Flat amount or percentage
- **Storage:** `promo_codes` table with validation rules
- **Your Input:** Include in MVP or defer to later? defer to later

---

## 14. Project Structure (Preview)

```
swift-eats/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   ├── user/
│   │   ├── restaurant/
│   │   ├── order/
│   │   ├── delivery/
│   │   ├── location/
│   │   ├── notification/
│   │   ├── admin/
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   ├── exceptions/
│   ├── config/
│   ├── database/
│   ├── main.ts
├── test/
├── simulator/
│   ├── gps-simulator.ts
├── docker-compose.yml
├── Dockerfile
├── README.md
├── ARCHITECTURE.md
├── PROJECT_STRUCTURE.md
├── API-SPECIFICATION.yml
└── package.json
```

---

## 15. Next Steps

Once you provide clarifications on the technical questions above:

1. ✅ Create detailed database migrations
2. ✅ Design complete API specification (OpenAPI/Swagger)
3. ✅ Create architecture diagrams
4. ✅ Set up project structure
5. ⏳ **Await your approval to begin implementation**

---

## 16. Final Architecture Decisions ✅

Based on the constraint of **PostgreSQL-only stack**, the following decisions have been finalized:

### 16.1 Caching Solution
**Decision:** NestJS Cache Manager (in-memory) + PostgreSQL Materialized Views
- In-memory cache for hot data (restaurants, menus, sessions)
- Materialized views for complex aggregations
- Cache invalidation via write-through pattern
- **Trade-off:** Cache not shared across instances (acceptable for single-instance MVP)

### 16.2 GPS Event Streaming
**Decision:** EventEmitter + In-Memory Buffer + Batch PostgreSQL Insert
- Real-time broadcast via EventEmitter → WebSocket
- Buffer GPS events in memory (max 100 events or 1 second)
- Batch insert to PostgreSQL for persistence
- **Trade-off:** Max 1 second of data loss risk on server crash (acceptable for location data)

### 16.3 Message Queue
**Decision:** pg-boss (PostgreSQL-backed job queue)
- Reliable job processing with retry and DLQ
- Handles 500 orders/minute requirement
- No external message broker needed
- **Trade-off:** Lower throughput than RabbitMQ (sufficient for MVP)

### 16.4 Rate Limiting
**Decision:** @nestjs/throttler (in-memory)
- Per-IP and per-user rate limiting
- Simple configuration
- **Trade-off:** Not distributed across instances (acceptable for MVP)

### 16.5 Session Management
**Decision:** PostgreSQL storage + in-memory cache
- Persistent sessions in database
- Cache for fast lookups
- Single device enforcement
- **Trade-off:** Slight latency increase vs Redis (acceptable)

### 16.6 Business Logic Confirmations
- **Estimated delivery time:** Prep time + (Distance / 30 km/h) + 5 min buffer
- **No driver available:** Retry with 10km, then 15km radius
- **Payment retry:** 3 attempts with exponential backoff (1s, 5s, 15s)
- **Promo codes:** Deferred to post-MVP
- **GPS retention:** 7 days only
- **Connection pool:** Reduced to 50 (from 100) to avoid exceeding PostgreSQL limits

### 16.7 Development Approach
- **15 incremental tasks** with testing at each stage
- Complete documentation before implementation
- Load testing to validate performance targets
- Docker Compose with minimal services (postgres + pgadmin + app + simulator)

**All technical specifications finalized. Ready for implementation upon approval.**
