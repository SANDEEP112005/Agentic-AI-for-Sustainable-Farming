from models.central_coordinator import CentralCoordinator

# Initialize the CentralCoordinator
coordinator = CentralCoordinator()

# Generate recommendation with sample input values and real-time weather for a city
result = coordinator.generate_recommendation(
    soil_ph=4.0,
    soil_moisture=10,
    temperature=32,
    rainfall=35,
    fertilizer=0.5,
    pesticide=0.3,
    crop_yield=15,
    city_name="bangalore"  # Use real-time weather for Delhi
)

# Print recommendation results
print("\n--- Final Crop Recommendation ---")
for key, value in result.items():
    if key == "Warnings" and value:
        print("Warnings:")
        for warning in value:
            print(f"  - {warning}")
    else:
        print(f"{key}: {value}")

# Automatically plot the result scores
CentralCoordinator.plot_scores(result)