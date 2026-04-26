/* global describe, it, expect */
import { resolveListEntityField } from '../listLocalization';

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
    const vendor = {
      id: 'vendor-1',
      name: 'Pool Service',
      name_es: 'Servicio de Alberca',
    };

    const result = resolveListEntityField(vendor, 'vendor', 'name', {
      language: 'ES',
      localizationEnabled: false,
    });

    expect(result).toBe('Pool Service');
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

