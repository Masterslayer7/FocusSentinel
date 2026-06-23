import React from 'react';

interface PremiumUpsellBannerProps {
  featureName?: string;
}

export const PremiumUpsellBanner: React.FC<PremiumUpsellBannerProps> = ({ featureName }) => {
  return (
    <div className="premium-upsell-banner" style={{
      padding: '1rem',
      border: '1px solid #ffd700',
      borderRadius: '8px',
      backgroundColor: '#fffbe6',
      color: '#8a6d3b',
      marginTop: '1rem'
    }}>
      <h3 style={{ margin: '0 0 0.5rem 0' }}>Unlock Premium</h3>
      <p style={{ margin: '0 0 1rem 0' }}>
        The feature {featureName ? <strong>"{featureName}"</strong> : ''} requires a Premium subscription.
      </p>
      <button 
        className="btn btn-primary" 
        onClick={() => {
          // This will eventually dispatch a global event to open a modal
          console.log('[PremiumUpsell] Upgrade button clicked');
        }}
      >
        Upgrade Now
      </button>
    </div>
  );
};
