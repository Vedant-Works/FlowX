import './Navbar.css'

function Navbar({ theme, onToggleTheme, onOpenReviews }) {
  return (
    <header className="navbar">
      <div className="navbar-brand">
        <div className="logo-icon">
          <img src="/logo.png" alt="FlowX Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'inherit' }} />
        </div>
        <div className="brand-text">
          <h1 className="brand-title">Flow<span>X</span></h1>
          <span className="brand-tagline">Intelligent Urban Mobility</span>
        </div>
      </div>

      <div className="navbar-actions">
        <button
          type="button"
          className="community-reviews-btn"
          onClick={onOpenReviews}
          title="Community Commuter Reviews & Feedback"
          aria-label="Community Reviews"
        >
          💬 <span className="reviews-btn-label">Reviews</span>
        </button>
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
          <span className="theme-toggle-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </header>
  )
}

export default Navbar
