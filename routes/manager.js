var express = require("express");
var router = express.Router();
var db = require("../database/db");
var generator = require("generate-password");
const { createHash } = require("crypto");
const { validateSessionId } = require("./sessionIdValidation");

router.post("/createuser", async (req, res) => {
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

  const {
    first_name,
    second_name,
    last_name,
    national_id,
    email,
    phone_number,
  } = req.body;
  const type = 1;
  let password = generator.generate({
    numbers: true,
    symbols: true,
    length: 10,
  });
  password = createHash("sha512").update(password).digest("base64");

  try {
    // Insert the new user
    await db.query(
      "INSERT INTO users (first_name, second_name, last_name, national_id, email, phone_number, password, type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
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
    let dbRes = await db.query(
      "SELECT * FROM map_user_to_subscribed_company WHERE user_id=$1",
      [result.user_id]
    );
    const companyID = dbRes.rows[0].subscribed_company_id;

    // Retrieve the new user's ID
    dbRes = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    const userID = dbRes.rows[0].id;
    await db.query(
      "INSERT INTO map_user_to_subscribed_company (user_id, subscribed_company_id) VALUES ($1, $2)",
      [userID, companyID]
    );
    // Retrieve all services for the original user
    dbRes = await db.query(
      "SELECT * FROM map_users_to_companies_services WHERE user_id=$1",
      [result.user_id]
    );
    const services = dbRes.rows;

    // Insert each service for the new user
    for (const service of services) {
      await db.query(
        "INSERT INTO map_users_to_companies_services (user_id, company_to_service_id) VALUES ($1, $2)",
        [userID, service.company_to_service_id]
      );
    }

    // Retrieve all user_service mappings for the new user
    dbRes = await db.query(
      "SELECT * FROM map_users_to_companies_services WHERE user_id=$1",
      [userID]
    );
    const userServices = dbRes.rows;

    // Iterate through each user service and copy the subscriptions
    for (const userService of userServices) {
      // Retrieve the original user service with the same company_to_service_id
      dbRes = await db.query(
        "SELECT * FROM map_users_to_companies_services WHERE user_id=$1 AND company_to_service_id=$2",
        [result.user_id, userService.company_to_service_id]
      );
      const originalUserService = dbRes.rows[0];

      // Retrieve the subscriptions for the original user service
      dbRes = await db.query(
        "SELECT * FROM user_subscription WHERE userservice_id=$1",
        [originalUserService.id]
      );
      const subscriptions = dbRes.rows;

      // Insert the subscriptions for the new user's service
      for (const subscription of subscriptions) {
        await db.query(
          "INSERT INTO user_subscription (userservice_id, subscription_started_at, subscription_end_at, active, paid, amount, source_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [
            userService.id,
            subscription.subscription_started_at,
            subscription.subscription_end_at,
            subscription.active,
            subscription.paid,
            subscription.amount,
            result.user_id, // Use the new user's ID as the source_id
          ]
        );
      }
    }
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
    console.error(error);
    res.status(500).send({ error: true, message: "Failed to create user" });
  }
});

router.get("/insurances", async (req, res) => {
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
    dbRes = await db.query(
      "SELECT * FROM user_to_insurance_services_view WHERE user_id=$1",
      [result.user_id]
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
module.exports = router;
