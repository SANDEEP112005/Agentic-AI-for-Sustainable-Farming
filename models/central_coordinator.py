"""
CentralCoordinator — Hybrid Multi-Agent + Custom Engine Orchestrator
=====================================================================
The brain of the agentic AI system. Uses a HYBRID architecture:

  Layer A — AgriSmart Custom Engine (ML models + RAG KB + custom algorithm) → PRIMARY
  Layer B — Multi-Agent LLM Reasoning (5 specialist agents via Groq) → VALIDATION & ENRICHMENT

Flow:
  1. Custom Engine generates data-driven recommendation (instant, offline-capable) — THIS PICKS THE CROP
  2. FarmerAdvisor validates/enriches via LLM (does NOT override engine)
  3. 4 specialist agents analyse the engine's crop in parallel (market, weather, sustainability, pest)
  4. LLM Synthesis merges custom engine + agent insights for final report

The custom engine is ALWAYS the primary recommendation source.
Groq API agents validate, enrich, and provide detailed analysis — they do NOT pick the crop.
"""

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional

from models.farmer_advisor import FarmerAdvisor
from models.market_Researcher import MarketResearcher
from models.weather_Analyst import WeatherAnalyst
from models.sustainability_Expert import SustainabilityExpert
from models.pest_disease_predictor import PestDiseasePredictor
from models.llm_config import call_gemini

# Import custom engine (the novel component)
try:
    from models.custom_engine import AgriSmartEngine
    HAS_CUSTOM_ENGINE = True
except Exception as _e:
    print(f"⚠️ Custom engine unavailable: {_e}")
    HAS_CUSTOM_ENGINE = False


# ═══════════════════════════════════════════════════════════════════════════════
# Synthesis System Prompt (for the final Gemini call)
# ═══════════════════════════════════════════════════════════════════════════════

SYNTHESIS_PROMPT = """You are **CentralCoordinator**, a senior farming consultant AI that synthesises reports from 5 specialist agents into a unified recommendation.

YOUR ROLE:
- Weigh each agent's analysis based on the specific farm situation
- Identify agreements and conflicts between agents
- Resolve conflicts with sound agricultural reasoning
- Produce a final confidence-calibrated recommendation
- Generate a clear action plan the farmer can immediately follow

AGENT WEIGHT GUIDELINES:
- FarmerAdvisor (crop selection): Most important when soil/climate data is diverse
- WeatherAnalyst: Critical when weather conditions are extreme or unusual
- MarketResearcher: Important for economic viability
- SustainabilityExpert: Important for long-term farm health
- PestDiseasePredictor: Critical when high pest/disease risk is detected

Respond with a JSON object:
{
  "final_recommendation": "The synthesised recommendation summary — 3-4 sentences covering crop choice, market outlook, weather considerations, sustainability advice, and pest management",
  "confidence_level": "High" | "Medium" | "Low",
  "key_factors": ["The top 3-5 factors driving this recommendation"],
  "action_plan": "Step-by-step action plan for the farmer (numbered list)",
  "conflicts_resolved": "Any disagreements between agents and how you resolved them (or 'None')",
  "risk_summary": "Overall risk assessment combining all agent perspectives"
}"""


