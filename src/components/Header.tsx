import React from 'react';

interface HeaderProps {
  currentView: 'home' | 'admin';
  onNavigate: (view: 'home' | 'admin') => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Left Branding */}
        <button 
          type="button"
          className="header-brand"
          onClick={() => onNavigate('home')}
        >
          <img 
            src="./StuChapLogo.png" 
            alt="IKSC Logo" 
            className="header-logo" 
          />
          <div className="brand-text">
            <span className="brand-title">IKSC</span>
            <span className="brand-subtitle">IUCEE KARE Student Chapter</span>
          </div>
        </button>

        {/* Right Navigation */}
        <nav className="header-nav">
          <button
            type="button"
            className={`nav-item ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => onNavigate('home')}
          >
            Certificate Verification
          </button>
          <button
            type="button"
            className={`nav-item ${currentView === 'admin' ? 'active' : ''}`}
            onClick={() => onNavigate('admin')}
          >
            Admin Login
          </button>
        </nav>
      </div>
    </header>
  );
};
