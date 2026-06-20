"""
SustainabilityExpert — LLM-Powered Environmental Assessment Agent
=================================================================
A genuine AI agent that uses Google Gemini to evaluate farming practices
across carbon footprint, water usage, soil health, biodiversity, and
nutrient efficiency dimensions.

Architecture:
  1. IPCC/FAO emission factors and water footprint data serve as LLM context
  2. Gemini reasons about the full environmental picture holistically
  3. Returns actionable sustainability improvements, not just scores
  4. Falls back to formula-based scoring when the LLM is unavailable
"""

import os
from typing import Dict, List, Optional

from models.llm_config import call_gemini


# ═══════════════════════════════════════════════════════════════════════════════
# Environmental Reference Data — context for the LLM
# ═══════════════════════════════════════════════════════════════════════════════

EMISSION_FACTORS = """
CARBON EMISSION FACTORS (kg CO₂e per kg of input, sourced from IPCC/FAO):
  Urea fertiliser: 1.63 (manufacturing + direct N₂O field emissions)
  DAP (di-ammonium phosphate): 1.10
  MOP (muriate of potash): 0.58
  Generic NPK blend: 1.20
  Chemical pesticide (average): 6.30
  Diesel per hectare: ~320 kg CO₂e (for mechanised farming)
  Electricity (Indian grid): 0.82 per kWh

WATER FOOTPRINT (litres per kg of produce):
  Rice: 2500, Wheat: 1300, Corn: 900, Soybean: 2100, Cotton: 10000
  Sugarcane: 1500, Groundnut: 3000, Millet: 800 (very efficient)
  Tea: 7900, Coffee: 15400 (highest), Tomato: 180 (lowest)
  Potato: 250, Onion: 270, Banana: 790, Jute: 4000

SOIL HEALTH THRESHOLDS:
  Optimal pH: 5.5 - 7.5
  Organic carbon good: >0.75%, critical: <0.40%
  Healthy C:N ratio: 10:1 to 12:1

BIODIVERSITY BENCHMARKS:
  Pesticide intensity low: <50 kg/ha (minimal impact)
  Pesticide intensity high: >150 kg/ha (severe ecosystem damage)
  Fertiliser intensity low: <80 kg/ha
  Fertiliser intensity high: >250 kg/ha (eutrophication risk)
"""


# ═══════════════════════════════════════════════════════════════════════════════
# Agent System Prompt
# ═══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """You are **SustainabilityExpert**, an expert environmental scientist AI agent specialising in sustainable agriculture.

YOUR EXPERTISE:
- Carbon footprint accounting: Scope 1/2/3 emissions from fertilisers, pesticides, machinery, energy
- Water stewardship: Crop water footprints, irrigation efficiency, water stress assessment
- Soil health science: Organic matter dynamics, pH management, nutrient cycling, erosion risk
- Biodiversity conservation: Pollinator impact, ecosystem services, integrated farming systems
- Nutrient use efficiency: N-P-K balance, over/under-application, organic alternatives
- Circular agriculture: Crop residue management, composting, green manuring, biochar
- Climate-smart agriculture: Carbon sequestration potential, GHG mitigation strategies

ANALYSIS METHODOLOGY (5-dimension assessment):
1. CARBON FOOTPRINT: Calculate emissions from fertiliser + pesticide use, benchmark against crop-specific baseline
2. WATER FOOTPRINT: Assess water consumed per unit yield, compare against crop water footprint standard
3. SOIL HEALTH: Evaluate pH, organic matter adequacy, and degradation risk from current practices
4. BIODIVERSITY: Assess ecosystem impact of chemical inputs — pollinators, soil microbiome, aquatic life
5. NUTRIENT BALANCE: Check N-P-K ratios against crop demand — identify waste or deficiency

