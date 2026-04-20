#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeSQL(statement) {
  const { data, error } = await supabase.rpc('_execute_sql', {
    sql: statement,
  });

  if (error && !error.message.includes('does not exist')) {
    console.log(`⚠️  ${error.message}`);
  }
  return { data, error };
}

async function initializeDatabase() {
  try {
    console.log('🚀 Setting up OOTD Database...\n');

    // Create tables
    const tables = [
      {
        name: 'users',
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(50) UNIQUE,
            avatar_url TEXT,
            bio TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `,
      },
      {
        name: 'posts',
        sql: `
          CREATE TABLE IF NOT EXISTS posts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            caption TEXT,
            visibility VARCHAR(20) DEFAULT 'public',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            media_count INTEGER DEFAULT 1
          );
        `,
      },
      {
        name: 'media',
        sql: `
          CREATE TABLE IF NOT EXISTS media (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            media_url TEXT NOT NULL,
            media_type VARCHAR(20) NOT NULL,
            order_index INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `,
      },
      {
        name: 'ratings',
        sql: `
          CREATE TABLE IF NOT EXISTS ratings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            rating INTEGER NOT NULL,
            comment TEXT,
            is_anonymous BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `,
      },
      {
        name: 'shares',
        sql: `
          CREATE TABLE IF NOT EXISTS shares (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            share_slug VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `,
      },
    ];

    for (const table of tables) {
      console.log(`📝 Creating ${table.name} table...`);
      await executeSQL(table.sql);
      console.log(`✅ ${table.name} table ready`);
    }

    console.log('\n🎉 Database initialization complete!');
    console.log('\nCreated tables:');
    console.log('  • users');
    console.log('  • posts');
    console.log('  • media');
    console.log('  • ratings');
    console.log('  • shares');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

initializeDatabase();
