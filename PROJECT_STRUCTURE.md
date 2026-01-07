# Project Structure
## SwiftEats - Real-Time Food Delivery Platform

This document explains the organization of the SwiftEats backend codebase and the purpose of each component.

---

## 📁 Root Directory Structure

```
swift-eats/
├── src/                          # Application source code
├── gps-simulator/                # GPS location simulator for testing
├── scripts/                      # Utility scripts
├── logs/                         # Application logs (generated)
├── dist/                         # Compiled JavaScript (generated)
├── node_modules/                 # NPM dependencies (generated)
├── test/                         # E2E tests
├── .env.example                  # Environment variable template
├── .env                          # Environment variables (git-ignored)
├── .dockerignore                 # Docker ignore patterns
├── .eslintrc.js                  # ESLint configuration
├── .gitignore                    # Git ignore patterns
├── .prettierrc                   # Prettier configuration
├── docker-compose.yml            # Docker services orchestration
├── Dockerfile                    # Docker image for main app
├── jest.config.js                # Jest testing configuration
├── nest-cli.json                 # NestJS CLI configuration
├── package.json                  # NPM dependencies and scripts
├── tsconfig.json                 # TypeScript compiler configuration
├── tsconfig.build.json           # TypeScript build configuration
├── README.md                     # Project documentation
├── ARCHITECTURE.md               # System architecture documentation
├── PROJECT_STRUCTURE.md          # This file
├── CHAT_HISTORY.md               # AI collaboration history
├── ASSIGNMENT_ANALYSIS.md        # Requirements analysis
└── TASKS.md                      # Implementation task breakdown
```

---

## 📂 Source Code Structure (`src/`)

### Overview

```
src/
├── modules/                      # Feature modules (business logic)
├── common/                       # Shared utilities and components
├── config/                       # Configuration files
├── database/                     # Database setup and migrations
└── main.ts                       # Application entry point
```

---

## 🧩 Modules Directory (`src/modules/`)

Each module represents a distinct business domain with its own entities, services, controllers, and DTOs.

```
modules/
├── auth/                         # Authentication & Authorization
├── user/                         # User Management
├── restaurant/                   # Restaurant & Menu Management
├── order/                        # Order Management
├── payment/                      # Payment Processing (Mock)
├── driver/                       # Driver Management
├── delivery/                     # Delivery & Driver Assignment
└── location/                     # GPS Tracking & Real-time Updates
```

### Module Structure Pattern

Each module follows this standard structure:

```
<module-name>/
├── controllers/                  # HTTP request handlers
│   └── <name>.controller.ts
├── services/                     # Business logic
│   └── <name>.service.ts
├── entities/                     # TypeORM database entities
│   └── <name>.entity.ts
├── dto/                          # Data Transfer Objects (validation)
│   ├── create-<name>.dto.ts
│   ├── update-<name>.dto.ts
│   └── index.ts
├── gateways/                     # WebSocket gateways (if applicable)
│   └── <name>.gateway.ts
├── guards/                       # Authorization guards (if applicable)
├── <name>.module.ts              # Module definition
└── tests/                        # Unit and integration tests
    ├── <name>.service.spec.ts
    └── <name>.controller.spec.ts
```

---

## 📦 Module Details

### 1. **Auth Module** (`src/modules/auth/`)

**Purpose:** JWT-based authentication, session management, and authorization.

```
auth/
├── auth.controller.ts            # Login, register, logout, me endpoints
├── auth.service.ts               # Authentication business logic
├── jwt.strategy.ts               # Passport JWT strategy
├── guards/
│   ├── jwt-auth.guard.ts         # JWT authentication guard
│   └── roles.guard.ts            # Role-based authorization guard
├── dto/
│   ├── login.dto.ts              # Login request validation
│   ├── register.dto.ts           # Registration request validation
│   └── login-response.dto.ts    # Login response structure
├── entities/
│   └── session.entity.ts         # User session tracking
├── auth.module.ts
└── tests/
    ├── auth.service.spec.ts      # 11 unit tests
    └── auth.controller.spec.ts   # 8 integration tests
```

