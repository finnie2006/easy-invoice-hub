import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendInvoiceRequest {
  invoiceId: string;
  recipientEmail: string;
  recipientName?: string;
  customMessage?: string;
}

interface SmtpSettings {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

// Helper function to get SMTP settings from database or env vars
async function getSmtpSettings(supabaseAdmin: any): Promise<SmtpSettings> {
  // First try to get from database
  const { data: dbSettings, error } = await supabaseAdmin
    .from('app_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name']);

  const settings: SmtpSettings = {
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    smtp_from_email: '',
    smtp_from_name: 'Facturatie',
  };

  if (dbSettings && dbSettings.length > 0) {
    dbSettings.forEach((row: any) => {
      const key = row.setting_key as keyof SmtpSettings;
      if (key in settings) {
        const value = row.setting_value;
        settings[key] = typeof value === 'string' ? value.replace(/"/g, '') : String(value);
      }
    });
  }

  // Fall back to environment variables if database settings are empty
  if (!settings.smtp_host) settings.smtp_host = Deno.env.get("SMTP_HOST") || '';
  if (!settings.smtp_user) settings.smtp_user = Deno.env.get("SMTP_USER") || '';
  if (!settings.smtp_password) settings.smtp_password = Deno.env.get("SMTP_PASS") || '';
  if (!settings.smtp_from_email) settings.smtp_from_email = Deno.env.get("SMTP_FROM") || settings.smtp_user;
  if (!settings.smtp_from_name || settings.smtp_from_name === 'Facturatie') {
    settings.smtp_from_name = Deno.env.get("SMTP_FROM_NAME") || 'Facturatie';
  }

  return settings;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Geen autorisatie header gevonden");
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // User client for fetching invoice data
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Admin client for reading app_settings (which may have different RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get SMTP settings from database or environment
    const smtpSettings = await getSmtpSettings(supabaseAdmin);
    console.log("SMTP settings loaded:", { 
      host: smtpSettings.smtp_host, 
      port: smtpSettings.smtp_port,
      user: smtpSettings.smtp_user ? '***' : 'not set',
      from: smtpSettings.smtp_from_email 
    });

    if (!smtpSettings.smtp_host || !smtpSettings.smtp_user || !smtpSettings.smtp_password) {
      throw new Error("SMTP configuratie ontbreekt. Stel de SMTP instellingen in via Instellingen > Systeeminstellingen.");
    }

    // Get request body
    const { invoiceId, recipientEmail, recipientName, customMessage }: SendInvoiceRequest = await req.json();

    if (!invoiceId || !recipientEmail) {
      throw new Error("invoiceId en recipientEmail zijn verplicht");
    }

    // Fetch invoice with items
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Factuur niet gevonden");
    }

    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order');

    if (itemsError) {
      throw new Error("Factuurregels niet gevonden");
    }

    // Fetch profile for sender info
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', invoice.user_id)
      .single();

    // Build email HTML
    const itemsHtml = items.map((item: any, index: number) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${index + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.btw_percentage}%</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.subtotal)}</td>
      </tr>
    `).join('');

    const dueDate = new Date(invoice.due_date).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const invoiceDate = new Date(invoice.invoice_date).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .company-name { font-size: 24px; font-weight: bold; color: #1a1a1a; }
          .invoice-info { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { text-align: left; padding: 10px; border-bottom: 2px solid #333; }
          .totals { text-align: right; margin-top: 20px; }
          .total-row { font-size: 18px; font-weight: bold; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
          .payment-info { background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="company-name">${profile?.company_name || 'Uw Bedrijf'}</div>
            ${profile?.company_address ? `<div>${profile.company_address}</div>` : ''}
            ${profile?.company_postal_code || profile?.company_city ? `<div>${profile.company_postal_code || ''} ${profile.company_city || ''}</div>` : ''}
          </div>

          <p>Geachte ${recipientName || invoice.client_contact_name || invoice.client_company_name},</p>
          
          ${customMessage ? `<p>${customMessage}</p>` : `<p>Hierbij ontvangt u factuur ${invoice.invoice_number}.</p>`}

          <div class="invoice-info">
            <strong>Factuurnummer:</strong> ${invoice.invoice_number}<br>
            <strong>Factuurdatum:</strong> ${invoiceDate}<br>
            <strong>Vervaldatum:</strong> ${dueDate}
          </div>

          <table>
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Omschrijving</th>
                <th style="text-align: right;">Aantal</th>
                <th style="text-align: right;">BTW</th>
                <th style="text-align: right;">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div>Subtotaal: ${formatCurrency(invoice.subtotal)}</div>
            <div>BTW: ${formatCurrency(invoice.total_btw)}</div>
            <div class="total-row">Totaal: ${formatCurrency(invoice.total)}</div>
          </div>

          <div class="payment-info">
            <strong>Betalingsgegevens:</strong><br>
            Gelieve het bedrag van ${formatCurrency(invoice.total)} voor ${dueDate} over te maken naar:<br>
            ${profile?.company_name ? `<strong>${profile.company_name}</strong><br>` : ''}
            ${profile?.iban ? `IBAN: ${profile.iban}<br>` : ''}
            Onder vermelding van: ${invoice.payment_reference || invoice.invoice_number}
          </div>

          ${invoice.notes ? `
            <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
              <strong>Opmerkingen:</strong><br>
              ${invoice.notes.replace(/\n/g, '<br>')}
            </div>
          ` : ''}

          <div class="footer">
            <p>Met vriendelijke groet,<br>${profile?.company_name || 'Uw Bedrijf'}</p>
            ${profile?.kvk_number ? `<div>KVK: ${profile.kvk_number}</div>` : ''}
            ${profile?.btw_number ? `<div>BTW: ${profile.btw_number}</div>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email via SMTP
    const smtpPort = parseInt(smtpSettings.smtp_port);
    const client = new SMTPClient({
      connection: {
        hostname: smtpSettings.smtp_host,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: {
          username: smtpSettings.smtp_user,
          password: smtpSettings.smtp_password,
        },
      },
    });

    const fromEmail = smtpSettings.smtp_from_email || smtpSettings.smtp_user;
    await client.send({
      from: `${smtpSettings.smtp_from_name} <${fromEmail}>`,
      to: recipientEmail,
      subject: `Factuur ${invoice.invoice_number} - ${profile?.company_name || 'Factuur'}`,
      html: emailHtml,
    });

    await client.close();

    console.log(`Invoice email sent successfully to ${recipientEmail}`);

    return new Response(
      JSON.stringify({ success: true, message: "E-mail succesvol verzonden" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending invoice email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
