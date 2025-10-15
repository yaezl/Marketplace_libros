// supabaseClient.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://gkdaymmgunhscvjgysay.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZGF5bW1ndW5oc2N2amd5c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NzA4MDQsImV4cCI6MjA3NjA0NjgwNH0.huUhZWPIxPkL3c8iX8m55uye3SKIm1WNPv1KJcVELZE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
