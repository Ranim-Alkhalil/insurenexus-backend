const  Pool  = require('pg').Pool;

const pool = new Pool({
  user: 'ranim',
  password: 'ranim',
  host: 'localhost',
  port: 5432, // default Postgres port
  database: 'ranim'
});

module.exports = pool;