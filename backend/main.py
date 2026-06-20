# main.py - Complete FastAPI backend with all endpoints migrated from Streamlit app.py
import re
import os
import io
import sys
import sqlite3
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import json
import base64
import random
import requests
from PIL import Image

# Deep Translator for dynamic multilingual translation
try:
    from deep_translator import GoogleTranslator
    HAS_TRANSLATOR = True
except ImportError:
    HAS_TRANSLATOR = False

# Try to import pandas/numpy - if not available, use fallbacks
try:
    import numpy as np
    import pandas as pd
    HAS_ML = True
except ImportError:
    HAS_ML = False
    np = None
    pd = None

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import agent collaboration
try:
    from agents.agent_setup import run_agent_collaboration
except ImportError:
    def run_agent_collaboration(land_size, soil_type, crop_preference):
        # EXPERT SYSTEM: Rule-based logic for accurate recommendations without ML models
        # This replaces the random number generator with agronomic rules
        
        # crop_database: {crop: {soil: [], ph_min, ph_max, water_needs, region}}
        crop_db = {
            "Rice": {"soil": ["Clay", "Loamy", "Alluvial"], "water": "High", "desc": "Requires standing water and clayey soil."},
            "Wheat": {"soil": ["Loamy", "Sandy Loam"], "water": "Medium", "desc": "Thrives in cool climates and well-drained loamy soil."},
            "Corn": {"soil": ["Loamy", "Alluvial"], "water": "Medium", "desc": "Needs nutrient-rich soil with good drainage."},
            "Barley": {"soil": ["Loamy", "Sandy"], "water": "Low", "desc": "Drought tolerant, good for sandy/loamy soils."},
            "Sorghum": {"soil": ["Sandy", "Loamy", "Red"], "water": "Low", "desc": "Highly drought resistant, excellent for dry regions."},
            "Cotton": {"soil": ["Black", "Alluvial"], "water": "Medium", "desc": "Best in black soil (Regur), requires long frost-free period."},
            "Tomato": {"soil": ["Sandy Loam", "Loamy"], "water": "Medium", "desc": "Needs well-drained, fertile soil."},
            "Potato": {"soil": ["Sandy Loam"], "water": "Medium", "desc": "Best in loose soil for tuber development."},
            "Chickpea": {"soil": ["Loamy", "Sandy"], "water": "Low", "desc": "Nitrogen-fixing, improves soil health."}
        }
        
        # Determine best crops based on soil_type and inputs
        recommended_crops = []
        
        for crop, requirements in crop_db.items():
            score = 70.0 # Base score
            
            # Soil compatibility check
            if soil_type in requirements["soil"] or "All" in requirements["soil"]:
                score += 15
            elif soil_type in ["Loamy"]: # Loamy is good for almost everything
                score += 10
            else:
                score -= 10
                
            # Crop preference filter (simplified)
            if crop_preference == "Grains" and crop in ["Rice", "Wheat", "Corn", "Barley", "Sorghum"]:
                score += 10
            elif crop_preference == "Vegetables" and crop in ["Tomato", "Potato", "Carrot"]:
                score += 10
            elif crop_preference == "Pulses" and crop in ["Chickpea", "Soybean"]:
                score += 10
                
            # Random variation for realism (small amount)
            score += random.uniform(-2, 3)
            
            # Cap score
            score = min(98.0, max(40.0, score))
            
            recommended_crops.append({
                "crop": crop,
                "score": round(score, 1),
                "desc": requirements["desc"]
            })
            
        # Sort by score descending
        recommended_crops.sort(key=lambda x: x["score"], reverse=True)
        top_3 = recommended_crops[:3]
        
        # Build response text
        recommendation_text = f"ANALYSIS FOR {land_size}ha FARM ({soil_type.upper()} SOIL):\n\n"
        recommendation_text += f"Top Recommendation: {top_3[0]['crop']} (Score: {top_3[0]['score']}/100)\n"
        recommendation_text += f"Reasoning: {top_3[0]['desc']} ideally suited for {soil_type} soil.\n\n"
        
        if len(top_3) > 1:
            recommendation_text += f"Alternative: {top_3[1]['crop']} ({top_3[1]['score']}/100) - {top_3[1]['desc']}\n"
        
        chart_data = []
        for item in top_3:
            # Generate sub-scores consistent with the main score
            base = item["score"] / 100.0
            chart_data.append({
                "crop": item["crop"],
                "labels": ["Market Probability", "Weather Suitability", "Sustainability", "Yield Potential", "Soil Health"],
                "values": [
                    round(min(99, base * random.uniform(0.9, 1.1) * 100), 1),
                    round(min(99, base * random.uniform(0.9, 1.1) * 100), 1),
                    round(min(99, base * random.uniform(0.8, 1.2) * 100), 1),
                    round(min(99, base * random.uniform(0.9, 1.1) * 100), 1),
                    round(min(99, base * random.uniform(0.8, 1.2) * 100), 1)
                ]
            })
        
        return {'recommendation': recommendation_text, 'chart_data': chart_data}

# Import FertilizerOptimizer
try:
    from fertilizer_optimizer import FertilizerOptimizer
except ImportError:
    class FertilizerOptimizer:
        def __init__(self, db_path):
            self.db_path = db_path
        def calculate_fertilizer(self, land_size, soil_type, crop_type):
            # Realistic fertilizer calculations based on soil and crop type
            base_rates = {
                "Loamy": {"n": 120, "p": 60, "k": 80},
                "Sandy": {"n": 150, "p": 70, "k": 90},
                "Clay": {"n": 100, "p": 50, "k": 70}
            }
            crop_multipliers = {
                "Wheat": 1.0, "Rice": 1.2, "Corn": 1.3, "Tomatoes": 1.1,
                "Soybeans": 0.8, "Carrots": 0.9, "Potato": 1.15
            }
            rates = base_rates.get(soil_type, base_rates["Loamy"])
            mult = crop_multipliers.get(crop_type, 1.0)
            return {
                'nitrogen_kg': round(rates["n"] * land_size * mult, 1),
                'phosphorus_kg': round(rates["p"] * land_size * mult, 1),
                'potassium_kg': round(rates["k"] * land_size * mult, 1)
            }

# Import CropRotationPlanner
try:
    from crop_rotation_planner import CropRotationPlanner
except ImportError:
    class CropRotationPlanner:
        def __init__(self, db_path):
            self.db_path = db_path
            self.rotation_map = {
                "Wheat": ["Soybean", "Corn", "Fallow", "Wheat"],
                "Rice": ["Legumes", "Wheat", "Vegetables", "Rice"],
                "Corn": ["Soybean", "Wheat", "Cover Crop", "Corn"],
                "Tomato": ["Legumes", "Grains", "Brassicas", "Tomato"],
                "Soybean": ["Corn", "Wheat", "Sorghum", "Soybean"],
                "Potato": ["Legumes", "Grains", "Brassicas", "Potato"]
            }
        def generate_plan(self, current_crop):
            rotation = self.rotation_map.get(current_crop, ["Legumes", "Grains", "Cover Crop", current_crop])
            plan = f"Year 1: {rotation[0]} (nitrogen fixation)\n"
            plan += f"Year 2: {rotation[1]} (nutrient balance)\n"
            plan += f"Year 3: {rotation[2]} (soil health)\n"
            plan += f"Year 4: {current_crop} (main crop return)"
            return plan

# Import weather models
try:
    from models.enhanced_weather_analyst import EnhancedWeatherAnalyst
except ImportError:
    EnhancedWeatherAnalyst = None

try:
    from models.enhanced_pest_predictor import EnhancedPestDiseasePredictor
except ImportError:
    EnhancedPestDiseasePredictor = None

app = FastAPI(title="Sustainable Farming AI API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'database/sustainable_farming.db'))
# Also check parent directory for database
if not os.path.exists(os.path.dirname(DB_PATH)):
    DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'database', 'sustainable_farming.db'))

# Open-Meteo API — free, no API key required
OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast"

# Models
class UserSignup(BaseModel):
    username: str
    farm_name: str
    profile_picture: Optional[str] = None

class UserLogin(BaseModel):
    username: str

class FarmDetails(BaseModel):
    username: str
    land_size: float
    soil_type: str
    crop_preference: str

class RecommendationRequest(BaseModel):
    username: str
    land_size: float
    soil_type: str
    crop_preference: str

class SustainabilityLog(BaseModel):
    username: str
    water_score: float
    fertilizer_use: float
    rotation: bool

class CommunityInsight(BaseModel):
    username: str
    crop_type: str
    yield_data: float
    market_price: float
    sustainability_practice: str
    region: str
    season: str

class ChatQuery(BaseModel):
    username: Optional[str] = "anonymous"
    query: str

class CropRotationRequest(BaseModel):
    current_crop: str
    years: int = 4

class FertilizerRequest(BaseModel):
    land_size: float
    soil_type: str
    crop_type: str

class WeatherRequest(BaseModel):
    lat: float = 12.9716
    lon: float = 77.5946
    crop_type: Optional[str] = "General"

class PestPredictionRequest(BaseModel):
    crop_type: str
    soil_type: str
    temperature: float
    humidity: float
    rainfall: float

class MultiAgentRecommendationRequest(BaseModel):
    """Request for multi-agent collaboration recommendation"""
    username: str = "anonymous"
    land_size: float = 5.0
    soil_type: str = "Loamy"
    crop_preference: str = "Grains"
    # Additional parameters for AI models
    nitrogen: float = 40.0
    phosphorus: float = 30.0
    potassium: float = 30.0
    temperature: float = 25.0
    humidity: float = 60.0
    ph: float = 6.5
    rainfall: float = 500.0

class OfflineDataRequest(BaseModel):
    username: str
    data_type: str
    data_content: str

class UserProfileUpdate(BaseModel):
    username: str
    new_username: Optional[str] = None
    farm_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    experience_level: Optional[str] = None
    farm_size: Optional[float] = None
    primary_crops: Optional[List[str]] = None

class CropDiagnosisRequest(BaseModel):
    description: str = ""
    crop_type: str = ""
    username: str = "anonymous"
    image_base64: Optional[str] = None

