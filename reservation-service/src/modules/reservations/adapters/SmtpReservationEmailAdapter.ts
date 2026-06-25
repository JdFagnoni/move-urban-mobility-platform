import nodemailer from "nodemailer";
import type {
  ReservationEmailPort,
  UnsupportedReservationEmailInput,
} from "../ports/ReservationEmailPort";

interface SmtpReservationEmailAdapterConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string | undefined;
  pass?: string | undefined;
  fromEmail: string;
  fromName: string;
}

export class SmtpReservationEmailAdapter implements ReservationEmailPort {
  private readonly transporter;

  public constructor(private readonly config: SmtpReservationEmailAdapterConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth:
        config.user && config.pass
          ? {
              user: config.user,
              pass: config.pass,
            }
          : undefined,
    });
  }

  async sendUnsupportedReservationEmail(input: UnsupportedReservationEmailInput): Promise<void> {
    await this.transporter.sendMail({
      from: formatSender(this.config.fromEmail, this.config.fromName),
      to: input.recipientEmail,
      subject: "MOVE could not accept your reservation request",
      text: [
        `Hello ${input.recipientName},`,
        "",
        "Thank you for choosing MOVE.",
        "After reviewing your request, our operations team determined that we cannot fulfill it.",
        "This can happen when the requested cargo does not match the types of items MOVE currently transports.",
        "",
        "We apologize for the inconvenience.",
        "MOVE Team",
      ].join("\n"),
    });
  }
}

function formatSender(email: string, name: string): string {
  const normalizedName = name.trim();
  return normalizedName ? `${normalizedName} <${email}>` : email;
}
