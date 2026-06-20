# 🌾 AgriSmart AI - Smart Farming Assistant

**Production-Ready AI-Powered Farming Application with Voice Support & Offline Capabilities**

[![Version](https://img.shields.io/badge/version-2.0.0-green.svg)](https://github.com/agrismart/agrismart-ai)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Web%20|%20Android%20|%20iOS-orange.svg)]()

## 🎯 Key Features

### 🎤 Voice-First Interface
- **No reading required** - Farmers can speak commands in their native language
- **10+ Indian languages** supported: Hindi, Kannada, Telugu, Tamil, Bengali, Gujarati, Marathi, Punjabi, and more
- **Text-to-Speech** for all recommendations and results
- **Hands-free operation** for use in fields

### 📴 Offline-First Architecture
- **Works without internet** - Essential farming data cached locally
- **Auto-sync** when connection is restored
- **IndexedDB storage** for unlimited offline data
- **Service Worker** for complete offline functionality

### 🧠 AI-Powered Features
- **Crop Recommendations** - ML-based suggestions for your soil and climate
- **Pest Prediction** - Early warning system for crop diseases
- **Weather Intelligence** - 7-day forecast with farming insights
- **Fertilizer Calculator** - Optimal NPK recommendations
- **Market Prices** - Real-time mandi prices and forecasts
- **Crop Rotation Planner** - Sustainable farming schedules

### 👨‍🌾 Farmer-Friendly Design
- **Visual Navigation** - Icon-based menu for illiterate users
- **Large Touch Targets** - Easy to use with rough hands
- **Picture-Based Crop Selection** - No text reading needed
- **Simple Slider Inputs** - Intuitive data entry
- **Emoji Indicators** - Universal visual language

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+ (for Android app build)
- Modern browser (Chrome, Firefox, Edge, Safari)

### Installation

```bash
# Clone the repository
git clone https://github.com/agrismart/agrismart-ai.git
cd agrismart-ai

# Install Python dependencies
pip install -r requirements.txt

# Start the backend server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001

# In another terminal, serve the frontend
cd frontend
python -m http.server 3000
```

### Access the Application
- **Web App**: http://localhost:3000
- **API Docs**: http://localhost:8001/docs

## 📱 Building Android App

### Using Capacitor

```bash
# Install Node dependencies
npm install

# Add Android platform
npx cap add android

# Sync web assets
npx cap sync android

# Open in Android Studio
npx cap open android
```

### Build APK
1. Open the project in Android Studio
2. Build > Generate Signed Bundle/APK
3. Follow the signing wizard
4. APK will be in `android/app/release/`

## 🏗️ Project Structure

```
agrismart-ai/
├── frontend/                 # Web application
│   ├── index.html           # Main HTML (PWA-ready)
│   ├── app.js               # Core application logic
│   ├── voice-interface.js   # Voice recognition & TTS
│   ├── offline-data.js      # IndexedDB & offline sync
│   ├── service-worker.js    # PWA service worker
│   ├── manifest.json        # PWA manifest
│   ├── styles_modern.css    # Main styles
│   └── voice-styles.css     # Voice UI styles
├── backend/
│   └── main.py              # FastAPI backend
├── models/                   # ML models
│   ├── farmer_advisor.py    # Crop recommendation model
│   ├── weather_analyst.py   # Weather prediction
│   └── pest_predictor.py    # Pest detection
├── database/                 # SQLite database
├── capacitor.config.json    # Android/iOS config
└── package.json             # Node.js config
```

## 🎤 Voice Commands

| Command (English) | Command (Hindi) | Action |
|------------------|-----------------|--------|
| "Recommend crop" | "फसल सिफारिश करो" | Opens crop recommendation |
| "Check weather" | "मौसम बताओ" | Shows weather forecast |
| "Pest problem" | "कीट समस्या" | Opens pest prediction |
| "Market price" | "बाजार भाव" | Shows market prices |
| "Help" | "मदद" | Lists available commands |

## 🌐 Supported Languages

| Language | Code | Voice Support |
|----------|------|---------------|
| English | en | ✅ |
| Hindi | hi | ✅ |
| Kannada | kn | ✅ |
| Telugu | te | ✅ |
| Tamil | ta | ✅ |
| Bengali | bn | ✅ |
| Gujarati | gu | ✅ |
| Marathi | mr | ✅ |
| Punjabi | pa | ✅ |
| Malayalam | ml | ✅ |

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/weather` | POST | Get weather forecast |
| `/fertilizer` | POST | Calculate fertilizer needs |
| `/crop_rotation` | POST | Generate rotation plan |
| `/pest_prediction` | POST | Predict pest risks |
| `/sustainability` | POST | Sustainability analysis |
| `/chatbot/ask` | POST | AI chatbot response |
| `/multi_agent_recommendation` | POST | ML crop recommendation |

## 🔧 Configuration

### Environment Variables
```env
# Backend
DATABASE_URL=sqlite:///database/sustainable_farming.db
API_HOST=127.0.0.1
API_PORT=8001

# Optional
OPENWEATHER_API_KEY=your_api_key
GOOGLE_TRANSLATE_API_KEY=your_api_key
```

### PWA Installation
1. Open the web app in Chrome
2. Click "Install App" when prompted
3. Or use Menu > Install AgriSmart AI

## 🧪 Testing

```bash
# Run backend tests
pytest tests/

# Test API endpoints
curl -X POST http://localhost:8001/weather \
  -H "Content-Type: application/json" \
  -d '{"lat": 12.97, "lon": 77.59, "crop_type": "Rice"}'
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Indian farmers who inspired this project
- Open source ML community
- Google's TensorFlow and speech APIs
- All contributors

---

**Made with ❤️ for Indian Farmers**

*"Technology for those who feed our nation"*
