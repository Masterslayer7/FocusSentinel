import React, { useState, useEffect } from 'react';
import { licenseManager, PremiumFeature } from '../services/license/LicenseManager';

interface PremiumGuardProps {
  feature: PremiumFeature;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PremiumGuard: React.FC<PremiumGuardProps> = ({ feature, fallback = null, children }) => {
  const [canAccess, setCanAccess] = useState(() => licenseManager.canAccess(feature));

  useEffect(() => {
    const unsubscribe = licenseManager.subscribe(() => {
      setCanAccess(licenseManager.canAccess(feature));
    });
    return unsubscribe;
  }, [feature]);

  if (!canAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
