var express = require("express");
var router = express.Router();
var db = require("../database/db");
var generator = require("generate-password");
const { createHash } = require("crypto");
const { validateSessionId } = require("./sessionIdValidation");
const transporter = require("./mail");
router.post("/addNexusEmp", async (req, res) => {
  const sessionId = req.get("SESSION_ID");
  const result = await validateSessionId(sessionId);

  if (!result.valid) {
    res.status(401).send({
      error: true,
      message: "session invalid",
      code: -2,
    });
    return;
  }
  let dbRes;
  const {
    first_name,
    second_name,
    last_name,
    national_id,
    email,
    phone_number,
  } = req.body;
  const type = 4;
  const nameRegex = /^[a-zA-Z]{1,15}$/;
  const NIDRegex = /^\d{10}$/;
  const emailRegex = /^[\w.%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  const phoneRegex = /^07\d{8}$/;

  const errors = [];

  if (!first_name || !nameRegex.test(first_name)) errors.push("first_name");
  if (!second_name || !nameRegex.test(second_name)) errors.push("second_name");
  if (!last_name || !nameRegex.test(last_name)) errors.push("last_name");
  if (!national_id || !NIDRegex.test(national_id)) errors.push("national_id");
  if (!email || !emailRegex.test(email)) errors.push("email");
  if (!phone_number || !phoneRegex.test(phone_number))
    errors.push("phone_number");

  if (errors.length > 0) {
    res.status(400).send({
      error: true,
      message: "Invalid input data",
      code: -3,
      errors: errors,
    });
    return;
  }

  let password = generator.generate({
    numbers: true,
    symbols: true,
    length: 10,
  });
  password = createHash("sha256").update(password).digest("base64");
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
    const mailOptions = {
      from: "insurenexus@gmail.com",
      to: email,
      subject: "Your Temporary Password",
      text: `Your temporary password is: ${password}.`,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
        res.status(500).send({ error: true, message: "Failed to send email" });
      } else {
        console.log("Email sent: " + info.response);
        res
          .status(201)
          .send({ success: true, message: "User created successfully" });
      }
    });
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
router.get("/webInfo", async (req, res) => {
  const sessionId = req.get("SESSION_ID");
  const result = await validateSessionId(sessionId);

  if (!result.valid) {
    res.status(401).send({
      error: true,
      message: "session invalid",
      code: -2,
    });
    return;
  }

  let dbRes;
  try {
    dbRes = await db.query(`
      SELECT 'insurance_companies' as type, COUNT(*) as count FROM insurance_companies
      UNION ALL
      SELECT 'subscribed_company' as type, COUNT(*) as count FROM subscribed_company
      UNION ALL
      SELECT 'users_type_2' as type, COUNT(*) as count FROM users WHERE type=2
      UNION ALL
      SELECT 'users_type_4' as type, COUNT(*) as count FROM users WHERE type=4
    `);
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get subscribed companies" });
    return;
  }

  const response = {
    insuranceCompaniesCount: 0,
    subscribedCompaniesCount: 0,
    usersType2Count: 0,
    usersType4Count: 0,
  };

  dbRes.rows.forEach((row) => {
    switch (row.type) {
      case "insurance_companies":
        response.insuranceCompaniesCount = row.count;
        break;
      case "subscribed_company":
        response.subscribedCompaniesCount = row.count;
        break;
      case "users_type_2":
        response.usersType2Count = row.count;
        break;
      case "users_type_4":
        response.usersType4Count = row.count;
        break;
    }
  });

  res.send(response);
});
router.get("/userGrowth", async (req, res) => {
  const sessionId = req.get("SESSION_ID");
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
    const result = await db.query(`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as count
      FROM users
      GROUP BY date
      ORDER BY date
    `);

    res.send(result.rows);
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "Failed to fetch user growth data" });
  }
});

module.exports = router;
