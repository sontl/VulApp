import React, { useState } from 'react';
import api from '../services/api';
import { Check } from 'lucide-react';

const Subscription = () => {
  const [loading, setLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleSubscribe = async (plan) => {
    setLoading(true);
    try {
      const res = await api.post('/subscribe', { plan_type: plan });
      alert(res.data.message);
      // Update local storage
      const updatedUser = { ...user, plan: plan };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.location.reload();
    } catch (err) {
      alert('Subscription failed');
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    { name: 'free', price: '$0', features: ['3 Projects', 'Basic Support'] },
    { name: 'pro', price: '$9', features: ['Unlimited Projects', 'Priority Support', 'API Access'] },
    { name: 'enterprise', price: '$49', features: ['Custom Branding', 'Advanced Security', 'Dedicated Manager'] }
  ];

  return (
    <div style={{ textAlign: 'center' }}>
      <h1>Choose your plan</h1>
      <p style={{ marginBottom: '3rem' }}>Upgrade to unlock advanced features for your projects.</p>
      
      <div className="projects-grid" style={{ marginBottom: '3rem' }}>
        {plans.map(p => (
          <div key={p.name} className="card" style={{ borderColor: user.plan === p.name ? 'var(--accent-primary)' : 'var(--border)' }}>
            <h2 style={{ textTransform: 'capitalize' }}>{p.name}</h2>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: '1rem 0' }}>{p.price}</div>
            <ul style={{ listStyle: 'none', textAlign: 'left', marginBottom: '2rem' }}>
              {p.features.map(f => (
                <li key={f} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Check size={16} color="var(--success)" /> {f}
                </li>
              ))}
            </ul>
            <button 
              onClick={() => handleSubscribe(p.name)} 
              className={`btn ${user.plan === p.name ? 'btn-secondary' : 'btn-primary'}`}
              style={{ width: '100%' }}
              disabled={loading || user.plan === p.name}
            >
              {user.plan === p.name ? 'Current Plan' : 'Select Plan'}
            </button>
          </div>
        ))}
      </div>

      <div className="card" style={{ background: '#111', border: '1px dashed var(--accent-primary)' }}>
        <p><strong>Security Note:</strong> This subscription endpoint is intentionally vulnerable. 
        You can set any <code>plan_type</code> directly via the API without payment verification.</p>
      </div>
    </div>
  );
};

export default Subscription;
