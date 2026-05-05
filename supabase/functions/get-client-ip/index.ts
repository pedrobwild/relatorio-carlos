/* eslint-disable no-console */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP from various headers
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    
    // Priority: CF > X-Forwarded-For (first IP) > X-Real-IP > fallback
    let clientIp = 'unknown';
    
    if (cfConnectingIp) {
      clientIp = cfConnectingIp;
    } else if (forwardedFor) {
      clientIp = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      clientIp = realIp;
    }

    console.log('Client IP detected');

    return new Response(
      JSON.stringify({ ip: clientIp }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error getting client IP:', error);
    return new Response(
      JSON.stringify({ ip: 'unknown', error: String(error) }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }
});
