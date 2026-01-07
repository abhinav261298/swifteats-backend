# User Module

User profile and address management functionality.

## Features

- ✅ Get user profile
- ✅ Update user profile (name, phone)
- ✅ List all user addresses
- ✅ Create new address
- ✅ Update existing address
- ✅ Delete address
- ✅ Set default address
- ✅ Automatic default address management
- ✅ Coordinate validation (-90 to 90 for latitude, -180 to 180 for longitude)
- ✅ Phone number uniqueness validation

## Endpoints

All endpoints require authentication (JWT Bearer token).

### GET /api/v1/users/profile
Get current user profile.

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+919876543210",
  "role": "CUSTOMER",
  "isActive": true,
  "createdAt": "2026-01-04T10:00:00.000Z",
  "lastLoginAt": "2026-01-04T10:30:00.000Z"
}
```

### PATCH /api/v1/users/profile
Update current user profile.

**Request:**
```json
{
  "name": "Jane Doe",
  "phone": "+919876543211"
}
```

**Response (200):** Same as GET profile

**Errors:**
- 409: Phone number already in use

---

### GET /api/v1/users/addresses
Get all addresses for current user.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "label": "Home",
    "street": "123 Main Street, Apartment 4B",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postalCode": "400001",
    "latitude": 19.0760,
    "longitude": 72.8777,
    "deliveryInstructions": "Ring the doorbell twice",
    "isDefault": true,
    "createdAt": "2026-01-04T10:00:00.000Z",
    "updatedAt": "2026-01-04T10:00:00.000Z"
  }
]
```

---

### POST /api/v1/users/addresses
Create a new address.

**Request:**
```json
{
  "label": "Work",
  "street": "456 Office Complex, Floor 3",
  "city": "Mumbai",
  "state": "Maharashtra",
  "postalCode": "400050",
  "latitude": 19.0596,
  "longitude": 72.8295,
  "deliveryInstructions": "Ask for reception",
  "isDefault": false
}
```

**Response (201):** Address object

**Validation Rules:**
- `label`: 1-50 characters
- `street`: 5-200 characters
- `city`: 2-100 characters
- `state`: 2-100 characters
- `postalCode`: 5-10 characters
- `latitude`: -90 to 90
- `longitude`: -180 to 180
- `deliveryInstructions`: 0-500 characters (optional)
- `isDefault`: boolean (optional, defaults to false)

**Automatic Behavior:**
- If `isDefault` is true, other addresses are automatically unmarked as default
- If this is the first address, it's automatically set as default

---

### PATCH /api/v1/users/addresses/:id
Update an existing address.

**Request:** Same fields as POST (all optional)

```json
{
  "label": "Home (New)",
  "deliveryInstructions": "Leave at door"
}
```

**Response (200):** Updated address object

---

### DELETE /api/v1/users/addresses/:id
Delete an address.

**Response (204):** No content

**Automatic Behavior:**
- If deleting the default address, another address is automatically set as default

---

### POST /api/v1/users/addresses/:id/set-default
Set an address as the default address.

**Response (200):** Updated address object with `isDefault: true`

**Automatic Behavior:**
- Previous default address is automatically unmarked

---

## Business Logic

### Profile Update
1. Validate input data
2. Check phone number uniqueness (if changed)
3. Update user fields
4. Return updated profile (without password)

### Address Management
1. **Default Address Logic:**
   - Only one address can be default at a time
   - If setting a new default, old default is automatically unset
   - First address is automatically set as default
   - If deleting default address, another address becomes default

2. **Ownership Validation:**
   - All address operations verify the address belongs to the current user
   - User ID from JWT token is used for authorization

3. **Coordinate Validation:**
   - Latitude: -90 to 90 (class-validator)
   - Longitude: -180 to 180 (class-validator)

---

## File Structure

```
src/modules/user/
├── dto/
│   ├── update-user.dto.ts           # Profile update validation
│   ├── create-address.dto.ts        # Address creation validation
│   ├── update-address.dto.ts        # Address update validation
│   ├── user-response.dto.ts         # User profile response
│   ├── address-response.dto.ts      # Address response
│   └── index.ts
├── entities/
│   ├── user.entity.ts               # User database model
│   ├── address.entity.ts            # Address database model
│   └── index.ts
├── user.controller.ts               # API endpoints
├── user.service.ts                  # Business logic
├── user.module.ts                   # Module configuration
└── README.md                        # This file
```

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| USER_NOT_FOUND | 404 | User doesn't exist |
| USER_ALREADY_EXISTS | 409 | Phone number already in use |
| ADDRESS_NOT_FOUND | 404 | Address doesn't exist or doesn't belong to user |
| UNAUTHORIZED | 401 | Invalid or missing JWT token |

---

## Usage Examples

### Update Profile
```typescript
// With axios
const response = await axios.patch('/api/v1/users/profile', {
  name: 'New Name',
  phone: '+919999888877'
}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Create Address
```typescript
const address = await axios.post('/api/v1/users/addresses', {
  label: 'Home',
  street: '123 Main St',
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400001',
  latitude: 19.0760,
  longitude: 72.8777,
  isDefault: true
}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Set Default Address
```typescript
await axios.post(`/api/v1/users/addresses/${addressId}/set-default`, {}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

## Database Schema

### Address Table
```sql
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(50) NOT NULL,
  street TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  postal_code VARCHAR(20),
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  delivery_instructions TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);
```

---

## Security

- ✅ All endpoints protected by JWT authentication
- ✅ User can only access/modify their own profile
- ✅ User can only access/modify their own addresses
- ✅ Phone number uniqueness enforced
- ✅ Coordinate validation prevents invalid data
- ✅ Password never returned in responses

---

## Future Enhancements

- [ ] Address verification with Google Maps API
- [ ] Geocoding (address → coordinates)
- [ ] Reverse geocoding (coordinates → address)
- [ ] Distance calculation from restaurant
- [ ] Address validation (postal code format)
- [ ] Profile picture upload
- [ ] Email change with verification
- [ ] Password change endpoint

---

## Testing

See test files:
- `user.controller.spec.ts` - Controller tests
- `user.service.spec.ts` - Service tests

Run tests:
```bash
npm test -- user
```

---

## Dependencies

- **TypeORM**: Database ORM
- **class-validator**: DTO validation
- **class-transformer**: DTO transformation
- **@nestjs/jwt**: JWT authentication
- **@nestjs/passport**: Authentication strategy

---

## Related Modules

- **AuthModule**: Provides JWT authentication
- **OrderModule**: Uses addresses for delivery
- **DeliveryModule**: Uses addresses for route calculation
