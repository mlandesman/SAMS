import { logger } from '../utils/logger';

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('setVerbosity', () => {
    it('should respect quiet mode', () => {
      logger.setVerbosity({ verbose: false, quiet: true });
      logger.info('test message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should show messages in normal mode', () => {
      logger.setVerbosity({ verbose: false, quiet: false });
      logger.info('test message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should show debug messages in verbose mode', () => {
      logger.setVerbosity({ verbose: true, quiet: false });
      logger.debug('debug message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should not show debug messages in normal mode', () => {
      logger.setVerbosity({ verbose: false, quiet: false });
      logger.debug('debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('error messages', () => {
    it('should always show error messages even in quiet mode', () => {
      logger.setVerbosity({ verbose: false, quiet: true });
      logger.error('error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should always show warning messages even in quiet mode', () => {
      logger.setVerbosity({ verbose: false, quiet: true });
      logger.warn('warning message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});