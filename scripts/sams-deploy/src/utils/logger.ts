import chalk from 'chalk';
import ora, { Ora } from 'ora';

interface LoggerOptions {
  verbose: boolean;
  quiet: boolean;
}

class Logger {
  private options: LoggerOptions = {
    verbose: false,
    quiet: false
  };
  private spinner: Ora | null = null;

  setVerbosity(options: LoggerOptions): void {
    this.options = options;
  }

  banner(): void {
    console.log(chalk.blue('\n╔════════════════════════════════════════╗'));
    console.log(chalk.blue('║') + chalk.white.bold('    SAMS Deployment Automation System   ') + chalk.blue('║'));
    console.log(chalk.blue('╚════════════════════════════════════════╝\n'));
  }

  info(message: string): void {
    if (!this.options.quiet) {
      console.log(chalk.blue('ℹ') + ' ' + message);
    }
  }

  success(message: string): void {
    if (!this.options.quiet) {
      console.log(chalk.green('✓') + ' ' + message);
    }
  }

  warn(message: string): void {
    console.log(chalk.yellow('⚠') + ' ' + chalk.yellow(message));
  }

  error(message: string): void {
    console.error(chalk.red('✗') + ' ' + chalk.red(message));
  }

  debug(message: string): void {
    if (this.options.verbose) {
      console.log(chalk.gray('○ ' + message));
    }
  }

  startSpinner(text: string): void {
    if (!this.options.quiet) {
      this.spinner = ora({
        text,
        color: 'blue',
        spinner: 'dots'
      }).start();
    }
  }

  updateSpinner(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  succeedSpinner(text?: string): void {
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    }
  }

  failSpinner(text?: string): void {
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    }
  }

  stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  section(title: string): void {
    if (!this.options.quiet) {
      console.log('\n' + chalk.bold.underline(title));
    }
  }

  list(items: string[]): void {
    if (!this.options.quiet) {
      items.forEach(item => {
        console.log('  • ' + item);
      });
    }
  }

  table(data: Record<string, string>): void {
    if (!this.options.quiet) {
      const maxKeyLength = Math.max(...Object.keys(data).map(k => k.length));
      Object.entries(data).forEach(([key, value]) => {
        const paddedKey = key.padEnd(maxKeyLength);
        console.log(`  ${chalk.gray(paddedKey)} : ${value}`);
      });
    }
  }

  newline(): void {
    if (!this.options.quiet) {
      console.log();
    }
  }

  divider(): void {
    if (!this.options.quiet) {
      console.log(chalk.gray('─'.repeat(50)));
    }
  }
}

export const logger = new Logger();