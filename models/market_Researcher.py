"""
MarketResearcher — LLM-Powered Agricultural Market Intelligence Agent
=====================================================================
A genuine AI agent that uses Google Gemini to analyse crop market dynamics,
price trends, demand signals, and economic factors.

Architecture:
  1. Indian MSP data & market intelligence is provided as context to the LLM
  2. Gemini analyses the specific crop + conditions with real economic reasoning
  3. Returns nuanced market scores, price forecasts, and strategic insights
  4. Falls back to rule-based scoring when the LLM is unavailable
"""

import os
from datetime import datetime
from typing import Dict, List, Optional

from models.llm_config import call_gemini


# ═══════════════════════════════════════════════════════════════════════════════
# Market Reference Data — fed to the LLM as grounding context
# ═══════════════════════════════════════════════════════════════════════════════

CROP_MARKET_DATA = {
    "Rice":       {"msp": 2203, "avg_market": 2600, "export_demand": "high",   "season": "kharif",  "shelf_life": "365 days", "volatility": "low (0.08)",    "trend": "stable"},
    "Wheat":      {"msp": 2275, "avg_market": 2500, "export_demand": "high",   "season": "rabi",    "shelf_life": "365 days", "volatility": "low (0.07)",    "trend": "stable"},
    "Corn":       {"msp": 2090, "avg_market": 2200, "export_demand": "medium", "season": "kharif",  "shelf_life": "270 days", "volatility": "medium (0.12)", "trend": "growing"},
    "Soybean":    {"msp": 4892, "avg_market": 5200, "export_demand": "high",   "season": "kharif",  "shelf_life": "180 days", "volatility": "medium (0.15)", "trend": "growing"},
    "Cotton":     {"msp": 7121, "avg_market": 7500, "export_demand": "high",   "season": "kharif",  "shelf_life": "365 days", "volatility": "high (0.18)",   "trend": "stable"},
    "Sugarcane":  {"msp": 315,  "avg_market": 350,  "export_demand": "medium", "season": "kharif",  "shelf_life": "3 days",   "volatility": "low (0.06)",    "trend": "stable"},
    "Groundnut":  {"msp": 6377, "avg_market": 6800, "export_demand": "medium", "season": "kharif",  "shelf_life": "180 days", "volatility": "medium (0.14)", "trend": "growing"},
    "Mustard":    {"msp": 5650, "avg_market": 6000, "export_demand": "low",    "season": "rabi",    "shelf_life": "180 days", "volatility": "medium (0.13)", "trend": "stable"},
    "Chickpea":   {"msp": 5440, "avg_market": 5800, "export_demand": "medium", "season": "rabi",    "shelf_life": "365 days", "volatility": "medium (0.11)", "trend": "growing"},
    "Lentil":     {"msp": 6425, "avg_market": 6800, "export_demand": "medium", "season": "rabi",    "shelf_life": "365 days", "volatility": "medium (0.10)", "trend": "growing"},
    "Tomato":     {"msp": None, "avg_market": 2500, "export_demand": "low",    "season": "both",    "shelf_life": "10 days",  "volatility": "very high (0.45)", "trend": "growing"},
    "Potato":     {"msp": None, "avg_market": 1500, "export_demand": "low",    "season": "rabi",    "shelf_life": "90 days",  "volatility": "high (0.30)",   "trend": "stable"},
    "Onion":      {"msp": None, "avg_market": 2000, "export_demand": "medium", "season": "rabi",    "shelf_life": "60 days",  "volatility": "very high (0.50)", "trend": "stable"},
    "Millet":     {"msp": 2625, "avg_market": 3000, "export_demand": "medium", "season": "kharif",  "shelf_life": "365 days", "volatility": "medium (0.10)", "trend": "growing"},
    "Barley":     {"msp": 1850, "avg_market": 2000, "export_demand": "low",    "season": "rabi",    "shelf_life": "365 days", "volatility": "low (0.08)",    "trend": "stable"},
    "Sunflower":  {"msp": 5650, "avg_market": 6000, "export_demand": "low",    "season": "rabi",    "shelf_life": "180 days", "volatility": "medium (0.12)", "trend": "stable"},
    "Jute":       {"msp": 5050, "avg_market": 5300, "export_demand": "high",   "season": "kharif",  "shelf_life": "365 days", "volatility": "low (0.09)",    "trend": "stable"},
    "Tea":        {"msp": None, "avg_market": 18000,"export_demand": "high",   "season": "year-round","shelf_life": "365 days","volatility": "medium (0.12)", "trend": "growing"},
    "Coffee":     {"msp": None, "avg_market": 35000,"export_demand": "high",   "season": "year-round","shelf_life": "365 days","volatility": "medium (0.15)", "trend": "growing"},
    "Turmeric":   {"msp": None, "avg_market": 8000, "export_demand": "high",   "season": "kharif",  "shelf_life": "365 days", "volatility": "medium (0.15)", "trend": "growing"},
    "Banana":     {"msp": None, "avg_market": 1500, "export_demand": "medium", "season": "year-round","shelf_life": "7 days", "volatility": "medium (0.20)", "trend": "stable"},
    "Pigeon Pea": {"msp": 7000, "avg_market": 7500, "export_demand": "medium", "season": "kharif",  "shelf_life": "365 days", "volatility": "medium (0.12)", "trend": "growing"},
    "Sesame":     {"msp": 8635, "avg_market": 9200, "export_demand": "high",   "season": "kharif",  "shelf_life": "180 days", "volatility": "medium (0.14)", "trend": "growing"},
    "Castor":     {"msp": 6600, "avg_market": 7000, "export_demand": "high",   "season": "kharif",  "shelf_life": "365 days", "volatility": "medium (0.12)", "trend": "stable"},
    "Maize":      {"msp": 2090, "avg_market": 2200, "export_demand": "medium", "season": "kharif",  "shelf_life": "270 days", "volatility": "medium (0.12)", "trend": "growing"},
}


