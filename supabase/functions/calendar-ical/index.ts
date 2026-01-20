import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function formatICalDate(dateStr: string, allDay: boolean): string {
  const date = new Date(dateStr)
  if (allDay) {
    return date.toISOString().replace(/[-:]/g, '').split('T')[0]
  }
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function generateICalEvent(event: any): string {
  const lines: string[] = []
  
  lines.push('BEGIN:VEVENT')
  lines.push(`UID:${event.id}@lovable.app`)
  lines.push(`DTSTAMP:${formatICalDate(new Date().toISOString(), false)}`)
  
  if (event.all_day) {
    lines.push(`DTSTART;VALUE=DATE:${formatICalDate(event.start_time, true)}`)
    lines.push(`DTEND;VALUE=DATE:${formatICalDate(event.end_time, true)}`)
  } else {
    lines.push(`DTSTART:${formatICalDate(event.start_time, false)}`)
    lines.push(`DTEND:${formatICalDate(event.end_time, false)}`)
  }
  
  lines.push(`SUMMARY:${escapeICalText(event.title)}`)
  
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICalText(event.description)}`)
  }
  
  if (event.location) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`)
  }
  
  lines.push(`CREATED:${formatICalDate(event.created_at, false)}`)
  lines.push(`LAST-MODIFIED:${formatICalDate(event.updated_at, false)}`)
  lines.push('END:VEVENT')
  
  return lines.join('\r\n')
}

function generateICalendar(events: any[], calendarName: string): string {
  const lines: string[] = []
  
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//Lovable//Calendar//NL')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push(`X-WR-CALNAME:${escapeICalText(calendarName)}`)
  lines.push('X-WR-TIMEZONE:Europe/Amsterdam')
  
  for (const event of events) {
    lines.push(generateICalEvent(event))
  }
  
  lines.push('END:VCALENDAR')
  
  return lines.join('\r\n')
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get('user_id')
    const token = url.searchParams.get('token')

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch user's calendar events
    const { data: events, error: eventsError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true })

    if (eventsError) {
      console.error('Error fetching events:', eventsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch events' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch profile for calendar name
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('user_id', userId)
      .single()

    const calendarName = profile?.company_name 
      ? `${profile.company_name} Agenda` 
      : 'Mijn Agenda'

    const icalContent = generateICalendar(events || [], calendarName)

    console.log(`Generated iCal for user ${userId} with ${events?.length || 0} events`)

    return new Response(icalContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="calendar.ics"',
      },
    })
  } catch (error) {
    console.error('Error generating iCal:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
