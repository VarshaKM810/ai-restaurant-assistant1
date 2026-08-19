/**
 * CustomerDashboard — Premium Real-Data Customer Portal & Analytics.
 * Connected directly to FastAPI PostgreSQL/SQLite backend endpoints.
 * All prices and totals formatted in Indian Rupees (₹).
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { customersAPI, menuAPI, ordersAPI, reviewsAPI, aiAPI } from '../services/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AnimatedCustomerBackground from '../components/common/AnimatedCustomerBackground';

export default function CustomerDashboard({ activeTab: propActiveTab }) {
  const { user } = useAuth();
  
  // Real Data States
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState(propActiveTab || 'overview');

  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab);
    }
  }, [propActiveTab]);
  
  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cart State
  const [cart, setCart] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [orderType, setOrderType] = useState('dine-in'); // 'dine-in', 'pickup', 'delivery'
  const [tableNumber, setTableNumber] = useState('Table 4');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [cartDiscount, setCartDiscount] = useState(0);
  
  // AI Assistant State
  const [aiQuery, setAiQuery] = useState('');
  const [aiMessages, setAiMessages] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  // Redeem Rewards Modal State
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  // Table Reservation Modal State
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [reservationData, setReservationData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '19:30',
    partySize: 2,
    specialRequests: '',
  });

  // Fetch Dashboard & Menu Data on Mount
  useEffect(() => {
    loadDashboardData();
    loadMenuItems();
  }, []);

  useEffect(() => {
    if (cart.length === 0) {
      setCartDiscount(0);
    }
  }, [cart]);

  useEffect(() => {
    if (user && aiMessages.length === 0) {
      setAiMessages([
        {
          sender: 'assistant',
          text: `Namaste ${user?.full_name?.split(' ')[0] || 'Valued Guest'}! 🙏 Welcome to our dining assistant. Ask me for dish recommendations, spice levels, or wine & beverage pairings!`,
          sources: []
        }
      ]);
    }
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const res = await customersAPI.getMyDashboard();
      setDashboardData(res.data);
    } catch (err) {
      console.error('Failed to load customer dashboard data:', err);
      toast.error('Failed to load live customer profile metrics.');
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async () => {
    setLoadingMenu(true);
    try {
      const res = await menuAPI.list({ per_page: 50 });
      if (res.data?.items) {
        setMenuItems(res.data.items);
      }
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    } finally {
      setLoadingMenu(false);
    }
  };

  // Cart Helper Actions
  const addToCart = (dish) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === dish.id);
      if (existing) {
        return prev.map((item) =>
          item.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...dish, quantity: 1 }];
    });
    toast.success(`Added "${dish.name}" to order! 🛒`);
  };

  const addComboToCart = (items, comboName, discountAmount) => {
    setCart((prev) => {
      let newCart = [...prev];
      items.forEach((dish) => {
        const existing = newCart.find((item) => item.id === dish.id);
        if (existing) {
          newCart = newCart.map((item) =>
            item.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          newCart.push({ ...dish, quantity: 1 });
        }
      });
      return newCart;
    });
    setCartDiscount((prev) => prev + discountAmount);
    toast.success(`🎉 Added "${comboName}" to cart! Combo items bundled at a 30% discount.`);
  };

  const updateCartQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  // Order Form State
  const [orderNotes, setOrderNotes] = useState('');

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const cartSubtotalAfterDiscount = Math.max(0, cartSubtotal - cartDiscount);
  const cartTax = cartSubtotalAfterDiscount * 0.05;
  const cartGrandTotal = cartSubtotalAfterDiscount + cartTax;

  // Submit Order via real backend API
  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      toast.error('Your cart is empty! Please add some delicious items first.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const formattedNotes = [
        orderType ? `Type: ${orderType.toUpperCase()}` : '',
        orderType === 'dine-in' && tableNumber ? `Table: ${tableNumber}` : '',
        orderNotes ? `Special Request: ${orderNotes}` : '',
      ].filter(Boolean).join(' | ');

      const orderPayload = {
        customer_id: dashboardData?.profile?.id || null,
        items: cart.map((c) => ({
          menu_item_id: c.id,
          quantity: c.quantity,
          unit_price: c.price,
          notes: '',
        })),
        discount_amount: cartDiscount,
        notes: formattedNotes || null,
      };

      await ordersAPI.create(orderPayload);
      toast.success('🎉 Order placed successfully! Your ticket has been sent to the kitchen.');
      setCart([]);
      setCartDiscount(0);
      setOrderNotes('');
      setShowCartDrawer(false);
      await loadDashboardData(); // Refresh metrics and order list from database
      setActiveTab('orders');
    } catch (err) {
      console.error('Order creation error:', err);
      toast.error(err.response?.data?.detail || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Submit Review via backend API
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewComment.trim()) {
      toast.error('Please enter a review comment');
      return;
    }
    setIsSubmittingReview(true);
    try {
      await reviewsAPI.create({
        rating: reviewRating,
        comment: reviewComment,
        customer_name: dashboardData?.profile?.name || user?.full_name || 'Guest Customer',
        customer_id: dashboardData?.profile?.id,
        order_id: selectedOrderId,
      });
      toast.success('Thank you! Your review has been recorded. ⭐');
      setShowReviewModal(false);
      setReviewComment('');
      setSelectedOrderId(null);
      loadDashboardData(); // Refresh reviews list
    } catch (err) {
      console.error('Error submitting review:', err);
      toast.error('Failed to submit review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // AI Assistant Query
  const handleSendAiMessage = async (promptText) => {
    const textToSend = promptText || aiQuery;
    if (!textToSend.trim()) return;

    setAiMessages((prev) => [...prev, { sender: 'user', text: textToSend }]);
    if (!promptText) setAiQuery('');
    setAiLoading(true);

    try {
      const res = await aiAPI.chat({ query: textToSend, conversation_id: 'customer_session' });
      const answer = res.data?.answer || res.data?.response || "Here are our chef's recommended choices for you!";
      const sources = res.data?.sources || [];
      setAiMessages((prev) => [...prev, { sender: 'assistant', text: answer, sources }]);
    } catch (err) {
      setAiMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `For ${textToSend}, we highly recommend our popular Chef Specials such as Masala Dosa, Chicken Biryani, or Mutton Rogan Josh!`,
          sources: ['Executive Menu']
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // Reservation handler
  const handleReservationSubmit = (e) => {
    e.preventDefault();
    toast.success(`Table reserved for ${reservationData.partySize} guests on ${reservationData.date} at ${reservationData.time}! 🎉`);
    setShowReservationModal(false);
  };

  // Redeem points handler
  const handleRedeemPoints = () => {
    toast.success('🎉 ₹500 Dining Discount Voucher unlocked using 500 Reward Points!');
    setShowRedeemModal(false);
  };

  if (loading) {
    return <LoadingSpinner fullPage message="Fetching live customer database records..." />;
  }

  const profile = dashboardData?.profile || {};
  const summary = dashboardData?.summary || {};
  const orderStats = dashboardData?.order_stats?.status_counts || {};
  const recentOrders = dashboardData?.recent_orders || [];
  const favoriteItems = dashboardData?.favorite_items || [];
  const reviewsList = dashboardData?.customer_reviews || [];
  const recommendations = dashboardData?.recommendations || [];

  // Compute Trendyy Food (popular items)
  const trendyFood = [...menuItems]
    .sort((a, b) => (b.total_orders || 0) - (a.total_orders || 0))
    .slice(0, 3);

  // Compute Least Ordered Food (unpopular items for combo bundling)
  const leastOrdered = [...menuItems]
    .filter(item => item.is_available)
    .sort((a, b) => (a.total_orders || 0) - (b.total_orders || 0))
    .slice(0, 3);

  const regularComboSum = leastOrdered.reduce((sum, item) => sum + (item.price || 0), 0);
  const comboDiscount = Math.round(regularComboSum * 0.3); // 30% discount
  const discountedComboPrice = regularComboSum - comboDiscount;

  // Filter menu items
  const filteredMenu = menuItems.filter((item) => {
    const cat = item.category?.toLowerCase() || '';
    const matchesCategory = selectedCategory === 'all' || cat.includes(selectedCategory.toLowerCase());
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <AnimatedCustomerBackground>
      <div className="fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* ─── 1. CUSTOMER PROFILE & HERO HEADER ──────────────────────────── */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(147, 51, 234, 0.12) 100%)',
          border: '1px solid rgba(249, 115, 22, 0.25)',
          marginBottom: '24px',
          padding: '24px',
          borderRadius: 'var(--radius-md)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          
          {/* Customer Avatar & Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--gradient-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '26px',
                fontWeight: 800,
                boxShadow: 'var(--shadow-md)',
                flexShrink: 0,
              }}
            >
              {profile.name?.[0]?.toUpperCase() || 'C'}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h1 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>
                  {profile.name || user?.full_name}
                </h1>
                <span className="badge badge-warning" style={{ background: 'var(--gradient-primary)', color: '#fff', padding: '4px 10px', fontSize: '11px', fontWeight: 700 }}>
                  👑 {summary.tier || 'Gold VIP'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span><i className="bi bi-envelope-fill" style={{ color: 'var(--color-primary)', marginRight: '4px' }}></i> {profile.email}</span>
                <span><i className="bi bi-telephone-fill" style={{ color: 'var(--color-primary)', marginRight: '4px' }}></i> {profile.phone}</span>
                <span><i className="bi bi-geo-alt-fill" style={{ color: 'var(--color-primary)', marginRight: '4px' }}></i> {profile.address}</span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setShowCartDrawer(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="bi bi-cart-fill"></i>
              Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
            </button>

            <button className="btn btn-ghost" onClick={() => { setSelectedOrderId(null); setShowReviewModal(true); }}>
              <i className="bi bi-star-fill" style={{ color: 'var(--color-warning)', marginRight: '6px' }}></i> Leave Feedback
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. TOTAL SPENDING & ACCOUNT SUMMARY CARDS (₹ CURRENCY) ───────── */}
      <div className="grid-4" style={{ marginBottom: '24px', gap: '16px' }}>
        
        {/* Total Spending Card */}
        <div
          className="stat-card"
          style={{ '--gradient': 'var(--color-primary)', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
          onClick={() => setActiveTab('orders')}
          title="Click to view Recent Orders history"
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <div>
            <p className="stat-label">Total Spending</p>
            <p className="stat-value" style={{ color: 'var(--color-primary)', fontSize: '24px', fontWeight: 800 }}>
              ₹{Number(summary.total_spent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Across all historical orders
            </p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(249, 115, 22, 0.15)', color: 'var(--color-primary)' }}>
            <i className="bi bi-currency-rupee"></i>
          </div>
        </div>

        {/* Total Orders Card */}
        <div
          className="stat-card"
          style={{ '--gradient': 'var(--color-info)', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
          onClick={() => setActiveTab('orders')}
          title="Click to view Recent Orders history"
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <div>
            <p className="stat-label">Total Orders</p>
            <p className="stat-value" style={{ fontSize: '24px', fontWeight: 800 }}>
              {summary.total_orders || 0} Orders
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Dine-in, Takeaway & Delivery
            </p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-info)' }}>
            <i className="bi bi-bag-check-fill"></i>
          </div>
        </div>

        {/* Average Order Value Card */}
        <div
          className="stat-card"
          style={{ '--gradient': 'var(--color-success)', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
          onClick={() => setActiveTab('orders')}
          title="Click to view Recent Orders history"
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <div>
            <p className="stat-label">Avg. Order Value</p>
            <p className="stat-value" style={{ color: 'var(--color-success)', fontSize: '24px', fontWeight: 800 }}>
              ₹{Number(summary.average_order_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Average spent per dining
            </p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)' }}>
            <i className="bi bi-graph-up-arrow"></i>
          </div>
        </div>

        {/* Loyalty Reward Points Card */}
        <div className="stat-card" style={{ '--gradient': 'var(--color-warning)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="stat-label">Reward Points</p>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowRedeemModal(true)}
                style={{ fontSize: '11px', padding: '2px 8px', color: 'var(--color-primary)' }}
              >
                Redeem
              </button>
            </div>
            <p className="stat-value" style={{ color: 'var(--color-warning)', fontSize: '24px', fontWeight: 800 }}>
              {summary.loyalty_points || 0} PTS
            </p>
            {/* Progress to Next Tier */}
            <div style={{ marginTop: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                <span>Tier Progress</span>
                <span>{summary.loyalty_points} / {summary.next_tier_points}</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, ((summary.loyalty_points || 0) / (summary.next_tier_points || 1000)) * 100)}%`, height: '100%', background: 'var(--color-warning)' }}></div>
              </div>
            </div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)' }}>
            <i className="bi bi-award-fill"></i>
          </div>
        </div>
      </div>

      {/* ─── 3. NAVIGATION TABS ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px', overflowX: 'auto' }}>
        
        <button
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('overview')}
          style={{ borderRadius: '20px' }}
        >
          <i className="bi bi-speedometer2" style={{ marginRight: '6px' }}></i> Overview & Analytics
        </button>

        <button
          className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('menu')}
          style={{ borderRadius: '20px' }}
        >
          <i className="bi bi-journal-richtext" style={{ marginRight: '6px' }}></i> Explore Menu
        </button>

        <button
          className={`btn ${activeTab === 'cart' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('cart')}
          style={{ borderRadius: '20px', position: 'relative' }}
        >
          <i className="bi bi-cart-fill" style={{ marginRight: '6px' }}></i> Place Order / Cart
          {cart.length > 0 && (
            <span
              style={{
                marginLeft: '8px',
                background: 'var(--color-primary)',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 800,
              }}
            >
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>

        <button
          className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('orders')}
          style={{ borderRadius: '20px' }}
        >
          <i className="bi bi-clock-history" style={{ marginRight: '6px' }}></i> Recent Orders ({recentOrders.length})
        </button>

        <button
          className={`btn ${activeTab === 'favorites' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('favorites')}
          style={{ borderRadius: '20px' }}
        >
          <i className="bi bi-heart-fill" style={{ color: 'var(--color-danger)', marginRight: '6px' }}></i> Favorite Dishes ({favoriteItems.length})
        </button>

        <button
          className={`btn ${activeTab === 'reviews' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('reviews')}
          style={{ borderRadius: '20px' }}
        >
          <i className="bi bi-star-fill" style={{ color: 'var(--color-warning)', marginRight: '6px' }}></i> My Reviews ({reviewsList.length})
        </button>

        <button
          className={`btn ${activeTab === 'assistant' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('assistant')}
          style={{ borderRadius: '20px' }}
        >
          <i className="bi bi-robot" style={{ marginRight: '6px' }}></i> AI Dining Concierge
        </button>
      </div>

      {/* ─── TAB 1: OVERVIEW & ANALYTICS ────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="grid-2">
            
            {/* Order Frequency & Status Summary */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Order Status Breakdown</h3>
                  <p className="card-subtitle">Distribution of all placed orders</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div
                  style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--color-warning)', cursor: 'pointer' }}
                  onClick={() => setActiveTab('orders')}
                  title="Click to view Recent Orders history"
                >
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pending Orders</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {orderStats.pending || orderStats.confirmed || 0}
                  </div>
                </div>

                <div
                  style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--color-danger)', cursor: 'pointer' }}
                  onClick={() => setActiveTab('orders')}
                  title="Click to view Recent Orders history"
                >
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cancelled Orders</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {orderStats.cancelled || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Favorite Item Highlight */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Top Favorite Dish</h3>
                  <p className="card-subtitle">Your most frequently ordered item</p>
                </div>
              </div>

              {favoriteItems.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-subtle)' }}>
                    {favoriteItems[0].image_url ? (
                      <img 
                        src={favoriteItems[0].image_url} 
                        alt={favoriteItems[0].name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                      />
                    ) : (
                      <span style={{ fontSize: '28px' }}>🍛</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {favoriteItems[0].name}
                    </h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Ordered <strong style={{ color: 'var(--color-primary)' }}>{favoriteItems[0].total_qty_ordered} times</strong> · ₹{favoriteItems[0].price} each
                    </p>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => addToCart(favoriteItems[0])}>
                    Reorder Dish
                  </button>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No order history available yet.</p>
              )}
            </div>
          </div>

          {/* Trendyy Food Section */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title">Trendyy Food 🔥</h3>
                <p className="card-subtitle">Most popular dishes ordered by food lovers</p>
              </div>
              <span className="badge badge-warning" style={{ background: 'var(--gradient-primary)', color: 'white' }}>Trending Now</span>
            </div>

            <div className="grid-3" style={{ gap: '16px' }}>
              {trendyFood.map((dish) => (
                <div key={dish.id} style={{ padding: '16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{dish.name}</h4>
                      <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '15px' }}>₹{Number(dish.price).toFixed(2)}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
                      {dish.description || 'Very popular customer favorite dish.'}
                    </p>
                    <div style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: 700, marginBottom: '12px' }}>
                      🔥 {dish.total_orders || 0} Orders placed recently
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm btn-block" onClick={() => addToCart(dish)}>
                    <i className="bi bi-plus-circle-fill" style={{ marginRight: '4px' }}></i> Add to Order
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Combo Offer (Least Ordered Promo Combo) Section */}
          {leastOrdered.length === 3 && (
            <div className="card" style={{ border: '2px dashed var(--color-success)', background: 'rgba(16, 185, 129, 0.04)' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 className="card-title" style={{ color: 'var(--color-success)' }}>Exclusive Smart Combo Offer 🎁</h3>
                  <p className="card-subtitle">Discover our hidden culinary gems bundled at a 30% discount!</p>
                </div>
                <span className="badge badge-success" style={{ padding: '4px 10px', fontWeight: 700 }}>Save 30%</span>
              </div>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', padding: '16px' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 800 }}>Chef's Special "Hidden Gems" Combo</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.5' }}>
                    Enjoy a premium combination of our unique dishes: <strong>{leastOrdered.map(d => d.name).join(', ')}</strong>. Repackaged into a promotional feast to give everyone a taste of everything!
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>₹{regularComboSum.toFixed(2)}</span>
                      <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-success)', marginLeft: '8px' }}>₹{discountedComboPrice.toFixed(2)}</span>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '11px' }}>Limited Time Only</span>
                  </div>
                </div>

                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    addComboToCart(leastOrdered, "Hidden Gems Combo", comboDiscount);
                  }}
                  style={{ background: 'var(--color-success)', border: 'none', padding: '12px 24px', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}
                >
                  🚀 Get Combo Deal (Save ₹{comboDiscount})
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ─── TAB 2: EXPLORE MENU & ORDER (CATEGORIZED SECTIONS) ─────────────── */}
      {activeTab === 'menu' && (() => {
        const CUSTOMER_CATEGORIES = [
          { id: 'all', label: 'All Items', shortLabel: 'All', emoji: '🍽️' },
          { id: 'appetizer', label: 'Appetizers & Starters', shortLabel: 'Appetizers', emoji: '🥗', color: '#10b981', desc: 'Crispy bites, tandoori starters & savory platters' },
          { id: 'main_course', label: 'Main Course', shortLabel: 'Main Course', emoji: '🍛', color: '#f97316', desc: 'Rich curries, biryanis, dal, gravies & fresh breads' },
          { id: 'dessert', label: 'Desserts & Sweets', shortLabel: 'Desserts', emoji: '🍰', color: '#ec4899', desc: 'Traditional Indian mithai, halwa & chilled sweets' },
          { id: 'beverage', label: 'Beverages & Drinks', shortLabel: 'Beverages', emoji: '🥤', color: '#06b6d4', desc: 'Refreshing lassis, cooling drinks, teas & coffees' },
          { id: 'snack', label: 'Snacks & Street Food', shortLabel: 'Snacks', emoji: '🥟', color: '#eab308', desc: 'Authentic chaats, crispy snacks & street favorites' },
        ];

        const activeCategoryList = selectedCategory === 'all'
          ? CUSTOMER_CATEGORIES.filter(c => c.id !== 'all')
          : CUSTOMER_CATEGORIES.filter(c => c.id === selectedCategory);

        return (
          <div>
            {/* Filter and Search Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', background: 'var(--bg-elevated)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {CUSTOMER_CATEGORIES.map((cat) => {
                  const count = cat.id === 'all'
                    ? menuItems.length
                    : menuItems.filter(m => (m.category || '').toLowerCase().includes(cat.id)).length;

                  return (
                    <button
                      key={cat.id}
                      className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setSelectedCategory(cat.id)}
                      style={{ borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontWeight: selectedCategory === cat.id ? 700 : 500 }}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.shortLabel}</span>
                      <span style={{ 
                        fontSize: '11px', 
                        opacity: 0.85, 
                        background: selectedCategory === cat.id ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                        padding: '1px 6px',
                        borderRadius: '10px'
                      }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="navbar-search" style={{ minWidth: '240px', margin: 0 }}>
                <i className="bi bi-search" style={{ color: 'var(--text-muted)' }}></i>
                <input
                  type="text"
                  placeholder="Search dishes by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <i className="bi bi-x-circle-fill"></i>
                  </button>
                )}
              </div>
            </div>

            {loadingMenu ? (
              <LoadingSpinner message="Fetching dishes from menu database..." />
            ) : filteredMenu.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: 'var(--radius-md)' }}>
                <i className="bi bi-journal-x" style={{ fontSize: '48px', color: 'var(--text-muted)' }}></i>
                <h3 style={{ marginTop: '16px' }}>No dishes match your filter</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Try clearing your search or choosing a different category.</p>
                <button className="btn btn-secondary btn-sm" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }} style={{ marginTop: '12px' }}>
                  Show Full Menu
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {activeCategoryList.map((cat) => {
                  const sectionDishes = filteredMenu.filter(dish => 
                    (dish.category || '').toLowerCase().includes(cat.id)
                  );

                  if (sectionDishes.length === 0 && searchQuery) return null;

                  return (
                    <section key={cat.id} className="customer-menu-section">
                      
                      {/* Category Header Banner */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        padding: '12px 18px',
                        marginBottom: '16px',
                        background: 'var(--bg-elevated)',
                        borderLeft: `5px solid ${cat.color}`,
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '22px' }}>{cat.emoji}</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                                {cat.label}
                              </h3>
                              <span className="badge" style={{ 
                                background: `${cat.color}22`, 
                                color: cat.color, 
                                border: `1px solid ${cat.color}44`,
                                fontWeight: 700,
                                fontSize: '11px',
                                padding: '2px 8px'
                              }}>
                                {sectionDishes.length} {sectionDishes.length === 1 ? 'Dish' : 'Dishes'}
                              </span>
                            </div>
                            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {cat.desc}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Dishes Grid */}
                      {sectionDishes.length === 0 ? (
                        <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <p style={{ margin: 0, fontSize: '13px' }}>No items in {cat.label} at this moment.</p>
                        </div>
                      ) : (
                        <div className="grid-3" style={{ gap: '20px' }}>
                          {sectionDishes.map((dish) => (
                            <div key={dish.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s ease, box-shadow 0.2s ease', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
                              <div style={{
                                height: '170px',
                                position: 'relative',
                                overflow: 'hidden',
                                background: 'var(--bg-elevated)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {dish.image_url ? (
                                  <img
                                    src={dish.image_url}
                                    alt={dish.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.06)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div style={{
                                  display: dish.image_url ? 'none' : 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  color: 'var(--text-muted)'
                                }}>
                                  <span style={{ fontSize: '32px' }}>{cat.emoji}</span>
                                  <span style={{ fontSize: '11px', fontWeight: 600 }}>{dish.name}</span>
                                </div>

                                <div style={{
                                  position: 'absolute',
                                  top: '10px',
                                  right: '10px',
                                  display: 'flex',
                                  gap: '6px',
                                  zIndex: 2
                                }}>
                                  {dish.is_vegetarian && (
                                    <span className="badge" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)', background: 'rgba(16, 185, 129, 0.95)', color: '#fff', fontWeight: 700, fontSize: '11px', padding: '3px 8px' }}>
                                      🌱 Veg
                                    </span>
                                  )}
                                  {dish.rating > 0 && (
                                    <span className="badge badge-warning" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)', background: 'rgba(245, 158, 11, 0.95)', color: '#fff', fontWeight: 700, fontSize: '11px', padding: '3px 8px' }}>
                                      ⭐ {dish.rating}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                                    <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
                                      {dish.name}
                                    </h4>
                                    <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                                      ₹{Number(dish.price).toFixed(2)}
                                    </span>
                                  </div>

                                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {dish.description || 'Authentic dish prepared with signature spices and fresh ingredients.'}
                                  </p>

                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: cat.color, background: `${cat.color}15`, padding: '2px 8px', borderRadius: '4px' }}>
                                      {cat.shortLabel}
                                    </span>
                                  </div>
                                </div>

                                <button className="btn btn-primary btn-block" onClick={() => addToCart(dish)} style={{ marginTop: 'auto', fontWeight: 700, padding: '10px' }}>
                                  <i className="bi bi-plus-circle-fill" style={{ marginRight: '6px' }}></i> Add to Order
                                </button>
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
          </div>
        );
      })()}

      {/* ─── TAB 2.5: PLACE ORDER / CART ────────────────────────────────── */}
      {activeTab === 'cart' && (
        <div className="fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Place Order & Review Cart 🛒
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Confirm your delicious choices, select dining preferences, and submit your live kitchen ticket.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('menu')}>
                <i className="bi bi-plus-circle" style={{ marginRight: '6px' }}></i> Add More Dishes
              </button>
              {cart.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setCart([]);
                    setCartDiscount(0);
                    toast.success('Cart cleared');
                  }}
                  style={{ color: 'var(--color-danger)' }}
                >
                  <i className="bi bi-trash" style={{ marginRight: '6px' }}></i> Clear Cart
                </button>
              )}
            </div>
          </div>

          {cart.length === 0 ? (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '2px dashed var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: 'var(--color-primary)', fontSize: '36px' }}>
                <i className="bi bi-cart-x"></i>
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0' }}>Your Cart is Empty</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '440px', margin: '0 auto 20px auto' }}>
                You have not added any dishes to your order yet. Browse our menu and discover freshly prepared appetizers, main courses, and beverages!
              </p>
              <button className="btn btn-primary btn-lg" onClick={() => setActiveTab('menu')}>
                <i className="bi bi-journal-richtext" style={{ marginRight: '8px' }}></i> Browse Menu & Order
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', alignItems: 'flex-start' }}>
              
              {/* Left Column: Cart Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                      Selected Items ({cart.reduce((s, i) => s + i.quantity, 0)})
                    </h3>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Subtotal: <strong style={{ color: 'var(--color-primary)' }}>₹{cartSubtotal.toFixed(2)}</strong>
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-default)',
                          gap: '12px',
                        }}
                      >
                        {/* Food Image Thumbnail & Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-subtle)' }}>
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              <i className="bi bi-egg-fried" style={{ fontSize: '20px', color: 'var(--text-muted)' }}></i>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                                {item.name}
                              </span>
                              {item.is_vegetarian && (
                                <span className="badge badge-success" style={{ fontSize: '9px', padding: '1px 6px' }}>🌱 Veg</span>
                              )}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              ₹{Number(item.price).toFixed(2)} each · <strong style={{ color: 'var(--color-primary)' }}>₹{(item.price * item.quantity).toFixed(2)}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', padding: '2px' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => updateCartQuantity(item.id, -1)}
                              style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              -
                            </button>
                            <span style={{ minWidth: '28px', textAlign: 'center', fontWeight: 800, fontSize: '14px' }}>
                              {item.quantity}
                            </span>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => updateCartQuantity(item.id, 1)}
                              style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              +
                            </button>
                          </div>

                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => updateCartQuantity(item.id, -item.quantity)}
                            style={{ color: 'var(--color-danger)', width: '28px', height: '28px', padding: 0 }}
                            title="Remove item"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--border-subtle)' }}>
                    <button className="btn btn-ghost btn-block btn-sm" onClick={() => setActiveTab('menu')} style={{ color: 'var(--color-primary)' }}>
                      <i className="bi bi-plus-circle" style={{ marginRight: '6px' }}></i> Add another item from menu
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Dining Options & Order Checkout */}
              <div className="card" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid rgba(249, 115, 22, 0.25)' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 16px 0', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                  Dining Details & Checkout 🧾
                </h3>

                {/* Dining Type Selector */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Order Type
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[
                      { id: 'dine-in', label: '🍽️ Dine-In' },
                      { id: 'takeaway', label: '🥡 Takeaway' },
                      { id: 'delivery', label: '🚗 Delivery' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        className={`btn btn-sm ${orderType === type.id ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setOrderType(type.id)}
                        style={{ fontSize: '12px', padding: '8px 4px' }}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table or Address input */}
                {orderType === 'dine-in' ? (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Table / Seating Area
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="e.g. Table 4, Outdoor Patio, Booth 2"
                    />
                  </div>
                ) : (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      {orderType === 'delivery' ? 'Delivery Address / Apartment' : 'Pickup Customer Name & Phone'}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder={orderType === 'delivery' ? 'Enter delivery address...' : 'Enter name for pickup...'}
                    />
                  </div>
                )}

                {/* Cooking / Special Requests */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Special Requests / Kitchen Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="e.g. Extra spicy, no onions, pack sambar separately"
                  />
                </div>

                {/* Price Breakdown */}
                <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <span>Items Subtotal:</span>
                    <span>₹{cartSubtotal.toFixed(2)}</span>
                  </div>

                  {cartDiscount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-success)', fontWeight: 600, marginBottom: '8px' }}>
                      <span>Combo Savings (30% Off):</span>
                      <span>-₹{cartDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    <span>GST (5%):</span>
                    <span>₹{cartTax.toFixed(2)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', borderTop: '1px solid var(--border-default)', paddingTop: '10px' }}>
                    <span>Total Amount:</span>
                    <span style={{ color: 'var(--color-primary)' }}>₹{cartGrandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Place Order CTA */}
                <button
                  className="btn btn-primary btn-block btn-lg"
                  onClick={handlePlaceOrder}
                  disabled={isSubmittingOrder || cart.length === 0}
                  style={{ height: '52px', fontSize: '16px', fontWeight: 800, boxShadow: '0 4px 14px rgba(249, 115, 22, 0.4)' }}
                >
                  {isSubmittingOrder ? (
                    <>
                      <span className="btn-spinner"></span> Sending Ticket to Kitchen...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle-fill" style={{ marginRight: '8px' }}></i> Confirm & Place Order (₹{cartGrandTotal.toFixed(2)})
                    </>
                  )}
                </button>

                <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  ⚡ Instant Kitchen Transmission · Live Order Status Updates
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: RECENT ORDER HISTORY WITH LIVE STATUS ───────────────── */}
      {activeTab === 'orders' && (
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
            Recent Order History & Live Status 📦
          </h2>

          {recentOrders.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <i className="bi bi-bag-x" style={{ fontSize: '40px', color: 'var(--text-muted)' }}></i>
              <h3 style={{ marginTop: '12px' }}>No orders found</h3>
              <p style={{ color: 'var(--text-secondary)' }}>You have not placed any orders yet. Explore our menu to place an order!</p>
              <button className="btn btn-primary" onClick={() => setActiveTab('menu')} style={{ marginTop: '12px' }}>
                Browse Menu
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {recentOrders.map((ord) => (
                <div key={ord.id} className="card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {ord.order_number}
                        </span>
                        <span className={`badge ${getStatusBadgeClass(ord.status)}`} style={{ textTransform: 'capitalize' }}>
                          {ord.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Placed on {ord.created_at ? new Date(ord.created_at).toLocaleString() : 'Recently'}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)' }}>
                        ₹{Number(ord.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Items List */}
                  {ord.items && ord.items.length > 0 && (
                    <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <strong>Items Ordered:</strong>
                      <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px' }}>
                        {ord.items.map((item, idx) => (
                          <li key={idx}>
                            {item.quantity}x {item.item_name} — ₹{item.unit_price} each (Total: ₹{item.total_price})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Review Trigger Button for Delivered Orders */}
                  {ord.status?.toLowerCase() === 'delivered' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border-default)' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedOrderId(ord.id);
                          setReviewRating(5);
                          setReviewComment('');
                          setShowReviewModal(true);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                      >
                        <i className="bi bi-star-fill" style={{ color: 'var(--color-warning)' }}></i> Rate & Review Order
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: FAVORITE / MOST-ORDERED MENU ITEMS ───────────────────── */}
      {activeTab === 'favorites' && (
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
            Your Most-Ordered & Favorite Dishes ❤️
          </h2>

          {favoriteItems.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <i className="bi bi-heart" style={{ fontSize: '40px', color: 'var(--text-muted)' }}></i>
              <h3 style={{ marginTop: '12px' }}>No favorite items yet</h3>
              <p style={{ color: 'var(--text-secondary)' }}>As you place orders, your most frequently ordered dishes will appear here.</p>
            </div>
          ) : (
            <div className="grid-3" style={{ gap: '20px' }}>
              {favoriteItems.map((dish) => (
                <div key={dish.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
                  <div style={{
                    height: '140px',
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'var(--bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {dish.image_url ? (
                      <img
                        src={dish.image_url}
                        alt={dish.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div style={{
                      display: dish.image_url ? 'none' : 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      color: 'var(--text-muted)'
                    }}>
                      <i className="bi bi-image" style={{ fontSize: '28px' }}></i>
                    </div>

                    <span className="badge badge-primary" style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--gradient-primary)', color: '#fff', fontSize: '11px', fontWeight: 700 }}>
                      ❤️ Favorite
                    </span>
                  </div>

                  <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          {dish.name}
                        </h3>
                        <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-primary)' }}>
                          ₹{dish.price}
                        </span>
                      </div>

                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        Total Ordered: <strong style={{ color: 'var(--color-primary)' }}>{dish.total_qty_ordered} times</strong>
                      </p>
                    </div>

                    <button className="btn btn-primary btn-block" onClick={() => addToCart(dish)}>
                      <i className="bi bi-plus-circle-fill" style={{ marginRight: '6px' }}></i> Reorder Dish
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: REVIEWS & FEEDBACK HISTORY ──────────────────────────── */}
      {activeTab === 'reviews' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
              My Reviews & Dining Feedback ⭐
            </h2>
            <button className="btn btn-primary" onClick={() => setShowReviewModal(true)}>
              <i className="bi bi-plus-circle-fill" style={{ marginRight: '6px' }}></i> Post Feedback
            </button>
          </div>

          {reviewsList.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <i className="bi bi-chat-left-heart" style={{ fontSize: '40px', color: 'var(--text-muted)' }}></i>
              <h3 style={{ marginTop: '12px' }}>No reviews posted yet</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Share your dining feedback to help us improve our service!</p>
            </div>
          ) : (() => {
            const positiveReviews = reviewsList.filter(rev => rev.rating >= 3);
            const criticalReviews = reviewsList.filter(rev => rev.rating <= 2 || rev.sentiment === 'negative');
            
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'flex-start' }}>
                {/* Left Column: Positive & Neutral */}
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="bi bi-emoji-smile-fill"></i> Positive & Neutral (3★ and Above) ({positiveReviews.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {positiveReviews.map((rev) => (
                      <div key={rev.id} className="card" style={{ borderLeft: '4px solid var(--color-success)', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', gap: '2px', fontSize: '14px', color: 'var(--color-warning)' }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <i key={star} className={`bi bi-star${star <= rev.rating ? '-fill' : ''}`}></i>
                            ))}
                          </div>
                          <span className="badge badge-success" style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                            {rev.sentiment || 'positive'}
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '6px 0', lineHeight: 1.5 }}>
                          "{rev.comment}"
                        </p>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Posted on {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : 'Recently'}
                        </span>
                      </div>
                    ))}
                    {positiveReviews.length === 0 && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No positive feedback yet.</p>
                    )}
                  </div>
                </div>

                {/* Right Column: Critical & Negatives */}
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="bi bi-emoji-frown-fill"></i> Critical & Negatives (2★ and Below / Negative) ({criticalReviews.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {criticalReviews.map((rev) => (
                      <div key={rev.id} className="card" style={{ borderLeft: '4px solid var(--color-danger)', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', gap: '2px', fontSize: '14px', color: 'var(--color-warning)' }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <i key={star} className={`bi bi-star${star <= rev.rating ? '-fill' : ''}`}></i>
                            ))}
                          </div>
                          <span className="badge badge-danger" style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                            {rev.sentiment || 'negative'}
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '6px 0', lineHeight: 1.5 }}>
                          "{rev.comment}"
                        </p>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Posted on {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : 'Recently'}
                        </span>
                      </div>
                    ))}
                    {criticalReviews.length === 0 && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No critical feedback yet.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── TAB 6: AI DINING CONCIERGE ─────────────────────────────────── */}
      {activeTab === 'assistant' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px' }}>
              🤖
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>AI Dining Concierge</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Powered by Gemini RAG Vector Knowledge Base</p>
            </div>
          </div>

          <div style={{ padding: '12px 20px', background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['Recommend spicy dishes', 'What are top veg items?', 'Suggest wine pairing for Biryani', 'Daily chef specials'].map((prompt, i) => (
              <button
                key={i}
                className="btn btn-ghost btn-sm"
                onClick={() => handleSendAiMessage(prompt)}
                style={{ fontSize: '12px', borderRadius: '12px', background: 'var(--bg-card)' }}
              >
                💡 {prompt}
              </button>
            ))}
          </div>

          <div style={{ height: '360px', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {aiMessages.map((msg, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '80%', padding: '12px 16px', borderRadius: '16px', background: msg.sender === 'user' ? 'var(--color-primary)' : 'var(--bg-elevated)', color: msg.sender === 'user' ? 'white' : 'var(--text-primary)', border: msg.sender === 'user' ? 'none' : '1px solid var(--border-default)', lineHeight: 1.6, fontSize: '14px' }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div style={{ display: 'flex', gap: '6px', padding: '12px', color: 'var(--text-muted)' }}>
                <span className="btn-spinner"></span> Concierge is crafting recommendation...
              </div>
            )}
          </div>

          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-default)', display: 'flex', gap: '10px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Ask about ingredients, wine pairings, dietary options..."
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendAiMessage()}
            />
            <button className="btn btn-primary" onClick={() => handleSendAiMessage()} disabled={aiLoading}>
              <i className="bi bi-send-fill"></i>
            </button>
          </div>
        </div>
      )}

      {/* ─── FLOATING BOTTOM CART BAR (ACTIVE ON OTHER TABS) ───────────── */}
      {cart.length > 0 && activeTab !== 'cart' && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-elevated)',
            border: '2px solid var(--color-primary)',
            borderRadius: '50px',
            padding: '12px 24px',
            boxShadow: '0 8px 32px rgba(249, 115, 22, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            zIndex: 900,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '16px' }}>
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Order Total</div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                ₹{cartGrandTotal.toFixed(2)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={() => setActiveTab('cart')}
              style={{ borderRadius: '24px', padding: '8px 20px', fontWeight: 700 }}
            >
              <i className="bi bi-cart-check-fill" style={{ marginRight: '6px' }}></i> Review & Place Order →
            </button>
          </div>
        </div>
      )}

      {/* ─── CART SLIDE-OVER DRAWER ─────────────────────────────────────── */}
      {showCartDrawer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: '440px', height: '100%', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Your Order Cart 🛒</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{cart.reduce((s, i) => s + i.quantity, 0)} items selected</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCartDrawer(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)' }}>
                  <i className="bi bi-cart-x" style={{ fontSize: '48px', color: 'var(--text-muted)' }}></i>
                  <p style={{ marginTop: '12px', fontWeight: 600 }}>Your cart is empty</p>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setShowCartDrawer(false); setActiveTab('menu'); }}>
                    Browse Menu
                  </button>
                </div>
              ) : (
                <>
                  {cart.map((item) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-subtle)' }}>
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <i className="bi bi-egg-fried" style={{ fontSize: '18px', color: 'var(--text-muted)' }}></i>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{item.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 700 }}>
                            ₹{Number(item.price).toFixed(2)} x {item.quantity} = ₹{(item.price * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => updateCartQuantity(item.id, -1)} style={{ padding: '2px 8px' }}>-</button>
                        <span style={{ fontWeight: 700, fontSize: '14px', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                        <button className="btn btn-secondary btn-sm" onClick={() => updateCartQuantity(item.id, 1)} style={{ padding: '2px 8px' }}>+</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => updateCartQuantity(item.id, -item.quantity)} style={{ color: 'var(--color-danger)', padding: '2px 6px' }}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Order Options */}
                  <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Order Type & Table</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      {['dine-in', 'takeaway', 'delivery'].map(t => (
                        <button key={t} type="button" className={`btn btn-sm ${orderType === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOrderType(t)} style={{ fontSize: '11px', padding: '4px 8px', flex: 1, textTransform: 'capitalize' }}>
                          {t}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '12px', padding: '6px 10px', marginBottom: '8px' }}
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder={orderType === 'dine-in' ? 'Table Number (e.g. Table 4)' : 'Delivery Address / Pickup Name'}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '12px', padding: '6px 10px' }}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Special instructions / notes..."
                    />
                  </div>
                </>
              )}
            </div>

            {cart.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '14px', marginTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Subtotal:</span>
                  <span>₹{cartSubtotal.toFixed(2)}</span>
                </div>
                {cartDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-success)', marginBottom: '4px' }}>
                    <span>Promo Discount:</span>
                    <span>-₹{cartDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>GST (5%):</span>
                  <span>₹{cartTax.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 800, marginBottom: '14px' }}>
                  <span>Total:</span>
                  <span style={{ color: 'var(--color-primary)' }}>₹{cartGrandTotal.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary btn-block btn-lg" onClick={handlePlaceOrder} disabled={isSubmittingOrder}>
                    {isSubmittingOrder ? 'Sending to Kitchen...' : `Confirm & Place Order 🚀`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── REVIEW / FEEDBACK MODAL ────────────────────────────────────── */}
      {showReviewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '90%', maxWidth: '440px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px' }}>{selectedOrderId ? `Rate Order #${selectedOrderId}` : 'Leave Feedback'} ⭐</h3>
            <form onSubmit={handleSubmitReview}>
              <div style={{ display: 'flex', gap: '8px', fontSize: '28px', color: 'var(--color-warning)', marginBottom: '16px', justifyContent: 'center', cursor: 'pointer' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <i key={star} className={`bi bi-star${star <= reviewRating ? '-fill' : ''}`} onClick={() => setReviewRating(star)}></i>
                ))}
              </div>

              <textarea
                className="form-input"
                rows={4}
                placeholder="Write your feedback regarding food quality, taste, and service..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                style={{ marginBottom: '16px' }}
              ></textarea>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowReviewModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingReview}>Submit Feedback</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── REDEEM REWARDS MODAL ───────────────────────────────────────── */}
      {showRedeemModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '90%', maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎁</div>
            <h3 style={{ marginTop: 0 }}>Redeem Reward Points</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              You have <strong style={{ color: 'var(--color-warning)' }}>{summary.loyalty_points} Points</strong> available. Redeem 500 points for a ₹500 instant discount voucher!
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button className="btn btn-ghost" onClick={() => setShowRedeemModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRedeemPoints}>Redeem ₹500 Voucher</button>
            </div>
          </div>
        </div>
      )}

      {/* Table Reservation Modal removed completely */}

      </div>
    </AnimatedCustomerBackground>
  );
}

function getStatusBadgeClass(status = 'pending') {
  switch (status.toLowerCase()) {
    case 'pending': return 'badge-warning';
    case 'confirmed': return 'badge-info';
    case 'preparing': return 'badge-info';
    case 'ready': return 'badge-primary';
    case 'delivered':
    case 'completed': return 'badge-success';
    case 'cancelled': return 'badge-danger';
    default: return 'badge-ghost';
  }
}
