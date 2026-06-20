"""
FarmerAdvisor — LLM-Powered Crop Recommendation Agent
======================================================
A genuine AI agent that uses Google Gemini to reason about soil conditions,
climate data, and nutrient levels to recommend optimal crops.

Architecture:
  1. Crop reference data is loaded as CONTEXT for the LLM (not hardcoded rules)
  2. Gemini reasons holistically — understanding agricultural science, not
     just threshold-matching
  3. Returns nuanced recommendations with confidence, alternatives, and
     specific agronomic advice
  4. Falls back to lightweight scoring if the LLM is unavailable

This is a real agentic expert — it THINKS, not just looks up tables.
"""

import os
from datetime import datetime
from typing import Dict, List, Optional

from models.llm_config import call_gemini


# ═══════════════════════════════════════════════════════════════════════════════
# Crop Reference Data — fed to the LLM as grounding context
# The LLM uses this data to reason; it does NOT mechanically match thresholds.
# ═══════════════════════════════════════════════════════════════════════════════

CROP_PROFILES: Dict[str, Dict] = {
    "Rice":       {"ph": "5.0-8.0 (opt 5.5-7.0)", "temp": "15-40°C (opt 22-32)", "rain": "100-500mm (opt 150-300)", "season": "Kharif", "soil": "Clay, Loamy, Black", "water": "High", "npk": "N:60-120 P:20-50 K:20-50", "msp": 2203},
    "Wheat":      {"ph": "5.5-8.5 (opt 6.0-7.5)", "temp": "5-32°C (opt 12-25)",  "rain": "25-150mm (opt 40-100)",  "season": "Rabi",   "soil": "Loamy, Clay, Black",  "water": "Medium", "npk": "N:60-120 P:25-60 K:20-50", "msp": 2275},
    "Corn":       {"ph": "5.5-8.0 (opt 6.0-7.0)", "temp": "15-40°C (opt 21-32)", "rain": "50-250mm (opt 80-150)",  "season": "Kharif/Rabi", "soil": "Loamy, Sandy, Red", "water": "Medium", "npk": "N:80-160 P:25-60 K:25-60", "msp": 2090},
    "Soybean":    {"ph": "5.5-7.5 (opt 6.0-7.0)", "temp": "15-35°C (opt 20-30)", "rain": "45-200mm (opt 60-120)",  "season": "Kharif", "soil": "Loamy, Black, Clay",  "water": "Medium", "npk": "N:15-40 P:30-60 K:25-50",  "msp": 4892},
    "Cotton":     {"ph": "6.0-8.5 (opt 6.5-8.0)", "temp": "20-42°C (opt 25-35)", "rain": "50-200mm (opt 80-150)",  "season": "Kharif", "soil": "Black, Loamy, Clay",  "water": "Medium", "npk": "N:60-120 P:20-50 K:20-40", "msp": 7121},
    "Sugarcane":  {"ph": "5.0-8.5 (opt 6.0-7.5)", "temp": "20-42°C (opt 25-35)", "rain": "75-350mm (opt 120-250)", "season": "Kharif", "soil": "Loamy, Clay, Black",  "water": "Very High", "npk": "N:100-200 P:30-60 K:40-80", "msp": 315},
    "Groundnut":  {"ph": "5.5-8.0 (opt 6.0-7.0)", "temp": "20-40°C (opt 25-32)", "rain": "40-200mm (opt 60-120)",  "season": "Kharif", "soil": "Sandy, Loamy, Red",   "water": "Low-Medium", "npk": "N:10-25 P:30-60 K:20-40", "msp": 6377},
    "Mustard":    {"ph": "5.5-8.0 (opt 6.0-7.5)", "temp": "10-30°C (opt 15-25)", "rain": "25-100mm (opt 35-60)",   "season": "Rabi",   "soil": "Loamy, Sandy",         "water": "Low", "npk": "N:40-80 P:20-40 K:10-20",   "msp": 5650},
    "Chickpea":   {"ph": "5.5-8.0 (opt 6.0-7.5)", "temp": "10-35°C (opt 15-28)", "rain": "20-100mm (opt 30-60)",   "season": "Rabi",   "soil": "Loamy, Black, Sandy",  "water": "Low", "npk": "N:10-25 P:30-60 K:20-40",   "msp": 5440},
    "Lentil":     {"ph": "5.5-8.0 (opt 6.0-7.5)", "temp": "10-30°C (opt 15-25)", "rain": "20-80mm (opt 30-50)",    "season": "Rabi",   "soil": "Loamy, Clay, Sandy",   "water": "Low", "npk": "N:10-25 P:25-50 K:15-30",   "msp": 6425},
    "Tomato":     {"ph": "5.5-7.5 (opt 6.0-7.0)", "temp": "15-35°C (opt 20-30)", "rain": "40-150mm (opt 50-100)",  "season": "Rabi/Both", "soil": "Loamy, Sandy, Red", "water": "Medium", "npk": "N:80-150 P:40-80 K:40-80", "msp": None},
    "Potato":     {"ph": "4.5-7.0 (opt 5.0-6.5)", "temp": "10-30°C (opt 15-25)", "rain": "30-120mm (opt 50-80)",   "season": "Rabi",   "soil": "Sandy, Loamy",         "water": "Medium", "npk": "N:80-150 P:40-80 K:50-100", "msp": None},
    "Onion":      {"ph": "5.5-7.5 (opt 6.0-7.0)", "temp": "10-35°C (opt 15-28)", "rain": "30-100mm (opt 40-70)",   "season": "Rabi",   "soil": "Loamy, Sandy, Red",    "water": "Medium", "npk": "N:60-120 P:30-60 K:30-60", "msp": None},
    "Millet":     {"ph": "5.0-8.0 (opt 5.5-7.5)", "temp": "20-40°C (opt 25-35)", "rain": "25-100mm (opt 30-60)",   "season": "Kharif", "soil": "Sandy, Loamy, Red",    "water": "Very Low", "npk": "N:20-60 P:10-30 K:10-25", "msp": 2625},
    "Barley":     {"ph": "6.0-8.5 (opt 6.5-7.5)", "temp": "5-30°C (opt 12-22)",  "rain": "25-80mm (opt 30-50)",    "season": "Rabi",   "soil": "Loamy, Sandy, Clay",   "water": "Low", "npk": "N:40-80 P:20-40 K:15-30",   "msp": 1850},
    "Sunflower":  {"ph": "6.0-8.0 (opt 6.5-7.5)", "temp": "18-35°C (opt 22-30)", "rain": "40-120mm (opt 50-80)",   "season": "Rabi/Kharif", "soil": "Loamy, Black, Clay", "water": "Medium", "npk": "N:40-80 P:25-50 K:15-30", "msp": 5650},
    "Jute":       {"ph": "5.0-8.0 (opt 6.0-7.5)", "temp": "20-40°C (opt 25-35)", "rain": "120-350mm (opt 150-250)","season": "Kharif", "soil": "Loamy, Clay, Alluvial","water": "High", "npk": "N:40-80 P:15-30 K:20-40",   "msp": 5050},
    "Tea":        {"ph": "4.0-6.5 (opt 4.5-5.5)", "temp": "12-35°C (opt 18-28)", "rain": "150-500mm (opt 200-350)","season": "Year-round","soil": "Loamy, Acidic, Red", "water": "High", "npk": "N:80-200 P:20-60 K:30-80",  "msp": None},
    "Coffee":     {"ph": "5.0-6.5 (opt 5.5-6.0)", "temp": "15-30°C (opt 18-25)", "rain": "120-350mm (opt 150-250)","season": "Year-round","soil": "Loamy, Red, Laterite","water": "Medium-High","npk": "N:60-150 P:20-50 K:40-100","msp": None},
    "Turmeric":   {"ph": "4.5-7.5 (opt 5.5-7.0)", "temp": "20-35°C (opt 25-32)", "rain": "100-300mm (opt 150-220)","season": "Kharif", "soil": "Loamy, Sandy, Red",    "water": "Medium", "npk": "N:30-60 P:20-40 K:40-80",  "msp": None},
    "Banana":     {"ph": "5.5-7.5 (opt 6.0-7.0)", "temp": "20-38°C (opt 25-32)", "rain": "100-300mm (opt 120-200)","season": "Year-round","soil": "Loamy, Clay, Alluvial","water": "High","npk": "N:100-200 P:30-60 K:100-200","msp": None},
    "Pigeon Pea": {"ph": "5.0-8.0 (opt 6.0-7.5)", "temp": "18-38°C (opt 22-32)", "rain": "50-200mm (opt 60-120)",  "season": "Kharif", "soil": "Loamy, Black, Red",    "water": "Low", "npk": "N:10-25 P:25-50 K:10-25",   "msp": 7000},
    "Sesame":     {"ph": "5.5-8.0 (opt 6.0-7.0)", "temp": "20-40°C (opt 25-35)", "rain": "30-100mm (opt 40-65)",   "season": "Kharif", "soil": "Sandy, Loamy, Red",    "water": "Low", "npk": "N:20-50 P:15-30 K:10-25",   "msp": 8635},
    "Castor":     {"ph": "5.0-8.0 (opt 6.0-7.0)", "temp": "20-38°C (opt 25-32)", "rain": "40-150mm (opt 50-100)",  "season": "Kharif", "soil": "Sandy, Loamy, Red",    "water": "Low", "npk": "N:30-80 P:15-40 K:10-30",   "msp": 6600},
    "Maize":      {"ph": "5.5-8.0 (opt 6.0-7.0)", "temp": "15-40°C (opt 21-32)", "rain": "50-250mm (opt 80-150)",  "season": "Kharif/Rabi", "soil": "Loamy, Sandy, Red", "water": "Medium", "npk": "N:80-160 P:25-60 K:25-60", "msp": 2090},
}


