# Restaurant & Menu Module

Complete restaurant management and customer browsing functionality with PostGIS-based location search.

## Features

### Customer Features
- ✅ Browse nearby restaurants (location-based search with Haversine formula)
- ✅ Filter by cuisine type, open status, search by name
- ✅ View restaurant details
- ✅ Browse restaurant menu
- ✅ Filter menu by category
- ✅ View only approved and active restaurants

### Restaurant Owner Features
- ✅ Create restaurant profile (first-time setup)
- ✅ Update restaurant profile
- ✅ Toggle restaurant open/closed status
- ✅ Manage menu items (CRUD operations)
- ✅ View own restaurant and menu

## Architecture

### Controllers
- **RestaurantController** - Customer-facing endpoints (`/restaurants`)
- **RestaurantOwnerController** - Owner management endpoints (`/restaurant`)

### Services
- **RestaurantService** - Restaurant profile and search operations
- **MenuService** - Menu item CRUD operations

### Entities
- **Restaurant** - Restaurant profile with PostGIS coordinates
- **MenuItem** - Menu items belonging to restaurants

---

## API Endpoints

### Customer Endpoints

#### GET /api/v1/restaurants
Browse nearby restaurants with filters.

**Query Parameters:**
- `latitude` (number, optional) - User latitude
- `longitude` (number, optional) - User longitude
- `radius` (number, optional) - Search radius in km (default: 10, max: 50)
- `cuisineType` (string, optional) - Filter by cuisine type
- `isOpen` (boolean, optional) - Filter only open restaurants
- `search` (string, optional) - Search by restaurant name

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "The Great Indian Kitchen",
    "description": "Authentic Indian cuisine",
    "phone": "+919876543210",
    "address": "123 MG Road",
    "city": "Mumbai",
    "state": "Maharashtra",
    "cuisineType": "Indian",
    "rating": 4.5,
    "totalReviews": 250,
    "isOpen": true,
    "openingTime": "09:00",
    "closingTime": "22:00",
    "averagePreparationTimeMins": 30,
    "imageUrl": "https://example.com/image.jpg",
    "distance": "2.45"
  }
]
```

**Distance Calculation:**
- Uses Haversine formula: `6371 * acos(cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1)) + sin(radians(lat1)) * sin(radians(lat2)))`
- Results sorted by distance (ascending) when location provided
- Results sorted by rating (descending) when no location provided

#### GET /api/v1/restaurants/:id
Get restaurant details.

**Response:**
```json
{
  "id": "uuid",
  "name": "The Great Indian Kitchen",
  "description": "Authentic Indian cuisine",
  "phone": "+919876543210",
  "email": "restaurant@example.com",
  "address": "123 MG Road",
  "city": "Mumbai",
  "state": "Maharashtra",
  "postalCode": "400001",
  "latitude": 19.076,
  "longitude": 72.8777,
  "cuisineType": "Indian",
  "rating": 4.5,
  "totalReviews": 250,
  "isOpen": true,
  "status": "ACTIVE",
  "approvalStatus": "APPROVED",
  "openingTime": "09:00",
  "closingTime": "22:00",
  "averagePreparationTimeMins": 30,
  "imageUrl": "https://example.com/image.jpg",
  "createdAt": "2026-01-04T10:00:00.000Z",
  "updatedAt": "2026-01-04T10:00:00.000Z"
}
```

#### GET /api/v1/restaurants/:id/menu
Get restaurant menu.

**Query Parameters:**
- `category` (string, optional) - Filter by category

**Response:**
```json
[
  {
    "id": "uuid",
    "restaurantId": "uuid",
    "name": "Butter Chicken",
    "description": "Tender chicken in rich tomato sauce",
    "price": 350.00,
    "category": "Main Course",
    "isAvailable": true,
    "isVegetarian": false,
    "isVegan": false,
    "imageUrl": "https://example.com/butter-chicken.jpg",
    "preparationTimeMins": 20,
    "createdAt": "2026-01-04T10:00:00.000Z",
    "updatedAt": "2026-01-04T10:00:00.000Z"
  }
]
```

---

### Restaurant Owner Endpoints

#### GET /api/v1/restaurant/profile
Get own restaurant profile.

**Response:** Same as restaurant details above

#### POST /api/v1/restaurant/profile
Create restaurant profile (first-time setup).

**Request Body:**
```json
{
  "name": "The Great Indian Kitchen",
  "description": "Authentic Indian cuisine with modern twist",
  "phone": "+919876543210",
  "email": "restaurant@example.com",
  "address": "123 MG Road, Brigade Road",
  "city": "Mumbai",
  "state": "Maharashtra",
  "postalCode": "400001",
  "latitude": 19.076,
  "longitude": 72.8777,
  "cuisineType": "Indian",
  "openingTime": "09:00",
  "closingTime": "22:00",
  "averagePreparationTimeMins": 30,
  "imageUrl": "https://example.com/restaurant.jpg"
}
```

**Validation:**
- Name: 2-255 characters
- Phone: +91XXXXXXXXXX format, must be unique
- Address: 10-500 characters
- City: 2-100 characters
- Latitude: -90 to 90
- Longitude: -180 to 180
- Opening/Closing Time: HH:MM format (24-hour)
- Average Preparation Time: 5-180 minutes

**Response:** Created restaurant object

#### PATCH /api/v1/restaurant/profile
Update restaurant profile.

**Request Body:** Same as create (all fields optional)

**Response:** Updated restaurant object

#### PATCH /api/v1/restaurant/status
Toggle restaurant open/closed status.

**Request Body:**
```json
{
  "isOpen": true
}
```

**Requirements:**
- Restaurant must be APPROVED
- Restaurant must be ACTIVE

**Response:** Updated restaurant object

#### GET /api/v1/restaurant/menu
Get own restaurant menu.

**Response:** Array of menu items

#### POST /api/v1/restaurant/menu
Create menu item.

**Request Body:**
```json
{
  "name": "Butter Chicken",
  "description": "Tender chicken in rich tomato and butter sauce",
  "price": 350.00,
  "category": "Main Course",
  "isAvailable": true,
  "isVegetarian": false,
  "isVegan": false,
  "imageUrl": "https://example.com/butter-chicken.jpg",
  "preparationTimeMins": 20
}
```

**Validation:**
- Name: 2-255 characters
- Price: >= 0
- Category: 2-100 characters
- Preparation Time: 0-180 minutes

**Response:** Created menu item

#### PATCH /api/v1/restaurant/menu/:id
Update menu item.

**Request Body:** Same as create (all fields optional)

**Common Use Cases:**
```json
// Toggle availability
{ "isAvailable": false }

