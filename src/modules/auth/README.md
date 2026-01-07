# Authentication Module

JWT-based authentication with session management and role-based access control.

## Features

- ✅ User registration with validation
- ✅ User login with JWT tokens
- ✅ Session management (single device enforcement)
- ✅ Token expiration (5 minutes)
- ✅ Password hashing with bcrypt
- ✅ Protected routes with JWT guard
- ✅ Public route decorator
- ✅ User profile retrieval
- ✅ Logout (session invalidation)

## Endpoints

### POST /api/v1/auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "phone": "+919876543210",
  "role": "CUSTOMER"
}
```

**Response (201):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+919876543210",
    "role": "CUSTOMER",
    "isActive": true,
    "createdAt": "2026-01-04T09:00:00.000Z"
  },
  "expiresIn": 300
}
```

### POST /api/v1/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):** Same as registration

### GET /api/v1/auth/me
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+919876543210",
  "role": "CUSTOMER",
  "isActive": true,
  "createdAt": "2026-01-04T09:00:00.000Z"
}
```

### POST /api/v1/auth/logout
Logout and invalidate session (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (204):** No content

## Security

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (@$!%*?&)

### Session Management
- Single device enforcement (old sessions invalidated on new login)
- Session expiration after 5 minutes
- Manual logout support
- Session tracking with IP address and user agent

### JWT Token
- Signed with HS256 algorithm
- 5-minute expiration
- Includes user ID, email, role, and unique token ID (jti)
- Token ID hashed and stored in session table

## Usage in Other Modules

### Protect a route
```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../../common/decorators';

@Controller('protected')
export class ProtectedController {
  @Get()
  @UseGuards(JwtAuthGuard)  // Optional - already applied globally
  getData(@CurrentUser('userId') userId: string) {
    return { userId };
  }
}
```

### Make a route public
```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators';

@Controller('public')
export class PublicController {
  @Public()  // Skip authentication
  @Get()
  getData() {
    return { message: 'This is public' };
  }
}
```

### Get current user
```typescript
import { CurrentUser } from '../../common/decorators';

@Get('profile')
async getProfile(@CurrentUser('userId') userId: string) {
  // userId is extracted from JWT
}

// Or get entire user object
@Get('profile')
async getProfile(@CurrentUser() user: any) {
  // user = { userId, email, role, jti }
}
```

## Test Users

Use these credentials to test (password for all: `Password123!`):

| Email | Role | Description |
|-------|------|-------------|
| admin@swifteats.com | ADMIN | System admin |
| customer1@example.com | CUSTOMER | Test customer |
| owner1@restaurant.com | RESTAURANT | Restaurant owner |
| driver1@swifteats.com | DRIVER | Delivery driver |

## Configuration

Required environment variables:

```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=300
```

## Files Structure

```
src/modules/auth/
├── dto/
│   ├── register.dto.ts          # Registration validation
│   ├── login.dto.ts             # Login validation
│   ├── login-response.dto.ts    # Response DTOs
│   └── index.ts
├── entities/
│   ├── session.entity.ts        # Session model
│   └── index.ts
├── guards/
│   ├── jwt-auth.guard.ts        # JWT authentication guard
│   └── index.ts
├── strategies/
│   └── jwt.strategy.ts          # Passport JWT strategy
├── auth.controller.ts           # API endpoints
├── auth.service.ts              # Business logic
├── auth.module.ts               # Module configuration
└── README.md                    # This file
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| USER_ALREADY_EXISTS | 409 | Email or phone already registered |
| INVALID_CREDENTIALS | 401 | Wrong email or password |
| UNAUTHORIZED | 401 | Invalid or expired token |
| USER_NOT_FOUND | 404 | User doesn't exist |

## Future Enhancements

- [ ] Refresh tokens for longer sessions
- [ ] Email verification
- [ ] Password reset flow
- [ ] Two-factor authentication
- [ ] Rate limiting on auth endpoints
- [ ] Account lockout after failed attempts
- [ ] OAuth integration (Google, Facebook)
