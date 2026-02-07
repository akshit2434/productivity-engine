import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const docsDir = path.join(process.cwd(), 'docs');
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));
    
    const docs = files.map(file => {
      const filePath = path.join(docsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const title = file.replace(/^\d+_/, '').replace('.md', '').replace(/_/g, ' ');
      
      return {
        id: file,
        title: title.charAt(0).toUpperCase() + title.slice(1),
        content,
        path: `/docs/${file}`,
        last_indexed_at: new Date().toISOString()
      };
    });

    return NextResponse.json(docs);
  } catch (error) {
    console.error('Failed to read docs:', error);
    return NextResponse.json({ error: 'Failed to read documentation' }, { status: 500 });
  }
}
