import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { exec } from 'child_process';
import { promisify } from 'util';

export const runtime = 'nodejs';

// Promisify exec for easier async/await usage
const execAsync = promisify(exec);

// Function to get video info
async function getVideoInfo(url: string): Promise<{ title: string }> {
  try {
    const { stdout } = await execAsync(`yt-dlp --dump-json "${url}"`);
    const info = JSON.parse(stdout);
    return { title: info.title };
  } catch (error) {
    console.error('Error getting video info:', error);
    return { title: 'youtube-download' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, format, quality } = await req.json();
    console.log(`Received conversion request: URL=${url}, Format=${format}, Quality=${quality}`);
    
    if (!url || !format || !['mp3', 'mp4'].includes(format)) {
      console.error('Invalid input parameters');
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Get video title first
    const { title } = await getVideoInfo(url);
    console.log(`Video title: ${title}`);
    
    // Sanitize the title for use in a filename
    const sanitizedTitle = title
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .toLowerCase();           // Convert to lowercase
    
    // Set output options
    let ytdlpFormat = format === 'mp3' ? 'bestaudio' : 'bestvideo+bestaudio';
    if (quality && format === 'mp4') {
      ytdlpFormat = `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`;
    }
    
    console.log(`Using yt-dlp format: ${ytdlpFormat}`);

    // Prepare yt-dlp command with more options for better compatibility
    const ytdlpArgs = [
      url,
      '--format', ytdlpFormat,
      '--output', '-',
      '--no-warnings',
      '--no-call-home',
      '--no-check-certificate',
      '--prefer-free-formats',
      '--add-header', 'referer:youtube.com',
      '--add-header', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    
    // Add MP3-specific options
    if (format === 'mp3') {
      ytdlpArgs.push('--extract-audio', '--audio-format', 'mp3');
      if (quality) {
        ytdlpArgs.push('--audio-quality', quality);
      }
    }
    
    console.log('Executing yt-dlp with args:', ytdlpArgs.join(' '));

    try {
      // Execute yt-dlp command using child_process
      const ytdlpProcess = spawn('yt-dlp', ytdlpArgs);
      
      // Handle errors
      ytdlpProcess.stderr.on('data', (data) => {
        console.error(`yt-dlp stderr: ${data}`);
      });
      
      // Create a readable stream from the process stdout
      const stdoutStream = new Readable({
        read() {}
      });
      
      ytdlpProcess.stdout.on('data', (data) => {
        stdoutStream.push(data);
      });
      
      ytdlpProcess.stdout.on('end', () => {
        stdoutStream.push(null);
      });
      
      ytdlpProcess.on('error', (error) => {
        console.error('yt-dlp process error:', error);
        stdoutStream.destroy(error);
      });
      
      ytdlpProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`yt-dlp process exited with code ${code}`);
          stdoutStream.destroy(new Error(`yt-dlp process exited with code ${code}`));
        }
      });

      // Set headers for download with the video title
      const fileName = `${sanitizedTitle}.${format}`;
      const headers = new Headers({
        'Content-Type': format === 'mp3' ? 'audio/mpeg' : 'video/mp4',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      });

      // Stream the output
      return new Response(stdoutStream as any, { headers });
    } catch (ytdlpError: any) {
      console.error('yt-dlp execution error:', ytdlpError);
      return NextResponse.json({ 
        error: 'yt-dlp execution failed', 
        details: ytdlpError.message || 'Unknown error'
      }, { status: 500 });
    }
  } catch (err: any) {
    console.error('API route error:', err);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: err.message || 'Unknown error'
    }, { status: 500 });
  }
} 