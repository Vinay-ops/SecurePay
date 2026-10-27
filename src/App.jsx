import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DemoProvider } from './context/DemoContext';
import Layout from './components/Layout';

// Pages (demo mode: dashboard is the main entry point - no login/register)
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import MakePaymentPage from './pages/MakePaymentPage';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
import TransactionVerificationPage from './pages/TransactionVerificationPage';
import AttackSimulationPage from './pages/AttackSimulationPage';
import SecurityDashboardPage from './pages/SecurityDashboardPage';

const App = () => {
  return (
    <DemoProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/overview" element={<LandingPage />} />
            <Route path="/payment" element={<MakePaymentPage />} />
            <Route path="/history" element={<TransactionHistoryPage />} />
            <Route path="/verify" element={<TransactionVerificationPage />} />
            <Route path="/simulation" element={<AttackSimulationPage />} />
            <Route path="/security" element={<SecurityDashboardPage />} />
            {/* Legacy auth routes are removed in demo mode */}
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/register" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
    </DemoProvider>
  );
};

export default App;
