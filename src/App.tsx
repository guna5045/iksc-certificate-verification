import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { AdminPage } from './pages/AdminPage';
import './styles/global.css';
import './styles/verification.css';
import './styles/admin.css';

export function App() {
  const [currentView, setCurrentView] = useState<'home' | 'admin'>('home');
  const [activeId, setActiveId] = useState<string>('');

  const parseRoute = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    const path = window.location.pathname.toLowerCase();

    // Check for /verify/ID format if ?id= is not present
    if (!id && path.includes('/verify/')) {
      const match = window.location.pathname.match(/\/verify\/([^\/\?]+)/i);
      if (match) {
        id = match[1];
      }
    }

    if (id) {
      setActiveId(id);
      setCurrentView('home');
    } else if (path.includes('/admin')) {
      setActiveId('');
      setCurrentView('admin');
    } else {
      setActiveId('');
      setCurrentView('home');
    }
  }, []);

  useEffect(() => {
    parseRoute();

    const handlePopState = () => {
      parseRoute();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parseRoute]);

  // Navigate to admin or home
  const handleNavigate = (view: 'home' | 'admin') => {
    setCurrentView(view);
    if (view === 'admin') {
      const url = new URL(window.location.origin + '/admin');
      window.history.pushState({}, '', url.toString());
      setActiveId('');
    } else {
      const url = new URL(window.location.origin + '/');
      window.history.pushState({}, '', url.toString());
      setActiveId('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Called when user submits verification form on HomePage
  const handleVerifySubmit = (id: string) => {
    const cleanId = id.trim().toUpperCase();
    const url = new URL(window.location.origin + '/verify');
    url.searchParams.set('id', cleanId);
    window.history.pushState({ id: cleanId }, '', url.toString());
    setActiveId(cleanId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Called when user clicks "Verify Another Certificate" or resets
  const handleResetToHome = () => {
    const url = new URL(window.location.origin + '/');
    window.history.pushState({}, '', url.toString());
    setActiveId('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="site-container">
      <Header currentView={currentView} onNavigate={handleNavigate} />

      <main className="content-wrap">
        {currentView === 'home' && (
          <HomePage 
            directId={activeId} 
            onVerifySubmit={handleVerifySubmit}
            onResetToHome={handleResetToHome}
          />
        )}

        {currentView === 'admin' && (
          <AdminPage />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