Respond with a JSON object:
{
  "sustainability_score": <float 0-10, overall sustainability>,
  "environmental_impact": "Low" | "Medium" | "High" | "Critical",
  "carbon_footprint": <float 0-10, higher = lower emissions = better>,
  "water_score": <float 0-10, higher = more water efficient>,
  "soil_health_score": <float 0-10>,
  "biodiversity_score": <float 0-10>,
  "nutrient_efficiency_score": <float 0-10>,
  "recommendations": "3-5 specific, actionable sustainability improvements for this farmer",
  "reasoning": "How you evaluated each dimension",
  "carbon_kg_estimate": <estimated total CO₂e kg from current practices>,
  "improvement_potential": "How much the farmer could improve with recommended changes"
}"""


# ═══════════════════════════════════════════════════════════════════════════════
# SustainabilityExpert Agent
# ═══════════════════════════════════════════════════════════════════════════════

class SustainabilityExpert:
    """LLM-powered environmental sustainability assessment agent."""

    def __init__(self, db_path: str = None):
        self.db_path = db_path
        print("🌱 SustainabilityExpert agent initialised (LLM-powered)")

    # ── Public API ───────────────────────────────────────────────────

    def assess_sustainability(self, fertilizer_usage: float = 80,
                              organic_matter: float = 1.0,
                              ph: float = 6.5,
                              nitrogen: float = 80,
                              phosphorus: float = 30,
                              pesticide_usage: float = 50,
                              crop: str = "Rice",
                              land_size: float = 1.0) -> Dict:
        """Primary sustainability assessment method."""

        # Try LLM first
        llm_result = self._llm_assess(
            fertilizer_usage, organic_matter, ph,
            nitrogen, phosphorus, pesticide_usage,
            crop, land_size,
        )
        if llm_result:
            return llm_result

        # Fallback
        print("⚠️ SustainabilityExpert: LLM unavailable, using fallback scoring")
        return self._fallback_assess(
            fertilizer_usage, organic_matter, ph,
            nitrogen, phosphorus, pesticide_usage, crop, land_size,
        )

    def evaluate(self, crops: list = None, **kwargs) -> tuple:
        """Backward-compatible alias for agent_setup.py.
        Returns (label, scores_dict)."""
        crop = crops[0] if crops else kwargs.get("crop", "Rice")
        result = self.assess_sustainability(crop=crop, **kwargs)
        scores = {
            "sustainability": result["sustainability_score"],
            "carbon": result["carbon_footprint"],
            "water": result.get("water_score", 6.0),
            "erosion": result.get("soil_health_score", 6.0),
        }
        return (result["environmental_impact"], scores)

    # ── LLM Path ─────────────────────────────────────────────────────

    def _llm_assess(self, fertilizer_usage, organic_matter, ph,
                    nitrogen, phosphorus, pesticide_usage,
                    crop, land_size) -> Optional[Dict]:
        """Call Gemini for comprehensive sustainability analysis."""

        user_prompt = f"""Assess the sustainability of these farming practices:

CROP: {crop}
FARM SIZE: {land_size} hectares

CURRENT PRACTICES:
- Total fertiliser usage: {fertilizer_usage} kg/ha
  - Nitrogen (N): {nitrogen} kg/ha
  - Phosphorus (P): {phosphorus} kg/ha
- Pesticide usage: {pesticide_usage} kg/ha
- Soil organic matter: {organic_matter}%
- Soil pH: {ph}

ENVIRONMENTAL REFERENCE DATA:
{EMISSION_FACTORS}

