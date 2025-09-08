/**
 * Progressive Enhancement System for Enterprise Backend Integration
 * FRONTEND-ALIGNMENT-001 - Phase 3.3
 * 
 * Provides progressive enhancement capabilities that gracefully degrade
 * and enhance based on enterprise backend availability and user capabilities
 */

import React, { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react';
import { PerformanceMonitor } from '../ErrorHandling/PerformanceErrorMonitor';
import { ConnectionManager } from '../Performance/ConnectionManager';

/**
 * Progressive enhancement configuration
 */
interface ProgressiveEnhancementConfig {
  // Feature detection
  enableFeatureDetection: boolean;
  enableCapabilityTesting: boolean;
  enablePerformanceTesting: boolean;
  
  // Enhancement levels
  baselineFeatures: string[];           // Always available features
  enhancedFeatures: string[];           // Available with good connection
  premiumFeatures: string[];            // Available with excellent connection
  
  // Degradation thresholds
  slowConnectionThreshold: number;      // ms response time for degradation
  offlineGracePeriod: number;          // ms before offline mode
  lowMemoryThreshold: number;          // MB for memory-based degradation
  
  // Adaptive behavior
  enableAdaptiveLoading: boolean;
  enableOfflineSupport: boolean;
  enableServiceWorker: boolean;
  enableCaching: boolean;
  
  // User preferences
  respectReducedMotion: boolean;
  respectDataSaver: boolean;
  respectBatteryLevel: boolean;
}

/**
 * Default progressive enhancement configuration
 */
const DEFAULT_PROGRESSIVE_CONFIG: ProgressiveEnhancementConfig = {
  enableFeatureDetection: true,
  enableCapabilityTesting: true,
  enablePerformanceTesting: true,
  
  baselineFeatures: ['basic-crud', 'simple-navigation', 'text-input'],
  enhancedFeatures: ['real-time-updates', 'advanced-filtering', 'bulk-operations'],
  premiumFeatures: ['live-collaboration', 'advanced-analytics', 'ai-suggestions'],
  
  slowConnectionThreshold: 3000,
  offlineGracePeriod: 5000,
  lowMemoryThreshold: 512,
  
  enableAdaptiveLoading: true,
  enableOfflineSupport: true,
  enableServiceWorker: true,
  enableCaching: true,
  
  respectReducedMotion: true,
  respectDataSaver: true,
  respectBatteryLevel: true
};

/**
 * Enhancement level definitions
 */
type EnhancementLevel = 'baseline' | 'enhanced' | 'premium';

/**
 * Device capabilities
 */
interface DeviceCapabilities {
  // Network capabilities
  connectionType: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'unknown';
  isOnline: boolean;
  bandwidth: number | null;
  
  // Device capabilities
  memory: number | null;              // Device memory in MB
  cores: number | null;               // CPU cores
  pixelRatio: number;                 // Device pixel ratio
  
  // Browser capabilities
  serviceWorkerSupported: boolean;
  webAssemblySupported: boolean;
  indexedDBSupported: boolean;
  webGLSupported: boolean;
  
  // User preferences
  prefersReducedMotion: boolean;
  prefersDataSaver: boolean;
  batteryLevel: number | null;
}

/**
 * Feature availability status
 */
interface FeatureStatus {
  available: boolean;
  reason?: string;
  fallback?: string;
  enhancementLevel: EnhancementLevel;
}

/**
 * Progressive enhancement result
 */
interface EnhancementResult {
  level: EnhancementLevel;
  availableFeatures: string[];
  unavailableFeatures: string[];
  capabilities: DeviceCapabilities;
  recommendations: string[];
}

/**
 * Progressive enhancement manager
 */
export class ProgressiveEnhancementManager {
  private static instance: ProgressiveEnhancementManager;
  private config: ProgressiveEnhancementConfig;
  private capabilities: DeviceCapabilities | null = null;
  private currentLevel: EnhancementLevel = 'baseline';
  private featureCache: Map<string, FeatureStatus> = new Map();
  private performanceMonitor: PerformanceMonitor;
  private connectionManager: ConnectionManager;
  private enhancementCallbacks: Map<string, (result: EnhancementResult) => void> = new Map();

  constructor(config: Partial<ProgressiveEnhancementConfig> = {}) {
    this.config = { ...DEFAULT_PROGRESSIVE_CONFIG, ...config };
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.connectionManager = ConnectionManager.getInstance();
  }

  static getInstance(config?: Partial<ProgressiveEnhancementConfig>): ProgressiveEnhancementManager {
    if (!ProgressiveEnhancementManager.instance) {
      ProgressiveEnhancementManager.instance = new ProgressiveEnhancementManager(config);
    }
    return ProgressiveEnhancementManager.instance;
  }

  /**
   * Initialize progressive enhancement with capability detection
   */
  async initialize(): Promise<EnhancementResult> {
    console.log('🚀 Initializing progressive enhancement system...');

    // Detect device capabilities
    this.capabilities = await this.detectCapabilities();
    
    // Determine enhancement level
    this.currentLevel = this.determineEnhancementLevel(this.capabilities);
    
    // Test available features
    const availableFeatures = await this.testFeatureAvailability();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(this.capabilities, availableFeatures);

    const result: EnhancementResult = {
      level: this.currentLevel,
      availableFeatures,
      unavailableFeatures: this.getUnavailableFeatures(availableFeatures),
      capabilities: this.capabilities,
      recommendations
    };

    console.log('✅ Progressive enhancement initialized:', result);
    
    // Notify callbacks
    this.notifyCallbacks(result);
    
    return result;
  }

  /**
   * Check if a specific feature is available
   */
  isFeatureAvailable(featureName: string): boolean {
    const cached = this.featureCache.get(featureName);
    if (cached) {
      return cached.available;
    }

    // Default availability based on enhancement level
    const allFeatures = [
      ...this.config.baselineFeatures,
      ...this.config.enhancedFeatures,
      ...this.config.premiumFeatures
    ];

    if (!allFeatures.includes(featureName)) {
      console.warn(`Unknown feature: ${featureName}`);
      return false;
    }

    return this.getFeaturesByLevel(this.currentLevel).includes(featureName);
  }

  /**
   * Get enhancement level for a specific feature
   */
  getFeatureEnhancementLevel(featureName: string): EnhancementLevel | null {
    if (this.config.baselineFeatures.includes(featureName)) return 'baseline';
    if (this.config.enhancedFeatures.includes(featureName)) return 'enhanced';
    if (this.config.premiumFeatures.includes(featureName)) return 'premium';
    return null;
  }

  /**
   * Adapt to changing conditions (network, performance, etc.)
   */
  async adaptToConditions(): Promise<EnhancementResult> {
    // Re-detect current capabilities
    const newCapabilities = await this.detectCapabilities();
    const newLevel = this.determineEnhancementLevel(newCapabilities);

    if (newLevel !== this.currentLevel) {
      console.log(`📊 Enhancement level changed: ${this.currentLevel} → ${newLevel}`);
      this.currentLevel = newLevel;
      this.capabilities = newCapabilities;
      
      // Clear feature cache to force re-evaluation
      this.featureCache.clear();
      
      // Re-test features
      const availableFeatures = await this.testFeatureAvailability();
      
      const result: EnhancementResult = {
        level: this.currentLevel,
        availableFeatures,
        unavailableFeatures: this.getUnavailableFeatures(availableFeatures),
        capabilities: this.capabilities,
        recommendations: this.generateRecommendations(this.capabilities, availableFeatures)
      };

      this.notifyCallbacks(result);
      return result;
    }

    return {
      level: this.currentLevel,
      availableFeatures: this.getFeaturesByLevel(this.currentLevel),
      unavailableFeatures: [],
      capabilities: this.capabilities!,
      recommendations: []
    };
  }

  /**
   * Enable offline mode with graceful degradation
   */
  enableOfflineMode(): void {
    if (!this.config.enableOfflineSupport) return;

    console.log('📴 Enabling offline mode with baseline features');
    
    this.currentLevel = 'baseline';
    this.featureCache.clear();
    
    // Cache essential data for offline use
    this.cacheEssentialData();
    
    // Notify callbacks of offline mode
    const result: EnhancementResult = {
      level: 'baseline',
      availableFeatures: this.config.baselineFeatures,
      unavailableFeatures: [...this.config.enhancedFeatures, ...this.config.premiumFeatures],
      capabilities: this.capabilities!,
      recommendations: ['Limited functionality in offline mode', 'Some features require internet connection']
    };

    this.notifyCallbacks(result);
  }

  /**
   * Test specific feature availability with fallbacks
   */
  async testFeature(featureName: string): Promise<FeatureStatus> {
    const cached = this.featureCache.get(featureName);
    if (cached) return cached;

    let status: FeatureStatus = {
      available: false,
      enhancementLevel: this.getFeatureEnhancementLevel(featureName) || 'baseline'
    };

    try {
      status = await this.performFeatureTest(featureName);
    } catch (error) {
      status = {
        available: false,
        reason: error.message,
        enhancementLevel: status.enhancementLevel
      };
    }

    this.featureCache.set(featureName, status);
    return status;
  }

  /**
   * Detect device and browser capabilities
   */
  private async detectCapabilities(): Promise<DeviceCapabilities> {
    const capabilities: DeviceCapabilities = {
      // Network detection
      connectionType: this.detectConnectionType(),
      isOnline: navigator.onLine,
      bandwidth: await this.measureBandwidth(),
      
      // Device detection
      memory: (navigator as any).deviceMemory || null,
      cores: navigator.hardwareConcurrency || null,
      pixelRatio: window.devicePixelRatio || 1,
      
      // Browser capabilities
      serviceWorkerSupported: 'serviceWorker' in navigator,
      webAssemblySupported: typeof WebAssembly === 'object',
      indexedDBSupported: 'indexedDB' in window,
      webGLSupported: this.detectWebGLSupport(),
      
      // User preferences
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      prefersDataSaver: (navigator as any).connection?.saveData || false,
      batteryLevel: await this.getBatteryLevel()
    };

    return capabilities;
  }

  /**
   * Determine enhancement level based on capabilities
   */
  private determineEnhancementLevel(capabilities: DeviceCapabilities): EnhancementLevel {
    // Start with premium and work down
    let level: EnhancementLevel = 'premium';

    // Network-based degradation
    if (!capabilities.isOnline) {
      level = 'baseline';
    } else if (['slow-2g', '2g'].includes(capabilities.connectionType)) {
      level = 'baseline';
    } else if (capabilities.connectionType === '3g') {
      level = 'enhanced';
    }

    // Memory-based degradation
    if (capabilities.memory && capabilities.memory < this.config.lowMemoryThreshold) {
      level = level === 'premium' ? 'enhanced' : 'baseline';
    }

    // Battery-based degradation
    if (capabilities.batteryLevel && capabilities.batteryLevel < 0.2) {
      level = level === 'premium' ? 'enhanced' : 'baseline';
    }

    // User preference degradation
    if (capabilities.prefersDataSaver) {
      level = 'baseline';
    }

    // Performance-based degradation
    const performanceState = this.performanceMonitor.getCurrentState();
    if (performanceState.averageResponseTime > this.config.slowConnectionThreshold) {
      level = level === 'premium' ? 'enhanced' : 'baseline';
    }

    return level;
  }

  /**
   * Test availability of all features
   */
  private async testFeatureAvailability(): Promise<string[]> {
    const allFeatures = this.getFeaturesByLevel(this.currentLevel);
    const availableFeatures: string[] = [];

    for (const feature of allFeatures) {
      const status = await this.testFeature(feature);
      if (status.available) {
        availableFeatures.push(feature);
      }
    }

    return availableFeatures;
  }

  /**
   * Perform specific feature test
   */
  private async performFeatureTest(featureName: string): Promise<FeatureStatus> {
    switch (featureName) {
      case 'basic-crud':
        return { available: true, enhancementLevel: 'baseline' };
        
      case 'real-time-updates':
        return {
          available: this.capabilities?.isOnline && 'WebSocket' in window,
          reason: !this.capabilities?.isOnline ? 'Offline' : !('WebSocket' in window) ? 'WebSocket not supported' : undefined,
          enhancementLevel: 'enhanced'
        };
        
      case 'live-collaboration':
        return {
          available: this.capabilities?.isOnline && 
                    'WebSocket' in window && 
                    this.capabilities.connectionType !== 'slow-2g',
          reason: 'Requires good network connection and WebSocket support',
          enhancementLevel: 'premium'
        };
        
      case 'advanced-analytics':
        return {
          available: this.capabilities?.webAssemblySupported && 
                    (this.capabilities.memory || 1024) > 512,
          reason: 'Requires WebAssembly and sufficient memory',
          fallback: 'basic-analytics',
          enhancementLevel: 'premium'
        };
        
      case 'service-worker':
        return {
          available: this.capabilities?.serviceWorkerSupported && this.config.enableServiceWorker,
          reason: !this.capabilities?.serviceWorkerSupported ? 'Service Worker not supported' : 'Service Worker disabled',
          enhancementLevel: 'enhanced'
        };
        
      default:
        return { available: true, enhancementLevel: 'baseline' };
    }
  }

  /**
   * Get features by enhancement level
   */
  private getFeaturesByLevel(level: EnhancementLevel): string[] {
    switch (level) {
      case 'baseline':
        return [...this.config.baselineFeatures];
      case 'enhanced':
        return [...this.config.baselineFeatures, ...this.config.enhancedFeatures];
      case 'premium':
        return [...this.config.baselineFeatures, ...this.config.enhancedFeatures, ...this.config.premiumFeatures];
      default:
        return [];
    }
  }

  /**
   * Get unavailable features
   */
  private getUnavailableFeatures(availableFeatures: string[]): string[] {
    const allFeatures = [
      ...this.config.baselineFeatures,
      ...this.config.enhancedFeatures,
      ...this.config.premiumFeatures
    ];
    
    return allFeatures.filter(feature => !availableFeatures.includes(feature));
  }

  /**
   * Detect connection type
   */
  private detectConnectionType(): DeviceCapabilities['connectionType'] {
    const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;
    
    if (connection) {
      return connection.effectiveType || 'unknown';
    }
    
    return 'unknown';
  }

  /**
   * Measure approximate bandwidth
   */
  private async measureBandwidth(): Promise<number | null> {
    if (!navigator.onLine) return null;

    try {
      const startTime = performance.now();
      // Use a small test request to measure speed
      await fetch('/api/ping', { method: 'HEAD' });
      const endTime = performance.now();
      
      // Very rough bandwidth estimation
      const responseTime = endTime - startTime;
      return responseTime < 100 ? 10 : responseTime < 500 ? 5 : 1; // Mbps estimate
    } catch {
      return null;
    }
  }

  /**
   * Detect WebGL support
   */
  private detectWebGLSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  }

  /**
   * Get battery level if available
   */
  private async getBatteryLevel(): Promise<number | null> {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        return battery.level;
      }
    } catch {
      // Battery API not available or not supported
    }
    return null;
  }

  /**
   * Cache essential data for offline use
   */
  private cacheEssentialData(): void {
    if (!this.config.enableCaching) return;

    // Implement caching strategy for offline use
    // This would typically cache core application data
    console.log('💾 Caching essential data for offline use');
  }

  /**
   * Generate recommendations based on capabilities
   */
  private generateRecommendations(
    capabilities: DeviceCapabilities,
    availableFeatures: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (!capabilities.isOnline) {
      recommendations.push('Device is offline - using cached data');
    }

    if (['slow-2g', '2g'].includes(capabilities.connectionType)) {
      recommendations.push('Slow network detected - some features disabled for better performance');
    }

    if (capabilities.memory && capabilities.memory < 512) {
      recommendations.push('Low memory device - reducing feature complexity');
    }

    if (capabilities.prefersReducedMotion) {
      recommendations.push('Reduced motion preference detected - animations minimized');
    }

    if (capabilities.prefersDataSaver) {
      recommendations.push('Data saver mode active - limiting background operations');
    }

    if (capabilities.batteryLevel && capabilities.batteryLevel < 0.3) {
      recommendations.push('Low battery detected - optimizing for power saving');
    }

    const unavailableCount = this.getUnavailableFeatures(availableFeatures).length;
    if (unavailableCount > 0) {
      recommendations.push(`${unavailableCount} advanced features unavailable - consider upgrading network or device`);
    }

    return recommendations;
  }

  /**
   * Notify callbacks of enhancement changes
   */
  private notifyCallbacks(result: EnhancementResult): void {
    for (const callback of this.enhancementCallbacks.values()) {
      callback(result);
    }
  }

  /**
   * Register callback for enhancement updates
   */
  registerCallback(id: string, callback: (result: EnhancementResult) => void): void {
    this.enhancementCallbacks.set(id, callback);
  }

  /**
   * Unregister callback
   */
  unregisterCallback(id: string): void {
    this.enhancementCallbacks.delete(id);
  }

  /**
   * Get current enhancement status
   */
  getCurrentStatus(): EnhancementResult {
    return {
      level: this.currentLevel,
      availableFeatures: this.getFeaturesByLevel(this.currentLevel),
      unavailableFeatures: this.getUnavailableFeatures(this.getFeaturesByLevel(this.currentLevel)),
      capabilities: this.capabilities!,
      recommendations: []
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ProgressiveEnhancementConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.featureCache.clear(); // Clear cache to force re-evaluation
  }
}

