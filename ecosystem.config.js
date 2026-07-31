// PM2 Ecosystem Configuration for MFAA
// Usage: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'mfaa',
      script: 'server/src/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Load .env automatically — set secrets there, not here
      // PM2 will load the .env file from cwd
      error_file: 'logs/mfaa-err.log',
      out_file: 'logs/mfaa-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
