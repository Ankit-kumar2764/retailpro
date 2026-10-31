import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL, apiError, authConfig } from '../utils/api';

const emptyProfile = { name: '', email: '' };
const emptySystem = { companyName: '', currency: 'USD', dateFormat: 'YYYY-MM-DD' };

function storedUser() {
  try {
    const value = JSON.parse(window.localStorage.getItem('retailpro_user') || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function Notice({ error, success }) {
  if (!error && !success) return null;
  return <div className={error ? 'api-error' : 'api-success'}>{error || success}</div>;
}

export default function Settings() {
  const [tab, setTab] = useState('Profile');
  const [profile, setProfile] = useState(emptyProfile);
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [system, setSystem] = useState(emptySystem);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [userForm, setUserForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentUser = storedUser();
  const isAdmin = currentUser.role === 'Admin';
  const notify = (message) => { setError(''); setSuccess(message); };
  const fail = (err, fallback) => { setSuccess(''); setError(apiError(err, fallback)); };

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/settings/profile`, authConfig()),
      axios.get(`${API_URL}/settings/system`, authConfig()),
      isAdmin ? axios.get(`${API_URL}/settings/users`, authConfig()) : Promise.resolve({ data: [] }),
      isAdmin ? axios.get(`${API_URL}/settings/roles`, authConfig()) : Promise.resolve({ data: [] }),
    ]).then(([profileResponse, systemResponse, usersResponse, rolesResponse]) => {
      setProfile(profileResponse.data.user);
      setSystem({ ...emptySystem, ...systemResponse.data });
      setUsers(usersResponse.data);
      setRoles(rolesResponse.data);
    }).catch((err) => fail(err, 'Unable to load settings.')).finally(() => setLoading(false));
  }, [isAdmin]);

  const updateProfile = async (event) => {
    event.preventDefault();
    try { const response = await axios.put(`${API_URL}/settings/profile`, profile, authConfig()); setProfile(response.data.user); window.localStorage.setItem('retailpro_user', JSON.stringify(response.data.user)); notify('Profile updated successfully.'); } catch (err) { fail(err, 'Unable to update profile.'); }
  };
  const updatePassword = async (event) => {
    event.preventDefault();
    if (password.newPassword !== password.confirmPassword) return setError('New passwords do not match.');
    try { await axios.put(`${API_URL}/settings/password`, password, authConfig()); setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' }); notify('Password changed. Please sign in again.'); } catch (err) { fail(err, 'Unable to change password.'); }
  };
  const updateSystem = async (event) => {
    event.preventDefault();
    try { const response = await axios.put(`${API_URL}/settings/system`, system, authConfig()); setSystem(response.data.settings); notify('System settings updated successfully.'); } catch (err) { fail(err, 'Unable to update system settings.'); }
  };
  const saveUser = async (event) => {
    event.preventDefault();
    try {
      const payload = { ...userForm };
      if (payload.id) await axios.put(`${API_URL}/settings/users/${payload.id}`, payload, authConfig());
      else await axios.post(`${API_URL}/settings/users`, payload, authConfig());
      const response = await axios.get(`${API_URL}/settings/users`, authConfig());
      setUsers(response.data); setUserForm(null); notify('User saved successfully.');
    } catch (err) { fail(err, 'Unable to save user.'); }
  };
  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this user?')) return;
    try { await axios.delete(`${API_URL}/settings/users/${id}`, authConfig()); setUsers(users.map((user) => user.id === id ? { ...user, isActive: false } : user)); notify('User deactivated.'); } catch (err) { fail(err, 'Unable to deactivate user.'); }
  };
  const logout = async () => {
    try { await axios.post(`${API_URL}/auth/logout`, {}, authConfig()); } catch (err) { /* token is still cleared locally */ }
    window.localStorage.removeItem('retailpro_token'); window.localStorage.removeItem('retailpro_user'); window.location.href = '/login';
  };

  if (loading) return <main className="main-content"><div className="panel table-message">Loading settings...</div></main>;
  return <main className="main-content settings-page">
    <div className="page-heading"><div><span className="eyebrow">Workspace</span><h1>Settings</h1><p>Manage your profile, users and system preferences.</p></div></div>
    <Notice error={error} success={success} />
    <div className="settings-layout">
      <nav className="panel settings-nav">{['Profile', 'Account', ...(isAdmin ? ['Users', 'Roles'] : []), 'System'].map((item) => <button className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setError(''); setSuccess(''); }} key={item}>{item}</button>)}<button className="settings-logout" onClick={logout}>Sign out</button></nav>
      <section className="panel settings-content">
        {tab === 'Profile' && <form onSubmit={updateProfile} className="settings-form"><h2>Profile settings</h2><p className="settings-help">Update the name and email shown across RetailPro.</p><label>Name<input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required /></label><label>Email<input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required /></label><button className="primary-btn" type="submit">Save profile</button></form>}
        {tab === 'Account' && <form onSubmit={updatePassword} className="settings-form"><h2>Account security</h2><p className="settings-help">Your current password is required before a new one can be saved.</p><label>Current password<input type="password" value={password.currentPassword} onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })} required /></label><label>New password<input type="password" minLength="8" value={password.newPassword} onChange={(e) => setPassword({ ...password, newPassword: e.target.value })} required /></label><label>Confirm new password<input type="password" minLength="8" value={password.confirmPassword} onChange={(e) => setPassword({ ...password, confirmPassword: e.target.value })} required /></label><button className="primary-btn" type="submit">Change password</button></form>}
        {tab === 'System' && <form onSubmit={updateSystem} className="settings-form"><h2>System settings</h2><p className="settings-help">These preferences apply to the workspace.</p><label>Company name<input value={system.companyName} onChange={(e) => setSystem({ ...system, companyName: e.target.value })} required /></label><label>Currency<select value={system.currency} onChange={(e) => setSystem({ ...system, currency: e.target.value })}><option>USD</option><option>EUR</option><option>GBP</option><option>INR</option></select></label><label>Date format<select value={system.dateFormat} onChange={(e) => setSystem({ ...system, dateFormat: e.target.value })}><option>YYYY-MM-DD</option><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option></select></label><button className="primary-btn" type="submit">Save system settings</button></form>}
        {tab === 'Roles' && <div className="settings-form"><h2>Role management</h2><p className="settings-help">Roles are fixed to protect the existing authorization model.</p><div className="role-list">{roles.map((role) => <div key={role.id}><strong>{role.name}</strong><span>{role.description || 'Standard workspace permissions.'}</span></div>)}</div></div>}
        {tab === 'Users' && <div className="settings-form"><div className="settings-title-row"><div><h2>User management</h2><p className="settings-help">Create, update or deactivate workspace users.</p></div><button className="primary-btn" onClick={() => setUserForm({ name: '', email: '', password: '', role: 'Staff', isActive: true })}>Add user</button></div><div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td>{user.role}</td><td><span className={`status ${user.isActive ? 'in-stock' : 'out-of-stock'}`}><i />{user.isActive ? 'Active' : 'Inactive'}</span></td><td><button className="text-btn" onClick={() => setUserForm({ ...user, password: '' })}>Edit</button>{user.isActive && <button className="text-btn danger-action" onClick={() => deactivate(user.id)}>Deactivate</button>}</td></tr>)}</tbody></table></div></div>}
      </section>
    </div>
    {userForm && <div className="modal-backdrop"><form className="product-modal settings-form" onSubmit={saveUser}><div className="modal-heading"><h2>{userForm.id ? 'Edit user' : 'Add user'}</h2><button type="button" className="icon-btn" onClick={() => setUserForm(null)}>×</button></div><label>Name<input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required /></label><label>Email<input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required /></label>{!userForm.id && <label>Password<input type="password" minLength="8" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required /></label>}<label>Role<select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>{roles.map((role) => <option key={role.id}>{role.name}</option>)}</select></label><label className="checkbox-label"><input type="checkbox" checked={userForm.isActive} onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })} /> Active</label><div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setUserForm(null)}>Cancel</button><button className="primary-btn" type="submit">Save user</button></div></form></div>}
  </main>;
}
