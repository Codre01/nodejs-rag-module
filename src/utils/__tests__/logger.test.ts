import { Logger } from '../logger';

// Mock console.log to capture log output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  describe('log level filtering', () => {
    it('should log debug messages when log level is debug', () => {
      logger = new Logger('debug');
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(4);
    });

    it('should not log debug messages when log level is info', () => {
      logger = new Logger('info');
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(3);
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]')
      );
    });

    it('should only log warn and error when log level is warn', () => {
      logger = new Logger('warn');
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(2);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
    });

    it('should only log error when log level is error', () => {
      logger = new Logger('error');
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
    });
  });

  describe('log message formatting', () => {
    beforeEach(() => {
      logger = new Logger('debug');
    });

    it('should format log messages with timestamp and level', () => {
      logger.info('Test message');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Test message$/)
      );
    });

    it('should include context when provided', () => {
      const context = { key: 'value', number: 42 };
      logger.info('Test message', context);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Test message$/),
        context
      );
    });

    it('should format different log levels correctly', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
    });
  });

  describe('setLogLevel', () => {
    beforeEach(() => {
      logger = new Logger('error');
    });

    it('should change log level dynamically', () => {
      logger.info('Should not log');
      expect(mockConsoleLog).not.toHaveBeenCalled();

      logger.setLogLevel('info');
      logger.info('Should log now');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
    });

    it('should apply new log level immediately', () => {
      logger.setLogLevel('debug');
      
      logger.debug('Debug message');
      logger.info('Info message');
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(2);
    });
  });

  describe('default log level', () => {
    it('should default to info log level', () => {
      logger = new Logger();
      
      logger.debug('Debug message');
      logger.info('Info message');
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      logger = new Logger('debug');
    });

    it('should handle empty messages', () => {
      logger.info('');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] $/)
      );
    });

    it('should handle null context', () => {
      logger.info('Test message', null);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Test message$/)
      );
    });

    it('should handle undefined context', () => {
      logger.info('Test message', undefined);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Test message$/)
      );
    });

    it('should handle complex context objects', () => {
      const complexContext = {
        nested: { object: { with: 'values' } },
        array: [1, 2, 3],
        func: () => 'test',
        date: new Date()
      };
      
      logger.info('Complex context', complexContext);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Complex context'),
        complexContext
      );
    });
  });
});