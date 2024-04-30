var db = require("../database/db");
async function validateSessionId(sessionId) {
  let result = { valid: false };

  if (sessionId == null) return result;

  let rows;

  try {
    const dbRes = await db.query(
      "SELECT * FROM users_sessions WHERE session_id=$1",
      [sessionId]
    );
    rows = dbRes.rows;
  } catch (error) {
    result.valid = false;
    return result;
  }
  if (rows.length === 1) {
    result.valid = true;
    result.user_id = rows[0].user_id;
    result.email = rows[0].email;
    return result;
  }

  result.valid = false;
  return result;
}
module.exports = { validateSessionId };
