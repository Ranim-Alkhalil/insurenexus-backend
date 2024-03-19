var express = require("express");
var router = express.Router();
var db = require("../database/db");
var generator = require("generate-password");
const { createHash } = require("crypto");

router.post("/signin", async function (req, res, next) {
  let body = req.body;
  if (body.email == null || body.password == null)
    res.send({ error: true, message: "invalid email or password", code: -1 });

  const hashedPassword = createHash("sha256")
    .update(body.password)
    .digest("base64");

  let dbRes;
  try {
    dbRes = await db.query(
      "SELECT * FROM users WHERE email=$1 AND password=$2",
      [body.email, hashedPassword]
    );
  } catch (error) {
    res.send({
      error: true,
      message: "We are facing technical difficulties, please try again later!",
      code: -1,
    });
  }
  const rows = dbRes.rows;

  if (rows == null)
    res.send({
      error: true,
      message: "Login failed, please try again",
      code: 101,
    });

  if (rows.length > 1)
    res.send({
      error: true,
      message: "Login failed, please try again",
      code: 102,
    });

  if (rows.length === 0)
    res.send({
      error: true,
      message: "Invalid Username or Password",
      code: 103,
    });

  if (rows.length === 1) {
    const sessionId = createHash("sha256")
      .update(generator.generate({ length: 10, symbols: true }))
      .digest("base64");

    try {
      await db.query(
        "INSERT INTO users_sessions (email, session_id) VALUES ($1,$2) ON CONFLICT (email) DO UPDATE SET session_id = $2",
        [body.email, sessionId]
      );
    } catch (error) {
      res.send({
        error: true,
        message:
          "We are facing technical difficulties, please try again later!",
        code: -2,
      });
    }

    res.send({
      error: false,
      message: "Login Success",
      sessionId: sessionId,
      type: 1, //need change
      code: 0,
    });
  }
});

router.post("/session/validate", async function (req, res, next) {
  let body = req.body;
  if (body.sessionId == null)
    res.send({ error: true, message: "Please provide a session id", code: -1 });
  try {
    const dbRes = await db.query(
      "SELECT * FROM users_sessions WHERE session_id=$1",
      [body.sessionId]
    );
    if (dbRes.rowCount === 1) {
      res.send({
        error: false,
        message: "session valid",
        code: 0,
      });
    } else {
      res.status(401).send({
        error: true,
        message: "session invalid",
        code: -2,
      });
    }
  } catch (error) {
    res.send({
      error: true,
      message: "system failure, please try again later",
      code: 101,
    });
  }
});

router.get("/info", async (req, res) => {
  const sessionId = req.get("SESSION_ID");
  console.log("session id : ", sessionId);
  if (sessionId == null) {
    res.status(401).send({
      error: true,
      message: "Please provide a session id",
      code: -1,
    });
    return;
  }

  let rows;

  try {
    const dbRes = await db.query(
      "SELECT * FROM users_sessions WHERE session_id=$1",
      [sessionId]
    );
    console.log("rows dbres :", dbRes.rows);
    rows = dbRes.rows;
  } catch (error) {
    console.error("failed to select email by session id ", sessionId, error);
    res.status(500).send({
      error: true,
      message: "system failure, please try again later",
      code: 101,
    });
    return;
  }

  console.log("rows : ", rows);
  if (rows.length !== 1) {
    res.status(401).send({
      error: true,
      message: "session invalid",
      code: -2,
    });
    return;
  }

  const email = rows[0].email;
  try {
    dbRes = await db.query("SELECT * FROM users WHERE email=$1", [email]);
  } catch (error) {
    res.status(500).send({ error: true, message: "failed to get user info" });
    return;
  }

  rows = dbRes.rows;
  if (rows.length !== 1) {
    res.status(500).send({ error: true, message: "failed to get user info" });
    return;
  }
  res.send({
    firstName: rows[0].first_name,
    lastName: rows[0].last_name,
    email: rows[0].email,
    nationalId: rows[0].national_id,
  });
});

module.exports = router;
