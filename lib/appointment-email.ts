// Appointment confirmation email sent to the client when staff book a
// consultation. Mirrors the consultation-email template (Cosmos header + logo,
// white body). Self-contained so it doesn't alter the other email builders.

const COSMOS = '#1f333a';
const CREAM = '#eae0d5';
const INK = '#3f3f46';
const MUTED = '#71717a';

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface AppointmentEmailData {
  firstName: string;
  dateLabel: string; // "Monday, July 7, 2025"
  timeLabel: string; // "10:00 AM — 11:00 AM Eastern Time"
  address: string;
  consultant: string;
  baseUrl: string;
}

export function buildAppointmentConfirmationHtml(d: AppointmentEmailData): string {
  const detailRow = (content: string) =>
    `<tr><td style="padding:6px 0;font-size:14px;color:#231F20;line-height:1.5;">${content}</td></tr>`;

  return `<div style="background:#f6f1ea;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <div style="background:${COSMOS};color:${CREAM};padding:24px;text-align:center;">
        <img src="${d.baseUrl}/images/logos/logo-full-transparent.png" alt="The Closet Fitters" style="height:120px;width:auto;display:block;margin:0 auto 12px;" />
        <div style="font-size:20px;font-weight:700;">Your Consultation is Confirmed</div>
      </div>
      <div style="padding:22px 24px;color:${INK};">
        <p style="margin:0 0 12px;font-size:15px;">Hi ${esc(d.firstName)},</p>
        <p style="margin:0 0 4px;font-size:14px;line-height:1.55;">Your consultation with The Closet Fitters has been confirmed. We look forward to helping you design your perfect closet.</p>

        <div style="background:#F8F4F0;border:1px solid #C7AC90;border-radius:8px;padding:20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            ${detailRow(`📅 <strong>Date:</strong> ${esc(d.dateLabel)}`)}
            ${detailRow(`🕐 <strong>Time:</strong> ${esc(d.timeLabel)}`)}
            ${detailRow(`📍 <strong>Location:</strong> In-home consultation at:<br/>${esc(d.address)}`)}
            ${detailRow(`👤 <strong>Your consultant:</strong> ${esc(d.consultant)}`)}
          </table>
        </div>

        <p style="margin:16px 0 6px;font-size:14px;font-weight:700;color:${COSMOS};">What to expect:</p>
        <ul style="margin:0 0 8px;padding-left:20px;font-size:14px;line-height:1.5;">
          <li style="margin:4px 0;">Your consultant will visit your home to take precise measurements</li>
          <li style="margin:4px 0;">We&rsquo;ll review your design preferences and closet configuration</li>
          <li style="margin:4px 0;">You&rsquo;ll receive a detailed quote following the consultation</li>
        </ul>

        <p style="margin:16px 0 4px;font-size:14px;font-weight:700;color:${COSMOS};">Questions? Contact us:</p>
        <p style="margin:0;font-size:14px;line-height:1.6;">Phone: (954) 589-3233<br/>
          Email: <a href="mailto:Sales@theclosetfitters.com" style="color:${COSMOS};">Sales@theclosetfitters.com</a>
        </p>

        <div style="border-top:1px solid #e5e0d5;margin-top:22px;padding-top:16px;text-align:center;color:${MUTED};font-size:13px;">
          <div style="font-weight:700;color:${COSMOS};">The Closet Fitters</div>
          <div>Custom closets, built for you.</div>
        </div>
      </div>
    </div>
  </div>`;
}