# ═══════════════════════════════════════════════════════════════════════════════
# Agent System Prompt
# ═══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """You are **FarmerAdvisor**, an expert agronomist AI agent specialising in Indian and global agriculture.

YOUR EXPERTISE:
- Soil science: pH optimisation, nutrient availability windows per crop, soil-type matching
- Crop science: Growth requirements, varietal selection, season suitability
- Climate-crop interactions: Temperature sensitivity curves, rainfall thresholds, humidity effects
- Nutrient management: N-P-K demand per crop, deficiency diagnosis, organic vs inorganic trade-offs
- Agricultural economics: MSP (Minimum Support Price) awareness, cost-benefit reasoning

ANALYSIS METHODOLOGY (follow this thinking order):
1. Evaluate soil-crop compatibility (pH range, texture, drainage)
2. Assess climate suitability (temperature vs crop thermal window, rainfall vs water need)
3. Check nutrient availability vs crop demand (N, P, K balance)
4. Consider seasonal appropriateness (month → Kharif/Rabi/Zaid)
5. Factor in water availability and irrigation needs
6. Rank candidate crops by holistic multi-dimensional suitability
7. Provide reasoning that a real farmer would find actionable

IMPORTANT RULES:
- You MUST use the crop reference data provided to ground your recommendation in real agricultural science
- Do NOT hallucinate crop data — use the reference table
- Score should reflect genuine suitability, not optimism
- Confidence should be lower when conditions are marginal or between seasons
- Alternatives should be genuinely different options, not just synonyms

