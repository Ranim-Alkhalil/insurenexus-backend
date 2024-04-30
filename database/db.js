const Pool = require("pg").Pool;

const pool = new Pool({
  user: "insurance_nexus",
  password: "insurance_nexus",
  host: "localhost",
  port: 5432,
  database: "insurance_nexus",
});

module.exports = pool;
