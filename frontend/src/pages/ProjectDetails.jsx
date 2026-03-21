import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FileUp, File, Download, Trash2 } from 'lucide-react';

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProject();
    fetchFiles();
  }, [id]);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      setProject(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load project');
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await api.get(`/files/project/${id}`);
      setFiles(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', id);

    setUploading(true);
    try {
      await api.post('/files/upload', formData);
      fetchFiles();
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this project? (IDOR test)')) return;
    try {
      await api.delete(`/projects/${id}`);
      navigate('/dashboard');
    } catch (err) {
      alert('Delete failed');
    }
  };

  if (error) return <div className="card" style={{ color: 'var(--error)' }}>{error}</div>;
  if (!project) return <div>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1>{project.name}</h1>
          <p>Owner ID: {project.owner_id}</p>
        </div>
        <button onClick={handleDelete} className="btn" style={{ background: '#331111', color: 'var(--error)' }}>
          <Trash2 size={18} />
        </button>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="card">
          <h2>Project Description</h2>
          {/* VULNERABILITY: Stored XSS */}
          <div 
            dangerouslySetInnerHTML={{ __html: project.description }}
            style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '1rem' }}
          />
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2>Files</h2>
            <label className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <FileUp size={18} /> {uploading ? 'Uploading...' : 'Upload'}
              <input type="file" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>
          </div>
          
          <div className="files-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {files.length === 0 && <p>No files uploaded yet.</p>}
            {files.map(f => (
              <div key={f.id} className="card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <File size={18} color="var(--accent-primary)" />
                  <span>{f.filename}</span>
                </div>
                <a href={`http://localhost:5001/uploads/${f.filename}`} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)' }}>
                  <Download size={18} />
                </a>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <p>💡 Tip: Upload <code>exploit.html</code> or <code>shell.js</code> to test file execution.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
