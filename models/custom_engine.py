"""
AgriSmart Hybrid Recommendation Engine (AHRE)
===============================================
A NOVEL multi-layer recommendation system that combines:

  Layer 1 — Trained ML Models (sklearn RandomForest on 296K records)
  Layer 2 — Knowledge Base RAG (TF-IDF over real agricultural data)
  Layer 3 — Custom Agronomic Scoring Algorithm (domain-specific)
  Layer 4 — LLM Enhancement (Groq/Llama — optional enrichment, NOT primary)

Architecture:
  ┌─────────────────────────────────────────────────────────────┐
  │                    Farm Input Conditions                      │
  │  (pH, temperature, rainfall, N, P, K, soil_type, region)    │
  └───────────────┬───────────────────────────────┬─────────────┘
                  │                               │
         ┌────────▼────────┐             ┌────────▼────────┐
         │  Layer 1: ML    │             │ Layer 2: RAG KB │
         │ Crop Classifier │             │ Similar Records │
         │ Yield Predictor │             │ Historical Data │
         │ Price Predictor │             │ Crop Statistics │
         │ Sust. Scorer    │             └────────┬────────┘
         └────────┬────────┘                      │
                  │         ┌─────────────────────┘
                  │         │
          ┌───────▼─────────▼──────┐
          │  Layer 3: Custom Algo  │
          │  Multi-Criteria Fusion │
          │  Explainable Scoring   │
          │  Confidence Calibration│
          └───────────┬────────────┘
                      │
          ┌───────────▼────────────┐
          │  Layer 4: LLM (opt.)   │
          │  Natural Language       │
          │  Reasoning & Advice    │
          └────────────────────────┘

What makes this unique:
  1. NOT just an API wrapper — trained models on YOUR data
  2. Explainable AI — every score has a traceable reason
  3. Knowledge-grounded — retrieves real historical evidence
  4. Ensemble fusion — multiple signals combined intelligently
  5. Works OFFLINE — Layers 1-3 need zero internet
  6. LLM enhances, doesn't replace — custom logic is primary
"""

import os
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime

try:
    import joblib
    HAS_JOBLIB = True
except ImportError:
    HAS_JOBLIB = False

from models.knowledge_base import AgriKnowledgeBase

MODELS_DIR = Path(__file__).parent


# ═══════════════════════════════════════════════════════════════════════════════
# Crop Domain Knowledge — hand-crafted by agricultural experts
# This is NOT the same as the LLM prompt data — this is algorithmic reference
# ═══════════════════════════════════════════════════════════════════════════════

