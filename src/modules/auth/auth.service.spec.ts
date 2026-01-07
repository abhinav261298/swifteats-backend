import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../user/entities/user.entity';
import { Session } from './entities/session.entity';
import { RegisterDto, LoginDto } from './dto';
import { UserRole } from '../../common/constants';
import {
  UserAlreadyExistsException,
  InvalidCredentialsException,
  UserNotFoundException,
} from '../../common/exceptions';

// Mock bcrypt at module level
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let sessionRepository: jest.Mocked<Repository<Session>>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    password: 'hashedPassword123',
    name: 'Test User',
    phone: '+919876543210',
    role: UserRole.CUSTOMER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Session),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    sessionRepository = module.get(getRepositoryToken(Session));
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  beforeEach(() => {
    // Reset and setup bcrypt mocks
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hashSync as jest.Mock).mockReturnValue('hashed-token');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser as any);
      userRepository.save.mockResolvedValue(mockUser);
      sessionRepository.create.mockReturnValue({} as any);
      sessionRepository.save.mockResolvedValue({} as any);
      sessionRepository.update.mockResolvedValue({ affected: 0 } as any);
      jwtService.sign.mockReturnValue('mock-jwt-token');
      configService.get.mockReturnValue(300);

      // Act
      const result = await service.register(mockRegisterDto);

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('expiresIn');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe(mockUser.email);
      expect(result.expiresIn).toBe(300);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: [{ email: mockRegisterDto.email }, { phone: mockRegisterDto.phone }],
      });
      expect(userRepository.save).toHaveBeenCalled();
      expect(sessionRepository.save).toHaveBeenCalled();
    });

    it('should throw UserAlreadyExistsException if email exists', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.register(mockRegisterDto)).rejects.toThrow(UserAlreadyExistsException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should throw UserAlreadyExistsException if phone exists', async () => {
      // Arrange
      const existingUser = { ...mockUser, email: 'different@example.com' };
      userRepository.findOne.mockResolvedValue(existingUser as any);

      // Act & Assert
      await expect(service.register(mockRegisterDto)).rejects.toThrow(UserAlreadyExistsException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should successfully login a user with valid credentials', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      sessionRepository.create.mockReturnValue({} as any);
      sessionRepository.save.mockResolvedValue({} as any);
      sessionRepository.update.mockResolvedValue({ affected: 1 } as any);
      jwtService.sign.mockReturnValue('mock-jwt-token');
      configService.get.mockReturnValue(300);

      // Act
      const result = await service.login(mockLoginDto, '127.0.0.1', 'Test-Agent');

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe(mockUser.email);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockLoginDto.email },
      });
      expect(userRepository.save).toHaveBeenCalled();
      expect(sessionRepository.update).toHaveBeenCalled();
      expect(sessionRepository.save).toHaveBeenCalled();
    });

    it('should throw InvalidCredentialsException if user not found', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(mockLoginDto)).rejects.toThrow(InvalidCredentialsException);
      expect(sessionRepository.save).not.toHaveBeenCalled();
    });

    it('should throw InvalidCredentialsException if password is invalid', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(mockLoginDto)).rejects.toThrow(InvalidCredentialsException);
      expect(sessionRepository.save).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, isActive: false };
      userRepository.findOne.mockResolvedValue(inactiveUser as any);

      // Act & Assert
      await expect(service.login(mockLoginDto)).rejects.toThrow(UnauthorizedException);
      expect(sessionRepository.save).not.toHaveBeenCalled();
    });

    it('should invalidate old sessions on new login (single device enforcement)', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      sessionRepository.create.mockReturnValue({} as any);
      sessionRepository.save.mockResolvedValue({} as any);
      sessionRepository.update.mockResolvedValue({ affected: 1 } as any);
      jwtService.sign.mockReturnValue('mock-jwt-token');
      configService.get.mockReturnValue(300);

      // Act
      await service.login(mockLoginDto);

      // Assert
      expect(sessionRepository.update).toHaveBeenCalledWith(
        { userId: mockUser.id, isActive: true },
        { isActive: false },
      );
    });
  });

  describe('logout', () => {
    it('should successfully logout user and invalidate session', async () => {
      // Arrange
      const mockSession = {
        id: 'session-uuid',
        userId: mockUser.id,
        tokenHash: 'hashed-token',
        isActive: true,
      };
      sessionRepository.findOne.mockResolvedValue(mockSession as any);
      sessionRepository.save.mockResolvedValue({ ...mockSession, isActive: false } as any);

      // Act
      await service.logout(mockUser.id, 'token-hash');

      // Assert
      expect(sessionRepository.findOne).toHaveBeenCalledWith({
        where: { userId: mockUser.id, tokenHash: 'token-hash', isActive: true },
      });
      expect(sessionRepository.save).toHaveBeenCalledWith({
        ...mockSession,
        isActive: false,
      });
    });

    it('should not throw error if session not found', async () => {
      // Arrange
      sessionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.logout(mockUser.id, 'token-hash')).resolves.not.toThrow();
      expect(sessionRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should successfully return current user', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.getCurrentUser(mockUser.id);

      // Assert
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('name');
      expect(result).not.toHaveProperty('password');
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it('should throw UserNotFoundException if user not found', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getCurrentUser('invalid-id')).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('validateUser', () => {
    it('should successfully validate user and session', async () => {
      // Arrange
      const mockSession = {
        id: 'session-uuid',
        userId: mockUser.id,
        tokenHash: 'hashed-token',
        isActive: true,
        expiresAt: new Date(Date.now() + 300000), // 5 minutes from now
        isExpired: jest.fn().mockReturnValue(false),
      };
      userRepository.findOne.mockResolvedValue(mockUser);
      sessionRepository.find.mockResolvedValue([mockSession] as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.validateUser(mockUser.id, 'jti-token');

      // Assert
      expect(result).toBe(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id, isActive: true },
      });
      expect(sessionRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUser.id, isActive: true },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('jti-token', 'hashed-token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.validateUser('invalid-id', 'jti')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(sessionRepository.find).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      // Arrange
      // When user is inactive, findOne with isActive: true returns null
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.validateUser(mockUser.id, 'jti')).rejects.toThrow(UnauthorizedException);
      expect(sessionRepository.find).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if no active sessions', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      sessionRepository.find.mockResolvedValue([]);

      // Act & Assert
      await expect(service.validateUser(mockUser.id, 'jti')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if session token does not match', async () => {
      // Arrange
      const mockSession = {
        id: 'session-uuid',
        userId: mockUser.id,
        tokenHash: 'hashed-token',
        isActive: true,
        expiresAt: new Date(Date.now() + 300000),
        isExpired: jest.fn().mockReturnValue(false),
      };
      userRepository.findOne.mockResolvedValue(mockUser);
      sessionRepository.find.mockResolvedValue([mockSession] as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // Token doesn't match

      // Act & Assert
      await expect(service.validateUser(mockUser.id, 'wrong-jti')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if session is expired', async () => {
      // Arrange
      const expiredSession = {
        id: 'session-uuid',
        userId: mockUser.id,
        tokenHash: 'hashed-token',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000), // Expired
        isExpired: jest.fn().mockReturnValue(true),
      };
      userRepository.findOne.mockResolvedValue(mockUser);
      sessionRepository.find.mockResolvedValue([expiredSession] as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act & Assert
      await expect(service.validateUser(mockUser.id, 'jti')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('password hashing', () => {
    it('should hash password with bcrypt during registration', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser as any);
      userRepository.save.mockResolvedValue(mockUser);
      sessionRepository.create.mockReturnValue({} as any);
      sessionRepository.save.mockResolvedValue({} as any);
      sessionRepository.update.mockResolvedValue({ affected: 0 } as any);
      jwtService.sign.mockReturnValue('mock-jwt-token');
      configService.get.mockReturnValue(300);

      // Act
      await service.register(mockRegisterDto);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(mockRegisterDto.password, 10);
    });

    it('should verify password with bcrypt during login', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      sessionRepository.create.mockReturnValue({} as any);
      sessionRepository.save.mockResolvedValue({} as any);
      sessionRepository.update.mockResolvedValue({ affected: 1 } as any);
      jwtService.sign.mockReturnValue('mock-jwt-token');
      configService.get.mockReturnValue(300);

      // Act
      await service.login(mockLoginDto);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(mockLoginDto.password, mockUser.password);
    });
  });

  describe('JWT token generation', () => {
    it('should generate JWT token with correct payload', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser as any);
      userRepository.save.mockResolvedValue(mockUser);
      sessionRepository.create.mockReturnValue({} as any);
      sessionRepository.save.mockResolvedValue({} as any);
      sessionRepository.update.mockResolvedValue({ affected: 0 } as any);
      configService.get.mockReturnValue(300);

      jwtService.sign.mockReturnValue('mock-jwt-token');

      // Act
      await service.register(mockRegisterDto);

      // Assert
      expect(jwtService.sign).toHaveBeenCalled();
      const payload = (jwtService.sign as jest.Mock).mock.calls[0][0];
      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('email');
      expect(payload).toHaveProperty('role');
      expect(payload).toHaveProperty('jti');
    });

    it('should use configured expiration time', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser as any);
      userRepository.save.mockResolvedValue(mockUser);
      sessionRepository.create.mockReturnValue({} as any);
      sessionRepository.save.mockResolvedValue({} as any);
      sessionRepository.update.mockResolvedValue({ affected: 0 } as any);
      jwtService.sign.mockReturnValue('mock-jwt-token');
      configService.get.mockReturnValue(600); // 10 minutes

      // Act
      const result = await service.register(mockRegisterDto);

      // Assert
      expect(configService.get).toHaveBeenCalledWith('jwt.expiresIn', 300);
      expect(result.expiresIn).toBe(600);
    });
  });
});
