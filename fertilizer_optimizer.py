import sqlite3
# from i18n import get_translation

class FertilizerOptimizer:
    def __init__(self, db_path="database/sustainable_farming.db", language="English"):
        self.db_path = db_path
        self.language = language

    def calculate_fertilizer(self, land_size, soil_type, crop_type):
        """Calculate optimal fertilizer amounts with sustainability adjustments."""
        # Base fertilizer needs (kg/ha) - adjust based on research or data
        fertilizer_needs = {
            "nitrogen": {
                "loamy": {"wheat": 60, "corn": 80, "rice": 70, "soybeans": 30, "tomatoes": 50, "carrots": 40},
                "sandy": {"wheat": 70, "corn": 90, "rice": 80, "soybeans": 35, "tomatoes": 60, "carrots": 45},
                "clay": {"wheat": 50, "corn": 70, "rice": 60, "soybeans": 25, "tomatoes": 40, "carrots": 35}
            },
            "phosphorus": {
                "loamy": {"wheat": 30, "corn": 40, "rice": 35, "soybeans": 15, "tomatoes": 30, "carrots": 25},
                "sandy": {"wheat": 35, "corn": 45, "rice": 40, "soybeans": 20, "tomatoes": 35, "carrots": 30},
                "clay": {"wheat": 25, "corn": 35, "rice": 30, "soybeans": 10, "tomatoes": 25, "carrots": 20}
            },
            "potassium": {
                "loamy": {"wheat": 50, "corn": 60, "rice": 55, "soybeans": 20, "tomatoes": 50, "carrots": 40},
                "sandy": {"wheat": 55, "corn": 65, "rice": 60, "soybeans": 25, "tomatoes": 55, "carrots": 45},
                "clay": {"wheat": 45, "corn": 55, "rice": 50, "soybeans": 15, "tomatoes": 45, "carrots": 35}
            }
        }
        crop = crop_type.lower()
        soil = soil_type.lower()
        sustainability_factor = 0.85  # Reduce by 15% for sustainability
        nitrogen = fertilizer_needs["nitrogen"].get(soil, {}).get(crop, 50) * land_size * sustainability_factor
        phosphorus = fertilizer_needs["phosphorus"].get(soil, {}).get(crop, 30) * land_size * sustainability_factor
        potassium = fertilizer_needs["potassium"].get(soil, {}).get(crop, 50) * land_size * sustainability_factor
        return {
            "nitrogen_kg": round(nitrogen, 2),
            "phosphorus_kg": round(phosphorus, 2),
            "potassium_kg": round(potassium, 2)
        }
    
    def get_fertilizer_info(self):
        """Get translated fertilizer information"""
        return {
            'nitrogen': 'Nitrogen',
            'phosphorus': 'Phosphorus',
            'potassium': 'Potassium',
            'fertilizer_note': 'Fertilizer note'
        }