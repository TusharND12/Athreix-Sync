import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('filename');

  if (!fileName) {
    return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
  }

  // Define directories to search (Downloads and Desktop are most common)
  const homeDir = os.homedir();
  const searchDirs = [
    path.join(homeDir, 'Downloads'),
    path.join(homeDir, 'Desktop'),
    path.join(homeDir, 'Documents')
  ];

  let foundFilePath: string | null = null;
  let exactFileName = fileName;

  // Search through directories
  for (const dir of searchDirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      
      const files = fs.readdirSync(dir);
      
      // Look for a partial or exact match (case-insensitive)
      const match = files.find(f => f.toLowerCase().includes(fileName.toLowerCase()));
      
      if (match) {
        foundFilePath = path.join(dir, match);
        exactFileName = match;
        break;
      }
    } catch (e) {
      console.error(`Error reading directory ${dir}:`, e);
    }
  }

  if (!foundFilePath) {
    return NextResponse.json({ error: 'File not found on local system' }, { status: 404 });
  }

  try {
    // Read the file as a buffer
    const fileBuffer = fs.readFileSync(foundFilePath);
    
    // Simple mime type detection based on extension
    const ext = path.extname(exactFileName).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.txt') mimeType = 'text/plain';
    else if (ext === '.mp4') mimeType = 'video/mp4';

    // Return the file as a stream/blob response
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${exactFileName}"`,
        'X-Exact-Filename': exactFileName // Custom header to pass the exact matched name to the client
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
