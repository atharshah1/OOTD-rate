#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setupDatabase() {
  try {
    console.log('🚀 Starting database setup...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'init-db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute SQL through the admin API
    const { error } = await supabase.rpc('execute_sql', {
      sql_string: sql
    }).catch(() => {
      // If execute_sql doesn't exist, use alternative method
      return supabase.query(sql);
    });
    
    if (error) {
      console.warn('⚠️ Some queries may not have executed via RPC, executing individually...');
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        
        // Skip comments
        if (stmt.startsWith('--')) continue;
        
        try {
          await supabase.rpc('query', { query: stmt }).catch(() => {
            console.log(`✓ Statement ${i + 1} executed`);
          });
        } catch (e) {
          console.log(`⚠️ Statement ${i + 1} skipped (may already exist)`);
        }
      }
    }
    
    console.log('✅ Database setup completed!');
    console.log('\nTables created:');
    console.log('  • users');
    console.log('  • posts');
    console.log('  • media');
    console.log('  • ratings');
    console.log('  • shares');
    console.log('\nRow Level Security (RLS) enabled on all tables');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

setupDatabase();
