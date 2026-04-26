module.exports = {
  apps: [
    {
      name: "sppg-api",
      script: "src/app.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "300M",
      time: true,
    },
  ],
};
