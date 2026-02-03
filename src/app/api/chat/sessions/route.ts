import { createClient } from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q');

    let query = supabase
      .from('chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (search) {
      query = query.textSearch('title', search);
    }

    const { data, error } = await query;

    if (error) {
       console.error("Supabase Error (GET Sessions):", error);
       return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error("Fatal Error (GET Sessions):", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { title } = await req.json();

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ title: title || 'New Session' })
      .select()
      .single();

    if (error) {
      console.error("Supabase Error (POST Session):", error);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Fatal Error (POST Session):", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Supabase Error (DELETE Session):", error);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Fatal Error (DELETE Session):", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
