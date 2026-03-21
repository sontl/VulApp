import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProjectDetails from './pages/ProjectDetails';
import Subscription from './pages/Subscription';
import { LogOut, Home, User, CreditCard, Shield } from 'lucide-react';

const Navbar = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="nav-logo">
        <Shield className="logo-icon" size={28} />
        <div className="logo-text">
          <span className="brand-name">TechviFlaw</span>
          <span className="brand-by">by Techvify</span>
        </div>
      </Link>
      <div className="nav-links">
        {token ? (
          <>
            <Link to="/dashboard"><Home size={20} /></Link>
            <Link to="/subscription"><CreditCard size={20} /></Link>
            <span style={{ color: 'var(--text-secondary)' }}>{user.email}</span>
            <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <LogOut size={20} />
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
};

function App() {
  return (
    <Router>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/project/:id" element={<ProjectDetails />} />
          <Route path="/subscription" element={<Subscription />} />
        </Routes>
      </div>
      <footer className="footer-corporate">
        <div className="footer-content">
          <p className="footer-brand"><strong>TechviFlaw</strong> - A product of <strong>Techvify</strong></p>
          <p className="footer-tagline">Purposely Vulnerable Enterprise SaaS Platform for Advanced Security Testing</p>
        </div>
        <div className="footer-links">
          <Link to="/api/debug" target="_blank" className="footer-link">Debug console</Link>
          <span className="footer-copyright">© {new Date().getFullYear()} Techvify Inc. All rights reserved.</span>
        </div>
      </footer>
    </Router>
  );
}

export default App;
