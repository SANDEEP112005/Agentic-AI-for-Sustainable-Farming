"""
weather_api — Open-Meteo weather helper (free, no API key)
=========================================================
"""
import requests

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


def _geocode(city_name: str):
    """Resolve city name → (lat, lon) via Open-Meteo geocoding."""
    resp = requests.get(GEOCODE_URL, params={
        "name": city_name, "count": 1, "language": "en", "format": "json",
    }, timeout=8)
    resp.raise_for_status()
    results = resp.json().get("results", [])
    if not results:
        raise Exception(f"City '{city_name}' not found")
    return results[0]["latitude"], results[0]["longitude"]


def get_current_weather(city_name: str) -> dict:
    """
    Fetch current weather data for a given city using Open-Meteo API.
    Returns a dictionary with temperature (°C) and rainfall (mm).
    """
    lat, lon = _geocode(city_name)
    resp = requests.get(FORECAST_URL, params={
        "latitude": lat, "longitude": lon,
        "current": "temperature_2m,precipitation",
        "timezone": "auto",
    }, timeout=10)
    resp.raise_for_status()
    cur = resp.json().get("current", {})
    return {
        "temperature": cur.get("temperature_2m", 0),
        "rainfall": cur.get("precipitation", 0),
    }