import React, { useState, useEffect } from 'react';
import './UserManagement.css';

interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  updatedAt?: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingUser 
        ? `http://localhost:5000/api/users/${editingUser.id}`
        : 'http://localhost:5000/api/users';
      
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save user');
      }
      
      setFormData({ username: '', email: '', password: '' });
      setShowAddForm(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save user');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Benutzer wirklich löschen?')) return;
    
    try {
      const response = await fetch(`http://localhost:5000/api/users/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete user');
      
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
    });
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingUser(null);
    setFormData({ username: '', email: '', password: '' });
  };

  if (loading) return <div className="user-management-loading">Laden...</div>;
  if (error) return <div className="user-management-error">Fehler: {error}</div>;

  return (
    <div className="user-management">
      <div className="user-management-header">
        <h2>Benutzerverwaltung</h2>
        <button 
          className="btn-primary" 
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={showAddForm}
        >
          + Neuer Benutzer
        </button>
      </div>

      {showAddForm && (
        <form className="user-form" onSubmit={handleSubmit}>
          <h3>{editingUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</h3>
          <div className="form-group">
            <label>Benutzername:</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>E-Mail:</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Passwort{editingUser && ' (leer lassen für keine Änderung)'}:</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!editingUser}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingUser ? 'Speichern' : 'Erstellen'}
            </button>
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div className="user-table">
        <table>
          <thead>
            <tr>
              <th>Benutzername</th>
              <th>E-Mail</th>
              <th>Erstellt am</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="no-users">
                  Keine Benutzer vorhanden
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString('de-DE')}</td>
                  <td className="actions">
                    <button 
                      className="btn-edit" 
                      onClick={() => handleEdit(user)}
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn-delete" 
                      onClick={() => handleDelete(user.id)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