Respond with a JSON object:
{
  "crop": "Best recommended crop name (must match a name from the reference data)",
  "score": <float 0-10, suitability score>,
  "confidence": <float 0-100, how certain you are>,
  "reasoning": "2-3 sentences explaining WHY this crop is the best choice for these specific conditions",
  "alternatives": [
    {"crop": "name", "score": <float 0-10>, "reason": "brief reason"},
    ...up to 4 alternatives
  ],
  "advice": "Specific, actionable agronomic advice for the recommended crop under these exact conditions (planting tips, nutrient adjustment, irrigation guidance)",
  "warnings": ["Any risks or concerns the farmer should watch for"]
}"""


# ═══════════════════════════════════════════════════════════════════════════════
# FarmerAdvisor Agent
# ═══════════════════════════════════════════════════════════════════════════════

class FarmerAdvisor:
    """LLM-powered crop recommendation agent.

    Uses Google Gemini to reason about soil/climate conditions against
    a comprehensive crop knowledge base. Falls back to lightweight
    scoring when the LLM is unavailable.
    """

    def __init__(self, db_path: str = None):
        """db_path kept for backward compatibility."""
        self.db_path = db_path
        print("🌾 FarmerAdvisor agent initialised (LLM-powered)")

    # ── Public API ───────────────────────────────────────────────────

    def recommend(self, soil_ph=6.5, soil_moisture=60, temp=25,
                  rainfall=100, fertilizer=50, pesticide=2.0,
                  crop_yield=3.0, **kwargs) -> str:
        """Backward-compatible string recommendation."""
        result = self.recommend_detailed(
            ph=soil_ph, temperature=temp, rainfall=rainfall,
            humidity=soil_moisture, nitrogen=fertilizer,
            phosphorus=kwargs.get("phosphorus", 30),
            potassium=kwargs.get("potassium", 30),
        )
        return result["crop"]

    def recommend_detailed(self, ph=6.5, temperature=25, rainfall=100,
                           humidity=60, nitrogen=80, phosphorus=30,
                           potassium=30, soil_type=None) -> Dict:
        """Full recommendation via LLM with fallback."""

        # Try LLM first
        llm_result = self._llm_recommend(
            ph, temperature, rainfall, humidity,
            nitrogen, phosphorus, potassium, soil_type,
        )
        if llm_result:
            return llm_result

        # Fallback to rule-based
        print("⚠️ FarmerAdvisor: LLM unavailable, using fallback scoring")
        return self._fallback_recommend(
            ph, temperature, rainfall, humidity,
            nitrogen, phosphorus, potassium,
        )

    # ── LLM Path ─────────────────────────────────────────────────────

    def _llm_recommend(self, ph, temperature, rainfall, humidity,
                       nitrogen, phosphorus, potassium, soil_type) -> Optional[Dict]:
        """Build prompt, call Gemini, parse and validate response."""

        now = datetime.now()
        month_name = now.strftime("%B")
        month_num = now.month
        if month_num in (6, 7, 8, 9, 10):
            season = "Kharif (monsoon)"
        elif month_num in (11, 12, 1, 2, 3):
            season = "Rabi (winter)"
        else:
            season = "Zaid (summer)"

        # Build crop reference text
        ref_lines = []
        for name, data in CROP_PROFILES.items():
            msp = f"₹{data['msp']}/q" if data['msp'] else "Market-priced"
            ref_lines.append(
                f"  {name}: pH {data['ph']}, Temp {data['temp']}, Rain {data['rain']}, "
                f"Season {data['season']}, Soil [{data['soil']}], Water {data['water']}, "
                f"NPK {data['npk']}, MSP {msp}"
            )
        crop_ref = "\n".join(ref_lines)

        user_prompt = f"""Analyse these farm conditions and recommend the best crop:

CURRENT CONDITIONS:
- Soil pH: {ph}
- Temperature: {temperature}°C
- Rainfall: {rainfall} mm/season
- Humidity: {humidity}%
- Nitrogen (N): {nitrogen} kg/ha
- Phosphorus (P): {phosphorus} kg/ha
- Potassium (K): {potassium} kg/ha
- Soil Type: {soil_type or 'Not specified'}
- Current Month: {month_name}
- Season: {season}

CROP REFERENCE DATA (Indian agricultural standards):
{crop_ref}

Based on these conditions and the crop reference data, recommend the optimal crop.
Think step-by-step through soil compatibility, climate match, nutrient balance, and seasonal timing."""

        response = call_gemini(SYSTEM_PROMPT, user_prompt, temperature=0.3)
        if not response:
            return None

        return self._validate_llm_response(response)

    def _validate_llm_response(self, resp: Dict) -> Optional[Dict]:
        """Ensure LLM response has required fields with valid values."""
        try:
            crop = str(resp.get("crop", "")).strip()
            if not crop:
                return None

            score = float(resp.get("score", 5.0))
            score = max(0.0, min(10.0, score))

            confidence = float(resp.get("confidence", 60.0))
            confidence = max(0.0, min(100.0, confidence))

            reasoning = str(resp.get("reasoning", ""))
            advice = str(resp.get("advice", ""))
            warnings = resp.get("warnings", [])
            if isinstance(warnings, str):
                warnings = [warnings]

            alternatives = []
            for alt in resp.get("alternatives", []):
                if isinstance(alt, dict) and "crop" in alt:
                    alternatives.append({
                        "crop": str(alt["crop"]),
                        "score": float(alt.get("score", 5.0)),
                        "reason": str(alt.get("reason", "")),
                    })

            return {
                "crop": crop,
                "score": round(score, 1),
                "confidence": round(confidence, 1),
                "reasoning": reasoning,
                "advice": advice,
                "alternatives": alternatives[:5],
                "warnings": warnings,
            }
        except Exception as e:
            print(f"⚠️ FarmerAdvisor: LLM response validation failed: {e}")
            return None

    # ── Fallback Path ────────────────────────────────────────────────

    def _fallback_recommend(self, ph, temperature, rainfall, humidity,
                            nitrogen, phosphorus, potassium) -> Dict:
        """Lightweight rule-based scoring when LLM is unavailable."""

        SIMPLE_RANGES = {
            "Rice":      {"ph": (5.5, 7.0), "temp": (22, 32), "rain": (150, 300)},
            "Wheat":     {"ph": (6.0, 7.5), "temp": (12, 25), "rain": (40, 100)},
            "Corn":      {"ph": (6.0, 7.0), "temp": (21, 32), "rain": (80, 150)},
            "Soybean":   {"ph": (6.0, 7.0), "temp": (20, 30), "rain": (60, 120)},
            "Cotton":    {"ph": (6.5, 8.0), "temp": (25, 35), "rain": (80, 150)},
            "Millet":    {"ph": (5.5, 7.5), "temp": (25, 35), "rain": (30, 60)},
            "Tea":       {"ph": (4.5, 5.5), "temp": (18, 28), "rain": (200, 350)},
            "Potato":    {"ph": (5.0, 6.5), "temp": (15, 25), "rain": (50, 80)},
            "Chickpea":  {"ph": (6.0, 7.5), "temp": (15, 28), "rain": (30, 60)},
            "Groundnut": {"ph": (6.0, 7.0), "temp": (25, 32), "rain": (60, 120)},
        }

        best_crop, best_score = "Wheat", 0.0
        scored = []
        for crop, ranges in SIMPLE_RANGES.items():
            s = 0.0
            for val, key in [(ph, "ph"), (temperature, "temp"), (rainfall, "rain")]:
                lo, hi = ranges[key]
                if lo <= val <= hi:
                    s += 3.3
                elif lo - 1 <= val <= hi + 1:
                    s += 2.0
                else:
                    s += 0.5
            scored.append((crop, round(s, 1)))
            if s > best_score:
                best_score = s
                best_crop = crop

        scored.sort(key=lambda x: -x[1])
        alternatives = [{"crop": c, "score": s, "reason": "Fallback match"}
                        for c, s in scored[1:5]]

        return {
            "crop": best_crop,
            "score": round(best_score, 1),
            "confidence": 55.0,
            "reasoning": "Recommendation based on offline rule-matching (LLM unavailable).",
            "advice": f"Consider planting {best_crop} based on current pH and temperature conditions.",
            "alternatives": alternatives,
            "warnings": ["AI agent offline — using simplified analysis"],
        }
