import sqlite3
import os

def initialize_db():
    """
    Initialize the SQLite database with necessary tables and sample data if they don't exist.
    """
    # Define the database path relative to the project root
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'database', 'sustainable_farming.db'))
    
    # Create the database directory if it doesn't exist
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        
        # Create farmer_advisor table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS farmer_advisor (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Soil_pH REAL,
                Soil_Moisture REAL,
                Temperature_C REAL,
                Rainfall_mm REAL,
                Fertilizer_Usage_kg REAL,
                Pesticide_Usage_kg REAL,
                Crop_Yield_ton REAL,
                Crop_Type TEXT,
                Sustainability_Score REAL
            )
        """)
        
        # Create market_researcher table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS market_researcher (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Product TEXT,
                Market_Price_per_ton REAL,
                Demand_Index REAL,
                Supply_Index REAL,
                Competitor_Price_per_ton REAL,
                Economic_Indicator REAL,
                Weather_Impact_Score REAL,
                Seasonal_Factor TEXT,
                Consumer_Trend_Index REAL
            )
        """)
        
        # Create recommendations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                crop TEXT,
                score REAL,
                rationale TEXT,
                market_score REAL,
                weather_score REAL,
                sustainability_score REAL,
                carbon_score REAL,
                water_score REAL,
                erosion_score REAL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            
        """)
        cursor.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            farm_name TEXT,
            profile_picture TEXT,
            created_at TEXT
        )''')
        
        # Check if farmer_advisor table is empty and populate with sample data
        cursor.execute("SELECT COUNT(*) FROM farmer_advisor")
        if cursor.fetchone()[0] == 0:
            sample_data = [
                (6.5, 30.0, 25.0, 50.0, 50.0, 2.0, 3.0, "tomatoes", 0.75),
                (6.0, 25.0, 24.0, 40.0, 45.0, 1.8, 2.8, "carrots", 0.68),
                (7.0, 35.0, 26.0, 60.0, 55.0, 2.2, 3.2, "wheat", 0.70),
                (6.2, 28.0, 23.0, 45.0, 48.0, 1.9, 2.9, "corn", 0.72)
            ]
            cursor.executemany("""
                INSERT INTO farmer_advisor (Soil_pH, Soil_Moisture, Temperature_C, Rainfall_mm,
                                            Fertilizer_Usage_kg, Pesticide_Usage_kg, Crop_Yield_ton,
                                            Crop_Type, Sustainability_Score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, sample_data)
        
        # Check if market_researcher table is empty and populate with sample data
        cursor.execute("SELECT COUNT(*) FROM market_researcher")
        if cursor.fetchone()[0] == 0:
            sample_data = [
                ("tomatoes", 950.0, 0.6, 0.4, 900.0, 0.8, 0.7, "High", 0.6),
                ("carrots", 800.0, 0.5, 0.5, 850.0, 0.7, 0.6, "Medium", 0.5),
                ("wheat", 600.0, 0.4, 0.6, 650.0, 0.9, 0.8, "Low", 0.7),
                ("corn", 700.0, 0.5, 0.5, 720.0, 0.8, 0.7, "Medium", 0.6)
            ]
            cursor.executemany("""
                INSERT INTO market_researcher (Product, Market_Price_per_ton, Demand_Index, Supply_Index,
                                               Competitor_Price_per_ton, Economic_Indicator,
                                               Weather_Impact_Score, Seasonal_Factor, Consumer_Trend_Index)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, sample_data)
        
        conn.commit()