// Update price
{ "price": 399.00 }

// Update name and description
{
  "name": "Special Butter Chicken",
  "description": "Chef's special recipe"
}
```

**Response:** Updated menu item

#### DELETE /api/v1/restaurant/menu/:id
Delete menu item.

**Response:** 204 No Content

---

## Business Logic

### Restaurant Status Flow

```
PENDING → (Admin Approval) → APPROVED
   ↓
ACTIVE ←→ INACTIVE (Admin can toggle)
   ↓
CLOSED (Permanently closed)
```

### Approval Status

- **PENDING** - Waiting for admin review
- **APPROVED** - Approved by admin, can operate
- **REJECTED** - Rejected by admin

### Open/Close Logic

- Owner can toggle `isOpen` status
- Only allowed if restaurant is:
  - `approvalStatus = APPROVED`
  - `status = ACTIVE`
- Does not affect restaurant status

### Customer Visibility

Customers can only see restaurants where:
- `status = ACTIVE`
- `approvalStatus = APPROVED`

Menu items customers can see:
- `isAvailable = true`

---

## Location-Based Search

### Haversine Formula Implementation

```sql
SELECT *, 
  (6371 * acos(
    cos(radians(:latitude)) * 
    cos(radians(restaurant.latitude)) * 
    cos(radians(restaurant.longitude) - radians(:longitude)) + 
    sin(radians(:latitude)) * 
    sin(radians(restaurant.latitude))
  )) AS distance
FROM restaurants
WHERE ...
HAVING distance <= :radius
ORDER BY distance ASC
```

### Distance Units
- All distances in **kilometers**
- Default radius: 10 km
- Maximum radius: 50 km

### Performance Considerations
- Indexed on `[latitude, longitude]`
- Indexed on `[status, isOpen]`
- Menu items indexed on `[restaurantId, isAvailable]`
- Menu items indexed on `[category]`

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| RESTAURANT_NOT_FOUND | 404 | Restaurant not found or not available |
| RESTAURANT_ALREADY_EXISTS | 409 | Owner already has a restaurant |
| PHONE_ALREADY_EXISTS | 409 | Phone number already registered |
| RESTAURANT_NOT_APPROVED | 403 | Cannot change status until approved |
| RESTAURANT_NOT_ACTIVE | 403 | Restaurant must be active |
| MENU_ITEM_NOT_FOUND | 404 | Menu item not found or not yours |

---

## Testing Examples

### Customer Browsing

```bash
# Find nearby restaurants
GET /api/v1/restaurants?latitude=19.076&longitude=72.8777&radius=5&isOpen=true
Authorization: Bearer <token>

# Search by name
GET /api/v1/restaurants?search=pizza
Authorization: Bearer <token>

# Filter by cuisine
GET /api/v1/restaurants?cuisineType=Italian&isOpen=true
Authorization: Bearer <token>

# Get restaurant details
GET /api/v1/restaurants/{restaurantId}
Authorization: Bearer <token>

# Get menu
GET /api/v1/restaurants/{restaurantId}/menu
Authorization: Bearer <token>

