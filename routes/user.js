var express = require("express");
var router = express.Router();
var db = require("../database/db");
var generator = require("generate-password");
const { createHash } = require("crypto");
const { validateSessionId } = require("./sessionIdValidation");
var nodemailer = require("nodemailer");
const transporter = require("./mail");

router.post("/signin", async function (req, res, next) {
  let body = req.body;
  if (body.email == null || body.password == null)
    res.send({ error: true, message: "invalid email or password", code: -1 });
  console.log(body.password);
  const hashedPassword = createHash("sha256")
    .update(body.password)
    .digest("base64");
  console.log(hashedPassword);
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
    phoneNum: rows[0].phone_number,
  });
});

router.get("/insuranceCompanies", async (req, res) => {
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
// for insurance employee when he create a user and want to choose service
// router.get("/companyServices", async (req, res) => {
//   // const sessionId = req.get("SESSION_ID");
//   // const email=authentication(sessionId);
//   //after auth get id of user then get insurance company id
//   const email = "musa.com";
//   let dbRes;
//   try {
//     dbRes = await db.query("SELECT * FROM users WHERE email=$1", [email]);
//     const userID = dbRes.rows[0].id;
//     dbRes = await db.query(
//       "SELECT * FROM map_employees_to_insurance_companies   WHERE user_id=$1",
//       [userID]
//     );
//     const companyID = dbRes.rows[0].insurance_company_id;
//     dbRes = await db.query(
//       "SELECT * FROM company_name_to_service_name_view   WHERE company_id=$1",
//       [companyID]
//     );
//   } catch (error) {
//     res
//       .status(500)
//       .send({ error: true, message: "failed to get subscribed companies" });
//     return;
//   }
//   let rows = dbRes.rows.map((row) => row.service_name);
//   res.send(rows);
// });
//for insurance employee when creating a user
// router.get("/subscribedCompanies", async (req, res) => {
//   const sessionId = req.get("SESSION_ID");

//   const result = await validateSessionId(sessionId);

//   if (!result.valid) {
//     res.status(401).send({
//       error: true,
//       message: "session invalid",
//       code: -2,
//     });
//     return;
//   }
//   let dbRes;
//   try {
//     dbRes = await db.query("SELECT * FROM subscribed_company");
//   } catch (error) {
//     res
//       .status(500)
//       .send({ error: true, message: "failed to get subscribed companies" });
//     return;
//   }

//   let rows = dbRes.rows.map((row) => row.name);

//   res.send(rows);
// });
// router.post("/addNewInsuEmployee", async (req, res) => {
//   const {
//     first_name,
//     second_name,
//     last_name,
//     national_id,
//     email,
//     phone_number,
//     company_name,
//   } = req.body;
//   const type = 2;
//   //generate password and send to email
//   const password = 123;
//   try {
//     dbRes = await db.query(
//       "INSERT INTO users (first_name, second_name, last_name, national_id, email,phone_number,password,type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
//       [
//         first_name,
//         second_name,
//         last_name,
//         national_id,
//         email,
//         phone_number,
//         password,
//         type,
//       ]
//     );
//     dbRes = await db.query("SELECT * FROM users WHERE email=$1", [email]);
//     const user_id = dbRes.rows[0].id;
//     //make company name uniqe in db
//     dbRes = await db.query("SELECT * FROM insurance_companies WHERE name=$1", [
//       company_name,
//     ]);
//     const company_id = dbRes.rows[0].id;
//     dbRes = await db.query(
//       "INSERT INTO map_employees_to_insurance_companies (user_id,insurance_company_id) VALUES ($1,$2)",
//       [user_id, company_id]
//     );
//     res
//       .status(201)
//       .send({ success: true, message: "User created successfully" });
//   } catch (error) {
//     res
//       .status(500)
//       .send({ error: true, message: "failed to insert into users " });
//     return;
//   }
// });
// router.post("/addNewInsuComp", async (req, res) => {
//   let dbRes;
//   const { company_name } = req.body;
//   try {
//     dbRes = await db.query(
//       "INSERT INTO insurance_companies (name) VALUES ($1)",
//       [company_name]
//     );
//     res
//       .status(201)
//       .send({ success: true, message: "company inserted successfully" });
//   } catch (error) {
//     res
//       .status(500)
//       .send({ error: true, message: "failed to insert into users " });
//     return;
//   }
// });
// normal user to see his insurances
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

// router.get("/serviceName", async (req, res) => {
//   //will get user id
//   let dbRes;
//   const userID = 123;
//   try {
//     dbRes = await db.query(
//       "SELECT * FROM user_to_insurance_services_view WHERE user_id=$1",
//       [userID]
//     );
//   } catch (error) {
//     res
//       .status(500)
//       .send({ error: true, message: "failed to get user insurances" });
//     return;
//   }

//   let rows = dbRes.rows.map((row) => row.service_name);

//   res.send(rows);
// });

// router.post("/createuser", async (req, res) => {
//   const sessionId = req.get("SESSION_ID");

//   const result = await validateSessionId(sessionId);

//   if (!result.valid) {
//     res.status(401).send({
//       error: true,
//       message: "session invalid",
//       code: -2,
//     });
//     return;
//   }
//   let dbRes;
//   const {
//     first_name,
//     second_name,
//     last_name,
//     national_id,
//     email,
//     phone_number,
//   } = req.body;
//   const type = 1;

//   const password = generator.generate({
//     length: 10,
//     numbers: true,
//     symbols: true,
//   });
//   create;
//   try {
//     dbRes = await db.query(
//       "INSERT INTO users (first_name, second_name, last_name, national_id, email,phone_number,password,type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
//       [
//         first_name,
//         second_name,
//         last_name,
//         national_id,
//         email,
//         phone_number,
//         password,
//         type,
//       ]
//     );

//     res
//       .status(201)
//       .send({ success: true, message: "User created successfully" });
//   } catch (error) {
//     res
//       .status(500)
//       .send({ error: true, message: "failed to insert into users " });
//     return;
//   }
// });

// router.post("/addEmployee", async (req, res) => {
//   const sessionId = req.get("SESSION_ID");
//   const result = await validateSessionId(sessionId);

//   if (!result.valid) {
//     res.status(401).send({
//       error: true,
//       message: "session invalid",
//       code: -2,
//     });
//     return;
//   }
//   let dbRes;
//   const {
//     first_name,
//     second_name,
//     last_name,
//     national_id,
//     email,
//     phone_number,
//     company_name,
//   } = req.body;
//   const type = 3;

//   //generate password and send to email
//   const password = 123;
//   try {
//     dbRes = await db.query(
//       "INSERT INTO users (first_name, second_name, last_name, national_id, email,phone_number,password,type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
//       [
//         first_name,
//         second_name,
//         last_name,
//         national_id,
//         email,
//         phone_number,
//         password,
//         type,
//       ]
//     );
//     dbRes = await db.query("SELECT * FROM users WHERE email=$1", [email]);
//     const user_id = dbRes.rows[0].id;

//     //make company name uniqe in db
//     dbRes = await db.query("SELECT * FROM subscribed_company WHERE name=$1", [
//       company_name,
//     ]);
//     const company_id = dbRes.rows[0].id;

//     dbRes = await db.query(
//       "INSERT INTO map_user_to_subscribed_company (user_id,subscribed_company_id) VALUES ($1,$2)",
//       [user_id, company_id]
//     );
//     res
//       .status(201)
//       .send({ success: true, message: "User created successfully" });
//   } catch (error) {
//     res
//       .status(500)
//       .send({ error: true, message: "failed to insert into users " });
//     return;
//   }
// });
// router.get("/insuranceCompanies", async (req, res) => {
//   const sessionId = req.get("SESSION_ID");

//   const result = await validateSessionId(sessionId);

//   if (!result.valid) {
//     res.status(401).send({
//       error: true,
//       message: "session invalid",
//       code: -2,
//     });
//     return;
//   }
//   let dbRes;
//   try {
//     dbRes = await db.query("SELECT * FROM insurance_companies");
//   } catch (error) {
//     res
//       .status(500)
//       .send({ error: true, message: "failed to get insurance companies" });
//     return;
//   }

//   let rows = dbRes.rows.map((row) => row.name);

//   res.send(rows);
// });
router.get("/insuranceComp", async (req, res) => {
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
      "SELECT DISTINCT company_name FROM user_to_insurance_services_view WHERE user_id=$1",
      [result.user_id]
    );
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }

  let rows = dbRes.rows.map((row) => row.company_name);

  res.send(rows);
});
router.post("/rate", async (req, res) => {
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
    company_name,
    q1,
    a1,
    q2,
    a2,
    q3,
    a3,
    q4,
    a4,
    q5,
    a5,
    q6,
    a6,
    q7,
    a7,
    comment,
  } = req.body;

  try {
    let dbRes = await db.query(
      "SELECT id FROM insurance_companies WHERE name=$1",
      [company_name]
    );
    if (dbRes.rows.length === 0) {
      return res
        .status(404)
        .send({ error: true, message: "Company not found" });
    }
    const company_id = dbRes.rows[0].id;

    await db.query(
      "DELETE FROM map_reviewes_to_company WHERE company_id=$1 AND user_id=$2",
      [company_id, result.user_id]
    );

    for (let i = 1; i <= 7; i++) {
      const question = req.body[`q${i}`];
      const answer = req.body[`a${i}`];

      await db.query(
        "INSERT INTO map_reviewes_to_company (company_id, user_id, question, answer, is_numeric) VALUES ($1, $2, $3, $4, $5)",
        [company_id, result.user_id, question, answer, "true"]
      );
    }

    if (comment !== null && comment !== undefined && comment !== "") {
      await db.query(
        "INSERT INTO map_reviewes_to_company (company_id, user_id, question, answer, is_numeric) VALUES ($1, $2, $3, $4, $5)",
        [company_id, result.user_id, "comment", comment, "false"]
      );
    }

    res
      .status(201)
      .send({ success: true, message: "Company ratings updated successfully" });
  } catch (error) {
    console.error("Error updating company ratings:", error);
    res
      .status(500)
      .send({ error: true, message: "Failed to update company ratings" });
  }
});

