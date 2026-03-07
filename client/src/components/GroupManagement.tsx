import React, { useState, useEffect } from 'react';
import { useDialog } from '../contexts/DialogContext';
import './GroupManagement.css';

interface User {
  id: string;
  username: string;
  email: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  users: User[];
  memberCount: number;
}

const GroupManagement: React.FC = () => {
  const { showAlert, showConfirm } = useDialog();
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/groups');
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      setGroups(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingGroup 
        ? `http://localhost:5001/api/groups/${editingGroup.id}`
        : 'http://localhost:5001/api/groups';
      
      const method = editingGroup ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save group');
      }
      
      setFormData({ name: '', description: '' });
      setShowAddForm(false);
      setEditingGroup(null);
      fetchGroups();
    } catch (err) {
      showAlert('Fehler', err instanceof Error ? err.message : 'Failed to save group', '❌');
    }
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('Löschen', 'Gruppe wirklich löschen?', '🗑️')) return;
    
    try {
      const response = await fetch(`http://localhost:5001/api/groups/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete group');
      
      fetchGroups();
    } catch (err) {
      showAlert('Fehler', err instanceof Error ? err.message : 'Failed to delete group', '❌');
    }
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
    });
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingGroup(null);
    setFormData({ name: '', description: '' });
  };

  const openMemberDialog = (group: Group) => {
    setSelectedGroup(group);
    setShowMemberDialog(true);
  };

  const addUserToGroup = async (userId: string) => {
    if (!selectedGroup) return;

    try {
      const response = await fetch(`http://localhost:5001/api/groups/${selectedGroup.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add user');
      }

      fetchGroups();
    } catch (err) {
      showAlert('Fehler', err instanceof Error ? err.message : 'Failed to add user to group', '❌');
    }
  };

  const removeUserFromGroup = async (userId: string) => {
    if (!selectedGroup) return;

    try {
      const response = await fetch(`http://localhost:5001/api/groups/${selectedGroup.id}/members/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove user');

      fetchGroups();
      // Update selected group
      const updatedGroup = groups.find(g => g.id === selectedGroup.id);
      if (updatedGroup) setSelectedGroup(updatedGroup);
    } catch (err) {
      showAlert('Fehler', err instanceof Error ? err.message : 'Failed to remove user from group', '❌');
    }
  };

  const availableUsers = users.filter(
    user => !selectedGroup?.users.some(u => u.id === user.id)
  );

  if (loading) return <div className="group-management-loading">Laden...</div>;
  if (error) return <div className="group-management-error">Fehler: {error}</div>;

  return (
    <div className="group-management">
      <div className="group-management-header">
        <h2>Gruppenverwaltung</h2>
        <button 
          className="btn-primary" 
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={showAddForm}
        >
          + Neue Gruppe
        </button>
      </div>

      {showAddForm && (
        <form className="group-form" onSubmit={handleSubmit}>
          <h3>{editingGroup ? 'Gruppe bearbeiten' : 'Neue Gruppe'}</h3>
          <div className="form-group">
            <label>Gruppenname:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Beschreibung:</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingGroup ? 'Speichern' : 'Erstellen'}
            </button>
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div className="group-table">
        <table>
          <thead>
            <tr>
              <th>Gruppenname</th>
              <th>Beschreibung</th>
              <th>Mitglieder</th>
              <th>Erstellt am</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={5} className="no-groups">
                  Keine Gruppen vorhanden
                </td>
              </tr>
            ) : (
              groups.map((group) => (
                <tr key={group.id}>
                  <td>{group.name}</td>
                  <td>{group.description || '-'}</td>
                  <td>
                    <button 
                      className="btn-members" 
                      onClick={() => openMemberDialog(group)}
                    >
                      👥 {group.memberCount}
                    </button>
                  </td>
                  <td>{new Date(group.createdAt).toLocaleDateString('de-DE')}</td>
                  <td className="actions">
                    <button 
                      className="btn-edit" 
                      onClick={() => handleEdit(group)}
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn-delete" 
                      onClick={() => handleDelete(group.id)}
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

      {showMemberDialog && selectedGroup && (
        <div className="modal-overlay" onClick={() => setShowMemberDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Mitglieder von "{selectedGroup.name}"</h3>
              <button className="modal-close" onClick={() => setShowMemberDialog(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="member-section">
                <h4>Aktuelle Mitglieder ({selectedGroup.users.length})</h4>
                <div className="member-list">
                  {selectedGroup.users.length === 0 ? (
                    <p className="no-members">Keine Mitglieder</p>
                  ) : (
                    selectedGroup.users.map(user => (
                      <div key={user.id} className="member-item">
                        <div className="member-info">
                          <span className="member-name">{user.username}</span>
                          <span className="member-email">{user.email}</span>
                        </div>
                        <button 
                          className="btn-remove" 
                          onClick={() => removeUserFromGroup(user.id)}
                        >
                          Entfernen
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {availableUsers.length > 0 && (
                <div className="member-section">
                  <h4>Benutzer hinzufügen</h4>
                  <div className="member-list">
                    {availableUsers.map(user => (
                      <div key={user.id} className="member-item">
                        <div className="member-info">
                          <span className="member-name">{user.username}</span>
                          <span className="member-email">{user.email}</span>
                        </div>
                        <button 
                          className="btn-add" 
                          onClick={() => addUserToGroup(user.id)}
                        >
                          Hinzufügen
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupManagement;