**Key Features:**
- JWT token generation with 5-minute expiration
- Single device enforcement (one active session per user)
- Password hashing with bcrypt
- Role-based access control (CUSTOMER, RESTAURANT_OWNER, DRIVER, ADMIN)

---

### 2. **User Module** (`src/modules/user/`)

**Purpose:** User profile and address management for all roles.

```
user/
├── user.controller.ts            # Profile and address endpoints
├── user.service.ts               # User business logic
├── entities/
│   ├── user.entity.ts            # User profile data
│   └── address.entity.ts         # User addresses with coordinates
├── dto/
│   ├── update-user.dto.ts
│   ├── create-address.dto.ts
│   └── update-address.dto.ts
├── user.module.ts
└── tests/
    ├── user.service.spec.ts      # 14 unit tests
    └── user.controller.spec.ts   # 7 integration tests
```

**Key Features:**
- Multiple addresses per user with GPS coordinates
- Default address management
- Phone number uniqueness validation
- Coordinate range validation (latitude: -90 to 90, longitude: -180 to 180)

---

### 3. **Restaurant Module** (`src/modules/restaurant/`)

**Purpose:** Restaurant profile, menu management, and location-based search.

```
restaurant/
├── controllers/
│   ├── restaurant.controller.ts          # Customer-facing: browse, search
│   ├── restaurant-owner.controller.ts    # Owner: profile, status
│   └── restaurant-order.controller.ts    # Owner: order management
├── services/
│   ├── restaurant.service.ts             # Restaurant business logic
│   └── menu.service.ts                   # Menu CRUD operations
├── entities/
│   ├── restaurant.entity.ts              # Restaurant profile & location
│   └── menu-item.entity.ts               # Menu items with categories
├── dto/                                  # 8 DTO files
├── restaurant.module.ts
└── tests/
    ├── restaurant.service.spec.ts        # 22 unit tests
    └── menu.service.spec.ts              # 15 unit tests
```

**Key Features:**
- Location-based restaurant search using Haversine formula
- Radius filtering (1-50 km)
- Cuisine and availability filtering
- Restaurant open/closed status toggle
- Menu item availability management
- Approval workflow (PENDING → APPROVED → ACTIVE)

---

### 4. **Order Module** (`src/modules/order/`)

**Purpose:** Order placement, state machine, and order history management.

```
order/
├── controllers/
│   └── order.controller.ts               # Create, list, view, cancel orders
├── services/
│   ├── order.service.ts                  # Order business logic
│   └── order-state-machine.service.ts    # Status transition validation
├── entities/
│   ├── order.entity.ts                   # Order details
│   ├── order-item.entity.ts              # Items in order
│   └── order-status-history.entity.ts    # Audit trail
├── dto/                                  # 5 DTO files
├── order.module.ts
└── tests/
    ├── order.service.spec.ts             # 17 unit tests
    └── order-state-machine.service.spec.ts # 11 unit tests
```

**Key Features:**
- Order state machine with 11 states (PENDING → DELIVERED/CANCELLED)
- Order number generation (ORD-YYYYMMDD-XXXXX)
- Automatic totals calculation (subtotal + delivery fee + tax - discount)
- 1-minute cancellation window
- Order status history tracking
- Integration with Payment and Delivery modules

**Order States:**
```
PENDING → AWAITING_PAYMENT → RESTAURANT_ACCEPTED → 
DRIVER_ASSIGNED → DRIVER_AT_RESTAURANT → ORDER_PICKED_UP → 
DRIVER_AT_CUSTOMER → DELIVERED

Alternative paths:
→ CANCELLED (within 1 minute)
→ RESTAURANT_REJECTED
```

---

### 5. **Payment Module** (`src/modules/payment/`)

**Purpose:** Mock payment gateway with retry logic (90% success rate).

```
payment/
├── payment.service.ts            # Payment processing logic
├── entities/
│   └── payment.entity.ts         # Payment records
├── dto/
│   └── create-payment.dto.ts
├── payment.module.ts
└── tests/
    └── payment.service.spec.ts   # 12 unit tests
```

**Key Features:**
- 90% success rate simulation
- Exponential backoff retry (3 attempts: 1s, 5s, 15s delays)
- Transaction ID generation
- Payment status tracking (PENDING → PROCESSING → SUCCESS/FAILED)
- Non-blocking async integration with Order module

