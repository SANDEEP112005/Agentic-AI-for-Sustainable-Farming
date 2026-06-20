"""
WeatherAnalyst — LLM-Powered Crop-Weather Impact Agent
=======================================================
A genuine AI agent that uses Groq (Llama 3.3 70B) to reason about weather
conditions, crop-specific vulnerabilities, and climate risk for farming decisions.

Architecture:
  1. Crop weather profiles are provided as context for the LLM
  2. LLM analyses the specific conditions with meteorological reasoning
  3. Optional live weather via Open-Meteo API (free, no key) enriches the analysis
  4. Falls back to rule-based scoring when the LLM is unavailable
"""

import os
import requests as http_requests
from datetime import datetime
from typing import Dict, List, Optional

from models.llm_config import call_gemini


# ═══════════════════════════════════════════════════════════════════════════════
# Weather-Crop Reference Data — context for the LLM
# ═══════════════════════════════════════════════════════════════════════════════

WEATHER_PROFILES = {
    "Rice":       {"temp_opt": "22-32°C", "temp_stress": "<15 or >40°C", "rain_opt": "150-300mm", "rain_extremes": "drought<80mm, flood>500mm", "humidity": "70-90%", "drought_tol": "low", "flood_tol": "high", "frost": "sensitive"},
    "Wheat":      {"temp_opt": "12-25°C", "temp_stress": "<3 or >35°C",  "rain_opt": "40-100mm",  "rain_extremes": "drought<20mm, flood>180mm", "humidity": "40-70%", "drought_tol": "medium", "flood_tol": "low", "frost": "tolerant"},
    "Corn":       {"temp_opt": "21-32°C", "temp_stress": "<10 or >40°C", "rain_opt": "80-150mm",  "rain_extremes": "drought<40mm, flood>300mm", "humidity": "60-80%", "drought_tol": "medium", "flood_tol": "low", "frost": "sensitive"},
    "Soybean":    {"temp_opt": "20-30°C", "temp_stress": "<10 or >38°C", "rain_opt": "60-120mm",  "rain_extremes": "drought<30mm, flood>250mm", "humidity": "60-80%", "drought_tol": "low",    "flood_tol": "low", "frost": "sensitive"},
    "Cotton":     {"temp_opt": "25-35°C", "temp_stress": "<15 or >42°C", "rain_opt": "80-150mm",  "rain_extremes": "drought<40mm, flood>250mm", "humidity": "50-70%", "drought_tol": "medium", "flood_tol": "low", "frost": "sensitive"},
    "Sugarcane":  {"temp_opt": "25-35°C", "temp_stress": "<15 or >42°C", "rain_opt": "120-250mm", "rain_extremes": "drought<60mm, flood>450mm", "humidity": "70-90%", "drought_tol": "low",    "flood_tol": "medium", "frost": "sensitive"},
    "Groundnut":  {"temp_opt": "25-32°C", "temp_stress": "<15 or >40°C", "rain_opt": "60-120mm",  "rain_extremes": "drought<30mm, flood>200mm", "humidity": "50-70%", "drought_tol": "medium", "flood_tol": "low", "frost": "sensitive"},
    "Mustard":    {"temp_opt": "15-25°C", "temp_stress": "<5 or >35°C",  "rain_opt": "35-60mm",   "rain_extremes": "drought<15mm, flood>120mm", "humidity": "40-60%", "drought_tol": "medium", "flood_tol": "low", "frost": "moderate"},
    "Chickpea":   {"temp_opt": "15-28°C", "temp_stress": "<5 or >35°C",  "rain_opt": "30-60mm",   "rain_extremes": "drought<15mm, flood>100mm", "humidity": "35-60%", "drought_tol": "high",   "flood_tol": "low", "frost": "moderate"},
    "Millet":     {"temp_opt": "25-35°C", "temp_stress": "<15 or >42°C", "rain_opt": "30-60mm",   "rain_extremes": "drought<15mm, flood>120mm", "humidity": "30-60%", "drought_tol": "very high","flood_tol": "low","frost": "moderate"},
    "Tea":        {"temp_opt": "18-28°C", "temp_stress": "<10 or >35°C", "rain_opt": "200-350mm", "rain_extremes": "drought<100mm, flood>500mm","humidity": "70-90%", "drought_tol": "low",    "flood_tol": "medium", "frost": "moderate"},
    "Potato":     {"temp_opt": "15-25°C", "temp_stress": "<5 or >35°C",  "rain_opt": "50-80mm",   "rain_extremes": "drought<25mm, flood>150mm", "humidity": "60-80%", "drought_tol": "low",    "flood_tol": "low", "frost": "sensitive"},
    "Tomato":     {"temp_opt": "20-30°C", "temp_stress": "<10 or >38°C", "rain_opt": "50-100mm",  "rain_extremes": "drought<25mm, flood>180mm", "humidity": "50-70%", "drought_tol": "low",    "flood_tol": "low", "frost": "sensitive"},
    "Banana":     {"temp_opt": "25-32°C", "temp_stress": "<12 or >38°C", "rain_opt": "120-200mm", "rain_extremes": "drought<60mm, flood>350mm", "humidity": "70-90%", "drought_tol": "low",    "flood_tol": "low", "frost": "very sensitive"},
}

