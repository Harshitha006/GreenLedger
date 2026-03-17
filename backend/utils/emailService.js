const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Email templates
const getEmailTemplate = (template, data) => {
    const templates = {
        emailVerification: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #22c55e; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: #22c55e; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to GreenLedger! 🌱</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.name},</h2>
            <p>Thank you for joining GreenLedger! Please verify your email address to start earning green credits for your sustainable actions.</p>
            <div style="text-align: center;">
              <a href="${data.verificationLink}" class="button">Verify Email Address</a>
            </div>
            <p>If the button doesn't work, copy and paste this link:</p>
            <p>${data.verificationLink}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, you can ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 GreenLedger. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,

        passwordReset: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #22c55e; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: #22c55e; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.name},</h2>
            <p>We received a request to reset your password for your GreenLedger account.</p>
            <div style="text-align: center;">
              <a href="${data.resetLink}" class="button">Reset Password</a>
            </div>
            <p>If the button doesn't work, copy and paste this link:</p>
            <p>${data.resetLink}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, you can ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 GreenLedger. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,

        passwordChanged: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #22c55e; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Changed</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.name},</h2>
            <p>Your GreenLedger account password was successfully changed.</p>
            <p>If you did not make this change, please contact us immediately.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 GreenLedger. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,

        welcome: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #22c55e; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .stats { background: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .stat-item { margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to GreenLedger! 🌱</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.name},</h2>
            <p>Thank you for joining the GreenLedger community! You're now part of a movement to make sustainability measurable and rewarding.</p>
            
            <div class="stats">
              <h3>Here's what you can do:</h3>
              <div class="stat-item">✅ Upload your electricity bills to earn credits</div>
              <div class="stat-item">✅ Track your CO2 savings in real-time</div>
              <div class="stat-item">✅ Compete with others on the leaderboard</div>
              <div class="stat-item">✅ Redeem credits for rewards</div>
            </div>
            
            <p>Start your sustainability journey today!</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 GreenLedger. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    };

    return templates[template] || '<p>Email template not found</p>';
};

// Send email
const sendEmail = async ({ email, subject, template, data }) => {
    try {
        const htmlContent = getEmailTemplate(template, data);

        const mailOptions = {
            from: `"GreenLedger" <${process.env.EMAIL_USER}>`,
            to: email,
            subject,
            html: htmlContent,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email sending failed:', error);
        throw new Error('Email could not be sent');
    }
};

module.exports = { sendEmail };