router.get("/compRate", async (req, res) => {
  const company = req.query.param1;

  let dbRes;
  try {
    dbRes = await db.query("SELECT * FROM insurance_companies WHERE name=$1", [
      company,
    ]);
    const company_id = dbRes.rows[0].id;
    dbRes = await db.query(
      "SELECT COUNT(id) AS number_of_reviews, SUM(CAST(answer AS INTEGER)) AS total_of_answers FROM map_reviewes_to_company WHERE is_numeric = $1 AND company_id = $2",
      [true, company_id]
    );
    const numberOfReviews = dbRes.rows[0].number_of_reviews;
    const totalOfAnswers = dbRes.rows[0].total_of_answers;
    let rating;
    if (numberOfReviews === 0) {
      rating = 0;
    } else {
      rating = totalOfAnswers / numberOfReviews;
    }

    res.send({ rating: rating });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }
});
router.get("/companyInfo", async (req, res) => {
  const company_name = req.query.param1;

  let dbRes;
  try {
    dbRes = await db.query("SELECT * FROM insurance_companies WHERE name=$1", [
      company_name,
    ]);
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }
  res.send(dbRes.rows[0]);
});
router.get("/compComment", async (req, res) => {
  const company = req.query.param1;

  let dbRes;
  try {
    dbRes = await db.query("SELECT * FROM insurance_companies WHERE name=$1", [
      company,
    ]);
    const company_id = dbRes.rows[0].id;
    dbRes = await db.query(
      "SELECT * FROM map_reviewes_to_company WHERE is_numeric = $1 AND company_id = $2",
      [false, company_id]
    );

    const comments = dbRes.rows.map((row) => row.answer);
    res.send(comments);
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }
});
router.get("/compInsu", async (req, res) => {
  const company = req.query.param1;

  let dbRes;
  try {
    dbRes = await db.query("SELECT * FROM insurance_companies WHERE name=$1", [
      company,
    ]);
    const company_id = dbRes.rows[0].id;
    dbRes = await db.query(
      "SELECT DISTINCT parent_name FROM company_service_view WHERE company_id = $1",
      [company_id]
    );

    const insurances = dbRes.rows.map((row) => row.parent_name);
    res.send(insurances);
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }
});
router.get("/compImage", async (req, res) => {
  const company = req.query.param1;

  try {
    const dbRes = await db.query(
      "SELECT logo FROM insurance_companies WHERE name=$1",
      [company]
    );

    if (dbRes.rows.length === 0 || !dbRes.rows[0].logo) {
      res.status(404).send({
        error: true,
        message: "Logo not found for the specified company",
      });
      return;
    }

    const logoData = dbRes.rows[0].logo;

    res.send({ image: logoData });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "Failed to get insurance company logo" });
  }
});
function base64ToBuffer(base64String) {
  const base64Data = base64String.split(";base64,").pop();
  return Buffer.from(base64Data, "base64");
}
router.get("/compPdf", async (req, res) => {
  const company = req.query.param1;

  try {
    const dbRes = await db.query(
      "SELECT pdf FROM insurance_companies WHERE name=$1",
      [company]
    );

    if (dbRes.rows.length === 0) {
      return res.status(404).send({ error: true, message: "PDF not found" });
    }

    const pdfBase64 = dbRes.rows[0].pdf;
    const pdfBuffer = base64ToBuffer(pdfBase64);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=document.pdf");
    res.send(pdfBuffer);
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "Failed to get insurance company logo" });
  }
});

