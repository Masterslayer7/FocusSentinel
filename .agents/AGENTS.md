# FocusSentinel Agent Rules

## Premium Feature Architecture Guidelines
When implementing or modifying any feature that involves free vs. premium tiers, you MUST strictly adhere to the following architectural patterns to prevent "boolean blindness." Never write ad-hoc `if (isPremium)` checks throughout the codebase.

1. **UI Components (Declarative Guards):**
   * Do NOT use conditional ternary operators for premium access in React components.
   * ALWAYS use the declarative `<PremiumGuard>` wrapper component.
   * *Example:* 
     ```tsx
     <PremiumGuard feature="advanced-telemetry" fallback={<PremiumUpsellBanner />}>
       <AdvancedTelemetryPanel />
     </PremiumGuard>
     ```

2. **Service Layer (Single Source of Truth):**
   * UI components and business logic must NEVER verify API responses, tokens, or billing statuses directly.
   * ALWAYS inject or import the `LicenseManager` singleton.
   * Check permissions using the official interface (e.g., `licenseManager.canAccess('feature-name')`).

3. **Action Interceptors:**
   * For system actions requiring premium (e.g., changing to a premium voice), route the logic so that the `LicenseManager` intercepts the denial and dispatches a global event to open an upgrade modal.

Failure to follow this architecture will lead to spaghetti code. Keep the core logic completely decoupled from the billing state.
