import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
  expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '300', 10), // 300 seconds = 5 minutes
  expiresInString: process.env.JWT_EXPIRATION || '5m', // For JwtModule signOptions
}));
