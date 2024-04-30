var express = require("express");
var router = express.Router();
var db = require("../database/db");
var generator = require("generate-password");
const { createHash } = require("crypto");
const { validateSessionId } = require("./sessionIdValidation");

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

  if (rows == null) {
    res.send({
      error: true,
      message: "Login failed, please try again",
      code: 101,
    });
    return;
  }

  if (rows.length > 1) {
    res.send({
      error: true,
      message: "Login failed, please try again",
      code: 102,
    });
    return;
  }

  if (rows.length === 0) {
    res.send({
      error: true,
      message: "Invalid Username or Password",
      code: 103,
    });
    return;
  }

  if (rows.length === 1) {
    const sessionId = createHash("sha256")
      .update(generator.generate({ length: 10, symbols: true }))
      .digest("base64");

    try {
      console.log(body.email, sessionId, rows[0].id, sessionId);
      await db.query(
        "INSERT INTO users_sessions (email, session_id,user_id) VALUES ($1,$2,$3) ON CONFLICT (email) DO UPDATE SET session_id = $4",
        [body.email, sessionId, rows[0].id, sessionId]
      );
    } catch (error) {
      console.error("failed to insert session into db", error);
      res.send({
        error: true,
        message:
          "We are facing technical difficulties, please try again later!",
        code: -2,
      });
      return;
    }

    res.send({
      error: false,
      message: "Login Success",
      sessionId: sessionId,
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

  let rows;
  const result = await validateSessionId(sessionId);

  if (!result.valid) {
    res.status(401).send({
      error: true,
      message: "session invalid",
      code: -2,
    });
    return;
  }

  try {
    dbRes = await db.query("SELECT * FROM users WHERE email=$1", [
      result.email,
    ]);
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
    type: rows[0].type,
  });
});

router.get("/insuranceCompanies", async (req, res) => {
  try {
    dbRes = await db.query("SELECT * FROM insurance_companies");
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }

  let rows = dbRes.rows.map((row) => row.name);

  res.send(rows);
});
// for insurance employee when he create a user and want to choose service
router.get("/companyServices", async (req, res) => {
  // const sessionId = req.get("SESSION_ID");
  // const email=authentication(sessionId);
  //after auth get id of user then get insurance company id
  const email = "musa.com";
  let dbRes;
  try {
    dbRes = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    const userID = dbRes.rows[0].id;
    dbRes = await db.query(
      "SELECT * FROM map_employees_to_insurance_companies   WHERE user_id=$1",
      [userID]
    );
    const companyID = dbRes.rows[0].insurance_company_id;
    dbRes = await db.query(
      "SELECT * FROM company_name_to_service_name_view   WHERE company_id=$1",
      [companyID]
    );
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get subscribed companies" });
    return;
  }
  let rows = dbRes.rows.map((row) => row.service_name);
  res.send(rows);
});
//for insurance employee when creating a user
router.get("/subscribedCompanies", async (req, res) => {
  try {
    dbRes = await db.query("SELECT * FROM subscribed_company");
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get subscribed companies" });
    return;
  }

  let rows = dbRes.rows.map((row) => row.name);

  res.send(rows);
});
router.post("/addNewInsuEmployee", async (req, res) => {
  const {
    first_name,
    second_name,
    last_name,
    national_id,
    email,
    phone_number,
    company_name,
  } = req.body;
  const type = 2;
  //generate password and send to email
  const password = 123;
  try {
    dbRes = await db.query(
      "INSERT INTO users (first_name, second_name, last_name, national_id, email,phone_number,password,type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        first_name,
        second_name,
        last_name,
        national_id,
        email,
        phone_number,
        password,
        type,
      ]
    );
    dbRes = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    const user_id = dbRes.rows[0].id;
    //make company name uniqe in db
    dbRes = await db.query("SELECT * FROM insurance_companies WHERE name=$1", [
      company_name,
    ]);
    const company_id = dbRes.rows[0].id;
    dbRes = await db.query(
      "INSERT INTO map_employees_to_insurance_companies (user_id,insurance_company_id) VALUES ($1,$2)",
      [user_id, company_id]
    );
    res
      .status(201)
      .send({ success: true, message: "User created successfully" });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to insert into users " });
    return;
  }
});
router.post("/addNewInsuComp", async (req, res) => {
  let dbRes;
  const { company_name } = req.body;
  try {
    dbRes = await db.query(
      "INSERT INTO insurance_companies (name) VALUES ($1)",
      [company_name]
    );
    res
      .status(201)
      .send({ success: true, message: "company inserted successfully" });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to insert into users " });
    return;
  }
});
// normal user to see his insurances
router.get("/insurances", async (req, res) => {
  let dbRes;
  const userID = 123;
  try {
    dbRes = await db.query(
      "SELECT * FROM user_to_insurance_services_view WHERE user_id=$1",
      [userID]
    );
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get user insurances" });
    return;
  }

  rows = dbRes.rows;
  res.send(rows);
});