---

### 6. **Driver Module** (`src/modules/driver/`)

**Purpose:** Driver profile, status management, and earnings tracking.

```
driver/
├── driver.controller.ts          # Profile, status, location, earnings
├── driver.service.ts             # Driver business logic
├── entities/
│   └── driver.entity.ts          # Driver profile & vehicle info
├── dto/                          # 6 DTO files
├── driver.module.ts
└── tests/
    └── driver.service.spec.ts    # 29 unit tests
```

**Key Features:**
- Driver approval workflow (PENDING → APPROVED)
- Online/offline status toggle
- Available/busy status (auto-managed during deliveries)
- Current location tracking (latitude, longitude, last update)
- Earnings calculation (₹50 per delivery)
- Total deliveries counter
- Vehicle and license information

---

### 7. **Delivery Module** (`src/modules/delivery/`)

**Purpose:** Delivery management and automatic driver assignment.

```
delivery/
├── controllers/
│   └── delivery.controller.ts            # Driver delivery workflow
├── services/
│   ├── delivery.service.ts               # Delivery business logic
│   └── driver-assignment.service.ts      # Nearest driver algorithm
├── entities/
│   └── delivery.entity.ts                # Delivery details
├── dto/                                  # 3 DTO files
├── delivery.module.ts
└── tests/
    ├── delivery.service.spec.ts          # 5 unit tests
    └── driver-assignment.service.spec.ts # 4 unit tests
```

**Key Features:**
- Automatic nearest driver assignment (Haversine distance)
- Intelligent retry with expanding radius (5km → 10km → 15km → 20km)
- Pessimistic locking to prevent race conditions
- Delivery time estimation (distance/20kmh + pickup/dropoff buffer)
- Driver workflow: Accept → Arrived at Restaurant → Picked Up → Arrived at Customer → Delivered
- Real-time status updates via WebSocket
- Driver earnings update on completion

---

### 8. **Location Module** (`src/modules/location/`)

**Purpose:** Real-time GPS tracking with buffering and WebSocket broadcasting.

```
location/
├── location.controller.ts                # GPS update endpoints
├── services/
│   ├── location.service.ts               # Location management
│   └── location-buffer.service.ts        # In-memory buffering
├── gateways/
│   └── location.gateway.ts               # WebSocket real-time broadcast
├── entities/
│   └── driver-location.entity.ts         # Historical GPS data
├── dto/
│   └── update-location.dto.ts            # GPS data validation
├── location.module.ts
└── tests/
    ├── location.service.spec.ts          # 10 unit tests
    └── location-buffer.service.spec.ts   # 7 unit tests
```

**Key Features:**
- In-memory buffer (100 events or 1 second, whichever comes first)
- Batch insert to PostgreSQL for performance
- Real-time WebSocket broadcasting to customers
- Order-based room management (`order:${orderId}`)
- EventEmitter integration for cross-module communication
- Scheduled cleanup (7-day retention via cron job)
- Location history queries with time-range filtering

**Events:**
- `location.updated` - Real-time location broadcast
- `delivery.created` - Setup order tracking
- `delivery.status.changed` - Notify status updates

---

## 🛠️ Common Directory (`src/common/`)

Shared utilities, decorators, filters, and constants used across all modules.

```
common/
├── decorators/                   # Custom decorators
│   ├── current-user.decorator.ts # Extract user from request
│   ├── roles.decorator.ts        # Define required roles
│   └── public.decorator.ts       # Mark endpoint as public
├── filters/                      # Exception filters
│   └── http-exception.filter.ts  # Global error handler
├── interceptors/                 # Request/response interceptors
│   ├── logging.interceptor.ts    # Request logging with correlation ID
│   └── transform.interceptor.ts  # Response format standardization
├── pipes/                        # Validation pipes
│   └── validation.pipe.ts        # DTO validation
├── guards/                       # Authorization guards
│   └── (guards are in auth module)
├── exceptions/                   # Custom exceptions
│   └── custom-exceptions.ts      # Domain-specific errors
├── constants/                    # Enums and constants
│   ├── order-status.enum.ts
│   ├── user-role.enum.ts
│   ├── payment-status.enum.ts
│   ├── delivery-status.enum.ts
│   ├── restaurant-status.enum.ts
│   └── index.ts
├── interfaces/                   # TypeScript interfaces
│   ├── api-response.interface.ts # Standard API response format
│   └── jwt-payload.interface.ts  # JWT token structure
└── utils/                        # Utility functions
    ├── distance.util.ts          # Haversine distance calculation
    └── date.util.ts              # Date manipulation helpers
```

