// KinoVibe v0.2 Configuration Module

export const CONFIG = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://jiojxurcejwwqyzkyokr.supabase.co',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imppb2p4dXJjZWp3d3F5emt5b2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MjY2MjAsImV4cCI6MjEwNDEwMjYyMH0.JrWbrpOwB1G4wVQJB5paOvugV6B3udFpYg4jFjnBnYg',
  API_BASE: '/api',
  VERSION: '0.3.0'
};
