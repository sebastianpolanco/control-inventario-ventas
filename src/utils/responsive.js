import { useState, useEffect } from 'react';

export const useResponsive = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile: windowSize.width < 768,
    isTablet: windowSize.width >= 768 && windowSize.width < 1024,
    isDesktop: windowSize.width >= 1024,
    width: windowSize.width,
    height: windowSize.height
  };
};

export const getResponsiveValue = (mobile, tablet, desktop) => {
  const { isMobile, isTablet } = useResponsive();
  
  if (isMobile) return mobile;
  if (isTablet) return tablet || desktop;
  return desktop;
};

export const getResponsiveGrid = (mobile = 2, tablet = 3, desktop = 4) => {
  const { isMobile, isTablet } = useResponsive();
  
  if (isMobile) return `repeat(${mobile}, 1fr)`;
  if (isTablet) return `repeat(${tablet}, 1fr)`;
  return `repeat(auto-fill, minmax(150px, 1fr))`;
};

export const getResponsiveSpacing = (base = 16) => {
  const { isMobile, isTablet } = useResponsive();
  
  if (isMobile) return base * 0.75;
  if (isTablet) return base * 0.875;
  return base;
};

export const getResponsiveFontSize = (base = 16) => {
  const { isMobile, isTablet } = useResponsive();
  
  if (isMobile) return base * 0.875;
  if (isTablet) return base * 0.9375;
  return base;
};

// Touch helpers
export const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// Viewport helpers
export const getViewportHeight = (percentage = 100) => {
  return `${percentage}vh`;
};

export const getViewportWidth = (percentage = 100) => {
  return `${percentage}vw`;
};

// Safe area helpers for mobile browsers
export const getSafeAreaInset = (position = 'top') => {
  return `env(safe-area-inset-${position})`;
};

// Animation helpers
export const getReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Theme helpers
export const getDarkMode = () => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const responsiveStyles = {
  container: (isMobile, isTablet) => ({
    padding: isMobile ? '10px' : isTablet ? '15px' : '20px',
    fontSize: isMobile ? '14px' : isTablet ? '15px' : '16px'
  }),
  
  grid: (isMobile, isTablet) => ({
    display: 'grid',
    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: isMobile ? '8px' : isTablet ? '12px' : '15px'
  }),
  
  sidebar: (isMobile) => ({
    width: isMobile ? '80%' : '250px',
    position: 'fixed',
    left: isMobile ? '-80%' : '0',
    top: 0,
    height: '100vh',
    transition: 'left 0.3s ease',
    zIndex: 1001
  }),
  
  modal: (isMobile, isTablet) => ({
    width: isMobile ? '95%' : isTablet ? '80%' : '90%',
    maxWidth: isMobile ? '100%' : isTablet ? '500px' : '600px',
    padding: isMobile ? '15px' : isTablet ? '20px' : '25px',
    margin: isMobile ? '10px' : '20px'
  }),
  
  button: (isMobile, isTablet) => ({
    padding: isMobile ? '10px 16px' : isTablet ? '10px 20px' : '12px 24px',
    fontSize: isMobile ? '14px' : isTablet ? '15px' : '16px',
    minHeight: isMobile ? '44px' : 'auto'
  }),
  
  input: (isMobile, isTablet) => ({
    padding: isMobile ? '12px 16px' : isTablet ? '12px 16px' : '14px 18px',
    fontSize: isMobile ? '16px' : isTablet ? '15px' : '16px',
    borderRadius: isMobile ? '8px' : '6px'
  }),
  
  card: (isMobile, isTablet) => ({
    padding: isMobile ? '12px' : isTablet ? '15px' : '20px',
    marginBottom: isMobile ? '10px' : isTablet ? '15px' : '20px',
    borderRadius: isMobile ? '8px' : '6px'
  })
};

export default {
  useResponsive,
  getResponsiveValue,
  getResponsiveGrid,
  getResponsiveSpacing,
  getResponsiveFontSize,
  isTouchDevice,
  getViewportHeight,
  getViewportWidth,
  getSafeAreaInset,
  getReducedMotion,
  getDarkMode,
  responsiveStyles
};