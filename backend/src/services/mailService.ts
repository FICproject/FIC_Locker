import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
    });
  }
  return transporter;
}

export async function sendAdminPasswordResetEmail(params: {
  to: string;
  otp: string;
  expiresMinutes: number;
}): Promise<{ delivered: boolean }> {
  const mailer = getTransporter();
  if (!mailer) {
    return { delivered: false };
  }

  await mailer.sendMail({
    from: env.smtp.from,
    to: params.to,
    subject: 'Admin Password Reset Verification Code',
    text: `Your Platform Admin password reset code is: ${params.otp}. It expires in ${params.expiresMinutes} minutes.`,
    html: `<p>Your Platform Admin password reset verification code is:</p>
           <h2 style="letter-spacing:4px;">${params.otp}</h2>
           <p>This code expires in ${params.expiresMinutes} minutes. If you did not request this reset, check your Admin security audit logs immediately.</p>`,
  });

  return { delivered: true };
}

