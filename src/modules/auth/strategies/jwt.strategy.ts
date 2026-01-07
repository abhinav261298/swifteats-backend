import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth.service';
import { UnauthorizedException } from '../../../common/exceptions';
import { Driver } from '../../driver/entities/driver.entity';
import { UserRole } from '../../../common/constants';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  role: string;
  jti: string; // JWT ID for session management
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  /**
   * Validate JWT payload and return user
   * This method is called automatically by Passport after JWT verification
   */
  async validate(payload: JwtPayload) {
    this.logger.debug(`Validating JWT for user: ${payload.sub}`);

    try {
      // Validate user and session
      const user = await this.authService.validateUser(payload.sub, payload.jti);

      // Base user object
      const userObj: any = {
        userId: user.id,
        email: user.email,
        role: user.role,
        jti: payload.jti,
      };

      // For driver users, fetch and attach driver ID
      if (user.role === UserRole.DRIVER) {
        const driver = await this.driverRepository.findOne({
          where: { userId: user.id },
        });

        if (driver) {
          userObj.driverId = driver.id;
          this.logger.debug(`Driver ID ${driver.id} attached for user ${user.id}`);
        } else {
          this.logger.warn(`Driver role user ${user.id} has no driver profile`);
        }
      }

      return userObj;
    } catch (error) {
      this.logger.error(`JWT validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
