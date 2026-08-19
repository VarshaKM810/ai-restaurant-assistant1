/**
 * Menu Management Page — Displays, adds, and edits food items.
 * Categorized into distinct sections: Appetizers, Main Course, Desserts, Beverages, and Snacks.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { menuAPI } from '../services/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

const CATEGORIES = [
  { id: 'APPETIZER', label: 'Appetizers & Starters', shortLabel: 'Appetizers', emoji: '🥗', icon: 'bi-egg-fried', color: '#10b981', desc: 'Crispy bites, tandoori starters & savory platters' },
  { id: 'MAIN_COURSE', label: 'Main Course', shortLabel: 'Main Course', emoji: '🍛', icon: 'bi-fire', color: '#f97316', desc: 'Rich curries, biryanis, dal, gravies & fresh breads' },
  { id: 'DESSERT', label: 'Desserts & Sweets', shortLabel: 'Desserts', emoji: '🍰', icon: 'bi-cake2', color: '#ec4899', desc: 'Traditional Indian mithai, halwa & chilled sweets' },
  { id: 'BEVERAGE', label: 'Beverages & Drinks', shortLabel: 'Beverages', emoji: '🥤', icon: 'bi-cup-straw', color: '#06b6d4', desc: 'Refreshing lassis, cooling drinks, teas & coffees' },
  { id: 'SNACK', label: 'Snacks & Street Food', shortLabel: 'Snacks', emoji: '🥟', icon: 'bi-bag-heart', color: '#eab308', desc: 'Authentic chaats, crispy snacks & street favorites' },
];

export default function Menu() {
  const { user } = useAuth();
  const isManager = ['admin', 'manager'].includes(user?.role);
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '', description: '', category: 'MAIN_COURSE',
    price: '', cost_price: '', image_url: '', is_available: true,
    is_vegetarian: false, calories: '', preparation_time: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      // Fetch all items (up to 100) so we can group them neatly into sections
      const res = await menuAPI.list({ per_page: 100 });
      setItems(res.data?.items || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load menu items');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name, description: item.description || '', category: (item.category || 'MAIN_COURSE').toUpperCase(),
        price: item.price, cost_price: item.cost_price || '', image_url: item.image_url || '',
        is_available: item.is_available, is_vegetarian: item.is_vegetarian,
        calories: item.calories || '', preparation_time: item.preparation_time || ''
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '', description: '', category: activeCategory !== 'ALL' ? activeCategory : 'MAIN_COURSE',
        price: '', cost_price: '', image_url: '', is_available: true,
        is_vegetarian: false, calories: '', preparation_time: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    const payload = {
      ...formData,
      category: formData.category.toLowerCase(),
      image_url: formData.image_url?.trim() || null,
      price: parseFloat(formData.price),
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
      calories: formData.calories ? parseInt(formData.calories) : null,
      preparation_time: formData.preparation_time ? parseInt(formData.preparation_time) : null,
    };

    try {
      if (editingItem) {
        await menuAPI.update(editingItem.id, payload);
        toast.success('Menu item updated!');
      } else {
        await menuAPI.create(payload);
        toast.success('Menu item created!');
      }
      closeModal();
      fetchMenu();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || 'Failed to save item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await menuAPI.delete(id);
      toast.success('Item deleted');
      fetchMenu();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete item');
    }
  };

  // Helper to normalize category key
  const normalizeCat = (cat) => (cat || '').toUpperCase();

  // Filter items by search query
  const searchedItems = items.filter(item => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      (item.description && item.description.toLowerCase().includes(query)) ||
      (item.category && item.category.toLowerCase().includes(query))
    );
  });

  // Calculate live counts per category from all items
  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = items.filter(item => normalizeCat(item.category) === cat.id).length;
    return acc;
  }, {});

  // Group searched items into categories to display in divided sections
  const visibleCategories = activeCategory === 'ALL'
    ? CATEGORIES
    : CATEGORIES.filter(cat => cat.id === activeCategory);

  if (loading && items.length === 0) return <LoadingSpinner fullPage={false} message="Loading menu items..." />;

  return (
    <div className="fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* ─── Page Header ────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🍽️</span> Food Menu Management
            </h1>
            <p className="page-subtitle">Organized by Appetizers, Main Course, Desserts, Beverages & Snacks</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/admin/orders" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="bi bi-cart-plus-fill"></i> Create Order (POS)
            </Link>
            {isManager && (
              <button className="btn btn-primary" onClick={() => openModal()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="bi bi-plus-lg"></i> Add New Dish
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Search & Category Division Filter Bar ─────────────────── */}
      <div className="card" style={{ marginBottom: '28px', padding: '16px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Search Box */}
          <div className="form-input-wrapper" style={{ flex: '1 1 260px', margin: 0, minWidth: '220px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search dishes by name, ingredient, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <i className="bi bi-search form-input-icon"></i>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <i className="bi bi-x-circle-fill"></i>
              </button>
            )}
          </div>

          {/* Category Division Pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              className={`btn btn-sm ${activeCategory === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveCategory('ALL')}
              style={{ borderRadius: '20px', fontWeight: 700, padding: '6px 14px' }}
            >
              All Items ({items.length})
            </button>

            {CATEGORIES.map(cat => (
              <button 
                key={cat.id}
                className={`btn btn-sm ${activeCategory === cat.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveCategory(cat.id)}
                style={{ 
                  borderRadius: '20px', 
                  fontWeight: 600, 
                  padding: '6px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{cat.emoji}</span>
                <span>{cat.shortLabel}</span>
                <span style={{ 
                  fontSize: '11px', 
                  opacity: 0.85, 
                  background: activeCategory === cat.id ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}>
                  {categoryCounts[cat.id] || 0}
                </span>
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ─── Divided Category Sections ───────────────────────────── */}
      {searchedItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: 'var(--radius-md)' }}>
          <i className="bi bi-journal-x" style={{ fontSize: '48px', color: 'var(--text-muted)' }}></i>
          <h3 style={{ marginTop: '16px' }}>No matching dishes found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Try adjusting your search keyword or clearing the filters.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearchQuery(''); setActiveCategory('ALL'); }} style={{ marginTop: '12px' }}>
            Show All Dishes
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
          {visibleCategories.map(cat => {
            const catItems = searchedItems.filter(item => normalizeCat(item.category) === cat.id);
            
            // Skip empty categories if searching
            if (catItems.length === 0 && searchQuery) return null;

            return (
              <section key={cat.id} id={`category-${cat.id}`} className="menu-category-section">
                
                {/* Category Section Header Banner */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  padding: '14px 20px',
                  marginBottom: '18px',
                  background: 'var(--bg-elevated)',
                  borderLeft: `5px solid ${cat.color}`,
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '24px' }}>{cat.emoji}</span>
                      <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                        {cat.label}
                      </h2>
                      <span className="badge" style={{ 
                        background: `${cat.color}22`, 
                        color: cat.color, 
                        border: `1px solid ${cat.color}44`,
                        fontWeight: 700,
                        fontSize: '12px',
                        padding: '3px 10px'
                      }}>
                        {catItems.length} {catItems.length === 1 ? 'Dish' : 'Dishes'}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0 34px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {cat.desc}
                    </p>
                  </div>

                  {isManager && (
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => {
                        setFormData({
                          name: '', description: '', category: cat.id,
                          price: '', cost_price: '', image_url: '', is_available: true,
                          is_vegetarian: false, calories: '', preparation_time: ''
                        });
                        setEditingItem(null);
                        setIsModalOpen(true);
                      }}
                      style={{ color: cat.color, fontSize: '12px' }}
                    >
                      <i className="bi bi-plus-circle" style={{ marginRight: '4px' }}></i> Add to {cat.shortLabel}
                    </button>
                  )}
                </div>

                {/* Items Grid for this specific Category */}
                {catItems.length === 0 ? (
                  <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ margin: 0, fontSize: '14px' }}>No dishes currently in {cat.label}.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {catItems.map(item => (
                      <div 
                        key={item.id} 
                        className="card" 
                        style={{ 
                          padding: 0, 
                          overflow: 'hidden', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      >
                        {/* Food Image Container */}
                        <div style={{ 
                          height: '170px', 
                          position: 'relative',
                          overflow: 'hidden',
                          background: 'var(--bg-elevated)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {item.image_url ? (
                            <img 
                              src={item.image_url} 
                              alt={item.name}
                              style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover',
                                transition: 'transform 0.3s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.06)'}
                              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextElementSibling) {
                                  e.currentTarget.nextElementSibling.style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          
                          <div style={{ 
                            display: item.image_url ? 'none' : 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: '6px',
                            color: 'var(--text-muted)'
                          }}>
                            <span style={{ fontSize: '32px' }}>{cat.emoji}</span>
                            <span style={{ fontSize: '11px', fontWeight: 600 }}>{item.name}</span>
                          </div>

                          {/* Floating Status Badges */}
                          <div style={{ 
                            position: 'absolute', 
                            top: '10px', 
                            right: '10px', 
                            display: 'flex', 
                            gap: '6px', 
                            zIndex: 2 
                          }}>
                            {item.is_vegetarian && (
                              <span className="badge" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)', background: 'rgba(16, 185, 129, 0.95)', color: '#fff', fontWeight: 700, fontSize: '11px', padding: '3px 8px' }}>
                                <i className="bi bi-circle-fill" style={{ fontSize: '7px', marginRight: '4px' }}></i> Veg
                              </span>
                            )}
                            {!item.is_available && (
                              <span className="badge badge-danger" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)', background: 'rgba(239, 68, 68, 0.95)', color: '#fff', fontWeight: 700, fontSize: '11px', padding: '3px 8px' }}>
                                Out of Stock
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Food Details & Pricing */}
                        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {item.name}
                            </h3>
                            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                              ₹{Number(item.price).toFixed(2)}
                            </span>
                          </div>

                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                            {item.description || 'Delicious freshly prepared specialty.'}
                          </p>
                          
                          {/* Footer Info & Manager Controls */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              color: cat.color,
                              background: `${cat.color}15`,
                              padding: '2px 8px',
                              borderRadius: '4px'
                            }}>
                              {cat.shortLabel}
                            </span>
                            
                            {isManager && (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="navbar-icon-btn" onClick={() => openModal(item)} style={{ width: '30px', height: '30px' }} title="Edit Dish">
                                  <i className="bi bi-pencil" style={{ fontSize: '13px' }}></i>
                                </button>
                                <button className="navbar-icon-btn" onClick={() => handleDelete(item.id)} style={{ width: '30px', height: '30px', color: 'var(--color-danger)' }} title="Delete Dish">
                                  <i className="bi bi-trash" style={{ fontSize: '13px' }}></i>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </section>
            );
          })}
        </div>
      )}

      {/* ─── Add / Edit Dish Modal ───────────────────────────────── */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)', padding: '20px'
        }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
              <button className="navbar-icon-btn" onClick={closeModal}><i className="bi bi-x-lg"></i></button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Item Name *</label>
                  <input type="text" className="form-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Butter Chicken" />
                </div>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select className="form-input" required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Describe dish ingredients, flavor, and serving size..."></textarea>
              </div>

              {/* Image URL & Live Preview */}
              <div className="form-group">
                <label className="form-label">Dish Image URL (e.g. /images/menu/dish-name.jpg or web URL)</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="/images/menu/butter-chicken.jpg or https://..." 
                    value={formData.image_url} 
                    onChange={e => setFormData({...formData, image_url: e.target.value})} 
                    style={{ flex: 1 }}
                  />
                  {formData.image_url && (
                    <div style={{ 
                      width: '48px', 
                      height: '48px', 
                      borderRadius: 'var(--radius-sm)', 
                      overflow: 'hidden', 
                      flexShrink: 0,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-elevated)'
                    }}>
                      <img 
                        src={formData.image_url} 
                        alt="Preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => e.currentTarget.style.opacity = '0.3'}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Selling Price (₹) *</label>
                  <input type="number" step="0.01" min="0" className="form-input" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="350.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost Price (₹)</label>
                  <input type="number" step="0.01" min="0" className="form-input" value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: e.target.value})} placeholder="150.00" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Calories (kcal)</label>
                  <input type="number" min="0" className="form-input" value={formData.calories} onChange={e => setFormData({...formData, calories: e.target.value})} placeholder="450" />
                </div>
                <div className="form-group">
                  <label className="form-label">Prep Time (mins)</label>
                  <input type="number" min="0" className="form-input" value={formData.preparation_time} onChange={e => setFormData({...formData, preparation_time: e.target.value})} placeholder="15" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px', padding: '12px 16px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                  <input type="checkbox" checked={formData.is_vegetarian} onChange={e => setFormData({...formData, is_vegetarian: e.target.checked})} style={{ width: '16px', height: '16px', accentColor: 'var(--color-success)' }} />
                  Vegetarian 🟢
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                  <input type="checkbox" checked={formData.is_available} onChange={e => setFormData({...formData, is_available: e.target.checked})} style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }} />
                  Available in Stock
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className={`btn btn-primary ${isSaving ? 'btn-loading' : ''}`} disabled={isSaving}>
                  {isSaving ? <span className="btn-spinner"></span> : <i className="bi bi-check-lg"></i>}
                  {editingItem ? 'Save Changes' : 'Create Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
