const nodemailer = require("nodemailer");

// Create a transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "insurenexus@gmail.com",
    pass: "mvme jrrc sodu vrfo",
  },
});

module.exports = transporter;
