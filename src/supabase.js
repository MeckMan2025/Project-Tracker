import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wqxjmykphkacbjfxmvzd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxeGpteWtwaGthY2JqZnhtdnpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MTg0NTgsImV4cCI6MjA4NTk5NDQ1OH0.OmNsb70zKywPKjsdB4eZG5_IfsMi4fLjSBqFhXYLcik'

export const supabase = createClient(supabaseUrl, supabaseKey)
