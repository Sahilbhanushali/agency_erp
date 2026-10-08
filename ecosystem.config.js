module.exports = {
  apps: [
    {
      name: "itsmedezinoagencyerp",
      script: "npm",
      args: "start",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3008,
      },
    },
    {
      name: "itsmedezinoagencyerp-cron",
      script: "node",
      args: "scripts/cron-job.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