/**
 * Progressive enhancement context for React components
 */
const ProgressiveEnhancementContext = createContext<ProgressiveEnhancementManager | null>(null);

/**
 * Progressive enhancement provider component
 */
export const ProgressiveEnhancementProvider: React.FC<{
  children: React.ReactNode;
  config?: Partial<ProgressiveEnhancementConfig>;
}> = ({ children, config }) => {
  const manager = ProgressiveEnhancementManager.getInstance(config);
  
  useEffect(() => {
    manager.initialize();
  }, [manager]);
  
  return (
    <ProgressiveEnhancementContext.Provider value={manager}>
      {children}
    </ProgressiveEnhancementContext.Provider>
  );
};

/**
 * React hook for progressive enhancement
 */
export const useProgressiveEnhancement = (config?: Partial<ProgressiveEnhancementConfig>) => {
  const contextManager = useContext(ProgressiveEnhancementContext);
  const [manager] = useState(() => contextManager || ProgressiveEnhancementManager.getInstance(config));
  const [enhancementResult, setEnhancementResult] = useState<EnhancementResult | null>(null);
  const callbackId = useRef(`pe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const callback = (result: EnhancementResult) => {
      setEnhancementResult(result);
    };

    manager.registerCallback(callbackId.current, callback);
    
    // Initialize if not already done
    manager.initialize().then(setEnhancementResult);
    
    return () => {
      manager.unregisterCallback(callbackId.current);
    };
  }, [manager]);

  const isFeatureAvailable = useCallback(
    (featureName: string) => {
      return manager.isFeatureAvailable(featureName);
    },
    [manager]
  );

  const testFeature = useCallback(
    (featureName: string) => {
      return manager.testFeature(featureName);
    },
    [manager]
  );

  const adaptToConditions = useCallback(() => {
    return manager.adaptToConditions();
  }, [manager]);

  return {
    enhancementResult,
    isFeatureAvailable,
    testFeature,
    adaptToConditions,
    enableOfflineMode: manager.enableOfflineMode.bind(manager),
    updateConfig: manager.updateConfig.bind(manager),
    isReady: enhancementResult !== null
  };
};

export default ProgressiveEnhancementManager;