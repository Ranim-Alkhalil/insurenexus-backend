var express = require("express");
var router = express.Router();
var db = require("../database/db");
var generator = require("generate-password");
const { createHash } = require("crypto");

router.post("/signin", function (req, res, next) {
  let body = req.body;
  if (body.email == null || body.password == null)
    res.send({ error: true, message: "invalid email or password", code: -1 });

  const hashedPassword = createHash("sha256")
    .update(body.password)
    .digest("base64");

  db.query(
    "SELECT * FROM users WHERE email=$1 AND password=$2",
    [body.email, hashedPassword],
    (dbErr, dbRes) => {
      if (dbErr)
        res.send({
          error: true,
          message: "system failure, please try again later",
          code: 101,
        });

      if (dbRes.rowCount > 1)
        res.send({
          error: true,
          message: "system failure, please try again later",
          code: 102,
        });

      if (dbRes.rowCount === 0)
        res.send({
          error: true,
          message: "invalid username or password",
          code: 103,
        });

      if (dbRes.rowCount === 1) {
        const sessionId = createHash("sha256")
          .update(generator.generate({ length: 10, symbols: true }))
          .digest("base64");
        db.query(
          "INSERT INTO users_sessions (email, session_id) VALUES ($1,$2) ON CONFLICT (email) DO UPDATE SET session_id = $3",
          [body.email, sessionId, sessionId],
          (dbErr, dbRes) => {
            if (dbErr) {
              console.log("failed to create session id : ", dbErr);
              res.send({
                error: true,
                message: "Login Failed, Please Try Again Later",
                code: -2,
              });
            }
            res.send({
              error: false,
              message: "Login Success",
              sessionId: sessionId,
              type: 1,
              code: 0,
            });
          }
        );
      }
    }
  );
});

router.post("/createuser", (req, res) => {
  let body = req.body;
  console.log("create user request received : ", body);

  //body must contain : first name, second name, last name, email, national id,
  //where to make sure the input is correct?
  let password = generator.generate({
    length: 14,
    numbers: true,
    symbols: true,
  });
  //do we input the type?
  //sjould we add phone number to db?
  db.query("INSERT INTO users VALUES ($1,$2,$3,$4,$5,$6,$7)", [
    body.email,
    password,
    body.first_name,
    body.second_name,
    body.last_name,
    body.nationalID,
    body.type,
  ]);
  //map to services
  //map to subscribed company
});

module.exports = router;
