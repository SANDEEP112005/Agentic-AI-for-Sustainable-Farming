import requests
import json
from pprint import pprint

BASE_URL = "http://localhost:8002"

def check_health():
    try:
        resp = requests.get(f"{BASE_URL}/")
        print(f"ROOT: {resp.status_code}")
        print(resp.json())
        return True
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def check_recommendation():
    url = f"{BASE_URL}/multi_agent_recommendation"
    payload = {
        "username": "test_farmer",
        "land_size": 5.0,
        "soil_type": "Loamy",
        "crop_preference": "Wheat",
        "nitrogen": 40.0,
        "phosphorus": 30.0,
        "potassium": 30.0,
        "temperature": 25.0,
        "humidity": 60.0,
        "ph": 6.5,
        "rainfall": 500.0,
        "crop_type": "Wheat" # Added because of schema mismatch suspicion, though schema said it defaults?
    }
    
    # Schema check: main.py Request model:
    # class MultiAgentRecommendationRequest(BaseModel):
    #     username: str = "anonymous"
    #     ...
    
    try:
        resp = requests.post(url, json=payload)
        print(f"\nRECOMMENDATION: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            pprint(data)
            
            # Check for "Agentic" signs
            if "central_coordinator" in data and "agents" in data:
                print("\n✅ Multi-Agent logic verified!")
                print(f"Recommended Crop: {data['central_coordinator'].get('final_crop')}")
                return True
            else:
                print("❌ Response missing agent structure.")
                return False
        else:
            print(f"Error: {resp.text}")
            return False
            
    except Exception as e:
        print(f"Recommendation check failed: {e}")
        return False

if __name__ == "__main__": # Corrected __name__ check
    print("Checking Backend...")
    if check_health():
        check_recommendation()
