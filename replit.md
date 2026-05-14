# MediaVault — Video Downloader

## Overview

This is a full-stack video downloader application supporting YouTube and many other platforms (Vimeo, TikTok, Twitter/X, Twitch, Dailymotion, Instagram, Facebook, SoundCloud, and 1,000+ more via yt-dlp). It features a React frontend with a modern UI built using shadcn/ui components and a Node.js/Express backend.

Key features:
- **Download page**: paste one or multiple URLs from any supported site, choose MP4/MP3 and quality, track progress in real-time, download or **watch the converted video inline** in the browser
- **Channel Search page**: find a YouTube channel by URL/@handle/name, search keywords within it, filter by duration and sort order, browse results page by page, and queue any video for download with one click
- No demo mode — all downloads are live via yt-dlp

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and dark/light mode support
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for type-safe form management

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API endpoints for download management
- **File Processing**: Integration with yt-dlp for YouTube content extraction and download
- **Development Setup**: Vite middleware integration for hot reloading in development

### Data Storage Solutions
- **Database**: PostgreSQL configured through Drizzle ORM
- **Schema Management**: Drizzle Kit for database migrations and schema management
- **Connection**: Neon Database serverless PostgreSQL
- **Fallback Storage**: In-memory storage implementation for development/testing

### Database Schema
- **Downloads Table**: Tracks download jobs with metadata including URL, title, channel, format, quality, progress, status, and file paths
- **Real-time Updates**: Progress tracking with status stages and error handling
- **File Organization**: Optional file organization by channel/artist with metadata embedding

### External Dependencies

#### Core Dependencies
- **yt-dlp**: YouTube content extraction and download processing
- **Neon Database**: Serverless PostgreSQL hosting
- **Drizzle ORM**: Type-safe database ORM with PostgreSQL dialect

#### UI/Frontend Dependencies
- **Radix UI**: Headless UI primitives for accessibility
- **Tailwind CSS**: Utility-first styling framework
- **Lucide React**: Icon library
- **TanStack Query**: Server state management
- **React Hook Form**: Form state management
- **Zod**: Runtime type validation

#### Development Dependencies
- **Vite**: Build tool and development server
- **TypeScript**: Static type checking
- **ESBuild**: Production bundling for server code
- **PostCSS**: CSS processing with Tailwind

#### Integration Features
- **Real-time Progress**: WebSocket-style polling for download progress updates
- **Multi-format Support**: MP3 audio and MP4 video download options
- **Quality Selection**: Multiple quality options for both audio and video
- **Metadata Embedding**: Optional metadata embedding in downloaded files
- **Batch Processing**: Support for multiple URL downloads simultaneously
- **File Management**: Organized file storage with download history tracking