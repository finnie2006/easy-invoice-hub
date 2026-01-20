import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthentikSettings {
  authentik_url: string;
  authentik_client_id: string;
  authentik_client_secret: string;
}

// Helper function to get Authentik settings from database or env vars
async function getAuthentikSettings(supabaseAdmin: any): Promise<AuthentikSettings> {
  // First try to get from database
  const { data: dbSettings } = await supabaseAdmin
    .from('app_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['authentik_url', 'authentik_client_id', 'authentik_client_secret']);

  const settings: AuthentikSettings = {
    authentik_url: '',
    authentik_client_id: '',
    authentik_client_secret: '',
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
  if (!settings.authentik_client_secret) settings.authentik_client_secret = Deno.env.get("AUTHENTIK_CLIENT_SECRET") || '';

  return settings;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, state, redirect_uri } = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Authentik settings from database or environment
    const authentikSettings = await getAuthentikSettings(supabaseAdmin);
    const redirectUri = redirect_uri || Deno.env.get("AUTHENTIK_REDIRECT_URI");

    console.log("Authentik callback - settings loaded:", { 
      url: authentikSettings.authentik_url, 
      clientId: authentikSettings.authentik_client_id ? '***' : 'not set',
      hasSecret: !!authentikSettings.authentik_client_secret
    });

    if (!authentikSettings.authentik_url || !authentikSettings.authentik_client_id || !authentikSettings.authentik_client_secret) {
      return new Response(
        JSON.stringify({ error: "Authentik niet volledig geconfigureerd. Stel alle Authentik instellingen in via Instellingen > Systeeminstellingen." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!redirectUri) {
      return new Response(
        JSON.stringify({ error: "Redirect URI niet geconfigureerd" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(`${authentikSettings.authentik_url}/application/o/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: authentikSettings.authentik_client_id,
        client_secret: authentikSettings.authentik_client_secret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Token exchange mislukt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokens = await tokenResponse.json();

    // Get user info from Authentik
    const userInfoResponse = await fetch(`${authentikSettings.authentik_url}/application/o/userinfo/`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Gebruikersinfo ophalen mislukt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userInfo = await userInfoResponse.json();
    console.log("User info from Authentik:", userInfo);

    // Check if user exists by email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let existingUser = existingUsers?.users?.find(u => u.email === userInfo.email);

    let userId: string;

    if (existingUser) {
      // User exists, update their metadata
      userId = existingUser.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          full_name: userInfo.name || userInfo.preferred_username,
          avatar_url: userInfo.picture,
          authentik_sub: userInfo.sub,
        },
      });
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: userInfo.email,
        email_confirm: true,
        user_metadata: {
          full_name: userInfo.name || userInfo.preferred_username,
          avatar_url: userInfo.picture,
          authentik_sub: userInfo.sub,
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Gebruiker aanmaken mislukt" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
    }

    // Generate a session for the user using a magic link approach
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userInfo.email,
      options: {
        redirectTo: '/',
      },
    });

    if (sessionError) {
      console.error("Error generating session:", sessionError);
      return new Response(
        JSON.stringify({ error: "Sessie aanmaken mislukt" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the token from the magic link
    const magicLinkUrl = new URL(sessionData.properties.action_link);
    const token = magicLinkUrl.searchParams.get('token');
    const tokenType = magicLinkUrl.searchParams.get('type');

    return new Response(
      JSON.stringify({ 
        success: true,
        token,
        tokenType,
        email: userInfo.email,
        redirectUrl: sessionData.properties.action_link,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in authentik-callback:", error);
    const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
