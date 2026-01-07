import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';

config();

// Determine if running from compiled code (production) or source (development)
const isCompiled = __filename.endsWith('.js');
const entityPath = isCompiled
  ? 'dist/modules/**/entities/*.entity.js'
  : 'src/modules/**/entities/*.entity.ts';
const migrationPath = isCompiled
  ? 'dist/database/migrations/*.js'
  : 'src/database/migrations/*.ts';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'swifteats_user',
  password: process.env.DB_PASSWORD || 'secure_password',
  database: process.env.DB_NAME || 'swifteats',
  entities: [entityPath],
  migrations: [migrationPath],
  synchronize: false, // Always use migrations in production
  logging: process.env.DB_LOGGING === 'true',
  extra: {
    max: 50, // Connection pool size
    min: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  },
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
