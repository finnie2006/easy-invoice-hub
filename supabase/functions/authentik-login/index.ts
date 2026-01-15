import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AUTHENTIK_ISSUER = Deno.env.get("AUTHENTIK_ISSUER");
    const AUTHENTIK_CLIENT_ID = Deno.env.get("AUTHENTIK_CLIENT_ID");
    const REDIRECT_URI = Deno.env.get("AUTHENTIK_REDIRECT_URI");

    if (!AUTHENTIK_ISSUER || !AUTHENTIK_CLIENT_ID || !REDIRECT_URI) {
      return new Response(
        JSON.stringify({ error: "Authentik niet geconfigureerd" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a random state for CSRF protection
    const state = crypto.randomUUID();
    
    // Build the authorization URL
    const authUrl = new URL(`${AUTHENTIK_ISSUER}/application/o/authorize/`);
    authUrl.searchParams.set("client_id", AUTHENTIK_CLIENT_ID);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
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
