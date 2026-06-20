
import sys
import os
# Add the 'models' directory to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))
# Importing necessary autogen classes and SQLite connector
from autogen import AssistantAgent, GroupChat, GroupChatManager
import sqlite3
import pandas as pd
from models.farmer_advisor import FarmerAdvisor
from models.market_Researcher import MarketResearcher
from models.weather_Analyst import WeatherAnalyst
from models.sustainability_Expert import SustainabilityExpert
import re  # For parsing market prices from the message

# Groq LLM integration for versatile Q&A (Llama 3.3 70B)
import requests

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

def get_gemini_response(prompt):
    """Call Groq (Llama 3.3 70B) for general Q&A.

    Function name kept for backward compatibility.
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
    }
    data = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": "You are an expert agricultural assistant. Give clear, actionable advice for sustainable farming."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.5,
        "max_tokens": 2048,
    }
    try:
        response = requests.post(GROQ_API_URL, headers=headers, json=data, timeout=20)
        response.raise_for_status()
        result = response.json()
        print("[Groq API] Response received successfully")
        choices = result.get("choices", [])
        if choices:
            return choices[0]["message"]["content"]
        else:
            print("[Groq API error] No choices in response.")
            return "Sorry, I couldn't find an answer to your question right now."
    except requests.exceptions.Timeout:
        print("[Groq API error] Request timed out.")
        return "Sorry, the AI service timed out. Please try again."
    except requests.exceptions.RequestException as e:
        print(f"[Groq API error] RequestException: {e}")
        return f"Sorry, there was a problem reaching the AI service: {e}"
    except Exception as e:
        print(f"[Groq API error] Unexpected: {e}")
        return f"Sorry, an unexpected error occurred: {e}"

# Custom AssistantAgent class to override generate_reply
class CustomAssistantAgent(AssistantAgent):
    def __init__(self, name, system_message, llm_config):
        super().__init__(name=name, system_message=system_message, llm_config=llm_config)
        # Instantiate the agent classes
        self.farmer_advisor = FarmerAdvisor()
        self.market_researcher = MarketResearcher()
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'database', 'sustainable_farming.db'))
        self.weather_analyst = WeatherAnalyst(db_path=db_path)
        self.sustainability_expert = SustainabilityExpert()
        # Simulated farm and market inputs
        self.simulated_inputs = {
            'soil_ph': 6.5,  # Neutral soil pH
            'soil_moisture': 30.0,  # Percentage
            'fertilizer': 50.0,  # kg/ha
            'pesticide': 2.0,  # kg/ha
            'crop_yield': 3.0,  # ton/ha
            'temperature': 25.0,  # Celsius (initial placeholder, updated by WeatherAnalyst)
            'rainfall': 50.0,  # mm (initial placeholder, updated by WeatherAnalyst)
            'market_features': {
                'Demand_Index': 0.5,
                'Supply_Index': 0.5,
                'Competitor_Price_per_ton': 1000.0,
                'Economic_Indicator': 0.8,
                'Weather_Impact_Score': 0.7,
                'Seasonal_Factor': 'Medium',
                'Consumer_Trend_Index': 0.6
            }
        }
        self.sustainability_metrics = {}  # To store overall sustainability scores and new metrics
        self.final_result = None  # To store the final recommendation and chart data


    def generate_reply(self, messages=None, sender=None):
        if messages is None and sender is not None:
            messages = self.chat_messages.get(sender, [])

        # Responses for each agent
        if self.name == "FarmerAdvisor":
            response = self.farmer_advisor_response(messages)
            # If the rule-based response is generic or not helpful, use Gemini
            if response.strip().lower() in [
                "no farm inputs provided to suggest crops.",
                "i'm here to help with all your farming questions! i can assist with soil management, crop selection, pest control, irrigation, weather planning, and much more. could you be more specific about what you'd like to know?",
                "no valid response generated.",
                "no response available."
            ] or response.strip().startswith("FarmerAdvisor:"):
                # Use the latest user message as prompt
                user_msg = next((msg["content"] for msg in reversed(messages) if msg["name"] == "user"), None)
                if user_msg:
                    response = get_gemini_response(user_msg)
        elif self.name == "MarketResearcher":
            response = self.market_researcher_response(messages)
        elif self.name == "WeatherAnalyst":
            response = self.weather_analyst_response(messages)
        elif self.name == "SustainabilityExpert":
            response = self.sustainability_expert_response(messages)
        elif self.name == "CentralCoordinator":
            response = self.central_coordinator_logic(messages, sender)
        else:
            response = "No response available."

        # Debug: Log the response
        print(f"{self.name} response: {response}")

        # Ensure the response is a non-empty string (or dict for CentralCoordinator)
        if response is None or (isinstance(response, str) and not response.strip()):
            response = f"{self.name}: No valid response generated."
        
        return response

    def farmer_advisor_response(self, messages):
        initial_message = next((msg["content"] for msg in messages if msg["name"] == "CentralCoordinator"), "")
        if "hectare farm with" in initial_message:
            parts = initial_message.split("suggest crops based on a ")[1].split(" farm with ")
            land_size = float(parts[0].split("-hectare")[0])
            soil_type = parts[1].split(" soil and a preference for ")[0].lower()
            crop_preference = parts[1].split(" soil and a preference for ")[1].split(".")[0].lower()

            # Map soil type to soil pH (simplified mapping)
            soil_ph_mapping = {"sandy": 6.0, "loamy": 6.5, "clay": 7.0}
            self.simulated_inputs['soil_ph'] = soil_ph_mapping.get(soil_type, 6.5)

            # Use WeatherAnalyst's forecast for temperature and rainfall
            weather_forecast = self.weather_analyst.forecast(
                self.simulated_inputs['soil_ph'],
                self.simulated_inputs['soil_moisture'],
                self.simulated_inputs['fertilizer'],
                self.simulated_inputs['pesticide']
            )
            self.simulated_inputs['temperature'] = weather_forecast['temperature'][0]
            self.simulated_inputs['rainfall'] = weather_forecast['rainfall'][0]

            # Recommend crops
            recommended_crop = self.farmer_advisor.recommend(
                soil_ph=self.simulated_inputs['soil_ph'],
                soil_moisture=self.simulated_inputs['soil_moisture'],
                temp=self.simulated_inputs['temperature'],
                rainfall=self.simulated_inputs['rainfall'],
                fertilizer=self.simulated_inputs['fertilizer'],
                pesticide=self.simulated_inputs['pesticide'],
                crop_yield=self.simulated_inputs['crop_yield']
            )
            # Suggest a second crop based on crop preference
            crop_preference_crops = {
                "grains": ["wheat", "corn", "rice", "soybean"],
                "vegetables": ["carrots", "tomatoes"],
                "fruits": ["apples", "oranges"]
            }
            suggested_crops = crop_preference_crops.get(crop_preference, ["wheat", "corn"])
            if recommended_crop.lower() not in [crop.lower() for crop in suggested_crops]:
                suggested_crops[0] = recommended_crop.lower()
            return f"Based on a {land_size}-hectare farm with {soil_type} soil and a preference for {crop_preference}, I suggest planting {suggested_crops[0]} and {suggested_crops[1]}."
        return "No farm inputs provided to suggest crops."

    def market_researcher_response(self, messages):
        farmer_response = next((msg["content"] for msg in messages if msg["name"] == "FarmerAdvisor"), "")
        if "suggest planting" in farmer_response:
            crops = farmer_response.split("suggest planting ")[1].split(" and ")
            crops = [crop.strip(".") for crop in crops]
            market_insights = []
            for crop in crops:
                try:
                    predicted_price = self.market_researcher.forecast(crop, self.simulated_inputs['market_features'])[0]
                    market_insights.append(f"{crop} is expected to have a market price of ${predicted_price:.2f} per ton")
                except ValueError as e:
                    market_insights.append(f"No market data available for {crop}")
            return ", and ".join(market_insights) + "."
        return "No crops suggested to provide market insights."

    def weather_analyst_response(self, messages):
        temp = self.simulated_inputs['temperature']
        rainfall = self.simulated_inputs['rainfall']
        return f"For the next 3 months, expect a temperature of {temp:.1f}°C and rainfall of {rainfall:.1f} mm."

    def sustainability_expert_response(self, messages):
        farmer_response = next((msg["content"] for msg in messages if msg["name"] == "FarmerAdvisor"), "")
        if "suggest planting" in farmer_response:
            crops = farmer_response.split("suggest planting ")[1].split(" and ")
            crops = [crop.strip(".") for crop in crops]

            # Compute sustainability scores for each crop
            sustainability_notes = []
            self.sustainability_metrics = {}

            for crop in crops:
                try:
                    scores_tuple = self.sustainability_expert.evaluate(
                        [crop],
                        soil_ph=self.simulated_inputs['soil_ph'],
                        soil_moisture=self.simulated_inputs['soil_moisture'],
                        rainfall=self.simulated_inputs['rainfall'],
                        fertilizer=self.simulated_inputs['fertilizer'],
                        pesticide=self.simulated_inputs['pesticide'],
                        crop_yield=self.simulated_inputs['crop_yield']
                    )
                    scores = scores_tuple[1]  # Dictionary with sustainability, carbon, water, erosion scores
                except Exception as e:
                    return f"Error evaluating sustainability: {str(e)}"

                self.sustainability_metrics[crop] = {
                    'sustainability_score': scores['sustainability'],
                    'carbon_score': scores['carbon'],
                    'water_score': scores['water'],
                    'erosion_score': scores['erosion']
                }

                sustainability_notes.append(
                    f"{crop} has a predicted sustainability score of {scores['sustainability']:.2f} "
                    f"(Carbon Footprint: {scores['carbon']:.2f}, Water: {scores['water']:.2f}, Erosion: {scores['erosion']:.2f})."
                )

            return " ".join(sustainability_notes)
        return "No crops suggested to evaluate sustainability."

    def central_coordinator_logic(self, messages, sender):
        # Collect responses from all agents
        agent_responses = {}
        for message in messages:
            sender_name = message.get("name")
            content = message.get("content")
            if sender_name and content and sender_name != "CentralCoordinator":
                agent_responses[sender_name] = content

        # Extract crops from FarmerAdvisor
        crops = agent_responses.get("FarmerAdvisor", "").split("suggest planting ")[1].split(" and ")
        crops = [crop.strip(".") for crop in crops]

        # Extract market, weather, and sustainability info
        market_info = agent_responses.get("MarketResearcher", "")
        weather_info = agent_responses.get("WeatherAnalyst", "")
        sustainability_info = agent_responses.get("SustainabilityExpert", "")

        # Parse market prices from MarketResearcher's response
        market_predictions = {}
        for crop in crops:
            pattern = rf"{crop} is expected to have a market price of \$([\d\.]+) per ton"
            match = re.search(pattern, market_info)
            if match:
                market_predictions[crop] = float(match.group(1))
            else:
                market_predictions[crop] = 0.0  # Default if price not found

        # Parse sustainability scores from SustainabilityExpert's response
        sustainability_scores = {}
        for crop in crops:
            pattern = rf"{crop} has a predicted sustainability score of ([\d\.]+) \(Carbon Footprint: ([\d\.]+), Water: ([\d\.]+), Erosion: ([\d\.]+)\)"
            match = re.search(pattern, sustainability_info)
            if match:
                sustainability_score = float(match.group(1))
                carbon_score = float(match.group(2))
                water_score = float(match.group(3))
                erosion_score = float(match.group(4))
                sustainability_scores[crop] = {
                    'sustainability_score': sustainability_score,
                    'carbon_score': carbon_score,
                    'water_score': water_score,
                    'erosion_score': erosion_score
                }
            else:
                sustainability_scores[crop] = {
                    'sustainability_score': 0.5,
                    'carbon_score': 0.0,
                    'water_score': 0.0,
                    'erosion_score': 0.0
                }

        # Weighted scoring system
        weights = {
            "market": 0.25,         # 25%
            "weather": 0.20,        # 20%
            "sustainability": 0.20, # 20%
            "carbon": 0.15,         # 15%
            "water": 0.10,          # 10%
            "erosion": 0.10         # 10%
        }
        crop_scores = {}

        for crop in crops:
            # Market Score (Profitability): Based on predicted price
            market_score = 0.5  # Default
            predicted_price = market_predictions.get(crop, 0.0)
            market_score = min(predicted_price / 1000.0, 1.0)

            # Weather Score (Suitability): Based on temperature and rainfall
            temp = float(weather_info.split("temperature of ")[1].split("°C")[0])
            rainfall = float(weather_info.split("rainfall of ")[1].split(" mm")[0])
            weather_score = 1 - abs(temp - self.simulated_inputs['temperature']) / 50 - abs(rainfall - self.simulated_inputs['rainfall']) / 100
            weather_score = max(0, round(weather_score, 2))

            # Sustainability Scores
            sustainability_metrics = sustainability_scores.get(crop, {
                'sustainability_score': 0.5,
                'carbon_score': 0.0,
                'water_score': 0.0,
                'erosion_score': 0.0
            })
            sustainability_score = sustainability_metrics['sustainability_score']
            carbon_score = sustainability_metrics['carbon_score']
            water_score = sustainability_metrics['water_score']
            erosion_score = sustainability_metrics['erosion_score']

            # Total score
            total_score = (
                weights["market"] * market_score +
                weights["weather"] * weather_score +
                weights["sustainability"] * sustainability_score +
                weights["carbon"] * carbon_score +
                weights["water"] * water_score +
                weights["erosion"] * erosion_score
            )
            crop_scores[crop] = {
                'total_score': total_score,
                'market_score': market_score,
                'weather_score': weather_score,
                'sustainability_score': sustainability_score,
                'carbon_score': carbon_score,
                'water_score': water_score,
                'erosion_score': erosion_score,
                'predicted_temperature': temp,
                'predicted_rainfall': rainfall
            }

        # Rank crops by total score and remove duplicates
        seen_crops = set()
        unique_crop_scores = []
        for crop, scores in sorted(crop_scores.items(), key=lambda x: x[1]['total_score'], reverse=True):
            if crop not in seen_crops:
                seen_crops.add(crop)
                unique_crop_scores.append((crop, scores))

        # Generate recommendation with detailed rationale
        recommendations = []
        for crop, scores in unique_crop_scores:
            market_rationale = f"market score: {scores['market_score']:.2f} (${market_predictions.get(crop, 0.0):.2f}/ton)"
            weather_rationale = f"weather suitability: {scores['weather_score']:.2f}"
            sustainability_rationale = f"sustainability: {scores['sustainability_score']:.2f}"
            carbon_rationale = f"carbon footprint: {scores['carbon_score']:.2f}"
            water_rationale = f"water: {scores['water_score']:.2f}"
            erosion_rationale = f"erosion: {scores['erosion_score']:.2f}"
            rationale = (f"Plant {crop}: {market_rationale}, {weather_rationale}, {sustainability_rationale}, "
                        f"{carbon_rationale}, {water_rationale}, {erosion_rationale} (Final Score: {scores['total_score']:.2f})")
            recommendations.append(rationale)

        # Combine into final recommendation
        final_recommendation = "Recommendations:\n" + "\n".join(recommendations) + f"\n\nDetails:\nMarket Insights: {market_info}\nWeather Forecast: {weather_info}\nSustainability Notes: {sustainability_info}"

        # Generate pie chart data for visualization in Streamlit
        chart_data = []
        for crop, scores in unique_crop_scores:
            chart_data.append({
                'crop': crop,
                'labels': ['Market Score', 'Weather Suitability Score', 'Sustainability Score',
                           'Carbon Footprint Score', 'Water Score', 'Erosion Score', 'Final Score'],
                'values': [
                    scores['market_score'],
                    scores['weather_score'],
                    scores['sustainability_score'],
                    scores['carbon_score'],
                    scores['water_score'],
                    scores['erosion_score'],
                    scores['total_score']
                ]
            })

        # Store in SQLite with new columns for all scores
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'database', 'sustainable_farming.db'))
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
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
            for crop, scores in unique_crop_scores:
                cursor.execute(
                    "INSERT INTO recommendations (crop, score, rationale, market_score, weather_score, sustainability_score, carbon_score, water_score, erosion_score) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        crop,
                        scores['total_score'],
                        f"Plant {crop}: market score: {scores['market_score']:.2f}, weather suitability: {scores['weather_score']:.2f}, sustainability: {scores['sustainability_score']:.2f}",
                        scores['market_score'],
                        scores['weather_score'],
                        scores['sustainability_score'],
                        scores['carbon_score'],
                        scores['water_score'],
                        scores['erosion_score']
                    )
                )
            conn.commit()

        # Store the full result in the instance variable
        self.final_result = {
            'recommendation': final_recommendation,
            'chart_data': chart_data
        }

        # Return only the recommendation string as the chat message
        return final_recommendation

# Define the agents using the custom class
farmer_advisor = CustomAssistantAgent(
    name="FarmerAdvisor",
    system_message="I am the Farmer Advisor. I process farmer inputs to suggest suitable crops.",
    llm_config=False
)

market_researcher = CustomAssistantAgent(
    name="MarketResearcher",
    system_message="I am the Market Researcher. I analyze market trends to suggest profitable crops.",
    llm_config=False
)

weather_analyst = CustomAssistantAgent(
    name="WeatherAnalyst",
    system_message="I am the Weather Analyst. I predict weather conditions based on farm inputs.",
    llm_config=False
)

sustainability_expert = CustomAssistantAgent(
    name="SustainabilityExpert",
    system_message="I am the Sustainability Expert. I evaluate crops for sustainability.",
    llm_config=False
)

central_coordinator = CustomAssistantAgent(
    name="CentralCoordinator",
    system_message="I am the Central Coordinator. I integrate agent outputs to provide recommendations.",
    llm_config=False
)

# Define a custom speaker selection function
def custom_select_speaker(last_speaker, groupchat):
    agents = [farmer_advisor, market_researcher, weather_analyst, sustainability_expert, central_coordinator]
    if last_speaker is None:
        return agents[0]
    last_index = agents.index(last_speaker)
    next_index = (last_index + 1) % len(agents)
    return agents[next_index]

# Set up the group chat for agent interactions
group_chat = GroupChat(
    agents=[farmer_advisor, market_researcher, weather_analyst, sustainability_expert, central_coordinator],
    messages=[],
    max_round=6  # Already set to 6 to allow CentralCoordinator to respond
)

group_chat.select_speaker = custom_select_speaker

group_chat_manager = GroupChatManager(
    groupchat=group_chat,
    llm_config=False
)

# Function to initiate the group chat with dynamic farmer inputs and return the recommendation
def run_agent_collaboration(land_size, soil_type, crop_preference):
    initial_message = (
        f"Let’s generate a farming recommendation. "
        f"FarmerAdvisor, please suggest crops based on a {land_size}-hectare farm with {soil_type.lower()} soil "
        f"and a preference for {crop_preference.lower()}. "
        f"MarketResearcher, provide market insights for those crops. "
        f"WeatherAnalyst, predict weather for the next 3 months. "
        f"SustainabilityExpert, evaluate the sustainability of the suggested crops."
    )
    # Initiate the chat
    central_coordinator.initiate_chat(
        group_chat_manager,
        message={"content": initial_message, "role": "user"}
    )
    # Retrieve the final result from the CentralCoordinator instance
    result = central_coordinator.final_result
    if result is None:
        raise ValueError("No recommendation generated by CentralCoordinator.")
    return result

if __name__ == "__main__":
    result = run_agent_collaboration(land_size=8, soil_type="Loamy", crop_preference="Grains")
    print(result['recommendation'])
