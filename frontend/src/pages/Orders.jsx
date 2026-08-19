/**
 * Orders / Point of Sale (POS) Page.
 * Handles creating new orders (POS) and viewing order history.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { menuAPI, ordersAPI } from '../services/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

const CATEGORIES = [
  { id: 'APPETIZER', label: 'Appetizers & Starters', shortLabel: 'Appetizers', emoji: '🥗', color: '#10b981' },
  { id: 'MAIN_COURSE', label: 'Main Course', shortLabel: 'Main Course', emoji: '🍛', color: '#f97316' },
  { id: 'DESSERT', label: 'Desserts & Sweets', shortLabel: 'Desserts', emoji: '🍰', color: '#ec4899' },
  { id: 'BEVERAGE', label: 'Beverages & Drinks', shortLabel: 'Beverages', emoji: '🥤', color: '#06b6d4' },
  { id: 'SNACK', label: 'Snacks & Street Food', shortLabel: 'Snacks', emoji: '🥟', color: '#eab308' },
];

export default function Orders() {
  const location = useLocation();
  const getInitialTab = () => {
    if (location.state?.tab) return location.state.tab;
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('tab') === 'history') return 'HISTORY';
    return 'POS';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab); // 'POS' or 'HISTORY'
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  // POS State
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === 'POS') fetchMenu();
    else fetchOrders();
  }, [activeTab, filterCategory, searchQuery]);

  const fetchMenu = async () => {
    setLoading(true);
    try {
      const params = { per_page: 100 };
      if (filterCategory) params.category = filterCategory;
      if (searchQuery) params.search = searchQuery;
      const res = await menuAPI.list(params);
      setMenuItems(res.data.items.filter(item => item.is_available));
    } catch (error) {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await ordersAPI.list();
      setOrders(res.data.orders);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // --- POS Logic ---
  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const tax = subtotal * 0.05; // 5% GST
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    setIsSubmitting(true);
    try {
      const payload = {
        notes: notes || null,
        discount_amount: 0,
        items: cart.map(i => ({ menu_item_id: i.id, quantity: i.qty }))
      };
      
      await ordersAPI.create(payload);
      toast.success('Order placed successfully!');
      
      // Reset POS
      setCart([]);
      setNotes('');
      // Optionally switch to history
      setActiveTab('HISTORY');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- History Logic ---
  const updateOrderStatus = async (id, status) => {
    try {
      await ordersAPI.updateStatus(id, { status });
      toast.success(`Order marked as ${status.replace('_', ' ')}`);
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getStatusBadgeClass = (status) => {
    const s = String(status).toLowerCase();
    switch (s) {
      case 'pending': return 'badge-warning';
      case 'preparing': return 'badge-info';
      case 'ready': return 'badge-primary';
      case 'delivered': return 'badge-success';
      case 'cancelled': return 'badge-danger';
      default: return 'badge-secondary';
    }
  };

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header & Tabs */}
      <div className="page-header" style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Orders & POS</h1>
            <p className="page-subtitle">Manage new orders and track history</p>
          </div>
          
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <button 
              className={`btn btn-sm ${activeTab === 'POS' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('POS')}
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <i className="bi bi-display"></i> Point of Sale
            </button>
            <button 
              className={`btn btn-sm ${activeTab === 'HISTORY' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('HISTORY')}
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <i className="bi bi-clock-history"></i> Order History
            </button>
          </div>
        </div>
      </div>

      {loading && activeTab === 'HISTORY' && <LoadingSpinner fullPage={false} message="Loading orders..." />}

      {/* Point of Sale View */}
      {activeTab === 'POS' && (
        <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>
          
          {/* Menu Selection Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="form-input-wrapper" style={{ flex: '1 1 200px', margin: 0, minWidth: '180px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search POS dishes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <i className="bi bi-search form-input-icon"></i>
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                <button
                  className={`btn btn-sm ${filterCategory === '' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setFilterCategory('')}
                  style={{ borderRadius: '16px', padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}
                >
                  All ({menuItems.length})
                </button>
                {CATEGORIES.map(c => {
                  const count = menuItems.filter(m => (m.category || '').toUpperCase() === c.id).length;
                  return (
                    <button
                      key={c.id}
                      className={`btn btn-sm ${filterCategory === c.id ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setFilterCategory(filterCategory === c.id ? '' : c.id)}
                      style={{ borderRadius: '16px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>{c.emoji}</span>
                      <span>{c.shortLabel}</span>
                      <span style={{ fontSize: '10px', opacity: 0.8 }}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              {loading ? (
                <LoadingSpinner />
              ) : menuItems.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <i className="bi bi-journal-x" style={{ fontSize: '36px' }}></i>
                  <p style={{ marginTop: '10px' }}>No dishes found matching your selection.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {(filterCategory ? CATEGORIES.filter(c => c.id === filterCategory) : CATEGORIES).map(cat => {
                    const catItems = menuItems.filter(item => (item.category || '').toUpperCase() === cat.id);
                    if (catItems.length === 0) return null;

                    return (
                      <div key={cat.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', paddingBottom: '6px', borderBottom: `2px solid ${cat.color}33` }}>
                          <span style={{ fontSize: '18px' }}>{cat.emoji}</span>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {cat.label}
                          </h4>
                          <span className="badge" style={{ fontSize: '10px', background: `${cat.color}22`, color: cat.color, fontWeight: 700 }}>
                            {catItems.length}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                          {catItems.map(item => (
                            <div 
                              key={item.id} 
                              className="card" 
                              style={{ 
                                padding: '10px', 
                                cursor: 'pointer', 
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
                                border: '1px solid var(--border-subtle)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                borderRadius: 'var(--radius-sm)'
                              }}
                              onClick={() => addToCart(item)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <div style={{ 
                                height: '100px', 
                                borderRadius: 'var(--radius-sm)', 
                                overflow: 'hidden', 
                                marginBottom: '8px',
                                background: 'var(--bg-elevated)',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {item.image_url ? (
                                  <img 
                                    src={item.image_url} 
                                    alt={item.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                                  color: 'var(--text-muted)'
                                }}>
                                  <span style={{ fontSize: '24px' }}>{cat.emoji}</span>
                                </div>

                                {item.is_vegetarian && (
                                  <span style={{ 
                                    position: 'absolute', 
                                    top: '6px', 
                                    right: '6px', 
                                    background: 'rgba(16, 185, 129, 0.9)', 
                                    backdropFilter: 'blur(4px)',
                                    color: '#fff', 
                                    fontSize: '9px', 
                                    fontWeight: 700, 
                                    padding: '2px 5px', 
                                    borderRadius: '3px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    Veg
                                  </span>
                                )}
                              </div>

                              <div>
                                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.name}>
                                  {item.name}
                                </h4>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: '14px' }}>₹{Number(item.price).toFixed(2)}</span>
                                  <span style={{ fontSize: '10px', color: cat.color, fontWeight: 600 }}>{cat.shortLabel}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Cart Area */}
          <div className="card" style={{ width: '380px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Current Order ({cart.reduce((s, i) => s + i.qty, 0)})</h3>
              {cart.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setCart([]); setNotes(''); }} style={{ color: 'var(--color-danger)', fontSize: '12px', padding: '2px 8px' }}>
                  <i className="bi bi-trash" style={{ marginRight: '4px' }}></i> Clear
                </button>
              )}
            </div>

            {/* Cart Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
                  <i className="bi bi-cart-x" style={{ fontSize: '48px' }}></i>
                  <p style={{ marginTop: '8px' }}>Cart is empty</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Click on menu items to add to order</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {cart.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ flex: 1, paddingRight: '8px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{item.name}</p>
                        <p style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 700, margin: 0 }}>₹{item.price} x {item.qty} = ₹{(item.price * item.qty).toFixed(2)}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', background: 'var(--bg-base)' }} onClick={() => updateCartQty(item.id, -1)}>-</button>
                        <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{item.qty}</span>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', background: 'var(--bg-base)' }} onClick={() => updateCartQty(item.id, 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkout Form */}
            <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Table / Order Notes
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Table 3, takeaway, extra spicy..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ fontSize: '12px', padding: '6px 10px', margin: 0 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>GST (5%)</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)' }}>
                <span>Total Amount</span>
                <span>₹{total.toFixed(2)}</span>
              </div>

              <button 
                className={`btn btn-primary btn-block ${isSubmitting ? 'btn-loading' : ''}`} 
                onClick={handleCheckout}
                disabled={cart.length === 0 || isSubmitting}
                style={{ height: '48px', fontSize: '15px', fontWeight: 700 }}
              >
                {isSubmitting ? <span className="btn-spinner"></span> : <><i className="bi bi-credit-card-fill" style={{ marginRight: '6px' }}></i> Place Order (₹{total.toFixed(2)})</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order History View */}
      {activeTab === 'HISTORY' && (
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date & Time</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 700 }}>#{order.id}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{new Date(order.created_at).toLocaleString()}</td>
                     <td>
                       <div style={{ fontWeight: 600 }}>{order.items?.length || 0} items</div>
                       <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '220px', lineHeight: '1.4' }}>
                         {order.items?.map(item => `${item.quantity}x ${item.item_name || (item.menu_item?.name) || `Dish #${item.menu_item_id}`}`).join(', ')}
                       </div>
                     </td>
                    <td style={{ fontWeight: 700 }}>₹{Number(order.total_amount || 0).toFixed(2)}</td>
                    <td><span className={`badge ${getStatusBadgeClass(order.status)}`}>{order.status}</span></td>
                    <td>
                      <div className="dropdown" style={{ display: 'inline-block' }}>
                        <select 
                          className="form-input" 
                          style={{ padding: '4px 28px 4px 8px', fontSize: '12px', height: 'auto', background: 'var(--bg-base)' }}
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="preparing">Preparing</option>
                          <option value="ready">Ready</option>
                          <option value="delivered">Delivered / Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && !loading && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                      <i className="bi bi-inbox text-muted" style={{ fontSize: '32px', display: 'block' }}></i>
                      No orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
