import React, { useState, useEffect } from 'react';
import { useDialog } from '../contexts/DialogContext';
import './UserManagement.css';

interface Group {
  id: string;
  name: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  updatedAt?: string;
}

interface UserWithGroups extends User {
  groups?: Group[];
}

const UserManagement: React.FC = () => {
  const { showAlert, showConfirm } = useDialog();
  const [users, setUsers] = useState<UserWithGroups[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithGroups | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithGroups | null>(null);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    fetchUsers();
    fetchGroups();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      
      // Fetch groups for each user
      const usersWithGroups = await Promise.all(
        data.map(async (user: User) => {
          try {
            const groupsResponse = await fetch('http://localhost:5001/api/groups');
            const allGroups = await groupsResponse.json();
            const userGroups = allGroups.filter((group: any) => 
              group.users.some((u: User) => u.id === user.id)
            ).map((g: any) => ({ id: g.id, name: g.name }));
            return { ...user, groups: userGroups };
          } catch {
            return { ...user, groups: [] };
          }
        })
      );
      
      setUsers(usersWithGroups);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/groups');
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      setGroups(data.map((g: any) => ({ id: g.id, name: g.name })));
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingUser 
        ? `http://localhost:5001/api/users/${editingUser.id}`
        : 'http://localhost:5001/api/users';
      
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
      showAlert('Fehler', err instanceof Error ? err.message : 'Failed to save user', '❌');
    }
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('Löschen', 'Benutzer wirklich löschen?', '🗑️')) return;
    
    try {
      const response = await fetch(`http://localhost:5001/api/users/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete user');
      
      fetchUsers();
    } catch (err) {
      showAlert('Fehler', err instanceof Error ? err.message : 'Failed to delete user', '❌');
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

  const openGroupDialog = (user: UserWithGroups) => {
    setSelectedUser(user);
    setShowGroupDialog(true);
  };

  const addUserToGroup = async (groupId: string) => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`http://localhost:5001/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add user to group');
      }

      fetchUsers();
    } catch (err) {
      showAlert('Fehler', err instanceof Error ? err.message : 'Failed to add user to group', '❌');
    }
  };

  const removeUserFromGroup = async (groupId: string) => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`http://localhost:5001/api/groups/${groupId}/members/${selectedUser.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove user from group');

      fetchUsers();
      // Update selected user
      const updatedUser = users.find(u => u.id === selectedUser.id);
      if (updatedUser) setSelectedUser(updatedUser);
    } catch (err) {
      showAlert('Fehler', err instanceof Error ? err.message : 'Failed to remove user from group', '❌');
    }
  };

  const availableGroups = groups.filter(
    group => !selectedUser?.groups?.some(g => g.id === group.id)
  );

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
              <th>Gruppen</th>
              <th>Erstellt am</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="no-users">
                  Keine Benutzer vorhanden
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    <button 
                      className="btn-groups" 
                      onClick={() => openGroupDialog(user)}
                    >
                      👨‍👩‍👧‍👦 {user.groups?.length || 0}
                    </button>
                  </td>
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

      {showGroupDialog && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowGroupDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Gruppen für "{selectedUser.username}"</h3>
              <button className="modal-close" onClick={() => setShowGroupDialog(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="member-section">
                <h4>Aktuelle Gruppen ({selectedUser.groups?.length || 0})</h4>
                <div className="member-list">
                  {!selectedUser.groups || selectedUser.groups.length === 0 ? (
                    <p className="no-members">Keine Gruppenzugehörigkeit</p>
                  ) : (
                    selectedUser.groups.map(group => (
                      <div key={group.id} className="member-item">
                        <div className="member-info">
                          <span className="member-name">{group.name}</span>
                        </div>
                        <button 
                          className="btn-remove" 
                          onClick={() => removeUserFromGroup(group.id)}
                        >
                          Entfernen
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {availableGroups.length > 0 && (
                <div className="member-section">
                  <h4>Zu Gruppe hinzufügen</h4>
                  <div className="member-list">
                    {availableGroups.map(group => (
                      <div key={group.id} className="member-item">
                        <div className="member-info">
                          <span className="member-name">{group.name}</span>
                        </div>
                        <button 
                          className="btn-add" 
                          onClick={() => addUserToGroup(group.id)}
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

export default UserManagement;
