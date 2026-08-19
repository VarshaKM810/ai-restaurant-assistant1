/**
 * Navbar — Top navigation bar with search, notifications, theme toggle,
 * user profile dropdown, and sidebar collapse toggle.
 */

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Navbar({ collapsed, onToggle, theme, onThemeToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  // Mock notifications
  const notifications = [
    { id: 1, type: 'warning', text: 'Tomatoes stock is low (3 kg)', time: '2 min ago', icon: 'bi-exclamation-triangle-fill' },
    { id: 2, type: 'success', text: 'New order #1042 received', time: '5 min ago', icon: 'bi-bag-check-fill' },
    { id: 3, type: 'info', text: 'Weekly report is ready', time: '1 hr ago', icon: 'bi-file-earmark-check-fill' },
    { id: 4, type: 'danger', text: 'Onions expire in 2 days', time: '2 hr ago', icon: 'bi-calendar-x-fill' },
  ];

  const notifColors = {
    warning: 'var(--color-warning)',
    success: 'var(--color-success)',
    info: 'var(--color-info)',
    danger: 'var(--color-danger)',
  };

  return (
    <header
      className={`navbar ${collapsed ? 'sidebar-collapsed' : ''}`}
      id="main-navbar"
      role="banner"
    >
      {/* Left — Toggle + Search */}
      <div className="navbar-left">
        <button
          id="sidebar-toggle-btn"
          className="navbar-toggle"
          onClick={onToggle}
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
        >
          <i className={`bi bi-${collapsed ? 'layout-sidebar' : 'layout-sidebar-inset'}`}></i>
        </button>

        {/* Search */}
        <div className="navbar-search">
          <i className="bi bi-search" style={{ color: 'var(--text-muted)', fontSize: '14px' }}></i>
          <input
            id="navbar-search-input"
            type="text"
            placeholder="Search orders, items, customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
            >
              <i className="bi bi-x-circle-fill"></i>
            </button>
          )}
        </div>
      </div>

      {/* Right — Actions */}
      <div className="navbar-right">
        {/* Quick Place Order Button */}
        {user?.role === 'customer' ? (
          <Link
            to="/customer/cart"
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', borderRadius: '16px', textDecoration: 'none' }}
            title="View Cart & Place Order"
          >
            <i className="bi bi-cart-fill"></i>
            <span>Place Order / Cart</span>
          </Link>
        ) : (
          <Link
            to="/admin/orders"
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', borderRadius: '16px', textDecoration: 'none' }}
            title="Open POS to Create Order"
          >
            <i className="bi bi-cart-plus-fill"></i>
            <span>Place Order (POS)</span>
          </Link>
        )}

        {/* Switch View Button for Admins */}
        {user?.role !== 'customer' && (
          location.pathname.startsWith('/customer') ? (
            <Link
              to="/admin/dashboard"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', borderRadius: '16px', textDecoration: 'none' }}
              title="Return to Admin Dashboard"
            >
              <i className="bi bi-shield-fill" style={{ color: 'var(--color-primary)' }}></i>
              <span>Admin View</span>
            </Link>
          ) : (
            <Link
              to="/customer/dashboard"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', borderRadius: '16px', textDecoration: 'none' }}
              title="Switch to Customer Dashboard"
            >
              <i className="bi bi-shop-window" style={{ color: 'var(--color-primary)' }}></i>
              <span>Customer View</span>
            </Link>
          )
        )}

        {/* Theme Toggle */}
        <button
          id="theme-toggle-btn"
          className="theme-toggle"
          onClick={onThemeToggle}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          <i className={`bi bi-${theme === 'dark' ? 'sun-fill' : 'moon-fill'}`}></i>
        </button>

        {/* AI Assistant Quick Access */}
        <Link
          to="/ai-assistant"
          id="ai-assistant-nav-btn"
          className="navbar-icon-btn"
          title="AI Knowledge Assistant"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <i className="bi bi-robot"></i>
        </Link>

        {/* Notifications */}
        <div className="dropdown" ref={notifRef}>
          <button
            id="notifications-btn"
            className="navbar-icon-btn"
            onClick={() => setShowNotifications((p) => !p)}
            title="Notifications"
            aria-label="Notifications"
          >
            <i className="bi bi-bell-fill"></i>
            <span className="notification-dot"></span>
          </button>

          {showNotifications && (
            <div className="dropdown-menu" style={{ width: '320px', right: '0' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>Notifications</span>
                <span style={{ fontSize: '11px', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}>Mark all read</span>
              </div>
              {notifications.map((notif) => (
                <div key={notif.id} className="dropdown-item" style={{ alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: `${notifColors[notif.type]}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: notifColors[notif.type], fontSize: '14px',
                  }}>
                    <i className={`bi ${notif.icon}`}></i>
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '2px' }}>{notif.text}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{notif.time}</p>
                  </div>
                </div>
              ))}
              <div style={{ padding: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                <button className="btn btn-ghost btn-sm btn-block">View all notifications</button>
              </div>
            </div>
          )}
        </div>

        {/* Profile Menu */}
        <div className="dropdown" ref={profileRef}>
          <div
            id="profile-menu-btn"
            className="navbar-profile"
            onClick={() => setShowProfileMenu((p) => !p)}
            role="button"
            tabIndex={0}
            aria-expanded={showProfileMenu}
            aria-haspopup="true"
            onKeyDown={(e) => e.key === 'Enter' && setShowProfileMenu((p) => !p)}
          >
            <div className="navbar-avatar">{initials}</div>
            <div className="navbar-user-info">
              <span className="navbar-user-name">{user?.full_name?.split(' ')[0] || 'User'}</span>
              <span className="navbar-user-role">{user?.role || 'staff'}</span>
            </div>
            <i className="bi bi-chevron-down" style={{ fontSize: '12px', color: 'var(--text-muted)' }}></i>
          </div>

          {showProfileMenu && (
            <div className="dropdown-menu" id="profile-dropdown">
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
              }}>
                <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>{user?.full_name}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.email}</p>
              </div>

              <Link to="/profile" className="dropdown-item" onClick={() => setShowProfileMenu(false)}>
                <i className="bi bi-person-circle"></i> My Profile
              </Link>
              <Link to="/settings" className="dropdown-item" onClick={() => setShowProfileMenu(false)}>
                <i className="bi bi-gear-fill"></i> Settings
              </Link>
              <Link to="/ai-assistant" className="dropdown-item" onClick={() => setShowProfileMenu(false)}>
                <i className="bi bi-robot"></i> AI Assistant
              </Link>

              <div className="dropdown-divider"></div>

              <button className="dropdown-item danger" onClick={handleLogout} id="logout-btn">
                <i className="bi bi-box-arrow-right"></i> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
