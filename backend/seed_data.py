import asyncio
import random
from datetime import datetime, timezone, timedelta
from app.core.database import AsyncSessionLocal, create_tables, engine, Base
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.all_models import (
    Customer, Menu, Employee, Supplier,
    Order, OrderItem, Review, FoodWaste,
    FoodCategory, OrderStatus, PaymentStatus
)
from sqlalchemy import text

async def clear_database():
    print("[INFO] Dropping existing tables to start fresh...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

async def seed_database():
    await clear_database()
    print("[INFO] Initializing database schema...")
    
    async with AsyncSessionLocal() as session:
        print("[INFO] Seeding default users and customers (8)...")
        hashed_pwd = get_password_hash("Admin@123")
        admin = User(full_name="Admin Chef", email="admin@restaurant.com", hashed_password=hashed_pwd, role=UserRole.ADMIN, is_active=True, is_verified=True)
        manager = User(full_name="Bistro Manager", email="manager@restaurant.com", hashed_password=hashed_pwd, role=UserRole.MANAGER, is_active=True, is_verified=True)
        staff = User(full_name="Wait Staff", email="staff@restaurant.com", hashed_password=hashed_pwd, role=UserRole.STAFF, is_active=True, is_verified=True)
        session.add_all([admin, manager, staff])

        # Seed customer users so they can log in
        for i in range(1, 6):
            c_user = User(
                full_name=f"Customer {i}",
                email=f"cust{i}@example.com",
                hashed_password=hashed_pwd,
                role=UserRole.CUSTOMER,
                is_active=True,
                is_verified=True
            )
            session.add(c_user)

        await session.flush()

        print("[INFO] Seeding suppliers (10)...")
        suppliers = []
        sup_names = ["Fresh Farms Organic", "Prime Meats Ltd", "Dairy Best Co", "Spice Route Traders", "Oceanic Seafoods", "Green Valley Veg", "Himalayan Waters", "Metro Cash & Carry", "Global Packaging", "City Bakers"]
        for name in sup_names:
            s = Supplier(name=name, contact_person=name.split()[0], phone=f"+91 98{random.randint(10000000, 99999999)}", email=f"contact@{name.split()[0].lower()}.com", category="General")
            session.add(s)
            suppliers.append(s)
        await session.flush()

        print("[INFO] Seeding employees (10)...")
        employees = []
        emp_names = ["Rajesh Kumar", "Anita Verma", "Vikram Singh", "Priya Patel", "Amit Sharma", "Suresh Menon", "Kavita Reddy", "Ramesh Rao", "Deepa Nair", "Manoj Gupta"]
        roles = ["Head Chef", "Sous Chef", "Waiter", "Waitress", "Cashier", "Cleaner", "Manager", "Delivery Boy", "Cook", "Bartender"]
        for i in range(10):
            e = Employee(name=emp_names[i], email=f"{emp_names[i].split()[0].lower()}@restaurant.com", phone=f"+91 91{random.randint(10000000, 99999999)}", position=roles[i], department="Operations", salary=random.randint(15000, 75000))
            session.add(e)
            employees.append(e)
        await session.flush()

        print("[INFO] Seeding menu items (20+)...")
        menus = []

        # Each tuple: (name, category, price, cost_price, is_vegetarian)
        menu_items_data = [
            ("Butter Chicken",    FoodCategory.MAIN_COURSE, 380.0,  150.0, False),
            ("Paneer Tikka",      FoodCategory.APPETIZER,   290.0,  110.0, True),
            ("Gulab Jamun",       FoodCategory.DESSERT,     140.0,   40.0, True),
            ("Garlic Naan",       FoodCategory.MAIN_COURSE,  60.0,   15.0, True),
            ("Chicken Biryani",   FoodCategory.MAIN_COURSE, 420.0,  180.0, False),
            ("Mutton Rogan Josh", FoodCategory.MAIN_COURSE, 550.0,  250.0, False),
            ("Dal Makhani",       FoodCategory.MAIN_COURSE, 250.0,   90.0, True),
            ("Masala Dosa",       FoodCategory.MAIN_COURSE, 180.0,   50.0, True),
            ("Idli Sambar",       FoodCategory.MAIN_COURSE, 120.0,   30.0, True),
            ("Tandoori Chicken",  FoodCategory.APPETIZER,   450.0,  200.0, False),
            ("Samosa Chaat",      FoodCategory.SNACK,       110.0,   35.0, True),
            ("Pani Puri",         FoodCategory.SNACK,        80.0,   20.0, True),
            ("Mango Lassi",       FoodCategory.BEVERAGE,    120.0,   40.0, True),
            ("Masala Chai",       FoodCategory.BEVERAGE,     50.0,   15.0, True),
            ("Cold Coffee",       FoodCategory.BEVERAGE,    150.0,   60.0, True),
            ("Rasmalai",          FoodCategory.DESSERT,     160.0,   55.0, True),
            ("Gajar Ka Halwa",    FoodCategory.DESSERT,     180.0,   70.0, True),
            ("Palak Paneer",      FoodCategory.MAIN_COURSE, 310.0,  120.0, True),
            ("Fish Curry",        FoodCategory.MAIN_COURSE, 480.0,  210.0, False),
            ("Veg Pulao",         FoodCategory.MAIN_COURSE, 220.0,   80.0, True),
            ("Chole Bhature",     FoodCategory.MAIN_COURSE, 240.0,   95.0, True),
            ("Aloo Paratha",      FoodCategory.MAIN_COURSE, 100.0,   35.0, True),
        ]

        for name, cat, price, cost, is_veg in menu_items_data:
            slug = name.lower().replace(" ", "-")
            img_url = f"/images/menu/{slug}.jpg"
            m = Menu(
                name=name,
                description=f"Delicious {name}",
                category=cat,
                price=price,
                cost_price=cost,
                image_url=img_url,
                is_vegetarian=is_veg,
                total_orders=random.randint(50, 500),
                rating=random.uniform(4.0, 5.0)
            )
            session.add(m)
            menus.append(m)
        await session.flush()


        print("[INFO] Seeding customers (25+)...")
        customers = []
        for i in range(25):
            c = Customer(name=f"Customer {i+1}", email=f"cust{i+1}@example.com", phone=f"+91 99{random.randint(10000000, 99999999)}", total_orders=random.randint(1, 20), total_spent=random.uniform(500, 15000), segment="Regular")
            session.add(c)
            customers.append(c)
        await session.flush()

        print("[INFO] Seeding orders and order items (30+ orders, 50+ items)...")
        orders = []
        now = datetime.now(timezone.utc)
        for i in range(35):
            cust = random.choice(customers)
            # random date within last 30 days
            created_at = now - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
            
            o = Order(customer_id=cust.id, status=random.choice(list(OrderStatus)), payment_status=PaymentStatus.PAID, total_amount=0, created_at=created_at)
            session.add(o)
            await session.flush()
            orders.append(o)
            
            # Add 1 to 4 items per order
            num_items = random.randint(1, 4)
            total = 0
            for _ in range(num_items):
                m = random.choice(menus)
                qty = random.randint(1, 3)
                price = qty * m.price
                total += price
                oi = OrderItem(order_id=o.id, menu_item_id=m.id, quantity=qty, unit_price=m.price, total_price=price, created_at=created_at)
                session.add(oi)
            
            o.total_amount = total + (total * 0.05) # 5% tax
            o.tax = total * 0.05

        await session.flush()

        print("[INFO] Seeding reviews (30+)...")
        for i in range(32):
            o = random.choice(orders)
            rating = random.randint(3, 5) if random.random() > 0.2 else random.randint(1, 2)
            sentiment = "positive" if rating >= 4 else ("negative" if rating <= 2 else "neutral")
            r = Review(customer_id=o.customer_id, order_id=o.id, rating=rating, comment=f"My rating is {rating} stars.", sentiment=sentiment, sentiment_score=float(rating)/5.0, is_verified=True, created_at=o.created_at + timedelta(hours=1))
            session.add(r)
        
        print("[INFO] Seeding food waste (20+)...")
        waste_items = ["Tomatoes", "Onions", "Milk", "Rice", "Chicken", "Paneer", "Yogurt", "Coriander", "Lemon", "Fish"]
        reasons = ["Expired", "Overcooked", "Dropped", "Spoiled", "Trim Waste"]
        for i in range(25):
            created_at = now - timedelta(days=random.randint(0, 30))
            w = FoodWaste(ingredient_name=random.choice(waste_items), quantity_wasted=random.uniform(0.5, 5.0), unit="kg", reason=random.choice(reasons), cost=random.uniform(50, 500), waste_date=created_at, created_at=created_at)
            session.add(w)

        await session.commit()
        print("[SUCCESS] Database seeded successfully with 100+ records!")

if __name__ == "__main__":
    asyncio.run(seed_database())