### Key Components

**Decorators:**
- `@CurrentUser()` - Extracts current user from JWT payload
- `@Roles(...roles)` - Specifies required roles for endpoint
- `@Public()` - Bypasses JWT authentication

**Filters:**
- `HttpExceptionFilter` - Catches all exceptions and formats error responses

**Interceptors:**
- `LoggingInterceptor` - Logs all requests with correlation IDs
- `TransformInterceptor` - Wraps all responses in standard format:
  ```json
  {
    "success": true,
    "data": {...},
    "message": "Success",
    "timestamp": "2026-01-05T..."
  }
  ```

**Utilities:**
- `calculateDistance()` - Haversine formula for lat/lng distance
- Date helpers for timezone and formatting

---

## ⚙️ Configuration (`src/config/`)

Environment-based configuration using `@nestjs/config`.

```
config/
├── app.config.ts                 # General app settings
├── database.config.ts            # TypeORM configuration
├── jwt.config.ts                 # JWT settings
├── cache.config.ts               # Cache settings
└── logger.config.ts              # Winston logger setup
```

**Configuration Loading:**
```typescript
ConfigModule.forRoot({
  isGlobal: true,
  load: [appConfig, databaseConfig, jwtConfig, cacheConfig],
})
```

---

## 🗄️ Database (`src/database/`)

Database migrations, seeds, and data source configuration.

```
database/
├── database.module.ts            # TypeORM module configuration
├── data-source.ts                # Data source for migrations
├── migrations/
│   └── 1704308400000-InitialSchema.ts  # Initial database schema
└── seeds/
    └── seed.ts                   # Test data seeder
```

**Entities (13 total):**
1. `users` - User accounts (all roles)
2. `addresses` - User delivery addresses
3. `sessions` - Active user sessions (JWT tracking)
4. `restaurants` - Restaurant profiles
5. `menu_items` - Restaurant menu items
6. `orders` - Customer orders
7. `order_items` - Items in each order
8. `order_status_history` - Order status audit trail
9. `payments` - Payment transactions
10. `drivers` - Driver profiles and vehicle info
11. `deliveries` - Delivery assignments
12. `driver_locations` - GPS location history
13. `notifications` - (Entity exists, module pending)

---

## 🧪 Testing Structure (`test/` and `**/*.spec.ts`)

### Unit Tests (Co-located with source)

```
src/modules/<module>/<name>.spec.ts
```

**Current Test Coverage:**
- **Total Tests:** 232 passing
- **Test Suites:** 13 passing
- **Coverage:** ~85% (target: >85%)

**Tests by Module:**
- Auth: 19 tests (service + controller)
- User: 21 tests
- Restaurant: 37 tests
- Order: 28 tests
- Payment: 12 tests
- Driver: 29 tests
- Delivery: 9 tests
- Location: 17 tests

### Integration Tests

```
test/
└── (E2E tests would go here)
```

---

## 📜 Scripts (`scripts/`)

Utility scripts for database and development.

```
scripts/
├── init-db.sh                    # PostgreSQL + PostGIS initialization
└── (future scripts)
```

---

## 🚢 GPS Simulator (`gps-simulator/`)

Separate Node.js service for simulating driver GPS updates.

```
gps-simulator/
├── index.js                      # Main simulator logic
├── package.json                  # Dependencies (axios, dotenv)
├── .env.example                  # Configuration template
├── Dockerfile                    # Docker image for simulator
└── README.md                     # Usage documentation
```

**Features:**
- Simulates 50 drivers (configurable)
- Sends 10 GPS events/second (100ms interval per driver)
- Realistic movement patterns (random walk with velocity)
- Bounded within radius (stays in simulation area)
- Speed variation (10-40 km/h)
- GPS accuracy simulation (5-20 meters)
- Heading calculation
- Statistics reporting