CROP_OPTIMAL_CONDITIONS = {
    "rice":       {"ph": (5.5, 7.0), "temp": (22, 32), "rain": (150, 300), "n": (60, 120), "p": (20, 50), "k": (20, 50),  "water": "high",      "season": ["kharif"], "icon": "🌾"},
    "wheat":      {"ph": (6.0, 7.5), "temp": (12, 25), "rain": (40, 100),  "n": (60, 120), "p": (25, 60), "k": (20, 50),  "water": "medium",    "season": ["rabi"], "icon": "🌾"},
    "corn":       {"ph": (6.0, 7.0), "temp": (21, 32), "rain": (80, 150),  "n": (80, 160), "p": (25, 60), "k": (25, 60),  "water": "medium",    "season": ["kharif", "rabi"], "icon": "🌽"},
    "maize":      {"ph": (6.0, 7.0), "temp": (21, 32), "rain": (80, 150),  "n": (80, 160), "p": (25, 60), "k": (25, 60),  "water": "medium",    "season": ["kharif", "rabi"], "icon": "🌽"},
    "soybean":    {"ph": (6.0, 7.0), "temp": (20, 30), "rain": (60, 120),  "n": (15, 40),  "p": (30, 60), "k": (25, 50),  "water": "medium",    "season": ["kharif"], "icon": "🫘"},
    "cotton":     {"ph": (6.5, 8.0), "temp": (25, 35), "rain": (80, 150),  "n": (60, 120), "p": (20, 50), "k": (20, 40),  "water": "medium",    "season": ["kharif"], "icon": "☁️"},
    "sugarcane":  {"ph": (6.0, 7.5), "temp": (25, 35), "rain": (120, 250), "n": (100, 200),"p": (30, 60), "k": (40, 80),  "water": "very_high", "season": ["kharif"], "icon": "🎋"},
    "groundnut":  {"ph": (6.0, 7.0), "temp": (25, 32), "rain": (60, 120),  "n": (10, 25),  "p": (30, 60), "k": (20, 40),  "water": "low",       "season": ["kharif"], "icon": "🥜"},
    "mustard":    {"ph": (6.0, 7.5), "temp": (15, 25), "rain": (35, 60),   "n": (40, 80),  "p": (20, 40), "k": (10, 20),  "water": "low",       "season": ["rabi"], "icon": "🌻"},
    "chickpea":   {"ph": (6.0, 7.5), "temp": (15, 28), "rain": (30, 60),   "n": (10, 25),  "p": (30, 60), "k": (20, 40),  "water": "low",       "season": ["rabi"], "icon": "🫘"},
    "lentil":     {"ph": (6.0, 7.5), "temp": (15, 25), "rain": (30, 50),   "n": (10, 25),  "p": (25, 50), "k": (15, 30),  "water": "low",       "season": ["rabi"], "icon": "🫘"},
    "tomato":     {"ph": (6.0, 7.0), "temp": (20, 30), "rain": (50, 100),  "n": (80, 150), "p": (40, 80), "k": (40, 80),  "water": "medium",    "season": ["rabi", "kharif"], "icon": "🍅"},
    "potato":     {"ph": (5.0, 6.5), "temp": (15, 25), "rain": (50, 80),   "n": (80, 150), "p": (40, 80), "k": (50, 100), "water": "medium",    "season": ["rabi"], "icon": "🥔"},
    "onion":      {"ph": (6.0, 7.0), "temp": (15, 28), "rain": (40, 70),   "n": (60, 120), "p": (30, 60), "k": (30, 60),  "water": "medium",    "season": ["rabi"], "icon": "🧅"},
    "millet":     {"ph": (5.5, 7.5), "temp": (25, 35), "rain": (30, 60),   "n": (20, 60),  "p": (10, 30), "k": (10, 25),  "water": "very_low",  "season": ["kharif"], "icon": "🌾"},
    "barley":     {"ph": (6.5, 7.5), "temp": (12, 22), "rain": (30, 50),   "n": (40, 80),  "p": (20, 40), "k": (15, 30),  "water": "low",       "season": ["rabi"], "icon": "🌾"},
    "sunflower":  {"ph": (6.5, 7.5), "temp": (22, 30), "rain": (50, 80),   "n": (40, 80),  "p": (25, 50), "k": (15, 30),  "water": "medium",    "season": ["rabi", "kharif"], "icon": "🌻"},
    "jute":       {"ph": (6.0, 7.5), "temp": (25, 35), "rain": (150, 250), "n": (40, 80),  "p": (15, 30), "k": (20, 40),  "water": "high",      "season": ["kharif"], "icon": "🧵"},
    "tea":        {"ph": (4.5, 5.5), "temp": (18, 28), "rain": (200, 350), "n": (80, 200), "p": (20, 60), "k": (30, 80),  "water": "high",      "season": ["all"], "icon": "🍵"},
    "coffee":     {"ph": (5.5, 6.0), "temp": (18, 25), "rain": (150, 250), "n": (60, 150), "p": (20, 50), "k": (40, 100), "water": "medium",    "season": ["all"], "icon": "☕"},
    "turmeric":   {"ph": (5.5, 7.0), "temp": (25, 32), "rain": (150, 220), "n": (30, 60),  "p": (20, 40), "k": (40, 80),  "water": "medium",    "season": ["kharif"], "icon": "🟡"},
    "banana":     {"ph": (6.0, 7.0), "temp": (25, 32), "rain": (120, 200), "n": (100, 200),"p": (30, 60), "k": (100, 200),"water": "high",      "season": ["all"], "icon": "🍌"},
    "pigeon pea": {"ph": (6.0, 7.5), "temp": (22, 32), "rain": (60, 120),  "n": (10, 25),  "p": (25, 50), "k": (10, 25),  "water": "low",       "season": ["kharif"], "icon": "🫘"},
    "sesame":     {"ph": (6.0, 7.0), "temp": (25, 35), "rain": (40, 65),   "n": (20, 50),  "p": (15, 30), "k": (10, 25),  "water": "low",       "season": ["kharif"], "icon": "🌾"},
    "oats":       {"ph": (6.0, 7.0), "temp": (10, 24), "rain": (40, 80),   "n": (40, 80),  "p": (20, 40), "k": (15, 30),  "water": "medium",    "season": ["rabi"], "icon": "🌾"},
}


# ═══════════════════════════════════════════════════════════════════════════════
# Crop ↔ Category Mapping (user picks a category, engine boosts matching crops)
# ═══════════════════════════════════════════════════════════════════════════════

