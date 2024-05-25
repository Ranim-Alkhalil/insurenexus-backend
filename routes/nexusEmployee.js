var express = require("express");
var router = express.Router();
var db = require("../database/db");
var generator = require("generate-password");
const { createHash } = require("crypto");
const { validateSessionId } = require("./sessionIdValidation");

router.get("/insuranceCompanies", async (req, res) => {
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

router.post("/addInsuEmployee", async (req, res) => {
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
  const type = 2;
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
  password = createHash("sha512").update(password).digest("base64");
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
        password,
        type,
      ]
    );
    dbRes = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    const user_id = dbRes.rows[0].id;
    dbRes = await db.query("SELECT * FROM insurance_companies WHERE name=$1", [
      company_name,
    ]);
    const company_id = dbRes.rows[0].id;
    dbRes = await db.query(
      "INSERT INTO map_employees_to_insurance_companies (user_id,insurance_company_id) VALUES ($1,$2)",
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

router.post("/addFacility", async (req, res) => {
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
  const { service, name, type, location, governorate, phoneNum } = req.body;
  if (!service || !name || !type || !location || !governorate || !phoneNum) {
    res.status(400).send({
      error: true,
      message: "All fields are required",
    });
    return;
  }
  const nameRegex = /^[a-zA-Z0-9 ]{1,100}$/;
  const phoneRegex = /^0\d{8,9}$/;

  if (
    !nameRegex.test(name) ||
    !nameRegex.test(type) ||
    !nameRegex.test(location) ||
    !phoneRegex.test(phoneNum)
  ) {
    return res
      .status(400)
      .send({ error: true, message: "Invalid input format" });
  }

  let dbRes;
  try {
    dbRes = await db.query("SELECT * FROM insurance_services WHERE name=$1", [
      service,
    ]);
    const serviceID = dbRes.rows[0].id;
    dbRes = await db.query(
      "INSERT INTO facilities (name, type, location, governorate,phone_number) VALUES ($1,$2,$3,$4,$5)",
      [name, type, location, governorate, phoneNum]
    );
    dbRes = await db.query("SELECT * FROM facilities WHERE name=$1", [name]);
    const facilityID = dbRes.rows[0].id;
    dbRes = await db.query(
      "INSERT INTO map_facilities_to_services (service_id,facility_id) VALUES ($1,$2)",
      [serviceID, facilityID]
    );
    res
      .status(201)
      .send({ success: true, message: "facility created successfully" });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to insert facility " });
    return;
  }
});
router.post("/addFacilityComp", async (req, res) => {
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
  const { company_name, service, facility } = req.body;
  if (!service || !company_name || !facility) {
    res.status(400).send({
      error: true,
      message: "All fields are required",
    });
    return;
  }

  let dbRes;
  try {
    dbRes = await db.query(
      "SELECT * FROM full_service_name_view WHERE name=$1",
      [service]
    );
    const serviceID = dbRes.rows[0].id;
    dbRes = await db.query("SELECT * FROM map_insurance_services WHERE id=$1", [
      serviceID,
    ]);
    const parentID = dbRes.rows[0].parent_id;
    dbRes = await db.query("SELECT * FROM insurance_companies WHERE name=$1", [
      company_name,
    ]);
    const companyID = dbRes.rows[0].id;
    dbRes = await db.query("SELECT * FROM facilities WHERE name=$1", [
      facility,
    ]);
    const facilityID = dbRes.rows[0].id;
    dbRes = await db.query(
      "SELECT * FROM map_companies_to_insurance_services WHERE company_id=$1 AND service_id=$2",
      [companyID, serviceID]
    );
    const compInsuID = dbRes.rows[0].id;
    dbRes = await db.query(
      "SELECT * FROM map_facilities_to_services WHERE facility_id=$1 AND service_id=$2",
      [facilityID, parentID]
    );
    const faciInsuID = dbRes.rows[0].id;
    dbRes = await db.query(
      "INSERT INTO map_facility_service_to_company (company_id,facility_service_id) VALUES ($1,$2)",
      [compInsuID, faciInsuID]
    );

    res
      .status(201)
      .send({ success: true, message: "facility created successfully" });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to insert facility " });
    return;
  }
});
router.get("/serviceParent", async (req, res) => {
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
    dbRes = await db.query("SELECT * FROM parent_service_view");
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }

  let rows = dbRes.rows.map((row) => row.name);

  res.send(rows);
});
router.get("/children", async (req, res) => {
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
    dbRes = await db.query("SELECT * FROM select_child_view ");
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }

  let rows = dbRes.rows.map((row) => row.name);

  res.send(rows);
});

router.post("/addParent", async (req, res) => {
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
  const { parent } = req.body;
  if (!parent) {
    res.status(400).send({
      error: true,
      message: "All fields are required",
    });
    return;
  }
  const nameRegex = /^[a-zA-Z\s]{1,100}$/;

  if (!nameRegex.test(parent)) {
    return res
      .status(400)
      .send({ error: true, message: "Invalid input format" });
  }

  let dbRes;
  try {
    dbRes = await db.query(
      "INSERT INTO insurance_services (name) VALUES ($1)",
      [parent]
    );

    res
      .status(201)
      .send({ success: true, message: "service added successfully" });
  } catch (error) {
    res.status(500).send({ error: true, message: "failed to insert service " });
    return;
  }
});
router.post("/addChild", async (req, res) => {
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
  const { parent, child } = req.body;
  if (!parent || !child) {
    res.status(400).send({
      error: true,
      message: "All fields are required",
    });
    return;
  }
  const nameRegex = /^[a-zA-Z\s]{1,100}$/;

  if (!nameRegex.test(parent) || !nameRegex.test(child)) {
    return res
      .status(400)
      .send({ error: true, message: "Invalid input format" });
  }

  try {
    let dbRes = await db.query(
      "SELECT * FROM insurance_services WHERE name=$1",
      [child]
    );

    if (dbRes.rows.length === 0) {
      await db.query("INSERT INTO insurance_services (name) VALUES ($1)", [
        child,
      ]);
      dbRes = await db.query("SELECT * FROM insurance_services WHERE name=$1", [
        child,
      ]);
    }

    const childID = dbRes.rows[0].id;

    dbRes = await db.query("SELECT * FROM insurance_services WHERE name=$1", [
      parent,
    ]);
    const parentID = dbRes.rows[0].id;

    dbRes = await db.query(
      "INSERT INTO map_insurance_services (service_id,parent_id) VALUES ($1,$2)",
      [childID, parentID]
    );
    res
      .status(201)
      .send({ success: true, message: "facility created successfully" });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to insert facility " });
    return;
  }
});

router.post("/addInsuComp", async (req, res) => {
  const nameRegex = /^[a-zA-Z0-9 ]{1,100}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^0\d{8,9}$/;
  const addressRegex = /^[a-zA-Z0-9 ,.-]{1,100}$/;
  const faxRegex = /^\d{5}$/;
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

  const { company_name, email, phone_number, address, mail, fax } = req.body;
  const errors = [];

  if (!company_name || !nameRegex.test(company_name)) {
    errors.push(
      "Company name must be 1-100 characters long and can include letters, numbers, and spaces."
    );
  }
  if (!email || !emailRegex.test(email)) {
    errors.push("Invalid email format.");
  }
  if (!phone_number || !phoneRegex.test(phone_number)) {
    errors.push("Phone number must be 9 or 10 digits.");
  }
  if (!address || !addressRegex.test(address)) {
    errors.push(
      "Address must be 1-100 characters long and can include letters, numbers, and common punctuation."
    );
  }
  if (mail && !addressRegex.test(mail)) {
    errors.push(
      "Mail address must be 1-100 characters long and can include letters, numbers, and common punctuation."
    );
  }
  if (fax && !faxRegex.test(fax)) {
    errors.push("Fax number must be 9 or 10 digits.");
  }

  if (errors.length > 0) {
    res.status(400).send({ error: true, messages: errors });
    return;
  }

  try {
    let dbRes = await db.query(
      "INSERT INTO insurance_companies (name, address, phone_number, email, mail, fax) VALUES ($1, $2, $3, $4, $5, $6)",
      [company_name, address, phone_number, email, mail, fax]
    );
    res
      .status(201)
      .send({ success: true, message: "Company created successfully" });
  } catch (error) {
    res.status(500).send({ error: true, message: "Failed to insert company" });
  }
});

router.get("/compInsurances", async (req, res) => {
  const sessionId = req.get("SESSION_ID");
  const companyName = req.query.param1;
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
    dbRes = await db.query("SELECT * FROM insurance_companies WHERE name=$1", [
      companyName,
    ]);
    const company_id = dbRes.rows[0].id;
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
router.get("/facilities", async (req, res) => {
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
    dbRes = await db.query("SELECT * FROM facilities ");

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
  const { company_name, service } = req.body;
  const errors = [];

  if (!company_name) {
    errors.push("Company name cannot be empty.");
  }
  if (!service) {
    errors.push("Service cannot be empty.");
  }

  if (errors.length > 0) {
    res.status(400).send({ error: true, messages: errors });
    return;
  }
  try {
    dbRes = await db.query("SELECT * FROM insurance_companies WHERE name=$1", [
      company_name,
    ]);
    const company_id = dbRes.rows[0].id;
    dbRes = await db.query(
      "SELECT * FROM full_service_name_view WHERE name=$1",
      [service]
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
module.exports = router;
