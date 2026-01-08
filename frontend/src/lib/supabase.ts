import { createClient } from "@supabase/supabase-js"

// Configuración de Supabase
// Solo usamos PostgreSQL, NO Supabase Auth (autenticación es con API CEDUC)
const urlSupabase = 'https://wpcyiowrmmbnmbrtqtfu.supabase.co'
const claveAnonima = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwY3lpb3dybW1ibm1icnRxdGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1OTM0MzksImV4cCI6MjA4MzE2OTQzOX0.bg1XPb0D3mH5rvsvbw8CufJMz1WQ_16k16aKOByoDis'

export const supabase = createClient(urlSupabase, claveAnonima)