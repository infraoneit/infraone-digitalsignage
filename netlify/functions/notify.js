// netlify/functions/notify.js
// Versendet je nach "type" (demo|booking) zwei Mails:
// 1) Interne Nachricht an TO_EMAIL
// 2) Gebrandete Bestätigungs-Mail an den Kunden (FROM_EMAIL als Absender)

const RESEND_URL = "https://api.resend.com/emails";

// === Brand-Assets & Kontaktangaben (bei Bedarf hier anpassen) ===
const BRAND = {
  company: "InfraOne IT Solutions GmbH",
  location: "Winterthur",
  phone: "+41 52 222 18 18",
  email: "info@infraone.ch",
  website: "https://www.infraone.ch/",
  logo: "https://www.werbebildschirme.ch/assets/images/logo.png" // absolute URL fürs Mailing
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true }); // CORS Preflight
  }
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method Not Allowed" });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@infraone.ch";
  const TO_EMAIL = process.env.TO_EMAIL || "info@infraone.ch";

  if (!RESEND_API_KEY) {
    return json(500, { ok: false, error: "RESEND_API_KEY fehlt" });
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const type = (data.type || "").toLowerCase();

    // Minimal-Validierung je Typ
    if (type === "demo") {
      requireFields(data, ["name", "email", "slots"]);
    } else if (type === "booking") {
      requireFields(data, ["name", "email", "package", "config"]);
    } else {
      return json(400, { ok: false, error: "Ungültiger type (erwartet: demo|booking)" });
    }

    // Honeypot: wenn befüllt, still OK, aber nichts tun
    if (data.honey && String(data.honey).trim() !== "") {
      return json(200, { ok: true });
    }

    // 1) Interne Mail an dich
    const adminSubject = type === "demo"
      ? `DEMO-Anfrage – ${safe(data.name)}`
      : `BESTELLUNG – ${safe(data.name)}`;

    const adminHtml = type === "demo"
      ? adminDemoHtml(data)
      : adminBookingHtml(data);

    await sendEmail(RESEND_API_KEY, {
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject: adminSubject,
      html: adminHtml,
      reply_to: data.email // Antworten gehen direkt an Kund:in
    });

    // 2) Bestätigung an Kund:in – gebrandet
    const custSubject = type === "demo"
      ? "Ihre Demo-Anfrage bei InfraOne – bestätigt"
      : "Ihre Bestellung bei InfraOne – bestätigt";

    const custHtml = type === "demo"
      ? customerDemoHtml(data)
      : customerBookingHtml(data);

    await sendEmail(RESEND_API_KEY, {
      from: FROM_EMAIL,
      to: [data.email],
      subject: custSubject,
      html: custHtml
    });

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { ok: false, error: err.message || "Serverfehler" });
  }
}

