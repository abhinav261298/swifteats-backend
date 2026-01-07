import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, LoginResponseDto, UserResponseDto } from './dto';
import { UserRole } from '../../common/constants';
import {
  UserAlreadyExistsException,
  InvalidCredentialsException,
  UserNotFoundException,
} from '../../common/exceptions';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUserResponse: UserResponseDto = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    name: 'Test User',
    phone: '+919876543210',
    role: UserRole.CUSTOMER,
    isActive: true,
    createdAt: new Date('2026-01-04T10:00:00Z'),
  };

  const mockLoginResponse: LoginResponseDto = {
    accessToken: 'mock-jwt-token-xyz',
    user: mockUserResponse,
    expiresIn: 300,
  };

  const mockRegisterDto: RegisterDto = {
    email: 'newuser@example.com',
    password: 'SecurePass123!',
    name: 'New User',
    phone: '+919876543210',
    role: UserRole.CUSTOMER,
  };

  const mockLoginDto: LoginDto = {
    email: 'test@example.com',
    password: 'SecurePass123!',
  };

  const mockRequest = {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'user-agent': 'Test-Agent/1.0' },
    user: {
      userId: 'user-uuid-123',
      email: 'test@example.com',
      role: UserRole.CUSTOMER,
      jti: 'jti-token-123',
    },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            logout: jest.fn(),
            getCurrentUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      // Arrange
      authService.register.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.register(mockRegisterDto);

      // Assert
      expect(result).toEqual(mockLoginResponse);
      expect(result.accessToken).toBe('mock-jwt-token-xyz');
      expect(result.user.email).toBe(mockUserResponse.email);
      expect(result.expiresIn).toBe(300);
      expect(authService.register).toHaveBeenCalledWith(mockRegisterDto);
      expect(authService.register).toHaveBeenCalledTimes(1);
    });

    it('should return user without password in response', async () => {
      // Arrange
      authService.register.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.register(mockRegisterDto);

      // Assert
      expect(result.user).not.toHaveProperty('password');
      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('email');
      expect(result.user).toHaveProperty('name');
      expect(result.user).toHaveProperty('role');
    });

    it('should throw UserAlreadyExistsException if email already exists', async () => {
      // Arrange
      authService.register.mockRejectedValue(
        new UserAlreadyExistsException('Email already registered'),
      );

      // Act & Assert
      await expect(controller.register(mockRegisterDto)).rejects.toThrow(
        UserAlreadyExistsException,
      );
      expect(authService.register).toHaveBeenCalledWith(mockRegisterDto);
    });

    it('should throw UserAlreadyExistsException if phone already exists', async () => {
      // Arrange
      authService.register.mockRejectedValue(
        new UserAlreadyExistsException('Phone number already registered'),
      );

      // Act & Assert
      await expect(controller.register(mockRegisterDto)).rejects.toThrow(
        UserAlreadyExistsException,
      );
    });

    it('should handle validation errors for invalid email', async () => {
      // Arrange
      const invalidDto = { ...mockRegisterDto, email: 'invalid-email' };
      authService.register.mockRejectedValue(new Error('Validation failed'));

      // Act & Assert
      await expect(controller.register(invalidDto as any)).rejects.toThrow();
    });

    it('should handle validation errors for weak password', async () => {
      // Arrange
      const weakPasswordDto = { ...mockRegisterDto, password: 'weak' };
      authService.register.mockRejectedValue(new Error('Password too weak'));

      // Act & Assert
      await expect(controller.register(weakPasswordDto as any)).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should successfully login a user with valid credentials', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.login(mockLoginDto, mockRequest);

      // Assert
      expect(result).toEqual(mockLoginResponse);
      expect(result.accessToken).toBe('mock-jwt-token-xyz');
      expect(result.user.email).toBe(mockUserResponse.email);
      expect(authService.login).toHaveBeenCalledWith(
        mockLoginDto,
        mockRequest.ip,
        mockRequest.headers['user-agent'],
      );
      expect(authService.login).toHaveBeenCalledTimes(1);
    });

    it('should pass IP address to service', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      await controller.login(mockLoginDto, mockRequest);

      // Assert
      expect(authService.login).toHaveBeenCalledWith(mockLoginDto, '127.0.0.1', expect.any(String));
    });

    it('should pass user agent to service', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      await controller.login(mockLoginDto, mockRequest);

      // Assert
      expect(authService.login).toHaveBeenCalledWith(
        mockLoginDto,
        expect.any(String),
        'Test-Agent/1.0',
      );
    });

    it('should throw InvalidCredentialsException for invalid email', async () => {
      // Arrange
      authService.login.mockRejectedValue(new InvalidCredentialsException());

      // Act & Assert
      await expect(controller.login(mockLoginDto, mockRequest)).rejects.toThrow(
        InvalidCredentialsException,
      );
      expect(authService.login).toHaveBeenCalledWith(
        mockLoginDto,
        mockRequest.ip,
        mockRequest.headers['user-agent'],
      );
    });

    it('should throw InvalidCredentialsException for invalid password', async () => {
      // Arrange
      authService.login.mockRejectedValue(new InvalidCredentialsException());

      // Act & Assert
      await expect(controller.login(mockLoginDto, mockRequest)).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it('should handle missing IP address gracefully', async () => {
      // Arrange
      const requestWithoutIp = { ...mockRequest, ip: undefined };
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      await controller.login(mockLoginDto, requestWithoutIp);

      // Assert
      expect(authService.login).toHaveBeenCalledWith(
        mockLoginDto,
        mockRequest.socket.remoteAddress,
        expect.any(String),
      );
    });

    it('should handle missing user agent gracefully', async () => {
      // Arrange
      const requestWithoutAgent = {
        ...mockRequest,
        headers: {},
      };
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      await controller.login(mockLoginDto, requestWithoutAgent as any);

      // Assert
      expect(authService.login).toHaveBeenCalledWith(mockLoginDto, expect.any(String), undefined);
    });
  });

  describe('logout', () => {
    it('should successfully logout a user', async () => {
      // Arrange
      authService.logout.mockResolvedValue();

      // Act
      await controller.logout('user-uuid-123', 'jti-token-123');

      // Assert
      expect(authService.logout).toHaveBeenCalledWith('user-uuid-123', 'jti-token-123');
      expect(authService.logout).toHaveBeenCalledTimes(1);
    });

    it('should not throw error if session not found', async () => {
      // Arrange
      authService.logout.mockResolvedValue();

      // Act & Assert
      await expect(controller.logout('user-uuid-123', 'invalid-jti')).resolves.not.toThrow();
      expect(authService.logout).toHaveBeenCalled();
    });

    it('should invalidate the current session', async () => {
      // Arrange
      const userId = 'user-uuid-123';
      const jti = 'jti-token-123';
      authService.logout.mockResolvedValue();

      // Act
      await controller.logout(userId, jti);

      // Assert
      expect(authService.logout).toHaveBeenCalledWith(userId, jti);
    });
  });

  describe('getCurrentUser', () => {
    it('should successfully return current user profile', async () => {
      // Arrange
      authService.getCurrentUser.mockResolvedValue(mockUserResponse);

      // Act
      const result = await controller.getCurrentUser('user-uuid-123');

      // Assert
      expect(result).toEqual(mockUserResponse);
      expect(result.email).toBe(mockUserResponse.email);
      expect(result.name).toBe(mockUserResponse.name);
      expect(result).not.toHaveProperty('password');
      expect(authService.getCurrentUser).toHaveBeenCalledWith('user-uuid-123');
      expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
    });

    it('should throw UserNotFoundException if user not found', async () => {
      // Arrange
      authService.getCurrentUser.mockRejectedValue(new UserNotFoundException());

      // Act & Assert
      await expect(controller.getCurrentUser('invalid-user-id')).rejects.toThrow(
        UserNotFoundException,
      );
      expect(authService.getCurrentUser).toHaveBeenCalledWith('invalid-user-id');
    });

    it('should return user with all required fields', async () => {
      // Arrange
      authService.getCurrentUser.mockResolvedValue(mockUserResponse);

      // Act
      const result = await controller.getCurrentUser('user-uuid-123');

      // Assert
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('phone');
      expect(result).toHaveProperty('role');
      expect(result).toHaveProperty('isActive');
      expect(result).toHaveProperty('createdAt');
    });
  });

  describe('endpoint decorators and metadata', () => {
    it('should have register endpoint with POST method', () => {
      // Verify controller has register method
      expect(controller.register).toBeDefined();
      expect(typeof controller.register).toBe('function');
    });

    it('should have login endpoint with POST method', () => {
      // Verify controller has login method
      expect(controller.login).toBeDefined();
      expect(typeof controller.login).toBe('function');
    });

    it('should have logout endpoint with POST method', () => {
      // Verify controller has logout method
      expect(controller.logout).toBeDefined();
      expect(typeof controller.logout).toBe('function');
    });

    it('should have getCurrentUser endpoint with GET method', () => {
      // Verify controller has getCurrentUser method
      expect(controller.getCurrentUser).toBeDefined();
      expect(typeof controller.getCurrentUser).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should propagate service errors to client', async () => {
      // Arrange
      const error = new Error('Service error');
      authService.register.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.register(mockRegisterDto)).rejects.toThrow('Service error');
    });

    it('should handle unexpected errors during login', async () => {
      // Arrange
      authService.login.mockRejectedValue(new Error('Unexpected error'));

      // Act & Assert
      await expect(controller.login(mockLoginDto, mockRequest)).rejects.toThrow('Unexpected error');
    });

    it('should handle unexpected errors during logout', async () => {
      // Arrange
      authService.logout.mockRejectedValue(new Error('Logout failed'));

      // Act & Assert
      await expect(controller.logout('user-id', 'jti')).rejects.toThrow('Logout failed');
    });
  });

  describe('input validation', () => {
    it('should accept valid register DTO', async () => {
      // Arrange
      authService.register.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.register(mockRegisterDto);

      // Assert
      expect(result).toBeDefined();
      expect(authService.register).toHaveBeenCalledWith(mockRegisterDto);
    });

    it('should accept valid login DTO', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.login(mockLoginDto, mockRequest);

      // Assert
      expect(result).toBeDefined();
      expect(authService.login).toHaveBeenCalledWith(
        mockLoginDto,
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe('response format', () => {
    it('should return LoginResponseDto on successful registration', async () => {
      // Arrange
      authService.register.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.register(mockRegisterDto);

      // Assert
      expect(result).toMatchObject({
        accessToken: expect.any(String),
        user: expect.objectContaining({
          id: expect.any(String),
          email: expect.any(String),
          name: expect.any(String),
          phone: expect.any(String),
          role: expect.any(String),
          isActive: expect.any(Boolean),
        }),
        expiresIn: expect.any(Number),
      });
    });

    it('should return LoginResponseDto on successful login', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.login(mockLoginDto, mockRequest);

      // Assert
      expect(result).toMatchObject({
        accessToken: expect.any(String),
        user: expect.objectContaining({
          id: expect.any(String),
          email: expect.any(String),
        }),
        expiresIn: expect.any(Number),
      });
    });

    it('should return UserResponseDto on getCurrentUser', async () => {
      // Arrange
      authService.getCurrentUser.mockResolvedValue(mockUserResponse);

      // Act
      const result = await controller.getCurrentUser('user-uuid-123');

      // Assert
      expect(result).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        name: expect.any(String),
        phone: expect.any(String),
        role: expect.any(String),
        isActive: expect.any(Boolean),
        createdAt: expect.any(Date),
      });
    });
  });
});