router.get("/serviceName", async (req, res) => {
  //will get user id
  let dbRes;
  const userID = 123;
  try {
    dbRes = await db.query(
      "SELECT * FROM user_to_insurance_services_view WHERE user_id=$1",
      [userID]
    );
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get user insurances" });
    return;
  }

  let rows = dbRes.rows.map((row) => row.service_name);

  res.send(rows);
});

router.post("/createuser", async (req, res) => {
  let dbRes;
  const {
    first_name,
    second_name,
    last_name,
    national_id,
    email,
    phone_number,
  } = req.body;
  const type = 1;
  //generate password and send to email
  const password = 123;
  try {
    dbRes = await db.query(
      "INSERT INTO users (first_name, second_name, last_name, national_id, email,phone_number,password,type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        first_name,
        second_name,
        last_name,
        national_id,
        email,
        phone_number,
        password,
        type,
      ]
    );

    res
      .status(201)
      .send({ success: true, message: "User created successfully" });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to insert into users " });
    return;
  }
});
router.post("/addSubComp", async (req, res) => {
  let dbRes;
  const { company_name, email, phoneNum, address } = req.body;
  try {
    dbRes = await db.query(
      "INSERT INTO subscribed_company (name,address,phone_number,email) VALUES ($1,$2,$3,$4)",
      [company_name, email, phoneNum, address]
    );
    res
      .status(201)
      .send({ success: true, message: "company inserted successfully" });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to insert into users " });
    return;
  }
});
router.post("/addEmployee", async (req, res) => {
  const {
    first_name,
    second_name,
    last_name,
    national_id,
    email,
    phone_number,
    company_name,
  } = req.body;
  const type = 3;
  //generate password and send to email
  const password = 123;
  try {
    dbRes = await db.query(
      "INSERT INTO users (first_name, second_name, last_name, national_id, email,phone_number,password,type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        first_name,
        second_name,
        last_name,
        national_id,
        email,
        phone_number,
        password,
        type,
      ]
    );
    dbRes = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    const user_id = dbRes.rows[0].id;
    //make company name uniqe in db
    dbRes = await db.query("SELECT * FROM subscribed_company WHERE name=$1", [
      company_name,
    ]);
    const company_id = dbRes.rows[0].id;
    dbRes = await db.query(
      "INSERT INTO map_user_to_subscribed_company (user_id,subscribed_company_id) VALUES ($1,$2)",
      [user_id, company_id]
    );
    res
      .status(201)
      .send({ success: true, message: "User created successfully" });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to insert into users " });
    return;
  }
});
router.get("/insuranceCompanies", async (req, res) => {
  try {
    dbRes = await db.query("SELECT * FROM insurance_companies");
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }

  let rows = dbRes.rows.map((row) => row.name);

  res.send(rows);
});
module.exports = router;