# Open-Meteo API — free, no API key needed
OPEN_METEO_BASE = "https://api.open-meteo.com/v1"
OPEN_METEO_GEOCODE = "https://geocoding-api.open-meteo.com/v1/search"


# ═══════════════════════════════════════════════════════════════════════════════
# Agent System Prompt
# ═══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """You are **WeatherAnalyst**, an expert agricultural meteorologist AI agent.

YOUR EXPERTISE:
- Crop-weather interactions: How temperature, rainfall, humidity affect different crops at each growth stage
- Climate risk assessment: Drought, flood, frost, heat stress, waterlogging
- Growth-stage vulnerability: Which weather events are most damaging at which crop stage
- Indian monsoon patterns: Kharif/Rabi seasonal dynamics
- Yield impact prediction: How weather deviations translate to yield loss/gain
- Adaptation strategies: Irrigation timing, mulching, shelter, varietal switching

ANALYSIS METHODOLOGY:
1. Compare current temperature vs crop's optimal and stress ranges
2. Evaluate rainfall adequacy — drought or flood risk
3. Assess humidity impact on crop health (fungal vs desiccation risk)
4. Identify specific weather risks (frost, heat wave, waterlogging)
5. Estimate yield impact as percentage deviation from normal
6. Recommend weather-adaptive farming practices

