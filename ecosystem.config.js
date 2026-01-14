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
        // IMPORTANT: Store database OUTSIDE git folder to prevent data loss on git pull
        DATA_DIR: '/home/aparna-data'
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