router.post("/update-phone-number", async (req, res) => {
  const sessionId = req.get("SESSION_ID");
  const result = await validateSessionId(sessionId);

  if (!result.valid) {
    return res.status(401).send({
      error: true,
      message: "Session invalid",
      code: -2,
    });
  }

  const { newPhoneNumber } = req.body;
  if (!newPhoneNumber) {
    return res
      .status(400)
      .send({ error: true, message: "New phone number is required" });
  }

  try {
    await db.query("UPDATE users SET phone_number=$1 WHERE id=$2", [
      newPhoneNumber,
      result.user_id,
    ]);
    const mailOptions = {
      from: "insurenexus@gmail.com",
      to: result.email,
      subject: "Your token for changing password",
      text: `Your phone number is updated.`,
    };
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
        res.status(500).send({ error: true, message: "Failed to send email" });
      } else {
        console.log("Email sent: " + info.response);
        res.status(201).send({ success: true, message: " successfull" });
      }
    });
    res
      .status(200)
      .send({ success: true, message: "Phone number updated successfully" });
  } catch (error) {
    console.error("Error updating phone number:", error);
    res
      .status(500)
      .send({ error: true, message: "Failed to update phone number" });
  }
});

router.post("/update-password", async (req, res) => {
  const sessionId = req.get("SESSION_ID");
  const result = await validateSessionId(sessionId);

  if (!result.valid) {
    return res.status(401).send({
      error: true,
      message: "Session invalid",
      code: -2,
    });
  }

  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res
      .status(400)
      .send({ error: true, message: "Old and new passwords are required" });
  }

  try {
    const dbRes = await db.query("SELECT password FROM users WHERE id=$1", [
      result.user_id,
    ]);
    const currentPasswordHash = dbRes.rows[0].password;

    const oldPasswordHash = createHash("sha256")
      .update(oldPassword)
      .digest("base64");
    if (oldPasswordHash !== currentPasswordHash) {
      return res
        .status(401)
        .send({ error: true, message: "Old password is incorrect" });
    }

    const newPasswordHash = createHash("sha256")
      .update(newPassword)
      .digest("base64");
    await db.query("UPDATE users SET password=$1 WHERE id=$2", [
      newPasswordHash,
      result.user_id,
    ]);
    const mailOptions = {
      from: "insurenexus@gmail.com",
      to: result.email,
      subject: "Changing password",
      text: `Your password has been updated.`,
    };
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
        res.status(500).send({ error: true, message: "Failed to send email" });
      } else {
        console.log("Email sent: " + info.response);
        res.status(201).send({ success: true, message: " successfull" });
      }
    });
    res
      .status(200)
      .send({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).send({ error: true, message: "Failed to update password" });
  }
});
router.post("/forgotpass", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).send({
      error: true,
      message: "Email is required",
    });
    return;
  }

  let dbRes;
  try {
    dbRes = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    if (dbRes.rows.length === 0) {
      res.status(404).send({
        error: true,
        message: "User not found",
      });
      return;
    }
    let token = generator.generate({
      numbers: true,
      length: 6,
    });
    dbRes = await db.query(
      "INSERT INTO password_reset_tokens (token,email) VALUES ($1,$2)",
      [token, email]
    );
    const mailOptions = {
      from: "insurenexus@gmail.com",
      to: email,
      subject: "Changing password",
      text: `Your token is: ${token}.`,
    };
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
        res.status(500).send({ error: true, message: "Failed to send email" });
      } else {
        console.log("Email sent: " + info.response);
        res.status(201).send({ success: true, message: " successfull" });
      }
    });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }
});
router.post("/token", async (req, res) => {
  const { email, token } = req.body;

  let dbRes;
  try {
    dbRes = await db.query(
      "SELECT * FROM password_reset_tokens WHERE email=$1 AND token=$2 AND used=$3",
      [email, token, "false"]
    );
    if (dbRes.rows.length === 0) {
      res.status(404).send({
        error: true,
        message: "User not found",
      });
      return;
    }

    await db.query(
      "UPDATE password_reset_tokens SET used=$1 WHERE email=$2 AND token=$3",
      ["true", email, token]
    );

    res.status(200).send({
      success: true,
      message: "Token verified successfully",
    });
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }
});
router.post("/edit-password", async (req, res) => {
  const { newPassword, email } = req.body;

  try {
    let password = createHash("sha256").update(newPassword).digest("base64");
    await db.query("UPDATE users SET password=$1 WHERE email=$2", [
      password,
      email,
    ]);

    res.status(200).send({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).send({
      error: true,
      message: "Internal server error",
    });
  }
});
router.get("/userInsurances", async (req, res) => {
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

    const insurances = dbRes.rows.map((row) => row.service_name);
    res.send(insurances);
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }
});
router.get("/userFacilities", async (req, res) => {
  const sessionId = req.get("SESSION_ID");
  const insurance = req.query.param1;
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
      "SELECT * FROM user_to_insurance_services_view WHERE user_id=$1 AND service_name=$2",
      [result.user_id, insurance]
    );
    const company_name = dbRes.rows[0].company_name;
    dbRes = await db.query(
      "SELECT *  FROM company_service_facilities_view WHERE company_name = $1 AND service_name=$2",
      [company_name, insurance]
    );
    const facilityNames = dbRes.rows.map((row) => row.facility_name);

    const facilityDetails = await Promise.all(
      facilityNames.map(async (name) => {
        const facilityRes = await db.query(
          "SELECT * FROM facilities WHERE name = $1",
          [name]
        );
        return facilityRes.rows[0];
      })
    );

    res.send(facilityDetails);
  } catch (error) {
    res
      .status(500)
      .send({ error: true, message: "failed to get insurance companies" });
    return;
  }
});
module.exports = router;