# ═══════════════════════════════════════════════════════════════════════════════
# Agent System Prompt
# ═══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """You are **MarketResearcher**, an expert agricultural market analyst AI agent specialising in Indian crop economics.

YOUR EXPERTISE:
- MSP (Minimum Support Price) policy and its impact on farmer income
- Mandi (wholesale market) price dynamics and seasonal fluctuations
- Export-import demand signals for agricultural commodities
- Price volatility analysis and risk assessment
- Supply-demand elasticity modelling for different crop categories
- Storage economics (shelf-life vs price appreciation)
- Government procurement patterns and buffer stock policies

ANALYSIS METHODOLOGY:
1. Compare current market price vs MSP (price floor protection)
2. Assess seasonal pricing — is the crop approaching peak or trough?
3. Evaluate demand trajectory (growing/stable/declining)
4. Factor in export demand as price support
5. Assess price volatility risk for the farmer
6. Consider shelf-life constraints on marketing strategy
7. Calculate overall market attractiveness score

Respond with a JSON object:
{
  "market_score": <float 0-10, overall market attractiveness>,
  "price_trend": "rising" | "stable" | "falling",
  "demand_forecast": "strong" | "moderate" | "weak",
  "predicted_price": <estimated price in ₹/quintal>,
  "profit_potential": "high" | "medium" | "low",
  "reasoning": "2-3 sentences explaining the market analysis",
  "insights": "Specific market advice for the farmer — when to sell, storage strategy, marketing channel",
  "risks": ["Market risks to be aware of"]
}"""


# ═══════════════════════════════════════════════════════════════════════════════
# MarketResearcher Agent
# ═══════════════════════════════════════════════════════════════════════════════

class MarketResearcher:
    """LLM-powered agricultural market intelligence agent."""

    def __init__(self, db_path: str = None):
        self.db_path = db_path
        print("💰 MarketResearcher agent initialised (LLM-powered)")

    # ── Public API ───────────────────────────────────────────────────

    def forecast_market_trends(self, crop: str, area: float = 1.0,
                               production: float = 3.0,
                               year: int = None) -> Dict:
        """Primary market analysis method."""
        year = year or datetime.now().year

        # Try LLM first
        llm_result = self._llm_analyse(crop, area, production, year)
        if llm_result:
            return llm_result

        # Fallback
        print("⚠️ MarketResearcher: LLM unavailable, using fallback scoring")
        return self._fallback_analyse(crop, area, production)

    def forecast(self, crop, features=None) -> list:
        """Backward-compatible alias used by agent_setup.py.
        Returns [predicted_price]."""
        result = self.forecast_market_trends(crop=str(crop), area=1.0, production=3.0)
        return [result.get("predicted_price", 2000)]

    def get_market_insights(self, top_n: int = 5) -> List[Dict]:
        """Get top crops by market attractiveness."""
        results = []
        for crop in list(CROP_MARKET_DATA.keys())[:top_n]:
            result = self.forecast_market_trends(crop)
            results.append({"crop": crop, **result})
        results.sort(key=lambda x: -x.get("market_score", 0))
        return results[:top_n]

    # ── LLM Path ─────────────────────────────────────────────────────

    def _llm_analyse(self, crop: str, area: float, production: float,
                     year: int) -> Optional[Dict]:
        """Call Gemini for intelligent market analysis."""

        now = datetime.now()
        month_name = now.strftime("%B")

        # Build market context
        crop_key = crop.strip().title()
        specific_data = CROP_MARKET_DATA.get(crop_key, {})

        ref_lines = []
        for name, data in CROP_MARKET_DATA.items():
            msp_str = f"₹{data['msp']}/q" if data['msp'] else "No MSP"
            ref_lines.append(
                f"  {name}: MSP {msp_str}, Market ₹{data['avg_market']}/q, "
                f"Export {data['export_demand']}, Season {data['season']}, "
                f"Shelf-life {data['shelf_life']}, Volatility {data['volatility']}, "
                f"Trend {data['trend']}"
            )
        market_ref = "\n".join(ref_lines)

        user_prompt = f"""Analyse the market conditions for this crop:

