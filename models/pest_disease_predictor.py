"""
PestDiseasePredictor — LLM-Powered Pest & Disease Risk Agent
=============================================================
A genuine AI agent that uses Google Gemini to assess pest and disease threats
based on crop type, soil conditions, and weather — providing IPM
(Integrated Pest Management) recommendations.

Architecture:
  1. A comprehensive pest/disease knowledge base serves as LLM context
  2. Gemini reasons about condition-specific risk using entomological knowledge
  3. Returns threat-ranked risks with biological + chemical + prevention strategies
  4. Falls back to condition-matching when the LLM is unavailable
"""

import os
from datetime import datetime
from typing import Dict, List, Optional

from models.llm_config import call_gemini


# ═══════════════════════════════════════════════════════════════════════════════
# Pest & Disease Reference Data — context for the LLM
# ═══════════════════════════════════════════════════════════════════════════════

PEST_REFERENCE = """
MAJOR AGRICULTURAL PESTS & DISEASES (Indian context):

INSECTS:
- Stem Borer: Affects rice, sugarcane, maize. Favours temp 25-35°C, humidity>70%. Dead hearts/white ears. Bio: Trichogramma parasitoids. Chemical: Cartap hydrochloride/Chlorantraniliprole.
- Brown Plant Hopper (BPH): Rice pest. Temp 25-30°C, humidity>80%. Hopper burn patches. Bio: Conserve Lycosa spiders. Chemical: Buprofezin/Pymetrozine. Avoid excess N.
- Aphids: Mustard, wheat, chickpea, potato, tomato, cotton. Temp 15-28°C, humidity>50%. Curling leaves, honeydew. Bio: Chrysoperla lacewing larvae. Chemical: Imidacloprid/Thiamethoxam.
- Bollworm (Helicoverpa): Cotton, chickpea, tomato, pigeon pea. Temp 20-35°C. Bore holes in bolls/pods. Bio: Helicoverpa NPV, Trichogramma. Chemical: Emamectin benzoate. Use Bt cotton.
- Whitefly: Cotton, tomato, soybean 25-35°C. Leaf yellowing, sooty mould. Bio: Encarsia wasps. Chemical: Spiromesifen.
- Fall Armyworm: Maize, corn, millet, sorghum. Temp 20-35°C. Window-pane feeding. Bio: Metarhizium/Beauveria fungi. Chemical: Spinetoram/Chlorantraniliprole.
- Pod Borer: Chickpea, pigeon pea. Temp 20-30°C. Bore holes in pods. Bio: NPV + neem. Chemical: Indoxacarb.
- Jassids: Cotton, groundnut. Temp 25-35°C, humidity>60%. Leaf curling, hopper burn. Bio: Predatory spiders. Chemical: Acetamiprid.

FUNGAL DISEASES:
- Rice Blast: Rice. Temp 22-28°C, humidity>90%. Diamond lesions on leaves. Chemical: Tricyclazole/Isoprothiolane. Use resistant varieties.
- Late Blight: Potato, tomato. Temp 15-22°C, humidity>80%. Dark water-soaked lesions. Chemical: Mancozeb + metalaxyl. Prevention: crop rotation, certified seed.
- Early Blight: Tomato, potato. Temp 24-32°C. Concentric ring spots. Chemical: Chlorothalonil/Mancozeb.
- Powdery Mildew: Wheat, mustard, pea. Temp 15-25°C, low humidity. White powder on leaves. Chemical: Sulphur/Propiconazole.
- Downy Mildew: Maize, pearl millet, grapes. Temp 18-25°C, humidity>85%. Downy growth on leaf underside. Chemical: Metalaxyl/Mancozeb.
- Fusarium Wilt: Chickpea, tomato, banana, cotton. Soil-borne. Temp 25-30°C. Wilting, yellowing. No cure — use resistant varieties, solarisation.
- Rust: Wheat, soybean, coffee, groundnut. Temp 15-25°C, humidity>80%. Orange-brown pustules. Chemical: Propiconazole/Hexaconazole.
- Sheath Blight: Rice. Temp 28-32°C, humidity>85%. Irregular lesions on sheath. Chemical: Validamycin/Hexaconazole.
- Anthracnose: Mango, chilli, beans. Temp 25-30°C, high moisture. Dark sunken spots. Chemical: Carbendazim/Mancozeb.

BACTERIAL:
- Bacterial Leaf Blight (BLB): Rice. Temp 25-34°C, humidity>80%. Yellow to white leaves from tips. No effective chemical — use resistant varieties, avoid excess N.
- Bacterial Wilt: Tomato, potato, brinjal, ginger. Soil-borne 25-35°C. Sudden wilting. No cure — crop rotation, bio-fumigation.

VIRAL:
- Yellow Mosaic Virus: Soybean, mung bean, urd bean. Vector: whitefly. Yellow mosaic patterns. Control vector, use resistant varieties.
- Leaf Curl Virus: Tomato, chilli. Vector: whitefly. Upward curling, stunting. Silver reflective mulch, neem-based repellents.

NEMATODES:
- Root Knot Nematode: Tomato, okra, carrot, tobacco. All seasons. Root galls, stunting. Bio: Purpureocillium lilacinum. Chemical: Carbofuran. Prevention: marigold intercrop.
"""


