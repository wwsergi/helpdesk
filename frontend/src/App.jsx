import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { useState, useEffect } from 'react';
import apiClient from './lib/api';

// Pages
import Login from './pages/auth/Login';
import AgentDashboard from './pages/agent/Dashboard';
import AgentInbox from './pages/agent/Inbox';
import AgentTicketDetail from './pages/agent/TicketDetail';
import Reports from './pages/agent/Reports';
import CustomerDashboard from './pages/customer/Dashboard';
import CustomerTickets from './pages/customer/Tickets';
import CustomerTicketDetail from './pages/customer/TicketDetail';
import Contacts from './pages/agent/Contacts';
import Agents from './pages/agent/Agents';
import Categories from './pages/agent/Categories';
import KnowledgeBase from './pages/agent/KnowledgeBase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Protected Route Component
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  const { isAuthenticated, user, setAuth, logout } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token && !user) {
        try {
          const response = await apiClient.get('/auth/me');
          setAuth(response.data.user, token);
        } catch (error) {
          logout();
        }
      }
      setIsInitializing(false);
    };

    initAuth();
  }, [user, setAuth, logout]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/" replace /> : <Login />
          } />

          {/* Agent Routes */}
          <Route path="/agent" element={
            <ProtectedRoute allowedRoles={['agent', 'admin']}>
              <AgentDashboard />
            </ProtectedRoute>
          } />
          <Route path="/agent/inbox" element={
            <ProtectedRoute allowedRoles={['agent', 'admin']}>
              <AgentInbox />
            </ProtectedRoute>
          } />
          <Route path="/agent/tickets/:id" element={
            <ProtectedRoute allowedRoles={['agent', 'admin']}>
              <AgentTicketDetail />
            </ProtectedRoute>
          } />
          <Route path="/agent/contacts" element={
            <ProtectedRoute allowedRoles={['agent', 'admin']}>
              <Contacts />
            </ProtectedRoute>
          } />
          <Route path="/agent/agents" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Agents />
            </ProtectedRoute>
          } />
          <Route path="/agent/categories" element={
            <ProtectedRoute allowedRoles={['agent', 'admin']}>
              <Categories />
            </ProtectedRoute>
          } />
          <Route path="/agent/kb" element={
            <ProtectedRoute allowedRoles={['agent', 'admin']}>
              <KnowledgeBase />
            </ProtectedRoute>
          } />
          <Route path="/agent/reports" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Reports />
            </ProtectedRoute>
          } />

          {/* Customer Portal Routes */}
          <Route path="/portal" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/portal/tickets" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerTickets />
            </ProtectedRoute>
          } />
          <Route path="/portal/tickets/:id" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerTicketDetail />
            </ProtectedRoute>
          } />

          {/* Default Redirect */}
          <Route path="/" element={
            <Navigate to={
              !isAuthenticated ? '/login' :
                user?.role === 'customer' ? '/portal' : '/agent'
            } replace />
          } />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
