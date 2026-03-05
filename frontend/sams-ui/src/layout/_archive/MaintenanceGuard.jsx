import { useState, useEffect } from 'react'
import MaintenancePage from './MaintenancePage'

const MaintenanceGuard = ({ children }) => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Check if maintenance mode is enabled
    const maintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === 'true'
    
    if (!maintenanceMode) {
      // Maintenance mode is off, allow access
      setIsMaintenanceMode(false)
      setIsAuthenticated(true)
      setIsChecking(false)
      return
    }

    // Maintenance mode is on, check for authentication
    setIsMaintenanceMode(true)
    
    // Check for maintenance auth cookie
    const cookies = document.cookie.split(';')
    const authCookie = cookies.find(cookie => 
      cookie.trim().startsWith('maintenance-auth=')
    )
    
    if (authCookie) {
      const cookieValue = authCookie.split('=')[1]
      const expectedPassword = import.meta.env.VITE_MAINTENANCE_PASSWORD
      
      if (cookieValue === expectedPassword) {
        setIsAuthenticated(true)
      }
    }
    
    setIsChecking(false)
  }, [])

  const handleAuthenticated = () => {
    setIsAuthenticated(true)
  }

  // Show loading state while checking
  if (isChecking) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem',
        color: '#666'
      }}>
        Loading...
      </div>
    )
  }

  // Show maintenance page if in maintenance mode and not authenticated
  if (isMaintenanceMode && !isAuthenticated) {
    return <MaintenancePage onAuthenticated={handleAuthenticated} />
  }

  // Allow access to the app
  return children
}

export default MaintenanceGuard