# ═══════════════════════════════════════════════════════════════════════════════
# Agent System Prompt
# ═══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """You are **PestDiseasePredictor**, an expert entomologist and plant pathologist AI agent specialising in Indian agriculture.

YOUR EXPERTISE:
- Insect pest biology: Life cycles, host-crop relationships, population dynamics
- Plant pathology: Fungal, bacterial, viral, and nematode diseases of crops
- Integrated Pest Management (IPM): Biological control, cultural practices, need-based chemical use
- Epidemiology: How temperature, humidity, moisture, and season drive pest/disease outbreaks
- Economic thresholds: When pest levels justify intervention
- Resistance management: Avoiding pesticide resistance through rotation and timing

ANALYSIS METHODOLOGY:
1. Identify ALL potential pests/diseases that could affect the given crop under given conditions
2. Rank threats by probability (considering temp, humidity, moisture, season)
3. For each significant threat, provide:
   - Risk probability (0-100%)
   - Severity if it occurs
   - Early detection symptoms
   - Biological control options (first line of defense)
   - Chemical control (need-based, specify product names)
   - Prevention strategies
4. Assess overall risk level
5. Provide an IPM calendar/action plan

Respond with a JSON object:
{
  "overall_risk": "Low" | "Moderate" | "High" | "Critical",
  "risk_score": <float 0-10, higher = safer>,
  "threats": [
    {
      "name": "Pest/disease name",
      "type": "insect" | "fungal" | "bacterial" | "viral" | "nematode",
      "probability": <0-100>,
      "severity": "low" | "medium" | "high" | "critical",
      "symptoms": "What to look for",
      "bio_control": "Biological control recommendation",
      "chemical_control": "Chemical control if needed",
      "prevention": "Preventive measures"
    }
  ],
  "reasoning": "Why these threats are relevant under current conditions",
  "ipm_plan": "Integrated pest management action plan for the farmer",
  "summary": "1-2 sentence overview for the farmer"
}"""


# ═══════════════════════════════════════════════════════════════════════════════
# PestDiseasePredictor Agent
# ═══════════════════════════════════════════════════════════════════════════════

class PestDiseasePredictor:
    """LLM-powered pest and disease risk assessment agent."""

    def __init__(self, db_path: str = None):
        self.db_path = db_path
        print("🐛 PestDiseasePredictor agent initialised (LLM-powered)")

    # ── Public API ───────────────────────────────────────────────────

    def predict(self, crop_type: str = "Rice", soil_ph: float = 6.5,
                soil_moisture: float = 60, temperature: float = 25,
                rainfall: float = 100) -> str:
        """Backward-compatible string prediction."""
        result = self.predict_detailed(
            crop_type, soil_ph, soil_moisture, temperature, rainfall,
        )
        # Build summary string
        threats = result.get("threats", [])
        if not threats:
            return f"Low pest/disease risk for {crop_type} under current conditions."

        lines = [f"Pest/Disease Assessment for {crop_type} (Risk: {result['overall_risk']}):"]
        for t in threats[:3]:
            lines.append(
                f"  • {t['name']} ({t['type']}) — {t['probability']}% risk. "
                f"Bio: {t.get('bio_control', 'N/A')}. "
                f"Chemical: {t.get('chemical_control', 'N/A')}."
            )
        if result.get("ipm_plan"):
            lines.append(f"  IPM Plan: {result['ipm_plan'][:200]}")
        return "\n".join(lines)

    def predict_detailed(self, crop_type: str = "Rice",
                         soil_ph: float = 6.5,
                         soil_moisture: float = 60,
                         temperature: float = 25,
                         rainfall: float = 100) -> Dict:
        """Full pest/disease analysis via LLM with fallback."""

        # Try LLM first
        llm_result = self._llm_predict(
            crop_type, soil_ph, soil_moisture, temperature, rainfall,
        )
        if llm_result:
            return llm_result

        # Fallback
        print("⚠️ PestDiseasePredictor: LLM unavailable, using fallback")
        return self._fallback_predict(
            crop_type, soil_ph, soil_moisture, temperature, rainfall,
        )

    # ── LLM Path ─────────────────────────────────────────────────────

    def _llm_predict(self, crop_type, soil_ph, soil_moisture,
                     temperature, rainfall) -> Optional[Dict]:
        """Call Gemini for intelligent pest/disease analysis."""

        now = datetime.now()
        month_name = now.strftime("%B")
        month_num = now.month
        if month_num in (6, 7, 8, 9, 10):
            season = "Kharif (monsoon)"
        elif month_num in (11, 12, 1, 2, 3):
            season = "Rabi (winter)"
        else:
            season = "Zaid (summer)"

        user_prompt = f"""Predict pest and disease risks for this crop:

