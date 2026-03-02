import { useState } from 'react'
import './MaintenancePage.css'

const MaintenancePage = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    // Simulate a small delay for better UX
    setTimeout(() => {
      if (password === import.meta.env.VITE_MAINTENANCE_PASSWORD) {
        // Set cookie and authenticate
        document.cookie = `maintenance-auth=${password}; path=/; max-age=86400; secure; samesite=strict`
        onAuthenticated()
      } else {
        setError('Invalid password')
      }
      setIsLoading(false)
    }, 500)
  }

  return (
    <div className="maintenance-container">
      <div className="maintenance-content">
        <div className="maintenance-header">
          <img 
            src="/sandyland-logo.png" 
            alt="Sandyland" 
            className="maintenance-logo"
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
          <h1 className="maintenance-title">
            Under Construction
          </h1>
          <p className="maintenance-description">
            SAMS is currently being prepared for launch.
          </p>
          <p className="maintenance-expected">
            Expected: July 1, 2025
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="maintenance-form">
          <div className="maintenance-input-group">
            <input
              type="password"
              placeholder="Enter access password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="maintenance-input"
              autoFocus
              disabled={isLoading}
            />
            {error && (
              <p className="maintenance-error">{error}</p>
            )}
          </div>
          <button
            type="submit"
            className={`maintenance-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Verifying...' : 'Access Site'}
          </button>
        </form>
        
        <p className="maintenance-footer">
          Authorized access only
        </p>
      </div>
    </div>
  )
}

export default MaintenancePage