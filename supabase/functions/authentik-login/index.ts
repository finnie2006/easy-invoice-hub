import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthentikSettings {
  authentik_url: string;
  authentik_client_id: string;
}

// Helper function to get Authentik settings from database or env vars
async function getAuthentikSettings(supabaseAdmin: any): Promise<AuthentikSettings> {
  // First try to get from database
  const { data: dbSettings } = await supabaseAdmin
    .from('app_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['authentik_url', 'authentik_client_id']);

  const settings: AuthentikSettings = {
    authentik_url: '',
    authentik_client_id: '',
  };

  if (dbSettings && dbSettings.length > 0) {
    dbSettings.forEach((row: any) => {
      const key = row.setting_key as keyof AuthentikSettings;
      if (key in settings) {
        const value = row.setting_value;
        settings[key] = typeof value === 'string' ? value.replace(/"/g, '') : String(value);
      }
    });
  }

  // Fall back to environment variables if database settings are empty
  if (!settings.authentik_url) settings.authentik_url = Deno.env.get("AUTHENTIK_ISSUER") || '';
  if (!settings.authentik_client_id) settings.authentik_client_id = Deno.env.get("AUTHENTIK_CLIENT_ID") || '';

  return settings;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase admin client to read app_settings
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get Authentik settings from database or environment
    const authentikSettings = await getAuthentikSettings(supabaseAdmin);
    
    // Get redirect URI from request body or use default
    let redirectUri = Deno.env.get("AUTHENTIK_REDIRECT_URI");
    try {
      const body = await req.json();
      if (body.redirect_uri) {
        redirectUri = body.redirect_uri;
      }
    } catch {
      // No body or invalid JSON, use default
    }

    console.log("Authentik settings loaded:", { 
      url: authentikSettings.authentik_url, 
      clientId: authentikSettings.authentik_client_id ? '***' : 'not set',
      redirectUri 
    });

    if (!authentikSettings.authentik_url || !authentikSettings.authentik_client_id) {
      return new Response(
        JSON.stringify({ error: "Authentik niet geconfigureerd. Stel de Authentik instellingen in via Instellingen > Systeeminstellingen." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!redirectUri) {
      return new Response(
        JSON.stringify({ error: "Redirect URI niet geconfigureerd" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a random state for CSRF protection
    const state = crypto.randomUUID();
    
    // Build the authorization URL
    const authUrl = new URL(`${authentikSettings.authentik_url}/application/o/authorize/`);
    authUrl.searchParams.set("client_id", authentikSettings.authentik_client_id);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", "openid profile email");
    authUrl.searchParams.set("state", state);

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString(), state }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in authentik-login:", error);
    const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
