import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../user/entities/user.entity';
import { Session } from './entities/session.entity';
import { RegisterDto, LoginDto, LoginResponseDto, UserResponseDto } from './dto';
import { UserRole } from '../../common/constants';
import {
  UserAlreadyExistsException,
  InvalidCredentialsException,
  UserNotFoundException,
} from '../../common/exceptions';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<LoginResponseDto> {
    this.logger.log(`Registering new user with email: ${registerDto.email}`);

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ email: registerDto.email }, { phone: registerDto.phone }],
    });

    if (existingUser) {
      if (existingUser.email === registerDto.email) {
        throw new UserAlreadyExistsException('Email already registered');
      }
      throw new UserAlreadyExistsException('Phone number already registered');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(registerDto.password);

    // Create user
    const user = this.userRepository.create({
      ...registerDto,
      password: hashedPassword,
    });

    await this.userRepository.save(user);

    this.logger.log(`User registered successfully: ${user.id}`);

    // Generate JWT and create session
    return this.generateTokenAndSession(user);
  }

  /**
   * Login user
   */
  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponseDto> {
    this.logger.log(`Login attempt for email: ${loginDto.email}`);

    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new InvalidCredentialsException();
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    this.logger.log(`User logged in successfully: ${user.id}`);

    // Generate JWT and create session
    return this.generateTokenAndSession(user, ipAddress, userAgent);
  }

  /**
   * Logout user (invalidate session)
   */
  async logout(userId: string, tokenHash: string): Promise<void> {
    this.logger.log(`Logout request for user: ${userId}`);

    const session = await this.sessionRepository.findOne({
      where: { userId, tokenHash, isActive: true },
    });

    if (session) {
      session.isActive = false;
      await this.sessionRepository.save(session);
      this.logger.log(`Session invalidated for user: ${userId}`);
    }
  }

  /**
   * Get current user by ID
   */
  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundException();
    }

    return this.mapUserToResponse(user);
  }

  /**
   * Validate JWT payload and session
   */
  async validateUser(userId: string, jti: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Get all active sessions for user
    const sessions = await this.sessionRepository.find({
      where: { userId, isActive: true },
    });

    if (!sessions || sessions.length === 0) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Find session by comparing hashed tokens
    let validSession = null;
    for (const session of sessions) {
      if (await bcrypt.compare(jti, session.tokenHash)) {
        validSession = session;
        break;
      }
    }

    if (!validSession) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Check if session expired
    if (validSession.isExpired()) {
      throw new UnauthorizedException('Session expired');
    }

    return user;
  }

  /**
   * Hash password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Generate JWT token and create session
   */
  private async generateTokenAndSession(
    user: User,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponseDto> {
    // Generate unique token ID (jti)
    const jti = uuidv4();

    // JWT payload - include role-specific IDs
    const payload: any = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
    };

    // Add userId for consistency
    payload.userId = user.id;

    // If user is a driver, include driverId
    if (user.role === UserRole.DRIVER) {
      const driver = await this.userRepository.manager
        .getRepository('Driver')
        .findOne({ where: { userId: user.id } });
      if (driver) {
        payload.driverId = driver.id;
      }
    }

    // If user is restaurant owner, include restaurantId
    if (user.role === UserRole.RESTAURANT) {
      const restaurant = await this.userRepository.manager
        .getRepository('Restaurant')
        .findOne({ where: { ownerId: user.id } });
      if (restaurant) {
        payload.restaurantId = restaurant.id;
      }
    }

    // Token expiration (5 minutes as per requirements)
    const expiresIn = Number(this.configService.get<number>('jwt.expiresIn', 300)) || 300; // 300 seconds = 5 minutes

    // Generate JWT
    const accessToken = this.jwtService.sign(payload);

    // Create session
    const tokenHash = this.hashToken(jti);
    const expiresAt = new Date(Date.now() + expiresIn * 1000); // Add seconds to current timestamp

    // Invalidate previous sessions (single device enforcement)
    await this.sessionRepository.update({ userId: user.id, isActive: true }, { isActive: false });

    // Create new session
    const session = this.sessionRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    });

    await this.sessionRepository.save(session);

    return {
      accessToken,
      user: this.mapUserToResponse(user),
      expiresIn,
    };
  }

  /**
   * Hash token ID for storage (simple hash for session management)
   */
  private hashToken(token: string): string {
    return bcrypt.hashSync(token, 10);
  }

  /**
   * Map User entity to response DTO
   */
  private mapUserToResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
