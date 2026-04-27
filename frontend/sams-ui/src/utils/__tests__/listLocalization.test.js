/* global describe, it, expect */
import { buildListEntityWritePayload, isSpanishCompanionMode, resolveListEntityField } from '../listLocalization';

describe('resolveListEntityField', () => {
  it('uses Spanish companion when ES language and localization is enabled', () => {
    const category = {
      id: 'utilities',
      name: 'Utilities',
      name_es: 'Servicios',
    };

    const result = resolveListEntityField(category, 'category', 'name', {
      language: 'ES',
      localizationEnabled: true,
    });

    expect(result).toBe('Servicios');
  });

  it('falls back to base value when Spanish companion is missing', () => {
    const category = {
      id: 'security',
      name: 'Security',
      name_es: '',
    };

    const result = resolveListEntityField(category, 'category', 'name', {
      language: 'ES',
      localizationEnabled: true,
    });

    expect(result).toBe('Security');
  });

  it('uses base value when localization feature flag is disabled', () => {
    const category = {
      id: 'category-1',
      name: 'Security',
      name_es: 'Seguridad',
    };

    const result = resolveListEntityField(category, 'category', 'name', {
      language: 'ES',
      localizationEnabled: false,
    });

    expect(result).toBe('Security');
  });

  it('returns non-empty hard fallback when both companion and base are missing', () => {
    const unit = {
      unitId: 'PH-A1',
      unitName: '',
      unitName_es: '',
    };

    const result = resolveListEntityField(unit, 'unit', 'unitName', {
      language: 'ES',
      localizationEnabled: true,
      hardFallback: unit.unitId,
    });

    expect(result).toBe('PH-A1');
  });
});

describe('isSpanishCompanionMode', () => {
  it('is true only when language is ES and localization is enabled', () => {
    expect(isSpanishCompanionMode('ES', true)).toBe(true);
    expect(isSpanishCompanionMode('EN', true)).toBe(false);
    expect(isSpanishCompanionMode('ES', false)).toBe(false);
  });
});

describe('buildListEntityWritePayload', () => {
  it('keeps base values in EN mode', () => {
    const payload = buildListEntityWritePayload(
      'category',
      { name: 'Security' },
      { name: 'Security' },
      { language: 'EN', localizationEnabled: true }
    );

    expect(payload).toEqual({ name: 'Security' });
  });

  it('writes companion and preserves existing base on ES edits', () => {
    const payload = buildListEntityWritePayload(
      'category',
      { name: 'Seguridad', description: 'Guardia' },
      { name: 'Security', description: 'Guard' },
      { language: 'ES', localizationEnabled: true }
    );

    expect(payload).toEqual({
      name: 'Security',
      name_es: 'Seguridad',
      description: 'Guard',
      description_es: 'Guardia',
    });
  });

  it('writes both base and companion on ES creates', () => {
    const payload = buildListEntityWritePayload(
      'category',
      { name: 'Maintenance', description: 'Elevator' },
      {},
      { language: 'ES', localizationEnabled: true }
    );

    expect(payload).toEqual({
      name: 'Maintenance',
      name_es: 'Maintenance',
      description: 'Elevator',
      description_es: 'Elevator',
    });
  });
});