---

## 🐳 Docker Setup

### Main Application

```
Dockerfile                        # Multi-stage build for production
.dockerignore                     # Exclude unnecessary files
docker-compose.yml                # Full system orchestration
```

**Services in docker-compose.yml:**
1. **postgres** - PostgreSQL 16 with PostGIS extension
2. **pgadmin** - Database management UI
3. **app** - Main NestJS application
4. **gps-simulator** - GPS data generator (optional profile)

---

## 📝 Documentation Files

```
README.md                         # Project overview and setup guide
ARCHITECTURE.md                   # System architecture and design decisions
PROJECT_STRUCTURE.md              # This file
CHAT_HISTORY.md                   # AI collaboration journey
ASSIGNMENT_ANALYSIS.md            # Requirements analysis and gap assessment
TASKS.md                          # Implementation task breakdown and progress
```

---

## 🔧 Configuration Files

```
.env.example                      # Environment variable template
.env.docker                       # Docker-specific environment template
.eslintrc.js                      # Code linting rules
.prettierrc                       # Code formatting rules
.gitignore                        # Git exclusions
.dockerignore                     # Docker build exclusions
jest.config.js                    # Jest test configuration
nest-cli.json                     # NestJS CLI settings
tsconfig.json                     # TypeScript compiler options
tsconfig.build.json               # Build-specific TS config
package.json                      # NPM scripts and dependencies
```

---

## 📊 Key Metrics

### Codebase Statistics

| Metric | Count |
|--------|-------|
| **Modules** | 8 |
| **Controllers** | 11 |
| **Services** | 15 |
| **Entities** | 13 |
| **DTOs** | 40+ |
| **Unit Tests** | 232 |
| **Lines of Code** | ~8,500 |

### Module Sizes

| Module | Files | Lines | Complexity |
|--------|-------|-------|------------|
| Location | 9 | ~950 | High |
| Order | 11 | ~1,200 | High |
| Restaurant | 12 | ~1,100 | Medium |
| Delivery | 8 | ~800 | High |
| Driver | 7 | ~700 | Medium |
| Auth | 10 | ~650 | Medium |
| User | 9 | ~550 | Low |
| Payment | 4 | ~400 | Low |

---

## 🚀 Getting Started

### Development Workflow

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Run database migrations:**
   ```bash
   npm run migration:run
   ```

4. **Seed database (optional):**
   ```bash
   npm run seed
   ```

5. **Start development server:**
   ```bash
   npm run start:dev
   ```

6. **Run tests:**
   ```bash
   npm test
   npm run test:cov
   ```

### Docker Workflow

1. **Start all services:**
   ```bash
   docker-compose up --build
   ```

2. **Start with GPS simulator:**
   ```bash
   docker-compose --profile simulator up
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f app
   ```

4. **Stop services:**
   ```bash
   docker-compose down
   ```

---

## 🎯 Module Dependencies

```
┌─────────┐
│  Auth   │◄─────────────┐
└────┬────┘              │
     │                   │
     ├──────┬────────────┼────────┬─────────┐
     ▼      ▼            ▼        ▼         ▼
┌─────┐ ┌──────┐   ┌─────────┐ ┌──────┐ ┌────────┐
│User │ │Driver│   │Restaurant│ │Order │ │Location│
└──┬──┘ └───┬──┘   └────┬────┘ └───┬──┘ └───┬────┘
   │        │           │          │        │
   │        │           └──────────┼────────┘
   │        │                      │
   │        └─────────┐    ┌───────┘
   │                  ▼    ▼
   │              ┌──────────┐
   └─────────────►│ Delivery │
                  └──────────┘
                       ▲
                       │
                  ┌────┴────┐
                  │ Payment │
                  └─────────┘
```

---

## 📚 Additional Resources

- **API Documentation:** http://localhost:4000/api (Swagger UI when app running)
- **Database Management:** http://localhost:5050 (PgAdmin when using Docker)
- **Winston Logs:** `logs/` directory
- **Test Reports:** `coverage/` directory (after running `npm run test:cov`)

---

**Last Updated:** January 5, 2026  
**Version:** 1.0  
**Author:** SwiftEats Development Team
