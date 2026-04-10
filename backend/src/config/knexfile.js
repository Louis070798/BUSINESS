require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'business_manager',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres123',
    },
    migrations: {
      directory: '../migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: '../seeds',
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
    },
    migrations: {
      directory: '../migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: '../seeds',
    },
    pool: {
      min: 2,
      max: 20,
    },
  },
};
