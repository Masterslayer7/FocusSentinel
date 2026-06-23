export type Tier = 'free' | 'premium';

export interface LicenseStatus {
  tier: Tier;
}

export type LicenseListener = (status: LicenseStatus) => void;

// Define known premium features to prevent typos
export const PREMIUM_FEATURES = [
  'piper-tts',
  'cloud-tts',
  'advanced-telemetry'
] as const;

export type PremiumFeature = typeof PREMIUM_FEATURES[number] | string;

class LicenseManager {
  private currentTier: Tier = 'free';
  private listeners = new Set<LicenseListener>();

  public getTier(): Tier {
    return this.currentTier;
  }

  public setTier(tier: Tier): void {
    this.currentTier = tier;
    this.notifyListeners();
  }

  /**
   * Checks if the user's current tier grants access to the requested feature.
   */
  public canAccess(feature: PremiumFeature): boolean {
    if (this.currentTier === 'premium') {
      return true; // Premium users get everything
    }
    
    // For free users, explicitly check if the feature is in the known premium list.
    // If it is, deny access. Otherwise, allow it.
    return !(PREMIUM_FEATURES as readonly string[]).includes(feature);
  }

  public subscribe(listener: LicenseListener): () => void {
    this.listeners.add(listener);
    listener({ tier: this.currentTier });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const status = { tier: this.currentTier };
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('[LicenseManager] Error in listener:', err);
      }
    });
  }
}

export const licenseManager = new LicenseManager();
