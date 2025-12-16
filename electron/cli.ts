/**
 * CLI argument parser for NEXUS Audio Player
 * Production-ready with robust validation and extensibility
 */

export type ScanMode = 'auto' | 'disabled' | 'default';

export interface CLIOptions {
  dev?: boolean;
  port?: number;
  scanMode?: ScanMode;
  musicDir?: string[];
  debug?: boolean;
  strict?: boolean;
  help?: boolean;
  version?: boolean;
  reset?: boolean;
  clearCache?: boolean;
}

/**
 * Parse command line arguments with robust validation
 */
export function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};
  let strictMode = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--dev':
      case '-d':
        options.dev = true;
        break;

      case '--port':
      case '-p':
        if (nextArg && !nextArg.startsWith('-')) {
          const port = Number(nextArg);
          if (Number.isInteger(port) && port >= 1 && port <= 65535) {
            options.port = port;
          } else {
            const errorMsg = `Invalid port number: ${nextArg}. Must be between 1 and 65535.`;
            if (strictMode) {
              throw new Error(errorMsg);
            }
            console.warn(errorMsg);
          }
          i++; // Skip next argument
        } else {
          const errorMsg = '--port requires a port number';
          if (strictMode) {
            throw new Error(errorMsg);
          }
          console.warn(errorMsg);
        }
        break;

      case '--no-scan':
      case '--no-auto-scan':
        // Explicitly disable scanning (takes priority)
        options.scanMode = 'disabled';
        break;

      case '--auto-scan':
        // Explicitly enable scanning (takes priority)
        options.scanMode = 'auto';
        break;

      case '--music-dir':
      case '--music-directory':
      case '-m':
        if (nextArg && !nextArg.startsWith('-')) {
          options.musicDir = options.musicDir || [];
          
          // Support comma-separated directories: --music-dir=/path1,/path2,/path3
          if (nextArg.includes(',')) {
            nextArg.split(',').forEach(dir => {
              const trimmed = dir.trim();
              if (trimmed) {
                options.musicDir!.push(trimmed);
              }
            });
          } else {
            options.musicDir.push(nextArg);
          }
          i++; // Skip next argument
        } else {
          const errorMsg = '--music-dir requires a directory path';
          if (strictMode) {
            throw new Error(errorMsg);
          }
          console.warn(errorMsg);
        }
        break;

      case '--debug':
        options.debug = true;
        break;

      case '--strict':
        strictMode = true;
        options.strict = true;
        break;

      case '--help':
      case '-h':
        options.help = true;
        break;

      case '--version':
      case '-v':
        options.version = true;
        break;

      case '--reset':
        options.reset = true;
        break;

      case '--clear-cache':
        options.clearCache = true;
        break;

      default:
        if (arg.startsWith('--')) {
          const errorMsg = `Unknown option: ${arg}`;
          if (strictMode) {
            throw new Error(errorMsg);
          }
          console.warn(errorMsg);
        }
        break;
    }
  }

  return options;
}

/**
 * Display help message
 */
export function showHelp(): void {
  console.log(`
NEXUS Audio Player - CLI Options

Usage: nexus-audio [options] [files...]

Options:
  -d, --dev                    Run in development mode
  -p, --port <number>          Set Next.js dev server port (1-65535, default: 3000)
  --no-scan, --no-auto-scan    Disable automatic library scan on startup
  --auto-scan                  Enable automatic library scan on startup
  -m, --music-dir <path>       Add music directory to scan
                               Can be used multiple times or comma-separated:
                               --music-dir=/path1,/path2,/path3
  --debug                      Enable debug mode (verbose logging)
  --strict                     Fail fast on unknown options (useful for CI/scripts)
  --reset                      Reset all settings to defaults
  --clear-cache                Clear application cache
  -h, --help                   Show this help message
  -v, --version                Show version information

Examples:
  nexus-audio --dev
  nexus-audio --port 3001
  nexus-audio --music-dir "C:\\Music" --music-dir "D:\\Audio"
  nexus-audio --music-dir "C:\\Music,D:\\Audio,E:\\Samples"
  nexus-audio --no-scan --debug
  nexus-audio --auto-scan --strict
  nexus-audio --reset --clear-cache
  nexus-audio "song.mp3" "video.mp4"  # Open files directly
`);
}

/**
 * Display version information
 */
export async function showVersion(): Promise<void> {
  try {
    // Use dynamic import for package.json to avoid require() in ES modules
    const pkg = await import('../../package.json', { assert: { type: 'json' } });
    // Handle both default export and direct import
    const version = (pkg as { default?: { version?: string }; version?: string }).default?.version || 
                    (pkg as { version?: string }).version || 
                    '1.0.0';
    console.log(`NEXUS Audio Player v${version}`);
  } catch {
    // Fallback if package.json can't be loaded
    console.log('NEXUS Audio Player v1.0.0');
  }
}

/**
 * Normalize and validate CLI options (remove duplicates, validate paths, etc.)
 */
export function normalizeOptions(options: CLIOptions): CLIOptions {
  const normalized: CLIOptions = { ...options };

  // Remove duplicate music directories
  if (normalized.musicDir && normalized.musicDir.length > 0) {
    normalized.musicDir = [...new Set(normalized.musicDir.map(dir => dir.trim()).filter(Boolean))];
  }

  return normalized;
}

/**
 * Apply CLI options to environment/configuration
 */
export function applyCLIOptions(options: CLIOptions): void {
  if (options.port) {
    process.env.PORT = options.port.toString();
    process.env.NEXT_PUBLIC_PORT = options.port.toString();
  }

  // Smart NODE_ENV handling: only override if explicitly set, or set default
  if (options.dev) {
    process.env.NODE_ENV = 'development';
  } else if (!process.env.NODE_ENV) {
    // Only set production if not already set (respect existing env)
    process.env.NODE_ENV = 'production';
  }

  // Use namespaced debug flag to avoid conflicts with other libraries
  if (options.debug) {
    process.env.NEXUS_DEBUG = '1';
    // Also set generic DEBUG for compatibility, but prefer NEXUS_DEBUG
    process.env.DEBUG = 'true';
    // Enable verbose logging
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
      process.env.NODE_ENV = 'development';
    }
  }
}

