import { validateEnvironment } from '../config';
import { DeploymentError } from '../utils/error-handler';

describe('Configuration', () => {
  describe('validateEnvironment', () => {
    it('should accept valid environments', () => {
      expect(validateEnvironment('development')).toBe('development');
      expect(validateEnvironment('staging')).toBe('staging');
      expect(validateEnvironment('production')).toBe('production');
    });

    it('should accept environment aliases', () => {
      expect(validateEnvironment('dev')).toBe('development');
      expect(validateEnvironment('prod')).toBe('production');
    });

    it('should be case-insensitive', () => {
      expect(validateEnvironment('DEVELOPMENT')).toBe('development');
      expect(validateEnvironment('Dev')).toBe('development');
      expect(validateEnvironment('PROD')).toBe('production');
    });

    it('should reject invalid environments', () => {
      expect(() => validateEnvironment('invalid')).toThrow(DeploymentError);
      expect(() => validateEnvironment('test')).toThrow(DeploymentError);
      expect(() => validateEnvironment('')).toThrow(DeploymentError);
    });
  });
});