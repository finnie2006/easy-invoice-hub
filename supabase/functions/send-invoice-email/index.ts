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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get SMTP settings from environment
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || smtpUser;
    const smtpFromName = Deno.env.get("SMTP_FROM_NAME") || "Facturatie";

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error("SMTP configuratie ontbreekt. Stel SMTP_HOST, SMTP_USER en SMTP_PASS in.");
    }

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Geen autorisatie header gevonden");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

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
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    await client.send({
      from: `${smtpFromName} <${smtpFrom}>`,
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
