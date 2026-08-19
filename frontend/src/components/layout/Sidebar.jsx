/**
 * Sidebar — Premium collapsible navigation sidebar.
 * Features: animated collapse, active route highlighting, role-based menu,
 * badge counts, section groups, and smooth hover effects.
 */

import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Navigation configurations for each role
const ADMIN_NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { path: '/admin/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { path: '/admin/orders', label: 'Place Order (POS)', icon: 'bi-cart-check-fill' },
      { path: '/admin/menu', label: 'Menu Management', icon: 'bi-journal-richtext' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { path: '/admin/reviews', label: 'Reviews', icon: 'bi-star-fill' },
      { path: '/admin/analytics', label: 'Sales & Trends', icon: 'bi-bar-chart-fill' },
      { path: '/admin/food-waste', label: 'Sustainable Food Waste', icon: 'bi-recycle' },
    ],
  },
  {
    title: 'AI Features',
    items: [
      { path: '/admin/ai', label: 'AI Assistant', icon: 'bi-robot', badge: 'new' },
    ],
  },
];

const CUSTOMER_NAV_SECTIONS = [
  {
    title: 'Customer Portal',
    items: [
      { path: '/customer/dashboard', label: 'Home & Overview', icon: 'bi-house-fill' },
      { path: '/customer/menu', label: 'Explore Menu', icon: 'bi-journal-richtext' },
      { path: '/customer/cart', label: 'Place Order / Cart', icon: 'bi-cart-fill' },
      { path: '/customer/orders', label: 'My Orders', icon: 'bi-clock-history' },
      { path: '/customer/reviews', label: 'Reviews', icon: 'bi-star-fill' },
      { path: '/customer/profile', label: 'Profile', icon: 'bi-person-circle' },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth();
  const location = useLocation();
  const userRole = user?.role || 'customer';

  const filteredSections = userRole === 'customer' ? CUSTOMER_NAV_SECTIONS : ADMIN_NAV_SECTIONS;

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} id="main-sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🍽️</div>
        <span className="sidebar-logo-name">RestaurantAI</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {filteredSections.map((section, sectionIdx) => (
          <div key={sectionIdx}>
            <div className="sidebar-section-title">{section.title}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                id={`sidebar-${item.path.replace('/', '')}`}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
                title={collapsed ? item.label : ''}
              >
                <span className="sidebar-nav-icon">
                  <i className={`bi ${item.icon}`}></i>
                </span>
                <span className="sidebar-nav-label">{item.label}</span>
                {item.badge && (
                  <span
                    className="sidebar-badge"
                    style={{
                      background: item.badge === 'new'
                        ? 'var(--color-secondary)'
                        : 'var(--color-danger)',
                    }}
                  >
                    {item.badge === 'new' ? 'NEW' : '!'}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer — User Info */}
      <div className="sidebar-footer">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(249, 115, 22, 0.06)',
          border: '1px solid rgba(249, 115, 22, 0.12)',
        }}>
          <div style={{
            width: '36px', height: '36px',
            borderRadius: '50%',
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 700, color: 'white',
            flexShrink: 0,
          }}>
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.full_name || 'User'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 500, textTransform: 'capitalize' }}>
                {userRole}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
