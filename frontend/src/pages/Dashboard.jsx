import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Plus, Search, ExternalLink } from 'lucide-react';

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async () => {
    try {
      // VULNERABILITY: SQL Injection search
      const res = await api.get(`/projects/search/name?name=${search}`);
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/projects', { name, description, is_public: isPublic });
      setName('');
      setDescription('');
      fetchProjects();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Your Projects</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="text" 
            placeholder="Search projects..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 0, width: '250px' }}
          />
          <button onClick={handleSearch} className="btn btn-primary"><Search size={18} /></button>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div className="projects-list">
          <div className="projects-grid">
            {projects.map(p => (
              <div key={p.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h3>{p.name}</h3>
                  <Link to={`/project/${p.id}`}><ExternalLink size={18} /></Link>
                </div>
                {/* VULNERABILITY: Stored XSS rendered here */}
                <div 
                  className="project-desc" 
                  dangerouslySetInnerHTML={{ __html: p.description }}
                  style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '1rem 0', maxHeight: '100px', overflow: 'hidden' }}
                />
                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                  {p.is_public ? 'Public' : 'Private'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="create-project">
          <div className="card">
            <h2>Create Project</h2>
            <form onSubmit={handleCreate}>
              <input type="text" placeholder="Project Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <textarea placeholder="Description (Allows HTML)" value={description} onChange={(e) => setDescription(e.target.value)} required />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} style={{ width: 'auto', marginBottom: 0 }} />
                Public Project
              </label>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create</button>
            </form>
          </div>
          
          <div className="card" style={{ marginTop: '1rem', background: '#1a1111', borderColor: '#332222' }}>
            <h3>Security Hints</h3>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '1.2rem', marginTop: '0.5rem' }}>
              <li>Try SQLi: <code>' OR '1'='1</code></li>
              <li>Try XSS: <code>&lt;script&gt;alert(1)&lt;/script&gt;</code></li>
              <li>Try IDOR: Edit URL to <code>/project/1</code></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