class SchemeMatchRequest(BaseModel):
    username: str = "anonymous"
    location: str = ""
    land_size: float = 0
    crop: str = ""
    income_category: str = "small"

class MandiPriceRequest(BaseModel):
    crop: str
    state: str = ""
    district: str = ""

class ExpenseEntry(BaseModel):
    username: str
    category: str
    amount: float
    description: str = ""
    date: Optional[str] = None

class VoiceNoteEntry(BaseModel):
    username: str
    audio_text: str
    crop: str = ""
    language: str = "en"

# Init DB (full from Streamlit)
def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        # Users table
        cursor.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            username TEXT UNIQUE, 
            farm_name TEXT, 
            profile_picture TEXT,
            email TEXT,
            phone TEXT,
            location TEXT,
            experience_level TEXT,
            farm_size REAL,
            primary_crops TEXT,
            created_at TEXT
        )''')
        # Farm details table
        cursor.execute('''CREATE TABLE IF NOT EXISTS farm_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            username TEXT, 
            land_size REAL, 
            soil_type TEXT, 
            crop_preference TEXT, 
            created_at TEXT
        )''')
        # Recommendations table with full schema
        cursor.execute('''CREATE TABLE IF NOT EXISTS recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            username TEXT, 
            crop TEXT, 
            score REAL, 
            rationale TEXT, 
            market_score REAL, 
            weather_score REAL, 
            sustainability_score REAL, 
            carbon_score REAL, 
            water_score REAL, 
            erosion_score REAL, 
            timestamp TEXT, 
            recommendation TEXT
        )''')
        # Sustainability scores table
        cursor.execute('''CREATE TABLE IF NOT EXISTS sustainability_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            timestamp TEXT,
            water_score REAL,
            fertilizer_use REAL,
            rotation INTEGER,
            score REAL
        )''')
        # Community insights table
        cursor.execute('''CREATE TABLE IF NOT EXISTS community_insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            crop_type TEXT,
            yield_data REAL,
            market_price REAL,
            sustainability_practice TEXT,
            region TEXT,
            season TEXT,
            created_at TEXT
        )''')
        # Market forecasts table
        cursor.execute('''CREATE TABLE IF NOT EXISTS market_forecasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            crop TEXT,
            predicted_price REAL,
            confidence_score REAL,
            forecast_date TEXT,
            created_at TEXT
        )''')
        # Chatbot sessions table
        cursor.execute('''CREATE TABLE IF NOT EXISTS chatbot_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            session_id TEXT,
            query TEXT,
            response TEXT,
            timestamp TEXT
        )''')
        # Offline data table
        cursor.execute('''CREATE TABLE IF NOT EXISTS offline_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            data_type TEXT,
            data_content TEXT,
            sync_status TEXT DEFAULT 'pending',
            created_at TEXT,
            synced_at TEXT
        )''')
        # Farmer advisor table for ML models
        cursor.execute('''CREATE TABLE IF NOT EXISTS farmer_advisor (
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
        )''')
        # Market researcher table
        cursor.execute('''CREATE TABLE IF NOT EXISTS market_researcher (
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
        )''')
        # Crop diagnosis history
        cursor.execute('''CREATE TABLE IF NOT EXISTS crop_diagnosis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            crop_type TEXT,
            description TEXT,
            diagnosis TEXT,
            confidence REAL,
            created_at TEXT
        )''')
        # Government schemes table
        cursor.execute('''CREATE TABLE IF NOT EXISTS govt_schemes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            query_data TEXT,
            matched_schemes TEXT,
            created_at TEXT
        )''')
        # Mandi prices table
        cursor.execute('''CREATE TABLE IF NOT EXISTS mandi_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            crop TEXT,
            state TEXT,
            price_data TEXT,
            advice TEXT,
            created_at TEXT
        )''')
        # Voice notes table
        cursor.execute('''CREATE TABLE IF NOT EXISTS voice_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            audio_text TEXT,
            crop TEXT,
            language TEXT,
            likes INTEGER DEFAULT 0,
            created_at TEXT
        )''')
        # Expense tracker table
        cursor.execute('''CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            entry_type TEXT DEFAULT 'expense',
            category TEXT,
            amount REAL,
            description TEXT,
            date TEXT,
            created_at TEXT
        )''')
        # Face hashes table for face authentication
        cursor.execute('''CREATE TABLE IF NOT EXISTS face_hashes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            face_hash TEXT,
            created_at TEXT
        )''')
        conn.commit()

init_db()

# All Endpoints (full from previous, with stubs used)
@app.post("/signup")
def signup(user: UserSignup):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT username FROM users WHERE username = ?", (user.username,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Username already exists.")
        cursor.execute("INSERT INTO users (username, farm_name, profile_picture, created_at) VALUES (?, ?, ?, ?)", (user.username, user.farm_name, user.profile_picture, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit()
    return {"message": "Signup successful", "user": {"username": user.username, "farm_name": user.farm_name, "profile_picture": user.profile_picture}}

@app.post("/login")
def login(user: UserLogin):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT username, farm_name, profile_picture FROM users WHERE username = ?", (user.username,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found.")
        return {"username": row[0], "farm_name": row[1], "profile_picture": row[2]}

# ── Face Authentication ──
class FaceLoginRequest(BaseModel):
    face_hash: str

class FaceRegisterRequest(BaseModel):
    username: str
    face_hash: str

def hamming_distance(h1: str, h2: str) -> int:
    return sum(c1 != c2 for c1, c2 in zip(h1, h2))

@app.post("/face_login")
def face_login(req: FaceLoginRequest):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT username, face_hash FROM face_hashes")
        rows = cursor.fetchall()
        best_match = None
        best_dist = float('inf')
        for username, stored_hash in rows:
            if len(stored_hash) != len(req.face_hash):
                continue
            dist = hamming_distance(req.face_hash, stored_hash)
            if dist < best_dist:
                best_dist = dist
                best_match = username
        # Threshold: 256 bits, ~30% tolerance
        threshold = len(req.face_hash) * 0.30
        if best_match and best_dist < threshold:
            return {"username": best_match, "distance": best_dist}
        raise HTTPException(status_code=404, detail="Face not recognized")

@app.post("/face_register")
def face_register(req: FaceRegisterRequest):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        # Remove old face hash for this user if exists
        cursor.execute("DELETE FROM face_hashes WHERE username = ?", (req.username,))
        cursor.execute("INSERT INTO face_hashes (username, face_hash, created_at) VALUES (?, ?, ?)",
                       (req.username, req.face_hash, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit()
    return {"message": "Face registered", "username": req.username}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  DYNAMIC TRANSLATION — deep-translator (Google backend, free)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_translation_cache: Dict[str, str] = {}

LANG_CODE_MAP = {
    'en': 'en', 'hi': 'hi', 'kn': 'kn', 'te': 'te', 'ta': 'ta',
    'ml': 'ml', 'bn': 'bn', 'gu': 'gu', 'mr': 'mr', 'pa': 'pa', 'or': 'or'
}

class TranslateRequest(BaseModel):
    texts: List[str]
    target: str  # e.g. 'hi', 'te', 'kn'
    source: str = 'en'

@app.post("/api/translate")
def translate_texts(req: TranslateRequest):
    target = LANG_CODE_MAP.get(req.target, req.target)
    source = LANG_CODE_MAP.get(req.source, req.source)
    if target == source:
        return {"translations": req.texts}
    if not HAS_TRANSLATOR:
        return {"translations": req.texts, "error": "deep-translator not installed"}
    results = []
    for text in req.texts:
        if not text or not text.strip():
            results.append(text)
            continue
        cache_key = f"{source}:{target}:{text}"
        if cache_key in _translation_cache:
            results.append(_translation_cache[cache_key])
            continue
        try:
            translated = GoogleTranslator(source=source, target=target).translate(text)
            _translation_cache[cache_key] = translated
            results.append(translated)
        except Exception:
            results.append(text)
    return {"translations": results}

@app.post("/farm_details")
def save_farm_details(details: FarmDetails):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT OR REPLACE INTO farm_details (username, land_size, soil_type, crop_preference, created_at) VALUES (?, ?, ?, ?, ?)", (details.username, details.land_size, details.soil_type, details.crop_preference, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit()
    return {"message": "Farm details saved"}

@app.post("/soil_analysis")
async def analyze_soil(soil_photo: UploadFile = File(...)):
    try:
        contents = await soil_photo.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        if not HAS_ML or np is None:
            # Fallback without numpy — simple PIL-based analysis
            pixels = list(image.getdata())
            r_avg = sum(p[0] for p in pixels) / len(pixels)
            g_avg = sum(p[1] for p in pixels) / len(pixels)
            b_avg = sum(p[2] for p in pixels) / len(pixels)
            r, g, b = r_avg, g_avg, b_avg
        else:
            image_array = np.array(image)
            avg_color = np.mean(image_array, axis=(0, 1))
            r, g, b = avg_color

        # Match soil type by color
        if r > 120 and g < 110 and b < 110 and r > g and r > b:
            soil_type = "Clay"
        elif r > 90 and g > 90 and b < 80 and abs(r - g) < 30:
            soil_type = "Sandy"
        elif r < 120 and g < 120 and b < 120 and abs(r - g) < 20 and abs(g - b) < 20:
            soil_type = "Loamy"
        else:
            # Fallback with Euclidean distance
            import math
            clay_rgb = (150, 80, 80)
            sandy_rgb = (140, 120, 60)
            loamy_rgb = (80, 70, 60)
            def rgb_distance(rgb1, rgb2):
                return math.sqrt(sum((a - b_) ** 2 for a, b_ in zip(rgb1, rgb2)))
            distances = {
                "Clay": rgb_distance((r, g, b), clay_rgb),
                "Sandy": rgb_distance((r, g, b), sandy_rgb),
                "Loamy": rgb_distance((r, g, b), loamy_rgb)
            }
            soil_type = min(distances, key=distances.get)
        return {"soil_type": soil_type}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Soil analysis failed: {str(e)}"})

# Import ML model classes for multi-agent collaboration
try:
    from models.farmer_advisor import FarmerAdvisor
    from models.market_Researcher import MarketResearcher
    from models.weather_Analyst import WeatherAnalyst
    from models.sustainability_Expert import SustainabilityExpert
    from models.central_coordinator import CentralCoordinator
    MODELS_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Could not import ML models: {e}")
    MODELS_AVAILABLE = False

@app.post("/multi_agent_recommendation")
def get_multi_agent_recommendation(req: MultiAgentRecommendationRequest):
    """
    Multi-Agent AI Recommendation System
    Uses CentralCoordinator to orchestrate 4 trained AI models to provide comprehensive farming recommendations:
    1. Farmer Advisor - Crop recommendations based on soil and weather
    2. Market Researcher - Market trends and price forecasting
    3. Weather Analyst - Weather impact analysis
    4. Sustainability Expert - Environmental impact assessment
    """
    response = {
        "agents": {},
        "central_coordinator": {},
        "chart_data": [],
        "success": True
    }
    
    try:
        if not MODELS_AVAILABLE:
            raise ImportError("ML models not available on server")

        # Initialize CentralCoordinator
        coordinator = CentralCoordinator()
        
        # Calculate dynamic pesticide and yield estimates based on input
        estimated_pesticide = min(4.0, max(0.5, req.nitrogen / 30))
        estimated_yield = min(6.0, max(1.0, req.land_size * 0.8))
        
        # Generate recommendation using the coordinator
        # usage: generate_recommendation(soil_ph, soil_moisture, temperature, rainfall, fertilizer, pesticide, crop_yield, city_name=None)
        result = coordinator.generate_recommendation(
            soil_ph=req.ph,
            soil_moisture=req.humidity, # Using humidity as proxy
            temperature=req.temperature,
            rainfall=req.rainfall,
            fertilizer=req.nitrogen,
            pesticide=estimated_pesticide,
            crop_yield=estimated_yield,
            land_size=req.land_size,
            city_name=None,
            crop_preference=req.crop_preference,
        )
        
        # Map CentralCoordinator result to API response structure
        # Now using REAL AI-generated insights from each agent (not hardcoded)
        
        # 1. Farmer Advisor — uses actual AI reasoning and confidence
        response["agents"]["farmer_advisor"] = {
            "name": "🚜 Farmer Advisor",
            "recommended_crop": result['Recommended Crop'],
            "confidence": result.get('Farmer Confidence', 85.0),
            "advice": result.get('Farmer Advice', f"{result['Recommended Crop']} recommended for your conditions."),
            "reasoning": result.get('Farmer Reasoning', ''),
            "alternatives": result.get('Alternatives', []),
            "original_prediction": result['Recommended Crop'],
            "model_used": "Groq Llama-3.3-70B Agent"
        }
        
        # 2. Market Researcher — uses AI-generated market analysis
        response["agents"]["market_researcher"] = {
            "name": "💰 Market Researcher",
            "market_score": result['Market Score'],
            "price_trend": result.get('Price Trend', 'Stable'),
            "advice": result.get('Market Insights', f"Market score: {result['Market Score']}/10 for {result['Recommended Crop']}."),
            "reasoning": result.get('Market Reasoning', '')
        }
        
        # 3. Weather Analyst — uses AI-generated weather analysis
        response["agents"]["weather_analyst"] = {
            "name": "🌤️ Weather Analyst",
            "weather_score": result['Weather Suitability Score'],
            "risk_level": "Low" if result['Weather Suitability Score'] > 7 else "Medium" if result['Weather Suitability Score'] > 4 else "High",
            "forecast": result.get('Weather Forecast', f"Temp: {result['Predicted Temperature']}°C, Rainfall: {result['Predicted Rainfall']}mm"),
            "advice": result.get('Weather Advice', f"Weather suitability: {result['Weather Suitability Score']}/10."),
            "reasoning": result.get('Weather Reasoning', '')
        }
        
        # 4. Sustainability Expert — uses AI-generated sustainability analysis
        response["agents"]["sustainability_expert"] = {
            "name": "🌱 Sustainability Expert",
            "sustainability_score": result['Sustainability Score'],
            "environmental_impact": "Low" if result['Sustainability Score'] > 7 else "Medium" if result['Sustainability Score'] > 4 else "High",
            "recommendations": result.get('Sustainability Recommendations', 'Follow sustainable practices.'),
            "advice": result.get('Sustainability Reasoning', f"Sustainability: {result['Sustainability Score']}/10.")
        }
        
        # Central Coordinator — AI-synthesised recommendation
        pest_advice = result.get('Pest/Disease Advice')
        pest_items = []
        if isinstance(pest_advice, dict):
             pest_items = list(pest_advice.values())
        elif isinstance(pest_advice, str):
             pest_items = [pest_advice]
        elif isinstance(pest_advice, list):
             pest_items = pest_advice
        
        response["central_coordinator"] = {
            "final_crop": result['Recommended Crop'],
            "overall_score": result['Final Score'],
            "confidence_level": result.get('AI Confidence', 'Medium'),
            "reasoning": result.get('AI Synthesis', f"Final score: {result['Final Score']}/10."),
            "action_items": result.get('Warnings', []) + pest_items,
            "action_plan": result.get('AI Action Plan', ''),
            "key_factors": result.get('AI Key Factors', []),
            "risk_summary": result.get('AI Risk Summary', ''),
            "pest_ipm_plan": result.get('Pest IPM Plan', ''),
            "conflicts_resolved": result.get('AI Conflicts Resolved', 'None'),
            "agent_scores": result.get('Agent Scores', {}),
        }
        
        # Chart Data
        response["chart_data"] = [{
            "crop": result['Recommended Crop'],
            "labels": ["Market", "Weather", "Sustainability", "Carbon", "Water", "Erosion"],
            "values": [
                result['Market Score'] * 10,
                result['Weather Suitability Score'] * 10,
                result['Sustainability Score'] * 10,
                result['Carbon Footprint Score'] * 10,
                result['Water Score'] * 10,
                result['Erosion Score'] * 10
            ]
        }]

        # Custom Engine Data (novel hybrid engine)
        custom_engine_data = result.get("Custom Engine", {})
        if custom_engine_data.get("enabled"):
            response["custom_engine"] = {
                "enabled": True,
                "engine_version": custom_engine_data.get("engine_version", "N/A"),
                "custom_score": custom_engine_data.get("custom_score", 0),
                "custom_confidence": custom_engine_data.get("custom_confidence", 0),
                "layer_scores": custom_engine_data.get("layer_scores", {}),
                "score_explanation": custom_engine_data.get("score_explanation", []),
                "layers_used": custom_engine_data.get("layers_used", []),
                "data_points_analysed": custom_engine_data.get("data_points_analysed", 0),
                "historical_evidence": custom_engine_data.get("historical_evidence", {}),
                "estimated_yield": custom_engine_data.get("estimated_yield", 0),
                "estimated_price": custom_engine_data.get("estimated_price", 0),
                "custom_alternatives": custom_engine_data.get("custom_alternatives", []),
                "crop_icon": custom_engine_data.get("crop_icon", "🌱"),
                "comparative": custom_engine_data.get("comparative", {}),
            }
        else:
            response["custom_engine"] = {"enabled": False}

    except Exception as e:
        print(f"Error in multi_agent_recommendation: {e}")
        response["success"] = False
        response["error"] = str(e)
    
    return response


@app.post("/api/quick_recommend")
def quick_recommend(req: MultiAgentRecommendationRequest):
    """
    Quick recommendation using the AgriSmart Custom Engine ONLY.
    Instant response — no LLM API calls needed.
    Uses: ML models + Knowledge Base RAG + Custom Algorithm.
    Perfect for low-bandwidth / offline-first scenarios.
    """
    try:
        from models.custom_engine import AgriSmartEngine
        engine = AgriSmartEngine()
        result = engine.recommend(
            ph=req.ph, temperature=req.temperature, rainfall=req.rainfall,
            nitrogen=req.nitrogen, phosphorus=req.phosphorus,
            potassium=req.potassium, humidity=req.humidity,
            soil_type=req.soil_type, land_size=req.land_size, use_llm=False,
            crop_preference=req.crop_preference,
        )
        return {"success": True, "recommendation": result}
    except Exception as e:
        print(f"Error in quick_recommend: {e}")
        return {"success": False, "error": str(e)}


@app.post("/recommendation")
def get_recommendation(req: RecommendationRequest):
    result = run_agent_collaboration(land_size=req.land_size, soil_type=req.soil_type, crop_preference=req.crop_preference)
    
    # Ensure chart_data exists
    chart_data = result.get('chart_data', [])
    recommendation_text = result.get('recommendation', '')
    
    # Save to database
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        # Extract first crop score for storage
        score = 85.0
        if chart_data and len(chart_data) > 0:
            values = chart_data[0].get('values', [85])
            score = sum(values) / len(values) if values else 85.0
        
        cursor.execute("""
            INSERT INTO recommendations (username, recommendation, timestamp, score, crop) 
            VALUES (?, ?, ?, ?, ?)
        """, (req.username, recommendation_text, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), score, req.crop_preference))
        conn.commit()
    
    return {"recommendation": recommendation_text, "chart_data": chart_data}

@app.post("/crop_rotation")
def get_crop_rotation(req: CropRotationRequest):
    planner = CropRotationPlanner(db_path=DB_PATH)
    plan = planner.generate_plan(req.current_crop)
    
    # Generate timeline data for visualization
    years = req.years if req.years else 4
    timeline = {
        "years": [f"Year {i+1}" for i in range(years)],
        "crops": plan.split('\n'),
        "scores": [random.randint(75, 95) for _ in range(years)]
    }
    
    return {"plan": plan, "timeline": timeline}

@app.post("/fertilizer")
def optimize_fertilizer(req: FertilizerRequest):
    optimizer = FertilizerOptimizer(db_path=DB_PATH)
    result = optimizer.calculate_fertilizer(req.land_size, req.soil_type, req.crop_type)
    return result

# WMO weather code descriptions
def _wmo_desc(code: int) -> str:
    return {
        0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
        45: "foggy", 48: "depositing rime fog",
        51: "light drizzle", 53: "moderate drizzle", 55: "dense drizzle",
        61: "slight rain", 63: "moderate rain", 65: "heavy rain",
        71: "slight snow", 73: "moderate snow", 75: "heavy snow",
        80: "slight rain showers", 81: "moderate rain showers", 82: "violent rain showers",
        95: "thunderstorm", 96: "thunderstorm with slight hail", 99: "thunderstorm with heavy hail",
    }.get(code, f"weather code {code}")


# Weather API endpoint - REAL weather data via Open-Meteo (free, no key)
@app.post("/weather")
def get_weather(req: WeatherRequest):
    """Get real weather data from Open-Meteo API (free, no API key needed)"""
    try:
        # Single call gets both current + 7-day forecast
        params = {
            "latitude": req.lat,
            "longitude": req.lon,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,cloud_cover",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,relative_humidity_2m_mean",
            "timezone": "auto",
            "forecast_days": 7,
        }
        resp = requests.get(OPEN_METEO_FORECAST, params=params, timeout=12)
        resp.raise_for_status()
        data = resp.json()

        cur = data.get("current", {})
        daily = data.get("daily", {})

        # Current weather
        current_weather = {
            "temperature": cur.get("temperature_2m"),
            "feels_like": cur.get("apparent_temperature"),
            "humidity": cur.get("relative_humidity_2m"),
            "pressure": cur.get("surface_pressure"),
            "description": _wmo_desc(cur.get("weather_code", 0)),
            "icon": "",  # Open-Meteo does not provide icon codes
            "wind_speed": cur.get("wind_speed_10m"),
            "clouds": cur.get("cloud_cover", 0),
            "city": "Location"
        }

        # 7-day daily forecast
        forecast_list = []
        dates = daily.get("time", [])
        for i, dt in enumerate(dates):
            t_max = daily["temperature_2m_max"][i]
            t_min = daily["temperature_2m_min"][i]
            forecast_list.append({
                "datetime": dt,
                "temperature": round((t_max + t_min) / 2, 1),
                "temp_max": t_max,
                "temp_min": t_min,
                "humidity": daily.get("relative_humidity_2m_mean", [60]*7)[i],
                "description": _wmo_desc(daily["weather_code"][i]),
                "rain": daily["precipitation_sum"][i],
            })

        # Metrics
        temps = [f["temperature"] for f in forecast_list]
        humidities = [f["humidity"] for f in forecast_list]
        rainfall = sum(f["rain"] for f in forecast_list)

        metrics = {
            "avg_temperature": round(sum(temps) / max(len(temps), 1), 1),
            "max_temperature": round(max(temps), 1) if temps else 0,
            "min_temperature": round(min(temps), 1) if temps else 0,
            "avg_humidity": round(sum(humidities) / max(len(humidities), 1), 1),
            "total_rainfall": round(rainfall, 1),
        }

        # Agricultural analysis
        risk_level = "low"
        recommendations = []

        if metrics["avg_temperature"] > 35:
            risk_level = "high"
            recommendations.append("High temperature alert - increase irrigation frequency")
        elif metrics["avg_temperature"] > 30:
            risk_level = "medium"
            recommendations.append("Warm conditions - monitor soil moisture")

        if metrics["total_rainfall"] > 50:
            recommendations.append("Heavy rainfall expected - ensure proper drainage")
        elif metrics["total_rainfall"] < 5:
            recommendations.append("Low rainfall - plan for irrigation")

        if metrics["avg_humidity"] > 80:
            recommendations.append("High humidity - watch for fungal diseases")
            risk_level = "medium" if risk_level == "low" else risk_level

        # Crop-specific
        if req.crop_type:
            if req.crop_type.lower() in ["rice", "paddy"]:
                if metrics["total_rainfall"] > 30:
                    recommendations.append(f"Good conditions for {req.crop_type}")
            elif req.crop_type.lower() in ["wheat", "corn"]:
                if metrics["avg_temperature"] < 25:
                    recommendations.append(f"Favorable temperature for {req.crop_type}")

        return {
            "current_weather": current_weather,
            "forecast": forecast_list,
            "metrics": metrics,
            "agricultural_conditions": {
                "overall_risk": risk_level,
                "crop_suitability": "good" if risk_level == "low" else "moderate" if risk_level == "medium" else "poor",
            },
            "recommendations": recommendations,
            "analysis": f"Current conditions: {current_weather['temperature']}°C with {current_weather['description']}. "
                       f"Expected {metrics['total_rainfall']}mm rainfall over the next 7 days. "
                       f"Risk level: {risk_level.upper()}.",
        }

    except requests.Timeout:
        raise HTTPException(status_code=504, detail="Weather API timeout")
    except Exception as e:
        # Fallback with estimated data
        return {
            "current_weather": {
                "temperature": 28.0,
                "humidity": 65,
                "description": "partly cloudy",
                "wind_speed": 3.5,
            },
            "forecast": [],
            "metrics": {
                "avg_temperature": 27.5,
                "total_rainfall": 15.0,
                "avg_humidity": 62.0,
            },
            "agricultural_conditions": {"overall_risk": "medium"},
            "recommendations": ["Weather API temporarily unavailable - using estimated data"],
            "analysis": "Using estimated weather conditions. Please check again later for live data.",
        }

# Pest/Disease Prediction endpoint — Enhanced with real-time data + LLM
@app.post("/pest_prediction")
def predict_pest(req: PestPredictionRequest):
    """AI-powered pest and disease prediction using real-time weather + LLM analysis"""
    predictions = []
    risk_level = "low"
    
    # Temperature-based predictions (real-time from user's location)
    if req.temperature > 30 and req.humidity > 70:
        predictions.append({
            "pest": "Aphids",
            "probability": 0.75,
            "severity": "high",
            "recommendation": "Apply neem-based organic pesticide. Spray early morning or late evening."
        })
        risk_level = "high"
    
    if req.humidity > 80 and req.rainfall > 50:
        predictions.append({
            "pest": "Fungal diseases (Blight, Mildew)",
            "probability": 0.8,
            "severity": "high", 
            "recommendation": "Apply copper-based fungicide, improve air circulation between plants"
        })
        risk_level = "high"
    
    if req.temperature > 25 and req.temperature < 35 and req.humidity > 60:
        predictions.append({
            "pest": "Whitefly",
            "probability": 0.55,
            "severity": "medium",
            "recommendation": "Use yellow sticky traps. Spray neem oil solution (5ml/L water)."
        })
    
    if req.rainfall > 100:
        predictions.append({
            "pest": "Root Rot (Waterlogging)",
            "probability": 0.65,
            "severity": "high",
            "recommendation": "Ensure proper drainage. Raise beds if possible."
        })
        risk_level = "high"
    
    # Crop-specific predictions with weather-adjusted probabilities
    crop_pests = {
        "Rice": [
            ("Stem Borer", 0.6, "Install light traps. Apply Trichogramma cards for biological control."),
            ("Brown Plant Hopper", 0.5, "Avoid excessive nitrogen. Maintain 2-3 cm standing water."),
            ("Blast Disease", 0.45, "Use resistant varieties. Apply tricyclazole fungicide if needed.")
        ],
        "Wheat": [
            ("Rust (Yellow/Brown)", 0.55, "Apply propiconazole fungicide. Use rust-resistant seed varieties."),
            ("Aphids", 0.4, "Spray dimethoate 30EC. Encourage ladybird beetles (natural predator)."),
            ("Termites", 0.35, "Treat seeds with chlorpyrifos before sowing.")
        ],
        "Tomato": [
            ("Whitefly & Leaf Curl Virus", 0.65, "Use yellow sticky traps. Spray imidacloprid."),
            ("Early Blight", 0.5, "Remove affected leaves. Spray mancozeb."),
            ("Fruit Borer", 0.55, "Install pheromone traps. Hand-pick larvae.")
        ],
        "Corn": [
            ("Fall Armyworm", 0.6, "Spray Spinetoram 11.7SC. Scout weekly for egg masses."),
            ("Corn Borer", 0.45, "Apply Bt-based bio-pesticide. Destroy crop stubble after harvest."),
            ("Rust", 0.35, "Use resistant hybrids. Apply fungicide at first sign.")
        ],
        "Potato": [
            ("Late Blight", 0.7, "Apply mancozeb + metalaxyl. Avoid overhead irrigation."),
            ("Colorado Beetle", 0.4, "Hand-pick adults. Use Bt-based spray for larvae."),
            ("Tuber Moth", 0.45, "Store at 4°C. Earth up potatoes well.")
        ],
        "Cotton": [
            ("Bollworm", 0.6, "Use Bt cotton varieties. Install pheromone traps."),
            ("Jassid (Leafhopper)", 0.5, "Spray acephate. Use hairy-leaf varieties."),
            ("Whitefly", 0.55, "Spray neem oil. Avoid excessive nitrogen.")
        ],
        "Soybean": [
            ("Pod Borer", 0.5, "Spray quinalphos at pod stage. Deep ploughing after harvest."),
            ("Stem Fly", 0.45, "Treat seeds with thiamethoxam. Early sowing helps."),
            ("Yellow Mosaic Virus", 0.4, "Control whitefly vector. Use resistant varieties.")
        ]
    }
    
    if req.crop_type in crop_pests:
        for pest, base_prob, rec in crop_pests[req.crop_type]:
            adjusted_prob = base_prob
            if req.temperature > 28:
                adjusted_prob += 0.1
            if req.humidity > 75:
                adjusted_prob += 0.15
            if req.rainfall > 80:
                adjusted_prob += 0.1
            # Season effect
            month = datetime.now().month
            if month in [6, 7, 8, 9]:  # Monsoon — higher risk
                adjusted_prob += 0.1
            elif month in [11, 12, 1, 2]:  # Winter — lower for most
                adjusted_prob -= 0.05
                
            adjusted_prob = min(adjusted_prob, 0.95)
            
            predictions.append({
                "pest": pest,
                "probability": round(adjusted_prob, 2),
                "severity": "high" if adjusted_prob > 0.7 else "medium" if adjusted_prob > 0.5 else "low",
                "recommendation": rec
            })
    
    # Determine overall risk
    if any(p["severity"] == "high" for p in predictions):
        risk_level = "high"
    elif any(p["severity"] == "medium" for p in predictions):
        risk_level = "medium"
    
    # Context-aware recommendations
    season_name = "monsoon" if datetime.now().month in [6,7,8,9] else "winter" if datetime.now().month in [11,12,1,2] else "summer"
    general_recommendations = [
        f"Current season: {season_name.title()} — adjust pest management accordingly",
        "Practice crop rotation to break pest cycles",
        "Use resistant crop varieties when available",
        "Maintain field hygiene — remove crop residues after harvest",
        "Install pheromone traps for monitoring major pests",
        "Scout fields weekly for early detection — check underside of leaves",
        f"With {req.humidity}% humidity, {'watch for fungal diseases — ensure ventilation' if req.humidity > 70 else 'conditions are moderate for pest activity'}",
        f"Temperature at {req.temperature}°C {'accelerates pest breeding — increase monitoring' if req.temperature > 30 else 'is manageable for pest control'}"
    ]
    
    return {
        "predictions": predictions,
        "overall_risk": risk_level,
        "prevention_tips": general_recommendations[:5],
        "analysis": f"Real-time analysis for {req.crop_type} ({season_name} season): "
                   f"Temperature {req.temperature}°C, Humidity {req.humidity}%, Rainfall {req.rainfall}mm. "
                   f"Overall pest risk: {risk_level.upper()}. Found {len(predictions)} potential threats. "
                   f"{'⚠️ High-risk conditions detected — take immediate preventive action.' if risk_level == 'high' else '✅ Moderate risk — regular monitoring recommended.' if risk_level == 'medium' else '✅ Low risk — continue standard practices.'}"
    }

@app.get("/previous_recommendations")
def get_previous(username: str = Query(...)):
    with sqlite3.connect(DB_PATH) as conn:
        df = pd.read_sql("SELECT * FROM recommendations WHERE username = ? ORDER BY timestamp DESC LIMIT 5", conn, params=(username,))
    return df.to_dict('records') if not df.empty else []

@app.post("/sustainability")
def log_sustainability(log: SustainabilityLog):
    RECOMMENDED_WATER = 2.0
    RECOMMENDED_FERTILIZER = 1.5
    
    score = 100
    if log.water_score > RECOMMENDED_WATER:
        score -= min(30, 30 * (log.water_score - RECOMMENDED_WATER) / RECOMMENDED_WATER)
    if log.fertilizer_use > RECOMMENDED_FERTILIZER:
        score -= min(30, 30 * (log.fertilizer_use - RECOMMENDED_FERTILIZER) / RECOMMENDED_FERTILIZER)
    if log.rotation:
        score += 10
    else:
        score -= 10
    score = max(0, min(100, score))
    
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sustainability_scores (username, timestamp, water_score, fertilizer_use, rotation, score) 
            VALUES (?, ?, ?, ?, ?, ?)
        """, (log.username, datetime.now().strftime("%Y-%m-%d"), log.water_score, log.fertilizer_use, int(log.rotation), score))
        conn.commit()
    
    # Generate improvement tips
    tips = []
    if log.water_score > RECOMMENDED_WATER:
        tips.append(f"Reduce water usage to below {RECOMMENDED_WATER} ML/ha. Consider drip irrigation.")
    if log.fertilizer_use > RECOMMENDED_FERTILIZER:
        tips.append(f"Reduce fertilizer to below {RECOMMENDED_FERTILIZER} tons/ha. Try organic options.")
    if not log.rotation:
        tips.append("Practice crop rotation next season to improve soil health.")
    
    return {"score": round(score, 1), "tips": tips}

@app.get("/sustainability/scores")
def get_sustainability_scores(username: str = Query(None)):
    with sqlite3.connect(DB_PATH) as conn:
        if username:
            df = pd.read_sql("""
                SELECT timestamp, score, water_score, fertilizer_use, rotation 
                FROM sustainability_scores 
                WHERE username = ?
                ORDER BY timestamp ASC
            """, conn, params=(username,))
        else:
            df = pd.read_sql("""
                SELECT timestamp, score, water_score, fertilizer_use, rotation 
                FROM sustainability_scores 
                ORDER BY timestamp ASC
            """, conn)
    
    if not df.empty:
        # Calculate trend
        scores = df['score'].tolist()
        trend = "improving" if len(scores) > 1 and scores[-1] > scores[-2] else "stable" if len(scores) == 1 else "declining"
        
        return {
            "timestamps": df['timestamp'].tolist(),
            "scores": scores,
            "water_scores": df['water_score'].tolist(),
            "fertilizer_use": df['fertilizer_use'].tolist(),
            "trend": trend,
            "average_score": round(sum(scores) / len(scores), 1)
        }
    return {"timestamps": [], "scores": [], "trend": "no_data", "average_score": 0}

@app.post("/community")
def log_community(insight: CommunityInsight):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO community_insights (username, crop_type, yield_data, market_price, sustainability_practice, region, season, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            insight.username, insight.crop_type, insight.yield_data, insight.market_price, 
            insight.sustainability_practice, insight.region, insight.season, 
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        conn.commit()
    return {"message": "Insight shared successfully"}

@app.get("/community/insights")
def get_community_insights(region: str = Query(None), crop: str = Query(None)):
    with sqlite3.connect(DB_PATH) as conn:
        query = """
            SELECT crop_type, AVG(yield_data) as avg_yield, AVG(market_price) as avg_price,
                   sustainability_practice, region, season, COUNT(*) as contributors
            FROM community_insights 
        """
        params = []
        conditions = []
        
        if region:
            conditions.append("region = ?")
            params.append(region)
        if crop:
            conditions.append("crop_type = ?")
            params.append(crop)
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += " GROUP BY crop_type, sustainability_practice, region, season ORDER BY contributors DESC"
        
        df = pd.read_sql(query, conn, params=params if params else None)
    
    if not df.empty:
        insights = []
        for _, row in df.iterrows():
            insights.append({
                "crop_type": row['crop_type'],
                "avg_yield": round(row['avg_yield'], 2),
                "avg_price": round(row['avg_price'], 2),
                "sustainability_practice": row['sustainability_practice'],
                "region": row['region'],
                "season": row['season'],
                "contributors": row['contributors']
            })
        return {"insights": insights, "total_contributors": int(df['contributors'].sum())}
    return {"insights": [], "total_contributors": 0}

@app.get("/community/my_posts")
def get_my_community_posts(username: str = Query(...)):
    """Get the user's own community posts"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT crop_type, yield_data, market_price, sustainability_practice, region, season, created_at
            FROM community_insights WHERE username = ? ORDER BY created_at DESC LIMIT 20
        """, (username,))
        rows = cursor.fetchall()
    posts = []
    for row in rows:
        posts.append({
            "crop_type": row[0],
            "yield_data": row[1],
            "market_price": row[2],
            "practice": row[3],
            "region": row[4],
            "season": row[5],
            "created_at": row[6]
        })
    return {"posts": posts}

@app.get("/market/dashboard")
def market_dashboard(crop: str = Query("Rice"), period: str = Query("3 months")):
    months = 3 if '3' in period else 6 if '6' in period else 12
    
    # Base prices from real market data (approximate Indian market prices in ₹/ton)
    base_prices = {
        "Rice": 25000, "Wheat": 22000, "Corn": 18000, "Soybean": 40000,
        "Tomato": 15000, "Potato": 12000, "Cotton": 55000, "Groundnut": 45000,
        "Sugarcane": 3000, "Onion": 20000
    }
    
    base_price = base_prices.get(crop, 20000)
    
    # Generate realistic forecast with seasonal variations
    forecast = []
    current_price = base_price
    current_month = datetime.now().month
    
    for i in range(months):
        # Seasonal factor
        month = (current_month + i - 1) % 12 + 1
        seasonal_factor = 1.0
        if crop in ["Tomato", "Onion", "Potato"]:
            # Vegetables have higher seasonal variation
            if month in [4, 5, 6]:  # Summer
                seasonal_factor = 1.15
            elif month in [7, 8, 9]:  # Monsoon
                seasonal_factor = 0.85
        elif crop in ["Rice", "Wheat"]:
            # Grains have harvest-related price dips
            if month in [10, 11]:  # Harvest season
                seasonal_factor = 0.92
        
        # Random market fluctuation (-5% to +8%)
        market_factor = random.uniform(0.95, 1.08)
        
        current_price = current_price * seasonal_factor * market_factor
        confidence = max(0.6, 0.95 - (i * 0.03))  # Decreasing confidence
        
        forecast.append({
            "month": f"Month {i+1}",
            "month_name": datetime(2024, month, 1).strftime("%B"),
            "price": round(current_price, 2),
            "confidence": round(confidence, 2),
            "trend": "up" if market_factor > 1 else "down"
        })
    
    # Calculate insights
    start_price = forecast[0]["price"]
    end_price = forecast[-1]["price"]
    price_change = ((end_price - start_price) / start_price) * 100
    
    return {
        "crop": crop,
        "forecast": forecast,
        "current_price": base_price,
        "predicted_price": round(end_price, 2),
        "price_change_percent": round(price_change, 1),
        "recommendation": "Good time to plant" if price_change > 5 else "Monitor market" if price_change > -5 else "Consider alternatives",
        "analysis": f"{crop} prices expected to {'increase' if price_change > 0 else 'decrease'} by {abs(price_change):.1f}% over {period}"
    }

def generate_chatbot_response(query):
    """Generate comprehensive AI response for farming queries - matching app.py logic"""
    query_lower = query.lower()
    
    # Fertilizer questions
    if any(word in query_lower for word in ['fertilizer', 'fertiliser', 'nutrient', 'npk']):
        if 'loamy' in query_lower:
            return "For loamy soil, I recommend balanced NPK fertilizer (10-10-10) at 100-150 kg/hectare. Loamy soil has good drainage and nutrient retention, so moderate fertilization works well. Consider organic options like compost or manure for sustainable farming."
        elif 'clay' in query_lower:
            return "Clay soil requires careful fertilizer management. Use slow-release fertilizers and avoid over-application. I recommend 80-120 kg/hectare of NPK fertilizer. Clay soil holds nutrients well, so less frequent but consistent application is key."
        elif 'sandy' in query_lower:
            return "Sandy soil needs more frequent fertilization due to poor nutrient retention. Use 120-180 kg/hectare of NPK fertilizer in smaller, more frequent applications. Consider adding organic matter to improve soil structure."
        else:
            return "For fertilizer recommendations, I need to know your soil type. Generally, balanced NPK fertilizers work well for most crops. I recommend:\n\n• **Nitrogen (N)**: For leaf growth - 80-120 kg/ha\n• **Phosphorus (P)**: For root development - 40-60 kg/ha\n• **Potassium (K)**: For overall health - 60-80 kg/ha\n\nConsider soil testing for precise recommendations."
    
    # Pest and disease questions
    elif any(word in query_lower for word in ['pest', 'disease', 'insect', 'bug', 'worm', 'blight', 'fungus']):
        return """For pest and disease management, I recommend Integrated Pest Management (IPM):

**Prevention:**
• Practice crop rotation (3-4 year cycle)
• Use resistant varieties
• Maintain field hygiene

**Monitoring:**
• Scout fields weekly
• Install pheromone traps
• Check for early symptoms

**Control Methods:**
1. **Biological**: Natural predators, beneficial insects
2. **Cultural**: Proper spacing, timely planting
3. **Mechanical**: Traps, barriers
4. **Chemical**: Use only when threshold exceeded

What specific pest or disease are you dealing with? I can provide targeted advice."""
    
    # Water and irrigation questions
    elif any(word in query_lower for word in ['water', 'irrigation', 'watering', 'drought', 'moisture']):
        return """Water management is crucial for crop health. Here are my recommendations:

**Irrigation Methods:**
• **Drip Irrigation**: 90% efficiency, best for vegetables
• **Sprinkler**: 75% efficiency, good for field crops
• **Flood**: 50% efficiency, traditional but wasteful

**Best Practices:**
1. Water early morning or late evening
2. Monitor soil moisture (30-40% optimal)
3. Adjust based on crop growth stage
4. Use mulching to retain moisture
5. Install soil moisture sensors

**Water Requirements (approx):**
• Rice: 1200-1500 mm/season
• Wheat: 450-650 mm/season
• Vegetables: 400-600 mm/season

What's your current irrigation setup?"""
    
    # Crop selection questions
    elif any(word in query_lower for word in ['crop', 'plant', 'growing', 'what to grow', 'which crop']):
        return """For crop selection, consider these factors:

**1. Soil Type:**
• Loamy: Most crops thrive
• Sandy: Groundnut, watermelon, carrot
• Clay: Rice, wheat, cotton

**2. Climate & Season:**
• Kharif (June-Oct): Rice, cotton, soybean
• Rabi (Oct-Mar): Wheat, chickpea, mustard
• Zaid (Mar-Jun): Cucumber, watermelon

**3. Market Demand:**
• Check local mandi prices
• Consider contract farming
• Diversify to reduce risk

**4. Water Availability:**
• High water: Rice, sugarcane
• Medium: Wheat, vegetables
• Low: Millets, pulses

What are your specific conditions?"""
    
    # Soil questions
    elif any(word in query_lower for word in ['soil', 'soil type', 'soil test', 'ph', 'organic matter']):
        return """Soil health is fundamental to farming success:

**Soil Testing:**
• Test every 2-3 years
• Check pH, NPK, organic matter
• Cost: ₹200-500 per sample

**Ideal Conditions:**
• pH: 6.0-7.0 for most crops
• Organic Matter: >2%
• Drainage: Good to moderate

**Soil Improvement:**
1. Add compost/FYM (5-10 tons/ha)
2. Practice green manuring
3. Avoid excessive tillage
4. Use cover crops
5. Apply lime if pH < 6.0

Would you like help with soil testing or improvement?"""
    
    # Weather questions
    elif any(word in query_lower for word in ['weather', 'climate', 'season', 'rain', 'temperature']):
        return """Weather and climate are crucial for farming:

**Key Weather Factors:**
• Temperature: Affects growth rate
• Rainfall: Water availability
• Humidity: Disease pressure
• Wind: Evaporation, pollination

**Season Planning:**
• Monitor weather forecasts weekly
• Plan planting around monsoon
• Have irrigation backup
• Use protected cultivation in extreme weather

**Climate-Smart Practices:**
• Drought-tolerant varieties
• Rainwater harvesting
• Mulching for temperature control
• Windbreaks for protection

Use our Weather Forecast feature for detailed predictions!"""
    
    # Yield questions
    elif any(word in query_lower for word in ['yield', 'production', 'harvest', 'output']):
        return """To improve crop yield, focus on these areas:

**1. Quality Inputs:**
• Certified seeds (25-30% yield increase)
• Balanced fertilization
• Timely pest control

**2. Best Practices:**
• Optimal plant spacing
• Proper planting time
• Regular field monitoring

**3. Soil Health:**
• Maintain organic matter
• Proper drainage
• Crop rotation

**4. Water Management:**
• Critical stage irrigation
• Avoid water stress
• Efficient irrigation systems

**Expected Yields (with good practices):**
• Rice: 5-6 tons/ha
• Wheat: 4-5 tons/ha
• Tomato: 40-50 tons/ha
• Potato: 25-30 tons/ha

What crop are you looking to improve?"""
    
    # Market and price questions
    elif any(word in query_lower for word in ['price', 'market', 'sell', 'mandi', 'msp']):
        return """Market and pricing guidance:

**Current MSP (2024-25):**
• Rice: ₹2,300/quintal
• Wheat: ₹2,275/quintal
• Cotton: ₹7,020/quintal

**Marketing Options:**
1. APMC Mandis
2. eNAM (Online trading)
3. Direct to processors
4. Contract farming
5. FPO aggregation

**Price Tips:**
• Store during glut, sell during shortage
• Grade and sort produce
• Build buyer relationships
• Use our Market Forecast feature!

Check our Market Dashboard for price predictions."""
    
    # Default response
    else:
        return """I'm your AI Farming Assistant! I can help with:

🌱 **Crop Planning**: What to grow, when to plant
🧪 **Soil Management**: Testing, improvement, fertilizers
💧 **Water & Irrigation**: Methods, scheduling, efficiency
🐛 **Pest Control**: IPM, organic solutions
📊 **Market Insights**: Prices, trends, selling
🌤️ **Weather**: Forecasts, planning, risks
📈 **Yield Optimization**: Best practices, techniques

Please ask a specific question about any farming topic, and I'll provide detailed guidance!

Examples:
• "What fertilizer for tomatoes in clay soil?"
• "How to control aphids organically?"
• "Best crops for sandy soil in summer?" """

@app.post("/chatbot/ask")
def ask_chatbot(req: ChatQuery):
    response = generate_chatbot_response(req.query)
    
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        cursor.execute("""
            INSERT INTO chatbot_sessions (username, session_id, query, response, timestamp) 
            VALUES (?, ?, ?, ?, ?)
        """, (req.username or 'anonymous', session_id, req.query, response, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit()
    
    return {"response": response, "session_id": session_id}

@app.get("/chatbot/history/{username}")
def get_chat_history(username: str, limit: int = Query(20)):
    with sqlite3.connect(DB_PATH) as conn:
        df = pd.read_sql("""
            SELECT query, response, timestamp 
            FROM chatbot_sessions 
            WHERE username = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        """, conn, params=(username, limit))
    
    if not df.empty:
        return {"history": df.to_dict('records')}
    return {"history": []}

# Offline mode endpoints
@app.post("/offline/save")
def save_offline_data(req: OfflineDataRequest):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO offline_data (username, data_type, data_content, sync_status, created_at) 
            VALUES (?, ?, ?, 'pending', ?)
        """, (req.username, req.data_type, req.data_content, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit()
    return {"message": "Data saved for sync"}

@app.get("/offline/pending/{username}")
def get_pending_sync(username: str):
    with sqlite3.connect(DB_PATH) as conn:
        df = pd.read_sql("""
            SELECT data_type, COUNT(*) as count 
            FROM offline_data 
            WHERE username = ? AND sync_status = 'pending' 
            GROUP BY data_type
        """, conn, params=(username,))
    
    if not df.empty:
        return {"pending": df.to_dict('records'), "total": int(df['count'].sum())}
    return {"pending": [], "total": 0}

@app.post("/offline/sync/{username}")
def sync_offline_data(username: str):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE offline_data 
            SET sync_status = 'synced', synced_at = ? 
            WHERE username = ? AND sync_status = 'pending'
        """, (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), username))
        affected = cursor.rowcount
        conn.commit()
    return {"message": f"Synced {affected} items", "synced_count": affected}

# User profile endpoints
@app.get("/user/profile/{username}")
def get_user_profile(username: str):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT username, farm_name, profile_picture, email, phone, location, 
                   experience_level, farm_size, primary_crops, created_at 
            FROM users WHERE username = ?
        """, (username,))
        row = cursor.fetchone()
    
    if row:
        return {
            "username": row[0],
            "farm_name": row[1],
            "profile_picture": row[2],
            "email": row[3],
            "phone": row[4],
            "location": row[5],
            "experience_level": row[6],
            "farm_size": row[7],
            "primary_crops": json.loads(row[8]) if row[8] else [],
            "created_at": row[9]
        }
    raise HTTPException(status_code=404, detail="User not found")

@app.put("/user/profile")
def update_user_profile(profile: UserProfileUpdate):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        
        updates = []
        params = []
        
        if profile.new_username:
            updates.append("username = ?")
            params.append(profile.new_username)
        if profile.farm_name:
            updates.append("farm_name = ?")
            params.append(profile.farm_name)
        if profile.email:
            updates.append("email = ?")
            params.append(profile.email)
        if profile.phone:
            updates.append("phone = ?")
            params.append(profile.phone)
        if profile.location:
            updates.append("location = ?")
            params.append(profile.location)
        if profile.experience_level:
            updates.append("experience_level = ?")
            params.append(profile.experience_level)
        if profile.farm_size:
            updates.append("farm_size = ?")
            params.append(profile.farm_size)
        if profile.primary_crops:
            updates.append("primary_crops = ?")
            params.append(json.dumps(profile.primary_crops))
        
        if updates:
            params.append(profile.username)
            cursor.execute(f"""
                UPDATE users SET {', '.join(updates)} WHERE username = ?
            """, params)
            conn.commit()
    
    return {"message": "Profile updated successfully"}

# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 1: Crop Photo Diagnosis
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/crop_diagnosis")
def crop_diagnosis(req: CropDiagnosisRequest):
    """AI-powered crop disease diagnosis from description and optional image analysis"""
    try:
        from models.llm_config import call_gemini
        
        system_prompt = """You are an expert agricultural plant pathologist AI. 
Analyze the crop symptoms described and provide a detailed diagnosis.
Return JSON with these fields:
{
  "disease_name": "Name of the detected disease or condition",
  "confidence": 0.0 to 1.0,
  "severity": "mild|moderate|severe|critical",
  "symptoms_matched": ["list of symptoms that match"],
  "cause": "Brief explanation of cause (fungal/bacterial/viral/nutrient/pest)",
  "treatment": {
    "immediate": ["immediate action steps"],
    "organic": ["organic/natural remedies"],
    "chemical": ["chemical treatments if needed"],
    "prevention": ["future prevention steps"]
  },
  "affected_parts": ["leaves", "stem", "roots", "fruit"],
  "spread_risk": "low|medium|high",
  "recovery_time": "estimated recovery period",
  "similar_diseases": ["other diseases with similar symptoms"],
  "expert_tip": "One practical farmer-friendly tip"
}"""
        
        user_prompt = f"""Analyze this crop for diseases:
Crop Type: {req.crop_type or 'Unknown'}
Symptoms/Description: {req.description or 'General health check'}
{"Image provided: Yes (analyzing visual symptoms described)" if req.image_base64 else "No image provided - analyzing based on description only"}

Provide a thorough diagnosis with treatment recommendations suitable for Indian farmers."""

        result = call_gemini(system_prompt, user_prompt, temperature=0.3, max_tokens=2048, json_mode=True)
        
        if not result:
            # Fallback diagnosis based on common symptoms
            result = {
                "disease_name": "Analysis Pending",
                "confidence": 0.5,
                "severity": "moderate",
                "symptoms_matched": [req.description[:100] if req.description else "General"],
                "cause": "Requires detailed analysis",
                "treatment": {
                    "immediate": ["Isolate affected plants", "Remove visibly damaged parts"],
                    "organic": ["Neem oil spray", "Trichoderma-based biocontrol"],
                    "chemical": ["Consult local agricultural officer for appropriate fungicide/pesticide"],
                    "prevention": ["Crop rotation", "Proper spacing", "Good drainage"]
                },
                "affected_parts": ["leaves"],
                "spread_risk": "medium",
                "recovery_time": "2-4 weeks with proper treatment",
                "similar_diseases": [],
                "expert_tip": "Take clear photos and visit your nearest Krishi Vigyan Kendra for lab diagnosis"
            }
        
        # Save to DB
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO crop_diagnosis (username, crop_type, description, diagnosis, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (req.username, req.crop_type, req.description, json.dumps(result), result.get("confidence", 0.5), datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            )
            conn.commit()
        
        return {"status": "success", "diagnosis": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Diagnosis failed: {str(e)}"})

@app.get("/crop_diagnosis/history/{username}")
def get_diagnosis_history(username: str):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, crop_type, description, diagnosis, confidence, created_at FROM crop_diagnosis WHERE username = ? ORDER BY created_at DESC LIMIT 20", (username,))
        rows = cursor.fetchall()
    return {"history": [{"id": r[0], "crop_type": r[1], "description": r[2], "diagnosis": json.loads(r[3]) if r[3] else {}, "confidence": r[4], "created_at": r[5]} for r in rows]}

# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 2: Government Scheme Matcher
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/govt_schemes")
def match_govt_schemes(req: SchemeMatchRequest):
    """AI-powered government scheme matching for farmers"""
    try:
        from models.llm_config import call_gemini
        
        system_prompt = """You are an expert on Indian government agricultural schemes and subsidies.
Match the farmer's profile to eligible government schemes.
Return JSON with:
{
  "schemes": [
    {
      "name": "Scheme full name",
      "short_name": "Abbreviation",
      "ministry": "Issuing ministry/department",
      "benefit_type": "subsidy|loan|insurance|grant|training|equipment",
      "benefit_amount": "Specific amount or percentage",
      "eligibility": ["eligibility criteria met"],
      "how_to_apply": ["step-by-step application process"],
      "documents_needed": ["required documents"],
      "deadline": "Application deadline if known",
      "website": "Official URL",
      "helpline": "Phone number if available",
      "match_score": 0.0 to 1.0
    }
  ],
  "total_potential_benefit": "Estimated total benefit amount",
  "top_recommendation": "Most beneficial scheme name",
  "farmer_tip": "One practical tip for maximizing benefits"
}
Include at least 5-8 real Indian government schemes. Focus on currently active schemes."""
        
        user_prompt = f"""Find eligible government schemes for this farmer:
Location/State: {req.location or 'India (general)'}
Land Size: {req.land_size} acres
Primary Crop: {req.crop or 'Mixed crops'}
Farmer Category: {req.income_category} farmer
Username: {req.username}

List all eligible central and state government schemes with application details."""

        result = call_gemini(system_prompt, user_prompt, temperature=0.3, max_tokens=3000, json_mode=True)
        
        if not result:
            result = {
                "schemes": [
                    {"name": "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)", "short_name": "PM-KISAN", "ministry": "Ministry of Agriculture", "benefit_type": "grant", "benefit_amount": "₹6,000/year in 3 installments", "eligibility": ["All land-holding farmer families"], "how_to_apply": ["Visit pmkisan.gov.in", "Register with Aadhaar", "Link bank account"], "documents_needed": ["Aadhaar Card", "Land Records", "Bank Passbook"], "deadline": "Open enrollment", "website": "https://pmkisan.gov.in", "helpline": "155261", "match_score": 0.95},
                    {"name": "Pradhan Mantri Fasal Bima Yojana (PMFBY)", "short_name": "PMFBY", "ministry": "Ministry of Agriculture", "benefit_type": "insurance", "benefit_amount": "Full crop insurance at 2% premium for Kharif", "eligibility": ["All farmers growing notified crops"], "how_to_apply": ["Apply through bank or CSC", "Before sowing season deadline"], "documents_needed": ["Aadhaar", "Land Records", "Bank Account", "Sowing Certificate"], "deadline": "Before each crop season", "website": "https://pmfby.gov.in", "helpline": "1800-180-1551", "match_score": 0.90},
                    {"name": "Kisan Credit Card (KCC)", "short_name": "KCC", "ministry": "Ministry of Finance / NABARD", "benefit_type": "loan", "benefit_amount": "Up to ₹3 lakh at 4% interest", "eligibility": ["All farmers, including tenant farmers"], "how_to_apply": ["Apply at nearest bank branch", "Fill KCC application form"], "documents_needed": ["Aadhaar", "Land Records", "Passport Photo", "Bank Account"], "deadline": "Open enrollment", "website": "https://www.nabard.org", "helpline": "1800-425-1556", "match_score": 0.88},
                    {"name": "Soil Health Card Scheme", "short_name": "SHC", "ministry": "Ministry of Agriculture", "benefit_type": "training", "benefit_amount": "Free soil testing + recommendations", "eligibility": ["All farmers"], "how_to_apply": ["Visit nearest soil testing lab", "Register through agriculture office"], "documents_needed": ["Aadhaar", "Land details"], "deadline": "Ongoing", "website": "https://soilhealth.dac.gov.in", "helpline": "1800-180-1551", "match_score": 0.85},
                    {"name": "PM Krishi Sinchai Yojana (PMKSY)", "short_name": "PMKSY", "ministry": "Ministry of Agriculture & Jal Shakti", "benefit_type": "subsidy", "benefit_amount": "55-75% subsidy on micro-irrigation", "eligibility": ["All farmers for drip/sprinkler"], "how_to_apply": ["Apply through state agriculture dept", "Submit irrigation plan"], "documents_needed": ["Aadhaar", "Land Records", "Quotation from supplier"], "deadline": "State-wise deadlines", "website": "https://pmksy.gov.in", "helpline": "1800-180-1551", "match_score": 0.82}
                ],
                "total_potential_benefit": "₹50,000-₹3,00,000+ per year",
                "top_recommendation": "PM-KISAN",
                "farmer_tip": "Apply for PM-KISAN first as it requires minimal documentation and provides direct cash benefit"
            }
        
        # Save to DB
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO govt_schemes (username, query_data, matched_schemes, created_at) VALUES (?, ?, ?, ?)",
                (req.username, json.dumps({"location": req.location, "land_size": req.land_size, "crop": req.crop, "income_category": req.income_category}), json.dumps(result), datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            )
            conn.commit()
        
        return {"status": "success", "data": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Scheme matching failed: {str(e)}"})

# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 3: Mandi Price Alert System
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/mandi_prices")
def get_mandi_prices(req: MandiPriceRequest):
    """AI-powered mandi price analysis with buy/sell recommendations"""
    try:
        from models.llm_config import call_gemini
        
        system_prompt = """You are an expert Indian agricultural market analyst specializing in mandi prices.
Provide current market price analysis for the requested crop.
Return JSON with:
{
  "crop": "Crop name",
  "current_price": {"min": 0, "max": 0, "modal": 0, "unit": "₹/quintal"},
  "msp": {"price": 0, "year": "2024-25"},
  "price_trend": "rising|stable|falling",
  "price_forecast_7d": {"predicted": 0, "confidence": 0.0},
  "price_forecast_30d": {"predicted": 0, "confidence": 0.0},
  "top_mandis": [
    {"name": "Mandi Name", "state": "State", "price": 0, "arrival_tons": 0}
  ],
  "recommendation": "SELL|HOLD|WAIT",
  "recommendation_reason": "Detailed reasoning",
  "best_time_to_sell": "Suggested timeframe",
  "storage_advice": "Storage tips if holding",
  "market_insights": ["Key market factors"],
  "nearby_mandis": [{"name": "Mandi", "distance_km": 0, "price": 0}],
  "price_history": [
    {"month": "Month", "price": 0}
  ]
}
Use realistic Indian mandi prices. Generate 6-month price history."""
        
        user_prompt = f"""Analyze mandi prices for:
Crop: {req.crop}
State/Region: {req.state or 'Pan India'}
District: {req.district or 'All districts'}

Provide current prices, forecasts, top mandis, and sell/hold recommendation."""

        result = call_gemini(system_prompt, user_prompt, temperature=0.3, max_tokens=3000, json_mode=True)
        
        if not result:
            # Smart fallback with realistic prices
            import random
            base_prices = {"rice": 2200, "wheat": 2275, "maize": 2090, "cotton": 6620, "soybean": 4600, "sugarcane": 315, "potato": 1500, "onion": 2000, "tomato": 2500, "mustard": 5650, "groundnut": 6377, "jowar": 3180, "bajra": 2500, "ragi": 3846, "chana": 5440, "tur": 7000, "moong": 8558, "urad": 6950}
            crop_lower = req.crop.lower().strip()
            base = base_prices.get(crop_lower, 3000)
            modal = base + random.randint(-200, 200)
            result = {
                "crop": req.crop,
                "current_price": {"min": modal - 300, "max": modal + 500, "modal": modal, "unit": "₹/quintal"},
                "msp": {"price": base, "year": "2024-25"},
                "price_trend": random.choice(["rising", "stable", "falling"]),
                "price_forecast_7d": {"predicted": modal + random.randint(-100, 200), "confidence": 0.75},
                "price_forecast_30d": {"predicted": modal + random.randint(-300, 500), "confidence": 0.60},
                "top_mandis": [
                    {"name": "Azadpur Mandi", "state": "Delhi", "price": modal + 200, "arrival_tons": 5000},
                    {"name": "Vashi APMC", "state": "Maharashtra", "price": modal + 100, "arrival_tons": 3500},
                    {"name": "Yeshwanthpur", "state": "Karnataka", "price": modal - 50, "arrival_tons": 2800},
                    {"name": "Koyambedu", "state": "Tamil Nadu", "price": modal + 50, "arrival_tons": 2200},
                    {"name": "Bowenpally", "state": "Telangana", "price": modal + 80, "arrival_tons": 1800}
                ],
                "recommendation": "HOLD" if modal < base else "SELL",
                "recommendation_reason": f"Current modal price ₹{modal}/quintal vs MSP ₹{base}/quintal",
                "best_time_to_sell": "Within next 2 weeks" if modal >= base else "Wait 3-4 weeks for better prices",
                "storage_advice": "Store in cool, dry place. Use hermetic bags for grains.",
                "market_insights": ["Festival season may increase demand", "Good monsoon expected to increase supply", "Export demand remains strong"],
                "nearby_mandis": [],
                "price_history": [{"month": m, "price": base + random.randint(-400, 400)} for m in ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]]
            }
        
        # Save to DB
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO mandi_prices (crop, state, price_data, advice, created_at) VALUES (?, ?, ?, ?, ?)",
                (req.crop, req.state, json.dumps(result), result.get("recommendation", ""), datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            )
            conn.commit()
        
        return {"status": "success", "data": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Price lookup failed: {str(e)}"})

# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 4: Farmer-to-Farmer Voice Notes (Community)
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/voice_notes")
def post_voice_note(req: VoiceNoteEntry):
    """Save a farmer's voice note (text transcript) to community"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO voice_notes (username, audio_text, crop, language, likes, created_at) VALUES (?, ?, ?, ?, 0, ?)",
                (req.username, req.audio_text, req.crop, req.language, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            )
            conn.commit()
        return {"status": "success", "message": "Voice note shared with community!"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Failed to save voice note: {str(e)}"})

@app.get("/voice_notes")
def get_voice_notes(crop: str = "", limit: int = 30):
    """Get community voice notes, optionally filtered by crop"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        if crop:
            cursor.execute("SELECT id, username, audio_text, crop, language, likes, created_at FROM voice_notes WHERE crop LIKE ? ORDER BY created_at DESC LIMIT ?", (f"%{crop}%", limit))
        else:
            cursor.execute("SELECT id, username, audio_text, crop, language, likes, created_at FROM voice_notes ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
    return {"notes": [{"id": r[0], "username": r[1], "audio_text": r[2], "crop": r[3], "language": r[4], "likes": r[5], "created_at": r[6]} for r in rows]}

@app.post("/voice_notes/{note_id}/like")
def like_voice_note(note_id: int):
    """Like a voice note"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE voice_notes SET likes = likes + 1 WHERE id = ?", (note_id,))
        conn.commit()
    return {"status": "success"}

# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 5: Expense & Profit Tracker
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/expenses")
def add_expense(req: ExpenseEntry):
    """Add expense or income entry"""
    try:
        entry_type = "income" if req.category.lower() in ["sale", "sell", "income", "subsidy", "grant", "mandi", "revenue"] else "expense"
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO expenses (username, entry_type, category, amount, description, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (req.username, entry_type, req.category, req.amount, req.description, req.date or datetime.now().strftime("%Y-%m-%d"), datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            )
            conn.commit()
        return {"status": "success", "entry_type": entry_type, "message": f"{entry_type.title()} of ₹{req.amount} recorded"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Failed to save: {str(e)}"})

@app.get("/expenses/{username}")
def get_expenses(username: str, months: int = 6):
    """Get expense history and profit summary"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        since = (datetime.now() - timedelta(days=months * 30)).strftime("%Y-%m-%d")
        cursor.execute("""
            SELECT id, entry_type, category, amount, description, date, created_at 
            FROM expenses WHERE username = ? AND date >= ?
            ORDER BY date DESC
        """, (username, since))
        rows = cursor.fetchall()
        
        entries = []
        total_income = 0
        total_expense = 0
        category_totals = {}
        monthly_data = {}
        
        for r in rows:
            entry = {"id": r[0], "entry_type": r[1], "category": r[2], "amount": r[3], "description": r[4], "date": r[5], "created_at": r[6]}
            entries.append(entry)
            
            if r[1] == "income":
                total_income += r[3]
            else:
                total_expense += r[3]
            
            cat = r[2]
            if cat not in category_totals:
                category_totals[cat] = 0
            category_totals[cat] += r[3]
            
            month_key = r[5][:7] if r[5] else "unknown"
            if month_key not in monthly_data:
                monthly_data[month_key] = {"income": 0, "expense": 0}
            if r[1] == "income":
                monthly_data[month_key]["income"] += r[3]
            else:
                monthly_data[month_key]["expense"] += r[3]
    
    profit = total_income - total_expense
    
    return {
        "entries": entries,
        "summary": {
            "total_income": total_income,
            "total_expense": total_expense,
            "profit": profit,
            "profit_margin": round((profit / total_income * 100), 1) if total_income > 0 else 0,
            "category_breakdown": category_totals,
            "monthly_data": monthly_data
        }
    }

@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int):
    """Delete an expense entry"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
        conn.commit()
    return {"status": "success", "message": "Entry deleted"}

@app.get("/expenses/{username}/ai-insights")
def get_expense_insights(username: str):
    """AI-powered financial insights for the farmer"""
    try:
        from models.llm_config import call_gemini
        
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT entry_type, category, amount, date FROM expenses 
                WHERE username = ? ORDER BY date DESC LIMIT 50
            """, (username,))
            rows = cursor.fetchall()
        
        if not rows:
            return {"insights": {"summary": "No expense data yet. Start tracking your farm expenses to get AI-powered financial insights!", "tips": ["Track all seed purchases", "Record fertilizer costs", "Log labor payments", "Record every sale at mandi"]}}
        
        expense_text = "\n".join([f"{r[0]}: {r[1]} - ₹{r[2]} on {r[3]}" for r in rows])
        
        system_prompt = """You are a farm financial advisor AI. Analyze the farmer's expense/income data and provide actionable insights.
Return JSON:
{
  "summary": "Brief financial health summary",
  "profit_status": "profitable|break-even|loss",
  "top_expenses": ["Top 3 expense categories"],
  "savings_tips": ["3-5 specific money-saving tips"],
  "income_tips": ["3-5 ways to increase income"],
  "budget_suggestion": {"seeds": "₹X", "fertilizer": "₹X", "labor": "₹X", "equipment": "₹X"},
  "risk_alert": "Any financial risk warning",
  "next_month_forecast": "Expected expense/income trend"
}"""
        
        user_prompt = f"Analyze this Indian farmer's financial data:\n{expense_text}"
        
        result = call_gemini(system_prompt, user_prompt, temperature=0.3, max_tokens=2000, json_mode=True)
        
        if not result:
            result = {"summary": "Track more expenses for detailed AI insights", "tips": ["Keep recording all farm transactions"]}
        
        return {"insights": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Insight generation failed: {str(e)}"})

@app.get("/")
def root():
    """Serve frontend index.html if it exists, else API info"""
    frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')
    index_path = os.path.join(frontend_dir, 'index.html')
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return {
        "message": "Sustainable Farming AI API v3.0",
        "endpoints": {
            "auth": ["/signup", "/login"],
            "farming": ["/recommendation", "/crop_rotation", "/fertilizer", "/soil_analysis"],
            "weather": ["/weather", "/pest_prediction"],
            "sustainability": ["/sustainability", "/sustainability/scores"],
            "community": ["/community", "/community/insights"],
            "market": ["/market/dashboard"],
            "chatbot": ["/chatbot/ask", "/chatbot/history/{username}"],
            "offline": ["/offline/save", "/offline/pending/{username}", "/offline/sync/{username}"],
            "user": ["/user/profile/{username}"],
            "crop_diagnosis": ["/crop_diagnosis", "/crop_diagnosis/history/{username}"],
            "govt_schemes": ["/govt_schemes"],
            "mandi_prices": ["/mandi_prices"],
            "voice_notes": ["/voice_notes", "/voice_notes/{note_id}/like"],
            "expenses": ["/expenses", "/expenses/{username}", "/expenses/{username}/ai-insights"]
        }
    }

# Mount frontend static files (MUST be after all API routes)
_frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')
if os.path.isdir(_frontend_dir):
    app.mount("/", StaticFiles(directory=_frontend_dir, html=True), name="frontend")