Respond with a JSON object:
{
  "weather_score": <float 0-10, weather suitability for the crop>,
  "risk_level": "Low" | "Moderate" | "High" | "Severe",
  "forecast": "2-3 sentence weather outlook and its farming implications",
  "predicted_yield_impact": "percentage impact on yield, e.g. '+5%' or '-15%'",
  "risks": ["Specific weather risks identified"],
  "reasoning": "How you arrived at this assessment",
  "advice": "Actionable weather-adaptive farming recommendations"
}"""


# ═══════════════════════════════════════════════════════════════════════════════
# WeatherAnalyst Agent
# ═══════════════════════════════════════════════════════════════════════════════

class WeatherAnalyst:
    """LLM-powered weather impact analysis agent."""

    def __init__(self, db_path: str = None):
        self.db_path = db_path
        print("🌤️ WeatherAnalyst agent initialised (LLM-powered)")

    # ── Public API ───────────────────────────────────────────────────

    def analyze_weather_impact(self, temperature: float = 25,
                               rainfall: float = 100,
                               humidity: float = 60,
                               crop: str = "Rice") -> Dict:
        """Primary weather analysis method."""

        # Try to get live weather if possible
        live_data = None  # Could be enriched with get_live_weather()

        # Try LLM first
        llm_result = self._llm_analyse(temperature, rainfall, humidity, crop, live_data)
        if llm_result:
            return llm_result

        # Fallback
        print("⚠️ WeatherAnalyst: LLM unavailable, using fallback scoring")
        return self._fallback_analyse(temperature, rainfall, humidity, crop)

    def forecast(self, soil_ph=6.5, soil_moisture=60,
                 fertilizer=50, pesticide=2.0) -> Dict:
        """Backward-compatible alias for agent_setup.py.
        Returns dict with 'temperature' and 'rainfall' lists."""
        return {
            "temperature": [25.0],
            "rainfall": [100.0],
        }

    def _geocode_city(self, city: str) -> Optional[Dict]:
        """Resolve city name to lat/lon using Open-Meteo Geocoding API."""
        try:
            resp = http_requests.get(OPEN_METEO_GEOCODE, params={
                "name": city, "count": 1, "language": "en", "format": "json",
            }, timeout=8)
            resp.raise_for_status()
            results = resp.json().get("results", [])
            if results:
                return {"lat": results[0]["latitude"], "lon": results[0]["longitude"],
                        "name": results[0].get("name", city)}
        except Exception as e:
            print(f"⚠️ Geocoding failed for '{city}': {e}")
        return None

    def get_live_weather(self, city: str) -> Optional[Dict]:
        """Fetch current weather from Open-Meteo (free, no API key)."""
        try:
            geo = self._geocode_city(city)
            if not geo:
                return None

            url = f"{OPEN_METEO_BASE}/forecast"
            resp = http_requests.get(url, params={
                "latitude": geo["lat"], "longitude": geo["lon"],
                "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature",
                "timezone": "auto",
            }, timeout=10)
            resp.raise_for_status()
            data = resp.json().get("current", {})

            # Map WMO weather codes to descriptions
            wmo_code = data.get("weather_code", 0)
            description = self._wmo_description(wmo_code)

            return {
                "temperature": data.get("temperature_2m"),
                "humidity": data.get("relative_humidity_2m"),
                "description": description,
                "wind_speed": data.get("wind_speed_10m"),
                "feels_like": data.get("apparent_temperature"),
                "city": geo["name"],
            }
        except Exception as e:
            print(f"⚠️ Live weather fetch failed: {e}")
            return None

    def get_forecast_7day(self, city: str) -> Optional[List[Dict]]:
        """Fetch 7-day daily forecast from Open-Meteo."""
        try:
            geo = self._geocode_city(city)
            if not geo:
                return None

            url = f"{OPEN_METEO_BASE}/forecast"
            resp = http_requests.get(url, params={
                "latitude": geo["lat"], "longitude": geo["lon"],
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,relative_humidity_2m_mean",
                "timezone": "auto",
                "forecast_days": 7,
            }, timeout=10)
            resp.raise_for_status()
            daily = resp.json().get("daily", {})

            forecasts = []
            dates = daily.get("time", [])
            for i, date in enumerate(dates):
                forecasts.append({
                    "datetime": date,
                    "temp_max": daily["temperature_2m_max"][i],
                    "temp_min": daily["temperature_2m_min"][i],
                    "temp": round((daily["temperature_2m_max"][i] + daily["temperature_2m_min"][i]) / 2, 1),
                    "humidity": daily.get("relative_humidity_2m_mean", [60]*7)[i],
                    "precipitation": daily["precipitation_sum"][i],
                    "description": self._wmo_description(daily["weather_code"][i]),
                })
            return forecasts
        except Exception as e:
            print(f"⚠️ Forecast fetch failed: {e}")
            return None

    @staticmethod
    def _wmo_description(code: int) -> str:
        """Convert WMO weather code to human-readable description."""
        wmo_map = {
            0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
            45: "foggy", 48: "depositing rime fog",
            51: "light drizzle", 53: "moderate drizzle", 55: "dense drizzle",
            61: "slight rain", 63: "moderate rain", 65: "heavy rain",
            71: "slight snow", 73: "moderate snow", 75: "heavy snow",
            80: "slight rain showers", 81: "moderate rain showers", 82: "violent rain showers",
            85: "slight snow showers", 86: "heavy snow showers",
            95: "thunderstorm", 96: "thunderstorm with slight hail", 99: "thunderstorm with heavy hail",
        }
        return wmo_map.get(code, f"weather code {code}")

    # ── LLM Path ─────────────────────────────────────────────────────

    def _llm_analyse(self, temperature, rainfall, humidity, crop,
                     live_data=None) -> Optional[Dict]:
        """Call Gemini for intelligent weather analysis."""

        now = datetime.now()
        month_name = now.strftime("%B")

        crop_key = crop.strip().title()
        crop_profile = WEATHER_PROFILES.get(crop_key, {})

        # Build weather profiles context
        ref_lines = []
        for name, data in WEATHER_PROFILES.items():
            ref_lines.append(
                f"  {name}: Temp opt {data['temp_opt']}, stress {data['temp_stress']}, "
                f"Rain opt {data['rain_opt']}, {data['rain_extremes']}, "
                f"Humidity {data['humidity']}, Drought tol: {data['drought_tol']}, "
                f"Flood tol: {data['flood_tol']}, Frost: {data['frost']}"
            )
        weather_ref = "\n".join(ref_lines)

        live_section = ""
        if live_data:
            live_section = f"""
