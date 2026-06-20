import sqlite3
from datetime import datetime, timedelta
import plotly.graph_objects as go
# from i18n import get_translation

class CropRotationPlanner:
    def __init__(self, db_path="database/sustainable_farming.db", language="English"):
        self.db_path = db_path
        self.language = language

    def get_historical_crops(self):
        """Retrieve past crops from recommendations table."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT crop, timestamp FROM recommendations ORDER BY timestamp DESC LIMIT 5")
                return cursor.fetchall()
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return []

    def suggest_rotation(self, current_crop):
        """Suggest next crop based on current crop and rotation principles."""
        rotation_rules = {
            "soybeans": ["corn", "wheat"],
            "corn": ["soybeans", "cotton"],
            "wheat": ["soybeans", "barley"],
            "barley": ["soybeans", "corn"],
            "cotton": ["soybeans", "wheat"],
            "tomatoes": ["corn", "beans"],
            "carrots": ["wheat", "soybeans"]
        }
        history = self.get_historical_crops()
        recent_crops = [row[0].lower() for row in history if row[0]]
        if current_crop.lower() in recent_crops:
            available_options = [c for c in rotation_rules.get(current_crop.lower(), ["soybeans"]) if c not in recent_crops]
            return available_options[0] if available_options else rotation_rules.get(current_crop.lower(), ["soybeans"])[0]
        return rotation_rules.get(current_crop.lower(), ["soybeans"])[0]

    def generate_plan(self, current_crop, years=3):
        """Generate a multi-year rotation plan."""
        plan = []
        current = current_crop
        for year in range(years):
            next_crop = self.suggest_rotation(current)
            plan.append((datetime.now().year + year, next_crop.capitalize()))
            current = next_crop
        return plan

    def create_timeline(self, plan):
        """Create a Plotly timeline for the rotation plan."""
        years = [item[0] for item in plan]
        crops = [item[1] for item in plan]
        
        # Get translated title
        title = 'Crop Rotation Planner'
        year_label = 'Year'
        crop_label = 'Crop'
        
        fig = go.Figure(data=[go.Scatter(x=years, y=crops, mode='lines+markers+text', text=crops, textposition="top center")])
        fig.update_layout(
            title=title,
            xaxis_title=year_label,
            yaxis_title=crop_label,
            height=400,
            margin=dict(l=0, r=0, t=40, b=0)
        )
        return fig