import { HttpException, HttpStatus } from '@nestjs/common';

export class CustomHttpException extends HttpException {
  constructor(code: string, message: string, statusCode: number, details?: any) {
    super(
      {
        error: code,
        message,
        details,
      },
      statusCode,
    );
  }
}

// User-related exceptions
export class UserNotFoundException extends CustomHttpException {
  constructor(identifier?: string) {
    const message = identifier ? `User with ID ${identifier} not found` : 'User not found';
    super('USER_NOT_FOUND', message, HttpStatus.NOT_FOUND);
  }
}

export class UserAlreadyExistsException extends CustomHttpException {
  constructor(message?: string) {
    super('USER_ALREADY_EXISTS', message || 'User already exists', HttpStatus.CONFLICT);
  }
}

export class InvalidCredentialsException extends CustomHttpException {
  constructor() {
    super('INVALID_CREDENTIALS', 'Invalid email or password', HttpStatus.UNAUTHORIZED);
  }
}

export class UnauthorizedException extends CustomHttpException {
  constructor(message?: string) {
    super('UNAUTHORIZED', message || 'Unauthorized access', HttpStatus.UNAUTHORIZED);
  }
}

// Order-related exceptions
export class OrderNotFoundException extends CustomHttpException {
  constructor(orderId: string) {
    super('ORDER_NOT_FOUND', `Order with ID ${orderId} not found`, HttpStatus.NOT_FOUND);
  }
}

export class OrderCancellationNotAllowedException extends CustomHttpException {
  constructor(reason: string) {
    super('ORDER_CANCELLATION_NOT_ALLOWED', reason, HttpStatus.BAD_REQUEST);
  }
}

export class InvalidOrderStatusTransitionException extends CustomHttpException {
  constructor(from: string, to: string) {
    super(
      'INVALID_ORDER_STATUS_TRANSITION',
      `Cannot transition order from ${from} to ${to}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

// Restaurant-related exceptions
export class RestaurantNotFoundException extends CustomHttpException {
  constructor(restaurantId: string) {
    super(
      'RESTAURANT_NOT_FOUND',
      `Restaurant with ID ${restaurantId} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class RestaurantClosedException extends CustomHttpException {
  constructor(restaurantId: string) {
    super(
      'RESTAURANT_CLOSED',
      `Restaurant with ID ${restaurantId} is currently closed`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class MenuItemNotFoundException extends CustomHttpException {
  constructor(itemId: string) {
    super('MENU_ITEM_NOT_FOUND', `Menu item with ID ${itemId} not found`, HttpStatus.NOT_FOUND);
  }
}

export class MenuItemUnavailableException extends CustomHttpException {
  constructor(itemId: string) {
    super(
      'MENU_ITEM_UNAVAILABLE',
      `Menu item with ID ${itemId} is currently unavailable`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

// Driver-related exceptions
export class DriverNotFoundException extends CustomHttpException {
  constructor(driverId: string) {
    super('DRIVER_NOT_FOUND', `Driver with ID ${driverId} not found`, HttpStatus.NOT_FOUND);
  }
}

export class NoDriverAvailableException extends CustomHttpException {
  constructor() {
    super(
      'NO_DRIVER_AVAILABLE',
      'No driver available in the area. Please try again later.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

// Delivery-related exceptions
export class DeliveryNotFoundException extends CustomHttpException {
  constructor(deliveryId: string) {
    super('DELIVERY_NOT_FOUND', `Delivery with ID ${deliveryId} not found`, HttpStatus.NOT_FOUND);
  }
}

// Payment-related exceptions
export class PaymentFailedException extends CustomHttpException {
  constructor(reason?: string) {
    super(
      'PAYMENT_FAILED',
      reason || 'Payment processing failed. Please try again.',
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
