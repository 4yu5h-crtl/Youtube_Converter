const ytdlp = require('yt-dlp-exec');

async function testYtdlp() {
  try {
    console.log('Testing yt-dlp-exec...');
    
    // Test with a simple YouTube URL
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    
    console.log(`Testing with URL: ${testUrl}`);
    
    // Get video info without downloading
    const info = await ytdlp(testUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });
    
    console.log('Successfully retrieved video info:');
    console.log(`Title: ${info.title}`);
    console.log(`Duration: ${info.duration} seconds`);
    console.log(`Formats available: ${info.formats.length}`);
    
    console.log('yt-dlp-exec is working correctly!');
  } catch (error) {
    console.error('Error testing yt-dlp-exec:', error);
  }
}

testYtdlp(); 