# Get menu by category
GET /api/v1/restaurants/{restaurantId}/menu?category=Main%20Course
Authorization: Bearer <token>
```

### Restaurant Owner

```bash
# Create restaurant (first time)
POST /api/v1/restaurant/profile
Authorization: Bearer <restaurant-owner-token>
Content-Type: application/json

{
  "name": "My Restaurant",
  "phone": "+919876543210",
  "address": "123 Street",
  "city": "Mumbai",
  "latitude": 19.076,
  "longitude": 72.8777,
  "cuisineType": "Indian",
  "openingTime": "09:00",
  "closingTime": "22:00"
}

# Get own restaurant
GET /api/v1/restaurant/profile
Authorization: Bearer <restaurant-owner-token>

# Update restaurant
PATCH /api/v1/restaurant/profile
Authorization: Bearer <restaurant-owner-token>
Content-Type: application/json

{
  "description": "Updated description",
  "openingTime": "08:00"
}

# Toggle open/closed
PATCH /api/v1/restaurant/status
Authorization: Bearer <restaurant-owner-token>
Content-Type: application/json

{
  "isOpen": false
}

# Create menu item
POST /api/v1/restaurant/menu
Authorization: Bearer <restaurant-owner-token>
Content-Type: application/json

{
  "name": "Butter Chicken",
  "price": 350.00,
  "category": "Main Course",
  "isVegetarian": false
}

# Update menu item
PATCH /api/v1/restaurant/menu/{menuItemId}
Authorization: Bearer <restaurant-owner-token>
Content-Type: application/json

{
  "isAvailable": false
}

# Delete menu item
DELETE /api/v1/restaurant/menu/{menuItemId}
Authorization: Bearer <restaurant-owner-token>
```

---

## Database Schema

### restaurants table
```sql
- id: UUID (PK)
- ownerId: UUID (FK → users.id)
- name: VARCHAR(255)
- description: TEXT
- phone: VARCHAR(20) UNIQUE
- email: VARCHAR(255)
- address: TEXT
- city: VARCHAR(100)
- state: VARCHAR(100)
- postalCode: VARCHAR(20)
- latitude: DECIMAL(10,7)
- longitude: DECIMAL(10,7)
- cuisineType: VARCHAR(100)
- rating: DECIMAL(3,2) DEFAULT 0
- totalReviews: INT DEFAULT 0
- isOpen: BOOLEAN DEFAULT false
- status: ENUM('PENDING','ACTIVE','INACTIVE','CLOSED') DEFAULT 'PENDING'
- approvalStatus: ENUM('PENDING','APPROVED','REJECTED') DEFAULT 'PENDING'
- approvalNotes: TEXT
- approvedAt: TIMESTAMP
- openingTime: VARCHAR(10) DEFAULT '09:00'
- closingTime: VARCHAR(10) DEFAULT '22:00'
- averagePreparationTimeMins: INT DEFAULT 30
- imageUrl: VARCHAR(500)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP

Indexes:
- (status, isOpen)
- (latitude, longitude)
```

### menu_items table
```sql
- id: UUID (PK)
- restaurantId: UUID (FK → restaurants.id)
- name: VARCHAR(255)
- description: TEXT
- price: DECIMAL(10,2)
- category: VARCHAR(100)
- isAvailable: BOOLEAN DEFAULT true
- isVegetarian: BOOLEAN DEFAULT false
- isVegan: BOOLEAN DEFAULT false
- imageUrl: VARCHAR(500)
- preparationTimeMins: INT DEFAULT 0
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP

Indexes:
- (restaurantId, isAvailable)
- (category)
```

---

## Security

### Authentication
- ✅ All endpoints require JWT authentication
- ✅ Customer endpoints: Any authenticated user
- ✅ Owner endpoints: Only restaurant owner can access own restaurant

### Authorization
- ✅ Owners can only manage their own restaurant
- ✅ Owners can only manage their own menu items
- ✅ Ownership checked via `ownerId` in JWT

### Data Validation
- ✅ All inputs validated with class-validator
- ✅ Coordinates validated (-90 to 90, -180 to 180)
- ✅ Phone number format validated
- ✅ Time format validated (HH:MM)

---

## Future Enhancements

- [ ] Caching for restaurant list and menus (in-memory / Redis)
- [ ] Materialized view for restaurant_menu_cache
- [ ] Image upload functionality
- [ ] Restaurant analytics
- [ ] Menu item popularity tracking
- [ ] Automatic rating calculation from reviews
- [ ] Opening hours per day of week
- [ ] Special hours (holidays)
- [ ] Delivery radius per restaurant
- [ ] Minimum order amount

---

## Related Modules

- **Auth Module** - JWT authentication
- **User Module** - Restaurant owners
- **Order Module** (Task 7) - Orders from restaurants
- **Review Module** (Future) - Customer reviews

---

**Status:** ✅ READY FOR TESTING
