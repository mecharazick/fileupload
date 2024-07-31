module.exports = {
  apps: [
    {
      name: "PFA External Sheets Receiver",
      script: "index.js",
      node_args: "--env-file=.env",
    },
  ],
};