LIVE WEATHER DATA:
- City: {live_data.get('city', 'Unknown')}
- Current Temperature: {live_data.get('temperature')}°C
- Current Humidity: {live_data.get('humidity')}%
- Conditions: {live_data.get('description')}
- Wind Speed: {live_data.get('wind_speed')} m/s
"""

        user_prompt = f"""Analyse the weather impact on this crop:

TARGET CROP: {crop}
CROP-SPECIFIC WEATHER PROFILE:
{crop_profile if crop_profile else 'No specific profile available — use your agricultural meteorology knowledge'}

CURRENT/EXPECTED WEATHER CONDITIONS:
- Temperature: {temperature}°C
- Rainfall: {rainfall} mm/season
- Humidity: {humidity}%
- Current Month: {month_name}
{live_section}

WEATHER REFERENCE DATA FOR ALL CROPS:
{weather_ref}

Assess how suitable these weather conditions are for {crop}. Identify specific risks, estimate yield impact, and provide weather-adaptive farming advice."""

        response = call_gemini(SYSTEM_PROMPT, user_prompt, temperature=0.3)
        if not response:
            return None

        return self._validate_response(response)

    def _validate_response(self, resp: Dict) -> Optional[Dict]:
        """Validate LLM response."""
        try:
            weather_score = float(resp.get("weather_score", 5.0))
            weather_score = max(0.0, min(10.0, weather_score))

            risk_level = str(resp.get("risk_level", "Moderate"))
            if risk_level not in ("Low", "Moderate", "High", "Severe"):
                risk_level = "Moderate"

            forecast = str(resp.get("forecast", ""))
            reasoning = str(resp.get("reasoning", ""))
            advice = str(resp.get("advice", ""))
            risks = resp.get("risks", [])
            if isinstance(risks, str):
                risks = [risks]

            return {
                "weather_score": round(weather_score, 1),
                "risk_level": risk_level,
                "forecast": forecast,
                "predicted_yield_impact": str(resp.get("predicted_yield_impact", "0%")),
                "risks": risks,
                "reasoning": reasoning,
                "advice": advice,
            }
        except Exception as e:
            print(f"⚠️ WeatherAnalyst: LLM response validation failed: {e}")
            return None

    # ── Fallback Path ────────────────────────────────────────────────

    def _fallback_analyse(self, temperature, rainfall, humidity,
                          crop) -> Dict:
        """Rule-based fallback when LLM is unavailable."""
        score = 5.0
        risks = []

        # Temperature assessment
        if 20 <= temperature <= 32:
            score += 2.0
        elif temperature < 10 or temperature > 40:
            score -= 2.0
            risks.append(f"Extreme temperature ({temperature}°C)")
        else:
            score += 0.5

        # Rainfall assessment
        if 60 <= rainfall <= 200:
            score += 2.0
        elif rainfall < 30:
            score -= 1.5
            risks.append("Drought risk — low rainfall")
        elif rainfall > 350:
            score -= 1.5
            risks.append("Flood risk — excessive rainfall")
        else:
            score += 0.5

        # Humidity
        if 50 <= humidity <= 80:
            score += 1.0
        elif humidity > 90:
            risks.append("High humidity — fungal disease risk")

        score = max(0.0, min(10.0, score))
        risk_level = ("Low" if score > 7 else "Moderate" if score > 5
                      else "High" if score > 3 else "Severe")

        return {
            "weather_score": round(score, 1),
            "risk_level": risk_level,
            "forecast": f"Temperature {temperature}°C with {rainfall}mm rainfall (offline analysis).",
            "predicted_yield_impact": "0%",
            "risks": risks or ["No major weather risks detected"],
            "reasoning": "Fallback analysis — LLM unavailable.",
            "advice": f"Monitor weather conditions for {crop} closely.",
        }
