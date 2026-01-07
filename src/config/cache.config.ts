import { registerAs } from '@nestjs/config';

export default registerAs('cache', () => ({
  ttl: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
  max: parseInt(process.env.CACHE_MAX_ITEMS || '1000', 10),
}));
