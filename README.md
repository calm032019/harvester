# YouTube Media Downloader

A comprehensive web-based video downloader that supports YouTube and multiple video platforms with high-quality downloads, automatic metadata embedding, and real-time progress tracking.

## Features

- **Multi-platform Support**: Download from YouTube, Vimeo, Twitter, TikTok, and 1000+ other video sites
- **Multiple Formats**: Download as MP3 (audio) or MP4 (video) with quality selection
- **Batch Downloads**: Process multiple URLs simultaneously 
- **Real-time Progress**: Live download progress tracking with detailed status updates
- **Metadata Embedding**: Automatic thumbnail and metadata embedding in downloaded files
- **File Organization**: Optional file organization by channel/creator
- **Authentication Support**: Bypass bot protection with cookie-based authentication
- **Resource Management**: Built-in limits to prevent system overload

## Quick Start

1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Open your browser and go to:** `http://localhost:5000`

3. **Paste video URLs** in the input field (one per line for multiple downloads)

4. **Select format and quality** options

5. **Click "Start Download"** and monitor progress in real-time

## Setup Guide

### Basic Setup

The application works out of the box for most video sites. However, for optimal YouTube support and to bypass bot protection, additional configuration is recommended.

### YouTube API Configuration (Recommended)

For better metadata extraction and quota management, set up a YouTube API key:

1. **Get a YouTube API Key:**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the "YouTube Data API v3"
   - Go to "Credentials" and create an API Key
   - Copy your API key

2. **Configure the API Key:**
   
   **Option A: Environment Variable (Recommended)**
   ```bash
   export YOUTUBE_API_KEY="your-api-key-here"
   ```
   
   **Option B: Add to your shell profile**
   ```bash
   echo 'export YOUTUBE_API_KEY="your-api-key-here"' >> ~/.bashrc
   source ~/.bashrc
   ```

3. **Restart the application** for the API key to take effect.

### YouTube Authentication (For Bot Protection)

If you encounter "Sign in to confirm you're not a bot" errors, you'll need to provide authentication cookies:

**Option A: Environment Variable**
```bash
export COOKIES_TXT="your-cookies-string-here"
```

**Option B: Upload cookies.txt file**
1. Export cookies from your browser using an extension like "Get cookies.txt"
2. Save the file as `cookies.txt` in the application's root directory
3. Restart the application

**How to get cookies:**
1. Install a browser extension like "Get cookies.txt LOCALLY" 
2. Visit YouTube and log in to your account
3. Use the extension to export cookies for youtube.com
4. Use either method above to provide the cookies to the application

## System Limits

To ensure stable operation, the following limits are in place:

- **Maximum URLs per request:** 10
- **Maximum concurrent downloads:** 5  
- **Maximum file size:** 200MB per file
- **Download rate limit:** 5MB/s per download

## Supported Sites

This downloader supports 1000+ video platforms including:

**Popular Platforms:**
- YouTube (videos, playlists, shorts)
- Vimeo
- Twitter/X 
- TikTok
- Instagram
- Facebook
- Twitch
- Reddit
- Dailymotion

**Other Platforms:**
- SoundCloud, Bandcamp (audio)
- Rumble, BitChute
- Many news and media sites

For the complete list, run: `yt-dlp --list-extractors`

## Troubleshooting

### Common Issues

**"YouTube requires authentication" errors:**
- Set up authentication cookies using the methods above
- Make sure cookies are from a valid, logged-in YouTube session

**"Download failed" errors:**
- Check if the video is private or age-restricted
- Verify the URL is correct and accessible
- For YouTube, try providing authentication cookies

**"Server is busy" errors:**
- Wait for current downloads to complete
- The system limits concurrent downloads to prevent overload

**"File too large" errors:**
- The file exceeds the 200MB limit
- Try selecting a lower quality option

### Getting Help

If you're still having issues:

1. Check the browser console for error messages
2. Monitor the download progress messages for specific error details
3. Verify your API key and cookies are configured correctly
4. Try downloading a different video to isolate the issue

## Development

### Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** PostgreSQL with Drizzle ORM
- **Downloader:** yt-dlp
- **Build Tool:** Vite

### Project Structure

```
├── client/          # React frontend
├── server/          # Express backend  
├── shared/          # Shared types and schemas
├── downloads/       # Downloaded files storage
└── package.json     # Dependencies and scripts
```

### Environment Variables

```bash
# YouTube API (optional but recommended)
YOUTUBE_API_KEY=your-youtube-api-key

# Authentication cookies (required for protected content)
COOKIES_TXT=your-cookies-string

# Database (automatically configured)
DATABASE_URL=postgresql://...
```

## License

This project is for educational and personal use only. Please respect the terms of service of the platforms you're downloading from and ensure you have the right to download the content.