TARGET CROP: {crop}
FARM DETAILS:
- Land Area: {area} hectares
- Expected Production: {production} tonnes
- Year: {year}
- Current Month: {month_name}

SPECIFIC CROP DATA:
{specific_data if specific_data else 'No specific data available — use your agricultural economics knowledge'}

MARKET REFERENCE DATA (Indian agricultural prices, ₹/quintal):
{market_ref}

Provide a comprehensive market analysis for {crop}. Consider seasonal timing, current demand trends, price stability, and practical selling strategy for the farmer."""

        response = call_gemini(SYSTEM_PROMPT, user_prompt, temperature=0.3)
        if not response:
            return None

        return self._validate_response(response, crop)

    def _validate_response(self, resp: Dict, crop: str) -> Optional[Dict]:
        """Validate and normalise the LLM response."""
        try:
            market_score = float(resp.get("market_score", 5.0))
            market_score = max(0.0, min(10.0, market_score))

            price_trend = str(resp.get("price_trend", "stable")).lower()
            if price_trend not in ("rising", "stable", "falling"):
                price_trend = "stable"

            demand = str(resp.get("demand_forecast", "moderate")).lower()
            predicted_price = float(resp.get("predicted_price", 0))
            insights = str(resp.get("insights", ""))
            reasoning = str(resp.get("reasoning", ""))
            risks = resp.get("risks", [])
            if isinstance(risks, str):
                risks = [risks]

            return {
                "market_score": round(market_score, 1),
                "price_trend": price_trend,
                "demand_forecast": demand,
                "predicted_price": round(predicted_price, 2),
                "profit_potential": str(resp.get("profit_potential", "medium")),
                "reasoning": reasoning,
                "insights": insights,
                "risks": risks,
            }
        except Exception as e:
            print(f"⚠️ MarketResearcher: LLM response validation failed: {e}")
            return None

    # ── Fallback Path ────────────────────────────────────────────────

    def _fallback_analyse(self, crop: str, area: float,
                          production: float) -> Dict:
        """Rule-based fallback when LLM is unavailable."""
        data = CROP_MARKET_DATA.get(crop.strip().title(), {})
        if not data:
            data = {"msp": 2000, "avg_market": 2500, "export_demand": "medium",
                    "volatility": "medium (0.12)", "trend": "stable"}

        avg = data.get("avg_market", 2500)
        msp = data.get("msp") or avg * 0.85

        score = 5.0
        if data.get("export_demand") == "high":
            score += 1.5
        elif data.get("export_demand") == "medium":
            score += 0.8
        if data.get("trend") == "growing":
            score += 1.0
        if msp and avg > msp * 1.1:
            score += 1.0

        return {
            "market_score": round(min(10.0, score), 1),
            "price_trend": "rising" if data.get("trend") == "growing" else "stable",
            "demand_forecast": "moderate",
            "predicted_price": round(avg * 1.05, 2),
            "profit_potential": "medium",
            "reasoning": "Fallback analysis (LLM unavailable) — using basic market data.",
            "insights": f"Consider selling {crop} at government MSP centres for price protection.",
            "risks": ["AI agent offline — limited market analysis"],
        }