Evaluate these practices across all 5 sustainability dimensions (carbon, water, soil health, biodiversity, nutrient efficiency). Calculate actual carbon emissions estimate using the emission factors provided. Provide specific, actionable recommendations to improve sustainability."""

        response = call_gemini(SYSTEM_PROMPT, user_prompt, temperature=0.3)
        if not response:
            return None

        return self._validate_response(response)

    def _validate_response(self, resp: Dict) -> Optional[Dict]:
        """Validate LLM response."""
        try:
            def clamp(val, default=5.0):
                return max(0.0, min(10.0, float(val or default)))

            sust_score = clamp(resp.get("sustainability_score"))
            env_impact = str(resp.get("environmental_impact", "Medium"))
            if env_impact not in ("Low", "Medium", "High", "Critical"):
                env_impact = "Medium"

            carbon = clamp(resp.get("carbon_footprint"))
            water = clamp(resp.get("water_score"))
            soil = clamp(resp.get("soil_health_score"))
            bio = clamp(resp.get("biodiversity_score"))
            nutrient = clamp(resp.get("nutrient_efficiency_score"))

            return {
                "sustainability_score": round(sust_score, 1),
                "environmental_impact": env_impact,
                "carbon_footprint": round(carbon, 1),
                "water_score": round(water, 1),
                "soil_health_score": round(soil, 1),
                "biodiversity_score": round(bio, 1),
                "nutrient_efficiency_score": round(nutrient, 1),
                "recommendations": str(resp.get("recommendations", "")),
                "reasoning": str(resp.get("reasoning", "")),
                "carbon_kg_estimate": float(resp.get("carbon_kg_estimate", 0)),
                "improvement_potential": str(resp.get("improvement_potential", "")),
                "detail": {
                    "carbon_score": round(carbon, 1),
                    "water_score": round(water, 1),
                    "soil_health_score": round(soil, 1),
                    "biodiversity_score": round(bio, 1),
                    "nutrient_score": round(nutrient, 1),
                },
            }
        except Exception as e:
            print(f"⚠️ SustainabilityExpert: LLM response validation failed: {e}")
            return None

    # ── Fallback Path ────────────────────────────────────────────────

    def _fallback_assess(self, fertilizer_usage, organic_matter, ph,
                         nitrogen, phosphorus, pesticide_usage,
                         crop, land_size) -> Dict:
        """Formula-based fallback when LLM is unavailable."""

        # Carbon score (10 = low emissions)
        carbon_kg = fertilizer_usage * 1.2 + pesticide_usage * 6.3
        carbon_score = max(0, 10 - carbon_kg / 100)

        # Water score (based on crop type)
        water_heavy = ["rice", "cotton", "sugarcane", "tea", "coffee"]
        water_score = 5.0 if crop.lower() in water_heavy else 7.0

        # Soil health
        soil_score = 7.0
        if ph < 5.0 or ph > 8.5:
            soil_score -= 2.0
        if organic_matter < 0.5:
            soil_score -= 2.0

        # Biodiversity
        bio_score = 8.0
        if pesticide_usage > 100:
            bio_score -= 3.0
        elif pesticide_usage > 50:
            bio_score -= 1.5

        # Nutrient efficiency
        nutrient_score = 6.0 if 40 <= nitrogen <= 150 else 4.0

        overall = (carbon_score * 0.25 + water_score * 0.20 +
                   soil_score * 0.25 + bio_score * 0.15 +
                   nutrient_score * 0.15)

        env_impact = ("Low" if overall > 7 else "Medium" if overall > 5
                      else "High" if overall > 3 else "Critical")

        return {
            "sustainability_score": round(overall, 1),
            "environmental_impact": env_impact,
            "carbon_footprint": round(carbon_score, 1),
            "water_score": round(water_score, 1),
            "soil_health_score": round(soil_score, 1),
            "biodiversity_score": round(bio_score, 1),
            "nutrient_efficiency_score": round(nutrient_score, 1),
            "recommendations": "Reduce chemical inputs, improve organic matter. (LLM offline — general advice)",
            "reasoning": "Fallback formula-based assessment.",
            "carbon_kg_estimate": round(carbon_kg, 1),
            "improvement_potential": "Unknown (AI agent offline)",
            "detail": {
                "carbon_score": round(carbon_score, 1),
                "water_score": round(water_score, 1),
                "soil_health_score": round(soil_score, 1),
                "biodiversity_score": round(bio_score, 1),
                "nutrient_score": round(nutrient_score, 1),
            },
        }
