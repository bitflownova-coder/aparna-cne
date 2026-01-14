module.exports = {
  apps: [
    {
      name: 'cne-app',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // MySQL Database Configuration
        DB_TYPE: 'mysql',
        DB_HOST: '127.0.0.1',
        DB_USER: 'u984810592_aparna_admin',
        DB_PASSWORD: 'sCARFACE@2003?.',
        DB_NAME: 'u984810592_aparna_cne',
        USE_MYSQL: 'true'
      },
      // Error and output logs
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      // Graceful restart
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    }
  ]
};
