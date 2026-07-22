import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, RequireAuth } from './hooks/useAuth'
import { InternsProvider } from './hooks/useInterns'
import { ToastProvider } from './components/Toast'
import { Layout } from './components/Layout'
import { AuthPage } from './pages/AuthPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { BoardPage } from './pages/BoardPage'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          {/* Signup is disabled — this is a single-account tool. */}
          <Route path="/signup" element={<Navigate to="/login" replace />} />

          <Route
            element={
              <RequireAuth>
                <InternsProvider>
                  <Layout />
                </InternsProvider>
              </RequireAuth>
            }
          >
            <Route path="/" element={<PortfolioPage />} />
            <Route path="/project/:id" element={<BoardPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  )
}