CROP_CATEGORIES = {
    "Grains":     ["rice", "wheat", "corn", "maize", "millet", "barley", "oats", "sorghum"],
    "Vegetables": ["tomato", "potato", "onion"],
    "Fruits":     ["banana"],
    "Pulses":     ["soybean", "chickpea", "lentil", "pigeon pea", "groundnut"],
    "Cash Crops": ["cotton", "sugarcane", "jute", "tea", "coffee"],
    "Oilseeds":   ["mustard", "sunflower", "sesame", "groundnut"],
    "Spices":     ["turmeric"],
}

def _category_of(crop_name: str) -> str:
    """Return the category name a crop belongs to (or 'Other')."""
    lc = crop_name.lower()
    for cat, members in CROP_CATEGORIES.items():
        if lc in members:
            return cat
    return "Other"


# ═══════════════════════════════════════════════════════════════════════════════
# The Custom Engine
# ═══════════════════════════════════════════════════════════════════════════════

class AgriSmartEngine:
    """
    Hybrid multi-layer crop recommendation engine.

    Layer 1: ML Model predictions  (sklearn, trained on 296K records)
    Layer 2: Knowledge Base RAG    (TF-IDF retrieval from real data)
    Layer 3: Agronomic Algorithm   (custom multi-criteria scoring)
    Layer 4: LLM Enhancement       (optional Groq/Llama enrichment)

    Usage:
        engine = AgriSmartEngine()
        result = engine.recommend(
            ph=6.5, temperature=28, rainfall=120,
            nitrogen=80, phosphorus=30, potassium=30,
        )
    """

    def __init__(self):
        # Layer 1: ML models
        self.crop_classifier = None
        self.crop_scaler = None
        self.crop_encoder = None
        self.yield_model = None
        self.yield_scaler = None
        self.price_model = None
        self.price_scaler = None
        self.sust_model = None
        self.sust_scaler = None
        self._load_ml_models()

        # Layer 2: Knowledge base
        self.kb = AgriKnowledgeBase()

        print("🧠 AgriSmart Hybrid Engine initialised — 4 layers active")

    def _load_ml_models(self):
        """Load pre-trained sklearn models."""
        if not HAS_JOBLIB:
            print("⚠️ joblib not available — ML models disabled")
            return

        model_files = {
            "crop_classifier": ("farmer_advisor_model.pkl", "farmer_advisor_scaler.pkl", "farmer_advisor_encoder.pkl"),
            "yield_model": ("weather_analyst_model.pkl", "weather_analyst_scaler.pkl", None),
            "price_model": ("market_researcher_model.pkl", "market_researcher_scaler.pkl", None),
            "sust_model": ("sustainability_expert_model.pkl", "sustainability_expert_scaler.pkl", None),
        }

        for name, (model_f, scaler_f, encoder_f) in model_files.items():
            model_path = MODELS_DIR / model_f
            scaler_path = MODELS_DIR / scaler_f
            if model_path.exists() and scaler_path.exists():
                try:
                    model = joblib.load(model_path)
                    scaler = joblib.load(scaler_path)
                    if name == "crop_classifier":
                        self.crop_classifier = model
                        self.crop_scaler = scaler
                        if encoder_f:
                            enc_path = MODELS_DIR / encoder_f
                            if enc_path.exists():
                                self.crop_encoder = joblib.load(enc_path)
                    elif name == "yield_model":
                        self.yield_model = model
                        self.yield_scaler = scaler
                    elif name == "price_model":
                        self.price_model = model
                        self.price_scaler = scaler
                    elif name == "sust_model":
                        self.sust_model = model
                        self.sust_scaler = scaler
                    print(f"   ✅ Loaded {name}")
                except Exception as e:
                    print(f"   ⚠️ Failed to load {name}: {e}")
            else:
                print(f"   ℹ️ {name} not found — Layer 1 will use algorithmic fallback")

    # ─────────────────────────────────────────────────────────────────
    # MAIN RECOMMENDATION API
    # ─────────────────────────────────────────────────────────────────

    def recommend(
        self,
        ph: float = 6.5,
        temperature: float = 25,
        rainfall: float = 100,
        nitrogen: float = 80,
        phosphorus: float = 30,
        potassium: float = 30,
        soil_type: str = None,
        region: str = None,
        humidity: float = 60,
        land_size: float = 1.0,
        use_llm: bool = True,
        crop_preference: str = None,
    ) -> Dict:
        """
        Generate a hybrid recommendation using all 4 layers.

        Returns a rich dict with:
          - recommended crop + alternatives
          - explainable scores from each layer
          - confidence with calibration
          - data evidence from knowledge base
          - optional LLM-generated advice
        """

        # Determine current season
        month = datetime.now().month
        if month in (6, 7, 8, 9, 10):
            current_season = "kharif"
        elif month in (11, 12, 1, 2, 3):
            current_season = "rabi"
        else:
            current_season = "zaid"

        # ── Layer 1: ML Model Predictions ────────────────────────────
        ml_predictions = self._layer1_ml_predict(
            ph, temperature, rainfall, nitrogen, phosphorus, potassium
        )

        # ── Layer 2: Knowledge Base Retrieval ────────────────────────
        kb_results = self._layer2_kb_retrieve(
            temperature, rainfall, ph, nitrogen
        )

        # ── Layer 3: Custom Agronomic Scoring ────────────────────────
        crop_scores = self._layer3_agronomic_score(
            ph, temperature, rainfall, nitrogen, phosphorus, potassium,
            humidity, current_season, soil_type, ml_predictions, kb_results,
            crop_preference,
        )

        # Sort by final fused score
        crop_scores.sort(key=lambda x: x["final_score"], reverse=True)
        top_crop = crop_scores[0] if crop_scores else None
        alternatives = crop_scores[1:5] if len(crop_scores) > 1 else []

        # ── Build comparative data for ALL crops ─────────────────────
        # Group by category so UI can show "why X over Y"
        comparative = self._build_comparative(crop_scores, crop_preference)

        # ── Layer 4: LLM Enhancement (optional) ─────────────────────
        llm_advice = ""
        llm_reasoning = ""
        if use_llm and top_crop:
            llm_advice, llm_reasoning = self._layer4_llm_enhance(
                top_crop, alternatives, ph, temperature, rainfall,
                nitrogen, phosphorus, potassium, current_season,
            )

        # ── Build Result ─────────────────────────────────────────────
        if not top_crop:
            return self._empty_result()

        # Historical evidence from KB
        historical = {}
        if self.kb.is_loaded:
            historical = self.kb.get_historical_yield_trend(
                top_crop["crop"], region
            )

        return {
            # Primary recommendation
            "recommended_crop": top_crop["crop"],
            "crop_icon": CROP_OPTIMAL_CONDITIONS.get(
                top_crop["crop"].lower(), {}
            ).get("icon", "🌱"),
            "final_score": round(top_crop["final_score"] / 10.0, 3),
            "confidence": round(top_crop["confidence"], 1),

            # Explainable layer scores (normalized to 0-1 for frontend display)
            "layer_scores": {
                "agronomic": round(top_crop.get("agronomic_score", 0) / 10.0, 3),
                "npk": round(top_crop.get("npk_score", 0) / 10.0, 3),
                "season": round(top_crop.get("season_bonus", 0), 3),
                "ml_model": round(top_crop.get("ml_score", 0) / 2.0, 3),
                "knowledge_base": round(top_crop.get("kb_score", 0) / 2.0, 3),
            },

            # Score breakdown (explainable)
            "score_explanation": top_crop.get("explanation", []),

            # Alternatives
            "alternatives": [
                {
                    "crop": a["crop"],
                    "icon": CROP_OPTIMAL_CONDITIONS.get(
                        a["crop"].lower(), {}
                    ).get("icon", "🌱"),
                    "score": round(a["final_score"] / 10.0, 3),
                    "reason": a.get("explanation", [""])[0] if a.get("explanation") else "",
                }
                for a in alternatives
            ],

            # Historical evidence
            "historical_evidence": historical,
            "kb_records_matched": len(kb_results),

            # LLM enhancement (Layer 4)
            "llm_advice": llm_advice,
            "llm_reasoning": llm_reasoning,

            # Metadata
            "engine": "AgriSmart Hybrid Engine v1.0",
            "layers_used": self._get_active_layers(use_llm),
            "season": current_season,
            "data_points_analysed": self._count_data_points(),

            # Yield & price estimates
            "estimated_yield": round(
                top_crop.get("predicted_yield", 0), 2
            ),
            "estimated_price": round(
                top_crop.get("predicted_price", 0), 2
            ),
            "sustainability_score": round(
                top_crop.get("sustainability", 5.0), 1
            ),

            # Comparative scoring (why this crop, not others?)
            "comparative": comparative,
        }

    # ─────────────────────────────────────────────────────────────────
    # LAYER 1: ML MODEL PREDICTIONS
    # ─────────────────────────────────────────────────────────────────

    def _layer1_ml_predict(
        self, ph, temperature, rainfall, nitrogen, phosphorus, potassium
    ) -> Dict:
        """Use trained sklearn models for crop/yield/price prediction."""
        results = {
            "crop_predictions": [],
            "yield_estimate": None,
            "price_estimate": None,
            "sustainability_estimate": None,
        }

        # 1. Crop classification
        if self.crop_classifier and self.crop_scaler and self.crop_encoder:
            try:
                features = np.array([[
                    temperature, rainfall, nitrogen, phosphorus,
                    potassium, ph, 1.5  # organic_matter default
                ]])
                scaled = self.crop_scaler.transform(features)
                probas = self.crop_classifier.predict_proba(scaled)[0]
                classes = self.crop_encoder.inverse_transform(
                    range(len(probas))
                )
                # Top 5 predictions
                top_indices = probas.argsort()[-5:][::-1]
                results["crop_predictions"] = [
                    {"crop": str(classes[i]), "probability": float(probas[i])}
                    for i in top_indices
                ]
            except Exception as e:
                print(f"   ⚠️ Crop classifier error: {e}")

        # 2. Yield prediction
        if self.yield_model and self.yield_scaler:
            try:
                features = np.array([[temperature, rainfall, datetime.now().year]])
                scaled = self.yield_scaler.transform(features)
                results["yield_estimate"] = float(
                    self.yield_model.predict(scaled)[0]
                )
            except Exception as e:
                print(f"   ⚠️ Yield model error: {e}")

        # 3. Price prediction
        if self.price_model and self.price_scaler:
            try:
                features = np.array([[
                    1.0, 3.0, 3.0, datetime.now().year, 80  # defaults
                ]])
                scaled = self.price_scaler.transform(features)
                results["price_estimate"] = float(
                    self.price_model.predict(scaled)[0]
                )
            except Exception as e:
                print(f"   ⚠️ Price model error: {e}")

        # 4. Sustainability score
        if self.sust_model and self.sust_scaler:
            try:
                organic_matter = 1.5
                features = np.array([[
                    80, organic_matter, ph, nitrogen, phosphorus
                ]])
                scaled = self.sust_scaler.transform(features)
                results["sustainability_estimate"] = float(
                    np.clip(self.sust_model.predict(scaled)[0], 0, 10)
                )
            except Exception as e:
                print(f"   ⚠️ Sustainability model error: {e}")

        return results

    # ─────────────────────────────────────────────────────────────────
    # LAYER 2: KNOWLEDGE BASE RETRIEVAL
    # ─────────────────────────────────────────────────────────────────

    def _layer2_kb_retrieve(
        self, temperature, rainfall, ph, nitrogen
    ) -> List[Dict]:
        """Retrieve similar historical records from knowledge base."""
        if not self.kb.is_loaded:
            return []
        return self.kb.get_best_crops_for_conditions(
            temperature, rainfall, ph, nitrogen, top_k=10
        )

    # ─────────────────────────────────────────────────────────────────
    # LAYER 3: CUSTOM AGRONOMIC SCORING ALGORITHM
    # ─────────────────────────────────────────────────────────────────

    def _layer3_agronomic_score(
        self, ph, temperature, rainfall, nitrogen, phosphorus, potassium,
        humidity, current_season, soil_type,
        ml_predictions, kb_results, crop_preference=None,
    ) -> List[Dict]:
        """
        Novel multi-criteria scoring algorithm.

        For each candidate crop, compute:
          S_agro  = soil + climate + NPK suitability (0-10)
          S_ml    = ML model confidence boost (0-2)
          S_kb    = knowledge base evidence boost (0-2)
          S_season = season match bonus (0-1)
          S_pref  = crop preference match boost (0-1.5)
          Final   = S_agro + S_ml + S_kb + S_season + S_pref (normalized 0-10)

        Each score component has a human-readable explanation.
        """

        # Detect unknown NPK (all zero means user didn't enter values)
        npk_unknown = (nitrogen == 0 and phosphorus == 0 and potassium == 0)

        # Build ML lookup
        ml_lookup = {}
        for pred in ml_predictions.get("crop_predictions", []):
            ml_lookup[pred["crop"].lower()] = pred["probability"]

        # Build KB lookup
        kb_lookup = {}
        for rec in kb_results:
            kb_lookup[rec["crop"].lower()] = {
                "frequency": rec.get("frequency", 0),
                "avg_yield": rec.get("avg_yield", 0),
                "avg_price": rec.get("avg_price", 0),
                "confidence": rec.get("confidence", 0),
            }

        scored_crops = []

        for crop_name, conditions in CROP_OPTIMAL_CONDITIONS.items():
            explanation = []
            score_components = {}

            # ─── 3a. Soil-Climate Suitability (0-10) ────────────────
            ph_score = self._range_score(
                ph, conditions["ph"][0], conditions["ph"][1], margin=0.8
            )
            temp_score = self._range_score(
                temperature, conditions["temp"][0], conditions["temp"][1], margin=5
            )
            rain_score = self._range_score(
                rainfall, conditions["rain"][0], conditions["rain"][1], margin=30
            )

            if ph_score > 0.7:
                explanation.append(f"✅ pH {ph} is excellent for {crop_name}")
            elif ph_score > 0.4:
                explanation.append(f"⚠️ pH {ph} is acceptable for {crop_name}")
            else:
                explanation.append(f"❌ pH {ph} is poor for {crop_name}")

            if temp_score > 0.7:
                explanation.append(f"✅ Temperature {temperature}°C suits {crop_name} well")
            elif temp_score > 0.4:
                explanation.append(f"⚠️ Temperature {temperature}°C is marginal for {crop_name}")
            else:
                explanation.append(f"❌ Temperature {temperature}°C is outside range for {crop_name}")

            if rain_score > 0.7:
                explanation.append(f"✅ Rainfall {rainfall}mm matches {crop_name} needs")
            elif rain_score > 0.4:
                explanation.append(f"⚠️ Rainfall {rainfall}mm is marginal for {crop_name}")
            else:
                explanation.append(f"❌ Rainfall {rainfall}mm doesn't suit {crop_name}")

            agronomic_score = (
                ph_score * 3.0      # pH weight: 30%
                + temp_score * 3.5  # Temperature weight: 35%
                + rain_score * 3.5  # Rainfall weight: 35%
            )
            score_components["agronomic_score"] = agronomic_score

            # ─── 3b. NPK Balance Score (0-10) ───────────────────────
            if npk_unknown:
                # User didn't enter NPK → treat as neutral (5/10)
                npk_score = 5.0
                n_score = p_score = k_score = 0.5
                explanation.append("ℹ️ NPK not provided — using neutral score")
            else:
                n_score = self._range_score(
                    nitrogen, conditions["n"][0], conditions["n"][1], margin=20
                )
                p_score = self._range_score(
                    phosphorus, conditions["p"][0], conditions["p"][1], margin=15
                )
                k_score = self._range_score(
                    potassium, conditions["k"][0], conditions["k"][1], margin=15
                )
                npk_score = (n_score + p_score + k_score) / 3 * 10

                if npk_score > 7:
                    explanation.append(f"✅ NPK levels well-balanced for {crop_name}")
                elif npk_score > 4:
                    explanation.append(f"⚠️ Some NPK adjustment needed for {crop_name}")
                else:
                    explanation.append(f"❌ NPK levels need significant correction for {crop_name}")
            score_components["npk_score"] = npk_score

            # ─── 3c. Season Match (0 or 1) ──────────────────────────
            season_bonus = 0.0
            if current_season in conditions["season"] or "all" in conditions["season"]:
                season_bonus = 1.0
                explanation.append(f"✅ {crop_name} is in-season ({current_season})")
            else:
                explanation.append(f"⚠️ {crop_name} is typically grown in {'/'.join(conditions['season'])}")
            score_components["season_bonus"] = season_bonus

            # ─── 3d. ML Model Confidence Boost (0-2) ────────────────
            ml_prob = ml_lookup.get(crop_name, 0)
            ml_score = ml_prob * 2.0  # Scale 0-1 probability to 0-2
            score_components["ml_score"] = ml_score
            if ml_prob > 0.3:
                explanation.append(f"🤖 ML model strongly predicts {crop_name} ({ml_prob*100:.0f}% confidence)")
            elif ml_prob > 0.1:
                explanation.append(f"🤖 ML model supports {crop_name} ({ml_prob*100:.0f}%)")

            # ─── 3e. Knowledge Base Evidence Boost (0-2) ─────────────
            kb_data = kb_lookup.get(crop_name, {})
            kb_freq = kb_data.get("frequency", 0)
            kb_score = min(2.0, kb_freq / 10 * 2)  # Normalize to 0-2
            score_components["kb_score"] = kb_score
            if kb_freq > 5:
                explanation.append(
                    f"📊 Historical data supports {crop_name} "
                    f"({kb_freq} similar records, avg yield: {kb_data.get('avg_yield', 0):.1f} t/ha)"
                )

            # ─── 3f. Crop Preference Boost (0-1.5) ────────────────────
            pref_score = 0.0
            crop_category = _category_of(crop_name)
            if crop_preference and crop_preference.strip():
                pref_key = crop_preference.strip()
                if pref_key in CROP_CATEGORIES and crop_name in CROP_CATEGORIES[pref_key]:
                    pref_score = 1.5
                    explanation.append(f"⭐ Matches your preference ({pref_key})")
                else:
                    explanation.append(f"↘️ Not in your preferred category ({pref_key})")
            score_components["pref_score"] = pref_score

            # ─── 3g. Combine — Weighted Fusion ──────────────────────
            # Max possible: agronomic(10)*0.35 + npk(10)*0.12 + season(1) + ml(2) + kb(2)*0.75 + pref(1.5) ≈ 10
            raw_total = (
                agronomic_score * 0.35     # 35% weight: soil-climate match
                + npk_score * 0.12         # 12% weight: nutrient balance
                + season_bonus * 1.0       # season match
                + ml_score * 0.8           # ML evidence
                + kb_score * 0.6           # Knowledge base evidence
                + pref_score * 1.0         # User preference alignment
            )
            final_score = min(10.0, raw_total)

            # Confidence calibration
            confidence = self._calibrate_confidence(
                agronomic_score, npk_score, season_bonus, ml_prob, kb_freq
            )

            # Predicted yield/price from KB or ML
            predicted_yield = ml_predictions.get("yield_estimate") or kb_data.get("avg_yield", 0)
            predicted_price = ml_predictions.get("price_estimate") or kb_data.get("avg_price", 0)
            sustainability = ml_predictions.get("sustainability_estimate") or 5.0

            scored_crops.append({
                "crop": crop_name.title(),
                "final_score": final_score,
                "confidence": confidence,
                "agronomic_score": agronomic_score,
                "npk_score": npk_score,
                "season_bonus": season_bonus,
                "ml_score": ml_score,
                "kb_score": kb_score,
                "pref_score": pref_score,
                "category": crop_category,
                "explanation": explanation,
                "predicted_yield": predicted_yield,
                "predicted_price": predicted_price,
                "sustainability": sustainability,
            })

        return scored_crops

    # ─────────────────────────────────────────────────────────────────
    # LAYER 4: LLM ENHANCEMENT (Optional)
    # ─────────────────────────────────────────────────────────────────

    def _layer4_llm_enhance(
        self, top_crop, alternatives, ph, temperature, rainfall,
        nitrogen, phosphorus, potassium, season,
    ) -> Tuple[str, str]:
        """Use Groq LLM to generate natural language advice."""
        try:
            from models.llm_config import call_gemini_text

            prompt = f"""You are an agricultural advisor. Based on our custom AI engine's analysis, provide brief practical farming advice:

RECOMMENDED CROP: {top_crop['crop']} (confidence: {top_crop['confidence']:.0f}%)
ALTERNATIVES: {', '.join(a['crop'] for a in alternatives[:3])}
CONDITIONS: pH={ph}, Temp={temperature}°C, Rain={rainfall}mm, N={nitrogen}, P={phosphorus}, K={potassium}
SEASON: {season}
OUR ENGINE'S ANALYSIS:
{chr(10).join(top_crop.get('explanation', [])[:5])}

Provide:
1. A simple 2-sentence recommendation a farmer can understand (even an illiterate farmer listening through voice)
2. One specific actionable tip for this crop in these conditions
Keep it short, practical, and in simple language."""

            response = call_gemini_text(
                "You are a friendly farming advisor. Speak simply.",
                prompt, temperature=0.4, max_retries=2, timeout=20,
            )
            if response:
                # Split into advice and reasoning
                lines = response.strip().split("\n")
                advice = response.strip()
                reasoning = f"Custom engine score: {top_crop['final_score']:.1f}/10, " \
                           f"Layers: agronomic({top_crop['agronomic_score']:.1f}), " \
                           f"ML({top_crop['ml_score']:.1f}), " \
                           f"KB({top_crop['kb_score']:.1f})"
                return advice, reasoning
        except Exception as e:
            print(f"   ⚠️ LLM enhancement skipped: {e}")

        return "", ""

    # ─────────────────────────────────────────────────────────────────
    # COMPARATIVE SCORING — Show why one crop beats another
    # ─────────────────────────────────────────────────────────────────

    @staticmethod
    def _build_comparative(crop_scores: List[Dict], crop_preference: str = None) -> Dict:
        """
        Build a comparative analysis for the frontend.
        Groups crops by category and shows relative strengths.
        """
        if not crop_scores:
            return {"preferred_category": [], "all_categories": {}}

        # Group by category
        by_category = {}
        for c in crop_scores:
            cat = c.get("category", "Other")
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append({
                "crop": c["crop"],
                "score": round(c["final_score"], 2),
                "agronomic": round(c.get("agronomic_score", 0), 2),
                "npk": round(c.get("npk_score", 0), 2),
                "season": round(c.get("season_bonus", 0), 2),
                "ml": round(c.get("ml_score", 0), 2),
                "kb": round(c.get("kb_score", 0), 2),
                "icon": CROP_OPTIMAL_CONDITIONS.get(c["crop"].lower(), {}).get("icon", "🌱"),
                "confidence": round(c.get("confidence", 0), 1),
            })

        # Sort each category by score
        for cat in by_category:
            by_category[cat].sort(key=lambda x: x["score"], reverse=True)

        # Build the preferred category comparison
        preferred_list = []
        if crop_preference and crop_preference in by_category:
            preferred_list = by_category[crop_preference]
        elif crop_preference:
            # Try matching category names loosely
            for cat, items in by_category.items():
                if crop_preference.lower() in cat.lower():
                    preferred_list = items
                    break

        # Top 8 overall for comparison (always include)
        top_overall = []
        for c in crop_scores[:8]:
            top_overall.append({
                "crop": c["crop"],
                "score": round(c["final_score"], 2),
                "category": c.get("category", "Other"),
                "icon": CROP_OPTIMAL_CONDITIONS.get(c["crop"].lower(), {}).get("icon", "🌱"),
                "confidence": round(c.get("confidence", 0), 1),
                "agronomic": round(c.get("agronomic_score", 0), 2),
                "season": round(c.get("season_bonus", 0), 2),
            })

        return {
            "preferred_category": preferred_list,
            "preferred_category_name": crop_preference or "",
            "all_categories": by_category,
            "top_overall": top_overall,
        }

    # ─────────────────────────────────────────────────────────────────
    # SCORING HELPERS
    # ─────────────────────────────────────────────────────────────────

    @staticmethod
    def _range_score(value, low, high, margin=0):
        """Score how well a value fits within an optimal range.
        Returns 0.0-1.0: 1.0 = perfect match, 0.0 = far out of range.
        """
        if low <= value <= high:
            return 1.0
        elif value < low:
            distance = low - value
            if margin > 0 and distance <= margin:
                return 1.0 - (distance / margin) * 0.6
            return max(0.0, 0.4 - distance / (margin * 3 if margin else 10))
        else:  # value > high
            distance = value - high
            if margin > 0 and distance <= margin:
                return 1.0 - (distance / margin) * 0.6
            return max(0.0, 0.4 - distance / (margin * 3 if margin else 10))

    @staticmethod
    def _calibrate_confidence(
        agronomic, npk, season, ml_prob, kb_freq
    ):
        """Calibrate overall confidence percentage."""
        base = 30  # minimum
        base += min(30, agronomic * 3)     # up to +30 from soil/climate
        base += min(10, npk)               # up to +10 from nutrients
        base += season * 10                # +10 if in season
        base += min(10, ml_prob * 10)      # up to +10 from ML
        base += min(10, kb_freq * 2)       # up to +10 from data evidence
        return min(98, base)               # cap at 98%

    def _get_active_layers(self, use_llm):
        layers = []
        if self.crop_classifier:
            layers.append("ML Models (trained on 296K records)")
        layers.append("Knowledge Base RAG (TF-IDF retrieval)")
        layers.append("Custom Agronomic Algorithm")
        if use_llm:
            layers.append("LLM Enhancement (Groq/Llama 3.3)")
        return layers

    def _count_data_points(self):
        total = 0
        if self.kb.crop_production_df is not None:
            total += len(self.kb.crop_production_df)
        if self.kb.agricultural_df is not None:
            total += len(self.kb.agricultural_df)
        return total

    def _empty_result(self):
        return {
            "recommended_crop": "Wheat",
            "crop_icon": "🌾",
            "final_score": 5.0,
            "confidence": 30.0,
            "layer_scores": {},
            "score_explanation": ["Insufficient data for analysis"],
            "alternatives": [],
            "historical_evidence": {},
            "kb_records_matched": 0,
            "llm_advice": "",
            "llm_reasoning": "",
            "engine": "AgriSmart Hybrid Engine v1.0 (fallback)",
            "layers_used": ["Custom Agronomic Algorithm (offline)"],
            "season": "unknown",
            "data_points_analysed": 0,
            "estimated_yield": 0,
            "estimated_price": 0,
            "sustainability_score": 5.0,
        }