/* ------------ Helpers ------------- */
function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(obj)
  };
}
function requireFields(data, list) {
  for (const f of list) {
    if (!data[f] || String(data[f]).trim() === "") {
      throw new Error(`Feld fehlt: ${f}`);
    }
  }
}
async function sendEmail(apiKey, payload) {
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend-Fehler: ${t}`);
  }
}
function safe(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function nl2br(s) { return safe(String(s || "")).replace(/\n/g, "<br>"); }

/* ------------ Admin-Templates (intern, schlicht) ------------- */
function adminDemoHtml(d) {
  return `
  <h2>Neue DEMO-Anfrage</h2>
  <table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#e5e7eb">
    <tr><td><b>Name</b></td><td>${safe(d.name)}</td></tr>
    <tr><td><b>E-Mail</b></td><td>${safe(d.email)}</td></tr>
    ${d.phone ? `<tr><td><b>Telefon</b></td><td>${safe(d.phone)}</td></tr>` : ""}
    <tr><td><b>Terminvorschläge</b></td><td>${nl2br(d.slots)}</td></tr>
    ${d.message ? `<tr><td><b>Nachricht</b></td><td>${nl2br(d.message)}</td></tr>` : ""}
  </table>
  <p style="color:#64748b;font-size:12px">Seite: ${safe(d.page || "")}</p>`;
}
function adminBookingHtml(d) {
  return `
  <h2>Neue BESTELLUNG</h2>
  <table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#e5e7eb">
    <tr><td><b>Name</b></td><td>${safe(d.name)}</td></tr>
    <tr><td><b>E-Mail</b></td><td>${safe(d.email)}</td></tr>
    ${d.phone ? `<tr><td><b>Telefon</b></td><td>${safe(d.phone)}</td></tr>` : ""}
    ${d.company ? `<tr><td><b>Firma</b></td><td>${safe(d.company)}</td></tr>` : ""}
    <tr><td><b>Paket</b></td><td>${safe(d.package || d.paket)}</td></tr>
    <tr><td><b>Konfiguration</b></td><td>${nl2br(d.config || d.konfiguration)}</td></tr>
    ${d.message ? `<tr><td><b>Nachricht</b></td><td>${nl2br(d.message)}</td></tr>` : ""}
  </table>
  <p style="color:#64748b;font-size:12px">Seite: ${safe(d.page || "")}</p>`;
}

/* ------------ Kunden-Templates (gebrandet & professionell) ------------- */
// Gemeinsamer Wrapper mit Logo, Rahmen, Footer (Winterthur + Kontakt)
function brandWrap({ title, lead, bodyHtml }) {
  return `
  <!doctype html>
  <html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="color-scheme" content="light only">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${safe(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f5f9;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:14px;box-shadow:0 4px 24px rgba(15,23,42,.08);overflow:hidden;">
            <tr>
              <td style="padding:18px 22px;border-bottom:1px solid #e7eef5;background:#0f172a;">
                <img src="${BRAND.logo}" alt="InfraOne" width="140" style="display:block;">
              </td>
            </tr>
            <tr>
              <td style="padding:22px 22px 6px 22px;">
                <h1 style="margin:0 0 6px 0;font:700 22px/1.3 Inter,Arial,sans-serif;color:#0f172a;">${safe(title)}</h1>
                ${lead ? `<p style="margin:0 0 10px 0;font:400 15px/1.6 Inter,Arial,sans-serif;color:#334155;">${lead}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:0 22px 20px 22px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 22px 22px 22px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <p style="margin:0 0 6px 0;font:600 14px/1.5 Inter,Arial,sans-serif;color:#0f172a;">Kontakt</p>
                      <p style="margin:0;font:400 14px/1.7 Inter,Arial,sans-serif;color:#475569;">
                        ${safe(BRAND.company)} • ${safe(BRAND.location)}<br>
                        Tel. ${safe(BRAND.phone)} • <a href="mailto:${safe(BRAND.email)}" style="color:#3C9646;text-decoration:none;">${safe(BRAND.email)}</a><br>
                        <a href="${safe(BRAND.website)}" style="color:#3C9646;text-decoration:none;">${safe(BRAND.website)}</a>
                      </p>
                    </td>
                  </tr>
                </table>
                <p style="margin:10px 0 0 0;font:400 12px/1.6 Inter,Arial,sans-serif;color:#94a3b8;">
                  Diese E-Mail wurde automatisch generiert. Antworten sind möglich und werden gelesen.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 22px;background:#0f172a;color:#cbd5e1;font:400 12px/1.6 Inter,Arial,sans-serif;">
                © ${new Date().getFullYear()} ${safe(BRAND.company)} • ${safe(BRAND.location)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

function lineItem(label, value) {
  return `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;width:180px;font:600 14px/1.6 Inter,Arial,sans-serif;color:#0f172a;">${safe(label)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;font:400 14px/1.6 Inter,Arial,sans-serif;color:#334155;">${value}</td>
    </tr>
  `;
}

// --- Kundenmail: DEMO ---
function customerDemoHtml(d) {
  const title = "Bestätigung Ihrer Demo-Anfrage";
  const lead = "Vielen Dank für Ihre Anfrage. Wir melden uns in Kürze mit einer Terminbestätigung.";
  const details = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tbody>
        ${lineItem("Name", safe(d.name))}
        ${lineItem("E-Mail", safe(d.email))}
        ${d.phone ? lineItem("Telefon", safe(d.phone)) : ""}
        ${lineItem("Ihre Terminvorschläge", nl2br(d.slots))}
      </tbody>
    </table>
  `;
  const bodyHtml = `
    <p style="margin:0 0 12px 0;font:400 15px/1.8 Inter,Arial,sans-serif;color:#334155;">
      Damit wir effizient planen können, prüfen wir Ihre Vorschläge und senden Ihnen den finalen Termin per E-Mail.
    </p>
    ${details}
  `;
  return brandWrap({ title, lead, bodyHtml });
}

// --- Kundenmail: BESTELLUNG ---
function customerBookingHtml(d) {
  const title = "Bestätigung Ihrer Bestellung";
  const lead = "Vielen Dank für Ihre Bestellung. Wir haben Ihre Angaben erhalten und melden uns in Kürze zur Terminabstimmung.";
  const details = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tbody>
        ${lineItem("Name", safe(d.name))}
        ${d.company ? lineItem("Firma", safe(d.company)) : ""}
        ${lineItem("E-Mail", safe(d.email))}
        ${d.phone ? lineItem("Telefon", safe(d.phone)) : ""}
        ${lineItem("Paket", safe(d.package || d.paket))}
        ${lineItem("Konfiguration", nl2br(d.config || d.konfiguration))}
      </tbody>
    </table>
  `;
  const bodyHtml = `
    <p style="margin:0 0 12px 0;font:400 15px/1.8 Inter,Arial,sans-serif;color:#334155;">
      Unsere Projektleitung prüft Ihre Bestellung und stimmt die nächsten Schritte (Installation, Inhalte, Go-Live) mit Ihnen ab.
    </p>
    ${details}
  `;
  return brandWrap({ title, lead, bodyHtml });
}
