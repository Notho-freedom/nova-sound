/**
 * CLI argument parser for NEXUS Audio Player
 */

export interface CLIOptions {
  dev?: boolean;
  port?: number;
  noScan?: boolean;
  autoScan?: boolean;
  musicDir?: string[];
  debug?: boolean;
  help?: boolean;
  version?: boolean;
  reset?: boolean;
  clearCache?: boolean;
}

/**
 * Parse command line arguments
 */
export function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

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
          options.port = parseInt(nextArg, 10);
          if (isNaN(options.port)) {
            console.warn(`Invalid port number: ${nextArg}`);
            options.port = undefined;
          }
          i++; // Skip next argument
        }
        break;

      case '--no-scan':
      case '--no-auto-scan':
        options.noScan = true;
        break;

      case '--auto-scan':
        options.autoScan = true;
        break;

      case '--music-dir':
      case '--music-directory':
      case '-m':
        if (nextArg && !nextArg.startsWith('-')) {
          options.musicDir = options.musicDir || [];
          options.musicDir.push(nextArg);
          i++; // Skip next argument
        }
        break;

      case '--debug':
        options.debug = true;
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
          console.warn(`Unknown option: ${arg}`);
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

Usage: nexus-audio [options]

Options:
  -d, --dev                    Run in development mode
  -p, --port <number>          Set Next.js dev server port (default: 3000)
  --no-scan, --no-auto-scan    Disable automatic library scan on startup
  --auto-scan                  Enable automatic library scan on startup
  -m, --music-dir <path>       Add music directory to scan (can be used multiple times)
  --debug                      Enable debug mode (verbose logging)
  --reset                      Reset all settings to defaults
  --clear-cache                Clear application cache
  -h, --help                   Show this help message
  -v, --version                Show version information

Examples:
  nexus-audio --dev
  nexus-audio --port 3001
  nexus-audio --music-dir "C:\\Music" --music-dir "D:\\Audio"
  nexus-audio --no-scan --debug
  nexus-audio --reset --clear-cache
`);
}

/**
 * Display version information
 */
export function showVersion(): void {
  const packageJson = require('../../package.json');
  console.log(`NEXUS Audio Player v${packageJson.version}`);
}

/**
 * Apply CLI options to environment/configuration
 */
export function applyCLIOptions(options: CLIOptions): void {
  if (options.port) {
    process.env.PORT = options.port.toString();
    process.env.NEXT_PUBLIC_PORT = options.port.toString();
  }

  if (options.dev) {
    process.env.NODE_ENV = 'development';
  }

  if (options.debug) {
    process.env.DEBUG = 'true';
    // Enable verbose logging
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  }
}