TARGET CROP: {crop_type}

CURRENT CONDITIONS:
- Soil pH: {soil_ph}
- Soil Moisture: {soil_moisture}%
- Temperature: {temperature}°C
- Rainfall: {rainfall} mm/season
- Current Month: {month_name}
- Season: {season}

PEST & DISEASE REFERENCE DATABASE:
{PEST_REFERENCE}

Based on the crop, current conditions, and the reference database, identify ALL relevant pest and disease threats. Rank them by probability under these specific conditions. Provide practical IPM recommendations."""

        response = call_gemini(SYSTEM_PROMPT, user_prompt, temperature=0.3)
        if not response:
            return None

        return self._validate_response(response)

    def _validate_response(self, resp: Dict) -> Optional[Dict]:
        """Validate LLM response."""
        try:
            overall_risk = str(resp.get("overall_risk", "Moderate"))
            if overall_risk not in ("Low", "Moderate", "High", "Critical"):
                overall_risk = "Moderate"

            risk_score = float(resp.get("risk_score", 5.0))
            risk_score = max(0.0, min(10.0, risk_score))

            threats = []
            for t in resp.get("threats", []):
                if isinstance(t, dict) and "name" in t:
                    threats.append({
                        "name": str(t.get("name", "")),
                        "type": str(t.get("type", "unknown")),
                        "probability": min(100, max(0, int(t.get("probability", 50)))),
                        "severity": str(t.get("severity", "medium")),
                        "symptoms": str(t.get("symptoms", "")),
                        "bio_control": str(t.get("bio_control", "")),
                        "chemical_control": str(t.get("chemical_control", "")),
                        "prevention": str(t.get("prevention", "")),
                    })

            # Sort by probability descending
            threats.sort(key=lambda x: -x["probability"])

            return {
                "overall_risk": overall_risk,
                "risk_score": round(risk_score, 1),
                "threats": threats,
                "reasoning": str(resp.get("reasoning", "")),
                "ipm_plan": str(resp.get("ipm_plan", "")),
                "summary": str(resp.get("summary", "")),
            }
        except Exception as e:
            print(f"⚠️ PestDiseasePredictor: LLM response validation failed: {e}")
            return None

    # ── Fallback Path ────────────────────────────────────────────────

    def _fallback_predict(self, crop_type, soil_ph, soil_moisture,
                          temperature, rainfall) -> Dict:
        """Simple condition-matching fallback when LLM is unavailable."""
        threats = []
        crop_lower = crop_type.lower()

        # Basic condition-based threats
        if temperature > 25 and soil_moisture > 70 and crop_lower in ("rice", "sugarcane", "maize", "corn"):
            threats.append({
                "name": "Stem Borer", "type": "insect", "probability": 65,
                "severity": "high", "symptoms": "Dead hearts, white ears",
                "bio_control": "Trichogramma parasitoids",
                "chemical_control": "Cartap hydrochloride",
                "prevention": "Use resistant varieties",
            })

        if temperature < 25 and soil_moisture > 80 and crop_lower in ("potato", "tomato"):
            threats.append({
                "name": "Late Blight", "type": "fungal", "probability": 70,
                "severity": "high", "symptoms": "Dark water-soaked lesions",
                "bio_control": "Trichoderma soil application",
                "chemical_control": "Mancozeb + metalaxyl",
                "prevention": "Certified seed, crop rotation",
            })

        if soil_moisture > 70 and crop_lower == "rice":
            threats.append({
                "name": "Rice Blast", "type": "fungal", "probability": 55,
                "severity": "high", "symptoms": "Diamond-shaped lesions",
                "bio_control": "Pseudomonas fluorescens",
                "chemical_control": "Tricyclazole",
                "prevention": "Resistant varieties, balanced N",
            })

        if not threats:
            threats.append({
                "name": "General monitoring", "type": "advisory",
                "probability": 20, "severity": "low",
                "symptoms": "No immediate threats detected",
                "bio_control": "Maintain beneficial insect habitat",
                "chemical_control": "Not needed currently",
                "prevention": "Regular field scouting",
            })

        risk = "Low" if len(threats) <= 1 else "Moderate" if len(threats) <= 2 else "High"
        risk_score = 8.0 if risk == "Low" else 5.5 if risk == "Moderate" else 3.5

        return {
            "overall_risk": risk,
            "risk_score": risk_score,
            "threats": threats,
            "reasoning": "Fallback analysis — LLM unavailable.",
            "ipm_plan": "Regular field scouting recommended. Use biological controls first.",
            "summary": f"Offline assessment for {crop_type}: {risk} risk level.",
        }
