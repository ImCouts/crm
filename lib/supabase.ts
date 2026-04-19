import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Lead = {
  business_phone: string
  company_name: string
  website: string | null
  rbq: string | null
  owner_name: string | null
  owner_phone: string | null
  approx_rev: number | null
  industry: string | null
  employee_count: number | null
  email: string | null
  created_at: string
}

export type LeadStatus = {
  business_phone: string
  status: 'lead' | 'no_answer' | 'discovery_call' | 'interested' | 'booked' | 'pending' | 'lost' | null
  call_count: number | null
  offer_amount: number | null
  last_called_at: string | null
  last_emailed_at: string | null
  status_changed_at: string | null
}

export type CallLog = {
  id: string
  business_phone: string
  called_at: string
  note: string | null
  created_at: string
}

export type Task = {
  id: string
  business_phone: string | null
  title: string
  description: string | null
  due_at: string
  completed: boolean
  created_at: string
}

export type Note = {
  id: string
  business_phone: string
  content: string
  created_at: string
}

export type Contact = {
  id: string
  business_phone: string
  name: string | null
  phone: string | null
  email: string | null
  role: string | null
  created_at: string
}

export type LeadWithStatus = Lead & {
  lead_status: LeadStatus | null
}