class CentralCoordinator:
    """Orchestrates all five AI agents with parallel execution and LLM synthesis.

    Usage:
        coordinator = CentralCoordinator()
        result = coordinator.generate_recommendation(
            soil_ph=6.5, soil_moisture=65, temperature=28,
            rainfall=120, fertilizer=80, pesticide=2.0,
            crop_yield=3.5, land_size=1.0, city_name='Pune')
    """

    def __init__(self, db_path: str = None):
        self.db_path = db_path or os.path.join(
            os.path.dirname(__file__), "..", "database", "farming.db")

        # Initialise all sub-agents
        self.farmer_advisor = FarmerAdvisor(self.db_path)
        self.market_researcher = MarketResearcher(self.db_path)
        self.weather_analyst = WeatherAnalyst(self.db_path)
        self.sustainability_expert = SustainabilityExpert(self.db_path)
        self.pest_predictor = PestDiseasePredictor()

        # Initialise custom engine (novel hybrid layer)
        self.custom_engine = None
        if HAS_CUSTOM_ENGINE:
            try:
                self.custom_engine = AgriSmartEngine()
            except Exception as e:
                print(f"⚠️ Custom engine init failed: {e}")

        print("🎯 CentralCoordinator initialised — 5 AI agents + custom engine ready")

    # ──────────────────────────────────────────────────────────────────
    # Primary API
    # ──────────────────────────────────────────────────────────────────

    def generate_recommendation(
            self, soil_ph: float = 6.5, soil_moisture: float = 60,
            temperature: float = 25, rainfall: float = 100,
            fertilizer: float = 80, pesticide: float = 2.0,
            crop_yield: float = 3.0, land_size: float = 1.0,
            city_name: str = None, crop_preference: str = None) -> Dict:
        """Generate a comprehensive multi-agent recommendation.

        Flow:
          1. FarmerAdvisor → crop recommendation (LLM call #1)
          2. 4 specialists in parallel → analyse recommended crop (LLM calls #2-5)
          3. Gemini synthesis → unified recommendation (LLM call #6)
        """

        warnings: List[str] = []

        # ── Step 0: Custom Engine — instant data-driven analysis ─────
        # The custom engine is the PRIMARY recommendation source.
        # It uses ML models + Knowledge Base RAG + agronomic algorithm.
        custom_result = None
        engine_crop = None
        if self.custom_engine:
            print("\n🧠 Step 0: AgriSmart Custom Engine (ML + RAG + Algorithm) — PRIMARY...")
            try:
                custom_result = self.custom_engine.recommend(
                    ph=soil_ph, temperature=temperature, rainfall=rainfall,
                    nitrogen=fertilizer, phosphorus=30, potassium=30,
                    humidity=soil_moisture, land_size=land_size,
                    use_llm=False,  # LLM used separately by agents
                    crop_preference=crop_preference,
                )
                engine_crop = custom_result['recommended_crop']
                print(f"   → Custom Engine PRIMARY: {engine_crop} "
                      f"(score: {custom_result['final_score']}, "
                      f"confidence: {custom_result['confidence']}%, "
                      f"data points: {custom_result['data_points_analysed']:,})")
            except Exception as e:
                print(f"   ⚠️ Custom engine error: {e}")

        # ── Step 1: Farmer Advisor — validate / enrich the engine's pick ──
        # Groq LLM validates the custom engine's recommendation and provides
        # reasoning, advice, and alternatives. It does NOT override the engine.
        print("\n📡 Step 1: FarmerAdvisor validating engine recommendation...")
        try:
            farmer_result = self.farmer_advisor.recommend_detailed(
                ph=soil_ph, temperature=temperature,
                rainfall=rainfall, humidity=soil_moisture,
                nitrogen=fertilizer, phosphorus=30, potassium=30,
            )
            farmer_llm_crop = farmer_result["crop"]
            farmer_score = farmer_result["score"]
            farmer_confidence = farmer_result["confidence"]
            farmer_advice = farmer_result.get("advice", "")
            farmer_reasoning = farmer_result.get("reasoning", "")
        except Exception as e:
            warnings.append(f"FarmerAdvisor error: {e}")
            farmer_llm_crop = None
            farmer_score = 5.0
            farmer_confidence = 50.0
            farmer_advice = "Default recommendation due to error."
            farmer_reasoning = str(e)
            farmer_result = {"alternatives": []}

        # PRIMARY CROP = custom engine's pick (or fallback to Farmer Advisor)
        if engine_crop:
            recommended_crop = engine_crop
            # If Farmer Advisor disagrees, note the conflict for synthesis
            if farmer_llm_crop and farmer_llm_crop.lower() != engine_crop.lower():
                warnings.append(
                    f"Agent disagreement: Custom Engine → {engine_crop}, "
                    f"FarmerAdvisor → {farmer_llm_crop} (engine takes priority)"
                )
                print(f"   ⚡ Conflict: Engine={engine_crop}, Farmer={farmer_llm_crop} → using engine")
            else:
                print(f"   ✅ Agreement: both recommend {engine_crop}")
        else:
            # Fallback: engine failed, use Farmer Advisor's pick
            recommended_crop = farmer_llm_crop or "Wheat"
            print(f"   ⚠️ Fallback to FarmerAdvisor: {recommended_crop}")

        print(f"   → FINAL PRIMARY CROP: {recommended_crop} (source: {'Custom Engine' if engine_crop else 'Farmer Advisor'})")

        # ── Step 2: Run 4 specialist agents IN PARALLEL ──────────────
        # Agents ANALYZE the engine's recommended crop (market, weather, etc.)
        # They don't pick the crop — they validate and enrich.
        print(f"\n📡 Step 2: Running 4 specialist agents in parallel for '{recommended_crop}'...")

        market_result = {}
        weather_result = {}
        sust_result = {}
        pest_result = {}
        pest_advice = ""

        def run_market():
            return self.market_researcher.forecast_market_trends(
                crop=recommended_crop,
                area=land_size,
                production=crop_yield * land_size,
                year=__import__("datetime").datetime.now().year,
            )

        def run_weather():
            return self.weather_analyst.analyze_weather_impact(
                temperature=temperature,
                rainfall=rainfall,
                humidity=soil_moisture,
                crop=recommended_crop,
            )

        def run_sustainability():
            return self.sustainability_expert.assess_sustainability(
                fertilizer_usage=fertilizer,
                organic_matter=1.0,
                ph=soil_ph,
                nitrogen=fertilizer,
                phosphorus=30,
                pesticide_usage=pesticide * 30,
                crop=recommended_crop,
                land_size=land_size,
            )

        def run_pest():
            return self.pest_predictor.predict_detailed(
                crop_type=recommended_crop,
                soil_ph=soil_ph,
                soil_moisture=soil_moisture,
                temperature=temperature,
                rainfall=rainfall,
            )

        agent_tasks = {
            "market": run_market,
            "weather": run_weather,
            "sustainability": run_sustainability,
            "pest": run_pest,
        }

        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(fn): name
                       for name, fn in agent_tasks.items()}

            for future in as_completed(futures):
                agent_name = futures[future]
                try:
                    result = future.result()
                    if agent_name == "market":
                        market_result = result
                        print(f"   ✅ MarketResearcher: score={result.get('market_score')}, trend={result.get('price_trend')}")
                    elif agent_name == "weather":
                        weather_result = result
                        print(f"   ✅ WeatherAnalyst: score={result.get('weather_score')}, risk={result.get('risk_level')}")
                    elif agent_name == "sustainability":
                        sust_result = result
                        print(f"   ✅ SustainabilityExpert: score={result.get('sustainability_score')}, impact={result.get('environmental_impact')}")
                    elif agent_name == "pest":
                        pest_result = result
                        print(f"   ✅ PestPredictor: risk={result.get('overall_risk')}, threats={len(result.get('threats', []))}")
                except Exception as e:
                    warnings.append(f"{agent_name} agent error: {e}")
                    print(f"   ❌ {agent_name}: {e}")

        # Extract key values with defaults
        market_score = market_result.get("market_score", 5.0)
        price_trend = market_result.get("price_trend", "stable")
        market_insights = market_result.get("insights", "")

        weather_score = weather_result.get("weather_score", 5.0)
        weather_risk = weather_result.get("risk_level", "Unknown")
        weather_forecast = weather_result.get("forecast", "")
        weather_risks = weather_result.get("risks", [])
        if weather_risks and isinstance(weather_risks, list):
            warnings.extend([f"Weather: {r}" for r in weather_risks[:3]])

        sustainability_score = sust_result.get("sustainability_score", 5.0)
        carbon_footprint = sust_result.get("carbon_footprint", 5.0)
        water_score = sust_result.get("water_score", 6.0)
        sust_recommendations = sust_result.get("recommendations", "")

        pest_overall_risk = pest_result.get("overall_risk", "Low")
        if pest_overall_risk in ("High", "Critical"):
            warnings.append(
                f"Pest/Disease risk is {pest_overall_risk} for {recommended_crop}.")

        # Build pest advice string
        pest_advice = self.pest_predictor.predict(
            crop_type=recommended_crop, soil_ph=soil_ph,
            soil_moisture=soil_moisture, temperature=temperature,
            rainfall=rainfall,
        )

        # ── Step 3: LLM Synthesis — unify all agent outputs ─────────
        # Brief pause to respect Groq rate limits after parallel calls
        import time as _time
        _time.sleep(1.5)
        print(f"\n📡 Step 3: Synthesising all agent analyses with LLM...")

        synthesis = self._synthesise_with_llm(
            recommended_crop, farmer_result,
            market_result, weather_result,
            sust_result, pest_result,
            soil_ph, temperature, rainfall, soil_moisture,
        )

        # ── Step 4: Live Weather (optional) ──────────────────────────
        live_temp = temperature
        if city_name:
            try:
                live = self.weather_analyst.get_live_weather(city_name)
                if live:
                    live_temp = live["temperature"]
            except Exception:
                pass

        # ── Step 5: Compute Final Score ──────────────────────────────
        pest_score_val = self._pest_score(pest_overall_risk)
        agent_scores = {
            "farmer": farmer_score,
            "market": market_score,
            "weather": weather_score,
            "sustainability": sustainability_score,
            "pest": pest_score_val,
        }

        WEIGHTS = {
            "farmer": 0.30, "market": 0.20, "weather": 0.25,
            "sustainability": 0.15, "pest": 0.10,
        }
        final_score = sum(agent_scores[k] * w for k, w in WEIGHTS.items())

        erosion_score = sust_result.get("soil_health_score",
                                        self._erosion_heuristic(
                                            soil_ph, rainfall,
                                            soil_moisture, fertilizer))

        print(f"\n🏁 Final Score: {round(final_score, 1)}/10 for {recommended_crop}")
        if synthesis:
            print(f"   Synthesis confidence: {synthesis.get('confidence_level', 'N/A')}")

        # ── Step 6: Build backward-compatible result dict ────────────
        return {
            # Core fields (required by backend/main.py)
            "Recommended Crop": recommended_crop,
            "Market Score": round(market_score, 1),
            "Price Trend": price_trend.title(),
            "Weather Suitability Score": round(weather_score, 1),
            "Predicted Temperature": round(live_temp, 1),
            "Predicted Rainfall": round(rainfall, 1),
            "Sustainability Score": round(sustainability_score, 1),
            "Carbon Footprint Score": round(carbon_footprint, 1),
            "Water Score": round(water_score, 1),
            "Erosion Score": round(erosion_score, 1),
            "Final Score": round(final_score, 1),
            "Warnings": warnings,
            "Pest/Disease Advice": pest_advice,

            # Extended data — rich AI-generated insights
            "Farmer Confidence": round(farmer_confidence, 1),
            "Farmer Advice": farmer_advice,
            "Farmer Reasoning": farmer_reasoning,
            "Market Insights": market_insights,
            "Market Reasoning": market_result.get("reasoning", ""),
            "Weather Forecast": weather_forecast,
            "Weather Reasoning": weather_result.get("reasoning", ""),
            "Weather Advice": weather_result.get("advice", ""),
            "Sustainability Recommendations": sust_recommendations,
            "Sustainability Reasoning": sust_result.get("reasoning", ""),
            "Pest IPM Plan": pest_result.get("ipm_plan", ""),
            "Pest Threats": pest_result.get("threats", []),
            "Alternatives": farmer_result.get("alternatives", []),
            "Agent Scores": {k: round(v, 1) for k, v in agent_scores.items()},

            # Synthesis (the AI's unified analysis)
            "AI Synthesis": synthesis.get("final_recommendation", "") if synthesis else "",
            "AI Confidence": synthesis.get("confidence_level", "Medium") if synthesis else "Medium",
            "AI Action Plan": synthesis.get("action_plan", "") if synthesis else "",
            "AI Key Factors": synthesis.get("key_factors", []) if synthesis else [],
            "AI Risk Summary": synthesis.get("risk_summary", "") if synthesis else "",
            "AI Conflicts Resolved": synthesis.get("conflicts_resolved", "None") if synthesis else "None",

            # Custom Engine data (the novel differentiator)
            "Custom Engine": {
                "enabled": custom_result is not None,
                "engine_version": custom_result.get("engine", "N/A") if custom_result else "N/A",
                "custom_score": custom_result.get("final_score", 0) if custom_result else 0,
                "custom_confidence": custom_result.get("confidence", 0) if custom_result else 0,
                "layer_scores": custom_result.get("layer_scores", {}) if custom_result else {},
                "score_explanation": custom_result.get("score_explanation", []) if custom_result else [],
                "layers_used": custom_result.get("layers_used", []) if custom_result else [],
                "data_points_analysed": custom_result.get("data_points_analysed", 0) if custom_result else 0,
                "historical_evidence": custom_result.get("historical_evidence", {}) if custom_result else {},
                "estimated_yield": custom_result.get("estimated_yield", 0) if custom_result else 0,
                "estimated_price": custom_result.get("estimated_price", 0) if custom_result else 0,
                "custom_alternatives": custom_result.get("alternatives", []) if custom_result else [],
                "crop_icon": custom_result.get("crop_icon", "🌱") if custom_result else "🌱",
                "comparative": custom_result.get("comparative", {}) if custom_result else {},
            },
        }

    # ──────────────────────────────────────────────────────────────────
    # LLM Synthesis
    # ──────────────────────────────────────────────────────────────────

    def _synthesise_with_llm(self, crop, farmer_result,
                             market_result, weather_result,
                             sust_result, pest_result,
                             soil_ph, temperature, rainfall,
                             humidity) -> Optional[Dict]:
        """Feed all agent outputs to Gemini for unified synthesis."""

        user_prompt = f"""Synthesise these 5 specialist agent reports into a unified farming recommendation:

RECOMMENDED CROP: {crop}

FARM CONDITIONS:
  pH: {soil_ph}, Temperature: {temperature}°C, Rainfall: {rainfall}mm, Humidity: {humidity}%

AGENT REPORT #1 — FarmerAdvisor (Crop Selection):
  Score: {farmer_result.get('score', 'N/A')}/10, Confidence: {farmer_result.get('confidence', 'N/A')}%
  Reasoning: {farmer_result.get('reasoning', 'N/A')}
  Alternatives: {', '.join(a.get('crop', '') for a in farmer_result.get('alternatives', [])[:3])}

AGENT REPORT #2 — MarketResearcher (Market Analysis):
  Market Score: {market_result.get('market_score', 'N/A')}/10, Price Trend: {market_result.get('price_trend', 'N/A')}
  Reasoning: {market_result.get('reasoning', 'N/A')}

AGENT REPORT #3 — WeatherAnalyst (Weather Impact):
  Weather Score: {weather_result.get('weather_score', 'N/A')}/10, Risk Level: {weather_result.get('risk_level', 'N/A')}
  Reasoning: {weather_result.get('reasoning', 'N/A')}
  Risks: {weather_result.get('risks', 'N/A')}

AGENT REPORT #4 — SustainabilityExpert (Environmental Impact):
  Sustainability Score: {sust_result.get('sustainability_score', 'N/A')}/10
  Impact: {sust_result.get('environmental_impact', 'N/A')}
  Reasoning: {sust_result.get('reasoning', 'N/A')}

AGENT REPORT #5 — PestDiseasePredictor (Pest/Disease Risk):
  Overall Risk: {pest_result.get('overall_risk', 'N/A')}
  Top Threats: {', '.join(t.get('name', '') + f" ({t.get('probability', '?')}%)" for t in pest_result.get('threats', [])[:3])}
  Reasoning: {pest_result.get('reasoning', 'N/A')}

Synthesise all reports into a unified recommendation. Identify if agents agree or conflict, and provide a clear action plan."""

        try:
            response = call_gemini(
                SYNTHESIS_PROMPT, user_prompt,
                temperature=0.3, max_retries=3, timeout=45,
            )
            return response
        except Exception as e:
            print(f"⚠️ Synthesis LLM call failed: {e}")
            return None

    # ──────────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────────

    def _pest_score(self, risk_level: str) -> float:
        """Convert pest risk level to a 0-10 score (higher = better)."""
        return {"Low": 9.0, "Moderate": 6.5, "High": 4.0,
                "Critical": 2.0, "Unknown": 5.0}.get(risk_level, 5.0)

    def _erosion_heuristic(self, ph, rainfall, moisture, fertilizer) -> float:
        """Simple erosion-risk score fallback (10 = no risk, 0 = severe)."""
        score = 8.0
        if rainfall > 200:
            score -= min(3.0, (rainfall - 200) / 100)
        if moisture > 80 and rainfall > 150:
            score -= 1.5
        if ph < 5.0:
            score -= 1.0
        if fertilizer > 200:
            score -= 1.0
        return max(0.0, min(10.0, score))
