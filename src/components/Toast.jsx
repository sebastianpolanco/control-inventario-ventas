import React, { useState, useEffect } from 'react';

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose && onClose();
      }, 300); // Wait for fade-out animation before removing
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Determine icon and color based on type
  let icon, backgroundColor, textColor, borderColor;
  switch (type) {
    case 'success':
      icon = '✅';
      backgroundColor = '#d4edda';
      textColor = '#155724';
      borderColor = '#c3e6cb';
      break;
    case 'error':
      icon = '❌';
      backgroundColor = '#f8d7da';
      textColor = '#721c24';
      borderColor = '#f5c6cb';
      break;
    case 'warning':
      icon = '⚠️';
      backgroundColor = '#fff3cd';
      textColor = '#856404';
      borderColor = '#ffeeba';
      break;
    case 'info':
      icon = 'ℹ️';
      backgroundColor = '#d1ecf1';
      textColor = '#0c5460';
      borderColor = '#bee5eb';
      break;
    default:
      icon = '📢';
      backgroundColor = '#e2e3e5';
      textColor = '#383d41';
      borderColor = '#d6d8db';
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        backgroundColor: backgroundColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        maxWidth: '80%',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        transform: isVisible ? 'translateY(0)' : 'translateY(-20px)',
        pointerEvents: isVisible ? 'all' : 'none',
      }}
    >
      <span style={{ marginRight: '12px', fontSize: '20px' }}>{icon}</span>
      <div style={{ flex: 1 }}>{message}</div>
      <button 
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onClose && onClose(), 300);
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: textColor,
          fontSize: '16px',
          cursor: 'pointer',
          marginLeft: '12px',
          opacity: 0.7,
          padding: '0 4px'
        }}
      >
        ×
      </button>
    </div>
  );
};

export default Toast;
