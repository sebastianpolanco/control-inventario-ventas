import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import DashboardAdmin from './pages/DashboardAdmin';
import DashboardVendedor from './pages/DashboardVendedor';
import DashboardMesero from './pages/DashboardMesero';
import './styles/responsive.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<DashboardAdmin />} />
        <Route path="/vendedor" element={<DashboardVendedor />} />
        <Route path="/mesero" element={<DashboardMesero />} />
      </Routes>
    </Router>
  );
}

export default App;
