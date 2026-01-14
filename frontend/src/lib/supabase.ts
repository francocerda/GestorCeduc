import { createClient } from "@supabase/supabase-js"

// Configuración de Supabase desde variables de entorno
const urlSupabase = import.meta.env.VITE_SUPABASE_URL || ''
const claveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(urlSupabase, claveAnonima)