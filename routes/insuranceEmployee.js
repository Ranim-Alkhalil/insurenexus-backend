var express = require("express");
var router = express.Router();
var db = require("../database/db");
var generator = require("generate-password");
const { createHash } = require("crypto");
const { validateSessionId } = require("./sessionIdValidation");
const transporter = require("./mail");
/////////////////////////////////////
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

  let newpassword = createHash("sha256").update(password).digest("base64");
  try {
    const dbRes = await db.query(
      "INSERT INTO users (first_name, second_name, last_name, national_id, email, phone_number, password, type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        first_name,
        second_name,
        last_name,
        national_id,
        email,
        phone_number,
        newpassword,
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
      .send({ error: true, message: "Failed to insert into users" });
  }
});

router.post("/addEmployee", async (req, res) => {
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
    company_name,
  } = req.body;
  const type = 3;
  let password = generator.generate({
    numbers: true,
    symbols: true,
    length: 10,
  });

  let newpassword = createHash("sha256").update(password).digest("base64");
  let dbRes;
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
        newpassword,
        type,
      ]
    );
    dbRes = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    const user_id = dbRes.rows[0].id;

    dbRes = await db.query("SELECT * FROM subscribed_company WHERE name=$1", [
      company_name,
    ]);
    const company_id = dbRes.rows[0].id;
    dbRes = await db.query(
      "INSERT INTO map_user_to_subscribed_company (user_id,subscribed_company_id) VALUES ($1,$2)",
      [user_id, company_id]
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

router.get("/subscribedCompanies", async (req, res) => {
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

router.get("/companyParent", async (req, res) => {
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
      "SELECT * FROM map_employees_to_insurance_companies WHERE user_id=$1",
      [result.user_id]
    );
    const company_id = dbRes.rows[0].insurance_company_id;
    dbRes = await db.query(
      "SELECT * FROM company_to_parent_service_view WHERE company_id=$1",
      [company_id]
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

router.get("/Parent", async (req, res) => {
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
    dbRes = await db.query("SELECT * FROM parent_service_view ");
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get subscribed companies" });
    return;
  }

  let rows = dbRes.rows.map((row) => row.name);

  res.send(rows);
});

router.get("/child", async (req, res) => {
  const sessionId = req.get("SESSION_ID");
  const serviceName = req.query.param1;
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
    dbRes = await db.query("SELECT * FROM insurance_services WHERE name=$1 ", [
      serviceName,
    ]);
    serviceID = dbRes.rows[0].id;
    dbRes = await db.query(
      "SELECT * FROM select_child_view WHERE parent_id=$1 ",
      [serviceID]
    );
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get subscribed companies" });
    return;
  }

  let rows = dbRes.rows.map((row) => row.name);

  res.send(rows);
});
router.get("/companyServices", async (req, res) => {
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
      "SELECT * FROM map_employees_to_insurance_companies WHERE user_id=$1",
      [result.user_id]
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

router.post("/addSubscription", async (req, res) => {
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
  const { nationalID, service, startDate, endDate, paid, active, amount } =
    req.body;
  try {
    dbRes = await db.query("SELECT * FROM users WHERE national_id=$1", [
      nationalID,
    ]);
    const userID = dbRes.rows[0].id;
    dbRes = await db.query(
      "SELECT * FROM map_employees_to_insurance_companies WHERE user_id=$1",
      [result.user_id]
    );
    const companyID = dbRes.rows[0].insurance_company_id;
    dbRes = await db.query(
      "SELECT * FROM full_service_name_view WHERE name=$1",
      [service]
    );
    const serviceID = dbRes.rows[0].id;
    dbRes = await db.query(
      "SELECT * FROM map_companies_to_insurance_services WHERE company_id=$1 AND service_id=$2",
      [companyID, serviceID]
    );
    const companyServiceID = dbRes.rows[0].id;
    dbRes = await db.query(
      "INSERT INTO map_users_to_companies_services (user_id,company_to_service_id) VALUES ($1,$2)",
      [userID, companyServiceID]
    );
    dbRes = await db.query(
      "SELECT * FROM map_users_to_companies_services WHERE user_id=$1 AND company_to_service_id=$2",
      [userID, companyServiceID]
    );
    const subscriptionID = dbRes.rows[0].id;

    dbRes = await db.query(
      "INSERT INTO user_subscription (userservice_id,subscription_started_at,subscription_end_at,active,paid,amount,source_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [subscriptionID, startDate, endDate, active, paid, amount, result.user_id]
    );

    dbRes = await db.query(
      "SELECT * FROM map_user_to_subscribed_company WHERE user_id=$1",
      [userID]
    );
    if (dbRes.rows.length > 0) {
      const company_id = dbRes.rows[0].subscribed_company_id;

      dbRes = await db.query(
        "SELECT user_id FROM map_user_to_subscribed_company WHERE subscribed_company_id=$1 AND user_id != $2",
        [company_id, userID]
      );
      const users = dbRes.rows;

      for (const user of users) {
        const newUserID = user.user_id;

        dbRes = await db.query(
          "INSERT INTO map_users_to_companies_services (user_id, company_to_service_id) VALUES ($1, $2)",
          [newUserID, companyServiceID]
        );

        dbRes = await db.query(
          "SELECT * FROM map_users_to_companies_services WHERE user_id=$1 AND company_to_service_id=$2",
          [newUserID, companyServiceID]
        );
        const newID = dbRes.rows[0].id;

        await db.query(
          "INSERT INTO user_subscription (userservice_id, subscription_started_at, subscription_end_at, active, paid, amount, source_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [newID, startDate, endDate, active, paid, amount, result.user_id]
        );
      }
    }
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
  const { company_name, email, phoneNum, address } = req.body;
  try {
    dbRes = await db.query(
      "INSERT INTO subscribed_company (name,address,phone_number,email) VALUES ($1,$2,$3,$4)",
      [company_name, address, phoneNum, email]
    );
    dbRes = await db.query("SELECT * FROM subscribed_company WHERE name=($1)", [
      company_name,
    ]);
    const sub_id = dbRes.rows[0].id;

    dbRes = await db.query(
      "SELECT * FROM map_employees_to_insurance_companies WHERE user_id=($1)",
      [result.user_id]
    );
    const comp_id = dbRes.rows[0].insurance_company_id;
    console.log(comp_id);
    dbRes = await db.query(
      "INSERT INTO map_subscribed_companies_to_insurance_companies (subscribed_company_id,insurance_company_id) VALUES ($1,$2)",
      [sub_id, comp_id]
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
router.get("/checkNationalID", async (req, res) => {
  const sessionId = req.get("SESSION_ID");
  const nationalID = req.query.param1;

  if (!nationalID) {
    res.status(400).send({
      error: true,
      message: "nationalID query parameter is required",
    });
    return;
  }

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
    dbRes = await db.query("SELECT * FROM users WHERE national_id=$1", [
      nationalID,
    ]);
  } catch (error) {
    res.status(500).send({
      error: true,
      message: "failed to query the database",
    });
    return;
  }

  if (dbRes.rows.length === 0) {
    res.status(404).send({
      error: true,
      message: "No user found with the given national ID",
    });
    return;
  }

  const { first_name, last_name } = dbRes.rows[0];

  res.send({
    exists: true,
    firstName: first_name,
    lastName: last_name,
  });
});

router.get("/compInsurances", async (req, res) => {
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
      "SELECT * FROM map_employees_to_insurance_companies WHERE user_id=$1",
      [result.user_id]
    );
    const company_id = dbRes.rows[0].insurance_company_id;
    dbRes = await db.query(
      "SELECT *  FROM company_name_to_service_name_view WHERE company_id = $1",
      [company_id]
    );

    const insurances = dbRes.rows.map((row) => row.service_name);
    res.send(insurances);
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }
});
router.get("/compFacilities", async (req, res) => {
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
      "SELECT * FROM map_employees_to_insurance_companies WHERE user_id=$1",
      [result.user_id]
    );
    const company_id = dbRes.rows[0].insurance_company_id;
    dbRes = await db.query(
      "SELECT *  FROM company_name_to_service_name_view WHERE company_id = $1",
      [company_id]
    );
    dbRes = await db.query(
      "SELECT DISTINCT facility_name FROM company_service_facilities_view WHERE company_id=$1",
      [company_id]
    );
    const facilities = dbRes.rows.map((row) => row.facility_name);
    res.send(facilities);
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }
});
router.get("/Insurances", async (req, res) => {
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
    dbRes = await db.query("SELECT * FROM full_service_name_view");
    const insurances = dbRes.rows.map((row) => row.name);
    res.send(insurances);
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }
});
router.post("/addInsurance", async (req, res) => {
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
  const { insurance } = req.body;
  try {
    dbRes = await db.query(
      "SELECT * FROM map_employees_to_insurance_companies WHERE user_id=$1",
      [result.user_id]
    );
    const company_id = dbRes.rows[0].insurance_company_id;
    dbRes = await db.query(
      "SELECT * FROM full_service_name_view WHERE name=$1",
      [insurance]
    );
    const insuranceID = dbRes.rows[0].id;
    dbRes = await db.query(
      "INSERT INTO map_companies_to_insurance_services (company_id,service_id) VALUES ($1,$2)",
      [company_id, insuranceID]
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
router.get("/compInfo", async (req, res) => {
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
      "SELECT * FROM map_employees_to_insurance_companies WHERE user_id=$1",
      [result.user_id]
    );
    const company_id = dbRes.rows[0].insurance_company_id;

    dbRes = await db.query("SELECT * FROM insurance_companies WHERE id = $1", [
      company_id,
    ]);

    const pdfBase64 = dbRes.rows[0].pdf;

    res.send({
      ...dbRes.rows[0],
      pdf: pdfBase64,
    });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get company info" });
  }
});

router.post("/updateDescription", async (req, res) => {
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

  const { description } = req.body;

  try {
    const dbRes = await db.query(
      "SELECT insurance_company_id FROM map_employees_to_insurance_companies WHERE user_id=$1",
      [result.user_id]
    );
    const company_id = dbRes.rows[0].insurance_company_id;

    await db.query(
      "UPDATE insurance_companies SET description = $1 WHERE id = $2",
      [description, company_id]
    );

    res
      .status(201)
      .send({ success: true, message: "Description updated successfully" });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "Failed to update description" });
  }
});
router.post("/updatePdf", async (req, res) => {
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

  const { pdf } = req.body;

  try {
    const dbRes = await db.query(
      "SELECT insurance_company_id FROM map_employees_to_insurance_companies WHERE user_id=$1",
      [result.user_id]
    );
    const company_id = dbRes.rows[0].insurance_company_id;

    await db.query("UPDATE insurance_companies SET pdf = $1 WHERE id = $2", [
      pdf,
      company_id,
    ]);

    res
      .status(201)
      .send({ success: true, message: "PDF updated successfully" });
  } catch (error) {
    res.status(500).send({ error: true, message: "Failed to update PDF" });
  }
});
router.post("/updateLogo", async (req, res) => {
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

  const { logo } = req.body;

  try {
    const dbRes = await db.query(
      "SELECT * FROM map_employees_to_insurance_companies WHERE user_id=$1",
      [result.user_id]
    );
    const company_id = dbRes.rows[0].insurance_company_id;

    await db.query("UPDATE insurance_companies SET logo = $1 WHERE id = $2", [
      logo,
      company_id,
    ]);

    res
      .status(201)
      .send({ success: true, message: "Logo updated successfully" });
  } catch (error) {
    res.status(500).send({ error: true, message: "Failed to update logo" });
  }
});

module.exports = router;
