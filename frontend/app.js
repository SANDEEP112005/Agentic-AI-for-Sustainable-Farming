/* ══════════════════════════════════════════════════
   AgriSmart AI — Application Logic
   Complete JS for all pages & features
   ══════════════════════════════════════════════════ */

// ─── State ───
const state = {
    user: null,
    farmSetup: null,
    recommendations: [],
    currentPage: 'dashboard',
    language: localStorage.getItem('agri_lang') || 'en',
    isOffline: !navigator.onLine
};

const API = window.API_BASE || 'http://127.0.0.1:8001';

// ─── Initialise on Load ───
document.addEventListener('DOMContentLoaded', () => {
    restoreSession();
    setupNetworkListeners();
    updateOfflineUI();
    setGreeting();
    // Apply saved language on load
    applyTranslations(state.language);
    // Sync lang label
    const labels = { en: 'EN', hi: 'हि', kn: 'ಕ', te: 'తె', ta: 'த', ml: 'മ', bn: 'বা', gu: 'ગુ', mr: 'म', pa: 'ਪ', or: 'ଓ' };
    const langLbl = document.getElementById('lang-label');
    if (langLbl) langLbl.textContent = labels[state.language] || 'EN';
    if (document.getElementById('settings-language')) {
        document.getElementById('settings-language').value = state.language;
    }
    // Restore Simple Mode
    if (localStorage.getItem('agri_simple_mode') === '1') {
        activateSimpleMode(false);
    }
    // Show walkthrough for first-time users
    if (!localStorage.getItem('agri_walkthrough_done')) {
        setTimeout(() => startWalkthrough(), 800);
    }
});

// ═══════════════════════════════════════════════════════════════
//  SIMPLE MODE — For Illiterate Farmers
//  Voice-first, picture-first, minimal text, big buttons
// ═══════════════════════════════════════════════════════════════

function toggleSimpleMode() {
    const isSimple = document.body.classList.contains('simple-mode');
    if (isSimple) {
        deactivateSimpleMode();
    } else {
        activateSimpleMode(true);
    }
}

function activateSimpleMode(announce = true) {
    document.body.classList.add('simple-mode');
    localStorage.setItem('agri_simple_mode', '1');
    
    // Show simple-only elements, hide advanced-only
    document.querySelectorAll('.simple-only').forEach(el => el.style.display = '');
    document.querySelectorAll('.advanced-only').forEach(el => el.style.display = 'none');
    
    // Update toggle button appearance
    const toggle = document.getElementById('simple-mode-toggle');
    if (toggle) {
        toggle.classList.add('active');
        toggle.querySelector('.smt-label').textContent = '✓ Simple Mode ON';
    }
    
    // Show picture nav on dashboard
    const picNav = document.getElementById('picture-nav');
    if (picNav) picNav.style.display = '';
    
    // Show one-tap section
    const oneTap = document.getElementById('one-tap-section');
    if (oneTap) oneTap.style.display = '';
    
    // Show simple weather
    const simpleWeather = document.getElementById('simple-weather');
    if (simpleWeather) simpleWeather.style.display = '';
    
    // Show emergency button
    const emergBtn = document.getElementById('emergency-pest-btn');
    if (emergBtn) emergBtn.style.display = '';
    
    // Show visual pickers
    const vcPicker = document.getElementById('visual-crop-picker');
    if (vcPicker) vcPicker.style.display = '';
    const vsPicker = document.getElementById('visual-soil-picker');
    if (vsPicker) vsPicker.style.display = '';
    
    if (announce) {
        speakText(getSimpleText('simple.activated', 'Simple Mode activated! I will now speak everything aloud and show pictures instead of text. Tap the big pictures to use the app.'));
        toast('🌾 Simple Mode ON — Pictures & Voice!', 'success');
    }
}

function deactivateSimpleMode() {
    document.body.classList.remove('simple-mode');
    localStorage.setItem('agri_simple_mode', '0');
    
    document.querySelectorAll('.simple-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.advanced-only').forEach(el => el.style.display = '');
    
    const toggle = document.getElementById('simple-mode-toggle');
    if (toggle) {
        toggle.classList.remove('active');
        toggle.querySelector('.smt-label').textContent = 'Simple Mode';
    }
    
    // Hide picture nav, one-tap, etc.
    ['picture-nav', 'one-tap-section', 'simple-weather', 'emergency-pest-btn', 'visual-crop-picker', 'visual-soil-picker'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    window.speechSynthesis?.cancel();
    toast('Advanced Mode restored', 'info');
}

// ═══════════════════════════════════════
//  TEXT-TO-SPEECH ENGINE
// ═══════════════════════════════════════

const ttsLangMap = {
    'en': 'en-IN', 'hi': 'hi-IN', 'kn': 'kn-IN', 'te': 'te-IN',
    'ta': 'ta-IN', 'ml': 'ml-IN', 'bn': 'bn-IN', 'gu': 'gu-IN',
    'mr': 'mr-IN', 'pa': 'pa-IN', 'or': 'or-IN'
};

function speakText(text, lang) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    // Clean HTML tags and markdown
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '').replace(/\n{2,}/g, '. ').replace(/\n/g, ', ').substring(0, 2000);
    
    const effectiveLang = lang || state.language;

    // Auto-translate English text to the selected language before speaking
    if (effectiveLang !== 'en' && /[a-zA-Z]{2,}/.test(cleanText)) {
        translateText(cleanText, effectiveLang).then(translated => {
            _doSpeak(translated, effectiveLang);
        });
        return;
    }
    return _doSpeak(cleanText, effectiveLang);
}

function _doSpeak(cleanText, effectiveLang) {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = ttsLangMap[effectiveLang] || 'en-IN';
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const targetLang = utterance.lang;
    const matchedVoice = voices.find(v => v.lang === targetLang) || voices.find(v => v.lang.startsWith(targetLang.split('-')[0]));
    if (matchedVoice) utterance.voice = matchedVoice;
    
    window.speechSynthesis.speak(utterance);
    return utterance;
}

function autoSpeak(text) {
    // Only auto-speak if simple mode is active
    if (document.body.classList.contains('simple-mode')) {
        speakText(text);
    }
}

function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// Pre-load voices
if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

// Add speaker buttons to result sections
function addSpeakerButton(container, text) {
    const btn = document.createElement('button');
    btn.className = 'speaker-btn';
    btn.innerHTML = '🔊';
    btn.title = 'Listen';
    btn.onclick = (e) => {
        e.stopPropagation();
        speakText(text);
        btn.classList.add('speaking');
        const utterances = window.speechSynthesis;
        const checkDone = setInterval(() => {
            if (!utterances.speaking) {
                btn.classList.remove('speaking');
                clearInterval(checkDone);
            }
        }, 300);
    };
    if (container.querySelector('.speaker-btn')) return; // Don't add duplicate
    container.style.position = 'relative';
    container.appendChild(btn);
}

// ═══════════════════════════════════════
//  ONE-TAP SMART ADVICE
// ═══════════════════════════════════════

async function oneTapAdvice() {
    const progressEl = document.getElementById('one-tap-progress');
    const resultEl = document.getElementById('one-tap-result');
    const btnEl = document.getElementById('one-tap-btn');
    
    if (progressEl) progressEl.style.display = '';
    if (resultEl) { resultEl.style.display = 'none'; resultEl.innerHTML = ''; }
    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Working...'; }
    
    // Navigate to dashboard first
    navigate('dashboard');
    
    function setOTPStep(step, status) {
        const el = document.getElementById(`otp-step-${step}`);
        if (!el) return;
        el.className = `otp-step ${status}`; // 'active', 'done', 'error'
    }
    
    try {
        // Step 1: Detect Location
        setOTPStep(1, 'active');
        autoSpeak('Finding your location...');
        
        const pos = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) reject(new Error('No GPS'));
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true, timeout: 15000, maximumAge: 300000
            });
        });
        
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        document.getElementById('user-lat').value = lat;
        document.getElementById('user-lon').value = lon;
        
        let placeName = `${lat.toFixed(2)}°N`;
        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`);
            const geoData = await geoRes.json();
            placeName = geoData.address?.village || geoData.address?.town || geoData.address?.city || placeName;
        } catch {}
        
        setOTPStep(1, 'done');
        
        // Step 2: Fetch Weather
        setOTPStep(2, 'active');
        autoSpeak('Checking weather for ' + placeName);
        
        const weatherData = await fetchAPI('/weather', { lat, lon });
        const temp = Math.round(weatherData.current_weather?.temperature || 25);
        const hum = weatherData.current_weather?.humidity || 60;
        const rain = Math.round(weatherData.metrics?.total_rainfall || 0);
        
        // Update hidden fields
        document.getElementById('temperature').value = temp;
        document.getElementById('humidity').value = hum;
        document.getElementById('rainfall').value = rain;
        
        // Update simple weather display
        const simpleIcon = document.getElementById('simple-weather-icon');
        const simpleTemp = document.getElementById('simple-weather-temp');
        if (simpleIcon) simpleIcon.textContent = temp > 35 ? '🔥' : temp > 25 ? '☀️' : temp > 15 ? '⛅' : '❄️';
        if (simpleTemp) simpleTemp.textContent = temp + '°';
        
        setOTPStep(2, 'done');
        
        // Step 3: Get AI Recommendation
        setOTPStep(3, 'active');
        autoSpeak('AI is analyzing your farm data...');
        
        const soilType = state.farmSetup?.soil_type || document.getElementById('soil-type').value || 'Loamy';
        const cropPref = state.farmSetup?.crop_preference || document.getElementById('crop-preference').value || 'Grains';
        
        // Auto-save farm setup
        state.farmSetup = {
            land_size: state.farmSetup?.land_size || 5,
            soil_type: soilType,
            crop_preference: cropPref,
            nitrogen: state.farmSetup?.nitrogen || 0,
            phosphorus: state.farmSetup?.phosphorus || 0,
            potassium: state.farmSetup?.potassium || 0,
            temperature: temp, humidity: hum, ph: 6.5, rainfall: rain,
            lat, lon, locMethod: 'gps', city: placeName
        };
        localStorage.setItem('agri_farm_setup', JSON.stringify(state.farmSetup));
        
        const isSimple = document.body.classList.contains('simple-mode');
        let data = null;
        let quickData = null;
        
        // In Simple Mode: use instant custom engine FIRST, then optionally enhance with LLM
        if (isSimple) {
            try {
                quickData = await fetchAPI('/api/quick_recommend', {
                    temperature: temp, humidity: hum, rainfall: rain, ph: 6.5,
                    nitrogen: state.farmSetup.nitrogen, phosphorus: state.farmSetup.phosphorus,
                    potassium: state.farmSetup.potassium,
                    soil_type: soilType, land_size: state.farmSetup.land_size,
                    crop_preference: cropPref
                });
            } catch(e) { console.warn('Quick recommend failed, falling back to full pipeline:', e); }
        }
        
        // If quick engine worked, show instant result; otherwise use full pipeline
        if (!quickData?.success) {
            data = await fetchAPI('/multi_agent_recommendation', {
                username: state.user?.username || 'anonymous',
                land_size: state.farmSetup.land_size,
                soil_type: soilType, crop_preference: cropPref,
                nitrogen: state.farmSetup.nitrogen, phosphorus: state.farmSetup.phosphorus,
                potassium: state.farmSetup.potassium,
                temperature: temp, humidity: hum, ph: 6.5, rainfall: rain
            });
        }
        
        setOTPStep(3, 'done');
        
        // Step 4: Show & Speak Result
        setOTPStep(4, 'active');
        
        let topCrop, score, scoreColor, trafficEmoji, cropIcon, resultHTML, speechText;
        let alternatives = [];
        let scoreExplanation = [];
        let estimatedYield = null;
        let confidence = 'Medium';
        
        if (quickData?.success) {
            // ── Custom Engine Result (instant, no LLM) ──
            const eng = quickData.recommendation;
            topCrop = eng.recommended_crop || 'Unknown crop';
            cropIcon = eng.crop_icon || '🌾';
            score = Math.round((eng.final_score || 0) * 10);
            confidence = eng.confidence || 'Medium';
            alternatives = (eng.alternatives || []).slice(0, 3);
            scoreExplanation = eng.score_explanation || [];
            estimatedYield = eng.estimated_yield;
            scoreColor = score >= 7 ? '#16a34a' : score >= 5 ? '#eab308' : '#dc2626';
            trafficEmoji = score >= 7 ? '🟢' : score >= 5 ? '🟡' : '🔴';
            
            resultHTML = buildVisualResultCard({
                topCrop, cropIcon, score, scoreColor, trafficEmoji, placeName, temp, hum,
                alternatives, scoreExplanation, estimatedYield, confidence,
                engineLabel: 'AgriSmart AI Engine ⚡',
                layerScores: eng.layer_scores,
                comparative: eng.comparative
            });
        } else {
            // ── Full LLM pipeline result ──
            topCrop = data.central_coordinator?.final_crop || 'Unknown crop';
            score = data.central_coordinator?.overall_score || 0;
            confidence = data.central_coordinator?.confidence_level || 'Medium';
            scoreColor = score >= 7 ? '#16a34a' : score >= 5 ? '#eab308' : '#dc2626';
            trafficEmoji = score >= 7 ? '🟢' : score >= 5 ? '🟡' : '🔴';
            cropIcon = data.custom_engine?.crop_icon || '🌾';
            alternatives = (data.custom_engine?.custom_alternatives || []).slice(0, 3);
            scoreExplanation = data.custom_engine?.score_explanation || [];
            estimatedYield = data.custom_engine?.estimated_yield;
            
            resultHTML = buildVisualResultCard({
                topCrop, cropIcon, score, scoreColor, trafficEmoji, placeName, temp, hum,
                alternatives, scoreExplanation, estimatedYield, confidence,
                engineLabel: '6 AI Agents + Custom Engine',
                layerScores: data.custom_engine?.layer_scores,
                comparative: data.custom_engine?.comparative
            });
            
            // Add agent advice cards (only in full pipeline)
            const agents = data.agents || {};
            if (agents.farmer_advisor?.advice) {
                resultHTML += `<div class="simple-advice-card"><span class="sac-icon">🚜</span><p>${agents.farmer_advisor.advice}</p></div>`;
            }
            if (agents.weather_analyst?.advice) {
                resultHTML += `<div class="simple-advice-card"><span class="sac-icon">🌤️</span><p>${agents.weather_analyst.advice}</p></div>`;
            }
        }
        
        if (resultEl) {
            resultEl.innerHTML = resultHTML;
            resultEl.style.display = '';
        }
        
        // Build speech text
        speechText = `Great news! Based on your location in ${placeName}, with temperature ${temp} degrees and ${hum} percent humidity, `;
        speechText += `our AI recommends growing ${topCrop}. The confidence score is ${score} out of 10. `;
        if (alternatives.length) {
            speechText += `You can also consider ${alternatives.map(a => a.crop || a.name).join(' or ')}. `;
        }
        if (estimatedYield) speechText += `Expected yield is about ${estimatedYield}. `;
        
        speakText(speechText);
        
        setOTPStep(4, 'done');
        
        // In simple mode, optionally fetch full LLM result in background to enhance
        if (quickData?.success && isSimple) {
            fetchAPI('/multi_agent_recommendation', {
                username: state.user?.username || 'anonymous',
                land_size: state.farmSetup.land_size,
                soil_type: soilType, crop_preference: cropPref,
                nitrogen: state.farmSetup.nitrogen, phosphorus: state.farmSetup.phosphorus,
                potassium: state.farmSetup.potassium,
                temperature: temp, humidity: hum, ph: 6.5, rainfall: rain
            }).then(fullData => {
                // Store for later but don't interrupt current display
                const rec = { ...fullData, timestamp: new Date().toISOString() };
                state.recommendations.unshift(rec);
                if (state.recommendations.length > 20) state.recommendations.pop();
                localStorage.setItem('agri_recommendations', JSON.stringify(state.recommendations));
            }).catch(() => {});
        }
        
        // Save recommendation (if not already saved by background fetch)
        if (data) {
            const rec = { ...data, timestamp: new Date().toISOString() };
            state.recommendations.unshift(rec);
            if (state.recommendations.length > 20) state.recommendations.pop();
            localStorage.setItem('agri_recommendations', JSON.stringify(state.recommendations));
        } else if (quickData?.success) {
            const rec = { quick_engine: quickData.recommendation, timestamp: new Date().toISOString() };
            state.recommendations.unshift(rec);
            if (state.recommendations.length > 20) state.recommendations.pop();
            localStorage.setItem('agri_recommendations', JSON.stringify(state.recommendations));
        }
        
    } catch (err) {
        const failStep = document.querySelector('.otp-step.active');
        if (failStep) failStep.className = 'otp-step error';
        
        let errorMsg = 'Something went wrong. Please try again.';
        if (err.code === 1) errorMsg = 'Please allow location access and try again.';
        if (resultEl) {
            resultEl.innerHTML = `<div class="one-tap-result-card" style="border-color:#ef4444"><div class="otr-traffic">❌</div><div class="otr-crop-name">${errorMsg}</div></div>`;
            resultEl.style.display = '';
        }
        autoSpeak(errorMsg);
    } finally {
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '<i class="fas fa-magic"></i> Tap Here!'; }
    }
}

// ═══════════════════════════════════════
//  VISUAL RESULT CARD BUILDER
// ═══════════════════════════════════════

function getCurrentSeason() {
    const m = new Date().getMonth();
    if (m >= 5 && m <= 9) return 'Kharif';
    if (m >= 10 || m <= 1) return 'Rabi';
    return 'Zaid';
}

function buildVisualResultCard(opts) {
    const { topCrop, cropIcon, score, scoreColor, trafficEmoji, placeName, temp, hum,
            alternatives, scoreExplanation, estimatedYield, confidence,
            engineLabel, layerScores, comparative } = opts;
    
    const confidenceColor = confidence === 'High' ? '#16a34a' : confidence === 'Medium' ? '#eab308' : '#ef4444';
    const confidenceIcon = confidence === 'High' ? '💪' : confidence === 'Medium' ? '👍' : '🤔';
    
    let html = `
        <div class="one-tap-result-card" style="border-color:${scoreColor}">
            <div class="otr-traffic">${trafficEmoji}</div>
            <div class="otr-crop-icon">${cropIcon}</div>
            <div class="otr-crop-name">${topCrop}</div>
            <div class="otr-score" style="color:${scoreColor}">${score}/10</div>
            <div class="otr-confidence" style="color:${confidenceColor}">${confidenceIcon} ${confidence} Confidence</div>
            <div class="otr-location">📍 ${placeName} | 🌡️ ${temp}° | 💧 ${hum}%</div>`;
    
    if (estimatedYield) {
        html += `<div class="otr-yield">🌾 Expected: ~${typeof estimatedYield === 'number' ? estimatedYield.toFixed(0) + ' kg/hectare' : estimatedYield}</div>`;
    }
    
    html += `<div class="otr-engine-badge">${engineLabel}</div>
        </div>`;
    
    // Score explanation with ✅/⚠️/❌ icons (visual for illiterate farmers)
    if (scoreExplanation?.length) {
        html += '<div class="score-explain-cards">';
        for (const line of scoreExplanation.slice(0, 5)) {
            const icon = line.includes('✅') ? '✅' : line.includes('⚠️') ? '⚠️' : line.includes('❌') ? '❌' : 'ℹ️';
            const cleanText = line.replace(/[✅⚠️❌]/g, '').trim();
            const bgClass = icon === '✅' ? 'explain-good' : icon === '⚠️' ? 'explain-warn' : icon === '❌' ? 'explain-bad' : 'explain-info';
            html += `<div class="score-explain-card ${bgClass}"><span class="sec-icon">${icon}</span><span>${cleanText}</span></div>`;
        }
        html += '</div>';
    }
    
    // Visual layer score bars (show how engine evaluated)
    if (layerScores) {
        html += '<div class="layer-score-bars">';
        const layerLabels = {
            agronomic: { icon: '🌱', label: 'Soil & Climate Match' },
            npk: { icon: '🧪', label: 'Fertilizer Match' },
            season: { icon: '📅', label: 'Season Match' },
            ml_model: { icon: '🤖', label: 'AI Model Score' },
            knowledge_base: { icon: '📚', label: 'Historical Data' }
        };
        for (const [key, val] of Object.entries(layerScores)) {
            const info = layerLabels[key] || { icon: '📊', label: key };
            const pct = Math.round((val || 0) * 100);
            const barColor = pct >= 70 ? '#16a34a' : pct >= 40 ? '#eab308' : '#ef4444';
            html += `<div class="layer-bar-row">
                <span class="lbr-icon">${info.icon}</span>
                <span class="lbr-label">${info.label}</span>
                <div class="lbr-track"><div class="lbr-fill" style="width:${pct}%;background:${barColor}"></div></div>
                <span class="lbr-pct">${pct}%</span>
            </div>`;
        }
        html += '</div>';
    }
    
    // Alternative crops as visual emoji cards
    if (alternatives?.length) {
        html += '<div class="alt-crops-section"><div class="alt-crops-title">🔄 Other Good Crops</div><div class="alt-crops-grid">';
        for (const alt of alternatives) {
            const altName = alt.crop || alt.name || 'Unknown';
            const altIcon = alt.icon || '🌾';
            const altScore = Math.round((alt.score || alt.final_score || 0) * 100);
            const altColor = altScore >= 70 ? '#16a34a' : altScore >= 40 ? '#eab308' : '#ef4444';
            html += `<div class="alt-crop-card">
                <div class="alt-crop-icon">${altIcon}</div>
                <div class="alt-crop-name">${altName}</div>
                <div class="alt-crop-score" style="color:${altColor}">${altScore}%</div>
            </div>`;
        }
        html += '</div></div>';
    }
    
    // ── Comparative Scoring Table — "Why this crop?" ──
    if (comparative) {
        html += buildComparativeSection(comparative, topCrop);
    }
    
    return html;
}

/**
 * Build the comparative scoring section showing all crops in the user's
 * preferred category + top overall, with visual bar charts.
 */
function buildComparativeSection(comparative, topCrop) {
    let html = '';
    
    // 1. Preferred category comparison
    const prefList = comparative.preferred_category || [];
    const prefName = comparative.preferred_category_name || '';
    if (prefList.length > 1) {
        html += `<div class="comparative-section">
            <div class="comp-header">
                <span class="comp-icon">📊</span>
                <span class="comp-title">Comparative Scores — ${prefName}</span>
            </div>
            <p class="comp-subtitle">Why <strong>${topCrop}</strong> ranks highest in your preferred category:</p>
            <div class="comp-table">`;
        
        for (const crop of prefList) {
            const isTop = crop.crop.toLowerCase() === topCrop.toLowerCase();
            const pct = Math.round(crop.score * 10);
            const barColor = isTop ? 'var(--gradient-primary)' : (pct >= 50 ? '#94a3b8' : '#e2e8f0');
            const textColor = isTop ? '#16a34a' : '#64748b';
            html += `<div class="comp-row ${isTop ? 'comp-row-top' : ''}">
                <span class="comp-crop-icon">${crop.icon}</span>
                <span class="comp-crop-name">${crop.crop}</span>
                <div class="comp-bar-track">
                    <div class="comp-bar-fill" style="width:${pct}%;background:${isTop ? 'linear-gradient(90deg,#16a34a,#0ea5e9)' : barColor}"></div>
                </div>
                <span class="comp-score" style="color:${textColor}">${crop.score.toFixed(1)}</span>
                <div class="comp-breakdown">
                    <span title="Soil & Climate">🌱${crop.agronomic.toFixed(1)}</span>
                    <span title="Season">📅${crop.season.toFixed(0)}</span>
                    <span title="AI Model">🤖${crop.ml.toFixed(1)}</span>
                    <span title="Historical Data">📚${crop.kb.toFixed(1)}</span>
                </div>
            </div>`;
        }
        html += '</div></div>';
    }
    
    // 2. Top overall comparison (across all categories)
    const topAll = comparative.top_overall || [];
    if (topAll.length > 1) {
        html += `<div class="comparative-section">
            <div class="comp-header">
                <span class="comp-icon">🏆</span>
                <span class="comp-title">Top Crops — All Categories</span>
            </div>
            <div class="comp-table comp-table-overall">`;
        
        for (let i = 0; i < topAll.length; i++) {
            const crop = topAll[i];
            const isTop = crop.crop.toLowerCase() === topCrop.toLowerCase();
            const pct = Math.round(crop.score * 10);
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
            html += `<div class="comp-row-mini ${isTop ? 'comp-row-top' : ''}">
                <span class="comp-rank">${medal}</span>
                <span class="comp-crop-icon">${crop.icon}</span>
                <span class="comp-crop-name">${crop.crop}</span>
                <span class="comp-cat-badge">${crop.category}</span>
                <div class="comp-bar-track">
                    <div class="comp-bar-fill" style="width:${pct}%;background:${isTop ? 'linear-gradient(90deg,#16a34a,#0ea5e9)' : '#cbd5e1'}"></div>
                </div>
                <span class="comp-score">${crop.score.toFixed(1)}</span>
            </div>`;
        }
        html += '</div></div>';
    }
    
    return html;
}

// ═══════════════════════════════════════
//  VISUAL CROP & SOIL PICKERS
// ═══════════════════════════════════════

function selectVisualCrop(crop, btn) {
    // Update visual selection
    document.querySelectorAll('.visual-crop-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    
    // Map visual crop to form value (category)
    const cropMapping = {
        'Rice': 'Grains', 'Wheat': 'Grains', 'Corn': 'Grains', 'Millet': 'Grains', 'Barley': 'Grains',
        'Tomato': 'Vegetables', 'Potato': 'Vegetables', 'Onion': 'Vegetables', 'Vegetables': 'Vegetables',
        'Cotton': 'Cash Crops', 'Sugarcane': 'Cash Crops', 'Jute': 'Cash Crops', 'Tea': 'Cash Crops', 'Coffee': 'Cash Crops',
        'Soybean': 'Pulses', 'Chickpea': 'Pulses', 'Lentil': 'Pulses',
        'Sunflower': 'Oilseeds', 'Mustard': 'Oilseeds', 'Sesame': 'Oilseeds', 'Groundnut': 'Oilseeds',
        'Turmeric': 'Spices',
        'Banana': 'Fruits', 'Fruits': 'Fruits'
    };
    const selectVal = cropMapping[crop] || 'Grains';
    document.getElementById('crop-preference').value = selectVal;
    
    // Store specific crop for recommendation
    state.selectedSpecificCrop = crop;
    
    autoSpeak('You selected ' + crop);
    toast(`Selected: ${crop} ✓`, 'success');
}

function selectVisualSoil(soil, btn) {
    document.querySelectorAll('.visual-soil-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('soil-type').value = soil;
    
    autoSpeak('You selected ' + soil + ' soil');
    toast(`Soil: ${soil} ✓`, 'success');
}

// ═══════════════════════════════════════
//  EMERGENCY PEST HELP
// ═══════════════════════════════════════

function emergencyPestHelp() {
    document.getElementById('emergency-modal').style.display = '';
    document.getElementById('emergency-result').style.display = 'none';
    document.getElementById('emergency-result').innerHTML = '';
    autoSpeak('Which crop needs help? Tap the picture of your crop.');
}

function closeEmergencyModal() {
    document.getElementById('emergency-modal').style.display = 'none';
    stopSpeaking();
}

async function runEmergencyPest(crop) {
    const resultEl = document.getElementById('emergency-result');
    resultEl.innerHTML = '<div style="text-align:center;padding:1rem"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#ef4444"></i><p>Checking pest danger...</p></div>';
    resultEl.style.display = '';
    
    autoSpeak('Checking pest danger for ' + crop + '...');
    
    try {
        const temp = state.farmSetup?.temperature || 25;
        const humidity = state.farmSetup?.humidity || 65;
        const rainfall = state.farmSetup?.rainfall || 500;
        const soil = state.farmSetup?.soil_type || 'Loamy';
        
        const data = await fetchAPI('/pest_prediction', {
            crop_type: crop, soil_type: soil,
            temperature: temp, humidity: humidity, rainfall: rainfall
        });
        
        const risk = (data.overall_risk || 'low').toLowerCase();
        const riskEmoji = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
        const riskLabel = risk === 'high' ? 'DANGER!' : risk === 'medium' ? 'Watch Out' : 'Safe';
        const riskColor = risk === 'high' ? '#ef4444' : risk === 'medium' ? '#eab308' : '#16a34a';
        
        let html = `<div class="emergency-result-card" style="border-color:${riskColor}">
            <div class="er-traffic">${riskEmoji}</div>
            <div class="er-label" style="color:${riskColor}">${riskLabel}</div>
            <div class="er-crop">${crop}</div>
        </div>`;
        
        // Show top pests visually
        if (data.predictions?.length) {
            html += '<div class="er-pests">';
            data.predictions.slice(0, 3).forEach(p => {
                const sev = (p.severity || 'low').toLowerCase();
                const icon = sev === 'high' ? '🔴' : sev === 'medium' ? '🟡' : '🟢';
                html += `<div class="er-pest-item"><span>${icon}</span><strong>${p.pest}</strong><span>${Math.round(p.probability * 100)}%</span></div>`;
            });
            html += '</div>';
        }
        
        // Prevention tips (first 2)
        if (data.prevention_tips?.length) {
            html += '<div class="er-tips">';
            data.prevention_tips.slice(0, 2).forEach(tip => {
                html += `<div class="er-tip">💡 ${tip}</div>`;
            });
            html += '</div>';
        }
        
        resultEl.innerHTML = html;
        
        // Speak the result
        let speech = `${riskLabel} for ${crop}! `;
        if (data.predictions?.length) {
            speech += 'Main pests: ' + data.predictions.slice(0, 2).map(p => p.pest).join(' and ') + '. ';
        }
        if (data.prevention_tips?.length) {
            speech += 'Tip: ' + data.prevention_tips[0];
        }
        speakText(speech);
        
    } catch (err) {
        resultEl.innerHTML = `<div class="emergency-result-card" style="border-color:#ef4444">
            <div class="er-traffic">❌</div><div class="er-label" style="color:#ef4444">Could not check. Try again.</div></div>`;
        autoSpeak('Could not check pest danger. Please try again.');
    }
}

// ═══════════════════════════════════════
//  AUDIO PAGE NARRATION
// ═══════════════════════════════════════

const pageNarrations = {
    'dashboard': 'simple.narrate.dashboard|Welcome to your farm dashboard. Tap the big green button to get AI advice, or tap the pictures below to navigate.',
    'farm-setup': 'simple.narrate.farmSetup|This is Farm Setup. First, tap Detect My Location. Then tap a crop picture to choose what you want to grow. Finally tap Save.',
    'recommendation': 'simple.narrate.recommendation|This page shows AI recommendations. Tap Generate Now to get crop advice from our AI experts.',
    'weather': 'simple.narrate.weather|This page shows weather for your farm. Tap Get Forecast to see the weather.',
    'pest-prediction': 'simple.narrate.pest|This page checks for pest and disease danger. Select your crop and tap Analyze.',
    'soil-analysis': 'simple.narrate.soil|Take a photo of your soil or tap a soil type to analyze it.',
    'community': 'simple.narrate.community|Share your farming data with other farmers and learn from them.'
};

function narratePage(pageId) {
    if (!document.body.classList.contains('simple-mode')) return;
    const entry = pageNarrations[pageId];
    if (!entry) return;
    const [, fallback] = entry.split('|');
    // Small delay so speech doesn't overlap with navigation
    setTimeout(() => speakText(fallback), 500);
}

// ═══════════════════════════════════════
//  HELPER: Get simple mode text
// ═══════════════════════════════════════
function getSimpleText(key, fallback) {
    // Try translations first, fall back to English
    if (typeof t === 'function') {
        const translated = t(key, state.language);
        if (translated && translated !== key) return translated;
    }
    return fallback;
}

// ═══════════════════════════════════════
//  WALKTHROUGH / ONBOARDING
// ═══════════════════════════════════════
const walkthroughSteps = [
    {
        illustration: 'farm',
        title: 'Welcome to AgriSmart AI!',
        desc: 'Your smart farming assistant powered by AI. Let us guide you through the app — it takes just 30 seconds!',
        color: '#16a34a'
    },
    {
        illustration: 'gps',
        title: 'Step 1: Detect Your Location',
        desc: 'Go to Farm Setup and tap "Detect My Location". We automatically get your weather, temperature, and rainfall — no typing needed!',
        color: '#0ea5e9'
    },
    {
        illustration: 'plant',
        title: 'Step 2: Tell Us About Fertilizer',
        desc: 'Just tap emoji buttons — None, Little, Medium, or A Lot — for each fertilizer type. Simple and quick!',
        color: '#f59e0b'
    },
    {
        illustration: 'ai',
        title: 'Step 3: Get AI Recommendations',
        desc: '5 AI agents analyze your data together — crop advisor, market researcher, weather analyst, sustainability expert, and coordinator. Watch them discuss!',
        color: '#8b5cf6'
    },
    {
        illustration: 'charts',
        title: 'Explore More Features',
        desc: 'Soil analysis from photos, pest prediction, weather alerts, community insights, crop rotation planner — all powered by AI for your farm!',
        color: '#ec4899'
    }
];
let walkthroughStep = 0;

function startWalkthrough() {
    walkthroughStep = 0;
    const overlay = document.getElementById('walkthrough-overlay');
    if (!overlay) return;
    overlay.style.display = '';
    renderWalkthroughStep();
}

function renderWalkthroughStep() {
    const step = walkthroughSteps[walkthroughStep];
    // Render animated SVG illustration
    const illustrationEl = document.getElementById('walkthrough-illustration');
    if (illustrationEl) {
        illustrationEl.innerHTML = getWalkthroughSVG(step.illustration, step.color);
    }
    document.getElementById('walkthrough-title').textContent = step.title;
    document.getElementById('walkthrough-desc').textContent = step.desc;
    // Auto-translate walkthrough text
    if (state.language !== 'en') {
        translateText(step.title, state.language).then(t => {
            document.getElementById('walkthrough-title').textContent = t;
        });
        translateText(step.desc, state.language).then(t => {
            document.getElementById('walkthrough-desc').textContent = t;
        });
    }
    const pct = ((walkthroughStep + 1) / walkthroughSteps.length) * 100;
    document.getElementById('walkthrough-progress-bar').style.width = pct + '%';
    document.getElementById('walkthrough-progress-bar').style.background = step.color;
    const dotsEl = document.getElementById('walkthrough-dots');
    dotsEl.innerHTML = walkthroughSteps.map((_, i) =>
        `<span class="wt-dot${i === walkthroughStep ? ' active' : ''}" style="${i === walkthroughStep ? 'background:' + step.color : ''}"></span>`
    ).join('');
    const nextBtn = document.getElementById('walkthrough-next');
    const btnText = walkthroughStep === walkthroughSteps.length - 1 ? "Let's Go! 🚀" : 'Next →';
    nextBtn.textContent = btnText;
    if (state.language !== 'en') {
        translateText(btnText, state.language).then(t => { nextBtn.textContent = t; });
    }
    const card = document.getElementById('walkthrough-card');
    card.classList.remove('animate-scale-in');
    void card.offsetWidth;
    card.classList.add('animate-scale-in');
}

function nextWalkthroughStep() {
    walkthroughStep++;
    if (walkthroughStep >= walkthroughSteps.length) {
        closeWalkthrough();
        return;
    }
    renderWalkthroughStep();
}

function closeWalkthrough() {
    const overlay = document.getElementById('walkthrough-overlay');
    if (overlay) overlay.style.display = 'none';
    localStorage.setItem('agri_walkthrough_done', '1');
}

// ═══════════════════════════════════════
//  ANIMATED SVG ILLUSTRATIONS
// ═══════════════════════════════════════
function getWalkthroughSVG(type, color) {
    const svgs = {
        farm: `<svg viewBox="0 0 200 200" width="140" height="140" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#87CEEB"/><stop offset="100%" stop-color="#E0F4FF"/></linearGradient>
            </defs>
            <rect width="200" height="200" rx="24" fill="url(#sky)"/>
            <!-- Sun -->
            <circle cx="160" cy="40" r="20" fill="#FDB813">
                <animate attributeName="r" values="18;22;18" dur="3s" repeatCount="indefinite"/>
            </circle>
            <g stroke="#FDB813" stroke-width="2" fill="none">
                <line x1="160" y1="10" x2="160" y2="6"><animate attributeName="y2" values="6;2;6" dur="3s" repeatCount="indefinite"/></line>
                <line x1="190" y1="40" x2="194" y2="40"><animate attributeName="x2" values="194;198;194" dur="3s" repeatCount="indefinite"/></line>
                <line x1="180" y1="20" x2="184" y2="16"><animate attributeName="x2" values="184;188;184" dur="3s" repeatCount="indefinite"/></line>
                <line x1="180" y1="60" x2="184" y2="64"><animate attributeName="x2" values="184;188;184" dur="3s" repeatCount="indefinite"/></line>
            </g>
            <!-- Ground -->
            <ellipse cx="100" cy="175" rx="90" ry="20" fill="#8B6914"/>
            <ellipse cx="100" cy="172" rx="88" ry="16" fill="#16a34a"/>
            <!-- Barn -->
            <rect x="30" y="105" width="50" height="55" rx="3" fill="#C23B22"/>
            <polygon points="30,105 55,80 80,105" fill="#8B2500"/>
            <rect x="48" y="130" width="14" height="30" rx="2" fill="#5C3317"/>
            <!-- Wheat stalks -->
            <g>
                <line x1="120" y1="155" x2="120" y2="110" stroke="#DAA520" stroke-width="2">
                    <animate attributeName="x2" values="118;122;118" dur="2.5s" repeatCount="indefinite"/>
                </line>
                <ellipse cx="120" cy="108" rx="4" ry="8" fill="#DAA520">
                    <animate attributeName="cx" values="118;122;118" dur="2.5s" repeatCount="indefinite"/>
                </ellipse>
            </g>
            <g>
                <line x1="140" y1="155" x2="140" y2="105" stroke="#DAA520" stroke-width="2">
                    <animate attributeName="x2" values="142;138;142" dur="2.8s" repeatCount="indefinite"/>
                </line>
                <ellipse cx="140" cy="103" rx="4" ry="8" fill="#DAA520">
                    <animate attributeName="cx" values="142;138;142" dur="2.8s" repeatCount="indefinite"/>
                </ellipse>
            </g>
            <g>
                <line x1="160" y1="155" x2="160" y2="112" stroke="#DAA520" stroke-width="2">
                    <animate attributeName="x2" values="158;162;158" dur="2.3s" repeatCount="indefinite"/>
                </line>
                <ellipse cx="160" cy="110" rx="4" ry="8" fill="#DAA520">
                    <animate attributeName="cx" values="158;162;158" dur="2.3s" repeatCount="indefinite"/>
                </ellipse>
            </g>
            <!-- Cloud -->
            <g opacity="0.8">
                <animateTransform attributeName="transform" type="translate" values="0,0;15,0;0,0" dur="8s" repeatCount="indefinite"/>
                <circle cx="50" cy="35" r="12" fill="white"/><circle cx="65" cy="30" r="16" fill="white"/><circle cx="80" cy="35" r="12" fill="white"/>
            </g>
        </svg>`,
        gps: `<svg viewBox="0 0 200 200" width="140" height="140" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" rx="24" fill="#EFF6FF"/>
            <!-- Map grid -->
            <g stroke="#CBD5E1" stroke-width="0.5" opacity="0.5">
                <line x1="40" y1="40" x2="40" y2="180"/><line x1="80" y1="40" x2="80" y2="180"/>
                <line x1="120" y1="40" x2="120" y2="180"/><line x1="160" y1="40" x2="160" y2="180"/>
                <line x1="20" y1="60" x2="180" y2="60"/><line x1="20" y1="100" x2="180" y2="100"/>
                <line x1="20" y1="140" x2="180" y2="140"/>
            </g>
            <!-- Location pin -->
            <g>
                <animateTransform attributeName="transform" type="translate" values="0,0;0,-8;0,0" dur="1.5s" repeatCount="indefinite"/>
                <path d="M100,60 C80,60 68,78 68,92 C68,115 100,145 100,145 C100,145 132,115 132,92 C132,78 120,60 100,60Z" fill="#0ea5e9"/>
                <circle cx="100" cy="90" r="12" fill="white"/>
                <circle cx="100" cy="90" r="5" fill="#0ea5e9"/>
            </g>
            <!-- Pulse rings -->
            <circle cx="100" cy="145" rx="1" fill="none" stroke="#0ea5e9" stroke-width="2">
                <animate attributeName="r" values="5;35;5" dur="2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="100" cy="145" fill="none" stroke="#0ea5e9" stroke-width="1.5">
                <animate attributeName="r" values="5;25;5" dur="2s" begin="0.5s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" begin="0.5s" repeatCount="indefinite"/>
            </circle>
            <!-- Satellite -->
            <g>
                <animateTransform attributeName="transform" type="rotate" values="0 100 50;360 100 50" dur="6s" repeatCount="indefinite"/>
                <rect x="140" y="45" width="12" height="8" rx="2" fill="#64748B"/>
                <rect x="134" y="47" width="6" height="4" fill="#0EA5E9"/>
                <rect x="152" y="47" width="6" height="4" fill="#0EA5E9"/>
            </g>
        </svg>`,
        plant: `<svg viewBox="0 0 200 200" width="140" height="140" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" rx="24" fill="#FFFBEB"/>
            <!-- Pot -->
            <path d="M65,145 L75,180 L125,180 L135,145 Z" fill="#D97706"/>
            <rect x="60" y="138" width="80" height="12" rx="4" fill="#F59E0B"/>
            <!-- Soil -->
            <ellipse cx="100" cy="145" rx="30" ry="5" fill="#92400E"/>
            <!-- Plant stem -->
            <path d="M100,140 Q100,90 100,70" stroke="#16a34a" stroke-width="3" fill="none">
                <animate attributeName="d" values="M100,140 Q100,90 100,80;M100,140 Q100,90 100,65;M100,140 Q100,90 100,80" dur="3s" repeatCount="indefinite"/>
            </path>
            <!-- Leaves -->
            <g>
                <animateTransform attributeName="transform" type="rotate" values="-5 100 100;5 100 100;-5 100 100" dur="3s" repeatCount="indefinite"/>
                <ellipse cx="80" cy="95" rx="18" ry="8" fill="#22c55e" transform="rotate(-30 80 95)"/>
                <ellipse cx="120" cy="90" rx="18" ry="8" fill="#16a34a" transform="rotate(25 120 90)"/>
                <ellipse cx="85" cy="75" rx="14" ry="6" fill="#4ade80" transform="rotate(-20 85 75)"/>
                <ellipse cx="115" cy="72" rx="14" ry="6" fill="#22c55e" transform="rotate(15 115 72)"/>
            </g>
            <!-- Sparkles -->
            <g fill="#F59E0B">
                <circle cx="60" cy="60" r="3"><animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/></circle>
                <circle cx="145" cy="55" r="2"><animate attributeName="opacity" values="0;1;0" dur="2.5s" begin="0.5s" repeatCount="indefinite"/></circle>
                <circle cx="50" cy="95" r="2"><animate attributeName="opacity" values="0;1;0" dur="1.8s" begin="1s" repeatCount="indefinite"/></circle>
                <circle cx="155" cy="100" r="3"><animate attributeName="opacity" values="0;1;0" dur="2.2s" begin="0.3s" repeatCount="indefinite"/></circle>
            </g>
            <!-- Water drops -->
            <g fill="#38BDF8">
                <circle cx="75" cy="125" r="2.5">
                    <animate attributeName="cy" values="115;135;115" dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite"/>
                </circle>
                <circle cx="125" cy="120" r="2">
                    <animate attributeName="cy" values="110;130;110" dur="2.3s" begin="0.5s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="1;0;1" dur="2.3s" begin="0.5s" repeatCount="indefinite"/>
                </circle>
            </g>
        </svg>`,
        ai: `<svg viewBox="0 0 200 200" width="140" height="140" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" rx="24" fill="#F5F3FF"/>
            <!-- Brain outline -->
            <g transform="translate(55,35)" fill="none" stroke="#8b5cf6" stroke-width="2.5">
                <path d="M45,0 C65,0 80,15 80,30 C80,40 75,48 68,53 C72,58 75,65 75,73 C75,90 60,100 45,100 C30,100 15,90 15,73 C15,65 18,58 22,53 C15,48 10,40 10,30 C10,15 25,0 45,0Z">
                    <animate attributeName="stroke-dasharray" values="0 350;350 0" dur="2s" fill="freeze"/>
                </path>
                <!-- Center line -->
                <line x1="45" y1="10" x2="45" y2="90" stroke-dasharray="3 5">
                    <animate attributeName="stroke-dashoffset" values="0;-16" dur="1s" repeatCount="indefinite"/>
                </line>
                <!-- Neural connections -->
                <circle cx="30" cy="35" r="4" fill="#8b5cf6"><animate attributeName="fill-opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite"/></circle>
                <circle cx="60" cy="35" r="4" fill="#8b5cf6"><animate attributeName="fill-opacity" values="0.3;1;0.3" dur="1.5s" begin="0.3s" repeatCount="indefinite"/></circle>
                <circle cx="25" cy="60" r="4" fill="#8b5cf6"><animate attributeName="fill-opacity" values="0.3;1;0.3" dur="1.5s" begin="0.6s" repeatCount="indefinite"/></circle>
                <circle cx="65" cy="60" r="4" fill="#8b5cf6"><animate attributeName="fill-opacity" values="0.3;1;0.3" dur="1.5s" begin="0.9s" repeatCount="indefinite"/></circle>
                <circle cx="45" cy="50" r="5" fill="#8b5cf6"><animate attributeName="fill-opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite"/></circle>
                <!-- Firing synapses -->
                <line x1="30" y1="35" x2="45" y2="50" stroke-width="1.5"><animate attributeName="stroke-opacity" values="0.2;1;0.2" dur="1.5s" repeatCount="indefinite"/></line>
                <line x1="60" y1="35" x2="45" y2="50" stroke-width="1.5"><animate attributeName="stroke-opacity" values="0.2;1;0.2" dur="1.5s" begin="0.3s" repeatCount="indefinite"/></line>
                <line x1="25" y1="60" x2="45" y2="50" stroke-width="1.5"><animate attributeName="stroke-opacity" values="0.2;1;0.2" dur="1.5s" begin="0.6s" repeatCount="indefinite"/></line>
                <line x1="65" y1="60" x2="45" y2="50" stroke-width="1.5"><animate attributeName="stroke-opacity" values="0.2;1;0.2" dur="1.5s" begin="0.9s" repeatCount="indefinite"/></line>
            </g>
            <!-- Orbiting dots -->
            <g>
                <circle cx="100" cy="25" r="4" fill="#EC4899">
                    <animateTransform attributeName="transform" type="rotate" values="0 100 100;360 100 100" dur="4s" repeatCount="indefinite"/>
                </circle>
            </g>
            <g>
                <circle cx="175" cy="100" r="3" fill="#F59E0B">
                    <animateTransform attributeName="transform" type="rotate" values="120 100 100;480 100 100" dur="5s" repeatCount="indefinite"/>
                </circle>
            </g>
        </svg>`,
        charts: `<svg viewBox="0 0 200 200" width="140" height="140" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" rx="24" fill="#FDF2F8"/>
            <!-- Chart axes -->
            <line x1="35" y1="30" x2="35" y2="160" stroke="#CBD5E1" stroke-width="2"/>
            <line x1="35" y1="160" x2="175" y2="160" stroke="#CBD5E1" stroke-width="2"/>
            <!-- Bars growing up -->
            <rect x="50" y="160" width="20" height="0" rx="3" fill="#16a34a">
                <animate attributeName="height" values="0;90;90" dur="1s" fill="freeze"/>
                <animate attributeName="y" values="160;70;70" dur="1s" fill="freeze"/>
            </rect>
            <rect x="80" y="160" width="20" height="0" rx="3" fill="#0ea5e9">
                <animate attributeName="height" values="0;60;60" dur="1s" begin="0.2s" fill="freeze"/>
                <animate attributeName="y" values="160;100;100" dur="1s" begin="0.2s" fill="freeze"/>
            </rect>
            <rect x="110" y="160" width="20" height="0" rx="3" fill="#f59e0b">
                <animate attributeName="height" values="0;110;110" dur="1s" begin="0.4s" fill="freeze"/>
                <animate attributeName="y" values="160;50;50" dur="1s" begin="0.4s" fill="freeze"/>
            </rect>
            <rect x="140" y="160" width="20" height="0" rx="3" fill="#ec4899">
                <animate attributeName="height" values="0;75;75" dur="1s" begin="0.6s" fill="freeze"/>
                <animate attributeName="y" values="160;85;85" dur="1s" begin="0.6s" fill="freeze"/>
            </rect>
            <!-- Trend line -->
            <polyline points="60,70 90,100 120,50 150,85" fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="200" stroke-dashoffset="200">
                <animate attributeName="stroke-dashoffset" values="200;0" dur="1.5s" begin="0.8s" fill="freeze"/>
            </polyline>
            <!-- Dots on trend -->
            <circle cx="60" cy="70" r="4" fill="#8b5cf6" opacity="0"><animate attributeName="opacity" values="0;1" dur="0.3s" begin="1.5s" fill="freeze"/></circle>
            <circle cx="90" cy="100" r="4" fill="#8b5cf6" opacity="0"><animate attributeName="opacity" values="0;1" dur="0.3s" begin="1.7s" fill="freeze"/></circle>
            <circle cx="120" cy="50" r="4" fill="#8b5cf6" opacity="0"><animate attributeName="opacity" values="0;1" dur="0.3s" begin="1.9s" fill="freeze"/></circle>
            <circle cx="150" cy="85" r="4" fill="#8b5cf6" opacity="0"><animate attributeName="opacity" values="0;1" dur="0.3s" begin="2.1s" fill="freeze"/></circle>
            <!-- Sparkle -->
            <circle cx="120" cy="45" r="3" fill="#F59E0B" opacity="0">
                <animate attributeName="opacity" values="0;1;0" dur="1.5s" begin="2s" repeatCount="indefinite"/>
                <animate attributeName="r" values="2;4;2" dur="1.5s" begin="2s" repeatCount="indefinite"/>
            </circle>
        </svg>`
    };
    return svgs[type] || `<div style="font-size:3.5rem">🌾</div>`;
}

// ═══════════════════════════════════════
// (confetti removed — not appropriate for farmer-focused app)
// ═══════════════════════════════════════

// ═══════════════════════════════════════
//  ANIMATED COUNTER (count-up effect)
// ═══════════════════════════════════════
function animateCounter(element, target, duration = 1200, suffix = '') {
    const start = 0;
    const startTime = performance.now();
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (target - start) * eased);
        element.textContent = current + suffix;
        if (progress < 1) requestAnimationFrame(updateCounter);
    }
    requestAnimationFrame(updateCounter);
}

// ═══════════════════════════════════════
//  RIPPLE EFFECT ON BUTTONS
// ═══════════════════════════════════════
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    const rect = btn.getBoundingClientRect();
    ripple.style.left = (e.clientX - rect.left) + 'px';
    ripple.style.top = (e.clientY - rect.top) + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
});

// ═══════════════════════════════════════
//  INTERSECTION OBSERVER — ANIMATE ON SCROLL
// ═══════════════════════════════════════
const scrollAnimObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-visible');
            scrollAnimObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.card, .feature-guide, .empty-state').forEach(el => {
        el.classList.add('animate-on-scroll');
        scrollAnimObserver.observe(el);
    });
    // Init draggable SOS button
    initDraggableSOS();
});

// ═══════════════════════════════════════
//  SKELETON LOADING HELPER
// ═══════════════════════════════════════
function showSkeleton(containerId, rows = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let skeletonHTML = '<div class="skeleton-loader">';
    for (let i = 0; i < rows; i++) {
        const w = 60 + Math.random() * 35;
        skeletonHTML += `<div class="skeleton-line" style="width:${w}%;animation-delay:${i*0.1}s"></div>`;
    }
    skeletonHTML += '</div>';
    container.innerHTML = skeletonHTML;
}

function hideSkeleton(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const sk = container.querySelector('.skeleton-loader');
    if (sk) sk.remove();
}

// ═══════════════════════════════════════
//  TYPING ANIMATION (for AI responses)
// ═══════════════════════════════════════
function typeText(element, text, speed = 15) {
    return new Promise(resolve => {
        let i = 0;
        element.textContent = '';
        element.style.visibility = 'visible';
        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            } else {
                resolve();
            }
        }
        type();
    });
}

// ═══════════════════════════════════════
//  AUTH — Simplified for Farmers (Voice + Manual)
// ═══════════════════════════════════════

// ── Auth Language Selection (Step 1) ──
function selectAuthLanguage(lang) {
    state.language = lang;
    localStorage.setItem('agri_lang', lang);
    // Update app-wide language
    const labels = { en: 'EN', hi: 'हि', kn: 'ಕ', te: 'తె', ta: 'த', ml: 'മ', bn: 'বা', gu: 'ગુ', mr: 'म', pa: 'ਪ', or: 'ଓ' };
    const langLbl = document.getElementById('lang-label');
    if (langLbl) langLbl.textContent = labels[lang] || lang.toUpperCase();
    applyTranslations(lang);
    // Hide language picker, show method picker
    document.getElementById('auth-lang-picker').style.display = 'none';
    document.getElementById('auth-method-picker').style.display = 'flex';
    // Translate the method picker UI dynamically
    translateAuthUI(lang);
    // Voice greeting in selected language
    const greetings = {
        en: 'Welcome! Choose typing or speaking to continue.',
        hi: 'स्वागत है! आगे बढ़ने के लिए टाइपिंग या बोलना चुनें।',
        te: 'స్వాగతం! కొనసాగించడానికి టైపింగ్ లేదా మాట్లాడడం ఎంచుకోండి.',
        kn: 'ಸ್ವಾಗತ! ಮುಂದುವರಿಸಲು ಟೈಪಿಂಗ್ ಅಥವಾ ಮಾತನಾಡುವುದನ್ನು ಆಯ್ಕೆಮಾಡಿ.',
        ta: 'வரவேற்கிறோம்! தொடர தட்டச்சு அல்லது பேச்சை தேர்வு செய்யவும்.',
        ml: 'സ്വാഗതം! തുടരാൻ ടൈപ്പിംഗ് അല്ലെങ്കിൽ സംസാരിക്കുക തിരഞ്ഞെടുക്കുക.',
        bn: 'স্বাগতম! টাইপিং বা কথা বলা চালিয়ে যান।',
        gu: 'સ્વાગત છે! આગળ વધવા ટાઈપિંગ અથવા બોલવાનું પસંદ કરો.',
        mr: 'स्वागत! पुढे जाण्यासाठी टायपिंग किंवा बोलणे निवडा.',
        pa: 'ਜੀ ਆਇਆਂ ਨੂੰ! ਅੱਗੇ ਵਧਣ ਲਈ ਟਾਈਪਿੰਗ ਜਾਂ ਬੋਲਣਾ ਚੁਣੋ।',
        or: 'ସ୍ୱାଗତ! ଆଗକୁ ବଢ଼ିବା ପାଇଁ ଟାଇପିଂ କିମ୍ବା କହିବା ବାଛନ୍ତୁ।'
    };
    speakText(greetings[lang] || greetings.en, lang);
}

// ── Translate auth UI elements dynamically ──
async function translateAuthUI(lang) {
    if (lang === 'en') return;
    const elements = {
        'auth-method-title': 'How would you like to continue?',
        'auth-method-sub': 'Choose typing or speaking',
        'auth-method-manual-label': 'Type (Manual)',
        'auth-method-manual-desc': 'Fill form by typing',
        'auth-method-voice-label': 'Speak (Voice)',
        'auth-method-voice-desc': 'Just say your name',
        'auth-simple-title': 'Welcome to AgriSmart',
        'tab-signup-label': 'New Farmer',
        'tab-login-label': 'Existing Farmer',
        'signup-name-label': 'Your Name',
        'signup-phone-label': 'Phone Number',
        'signup-submit-label': 'Start Farming',
        'login-name-label': 'Your Name',
        'login-submit-label': 'Continue',
        'voice-auth-status': 'Listening...',
        'voice-auth-prompt': 'Please say your name clearly',
        'voice-confirm-label': 'Yes, that is me',
        'voice-retry-label': 'Try again'
    };
    const texts = Object.values(elements);
    const ids = Object.keys(elements);
    try {
        const res = await fetch(`${API}/api/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts, target: lang, source: 'en' })
        });
        const data = await res.json();
        if (data.translations) {
            data.translations.forEach((t, i) => {
                const el = document.getElementById(ids[i]);
                if (el) el.textContent = t;
            });
        }
    } catch (e) { /* fallback to English */ }
    // Translate placeholders
    const placeholders = [
        { id: 'signup-name', text: 'Enter your name' },
        { id: 'signup-phone', text: 'Phone number' },
        { id: 'login-name', text: 'Enter your name' }
    ];
    try {
        const res2 = await fetch(`${API}/api/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: placeholders.map(p => p.text), target: lang, source: 'en' })
        });
        const data2 = await res2.json();
        if (data2.translations) {
            data2.translations.forEach((t, i) => {
                const el = document.getElementById(placeholders[i].id);
                if (el) el.placeholder = t;
            });
        }
    } catch (e) { /* ok */ }
}

// ── Show Manual Auth ──
function showManualAuth() {
    document.getElementById('auth-method-picker').style.display = 'none';
    document.getElementById('auth-simple-form').style.display = 'flex';
    translateAuthUI(state.language);
}

function goBackToMethodPicker() {
    document.getElementById('auth-simple-form').style.display = 'none';
    document.getElementById('voice-auth-overlay').style.display = 'none';
    document.getElementById('face-auth-overlay').style.display = 'none';
    stopFaceCamera();
    _faceAuthContext = null;
    document.getElementById('auth-method-picker').style.display = 'flex';
}

// ── Voice Auth Flow ──
let voiceAuthName = '';
function startVoiceAuth() {
    document.getElementById('auth-method-picker').style.display = 'none';
    document.getElementById('voice-auth-overlay').style.display = 'flex';
    document.getElementById('voice-auth-result').style.display = 'none';
    voiceAuthName = '';
    // Speak prompt in selected language
    const prompts = {
        en: 'Please say your name clearly',
        hi: 'कृपया अपना नाम स्पष्ट रूप से बोलें',
        te: 'దయచేసి మీ పేరు స్పష్టంగా చెప్పండి',
        kn: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಿ',
        ta: 'தயவுசெய்து உங்கள் பெயரை தெளிவாக சொல்லுங்கள்',
        ml: 'ദയവായി നിങ്ങളുടെ പേര് വ്യക്തമായി പറയുക',
        bn: 'অনুগ্রহ করে আপনার নাম স্পষ্টভাবে বলুন',
        gu: 'કૃપા કરીને તમારું નામ સ્પષ્ટ રીતે બોલો',
        mr: 'कृपया तुमचे नाव स्पष्टपणे सांगा',
        pa: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਨਾਮ ਸਾਫ਼ ਬੋਲੋ',
        or: 'ଦୟାକରି ଆପଣଙ୍କ ନାମ ସ୍ପଷ୍ଟ ଭାବରେ କୁହନ୍ତୁ'
    };
    setTimeout(() => speakText(prompts[state.language] || prompts.en, state.language), 300);
    // Start listening
    setTimeout(() => listenForVoiceAuth(), 1500);
}

function listenForVoiceAuth() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        toast('Voice not supported in this browser', 'error');
        cancelVoiceAuth();
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    const langMap = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN', te: 'te-IN', ta: 'ta-IN', ml: 'ml-IN', bn: 'bn-IN', gu: 'gu-IN', mr: 'mr-IN', pa: 'pa-IN', or: 'or-IN' };
    recognition.lang = langMap[state.language] || 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const statusEl = document.getElementById('voice-auth-status');
    const animEl = document.getElementById('voice-auth-anim');
    if (statusEl) statusEl.style.color = '#16a34a';
    if (animEl) animEl.classList.add('listening');

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        voiceAuthName = transcript;
        if (animEl) animEl.classList.remove('listening');
        // Show result for confirmation
        const resultDiv = document.getElementById('voice-auth-result');
        const heardEl = document.getElementById('voice-auth-heard');
        if (heardEl) heardEl.textContent = `"${transcript}"`;
        if (resultDiv) resultDiv.style.display = 'block';
        // Speak back for confirmation
        const confirmMsg = {
            en: `I heard ${transcript}. Is that correct?`,
            hi: `मैंने सुना ${transcript}। क्या यह सही है?`,
            te: `నేను ${transcript} అని విన్నాను. ఇది సరైనదా?`,
            kn: `ನಾನು ${transcript} ಎಂದು ಕೇಳಿದೆ. ಇದು ಸರಿಯೇ?`,
            ta: `${transcript} என்று கேட்டேன். இது சரியா?`,
            ml: `${transcript} എന്ന് കേട്ടു. ശരിയാണോ?`,
            bn: `${transcript} শুনেছি। এটি কি ঠিক?`,
            gu: `${transcript} સાંભળ્યું. શું આ સાચું છે?`,
            mr: `${transcript} ऐकले. हे बरोबर आहे का?`,
            pa: `${transcript} ਸੁਣਿਆ। ਕੀ ਇਹ ਸਹੀ ਹੈ?`,
            or: `${transcript} ଶୁଣିଲି। ଏହା ଠିକ୍ କି?`
        };
        speakText(confirmMsg[state.language] || confirmMsg.en, state.language);
    };

    recognition.onerror = () => {
        if (animEl) animEl.classList.remove('listening');
        const retryMsg = {
            en: 'Could not hear clearly. Please try again.',
            hi: 'स्पष्ट सुनाई नहीं दिया। कृपया फिर से कोशिश करें।',
            te: 'స్పష్టంగా వినలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.',
            kn: 'ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಲಿಲ್ಲ. ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.'
        };
        speakText(retryMsg[state.language] || retryMsg.en, state.language);
    };

    recognition.start();
}

function confirmVoiceAuth() {
    if (!voiceAuthName) return;
    // Launch face verification after voice name confirmation
    document.getElementById('voice-auth-overlay').style.display = 'none';
    window.speechSynthesis?.cancel();
    startFaceAuthVerification({ mode: 'voice-auto', username: voiceAuthName, source: 'voice' });
}

function retryVoiceAuth() {
    document.getElementById('voice-auth-result').style.display = 'none';
    voiceAuthName = '';
    listenForVoiceAuth();
}

function cancelVoiceAuth() {
    document.getElementById('voice-auth-overlay').style.display = 'none';
    document.getElementById('auth-method-picker').style.display = 'flex';
    window.speechSynthesis?.cancel();
}

async function doVoiceSignupLogin(name) {
    // Redirect through face verification
    startFaceAuthVerification({ mode: 'voice-auto', username: name, source: 'voice' });
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === `${tab}-form`));
}

async function handleSignup(e) {
    e.preventDefault();
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');

    const username = document.getElementById('signup-name').value.trim();
    const phone = document.getElementById('signup-phone')?.value.trim() || '';

    if (!username) {
        const errEl = document.getElementById('signup-name-error');
        if (errEl) errEl.textContent = 'Name is required';
        return;
    }

    // Launch face verification as confirmation step
    document.getElementById('auth-simple-form').style.display = 'none';
    startFaceAuthVerification({ mode: 'signup', username, phone, source: 'manual' });
}

async function handleLogin(e) {
    e.preventDefault();
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');

    const username = document.getElementById('login-name').value.trim();
    if (!username) {
        const errEl = document.getElementById('login-name-error');
        if (errEl) errEl.textContent = 'Name is required';
        return;
    }

    // Launch face verification as confirmation step
    document.getElementById('auth-simple-form').style.display = 'none';
    startFaceAuthVerification({ mode: 'login', username, source: 'manual' });
}

function restoreSession() {
    const saved = localStorage.getItem('agri_user');
    if (saved) {
        state.user = JSON.parse(saved);
        enterApp();
    }
    const savedSetup = localStorage.getItem('agri_farm_setup');
    if (savedSetup) state.farmSetup = JSON.parse(savedSetup);
    const savedRecs = localStorage.getItem('agri_recommendations');
    if (savedRecs) state.recommendations = JSON.parse(savedRecs);
}

function enterApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = 'flex';
    updateSidebarProfile();
    updateHeaderProfile();
    updateDashboard();
    loadDashboardWeather();
    navigate('dashboard');
    // Apply dynamic translation to entire app after entering
    dynamicTranslateApp(state.language);
    // Start auto-translating dynamic content
    startTranslationObserver();
}

// ═══════════════════════════════════════
//  VOICE-FILL FOR ANY INPUT FIELD
// ═══════════════════════════════════════
function voiceFillField(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        toast('Voice not supported', 'error');
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    const langMap = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN', te: 'te-IN', ta: 'ta-IN', ml: 'ml-IN', bn: 'bn-IN', gu: 'gu-IN', mr: 'mr-IN', pa: 'pa-IN', or: 'or-IN' };
    recognition.lang = langMap[state.language] || 'en-IN';
    recognition.interimResults = false;

    // Visual feedback
    const btn = field.parentElement?.querySelector('.voice-fill-btn');
    if (btn) { btn.classList.add('recording'); btn.innerHTML = '<i class="fas fa-circle" style="color:#ef4444;animation:pulse 0.8s infinite"></i>'; }

    recognition.onresult = (event) => {
        let transcript = event.results[0][0].transcript.trim();
        // For phone fields, extract digits
        if (field.type === 'tel' || fieldId.includes('phone')) {
            const digits = transcript.replace(/[^\d+]/g, '');
            if (digits) transcript = digits;
        }
        field.value = transcript;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        if (btn) { btn.classList.remove('recording'); btn.innerHTML = '<i class="fas fa-microphone"></i>'; }
        speakText(transcript, state.language);
    };

    recognition.onerror = () => {
        if (btn) { btn.classList.remove('recording'); btn.innerHTML = '<i class="fas fa-microphone"></i>'; }
        toast('Could not hear. Try again.', 'error');
    };

    recognition.onend = () => {
        if (btn) { btn.classList.remove('recording'); btn.innerHTML = '<i class="fas fa-microphone"></i>'; }
    };

    recognition.start();
}

// ═══════════════════════════════════════
//  DYNAMIC TRANSLATION — deep-translator API
// ═══════════════════════════════════════
let _translateCache = {};
let _translationObserver = null;

// Helper: set text on an element and auto-translate it
function setText(el, text) {
    if (!el) return;
    el.textContent = text;
    if (state.language !== 'en' && _isTranslatableText(text)) {
        translateText(text, state.language).then(t => { if (el) el.textContent = t; });
    }
}

// Helper: set innerHTML on an element and auto-translate all text nodes inside it
function setHtml(el, html) {
    if (!el) return;
    el.innerHTML = html;
    if (state.language !== 'en') {
        // Small delay to let DOM settle, then translate all text inside
        setTimeout(() => _translateAllTextIn(el, state.language), 50);
    }
}

// Translate all text nodes within a given element
async function _translateAllTextIn(root, lang) {
    if (!root || lang === 'en') return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const tag = parent.tagName;
            if (['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE'].includes(tag)) return NodeFilter.FILTER_REJECT;
            if (_isTranslatableText(node.textContent.trim())) return NodeFilter.FILTER_ACCEPT;
            return NodeFilter.FILTER_REJECT;
        }
    });
    const nodes = [], texts = [];
    while (walker.nextNode()) {
        const t = walker.currentNode.textContent.trim();
        const ck = `${lang}:${t}`;
        if (_translateCache[ck]) {
            walker.currentNode.textContent = walker.currentNode.textContent.replace(t, _translateCache[ck]);
        } else {
            nodes.push(walker.currentNode);
            texts.push(t);
        }
    }
    if (texts.length === 0) return;
    // Batch translate
    for (let i = 0; i < texts.length; i += 50) {
        const batch = texts.slice(i, i + 50);
        try {
            const res = await fetch(`${API}/api/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts: batch, target: lang, source: 'en' })
            });
            const data = await res.json();
            const translated = data.translations || batch;
            for (let j = 0; j < batch.length; j++) {
                const idx = i + j;
                _translateCache[`${lang}:${texts[idx]}`] = translated[j];
                if (nodes[idx]) nodes[idx].textContent = nodes[idx].textContent.replace(texts[idx], translated[j]);
            }
        } catch { /* fallback */ }
    }
}

function _isTranslatableText(text) {
    if (!text || text.length < 2 || text.length > 1000) return false;
    // Must contain at least one Latin letter (English)
    if (!/[a-zA-Z]/.test(text)) return false;
    // Skip pure numbers, emojis-only, or single chars
    if (/^\d+[\.\,%°]?\s*$/.test(text)) return false;
    // Skip if already in non-Latin script (already translated)
    if (/[\u0900-\u0D7F]/.test(text) && !/[a-zA-Z]{3,}/.test(text)) return false;
    return true;
}

async function dynamicTranslateApp(lang) {
    if (lang === 'en') return;
    const appShell = document.getElementById('app-shell') || document.body;

    // Phase 1: TreeWalker for ALL text nodes in the DOM
    const walker = document.createTreeWalker(appShell, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const tag = parent.tagName;
            // Skip script, style, textarea, code, pre
            if (['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT'].includes(tag)) return NodeFilter.FILTER_REJECT;
            // Skip language menu and hidden inputs
            if (parent.closest('.lang-float-menu, .lang-grid')) return NodeFilter.FILTER_REJECT;
            const text = node.textContent.trim();
            if (_isTranslatableText(text)) return NodeFilter.FILTER_ACCEPT;
            return NodeFilter.FILTER_REJECT;
        }
    });

    const textNodes = [];
    const textsToTranslate = [];
    while (walker.nextNode()) {
        const text = walker.currentNode.textContent.trim();
        const cacheKey = `${lang}:${text}`;
        if (_translateCache[cacheKey]) {
            walker.currentNode.textContent = walker.currentNode.textContent.replace(text, _translateCache[cacheKey]);
        } else {
            textNodes.push(walker.currentNode);
            textsToTranslate.push(text);
        }
    }

    // Phase 2: Translate placeholders
    const inputEls = appShell.querySelectorAll('input[placeholder], textarea[placeholder]');
    const placeholderTexts = [];
    const placeholderEls = [];
    inputEls.forEach(el => {
        const ph = el.placeholder.trim();
        if (_isTranslatableText(ph)) {
            const cacheKey = `${lang}:ph:${ph}`;
            if (_translateCache[cacheKey]) {
                el.placeholder = _translateCache[cacheKey];
            } else {
                placeholderTexts.push(ph);
                placeholderEls.push(el);
            }
        }
    });

    // Phase 3: Translate select options
    const optionEls = appShell.querySelectorAll('select option');
    const optionTexts = [];
    const optionNodes = [];
    optionEls.forEach(el => {
        const text = el.textContent.trim();
        if (_isTranslatableText(text)) {
            const cacheKey = `${lang}:${text}`;
            if (_translateCache[cacheKey]) {
                el.textContent = _translateCache[cacheKey];
            } else {
                optionTexts.push(text);
                optionNodes.push(el);
            }
        }
    });

    // Phase 4: Translate title and aria-label attributes
    const titledEls = appShell.querySelectorAll('[title], [aria-label]');
    const attrTexts = [];
    const attrEntries = []; // { el, attr }
    titledEls.forEach(el => {
        ['title', 'aria-label'].forEach(attr => {
            const val = el.getAttribute(attr);
            if (val && _isTranslatableText(val)) {
                const cacheKey = `${lang}:attr:${val}`;
                if (_translateCache[cacheKey]) {
                    el.setAttribute(attr, _translateCache[cacheKey]);
                } else {
                    attrTexts.push(val);
                    attrEntries.push({ el, attr });
                }
            }
        });
    });

    // Combine all texts for batch API calls
    const allTexts = [...textsToTranslate, ...placeholderTexts, ...optionTexts, ...attrTexts];
    if (allTexts.length === 0) return;

    // Batch translate (max 50 at a time)
    const allTranslated = [];
    for (let i = 0; i < allTexts.length; i += 50) {
        const batch = allTexts.slice(i, i + 50);
        try {
            const res = await fetch(`${API}/api/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts: batch, target: lang, source: 'en' })
            });
            const data = await res.json();
            if (data.translations) {
                allTranslated.push(...data.translations);
            } else {
                allTranslated.push(...batch); // fallback
            }
        } catch {
            allTranslated.push(...batch);
        }
    }

    // Apply translations to respective targets
    let idx = 0;
    // Text nodes
    for (let i = 0; i < textsToTranslate.length; i++) {
        const original = textsToTranslate[i];
        const translated = allTranslated[idx++];
        _translateCache[`${lang}:${original}`] = translated;
        if (textNodes[i]) textNodes[i].textContent = textNodes[i].textContent.replace(original, translated);
    }
    // Placeholders
    for (let i = 0; i < placeholderTexts.length; i++) {
        const original = placeholderTexts[i];
        const translated = allTranslated[idx++];
        _translateCache[`${lang}:ph:${original}`] = translated;
        if (placeholderEls[i]) placeholderEls[i].placeholder = translated;
    }
    // Options
    for (let i = 0; i < optionTexts.length; i++) {
        const original = optionTexts[i];
        const translated = allTranslated[idx++];
        _translateCache[`${lang}:${original}`] = translated;
        if (optionNodes[i]) optionNodes[i].textContent = translated;
    }
    // Attributes
    for (let i = 0; i < attrTexts.length; i++) {
        const original = attrTexts[i];
        const translated = allTranslated[idx++];
        _translateCache[`${lang}:attr:${original}`] = translated;
        if (attrEntries[i]) attrEntries[i].el.setAttribute(attrEntries[i].attr, translated);
    }
}

// Auto-translate dynamically added content via MutationObserver
function startTranslationObserver() {
    if (_translationObserver) _translationObserver.disconnect();
    const lang = state.language;
    if (lang === 'en') return;

    let pending = false;
    _translationObserver = new MutationObserver((mutations) => {
        // Check if any meaningful text was added or changed
        let hasNewText = false;
        for (const m of mutations) {
            if (m.type === 'characterData' && _isTranslatableText(m.target.textContent?.trim())) {
                hasNewText = true; break;
            }
            if (m.type === 'childList' && m.addedNodes.length > 0) {
                for (const node of m.addedNodes) {
                    if (node.nodeType === Node.TEXT_NODE && _isTranslatableText(node.textContent.trim())) {
                        hasNewText = true; break;
                    }
                    if (node.nodeType === Node.ELEMENT_NODE && node.textContent && /[a-zA-Z]{2,}/.test(node.textContent)) {
                        hasNewText = true; break;
                    }
                }
            }
            if (hasNewText) break;
        }
        if (hasNewText && !pending) {
            pending = true;
            // Debounce: wait 200ms then translate
            setTimeout(() => {
                pending = false;
                dynamicTranslateApp(lang);
            }, 200);
        }
    });
    const target = document.getElementById('app-shell');
    if (target) _translationObserver.observe(target, { childList: true, subtree: true, characterData: true });
}

// Single text translation helper
async function translateText(text, lang) {
    if (!text || lang === 'en') return text;
    const cacheKey = `${lang}:${text}`;
    if (_translateCache[cacheKey]) return _translateCache[cacheKey];
    try {
        const res = await fetch(`${API}/api/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: [text], target: lang, source: 'en' })
        });
        const data = await res.json();
        if (data.translations?.[0]) {
            _translateCache[cacheKey] = data.translations[0];
            return data.translations[0];
        }
    } catch (e) { /* fallback */ }
    return text;
}

function updateHeaderProfile() {
    if (!state.user) return;
    const avatar = document.getElementById('header-avatar');
    const uname = document.getElementById('header-username');
    if (avatar) avatar.textContent = (state.user.username || 'F')[0].toUpperCase();
    if (uname) uname.textContent = state.user.username || 'Farmer';
}

function logout() {
    localStorage.removeItem('agri_user');
    state.user = null;
    document.getElementById('app-shell').style.display = 'none';
    document.getElementById('auth-screen').style.display = '';
    toast('Logged out', 'info');
}

// ═══════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════

function navigate(pageId) {
    state.currentPage = pageId;
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`${pageId}-page`);
    if (target) {
        target.classList.add('active');
        target.classList.add('animate-fade-in');
        setTimeout(() => target.classList.remove('animate-fade-in'), 400);
    }
    // Sidebar active
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.toggle('active', l.dataset.page === pageId));
    // Mobile bottom nav active
    document.querySelectorAll('.mob-item').forEach(m => m.classList.toggle('active', m.dataset.page === pageId));
    // Picture nav active
    document.querySelectorAll('.pic-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
    closeMobileMenu();
    // Update breadcrumb
    updateBreadcrumb(pageId);
    // Scroll to top of main area
    const mainArea = document.querySelector('.main-area');
    if (mainArea) mainArea.scrollTop = 0;
    // Audio narration for illiterate farmers (Simple Mode)
    narratePage(pageId);
    // Lazy-load actions
    if (pageId === 'history') loadHistory();
    if (pageId === 'profile') loadProfileData();
    if (pageId === 'offline') updateOfflinePage();
    if (pageId === 'community') loadCommunityInsights();
    if (pageId === 'sustainability') loadSustainabilityChart();
    if (pageId === 'crop-diagnosis') loadDiagnosisHistory();
    if (pageId === 'voice-notes') loadVoiceNotes();
    if (pageId === 'expense-tracker') loadExpenseData();
    if (pageId === 'mandi-prices') { /* auto-search on first visit */ }
    if (pageId === 'govt-schemes') { /* prefill from farm data if available */ prefillSchemeData(); }
    // Auto-fill pest prediction with farm setup data
    if (pageId === 'pest-prediction' && state.farmSetup) {
        const pt = document.getElementById('pest-temp');
        const ph = document.getElementById('pest-humidity');
        const pr = document.getElementById('pest-rainfall');
        const ps = document.getElementById('pest-soil');
        if (pt && state.farmSetup.temperature) pt.value = state.farmSetup.temperature;
        if (ph && state.farmSetup.humidity) ph.value = state.farmSetup.humidity;
        if (pr && state.farmSetup.rainfall) pr.value = state.farmSetup.rainfall;
        if (ps && state.farmSetup.soil_type) ps.value = state.farmSetup.soil_type;
    }
    // Translate new page content
    if (state.language && state.language !== 'en') {
        setTimeout(() => dynamicTranslateApp(state.language), 300);
    }
}

// ─── Mobile menu ───
function openMobileMenu() {
    document.getElementById('sidebar').classList.add('mobile-open');
    document.getElementById('sidebar-overlay').classList.add('open');
}
function closeMobileMenu() {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebar-overlay').classList.remove('open');
}

// ═══════════════════════════════════════
//  SIDEBAR / DASHBOARD
// ═══════════════════════════════════════

function updateSidebarProfile() {
    if (!state.user) return;
    const initial = (state.user.username || 'F')[0].toUpperCase();
    document.getElementById('sidebar-avatar').textContent = initial;
    document.getElementById('sidebar-username').textContent = state.user.username || 'Farmer';
    document.getElementById('sidebar-farmname').textContent = state.user.farm_name || 'My Farm';
}

function setGreeting() {
    const h = new Date().getHours();
    const greetKey = h < 12 ? 'dash.goodMorning' : h < 17 ? 'dash.goodAfternoon' : 'dash.goodEvening';
    const el = document.getElementById('dash-greeting');
    if (el) el.textContent = t(greetKey, state.language);
}

function updateDashboard() {
    if (!state.user) return;
    document.getElementById('dash-name').textContent = `${state.user.username} 🌾`;
    document.getElementById('dash-farm').textContent = state.user.farm_name || '';
    // Stats
    if (state.farmSetup) {
        document.getElementById('stat-farm-size').textContent = `${state.farmSetup.land_size || '—'} ha`;
    }
    document.getElementById('stat-recs').textContent = state.recommendations.length;
}

async function loadDashboardWeather() {
    try {
        const lat = state.farmSetup?.lat || 12.9716;
        const lon = state.farmSetup?.lon || 77.5946;
        const data = await fetchAPI('/weather', { lat, lon });
        if (data.current_weather) {
            const temp = Math.round(data.current_weather.temperature);
            const hum = data.current_weather.humidity;
            const wind = data.current_weather.wind_speed;
            const desc = data.current_weather.description || 'Clear';
            document.getElementById('dash-temp').textContent = `${temp}°C`;
            document.getElementById('dash-humidity').textContent = `${hum}%`;
            document.getElementById('dash-wind').textContent = `${wind} km/h`;
            // Enhanced dashboard weather
            const bigTemp = document.getElementById('dash-big-temp');
            const bigDesc = document.getElementById('dash-big-desc');
            const detHum = document.getElementById('dash-det-hum');
            const detWind = document.getElementById('dash-det-wind');
            const detRain = document.getElementById('dash-det-rain');
            if (bigTemp) bigTemp.textContent = `${temp}°`;
            if (bigDesc) bigDesc.textContent = desc.charAt(0).toUpperCase() + desc.slice(1);
            if (detHum) detHum.textContent = `${hum}%`;
            if (detWind) detWind.textContent = `${wind} km/h`;
            if (detRain && data.metrics) detRain.textContent = `${data.metrics.total_rainfall || 0} mm`;
        }
    } catch { /* fallback defaults */ }
}

// ═══════════════════════════════════════
//  FARM SETUP
// ═══════════════════════════════════════

// NPK simple emoji selector
function setNPK(type, val, btn) {
    const row = btn.parentElement;
    row.querySelectorAll('.npk-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const map = { n: 'nitrogen', p: 'phosphorus', k: 'potassium' };
    document.getElementById(map[type]).value = val;
}

// GPS Location Detection
async function detectMyLocation() {
    const statusEl = document.getElementById('gps-status');
    const statusText = document.getElementById('gps-status-text');
    const btn = document.getElementById('gps-detect-btn');
    
    statusEl.className = 'gps-status-box loading';
    statusText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Detecting your location...';
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Detecting...';

    try {
        // Get GPS coordinates
        const pos = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('GPS not supported on this device'));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 300000 // 5 min cache
            });
        });

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        document.getElementById('user-lat').value = lat;
        document.getElementById('user-lon').value = lon;

        // Reverse geocode (simple - using Open-Meteo geocoding API)
        let placeName = `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;
        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`);
            const geoData = await geoRes.json();
            if (geoData.address) {
                placeName = geoData.address.village || geoData.address.town || geoData.address.city || geoData.address.county || placeName;
                document.getElementById('city-name').value = placeName;
            }
        } catch { /* use coordinates as fallback */ }

        // Fetch weather from Open-Meteo
        statusText.innerHTML = '<i class="fas fa-cloud-sun"></i> Fetching weather data...';
        const weatherData = await fetchAPI('/weather', { lat, lon });
        
        const temp = Math.round(weatherData.current_weather?.temperature || 25);
        const hum = weatherData.current_weather?.humidity || 60;
        const rain = Math.round(weatherData.metrics?.total_rainfall || 0);

        // Update hidden form fields
        document.getElementById('temperature').value = temp;
        document.getElementById('humidity').value = hum;
        document.getElementById('rainfall').value = rain;

        // Set pH based on soil type (smart default)
        const soilPh = { Loamy: 6.5, Sandy: 6.0, Clay: 7.0, Black: 7.5, Red: 5.5, Silty: 6.8 };
        const currentSoil = document.getElementById('soil-type').value;
        const ph = soilPh[currentSoil] || 6.5;
        document.getElementById('ph').value = ph;

        // Show result chips
        document.getElementById('gps-place-name').textContent = placeName;
        document.getElementById('gps-temp').textContent = `${temp}°C`;
        document.getElementById('gps-hum').textContent = `${hum}%`;
        document.getElementById('gps-rain').textContent = `${rain} mm/week`;
        document.getElementById('gps-result').style.display = '';

        // Show auto-weather card
        const autoCard = document.getElementById('auto-weather-card');
        if (autoCard) {
            autoCard.style.display = '';
            document.getElementById('auto-temp-val').textContent = `${temp}°C`;
            document.getElementById('auto-hum-val').textContent = `${hum}%`;
            document.getElementById('auto-rain-val').textContent = `${rain} mm`;
            document.getElementById('auto-ph-val').textContent = ph;
        }

        // Also update pest prediction fields
        const pestTemp = document.getElementById('pest-temp');
        const pestHum = document.getElementById('pest-humidity');
        const pestRain = document.getElementById('pest-rainfall');
        if (pestTemp) pestTemp.value = temp;
        if (pestHum) pestHum.value = hum;
        if (pestRain) pestRain.value = rain;

        statusEl.className = 'gps-status-box success';
        statusText.innerHTML = `<i class="fas fa-check-circle"></i> Location detected: <strong>${placeName}</strong>`;
        btn.innerHTML = '<i class="fas fa-check"></i> Location Detected!';
        btn.className = 'btn btn-success btn-large';
        toast(`Location detected: ${placeName} — weather data loaded! 📍`, 'success');
        autoSpeak(`Location detected: ${placeName}. Temperature ${temp} degrees, humidity ${hum} percent.`);

    } catch (err) {
        statusEl.className = 'gps-status-box error';
        let msg = 'Could not detect location.';
        if (err.code === 1) msg = 'Permission denied. Please allow location access.';
        else if (err.code === 2) msg = 'Location unavailable. Check GPS/network.';
        else if (err.code === 3) msg = 'Location request timed out. Try again.';
        statusText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${msg}`;
        btn.innerHTML = '<i class="fas fa-redo"></i> Try Again';
        btn.disabled = false;
        btn.className = 'btn btn-primary btn-large';
        toast(msg, 'error');
    }
}

function convertLandUnit() {
    const val = parseFloat(document.getElementById('land-size').value) || 0;
    const unit = document.getElementById('land-unit').value;
    let hectares = val;
    if (unit === 'acres') hectares = val * 0.4047;
    else if (unit === 'cents') hectares = val * 0.004047;
    const el = document.getElementById('land-converted');
    if (unit !== 'hectares') {
        el.textContent = `≈ ${hectares.toFixed(2)} hectares`;
    } else {
        el.textContent = '';
    }
}

async function saveFarmSetup() {
    const land_size_raw = parseFloat(document.getElementById('land-size').value) || 5;
    const unit = document.getElementById('land-unit').value;
    let land_size = land_size_raw;
    if (unit === 'acres') land_size = land_size_raw * 0.4047;
    else if (unit === 'cents') land_size = land_size_raw * 0.004047;

    const lat = parseFloat(document.getElementById('user-lat').value) || 12.9716;
    const lon = parseFloat(document.getElementById('user-lon').value) || 77.5946;

    state.farmSetup = {
        land_size: Math.round(land_size * 100) / 100,
        soil_type: document.getElementById('soil-type').value,
        crop_preference: document.getElementById('crop-preference').value,
        nitrogen: +document.getElementById('nitrogen').value,
        phosphorus: +document.getElementById('phosphorus').value,
        potassium: +document.getElementById('potassium').value,
        temperature: +document.getElementById('temperature').value,
        humidity: +document.getElementById('humidity').value,
        ph: +document.getElementById('ph').value,
        rainfall: +document.getElementById('rainfall').value,
        lat, lon,
        locMethod: 'gps',
        city: document.getElementById('city-name')?.value || ''
    };
    localStorage.setItem('agri_farm_setup', JSON.stringify(state.farmSetup));

    // Send to backend
    try {
        await fetchAPI('/farm_details', {
            username: state.user?.username || 'anonymous',
            land_size: state.farmSetup.land_size,
            soil_type: state.farmSetup.soil_type,
            crop_preference: state.farmSetup.crop_preference
        });
    } catch { /* offline ok */ }

    // Add to recent activity
    addActivity('Farm details saved', 'green');
    updateDashboard();
    toast('Farm details saved! 🚜', 'success');
}

// Track recent activity on dashboard
function addActivity(text, color = 'green') {
    const feed = document.getElementById('dash-recent-activity');
    if (!feed) return;
    const item = document.createElement('div');
    item.className = 'activity-item animate-fade-in';
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    item.innerHTML = `<div class="activity-dot ${color}"></div><span>${text}</span><small>${timeStr}</small>`;
    feed.prepend(item);
    // Keep max 10 items
    while (feed.children.length > 10) feed.removeChild(feed.lastChild);
}

// ═══════════════════════════════════════
//  AI RECOMMENDATION (Multi-Agent)
// ═══════════════════════════════════════

async function getRecommendation() {
    if (!state.farmSetup) { toast('Please set up farm details first', 'info'); navigate('farm-setup'); return; }
    showLoading('Custom Engine + AI agents analyzing your farm...');
    showSkeleton('recommendation-results', 5);
    const container = document.getElementById('recommendation-results');
    try {
        // Phase 1: Instant custom engine result (no Groq needed)
        let quickData = null;
        try {
            quickData = await fetchAPI('/api/quick_recommend', {
                temperature: state.farmSetup.temperature,
                humidity: state.farmSetup.humidity,
                rainfall: state.farmSetup.rainfall,
                ph: state.farmSetup.ph,
                nitrogen: state.farmSetup.nitrogen,
                phosphorus: state.farmSetup.phosphorus,
                potassium: state.farmSetup.potassium,
                soil_type: state.farmSetup.soil_type,
                land_size: state.farmSetup.land_size,
                crop_preference: state.farmSetup.crop_preference
            });
        } catch(e) { console.warn('Quick engine failed:', e); }

        // Show instant engine result while full pipeline runs
        if (quickData?.success) {
            const eng = quickData.recommendation;
            const topCrop = eng.recommended_crop || 'Unknown';
            const score = Math.round((eng.final_score || 0) * 10);
            const scoreColor = score >= 7 ? '#16a34a' : score >= 5 ? '#eab308' : '#dc2626';
            const trafficEmoji = score >= 7 ? '🟢' : score >= 5 ? '🟡' : '🔴';
            container.innerHTML = buildVisualResultCard({
                topCrop, cropIcon: eng.crop_icon || '🌾', score, scoreColor, trafficEmoji,
                placeName: state.farmSetup.city || 'Your Farm',
                temp: state.farmSetup.temperature, hum: state.farmSetup.humidity,
                alternatives: (eng.alternatives || []).slice(0, 3),
                scoreExplanation: eng.score_explanation || [],
                estimatedYield: eng.estimated_yield,
                confidence: eng.confidence || 'Medium',
                engineLabel: 'AgriSmart Custom Engine ⚡ (loading agents...)',
                layerScores: eng.layer_scores,
                comparative: eng.comparative
            });
        }

        // Phase 2: Full multi-agent pipeline (Groq agents validate + enrich the engine's crop)
        const data = await fetchAPI('/multi_agent_recommendation', {
            username: state.user?.username || 'anonymous',
            land_size: state.farmSetup.land_size,
            soil_type: state.farmSetup.soil_type,
            crop_preference: state.farmSetup.crop_preference,
            nitrogen: state.farmSetup.nitrogen,
            phosphorus: state.farmSetup.phosphorus,
            potassium: state.farmSetup.potassium,
            temperature: state.farmSetup.temperature,
            humidity: state.farmSetup.humidity,
            ph: state.farmSetup.ph,
            rainfall: state.farmSetup.rainfall
        });
        // Replace with full enriched result
        renderRecommendation(data, container);
        // Auto-speak result for illiterate farmers
        const topCropSpeak = data.central_coordinator?.final_crop || 'crop';
        const scoreSpeak = data.central_coordinator?.overall_score || '';
        autoSpeak(`AI recommends growing ${topCropSpeak}! Score: ${scoreSpeak} out of 10. ${data.central_coordinator?.reasoning || ''}`);
        // Add speaker button
        addSpeakerButton(container, `Recommended crop: ${topCropSpeak}. Score: ${scoreSpeak} out of 10. ${data.agents?.farmer_advisor?.advice || ''}`);
        // Save locally
        const rec = { ...data, timestamp: new Date().toISOString() };
        state.recommendations.unshift(rec);
        if (state.recommendations.length > 20) state.recommendations.pop();
        localStorage.setItem('agri_recommendations', JSON.stringify(state.recommendations));
        document.getElementById('stat-recs').textContent = state.recommendations.length;
    } catch (err) {
        // Try fallback simple recommendation
        try {
            const data = await fetchAPI('/recommendation', {
                username: state.user?.username || 'anonymous',
                land_size: state.farmSetup.land_size,
                soil_type: state.farmSetup.soil_type,
                crop_preference: state.farmSetup.crop_preference
            });
            renderSimpleRecommendation(data, container);
            state.recommendations.unshift({ ...data, timestamp: new Date().toISOString() });
            localStorage.setItem('agri_recommendations', JSON.stringify(state.recommendations));
        } catch (err2) {
            container.innerHTML = `<div class="card" style="color:var(--farm-red)"><p><i class="fas fa-exclamation-triangle"></i> Could not get recommendations. ${err2.message || 'Please try again.'}</p></div>`;
        }
    } finally {
        hideLoading();
    }
}

function renderRecommendation(data, container) {
    let html = '';
    const topCrop = data.central_coordinator?.final_crop || 'Unknown';
    const finalScore = data.central_coordinator?.overall_score || 0;
    const confidence = data.central_coordinator?.confidence_level || 'Medium';
    const agents = data.agents || {};
    const coord = data.central_coordinator || {};

    // ── 1. Visual Score Hero (icon-heavy for illiterate farmers) ──
    const scoreColor = finalScore >= 7 ? '#16a34a' : finalScore >= 5 ? '#eab308' : '#dc2626';
    const cropIcon = ce?.crop_icon || data.custom_engine?.crop_icon || '🌾';
    html += `<div class="rec-hero animate-scale-in" style="background:linear-gradient(135deg,${scoreColor}15,${scoreColor}05);border:2px solid ${scoreColor}30;border-radius:20px;padding:1.5rem;margin-bottom:1.5rem">
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
            <div style="width:80px;height:80px;border-radius:50%;background:${scoreColor};color:#fff;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:800;flex-shrink:0">${finalScore}</div>
            <div style="flex:1;min-width:150px">
                <div style="font-size:1.5rem;font-weight:800;color:#1e293b">${cropIcon} ${topCrop}</div>
                <div style="font-size:0.95rem;color:#64748b;margin-top:4px">
                    ${confidence === 'High' ? '✅' : confidence === 'Medium' ? '⚠️' : '❌'} ${confidence} Confidence
                </div>
                <div style="font-size:0.78rem;color:#8b5cf6;margin-top:2px">⚡ Custom Engine (primary) + 5 AI Agents (validation)</div>
            </div>
        </div>
    </div>`;

    // ── 2. Custom Engine Insights (unique algorithm data) ──
    const ce = data.custom_engine || {};
    if (ce.enabled !== false && ce.custom_score) {
        const ceConfidence = ce.custom_confidence || 'Medium';
        const ceConfColor = ceConfidence === 'High' ? '#16a34a' : ceConfidence === 'Medium' ? '#eab308' : '#ef4444';
        
        html += `<div class="card mb-4" style="margin-bottom:1.5rem;border:2px solid #8b5cf620">
            <h3 class="card-title"><i class="fas fa-microchip" style="color:#8b5cf6"></i> AgriSmart Custom Engine Analysis</h3>
            <div class="otr-engine-badge" style="margin-bottom:1rem">Engine v${ce.engine_version || '1.0'} • ${ce.layers_used || '?'} Layers • ${ce.data_points_analysed || '?'} Data Points</div>`;
        
        // Layer score bars
        if (ce.layer_scores) {
            html += '<div class="layer-score-bars" style="margin-bottom:1rem">';
            const layerLabels = {
                agronomic: { icon: '🌱', label: 'Soil & Climate Match' },
                npk: { icon: '🧪', label: 'NPK Fertilizer Match' },
                season: { icon: '📅', label: 'Season Suitability' },
                ml_model: { icon: '🤖', label: 'ML Model Prediction' },
                knowledge_base: { icon: '📚', label: 'Historical Data Match' }
            };
            for (const [key, val] of Object.entries(ce.layer_scores)) {
                const info = layerLabels[key] || { icon: '📊', label: key };
                const pct = Math.round((val || 0) * 100);
                const barColor = pct >= 70 ? '#16a34a' : pct >= 40 ? '#eab308' : '#ef4444';
                html += `<div class="layer-bar-row">
                    <span class="lbr-icon">${info.icon}</span>
                    <span class="lbr-label">${info.label}</span>
                    <div class="lbr-track"><div class="lbr-fill" style="width:${pct}%;background:${barColor}"></div></div>
                    <span class="lbr-pct">${pct}%</span>
                </div>`;
            }
            html += '</div>';
        }
        
        // Score explanation
        if (ce.score_explanation?.length) {
            html += '<div class="score-explain-cards" style="margin-bottom:1rem">';
            for (const line of ce.score_explanation) {
                const icon = line.includes('✅') ? '✅' : line.includes('⚠️') ? '⚠️' : line.includes('❌') ? '❌' : 'ℹ️';
                const cleanText = line.replace(/[✅⚠️❌]/g, '').trim();
                const bgClass = icon === '✅' ? 'explain-good' : icon === '⚠️' ? 'explain-warn' : icon === '❌' ? 'explain-bad' : 'explain-info';
                html += `<div class="score-explain-card ${bgClass}"><span class="sec-icon">${icon}</span><span>${cleanText}</span></div>`;
            }
            html += '</div>';
        }
        
        // Alternative crops
        if (ce.custom_alternatives?.length) {
            html += '<div class="alt-crops-section"><div class="alt-crops-title">🔄 Alternative Crops</div><div class="alt-crops-grid">';
            for (const alt of ce.custom_alternatives.slice(0, 6)) {
                const altName = alt.crop || alt.name || 'Unknown';
                const altIcon = alt.icon || '🌾';
                const altScore = Math.round((alt.score || alt.final_score || 0) * 100);
                const altColor = altScore >= 70 ? '#16a34a' : altScore >= 40 ? '#eab308' : '#ef4444';
                html += `<div class="alt-crop-card">
                    <div class="alt-crop-icon">${altIcon}</div>
                    <div class="alt-crop-name">${altName}</div>
                    <div class="alt-crop-score" style="color:${altColor}">${altScore}%</div>
                </div>`;
            }
            html += '</div></div>';
        }
        
        // Historical evidence
        if (ce.historical_evidence?.length) {
            html += '<div style="margin-top:1rem"><strong style="font-size:0.9rem;color:#1e293b">📜 Historical Evidence:</strong><ul style="padding-left:1.25rem;margin:0.5rem 0 0">';
            for (const ev of ce.historical_evidence.slice(0, 3)) {
                html += `<li style="font-size:0.85rem;color:#475569;margin-bottom:4px">${typeof ev === 'string' ? ev : JSON.stringify(ev)}</li>`;
            }
            html += '</ul></div>';
        }
        
        html += '</div>';
    }

    // ── 2b. Comparative Scoring (custom engine's crop comparison) ──
    if (ce.comparative) {
        html += buildComparativeSection(ce.comparative, topCrop);
    }

    // ── 3. Agent Visual Score Bars ──
    const scoreData = [];
    if (agents.farmer_advisor?.confidence) scoreData.push({ emoji: '🚜', label: 'Crop Match', val: agents.farmer_advisor.confidence, max: 100 });
    if (agents.market_researcher?.market_score) scoreData.push({ emoji: '💰', label: 'Market', val: agents.market_researcher.market_score * 10, max: 100 });
    if (agents.weather_analyst?.weather_score) scoreData.push({ emoji: '🌤️', label: 'Weather', val: agents.weather_analyst.weather_score * 10, max: 100 });
    if (agents.sustainability_expert?.sustainability_score) scoreData.push({ emoji: '🌱', label: 'Sustainability', val: agents.sustainability_expert.sustainability_score * 10, max: 100 });

    if (scoreData.length) {
        html += `<div class="card mb-4" style="margin-bottom:1.5rem"><h3 class="card-title"><i class="fas fa-chart-bar"></i> ${t('dash.recommendations', state.language)} — Visual Scores</h3>`;
        html += '<div class="visual-scores" style="display:grid;gap:0.75rem;padding:0.5rem 0">';
        scoreData.forEach(s => {
            const pct = Math.min(100, Math.max(0, s.val));
            const barColor = pct >= 70 ? '#16a34a' : pct >= 50 ? '#eab308' : '#dc2626';
            html += `<div class="score-bar-row" style="display:flex;align-items:center;gap:0.75rem">
                <span style="font-size:1.5rem;width:2rem;text-align:center">${s.emoji}</span>
                <span style="width:90px;font-size:0.85rem;font-weight:600;color:#334155">${s.label}</span>
                <div style="flex:1;height:22px;background:#f1f5f9;border-radius:12px;overflow:hidden;position:relative">
                    <div style="height:100%;width:${pct}%;background:${barColor};border-radius:12px;transition:width 1s ease"></div>
                </div>
                <span style="width:40px;font-weight:700;font-size:0.9rem;color:${barColor};text-align:right">${Math.round(pct)}%</span>
            </div>`;
        });
        html += '</div></div>';
    }

    // ── 4. Charts row: Radar + Bar ──
    html += `<div class="rec-charts-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;margin-bottom:1.5rem">`;
    if (data.chart_data?.length) {
        html += `<div class="card"><h3 class="card-title"><i class="fas fa-chart-pie"></i> Score Analysis</h3><div id="rec-radar-chart" class="chart-container" style="min-height:300px"></div></div>`;
        html += `<div class="card"><h3 class="card-title"><i class="fas fa-chart-bar"></i> Agent Comparison</h3><div id="rec-bar-chart" class="chart-container" style="min-height:300px"></div></div>`;
    }
    html += '</div>';

    // ── 5. Agent Discussion Panel — shows a natural "conversation" ──
    html += `<div class="card mb-4" style="margin-bottom:1.5rem">
        <h3 class="card-title"><i class="fas fa-comments"></i> Agent Discussion</h3>
        <p style="font-size:0.85rem;color:#64748b;margin-bottom:1rem">5 AI experts analysed your farm data and discussed to reach this recommendation:</p>
        <div class="agent-discussion" style="display:flex;flex-direction:column;gap:0.75rem">`;

    const agentMeta = {
        farmer_advisor:        { icon: '🚜', color: '#16a34a', label: 'Farmer Advisor',  bg: '#f0fdf4' },
        market_researcher:     { icon: '💰', color: '#d97706', label: 'Market Researcher', bg: '#fffbeb' },
        weather_analyst:       { icon: '🌤️', color: '#2563eb', label: 'Weather Analyst',  bg: '#eff6ff' },
        sustainability_expert: { icon: '🌱', color: '#059669', label: 'Sustainability Expert', bg: '#ecfdf5' }
    };

    // Farmer Advisor speaks first
    if (agents.farmer_advisor) {
        const a = agents.farmer_advisor;
        html += buildDiscussionBubble(agentMeta.farmer_advisor,
            `Based on your soil and climate data, I recommend <strong>${a.recommended_crop}</strong> with ${a.confidence}% confidence. ${a.advice || ''} ${a.reasoning || ''}`);
    }

    // Market Researcher responds
    if (agents.market_researcher) {
        const a = agents.market_researcher;
        html += buildDiscussionBubble(agentMeta.market_researcher,
            `Looking at market trends for ${topCrop}: Market score is <strong>${a.market_score}/10</strong>, price trend is <strong>${a.price_trend}</strong>. ${a.advice || ''} ${a.reasoning || ''}`);
    }

    // Weather Analyst weighs in
    if (agents.weather_analyst) {
        const a = agents.weather_analyst;
        html += buildDiscussionBubble(agentMeta.weather_analyst,
            `Weather suitability: <strong>${a.weather_score}/10</strong>, risk level: <strong>${a.risk_level}</strong>. ${a.forecast || ''} ${a.advice || ''} ${a.reasoning || ''}`);
    }

    // Sustainability Expert
    if (agents.sustainability_expert) {
        const a = agents.sustainability_expert;
        html += buildDiscussionBubble(agentMeta.sustainability_expert,
            `Sustainability score: <strong>${a.sustainability_score}/10</strong>, environmental impact: <strong>${a.environmental_impact}</strong>. ${a.recommendations || ''} ${a.advice || ''}`);
    }

    // Central Coordinator synthesis — the final word
    if (coord.reasoning || coord.action_plan) {
        html += `<div style="border-left:3px solid #7c3aed;padding:1rem;background:#f5f3ff;border-radius:0 12px 12px 0;margin-top:0.5rem">
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
                <span style="font-size:1.3rem">🧠</span>
                <strong style="color:#7c3aed">Central Coordinator (Final Synthesis)</strong>
            </div>
            <div style="font-size:0.9rem;color:#334155;line-height:1.6">
                ${coord.reasoning || ''}
                ${coord.risk_summary ? `<br><strong>⚠️ Risk Summary:</strong> ${coord.risk_summary}` : ''}
                ${coord.conflicts_resolved && coord.conflicts_resolved !== 'None' ? `<br><strong>🔄 Conflicts Resolved:</strong> ${coord.conflicts_resolved}` : ''}
            </div>
        </div>`;
    }

    html += '</div></div>';

    // ── 6. Action Plan (visual steps) ──
    if (coord.action_plan) {
        html += `<div class="card mb-4" style="margin-bottom:1.5rem">
            <h3 class="card-title"><i class="fas fa-clipboard-list"></i> Action Plan</h3>
            <div style="white-space:pre-line;font-size:0.9rem;line-height:1.7;color:#334155">${coord.action_plan}</div>
        </div>`;
    }

    // ── 7. Key Factors & Warnings ──
    if (coord.key_factors?.length || coord.action_items?.length) {
        html += '<div class="rec-info-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;margin-bottom:1.5rem">';
        if (coord.key_factors?.length) {
            html += `<div class="card"><h3 class="card-title"><i class="fas fa-key"></i> Key Factors</h3><ul style="padding-left:1.25rem;margin:0">`;
            coord.key_factors.forEach(f => { if (f) html += `<li style="margin-bottom:0.4rem;font-size:0.9rem">${f}</li>`; });
            html += '</ul></div>';
        }
        if (coord.action_items?.length) {
            html += `<div class="card"><h3 class="card-title"><i class="fas fa-exclamation-triangle" style="color:#d97706"></i> Warnings & Alerts</h3><ul style="padding-left:1.25rem;margin:0">`;
            coord.action_items.forEach(item => { if (item) html += `<li style="margin-bottom:0.4rem;font-size:0.9rem;color:#92400e">${item}</li>`; });
            html += '</ul></div>';
        }
        html += '</div>';
    }

    // ── 8. Agent detail cards (expandable) ──
    html += '<div class="agent-results-grid">';
    for (const [key, agent] of Object.entries(agents)) {
        const meta = agentMeta[key] || { icon: '🤖', color: '#16a34a', label: key, bg: '#f0fdf4' };
        html += `<div class="agent-card animate-fade-in">
            <div class="agent-card-header">
                <div class="agent-avatar" style="background:${meta.color};color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.1rem">${meta.icon}</div>
                <span class="agent-name">${meta.label}</span>
            </div>
            <div class="agent-body">${formatAgentContent(agent)}</div>
        </div>`;
    }
    html += '</div>';

    container.innerHTML = html;
    // Auto-translate rendered result
    if (state.language !== 'en') _translateAllTextIn(container, state.language);

    // ── Draw Charts ──
    if (data.chart_data?.length) {
        const cd = data.chart_data[0];
        // Radar chart
        Plotly.newPlot('rec-radar-chart', [{
            type: 'scatterpolar',
            r: [...cd.values, cd.values[0]],
            theta: [...cd.labels, cd.labels[0]],
            fill: 'toself',
            fillcolor: 'rgba(22,163,74,0.15)',
            line: { color: '#16a34a', width: 2 },
            marker: { size: 6 }
        }], {
            polar: { radialaxis: { visible: true, range: [0, 100] } },
            margin: { t: 20, b: 20, l: 50, r: 50 },
            paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
            font: { family: 'Inter', size: 11 }
        }, { responsive: true, displayModeBar: false });

        // Bar chart — visual comparison
        const barLabels = cd.labels;
        const barValues = cd.values;
        const barColors = barValues.map(v => v >= 70 ? '#16a34a' : v >= 50 ? '#eab308' : '#dc2626');
        Plotly.newPlot('rec-bar-chart', [{
            x: barLabels,
            y: barValues,
            type: 'bar',
            marker: { color: barColors, cornerradius: 8 },
            text: barValues.map(v => `${v}%`),
            textposition: 'outside',
            textfont: { size: 12, color: '#334155' }
        }], {
            yaxis: { range: [0, 110], title: '', showgrid: true, gridcolor: '#f1f5f9' },
            xaxis: { title: '' },
            margin: { t: 20, b: 60, l: 40, r: 20 },
            paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
            font: { family: 'Inter', size: 11 },
            bargap: 0.3
        }, { responsive: true, displayModeBar: false });
    }
}

function buildDiscussionBubble(meta, message) {
    return `<div style="display:flex;gap:0.75rem;align-items:flex-start">
        <div style="width:40px;height:40px;border-radius:50%;background:${meta.bg};display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;border:2px solid ${meta.color}30">${meta.icon}</div>
        <div style="flex:1;background:${meta.bg};border:1px solid ${meta.color}20;border-radius:4px 16px 16px 16px;padding:0.75rem 1rem">
            <div style="font-weight:700;font-size:0.8rem;color:${meta.color};margin-bottom:0.3rem">${meta.label}</div>
            <div style="font-size:0.88rem;line-height:1.55;color:#334155">${message}</div>
        </div>
    </div>`;
}

function formatAgentContent(agent) {
    let lines = [];
    if (agent.recommended_crop) lines.push(`<strong>Crop:</strong> ${agent.recommended_crop}`);
    if (agent.confidence) lines.push(`<strong>Confidence:</strong> ${agent.confidence}%`);
    if (agent.market_score) lines.push(`<strong>Market Score:</strong> ${agent.market_score}/10`);
    if (agent.price_trend) lines.push(`<strong>Price Trend:</strong> ${agent.price_trend}`);
    if (agent.weather_score) lines.push(`<strong>Weather Score:</strong> ${agent.weather_score}/10`);
    if (agent.risk_level) lines.push(`<strong>Risk:</strong> ${agent.risk_level}`);
    if (agent.forecast) lines.push(`${agent.forecast}`);
    if (agent.sustainability_score) lines.push(`<strong>Sustainability:</strong> ${agent.sustainability_score}/10`);
    if (agent.environmental_impact) lines.push(`<strong>Impact:</strong> ${agent.environmental_impact}`);
    if (agent.advice) lines.push(`${agent.advice}`);
    if (agent.reasoning) lines.push(`<em>${agent.reasoning}</em>`);
    return lines.join('<br>');
}

function renderSimpleRecommendation(data, container) {
    let html = `<div class="card"><h3 class="card-title"><i class="fas fa-clipboard-check"></i> AI Recommendation</h3>`;
    html += `<div class="agent-body" style="white-space:pre-line">${data.recommendation || 'No data'}</div></div>`;
    if (data.chart_data?.length) {
        html += '<div class="card mt-4"><h3 class="card-title"><i class="fas fa-chart-bar"></i> Crop Analysis</h3><div id="rec-simple-chart" class="chart-container"></div></div>';
    }
    container.innerHTML = html;
    if (state.language !== 'en') _translateAllTextIn(container, state.language);
    if (data.chart_data?.length) {
        const traces = data.chart_data.map(cd => ({
            type: 'scatterpolar',
            name: cd.crop,
            r: [...cd.values, cd.values[0]],
            theta: [...cd.labels, cd.labels[0]],
            fill: 'toself'
        }));
        Plotly.newPlot('rec-simple-chart', traces, {
            polar: { radialaxis: { visible: true, range: [0, 100] } },
            margin: { t: 30, b: 30, l: 50, r: 50 },
            paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
            font: { family: 'Inter' }
        }, { responsive: true, displayModeBar: false });
    }
}

// ═══════════════════════════════════════
//  CROP ROTATION
// ═══════════════════════════════════════

async function generateRotationPlan() {
    const crop = document.getElementById('current-crop').value;
    showLoading('Generating rotation plan...');
    try {
        const data = await fetchAPI('/crop_rotation', { current_crop: crop, years: 4 });
        const container = document.getElementById('rotation-results');
        let html = `<div class="card mt-4"><h3 class="card-title"><i class="fas fa-calendar-check"></i> Rotation Plan for ${crop}</h3>`;
        html += `<div class="agent-body" style="white-space:pre-line">${data.plan}</div></div>`;
        container.innerHTML = html;
        if (state.language !== 'en') _translateAllTextIn(container, state.language);

        // Store plan text for voice reading
        lastRotationPlanText = data.plan.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const voiceNoteDiv = document.getElementById('rotation-voice-note');
        if (voiceNoteDiv) voiceNoteDiv.style.display = 'block';

        // Timeline chart
        if (data.timeline) {
            Plotly.newPlot('rotation-timeline-chart', [{
                x: data.timeline.years,
                y: data.timeline.scores,
                type: 'bar',
                marker: {
                    color: data.timeline.scores.map((_, i) => ['#16a34a', '#0ea5e9', '#eab308', '#8b5cf6'][i % 4]),
                    cornerradius: 8
                },
                text: data.timeline.crops.map(c => c.split(': ')[1] || c),
                textposition: 'outside'
            }], {
                yaxis: { title: 'Soil Health Score', range: [0, 100] },
                margin: { t: 20, b: 40, l: 50, r: 20 },
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { family: 'Inter' }
            }, { responsive: true, displayModeBar: false });
        }
    } catch (err) {
        toast('Failed to generate rotation plan', 'error');
    } finally {
        hideLoading();
    }
}

// ═══════════════════════════════════════
//  FERTILIZER CALCULATOR
// ═══════════════════════════════════════

async function calculateFertilizer() {
    const soil = document.getElementById('fert-soil').value;
    const crop = document.getElementById('fert-crop').value;
    const land = parseFloat(document.getElementById('fert-land').value) || 5;
    showLoading('Calculating fertilizer needs...');
    try {
        const data = await fetchAPI('/fertilizer', { land_size: land, soil_type: soil, crop_type: crop });
        const container = document.getElementById('fertilizer-results');
        container.innerHTML = `<div class="npk-cards mt-4">
            <div class="npk-card n-card"><div class="npk-value">${data.nitrogen_kg}</div><div class="npk-label">Nitrogen (kg)</div></div>
            <div class="npk-card p-card"><div class="npk-value">${data.phosphorus_kg}</div><div class="npk-label">Phosphorus (kg)</div></div>
            <div class="npk-card k-card"><div class="npk-value">${data.potassium_kg}</div><div class="npk-label">Potassium (kg)</div></div>
        </div>`;
        if (state.language !== 'en') _translateAllTextIn(container, state.language);

        Plotly.react('fertilizer-chart', [{
            values: [data.nitrogen_kg, data.phosphorus_kg, data.potassium_kg],
            labels: ['Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)'],
            type: 'pie',
            marker: { colors: ['#16a34a', '#0ea5e9', '#8b5cf6'] },
            hole: 0.45,
            textinfo: 'label+percent'
        }], {
            margin: { t: 20, b: 20, l: 20, r: 20 },
            paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
            font: { family: 'Inter' },
            showlegend: false
        }, { responsive: true, displayModeBar: false });
    } catch {
        toast('Failed to calculate fertilizer', 'error');
    } finally {
        hideLoading();
    }
}

// ═══════════════════════════════════════
//  SUSTAINABILITY
// ═══════════════════════════════════════

async function logSustainability() {
    const water_score = parseFloat(document.getElementById('water-usage').value) || 2;
    const fertilizer_use = parseFloat(document.getElementById('fertilizer-use').value) || 1.5;
    const rotation = document.getElementById('crop-rotation').value === 'yes';
    showLoading('Logging sustainability data...');
    try {
        const data = await fetchAPI('/sustainability', {
            username: state.user?.username || 'anonymous',
            water_score, fertilizer_use, rotation
        });
        document.getElementById('stat-sustain').textContent = `${data.score}%`;

        // Tips
        const tipsEl = document.getElementById('sustainability-tips');
        let tipsHtml = '<h3 class="card-title"><i class="fas fa-lightbulb"></i> Improvement Tips</h3>';
        if (data.tips?.length) {
            tipsHtml += '<ul style="padding-left:1.25rem;font-size:0.9rem;line-height:1.8">';
            data.tips.forEach(t => tipsHtml += `<li>${t}</li>`);
            tipsHtml += '</ul>';
        } else {
            tipsHtml += '<p style="color:var(--farm-green);font-weight:600">🎉 Great work! Your practices are sustainable.</p>';
        }
        tipsEl.innerHTML = tipsHtml;
        loadSustainabilityChart();
        toast(`Sustainability score: ${data.score}%`, 'success');
    } catch {
        toast('Failed to log data', 'error');
    } finally {
        hideLoading();
    }
}

async function loadSustainabilityChart() {
    try {
        const data = await fetch(`${API}/sustainability/scores?username=${state.user?.username || 'anonymous'}`).then(r => r.json());
        const noDataEl = document.getElementById('sustainability-no-data');
        if (data.timestamps?.length) {
            if (noDataEl) noDataEl.style.display = 'none';
            requestAnimationFrame(() => {
                Plotly.react('sustainability-trend-chart', [{
                    x: data.timestamps, y: data.scores,
                    type: 'scatter', mode: 'lines+markers',
                    line: { color: '#16a34a', width: 3, shape: 'spline' },
                    marker: { size: 8, color: '#16a34a' },
                    fill: 'tozeroy', fillcolor: 'rgba(22,163,74,0.08)'
                }], {
                    yaxis: { title: 'Score', range: [0, 100] },
                    xaxis: { title: 'Date' },
                    margin: { t: 10, b: 40, l: 50, r: 20 },
                    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                    font: { family: 'Inter' }
                }, { responsive: true, displayModeBar: false, staticPlot: false });
            });
        } else {
            if (noDataEl) noDataEl.style.display = 'block';
        }
    } catch { /* offline ok */ }
}

// ═══════════════════════════════════════
//  COMMUNITY
// ═══════════════════════════════════════

async function shareCommunityData() {
    showLoading('Sharing your data...');
    try {
        await fetchAPI('/community', {
            username: state.user?.username || 'anonymous',
            crop_type: document.getElementById('community-crop').value,
            yield_data: parseFloat(document.getElementById('community-yield').value) || 0,
            market_price: parseFloat(document.getElementById('community-price').value) || 0,
            region: document.getElementById('community-region').value,
            season: document.getElementById('community-season').value,
            sustainability_practice: document.getElementById('community-practice').value
        });
        toast('Data shared with the community! 🤝', 'success');
        addActivity('Shared data with community', 'blue');
        loadCommunityInsights();
        loadMyPosts();
    } catch {
        toast('Could not share data', 'error');
    } finally {
        hideLoading();
    }
}

async function loadCommunityInsights() {
    try {
        const data = await fetch(`${API}/community/insights`).then(r => r.json());
        if (!data.insights?.length) return;
        const crops = data.insights.map(i => i.crop_type);
        const yields = data.insights.map(i => i.avg_yield);
        requestAnimationFrame(() => {
            Plotly.newPlot('community-chart', [{
                x: crops, y: yields,
                type: 'bar',
                marker: { color: crops.map((_, i) => ['#16a34a', '#0ea5e9', '#eab308', '#8b5cf6', '#ef4444'][i % 5]), cornerradius: 8 },
                text: yields.map(y => `${y} t/ha`),
                textposition: 'outside'
            }], {
                yaxis: { title: 'Avg Yield (t/ha)' },
                margin: { t: 10, b: 40, l: 50, r: 20 },
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { family: 'Inter' }
            }, { responsive: true, displayModeBar: false });
        });
    } catch { /* offline ok */ }
    // Also load user's posts
    loadMyPosts();
}

async function loadMyPosts() {
    const container = document.getElementById('my-community-posts');
    if (!container) return;
    try {
        const data = await fetch(`${API}/community/my_posts?username=${encodeURIComponent(state.user?.username || 'anonymous')}`).then(r => r.json());
        if (!data.posts?.length) {
            container.innerHTML = '<p class="muted-text">You haven\'t shared any data yet. Share your first post above!</p>';
            return;
        }
        let html = '<div class="my-posts-list">';
        data.posts.forEach(p => {
            const date = p.created_at ? new Date(p.created_at).toLocaleDateString() : '';
            html += `<div class="my-post-card">
                <div class="my-post-header">
                    <strong>${p.crop_type}</strong>
                    <small>${date}</small>
                </div>
                <div class="my-post-details">
                    <span><i class="fas fa-wheat-awn"></i> ${p.yield_data} t/ha</span>
                    <span><i class="fas fa-rupee-sign"></i> ₹${p.market_price?.toLocaleString()}/ton</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${p.region}</span>
                    <span><i class="fas fa-leaf"></i> ${p.practice}</span>
                </div>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch {
        container.innerHTML = '<p class="muted-text">Could not load your posts.</p>';
    }
}

// ═══════════════════════════════════════
//  MARKET FORECAST
// ═══════════════════════════════════════

async function generateMarketForecast() {
    const crop = document.getElementById('market-crop').value;
    const period = document.getElementById('forecast-period').value;
    showLoading('Generating market forecast...');
    try {
        const data = await fetch(`${API}/market/dashboard?crop=${encodeURIComponent(crop)}&period=${period}%20months`).then(r => r.json());
        if (data.forecast?.length) {
            const months = data.forecast.map(f => f.month_name || f.month);
            const prices = data.forecast.map(f => f.price);
            const confs = data.forecast.map(f => f.confidence * 100);
            Plotly.newPlot('market-price-chart', [
                { x: months, y: prices, type: 'scatter', mode: 'lines+markers', name: 'Price (₹/ton)', line: { color: '#16a34a', width: 3, shape: 'spline' }, marker: { size: 8 } },
                { x: months, y: confs, type: 'scatter', mode: 'lines', name: 'Confidence %', line: { color: '#0ea5e9', width: 2, dash: 'dot' }, yaxis: 'y2' }
            ], {
                yaxis: { title: '₹/ton' },
                yaxis2: { title: 'Confidence %', overlaying: 'y', side: 'right', range: [0, 100] },
                margin: { t: 10, b: 40, l: 60, r: 60 },
                legend: { orientation: 'h', y: -0.15 },
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { family: 'Inter' }
            }, { responsive: true, displayModeBar: false });
        }
        // Insights
        const insEl = document.getElementById('market-insights');
        insEl.innerHTML = `<h3 class="card-title"><i class="fas fa-lightbulb"></i> Market Insights</h3>
            <ul style="padding-left:1.25rem;font-size:0.9rem;line-height:1.8">
                <li><strong>Current Price:</strong> ₹${data.current_price?.toLocaleString()}/ton</li>
                <li><strong>Predicted:</strong> ₹${data.predicted_price?.toLocaleString()}/ton</li>
                <li><strong>Change:</strong> <span style="color:${data.price_change_percent >= 0 ? 'var(--farm-green)' : 'var(--farm-red)'}">${data.price_change_percent >= 0 ? '▲' : '▼'} ${Math.abs(data.price_change_percent)}%</span></li>
                <li><strong>Recommendation:</strong> ${data.recommendation}</li>
                <li>${data.analysis}</li>
            </ul>`;
        if (state.language !== 'en') _translateAllTextIn(insEl, state.language);
        toast('Market forecast generated 📈', 'success');
    } catch {
        toast('Could not generate forecast', 'error');
    } finally {
        hideLoading();
    }
}

// ═══════════════════════════════════════
//  CHATBOT
// ═══════════════════════════════════════

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const query = input.value.trim();
    if (!query) return;
    input.value = '';
    const messages = document.getElementById('chat-messages');

    // User message
    messages.innerHTML += `<div class="chat-msg user"><div class="chat-avatar"><i class="fas fa-user"></i></div><div class="chat-bubble">${escapeHtml(query)}</div></div>`;
    // Typing indicator
    messages.innerHTML += `<div class="chat-msg ai" id="typing-indicator"><div class="chat-avatar"><i class="fas fa-robot"></i></div><div class="chat-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>`;
    messages.scrollTop = messages.scrollHeight;

    try {
        const data = await fetchAPI('/chatbot/ask', { username: state.user?.username || 'anonymous', query });
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
        const responseHtml = (data.response || 'Sorry, I could not process that.').replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        messages.innerHTML += `<div class="chat-msg ai animate-fade-in"><div class="chat-avatar"><i class="fas fa-robot"></i></div><div class="chat-bubble">${responseHtml}</div></div>`;
        // Auto-translate chat response
        if (state.language !== 'en') {
            const lastBubble = messages.querySelector('.chat-msg.ai:last-child .chat-bubble');
            if (lastBubble) _translateAllTextIn(lastBubble, state.language);
        }
    } catch {
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
        messages.innerHTML += `<div class="chat-msg ai"><div class="chat-avatar"><i class="fas fa-robot"></i></div><div class="chat-bubble">Sorry, I'm offline right now. Please try again when connected.</div></div>`;
    }
    messages.scrollTop = messages.scrollHeight;
}

// ═══════════════════════════════════════
//  WEATHER
// ═══════════════════════════════════════

async function getWeatherForecast() {
    const lat = parseFloat(document.getElementById('weather-lat').value) || 12.9716;
    const lon = parseFloat(document.getElementById('weather-lon').value) || 77.5946;
    const crop = document.getElementById('weather-crop').value;
    showLoading('Fetching real-time weather...');
    try {
        const data = await fetchAPI('/weather', { lat, lon, crop_type: crop });
        const container = document.getElementById('weather-results');
        // Current weather card
        let html = `<div class="card"><h3 class="card-title"><i class="fas fa-sun"></i> Current Weather — ${data.current_weather?.city || ''}</h3>
            <div class="stat-grid">
                <div class="stat-card stat-green"><i class="fas fa-thermometer-half stat-icon"></i><div class="stat-value">${Math.round(data.current_weather?.temperature || 0)}°C</div><div class="stat-label">Temperature</div></div>
                <div class="stat-card stat-blue"><i class="fas fa-tint stat-icon"></i><div class="stat-value">${data.current_weather?.humidity || 0}%</div><div class="stat-label">Humidity</div></div>
                <div class="stat-card stat-amber"><i class="fas fa-wind stat-icon"></i><div class="stat-value">${data.current_weather?.wind_speed || 0}</div><div class="stat-label">Wind (m/s)</div></div>
                <div class="stat-card stat-purple"><i class="fas fa-cloud stat-icon"></i><div class="stat-value">${data.current_weather?.clouds || 0}%</div><div class="stat-label">Clouds</div></div>
            </div></div>`;

        // Agricultural conditions
        const risk = data.agricultural_conditions?.overall_risk || 'unknown';
        const riskClass = risk === 'low' ? 'low-risk' : risk === 'medium' ? 'medium-risk' : 'high-risk';
        html += `<div class="weather-risk-cards">
            <div class="risk-card ${riskClass}"><i class="fas fa-shield-alt"></i><br>Risk: ${risk.toUpperCase()}</div>
            <div class="risk-card low-risk"><i class="fas fa-thermometer-half"></i><br>Avg: ${data.metrics?.avg_temperature || '—'}°C</div>
            <div class="risk-card low-risk"><i class="fas fa-cloud-rain"></i><br>Rain: ${data.metrics?.total_rainfall || '0'}mm</div>
        </div>`;

        // Recommendations
        if (data.recommendations?.length) {
            html += `<div class="card mt-4"><h3 class="card-title"><i class="fas fa-exclamation-circle"></i> Agricultural Advisories</h3><ul style="padding-left:1.25rem;font-size:0.9rem;line-height:1.8">`;
            data.recommendations.forEach(r => html += `<li>${r}</li>`);
            html += '</ul></div>';
        }
        container.innerHTML = html;
        if (state.language !== 'en') _translateAllTextIn(container, state.language);

        // Forecast chart — simplified for farmers
        if (data.forecast?.length) {
            const times = data.forecast.map(f => {
                const d = new Date(f.datetime);
                return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
            });
            const temps = data.forecast.map(f => f.temperature);
            const hums = data.forecast.map(f => f.humidity);

            // Simple bar chart — temp only, color-coded
            const colors = temps.map(t => t > 35 ? '#ef4444' : t > 28 ? '#f97316' : t > 20 ? '#22c55e' : '#0ea5e9');
            const labels = temps.map(t => t > 35 ? '🔥 Hot' : t > 28 ? '☀️ Warm' : t > 20 ? '🌤️ Nice' : '❄️ Cool');

            Plotly.newPlot('weather-forecast-chart', [{
                x: times, y: temps,
                type: 'bar',
                marker: { color: colors, cornerradius: 8 },
                text: labels,
                textposition: 'outside',
                hovertemplate: '%{x}<br>%{y}°C<extra></extra>'
            }], {
                yaxis: { title: 'Temperature °C', range: [0, Math.max(...temps) + 10] },
                margin: { t: 20, b: 40, l: 50, r: 20 },
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { family: 'Inter', size: 12 }
            }, { responsive: true, displayModeBar: false });

            // Build simple explanation
            const maxTemp = Math.max(...temps);
            const minTemp = Math.min(...temps);
            const avgHum = Math.round(hums.reduce((a, b) => a + b, 0) / hums.length);
            const hotDays = temps.filter(t => t > 35).length;
            const rainyDays = hums.filter(h => h > 80).length;

            let explain = `<p>Over the next 7 days, temperature will range from <strong>${Math.round(minTemp)}°C to ${Math.round(maxTemp)}°C</strong>.</p>`;
            explain += `<p>Average humidity: <strong>${avgHum}%</strong>.</p>`;
            if (hotDays > 0) explain += `<p>🔥 <strong>${hotDays} hot day${hotDays > 1 ? 's' : ''}</strong> above 35°C — ensure crops have enough water and consider shade nets.</p>`;
            if (rainyDays > 0) explain += `<p>🌧️ <strong>${rainyDays} humid day${rainyDays > 1 ? 's' : ''}</strong> (>80% humidity) — watch for fungal diseases. Avoid spraying pesticides on these days.</p>`;
            if (minTemp < 15) explain += `<p>❄️ Cold nights expected — cover frost-sensitive crops.</p>`;
            if (hotDays === 0 && rainyDays === 0 && minTemp >= 15) explain += `<p>🌤️ Good weather ahead — ideal for fieldwork and planting!</p>`;

            lastWeatherExplanation = explain.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const summaryDiv = document.getElementById('weather-simple-summary');
            if (summaryDiv) {
                summaryDiv.style.display = 'block';
                document.getElementById('weather-explain-text').innerHTML = explain;
                if (state.language !== 'en') _translateAllTextIn(summaryDiv, state.language);
            }
        }
        toast('Weather data updated 🌤️', 'success');
        // Auto-speak weather for illiterate farmers
        const weatherSpeech = `Current temperature is ${Math.round(data.current_weather?.temperature || 0)} degrees, humidity ${data.current_weather?.humidity || 0} percent. Risk level: ${data.agricultural_conditions?.overall_risk || 'unknown'}. ${data.recommendations?.[0] || ''}`;
        autoSpeak(weatherSpeech);
        addSpeakerButton(container, weatherSpeech);
    } catch {
        toast('Weather service unavailable', 'error');
    } finally {
        hideLoading();
    }
}

// ═══════════════════════════════════════
//  SOIL ANALYSIS
// ═══════════════════════════════════════

function previewSoilPhoto(input) {
    if (!input.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('soil-preview');
        preview.innerHTML = `<img src="${e.target.result}" alt="Soil" style="max-height:180px;border-radius:12px;margin:0 auto">`;
        preview.style.display = '';
    };
    reader.readAsDataURL(input.files[0]);
}

async function analyzeSoil() {
    const fileInput = document.getElementById('soil-photo');
    if (!fileInput.files?.[0]) { toast('Please upload a soil photo', 'info'); return; }
    showLoading('AI is analyzing your soil...');
    try {
        const formData = new FormData();
        formData.append('soil_photo', fileInput.files[0]);
        const res = await fetch(`${API}/soil_analysis`, { method: 'POST', body: formData });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error('Server error — please try again later');
        }
        if (!res.ok) throw new Error(data.detail || 'Analysis failed');
        showSoilResult(data.soil_type);
        addActivity('Soil analysis completed', 'green');
    } catch (err) {
        toast(err.message || 'Soil analysis failed', 'error');
    } finally {
        hideLoading();
    }
}

function selectSoilType(type) {
    document.querySelectorAll('.soil-opt').forEach(o => o.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    showSoilResult(type);
}

function showSoilResult(soilType) {
    const info = {
        Loamy: { color: '#8B7355', desc: 'Best all-around soil. Rich in nutrients with good drainage. Ideal for wheat, corn, vegetables.' },
        Sandy: { color: '#C2B280', desc: 'Drains quickly, warms fast in spring. Good for root crops, groundnut, watermelon.' },
        Clay: { color: '#8B4513', desc: 'Heavy, retains water. Excellent for rice and wheat. Add organic matter for better structure.' },
        Black: { color: '#3B3131', desc: 'Rich in calcium and magnesium. Ideal for cotton, soybean, and citrus. Good water retention.' },
        Red: { color: '#A0522D', desc: 'Iron-rich, slightly acidic. Good for pulses, millets, and groundnut. Add lime to improve pH.' }
    };
    const i = info[soilType] || { color: '#888', desc: 'Unknown soil type.' };
    document.getElementById('soil-results').innerHTML = `
        <div class="card animate-scale-in">
            <h3 class="card-title"><i class="fas fa-check-circle" style="color:var(--farm-green)"></i> Soil Type Detected: <strong>${soilType}</strong></h3>
            <div style="display:flex;align-items:center;gap:1rem;margin:1rem 0">
                <div style="width:64px;height:64px;border-radius:16px;background:${i.color}"></div>
                <p style="font-size:0.92rem;flex:1">${i.desc}</p>
            </div>
            <p class="muted-text">Tip: You can use this soil type in Farm Setup for better AI recommendations.</p>
        </div>`;
    const soilResultEl = document.getElementById('soil-results');
    if (state.language !== 'en') _translateAllTextIn(soilResultEl, state.language);
    autoSpeak(`Soil type is ${soilType}. ${i.desc}`);
    // Auto-set soil type in farm setup
    const sel = document.getElementById('soil-type');
    for (const opt of sel.options) {
        if (opt.value === soilType) { sel.value = soilType; break; }
    }
}

// ═══════════════════════════════════════
//  PEST PREDICTION
// ═══════════════════════════════════════

async function predictPests() {
    const crop = document.getElementById('pest-crop').value;
    const soil = document.getElementById('pest-soil').value;
    const temp = parseFloat(document.getElementById('pest-temp').value) || 25;
    const humidity = parseFloat(document.getElementById('pest-humidity').value) || 65;
    const rainfall = parseFloat(document.getElementById('pest-rainfall').value) || 500;
    showLoading('Analyzing pest risks...');
    try {
        const data = await fetchAPI('/pest_prediction', { crop_type: crop, soil_type: soil, temperature: temp, humidity, rainfall });
        const container = document.getElementById('pest-results');
        const risk = data.overall_risk || 'low';
        let html = `<div class="card"><h3 class="card-title"><i class="fas fa-shield-alt"></i> Overall Risk: <span style="color:${risk === 'high' ? 'var(--farm-red)' : risk === 'medium' ? 'var(--farm-yellow)' : 'var(--farm-green)'}">${risk.toUpperCase()}</span></h3>
            <p class="muted-text">${data.analysis || ''}</p></div>`;

        if (data.predictions?.length) {
            html += '<div class="pest-grid mt-4">';
            data.predictions.forEach(p => {
                const sev = p.severity || 'low';
                html += `<div class="pest-card ${sev}-risk">
                    <h4>${p.pest}</h4>
                    <span class="pest-risk-badge ${sev}">${sev} risk</span>
                    <p style="margin-top:0.5rem;font-size:0.85rem">Probability: <strong>${Math.round(p.probability * 100)}%</strong></p>
                    <p style="font-size:0.82rem;color:var(--fg-muted);margin-top:0.25rem">${p.recommendation || ''}</p>
                </div>`;
            });
            html += '</div>';
        }

        if (data.prevention_tips?.length) {
            html += `<div class="card mt-4"><h3 class="card-title"><i class="fas fa-lightbulb"></i> Prevention Tips</h3>
                <ul style="padding-left:1.25rem;font-size:0.9rem;line-height:1.8">`;
            data.prevention_tips.forEach(t => html += `<li>${t}</li>`);
            html += '</ul></div>';
        }
        container.innerHTML = html;
        if (state.language !== 'en') _translateAllTextIn(container, state.language);
        toast('Pest analysis complete 🐛', 'success');
        // Auto-speak pest result for illiterate farmers
        let pestSpeech = `Pest risk for ${crop} is ${risk}. `;
        if (data.predictions?.length) pestSpeech += 'Main risks: ' + data.predictions.slice(0, 2).map(p => p.pest).join(' and ') + '. ';
        if (data.prevention_tips?.length) pestSpeech += 'Tip: ' + data.prevention_tips[0];
        autoSpeak(pestSpeech);
        addSpeakerButton(container, pestSpeech);
    } catch {
        toast('Failed to predict pests', 'error');
    } finally {
        hideLoading();
    }
}

// ═══════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════

async function loadHistory() {
    const container = document.getElementById('history-table-container');
    try {
        const recs = await fetch(`${API}/previous_recommendations?username=${state.user?.username || 'anonymous'}`).then(r => r.json());
        if (recs?.length) {
            let html = '<table class="history-table"><thead><tr><th>Date</th><th>Crop / Type</th><th>Score</th><th>Details</th></tr></thead><tbody>';
            recs.forEach(r => {
                html += `<tr><td>${r.timestamp || '—'}</td><td>${r.crop || '—'}</td><td>${r.score ? Math.round(r.score) : '—'}</td><td style="max-width:300px;font-size:0.82rem">${(r.recommendation || '').substring(0, 120)}...</td></tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;

            // Analytics chart
            Plotly.newPlot('history-analytics-chart', [{
                x: recs.map(r => r.timestamp),
                y: recs.map(r => r.score || 0),
                type: 'scatter', mode: 'lines+markers',
                line: { color: '#16a34a', width: 3 },
                marker: { size: 8 }
            }], {
                yaxis: { title: 'Score' },
                margin: { t: 10, b: 40, l: 50, r: 20 },
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { family: 'Inter' }
            }, { responsive: true, displayModeBar: false });
        } else if (state.recommendations.length) {
            // Use local data
            let html = '<table class="history-table"><thead><tr><th>Date</th><th>Crop</th><th>Score</th></tr></thead><tbody>';
            state.recommendations.forEach(r => {
                const crop = r.central_coordinator?.final_crop || r.recommendation?.substring(0, 30) || '—';
                const score = r.central_coordinator?.overall_score || '—';
                html += `<tr><td>${r.timestamp || '—'}</td><td>${crop}</td><td>${score}</td></tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        }
    } catch {
        if (state.recommendations.length) {
            let html = '<table class="history-table"><thead><tr><th>Date</th><th>Crop</th><th>Score</th></tr></thead><tbody>';
            state.recommendations.slice(0, 10).forEach(r => {
                const crop = r.central_coordinator?.final_crop || '—';
                const score = r.central_coordinator?.overall_score || '—';
                html += `<tr><td>${new Date(r.timestamp).toLocaleDateString()}</td><td>${crop}</td><td>${score}</td></tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        }
    }
}

function exportRecommendations() {
    if (!state.recommendations.length) { toast('No recommendations to export', 'info'); return; }
    let csv = 'Date,Crop,Score,Details\n';
    state.recommendations.forEach(r => {
        const crop = r.central_coordinator?.final_crop || '—';
        const score = r.central_coordinator?.overall_score || '';
        const details = (r.central_coordinator?.reasoning || '').replace(/,/g, ';').replace(/\n/g, ' ');
        csv += `"${r.timestamp}","${crop}","${score}","${details}"\n`;
    });
    downloadFile(csv, 'agrismart_recommendations.csv', 'text/csv');
    toast('Exported as CSV', 'success');
}

// ═══════════════════════════════════════
//  OFFLINE
// ═══════════════════════════════════════

function setupNetworkListeners() {
    window.addEventListener('online', () => { state.isOffline = false; updateOfflineUI(); toast('Back online! 🌐', 'success'); });
    window.addEventListener('offline', () => { state.isOffline = true; updateOfflineUI(); toast('You are offline — data will sync later', 'info'); });
}

function updateOfflineUI() {
    const bar = document.getElementById('offline-bar');
    if (bar) bar.style.display = state.isOffline ? '' : 'none';
}

function updateOfflinePage() {
    const box = document.getElementById('offline-status-box');
    if (state.isOffline) {
        box.className = 'status-box offline';
        box.innerHTML = '<i class="fas fa-wifi-slash"></i><span>You are offline — basic features available</span>';
    } else {
        box.className = 'status-box online';
        box.innerHTML = '<i class="fas fa-wifi text-green"></i><span>You are online — All features available</span>';
    }
    document.getElementById('offline-recs-count').textContent = state.recommendations.length;
    const pending = JSON.parse(localStorage.getItem('agri_pending_sync') || '[]');
    document.getElementById('offline-pending-count').textContent = pending.length;
}

async function syncOfflineData() {
    if (state.isOffline) { toast('Cannot sync while offline', 'info'); return; }
    showLoading('Syncing data...');
    try {
        const res = await fetch(`${API}/offline/sync/${state.user?.username || 'anonymous'}`, { method: 'POST' });
        const data = await res.json();
        localStorage.setItem('agri_pending_sync', '[]');
        updateOfflinePage();
        toast(`Synced ${data.synced_count || 0} items ✅`, 'success');
    } catch {
        toast('Sync failed — try again later', 'error');
    } finally {
        hideLoading();
    }
}

// ═══════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════

function switchProfileTab(tab) {
    document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ptab-content').forEach(c => c.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById(`ptab-${tab}`).classList.add('active');
}

async function loadProfileData() {
    if (!state.user) return;
    // Fill fields
    document.getElementById('farmer-name').value = state.user.username || '';
    document.getElementById('farm-name').value = state.user.farm_name || '';
    document.getElementById('profile-phone').value = state.user.phone || '';
    document.getElementById('profile-email').value = state.user.email || '';
    document.getElementById('profile-location').value = state.user.location || '';
    if (state.farmSetup) {
        document.getElementById('profile-farm-size').value = state.farmSetup.land_size || 5;
    }

    // Try loading from server
    try {
        const data = await fetch(`${API}/user/profile/${state.user.username}`).then(r => r.json());
        if (data.username) {
            document.getElementById('profile-email').value = data.email || '';
            document.getElementById('profile-phone').value = data.phone || '';
            document.getElementById('profile-location').value = data.location || '';
            if (data.experience_level) {
                document.getElementById('experience-level').value = data.experience_level;
            }
            if (data.farm_size) {
                document.getElementById('profile-farm-size').value = data.farm_size;
            }
        }
    } catch { /* offline ok */ }

    // Recent recs
    const recsEl = document.getElementById('profile-recent-recs');
    if (state.recommendations.length) {
        let html = '';
        state.recommendations.slice(0, 5).forEach(r => {
            const crop = r.central_coordinator?.final_crop || r.recommendation?.substring(0, 40) || '—';
            const score = r.central_coordinator?.overall_score || '';
            html += `<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);font-size:0.9rem">
                <span>${crop}</span><span style="font-weight:600">${score ? score + '/10' : ''}</span></div>`;
        });
        recsEl.innerHTML = html;
    }
}

async function saveProfile() {
    showLoading('Saving profile...');
    try {
        await fetchAPI('/user/profile', {
            username: state.user?.username,
            new_username: document.getElementById('farmer-name').value.trim() || undefined,
            farm_name: document.getElementById('farm-name').value.trim() || undefined,
            email: document.getElementById('profile-email').value.trim() || undefined,
            phone: document.getElementById('profile-phone').value.trim() || undefined,
            location: document.getElementById('profile-location').value.trim() || undefined,
            experience_level: document.getElementById('experience-level').value || undefined,
            farm_size: parseFloat(document.getElementById('profile-farm-size').value) || undefined
        }, 'PUT');
        // Update local state
        state.user.farm_name = document.getElementById('farm-name').value.trim();
        state.user.phone = document.getElementById('profile-phone').value.trim();
        state.user.location = document.getElementById('profile-location').value.trim();
        localStorage.setItem('agri_user', JSON.stringify(state.user));
        updateSidebarProfile();
        toast('Profile saved! ✅', 'success');
    } catch {
        toast('Could not save profile', 'error');
    } finally {
        hideLoading();
    }
}

function exportProfileData() {
    const data = {
        user: state.user,
        farmSetup: state.farmSetup,
        recommendations: state.recommendations,
        exportDate: new Date().toISOString()
    };
    downloadFile(JSON.stringify(data, null, 2), 'agrismart_data.json', 'application/json');
    toast('Data exported as JSON', 'success');
}

// ═══════════════════════════════════════
//  LANGUAGE
// ═══════════════════════════════════════

function toggleLangMenu() {
    document.getElementById('lang-menu').classList.toggle('open');
}

function changeLanguage(lang) {
    state.language = lang;
    localStorage.setItem('agri_lang', lang);
    const labels = { en: 'EN', hi: 'हि', kn: 'ಕ', te: 'తె', ta: 'த', ml: 'മ', bn: 'বা', gu: 'ગુ', mr: 'म', pa: 'ਪ', or: 'ଓ' };
    document.getElementById('lang-label').textContent = labels[lang] || lang.toUpperCase();
    document.getElementById('lang-menu').classList.remove('open');
    if (document.getElementById('settings-language')) {
        document.getElementById('settings-language').value = lang;
    }
    // Apply hardcoded translations first
    applyTranslations(lang);
    // Then dynamically translate remaining text via deep-translator API
    dynamicTranslateApp(lang);
    // Restart observer for new language
    startTranslationObserver();
    const langNames = { en: 'English', hi: '\u0939\u093F\u0902\u0926\u0940', kn: '\u0C95\u0CA8\u0CCD\u0CA8\u0CA1', te: '\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41', ta: '\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD', ml: '\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02', bn: '\u09AC\u09BE\u0982\u09B2\u09BE', gu: '\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0', mr: '\u092E\u0930\u093E\u0920\u0940', pa: '\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40', or: '\u0B13\u0B21\u0B3C\u0B3F\u0B06' };
    toast(`${langNames[lang] || lang.toUpperCase()} ✓`, 'info');
}

// Close lang menu on outside click
document.addEventListener('click', (e) => {
    const langFloat = document.getElementById('lang-float');
    if (langFloat && !langFloat.contains(e.target)) {
        document.getElementById('lang-menu').classList.remove('open');
    }
});

// ═══════════════════════════════════════
//  VOICE ASSISTANT PANEL
// ═══════════════════════════════════════

let voicePanelOpen = false;
let lastVoiceResponse = '';

function toggleVoicePanel() {
    const panel = document.getElementById('voice-panel');
    if (!panel) return;
    if (voicePanelOpen) {
        closeVoicePanel();
    } else {
        openVoicePanel();
    }
}

function openVoicePanel() {
    const panel = document.getElementById('voice-panel');
    if (!panel) return;
    panel.style.display = 'flex';
    voicePanelOpen = true;
    document.getElementById('voice-btn').classList.add('panel-open');
    // Reset state
    setVoiceState('idle');
    document.getElementById('vp-transcript').style.display = 'none';
    document.getElementById('vp-response').style.display = 'none';
    // Update command labels for current language
    updateVoiceCommandLabels();
}

function closeVoicePanel() {
    const panel = document.getElementById('voice-panel');
    if (!panel) return;
    panel.style.display = 'none';
    voicePanelOpen = false;
    document.getElementById('voice-btn').classList.remove('panel-open');
    // Stop any ongoing listening/speaking
    if (window.voiceInterface) {
        window.voiceInterface.stopListening();
        window.voiceInterface.stopSpeaking();
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}

function toggleVoiceListening() {
    if (!window.voiceInterface) {
        toast('Voice not supported in this browser', 'error');
        return;
    }
    if (window.voiceInterface.isListening) {
        window.voiceInterface.stopListening();
        setVoiceState('idle');
    } else {
        // Sync language from app's lang selector
        const appLang = localStorage.getItem('agri_lang') || 'en';
        window.voiceInterface.setLanguage(appLang);
        // Clear previous results
        document.getElementById('vp-transcript').style.display = 'none';
        document.getElementById('vp-response').style.display = 'none';
        // Start listening
        const started = window.voiceInterface.startListening();
        if (started) {
            setVoiceState('listening');
        } else {
            setVoiceState('error');
        }
    }
}

function setVoiceState(state) {
    const stateIcon = document.getElementById('vp-state-icon');
    const stateText = document.getElementById('vp-state-text');
    const wave = document.getElementById('vp-wave');
    const micBtn = document.getElementById('vp-mic-btn');
    const micIcon = document.getElementById('vp-mic-icon');
    const fabBtn = document.getElementById('voice-btn');
    const fabIcon = document.getElementById('voice-btn-icon');

    // Remove all state classes
    micBtn.classList.remove('listening', 'processing', 'speaking', 'error');
    fabBtn.classList.remove('listening', 'speaking', 'error');
    wave.style.display = 'none';

    const lang = localStorage.getItem('agri_lang') || 'en';
    const texts = {
       idle:       { en: 'Tap the mic to speak', hi: 'माइक दबाएं और बोलें', kn: 'ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ', te: 'మైక్ నొక్కి మాట్లాడండి', ta: 'மைக் அழுத்தி பேசுங்கள்' },
       listening:  { en: '🎤 Listening... speak now', hi: '🎤 सुन रहे हैं... अभी बोलें', kn: '🎤 ಕೇಳುತ್ತಿದ್ದೇನೆ... ಈಗ ಮಾತನಾಡಿ', te: '🎤 వింటున్నాను... ఇప్పుడు మాట్లాడండి', ta: '🎤 கேட்கிறேன்... இப்போது பேசுங்கள்' },
       processing: { en: '🧠 Thinking...', hi: '🧠 सोच रहे हैं...', kn: '🧠 ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ...', te: '🧠 ఆలోచిస్తున్నాను...', ta: '🧠 சிந்திக்கிறேன்...' },
       speaking:   { en: '🔊 Speaking...', hi: '🔊 बोल रहे हैं...', kn: '🔊 ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ...', te: '🔊 చెప్తున్నాను...', ta: '🔊 பேசுகிறேன்...' },
       error:      { en: '❌ Could not hear. Try again.', hi: '❌ सुनाई नहीं दिया। फिर बोलें।', kn: '❌ ಕೇಳಿಸಲಿಲ್ಲ. ಮತ್ತೆ ಹೇಳಿ.', te: '❌ వినబడలేదు. మళ్ళీ చెప్పండి.', ta: '❌ கேட்கவில்லை. மீண்டும் சொல்லுங்கள்.' }
    };
    stateText.textContent = texts[state]?.[lang] || texts[state]?.en || '';

    switch(state) {
        case 'listening':
            stateIcon.innerHTML = '<i class="fas fa-ear-listen" style="color:#ef4444"></i>';
            stateIcon.className = 'vp-state-icon listening';
            wave.style.display = 'flex';
            micBtn.classList.add('listening');
            micIcon.className = 'fas fa-stop';
            fabBtn.classList.add('listening');
            fabIcon.className = 'fas fa-stop';
            break;
        case 'processing':
            stateIcon.innerHTML = '<i class="fas fa-brain" style="color:#8b5cf6"></i>';
            stateIcon.className = 'vp-state-icon processing';
            micBtn.classList.add('processing');
            micIcon.className = 'fas fa-spinner fa-spin';
            fabIcon.className = 'fas fa-spinner fa-spin';
            break;
        case 'speaking':
            stateIcon.innerHTML = '<i class="fas fa-volume-up" style="color:#3b82f6"></i>';
            stateIcon.className = 'vp-state-icon speaking';
            micBtn.classList.add('speaking');
            micIcon.className = 'fas fa-volume-up';
            fabBtn.classList.add('speaking');
            fabIcon.className = 'fas fa-volume-up';
            break;
        case 'error':
            stateIcon.innerHTML = '<i class="fas fa-exclamation-circle" style="color:#ef4444"></i>';
            stateIcon.className = 'vp-state-icon error';
            micBtn.classList.add('error');
            micIcon.className = 'fas fa-microphone';
            fabIcon.className = 'fas fa-microphone';
            break;
        default: // idle
            stateIcon.innerHTML = '<i class="fas fa-microphone" style="color:#22c55e"></i>';
            stateIcon.className = 'vp-state-icon';
            micIcon.className = 'fas fa-microphone';
            fabIcon.className = 'fas fa-microphone';
    }
}

function showVoiceTranscript(text) {
    const el = document.getElementById('vp-transcript');
    const textEl = document.getElementById('vp-transcript-text');
    if (el && textEl) {
        textEl.textContent = text;
        el.style.display = 'block';
    }
}

function showVoiceResponse(text) {
    const el = document.getElementById('vp-response');
    const textEl = document.getElementById('vp-response-text');
    if (el && textEl) {
        lastVoiceResponse = text;
        textEl.textContent = text;
        el.style.display = 'block';
    }
}

function replayVoiceResponse() {
    if (lastVoiceResponse && window.voiceInterface) {
        setVoiceState('speaking');
        window.voiceInterface.speak(lastVoiceResponse);
        // Monitor when speech ends
        const checkEnd = setInterval(() => {
            if (!window.speechSynthesis.speaking) {
                clearInterval(checkEnd);
                setVoiceState('idle');
            }
        }, 300);
    }
}

async function handleVoiceQuery(text) {
    // If a voice conversation flow is active, route there
    if (voiceConvo && voiceConvo.active) {
        handleConvoResponse(text);
        return;
    }

    // Show what user said
    showVoiceTranscript(text);
    setVoiceState('processing');

    try {
        // Call the chatbot API
        const response = await fetch(`${API}/chatbot/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: text, username: localStorage.getItem('agri_username') || 'farmer' })
        });
        const data = await response.json();
        const answer = data.response || 'Sorry, I could not get an answer.';

        // Clean markdown/HTML for display
        const cleanAnswer = answer.replace(/[#*_`]/g, '').replace(/<[^>]*>/g, '').trim();
        showVoiceResponse(cleanAnswer);

        // Speak the response
        setVoiceState('speaking');
        if (window.voiceInterface) {
            // Truncate for TTS
            const speakText = cleanAnswer.length > 500 ? cleanAnswer.substring(0, 500) + '...' : cleanAnswer;
            window.voiceInterface.speak(speakText);
        }

        // Monitor when speech ends
        const checkEnd = setInterval(() => {
            if (!window.speechSynthesis.speaking) {
                clearInterval(checkEnd);
                setVoiceState('idle');
            }
        }, 300);

    } catch (err) {
        console.error('Voice query error:', err);
        showVoiceResponse('Could not connect to server. Please try again.');
        setVoiceState('error');
        setTimeout(() => setVoiceState('idle'), 2000);
    }
}

function voiceQuickCommand(command) {
    if (!window.voiceInterface) return;
    showVoiceTranscript(command);
    // Let voice-interface process the command
    window.voiceInterface.processVoiceCommandEnhanced(command, []);
}

function updateVoiceCommandLabels() {
    // Could localize chip labels in future
}

// Legacy compatibility
function toggleVoiceInterface() {
    toggleVoicePanel();
}

// ═══════════════════════════════════════════════════════════════
//  VOICE CONVERSATION ENGINE
//  Multi-step conversational flows for entire app via voice
//  Handles: login, signup, farm setup, navigation, actions
// ═══════════════════════════════════════════════════════════════

const voiceConvo = {
    active: false,
    flow: null,      // current flow name
    step: 0,         // current step index
    data: {},        // collected data
    listening: false
};

// All voice flows defined as step arrays
const voiceFlows = {
    signup: [
        { ask: { en: 'What is your name?', hi: 'आपका नाम क्या है?', kn: 'ನಿಮ್ಮ ಹೆಸರೇನು?', te: 'మీ పేరు ఏమిటి?', ta: 'உங்கள் பெயர் என்ன?' }, field: 'username' },
        { ask: { en: 'What is your farm name?', hi: 'आपके खेत का नाम क्या है?', kn: 'ನಿಮ್ಮ ಜಮೀನಿನ ಹೆಸರೇನು?', te: 'మీ పొలం పేరు ఏమిటి?', ta: 'உங்கள் பண்ணை பெயர் என்ன?' }, field: 'farm_name' },
        { ask: { en: 'What is your phone number? Say skip if you don\'t want to share.', hi: 'आपका फोन नंबर क्या है? नहीं देना हो तो "छोड़ें" बोलें।', kn: 'ನಿಮ್ಮ ಫೋನ್ ನಂಬರ್ ಏನು? "ಬಿಡಿ" ಎಂದು ಹೇಳಿ.', te: 'మీ ఫోన్ నంబర్ ఏమిటి? "వదిలేయండి" అని చెప్పండి.', ta: 'உங்கள் தொலைபேசி எண் என்ன? "விடு" என்று சொல்லுங்கள்.' }, field: 'phone', optional: true },
        { ask: { en: 'Where is your farm located? Which village or city?', hi: 'आपका खेत कहां है? कौन सा गांव या शहर?', kn: 'ನಿಮ್ಮ ಜಮೀನು ಎಲ್ಲಿದೆ? ಯಾವ ಊರು?', te: 'మీ పొలం ఎక్కడ ఉంది? ఏ ఊరు?', ta: 'உங்கள் பண்ணை எங்கே? எந்த கிராமம்?' }, field: 'location', optional: true }
    ],
    login: [
        { ask: { en: 'What is your phone number to login?', hi: 'लॉगिन के लिए अपना फोन नंबर बताएं।', kn: 'ಲಾಗಿನ್ ಆಗಲು ನಿಮ್ಮ ಫೋನ್ ನಂಬರ್ ಹೇಳಿ.', te: 'లాగిన్ కోసం మీ ఫోన్ నంబర్ చెప్పండి.', ta: 'லாகின் செய்ய உங்கள் தொலைபேசி எண் சொல்லுங்கள்.' }, field: 'phone' }
    ],
    farmSetup: [
        { ask: { en: 'What crop do you want to grow? For example: Rice, Wheat, Corn, Tomato, Cotton.', hi: 'आप कौन सी फसल उगाना चाहते हैं? जैसे: चावल, गेहूं, मक्का, टमाटर, कपास।', kn: 'ಯಾವ ಬೆಳೆ ಬೆಳೆಯಬೇಕು? ಉದಾ: ಭತ್ತ, ಗೋಧಿ, ಜೋಳ, ಟೊಮೆಟೊ.', te: 'ఏ పంట పండించాలనుకుంటున్నారు? ఉదా: వరి, గోధుమ, మొక్కజొన్న.', ta: 'என்ன பயிர் பயிரிட விரும்புகிறீர்கள்? உதா: அரிசி, கோதுமை.' }, field: 'crop' },
        { ask: { en: 'What type of soil do you have? Loamy, Sandy, Clay, Black, or Red?', hi: 'आपकी मिट्टी कैसी है? दोमट, रेतीली, चिकनी, काली, या लाल?', kn: 'ನಿಮ್ಮ ಮಣ್ಣು ಯಾವ ರೀತಿ? ಮರಳು, ಜೇಡಿ, ಕಪ್ಪು, ಕೆಂಪು?', te: 'మీ మట్టి ఏ రకం? ఒండ్రు, ఇసుక, బంక, నల్ల, ఎర్ర?', ta: 'உங்கள் மண் எந்த வகை? கரிசல், மணல், களிமண்?' }, field: 'soil' },
        { ask: { en: 'How big is your farm in acres? Say a number.', hi: 'आपका खेत कितने एकड़ का है? संख्या बताएं।', kn: 'ನಿಮ್ಮ ಜಮೀನು ಎಷ್ಟು ಎಕರೆ? ಸಂಖ್ಯೆ ಹೇಳಿ.', te: 'మీ పొలం ఎంత ఎకరాలు? సంఖ్య చెప్పండి.', ta: 'உங்கள் பண்ணை எத்தனை ஏக்கர்? எண் சொல்லுங்கள்.' }, field: 'landSize' }
    ],
    pestCheck: [
        { ask: { en: 'Which crop has the problem? For example: Rice, Wheat, Tomato, Cotton.', hi: 'किस फसल में समस्या है? जैसे: चावल, गेहूं, टमाटर, कपास।', kn: 'ಯಾವ ಬೆಳೆಯಲ್ಲಿ ಸಮಸ್ಯೆ? ಉದಾ: ಭತ್ತ, ಗೋಧಿ, ಟೊಮೆಟೊ.', te: 'ఏ పంటలో సమస్య? ఉదా: వరి, గోధుమ, టమాటా.', ta: 'எந்த பயிரில் பிரச்சனை? உதா: அரிசி, தக்காளி.' }, field: 'crop' }
    ]
};

function vcLang() { return localStorage.getItem('agri_lang') || 'en'; }

function vcSpeak(msgObj, callback) {
    const lang = vcLang();
    let text = (typeof msgObj === 'string') ? msgObj : (msgObj[lang] || msgObj.en || msgObj);

    // Auto-translate English text to selected language
    const doSpeak = (finalText) => {
        showVoiceResponse(finalText);
        setVoiceState('speaking');
        if (window.voiceInterface) {
            window.voiceInterface.speak(finalText, ttsLangMap[lang] || null);
        }
        // Wait for speech to finish, then call back
        const check = setInterval(() => {
            if (!window.speechSynthesis || !window.speechSynthesis.speaking) {
                clearInterval(check);
                if (callback) setTimeout(callback, 300);
            }
        }, 250);
    };

    if (lang !== 'en' && typeof text === 'string' && /[a-zA-Z]{2,}/.test(text)) {
        translateText(text, lang).then(translated => doSpeak(translated));
        return;
    }
    doSpeak(text);
    // Wait for speech to finish, then call back
    const check = setInterval(() => {
        if (!window.speechSynthesis || !window.speechSynthesis.speaking) {
            clearInterval(check);
            if (callback) setTimeout(callback, 300);
        }
    }, 250);
}

function vcListen() {
    if (!window.voiceInterface) return;
    voiceConvo.listening = true;
    const appLang = vcLang();
    window.voiceInterface.setLanguage(appLang);
    setVoiceState('listening');
    window.voiceInterface.recognition.lang = window.voiceInterface.currentLanguage;
    try { window.voiceInterface.recognition.start(); } catch(e) {}
}

// Start a conversational flow
function startVoiceFlow(flowName) {
    const flow = voiceFlows[flowName];
    if (!flow) return;
    voiceConvo.active = true;
    voiceConvo.flow = flowName;
    voiceConvo.step = 0;
    voiceConvo.data = {};
    // Open voice panel if not open
    if (!voicePanelOpen) openVoicePanel();
    // Ask first question
    askCurrentStep();
}

function askCurrentStep() {
    const flow = voiceFlows[voiceConvo.flow];
    if (!flow || voiceConvo.step >= flow.length) {
        completeVoiceFlow();
        return;
    }
    const step = flow[voiceConvo.step];
    vcSpeak(step.ask, () => {
        vcListen();
    });
}

function handleConvoResponse(text) {
    if (!voiceConvo.active) return false;
    const flow = voiceFlows[voiceConvo.flow];
    if (!flow) return false;
    const step = flow[voiceConvo.step];
    const lower = text.toLowerCase().trim();

    // Check for skip/cancel
    if (['skip', 'छोड़ें', 'ಬಿಡಿ', 'వదిలేయండి', 'விடு', 'next', 'अगला'].some(w => lower.includes(w))) {
        if (step.optional) {
            voiceConvo.data[step.field] = '';
            voiceConvo.step++;
            askCurrentStep();
            return true;
        }
    }
    if (['cancel', 'stop', 'रुको', 'बंद', 'ನಿಲ್ಲಿ', 'ఆపు', 'நிறுத்து'].some(w => lower.includes(w))) {
        endVoiceConvo({ en: 'Cancelled.', hi: 'रद्द किया।', kn: 'ರದ್ದಾಗಿದೆ.', te: 'రద్దు చేయబడింది.', ta: 'ரத்து செய்யப்பட்டது.' });
        return true;
    }

    // Process based on field type
    let value = text.trim();
    if (step.field === 'username') {
        value = extractName(text);
    } else if (step.field === 'farm_name') {
        value = extractFarmName(text);
    } else if (step.field === 'location') {
        value = extractLocation(text);
    } else if (step.field === 'crop') {
        value = matchCropFromText(lower) || extractKeyword(text);
    } else if (step.field === 'soil') {
        value = matchSoilFromText(lower) || extractKeyword(text);
    } else if (step.field === 'landSize') {
        const num = lower.replace(/[^\d.]/g, '');
        value = num || '5';
    } else if (step.field === 'phone') {
        value = lower.replace(/[^\d+]/g, '') || value;
    }

    voiceConvo.data[step.field] = value;
    showVoiceTranscript(text);

    // Confirm what we heard
    const lang = vcLang();
    const confirmMsgs = {
        en: `Got it: ${value}`,
        hi: `समझ गया: ${value}`,
        kn: `ಅರ್ಥವಾಯಿತು: ${value}`,
        te: `అర్థమైంది: ${value}`,
        ta: `புரிந்தது: ${value}`
    };
    vcSpeak(confirmMsgs, () => {
        voiceConvo.step++;
        askCurrentStep();
    });
    return true;
}

function matchCropFromText(text) {
    const crops = { rice: 'Grains', wheat: 'Grains', corn: 'Grains', tomato: 'Vegetables', potato: 'Vegetables', cotton: 'Cash Crops', soybean: 'Oilseeds', sugarcane: 'Cash Crops' };
    const cropNames = { 'चावल': 'rice', 'गेहूं': 'wheat', 'धान': 'rice', 'मक्का': 'corn', 'टमाटर': 'tomato', 'आलू': 'potato', 'कपास': 'cotton', 'ಅಕ್ಕಿ': 'rice', 'ಗೋಧಿ': 'wheat', 'ಜೋಳ': 'corn', 'ಟೊಮೆಟೊ': 'tomato', 'వరి': 'rice', 'గోధుమ': 'wheat', 'அரிசி': 'rice', 'கோதுமை': 'wheat' };
    for (const [name, eng] of Object.entries(cropNames)) {
        if (text.includes(name)) return eng;
    }
    for (const name of Object.keys(crops)) {
        if (text.includes(name)) return name;
    }
    return null;
}

function matchSoilFromText(text) {
    const soilMap = { 'loamy': 'Loamy', 'sandy': 'Sandy', 'clay': 'Clay', 'black': 'Black', 'red': 'Red', 'दोमट': 'Loamy', 'रेतीली': 'Sandy', 'चिकनी': 'Clay', 'काली': 'Black', 'लाल': 'Red', 'ಮರಳು': 'Sandy', 'ಕಪ್ಪು': 'Black', 'ಕೆಂಪು': 'Red' };
    for (const [kw, soil] of Object.entries(soilMap)) {
        if (text.includes(kw)) return soil;
    }
    return null;
}

// ── Smart field extraction from natural speech ──
function extractName(text) {
    const t = text.trim();
    // Patterns: "my name is X", "I am X", "name is X", "it's X", "call me X", "मेरा नाम X है", "నా పేరు X", "என் பெயர் X", "ನನ್ನ ಹೆಸರು X"
    const patterns = [
        /(?:my name is|i am|i'm|name is|it's|call me|this is)\s+(.+)/i,
        /(?:मेरा नाम|मै|मैं)\s+(.+?)(?:\s+है|\s*$)/i,
        /(?:నా పేరు|నేను)\s+(.+)/i,
        /(?:என் பெயர்|நான்)\s+(.+)/i,
        /(?:ನನ್ನ ಹೆಸರು|ನಾನು)\s+(.+)/i,
        /(?:আমার নাম|আমি)\s+(.+)/i,
        /(?:माझे नाव|मी)\s+(.+)/i,
        /(?:મારું નામ|હું)\s+(.+)/i,
        /(?:ମୋ ନାମ|ମୁଁ)\s+(.+)/i,
        /(?:ਮੇਰਾ ਨਾਮ|ਮੈਂ)\s+(.+)/i,
    ];
    for (const pat of patterns) {
        const m = t.match(pat);
        if (m && m[1]) return m[1].trim().replace(/[.!?,]+$/, '');
    }
    // If single/two words, likely just the name
    const words = t.split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 3) return t;
    // Fallback: take last meaningful word(s) — skip filler
    const fillers = ['is', 'am', 'my', 'name', 'i', 'me', 'the', 'a', 'it', 'yeah', 'yes', 'ok', 'so', 'well', 'please', 'sir'];
    const meaningful = words.filter(w => !fillers.includes(w.toLowerCase()));
    return meaningful.length > 0 ? meaningful.join(' ') : t;
}

function extractFarmName(text) {
    const t = text.trim();
    // Patterns: "my farm is X", "farm name is X", "it is X", "called X", "मेरे खेत का नाम X", "నా పొలం X", "என் பண்ணை X"
    const patterns = [
        /(?:my farm is|farm name is|farm is called|it is|it's|called)\s+(.+)/i,
        /(?:मेरे खेत का नाम|खेत का नाम|मेरा खेत)\s+(.+?)(?:\s+है|\s*$)/i,
        /(?:నా పొలం పేరు|పొలం పేరు|నా పొలం)\s+(.+)/i,
        /(?:என் பண்ணை பெயர்|பண்ணை பெயர்|என் பண்ணை)\s+(.+)/i,
        /(?:ನನ್ನ ಜಮೀನಿನ ಹೆಸರು|ಜಮೀನು)\s+(.+)/i,
    ];
    for (const pat of patterns) {
        const m = t.match(pat);
        if (m && m[1]) return m[1].trim().replace(/[.!?,]+$/, '');
    }
    const words = t.split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 3) return t;
    const fillers = ['is', 'my', 'farm', 'name', 'the', 'a', 'it', 'called', 'yes', 'ok', 'so', 'well', 'please'];
    const meaningful = words.filter(w => !fillers.includes(w.toLowerCase()));
    return meaningful.length > 0 ? meaningful.join(' ') : t;
}

function extractLocation(text) {
    const t = text.trim();
    const patterns = [
        /(?:i am from|i live in|from|located in|located at|my farm is in|my village is|village is|city is|in)\s+(.+)/i,
        /(?:मैं|मेरा गांव|गांव|शहर)\s+(.+?)(?:\s+से|\s+में|\s+है|\s*$)/i,
        /(?:నేను|నా ఊరు|ఊరు)\s+(.+)/i,
        /(?:நான்|என் கிராமம்|கிராமம்)\s+(.+)/i,
        /(?:ನಾನು|ನನ್ನ ಊರು|ಊರು)\s+(.+)/i,
    ];
    for (const pat of patterns) {
        const m = t.match(pat);
        if (m && m[1]) return m[1].trim().replace(/[.!?,]+$/, '');
    }
    const words = t.split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 3) return t;
    const fillers = ['i', 'am', 'from', 'my', 'is', 'in', 'at', 'the', 'a', 'it', 'live', 'located', 'village', 'city', 'farm', 'yes', 'ok'];
    const meaningful = words.filter(w => !fillers.includes(w.toLowerCase()));
    return meaningful.length > 0 ? meaningful.join(' ') : t;
}

function extractKeyword(text) {
    const t = text.trim();
    const fillers = ['i', 'want', 'to', 'grow', 'have', 'my', 'is', 'the', 'a', 'it', 'it\'s', 'soil', 'type', 'crop', 'yes', 'ok', 'use', 'like', 'please', 'sir'];
    const words = t.split(/\s+/).filter(w => !fillers.includes(w.toLowerCase()) && w.length > 1);
    return words.length > 0 ? words[words.length - 1] : t;
}

// ── Language switch detection from any language ──
function detectLanguageSwitch(text) {
    const t = text.toLowerCase().trim();
    // Map keywords in ANY language to lang codes
    const langKeywords = {
        'en': ['english', 'change to english', 'speak english', 'in english', 'switch to english', 'अंग्रेजी', 'ఇంగ్లీష్', 'ஆங்கிலம்', 'ಇಂಗ್ಲಿಷ್', 'ইংরেজি'],
        'hi': ['hindi', 'हिंदी', 'हिन्दी', 'change to hindi', 'speak hindi', 'speak in hindi', 'switch to hindi', 'हिंदी में बोलो', 'హిందీ', 'ஹிந்தி', 'ಹಿಂದಿ'],
        'te': ['telugu', 'తెలుగు', 'change to telugu', 'speak telugu', 'speak in telugu', 'switch to telugu', 'తెలుగులో మాట్లాడు', 'తెలుగులో చెప్పు', 'తెలుగు లో', 'तेलुगु', 'தெலுங்கு', 'ತೆಲುಗು'],
        'kn': ['kannada', 'ಕನ್ನಡ', 'change to kannada', 'speak kannada', 'speak in kannada', 'switch to kannada', 'ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ', 'ಕನ್ನಡದಲ್ಲಿ', 'कन्नड़', 'கன்னடம்', 'కన్నడ'],
        'ta': ['tamil', 'தமிழ்', 'change to tamil', 'speak tamil', 'speak in tamil', 'switch to tamil', 'தமிழில் பேசு', 'தமிழில்', 'तमिल', 'తమిళం', 'ತಮಿಳು'],
        'ml': ['malayalam', 'മലയാളം', 'change to malayalam', 'speak malayalam', 'switch to malayalam', 'മലയാളത്തിൽ', 'मलयालम', 'మలయాళం', 'ಮಲಯಾಳಂ'],
        'bn': ['bengali', 'bangla', 'বাংলা', 'change to bengali', 'speak bengali', 'switch to bengali', 'বাংলায় বলো', 'बंगाली', 'బెంగాలీ'],
        'gu': ['gujarati', 'ગુજરાતી', 'change to gujarati', 'speak gujarati', 'switch to gujarati', 'ગુજરાતીમાં', 'गुजराती', 'గుజరాతీ'],
        'mr': ['marathi', 'मराठी', 'change to marathi', 'speak marathi', 'switch to marathi', 'मराठीत बोल', 'మరాఠీ', 'மராத்தி'],
        'pa': ['punjabi', 'ਪੰਜਾਬੀ', 'change to punjabi', 'speak punjabi', 'switch to punjabi', 'ਪੰਜਾਬੀ ਵਿੱਚ', 'पंजाबी', 'పంజాబీ'],
        'or': ['odia', 'oriya', 'ଓଡ଼ିଆ', 'change to odia', 'speak odia', 'switch to odia', 'ଓଡ଼ିଆରେ', 'ओडिया', 'ఒడియా']
    };

    // Check if text contains language change intent
    const changeIntents = ['change', 'switch', 'speak', 'talk', 'convert', 'बदलो', 'बोलो', 'भाषा', 'మార్చు', 'మాట్లాడు', 'భాష', 'மாற்று', 'பேசு', 'மொழி', 'ಬದಲಿಸಿ', 'ಮಾತನಾಡಿ', 'ಭಾಷೆ', 'বলো', 'ভাষা', 'બોલો', 'ભાષા', 'बोला', 'भाषा', 'ਬੋਲੋ', 'ਭਾਸ਼ਾ', 'କୁହ', 'ভාৱা'];
    const hasIntent = changeIntents.some(w => t.includes(w));

    for (const [code, keywords] of Object.entries(langKeywords)) {
        for (const kw of keywords) {
            if (t.includes(kw)) {
                // If it's just the language name or has a change intent, switch
                if (hasIntent || t.split(/\s+/).length <= 3) return code;
            }
        }
    }
    return null;
}

function completeVoiceFlow() {
    voiceConvo.active = false;
    const flow = voiceConvo.flow;
    const data = voiceConvo.data;

    switch (flow) {
        case 'signup':
            executeVoiceSignup(data);
            break;
        case 'login':
            executeVoiceLogin(data);
            break;
        case 'farmSetup':
            executeVoiceFarmSetup(data);
            break;
        case 'pestCheck':
            executeVoicePestCheck(data);
            break;
    }
}

async function executeVoiceSignup(data) {
    vcSpeak({ en: 'Now let me verify your face to secure your account...', hi: '\u0905\u092C \u0906\u092A\u0915\u093E \u091A\u0947\u0939\u0930\u093E \u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902...', kn: '\u0C88\u0C97 \u0CA8\u0CBF\u0CAE\u0CCD\u0CAE \u0CAE\u0CC1\u0C96\u0CB5\u0CA8\u0CCD\u0CA8\u0CC1 \u0CAA\u0CB0\u0CBF\u0CB6\u0CC0\u0CB2\u0CBF\u0CB8\u0CC1\u0CA4\u0CCD\u0CA4\u0CC7\u0CB5\u0CC6...', te: '\u0C07\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C41 \u0C2E\u0C40 \u0C2E\u0C41\u0C16\u0C3E\u0C28\u0C4D\u0C28\u0C3F \u0C27\u0C43\u0C35\u0C40\u0C15\u0C30\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C2E\u0C41...', ta: '\u0B87\u0BAA\u0BCD\u0BAA\u0BCB\u0BA4\u0BC1 \u0BA8\u0BBF\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0BAE\u0BC1\u0B95\u0BA4\u0BCD\u0BA4\u0BC8 \u0B9A\u0BB0\u0BBF\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BBF\u0BB1\u0BCB\u0BAE\u0BCD...' });
    // Store voice signup data and launch face verification
    window._pendingVoiceFlowData = data;
    window._pendingVoiceFlowType = 'signup';
    setTimeout(() => startFaceAuthVerification({ mode: 'signup', username: data.username, phone: data.phone || '', farm_name: data.farm_name, location: data.location || '', source: 'voiceFlow' }), 1500);
}

async function executeVoiceLogin(data) {
    vcSpeak({ en: 'Now let me verify your face to log you in...', hi: '\u0905\u092C \u0906\u092A\u0915\u093E \u091A\u0947\u0939\u0930\u093E \u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902...', kn: '\u0C88\u0C97 \u0CA8\u0CBF\u0CAE\u0CCD\u0CAE \u0CAE\u0CC1\u0C96\u0CB5\u0CA8\u0CCD\u0CA8\u0CC1 \u0CAA\u0CB0\u0CBF\u0CB6\u0CC0\u0CB2\u0CBF\u0CB8\u0CC1\u0CA4\u0CCD\u0CA4\u0CC7\u0CB5\u0CC6...', te: '\u0C07\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C41 \u0C2E\u0C40 \u0C2E\u0C41\u0C16\u0C3E\u0C28\u0C4D\u0C28\u0C3F \u0C27\u0C43\u0C35\u0C40\u0C15\u0C30\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C2E\u0C41...', ta: '\u0B87\u0BAA\u0BCD\u0BAA\u0BCB\u0BA4\u0BC1 \u0BA8\u0BBF\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0BAE\u0BC1\u0B95\u0BA4\u0BCD\u0BA4\u0BC8 \u0B9A\u0BB0\u0BBF\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BBF\u0BB1\u0BCB\u0BAE\u0BCD...' });
    // Store voice login data and launch face verification
    window._pendingVoiceFlowData = data;
    window._pendingVoiceFlowType = 'login';
    setTimeout(() => startFaceAuthVerification({ mode: 'login', username: data.phone, source: 'voiceFlow' }), 1500);
}

async function executeVoiceFarmSetup(data) {
    vcSpeak({ en: 'Saving your farm details...', hi: 'खेत की जानकारी सहेज रहे हैं...', kn: 'ಜಮೀನಿನ ವಿವರ ಉಳಿಸುತ್ತಿದ್ದೇವೆ...', te: 'పొలం వివరాలు సేవ్ చేస్తున్నాము...', ta: 'பண்ணை விவரங்கள் சேமிக்கிறோம்...' });
    // Use GPS for lat/lon
    let lat = 12.97, lon = 77.59;
    try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
        lat = pos.coords.latitude; lon = pos.coords.longitude;
    } catch {}

    // Map crop name to preference category  
    const cropMap = { rice: 'Grains', wheat: 'Grains', corn: 'Grains', tomato: 'Vegetables', potato: 'Vegetables', cotton: 'Cash Crops', soybean: 'Oilseeds' };
    const cropPref = cropMap[data.crop?.toLowerCase()] || data.crop || 'Grains';

    // Fetch weather for auto-filling
    let temp = 28, hum = 65, rain = 100;
    try {
        const wRes = await fetch(`${API}/weather?lat=${lat}&lon=${lon}`);
        const wData = await wRes.json();
        if (wData.current) {
            temp = Math.round(wData.current.temperature);
            hum = Math.round(wData.current.humidity);
            rain = Math.round(wData.current.rainfall || 100);
        }
    } catch {}

    const landAcres = parseFloat(data.landSize) || 5;
    state.farmSetup = {
        land_size: Math.round(landAcres * 0.4047 * 100) / 100,
        soil_type: data.soil || 'Loamy',
        crop_preference: cropPref,
        nitrogen: 50, phosphorus: 30, potassium: 40,
        temperature: temp, humidity: hum, ph: 6.5, rainfall: rain,
        lat, lon, locMethod: 'gps', city: ''
    };
    localStorage.setItem('agri_farm_setup', JSON.stringify(state.farmSetup));
    try { await fetchAPI('/farm_details', { username: state.user?.username || 'anonymous', land_size: state.farmSetup.land_size, soil_type: state.farmSetup.soil_type, crop_preference: state.farmSetup.crop_preference }); } catch {}
    
    navigate('farm-setup');
    vcSpeak({ en: `Farm saved! ${data.crop || 'Crops'} on ${data.landSize || 5} acres of ${data.soil || 'Loamy'} soil. Say "get recommendation" for AI advice.`, hi: `खेत सहेजा गया! ${data.crop || 'फसल'} ${data.landSize || 5} एकड़ ${data.soil || 'दोमट'} मिट्टी पर। AI सलाह के लिए "सलाह दो" बोलें।`, kn: `ಜಮೀನು ಉಳಿಸಲಾಗಿದೆ! ${data.crop || 'ಬೆಳೆ'} ${data.landSize || 5} ಎಕರೆ ${data.soil || 'ಮರಳು'} ಮಣ್ಣಿನಲ್ಲಿ.`, te: `పొలం సేవ్ అయింది! ${data.crop || 'పంట'} ${data.landSize || 5} ఎకరాల ${data.soil || 'ఒండ్రు'} మట్టిలో.`, ta: `பண்ணை சேமிக்கப்பட்டது! ${data.crop || 'பயிர்'} ${data.landSize || 5} ஏக்கர் ${data.soil || 'கரிசல்'} மண்ணில்.` }, () => setVoiceState('idle'));
}

async function executeVoicePestCheck(data) {
    const crop = data.crop || 'Rice';
    vcSpeak({ en: `Checking pests for ${crop}...`, hi: `${crop} के लिए कीट जांच कर रहे हैं...`, kn: `${crop} ಗೆ ಕೀಟ ಪರೀಕ್ಷೆ ಮಾಡುತ್ತಿದ್ದೇವೆ...`, te: `${crop} కోసం పురుగు పరీక్ష చేస్తున్నాము...`, ta: `${crop} க்கான பூச்சி சோதனை...` });
    navigate('pest-prediction');
    // Use stored farm data or defaults
    const fs = state.farmSetup || { temperature: 28, humidity: 65, rainfall: 100, soil_type: 'Loamy' };
    try {
        const result = await fetchAPI('/pest_prediction', { crop_type: crop, temperature: fs.temperature, humidity: fs.humidity, rainfall: fs.rainfall, soil_type: fs.soil_type });
        const risk = result.risk_level || 'Unknown';
        const pests = (result.pests || []).slice(0, 3).map(p => p.pest_name || p.name || p).join(', ');
        const tips = (result.prevention_tips || []).slice(0, 2).join('. ');
        vcSpeak({ en: `${crop} pest risk is ${risk}. Main pests: ${pests}. Tips: ${tips}`, hi: `${crop} कीट खतरा ${risk} है। मुख्य कीट: ${pests}। सुझाव: ${tips}`, kn: `${crop} ಕೀಟ ಅಪಾಯ ${risk}. ಕೀಟಗಳು: ${pests}. ಸಲಹೆ: ${tips}`, te: `${crop} పురుగు ముప్పు ${risk}. పురుగులు: ${pests}. సలహా: ${tips}`, ta: `${crop} பூச்சி ஆபத்து ${risk}. பூச்சிகள்: ${pests}` }, () => setVoiceState('idle'));
    } catch(e) {
        vcSpeak({ en: 'Could not check pests. Please try again.', hi: 'कीट जांच नहीं हो पाई। फिर कोशिश करें।' }, () => setVoiceState('idle'));
    }
}

function endVoiceConvo(msg) {
    voiceConvo.active = false;
    voiceConvo.flow = null;
    if (msg) vcSpeak(msg, () => setVoiceState('idle'));
    else setVoiceState('idle');
}

// ── Master voice intent detection ──
// Intercepts ALL recognized text and routes to flows or actions
function processVoiceMasterCommand(text) {
    const t = text.toLowerCase().trim();

    // If a convo flow is active, route there first
    if (voiceConvo.active) {
        return handleConvoResponse(text);
    }

    // ── Registration / Login ──
    if (['sign me up', 'register', 'create account', 'new account', 'sign up', 'मुझे साइन अप करो', 'नया खाता', 'खाता बनाओ', 'ಸೈನ್ ಅಪ್', 'ಹೊಸ ಖಾತೆ', 'సైన్ అప్', 'புதிய கணக்கு'].some(w => t.includes(w))) {
        startVoiceFlow('signup');
        return true;
    }
    if (['log me in', 'login', 'log in', 'sign in', 'मुझे लॉगिन करो', 'लॉगिन', 'ಲಾಗಿನ್', 'లాగిన్', 'உள்நுழை'].some(w => t.includes(w))) {
        if (state.user) {
            vcSpeak({ en: 'You are already logged in!', hi: 'आप पहले से लॉगिन हैं!', kn: 'ನೀವು ಈಗಾಗಲೇ ಲಾಗಿನ್ ಆಗಿದ್ದೀರಿ!', te: 'మీరు ఇప్పటికే లాగిన్ అయ్యారు!', ta: 'நீங்கள் ஏற்கனவே உள்நுழைந்துள்ளீர்கள்!' });
            return true;
        }
        startVoiceFlow('login');
        return true;
    }
    if (['logout', 'log out', 'sign out', 'लॉगआउट', 'बाहर', 'ಲಾಗ್ಔಟ್', 'లాగ్ అవుట్', 'வெளியேறு'].some(w => t.includes(w))) {
        logout();
        vcSpeak({ en: 'You have been logged out.', hi: 'आप लॉगआउट हो गए।', kn: 'ನೀವು ಲಾಗ್ ಔಟ್ ಆಗಿದ್ದೀರಿ.', te: 'మీరు లాగ్ అవుట్ అయ్యారు.', ta: 'நீங்கள் வெளியேறிவிட்டீர்கள்.' });
        return true;
    }

    // ── Language Switching ──
    const langSwitch = detectLanguageSwitch(t);
    if (langSwitch) {
        changeLanguage(langSwitch);
        if (window.voiceInterface) window.voiceInterface.setLanguage(langSwitch);
        const langNames = { en: 'English', hi: 'हिंदी', kn: 'ಕನ್ನಡ', te: 'తెలుగు', ta: 'தமிழ்', ml: 'മലയാളം', bn: 'বাংলা', gu: 'ગુજરાતી', mr: 'मराठी', pa: 'ਪੰਜਾਬੀ', or: 'ଓଡ଼ିଆ' };
        const name = langNames[langSwitch] || langSwitch;
        vcSpeak({ en: `Language changed to ${name}. I will now speak in ${name}.`, hi: `भाषा ${name} में बदल दी गई। अब मैं ${name} में बात करूंगा।`, kn: `ಭಾಷೆ ${name} ಗೆ ಬದಲಾಯಿಸಿದ್ದೇವೆ.`, te: `భాష ${name} కి మార్చబడింది.`, ta: `மொழி ${name} ஆக மாற்றப்பட்டது.` });
        return true;
    }

    // ── Navigation ──
    if (['go home', 'go to home', 'home page', 'dashboard', 'होम', 'घर', 'ಹೋಮ್', 'హోమ్', 'வீடு', 'முகப்பு'].some(w => t.includes(w))) {
        navigate('dashboard'); vcSpeak({ en: 'Home page', hi: 'होम पेज', kn: 'ಹೋಮ್ ಪೇಜ್', te: 'హోమ్ పేజీ', ta: 'முகப்பு' }); return true;
    }
    if (['go to farm', 'farm setup', 'setup farm', 'set up farm', 'खेत सेटअप', 'ಜಮೀನು ಸೆಟಪ್', 'పొలం సెటప్', 'பண்ணை அமைப்பு'].some(w => t.includes(w))) {
        navigate('farm-setup'); vcSpeak({ en: 'Farm setup page. You can say "set up my farm" to fill details by voice.', hi: 'खेत सेटअप पेज। "मेरा खेत सेट करो" बोलें।' }); return true;
    }
    if (['set up my farm', 'setup my farm', 'fill farm', 'मेरा खेत सेट करो', 'खेत भरो', 'ಜಮೀನು ಸೆಟ್ ಮಾಡಿ', 'పొలం సెట్ చేయండి', 'பண்ணை அமை'].some(w => t.includes(w))) {
        startVoiceFlow('farmSetup'); return true;
    }
    if (['go to weather', 'show weather', 'weather page', 'मौसम पेज', 'ಹವಾಮಾನ', 'వాతావరణం పేజీ', 'வானிலை பக்கம்'].some(w => t.includes(w))) {
        navigate('weather'); vcSpeak({ en: 'Weather page', hi: 'मौसम पेज' }); return true;
    }
    if (['go to pest', 'pest page', 'pest prediction', 'कीट पेज', 'ಕೀಟ ಪೇಜ್', 'పురుగు పేజీ', 'பூச்சி பக்கம்'].some(w => t.includes(w))) {
        navigate('pest-prediction'); vcSpeak({ en: 'Pest prediction page', hi: 'कीट भविष्यवाणी पेज' }); return true;
    }
    if (['go to soil', 'soil page', 'soil analysis', 'मिट्टी पेज', 'ಮಣ್ಣು ಪೇಜ್', 'మట్టి పేజీ', 'மண் பக்கம்'].some(w => t.includes(w))) {
        navigate('soil-analysis'); vcSpeak({ en: 'Soil analysis page', hi: 'मिट्टी विश्लेषण पेज' }); return true;
    }
    if (['go to community', 'community page', 'समुदाय', 'ಸಮುದಾಯ', 'సముదాయం', 'சமூகம்'].some(w => t.includes(w))) {
        navigate('community'); vcSpeak({ en: 'Community page', hi: 'समुदाय पेज' }); return true;
    }
    if (['go to profile', 'settings', 'profile page', 'my profile', 'सेटिंग्स', 'प्रोफ़ाइल', 'ಸೆಟ್ಟಿಂಗ್ಸ್', 'సెట్టింగ్‌లు', 'அமைப்புகள்'].some(w => t.includes(w))) {
        navigate('profile'); vcSpeak({ en: 'Settings page', hi: 'सेटिंग्स पेज' }); return true;
    }
    if (['go to history', 'history page', 'my history', 'इतिहास', 'ಇತಿಹಾಸ', 'చరిత్ర', 'வரலாறு'].some(w => t.includes(w))) {
        navigate('history'); vcSpeak({ en: 'History page', hi: 'इतिहास पेज' }); return true;
    }
    if (['go to sustainability', 'sustainability', 'टिकाऊपन', 'ಸುಸ್ಥಿರತೆ', 'సుస్థిరత', 'நிலைத்தன்மை'].some(w => t.includes(w))) {
        navigate('sustainability'); vcSpeak({ en: 'Sustainability page', hi: 'टिकाऊपन पेज' }); return true;
    }

    // ── Actions ──
    if (['get recommendation', 'recommend crop', 'crop advice', 'what should i grow', 'फसल सलाह', 'क्या उगाऊं', 'फसल बताओ', 'सलाह दो', 'ಬೆಳೆ ಸಲಹೆ', 'ಏನು ಬೆಳೆಸಲಿ', 'పంట సలహా', 'ఏం పండించాలి', 'பயிர் ஆலோசனை'].some(w => t.includes(w))) {
        if (!state.farmSetup) {
            vcSpeak({ en: 'First, let me set up your farm.', hi: 'पहले अपना खेत सेट करें।' }, () => startVoiceFlow('farmSetup'));
        } else {
            vcSpeak({ en: 'Getting AI crop recommendation...', hi: 'AI फसल सिफारिश ला रहे हैं...' });
            navigate('recommendation');
            setTimeout(() => getRecommendation(), 500);
        }
        return true;
    }
    if (['check weather', 'today weather', 'weather forecast', 'मौसम बताओ', 'मौसम कैसा है', 'ಹವಾಮಾನ ಹೇಳಿ', 'వాతావరణం చెప్పు', 'வானிலை சொல்'].some(w => t.includes(w))) {
        navigate('weather');
        vcSpeak({ en: 'Checking weather...', hi: 'मौसम देख रहे हैं...' });
        setTimeout(() => getWeatherForecast(), 500);
        return true;
    }
    if (['check pest', 'pest problem', 'my crop is sick', 'crop disease', 'कीड़ा लगा है', 'फसल में रोग', 'ಕೀಟ ಸಮಸ್ಯೆ', 'పురుగు సమస్య', 'பூச்சி பிரச்சனை'].some(w => t.includes(w))) {
        startVoiceFlow('pestCheck');
        return true;
    }
    if (['analyze soil', 'soil test', 'check soil', 'मिट्टी जांचो', 'ಮಣ್ಣು ಪರೀಕ್ಷೆ', 'మట్టి పరీక్ష', 'மண் சோதனை'].some(w => t.includes(w))) {
        navigate('soil-analysis');
        vcSpeak({ en: 'Soil analysis page. Upload a photo or select soil type.', hi: 'मिट्टी विश्लेषण। फोटो अपलोड करें या मिट्टी चुनें।' });
        return true;
    }
    if (['detect location', 'find my location', 'where am i', 'gps', 'मेरा स्थान', 'मेरी लोकेशन', 'ಸ್ಥಳ ಪತ್ತೆ', 'నా స్థానం', 'என் இடம்'].some(w => t.includes(w))) {
        if (typeof detectMyLocation === 'function') detectMyLocation();
        vcSpeak({ en: 'Detecting your location...', hi: 'आपका स्थान ढूंढ रहे हैं...' });
        return true;
    }
    if (['simple mode', 'easy mode', 'सरल मोड', 'आसान मोड', 'ಸರಳ ಮೋಡ್', 'సింపుల్ మోడ్', 'எளிய முறை'].some(w => t.includes(w))) {
        toggleSimpleMode();
        const isOn = document.body.classList.contains('simple-mode');
        vcSpeak({ en: isOn ? 'Simple mode activated' : 'Simple mode off', hi: isOn ? 'सरल मोड चालू' : 'सरल मोड बंद' });
        return true;
    }
    if (['one tap advice', 'quick advice', 'smart advice', 'एक टैप सलाह', 'ಒಂದು ಟ್ಯಾಪ್ ಸಲಹೆ', 'ఒక్క ట్యాప్ సలహా'].some(w => t.includes(w))) {
        if (typeof oneTapAdvice === 'function') oneTapAdvice();
        return true;
    }

    // ── New Feature Navigation ──
    if (['crop diagnosis', 'diagnose crop', 'take photo', 'crop photo', 'crop disease', 'photo diagnosis', 'camera', 'फसल रोग', 'फोटो जांच', 'ಬೆಳೆ ರೋಗ', 'ఫోటో పరీక్ష', 'பயிர் நோய்'].some(w => t.includes(w))) {
        navigate('crop-diagnosis');
        vcSpeak({ en: 'Crop diagnosis page. Take a photo or describe symptoms to get instant AI diagnosis.', hi: 'फसल निदान पेज। फोटो लें या लक्षण बताएं।', kn: 'ಬೆಳೆ ರೋಗ ನಿರ್ಣಯ ಪುಟ.', te: 'పంట రోగ నిర్ధారణ పేజీ.', ta: 'பயிர் நோய் கண்டறிதல் பக்கம்.' });
        return true;
    }
    if (['government scheme', 'govt scheme', 'sarkari yojana', 'subsidy', 'सरकारी योजना', 'सब्सिडी', 'ಸರ್ಕಾರಿ ಯೋಜನೆ', 'ప్రభుత్వ పథకం', 'அரசு திட்டம்'].some(w => t.includes(w))) {
        navigate('govt-schemes');
        vcSpeak({ en: 'Government schemes page. Find subsidies and loans you are eligible for.', hi: 'सरकारी योजना पेज। आपके लिए उपलब्ध सब्सिडी और लोन खोजें।', kn: 'ಸರ್ಕಾರಿ ಯೋಜನೆ ಪುಟ.', te: 'ప్రభుత్వ పథకాల పేజీ.', ta: 'அரசு திட்டங்கள் பக்கம்.' });
        return true;
    }
    if (['mandi price', 'market price', 'crop price', 'what is the price', 'मंडी भाव', 'भाव बताओ', 'बाजार भाव', 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆ', 'ధర చెప్పు', 'மண்டி விலை', 'விலை'].some(w => t.includes(w))) {
        navigate('mandi-prices');
        vcSpeak({ en: 'Mandi prices page. Check latest crop prices and get sell or hold advice.', hi: 'मंडी भाव पेज। फसल के दाम और बेचें या रुकें सलाह पाएं।', kn: 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಪುಟ.', te: 'మండి ధరల పేజీ.', ta: 'மண்டி விலை பக்கம்.' });
        return true;
    }
    if (['voice note', 'record tip', 'share tip', 'farmer tip', 'वॉइस नोट', 'टिप शेयर करो', 'ಧ್ವನಿ ಟಿಪ್ಪಣಿ', 'వాయిస్ నోట్', 'குரல் குறிப்பு'].some(w => t.includes(w))) {
        navigate('voice-notes');
        vcSpeak({ en: 'Voice notes page. Record and share farming tips with fellow farmers.', hi: 'वॉइस नोट पेज। खेती की टिप्स रिकॉर्ड करें और शेयर करें।', kn: 'ಧ್ವನಿ ಟಿಪ್ಪಣಿ ಪುಟ.', te: 'వాయిస్ నోట్ పేజీ.', ta: 'குரல் குறிப்பு பக்கம்.' });
        return true;
    }
    if (['expense', 'add expense', 'track expense', 'profit', 'income', 'खर्चा', 'खर्च जोड़ो', 'मुनाफा', 'आमदनी', 'ಖರ್ಚು', 'ಲಾಭ', 'ఖర్చు', 'లాభం', 'செலவு', 'லாபம்'].some(w => t.includes(w))) {
        navigate('expense-tracker');
        vcSpeak({ en: 'Expense tracker page. Track your farm spending and profits.', hi: 'खर्चा ट्रैकर पेज। खेती का खर्च और मुनाफा ट्रैक करें।', kn: 'ಖರ್ಚು ಟ್ರ್ಯಾಕರ್ ಪುಟ.', te: 'ఖర్చు ట్రాకర్ పేజీ.', ta: 'செலவு கண்காணிப்பான் பக்கம்.' });
        return true;
    }

    // ── What can I do? (help) ──
    if (['what can i do', 'what can you do', 'help me', 'help', 'क्या कर सकते हो', 'मदद', 'सहायता', 'ಏನು ಮಾಡಬಹುದು', 'ಸಹಾಯ', 'ఏం చేయవచ్చు', 'సహాయం', 'என்ன செய்யலாம்', 'உதவி'].some(w => t.includes(w))) {
        vcSpeak({ en: 'You can say: Login me, Sign me up, Set up my farm, Get crop recommendation, Check weather, Check pest, Analyze soil, Go to community, Go to settings, Detect location, Simple mode, or Logout. Ask any farming question and I will answer!', hi: 'आप बोल सकते हैं: लॉगिन करो, साइन अप करो, खेत सेट करो, फसल सलाह दो, मौसम बताओ, कीड़ा जांचो, मिट्टी जांचो, समुदाय, सेटिंग्स, लोकेशन ढूंढो, सरल मोड, या लॉगआउट। कोई भी खेती का सवाल पूछें!' });
        return true;
    }

    return false; // Not handled — let it fall through to chatbot
}

// ═══════════════════════════════════════════════════════════════
//  DRAGGABLE SOS BUTTON
// ═══════════════════════════════════════════════════════════════

function initDraggableSOS() {
    const btn = document.querySelector('.emergency-pest-btn');
    if (!btn) return;

    let isDragging = false;
    let startX, startY, origX, origY;
    let hasMoved = false;

    // Restore saved position
    const savedPos = localStorage.getItem('agri_sos_position');
    if (savedPos) {
        const { x, y } = JSON.parse(savedPos);
        btn.style.left = x + 'px';
        btn.style.bottom = 'auto';
        btn.style.top = y + 'px';
        btn.style.right = 'auto';
    }

    function onStart(e) {
        isDragging = true;
        hasMoved = false;
        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        const rect = btn.getBoundingClientRect();
        origX = rect.left;
        origY = rect.top;
        btn.style.transition = 'none';
        btn.style.zIndex = '10000';
        e.preventDefault();
    }

    function onMove(e) {
        if (!isDragging) return;
        const touch = e.touches ? e.touches[0] : e;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
        let newX = origX + dx;
        let newY = origY + dy;
        // Keep within viewport
        newX = Math.max(0, Math.min(window.innerWidth - btn.offsetWidth, newX));
        newY = Math.max(0, Math.min(window.innerHeight - btn.offsetHeight, newY));
        btn.style.left = newX + 'px';
        btn.style.top = newY + 'px';
        btn.style.bottom = 'auto';
        btn.style.right = 'auto';
        e.preventDefault();
    }

    function onEnd() {
        if (!isDragging) return;
        isDragging = false;
        btn.style.transition = '';
        btn.style.zIndex = '';
        // Save position
        const rect = btn.getBoundingClientRect();
        localStorage.setItem('agri_sos_position', JSON.stringify({ x: rect.left, y: rect.top }));
        // If didn't move, treat as click
        if (!hasMoved) {
            emergencyPestHelp();
        }
    }

    // Touch events
    btn.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    // Mouse events
    btn.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    // Prevent default click since we handle it in onEnd
    btn.onclick = (e) => { if (hasMoved) { e.preventDefault(); e.stopPropagation(); } };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FEATURE 1: CROP PHOTO DIAGNOSIS
// ═══════════════════════════════════════════════════════════════════════════════

let diagImageBase64 = null;

function openCropCamera() {
    document.getElementById('diag-file-input').click();
}

function handleCropPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        diagImageBase64 = e.target.result.split(',')[1];
        document.getElementById('diag-preview-img').src = e.target.result;
        document.getElementById('diag-placeholder').style.display = 'none';
        document.getElementById('diag-preview').style.display = '';
    };
    reader.readAsDataURL(file);
}

function retakeCropPhoto() {
    diagImageBase64 = null;
    document.getElementById('diag-placeholder').style.display = '';
    document.getElementById('diag-preview').style.display = 'none';
    document.getElementById('diag-file-input').value = '';
}

async function runCropDiagnosis() {
    const cropType = document.getElementById('diag-crop-type').value;
    const affected = document.getElementById('diag-affected-part').value;
    const symptoms = document.getElementById('diag-symptoms').value;
    
    if (!symptoms && !diagImageBase64) {
        toast('Please describe symptoms or take a photo', 'error');
        return;
    }
    
    let description = symptoms;
    if (affected) description = `Affected part: ${affected}. ${description}`;
    
    showLoading('AI is diagnosing your crop...');
    try {
        const res = await fetchAPI('/crop_diagnosis', {
            description: description,
            crop_type: cropType,
            username: state.user?.username || 'anonymous',
            image_base64: diagImageBase64
        });
        hideLoading();
        
        if (res.diagnosis) {
            renderDiagnosisResult(res.diagnosis);
            loadDiagnosisHistory();
        }
    } catch(e) {
        hideLoading();
        toast('Diagnosis failed: ' + e.message, 'error');
    }
}

function renderDiagnosisResult(d) {
    const container = document.getElementById('diag-result');
    container.style.display = '';
    
    const severityColors = { mild: '#22c55e', moderate: '#f59e0b', severe: '#ef4444', critical: '#dc2626' };
    const sevColor = severityColors[d.severity] || '#6b7280';
    const confPct = Math.round((d.confidence || 0.5) * 100);
    
    container.innerHTML = `
        <div class="card diag-result-card animate-fade-in">
            <div class="diag-result-header">
                <div class="diag-disease-badge" style="background:${sevColor}20;color:${sevColor};border:2px solid ${sevColor}">
                    <i class="fas fa-virus"></i> ${d.disease_name || 'Unknown'}
                </div>
                <div class="diag-confidence-ring">
                    <svg viewBox="0 0 36 36" class="diag-ring-svg">
                        <path class="diag-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" stroke-width="3"/>
                        <path class="diag-ring-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="${sevColor}" stroke-width="3" stroke-dasharray="${confPct}, 100"/>
                    </svg>
                    <span class="diag-ring-text">${confPct}%</span>
                </div>
            </div>
            
            <div class="diag-severity-bar">
                <span>Severity:</span>
                <div class="diag-sev-level" style="background:${sevColor}">${(d.severity || 'unknown').toUpperCase()}</div>
                <span>Spread Risk:</span>
                <div class="diag-sev-level" style="background:${d.spread_risk === 'high' ? '#ef4444' : d.spread_risk === 'medium' ? '#f59e0b' : '#22c55e'}">${(d.spread_risk || 'low').toUpperCase()}</div>
            </div>
            
            <div class="diag-cause"><i class="fas fa-microscope"></i> <strong>Cause:</strong> ${d.cause || 'Under analysis'}</div>
            ${d.recovery_time ? `<div class="diag-recovery"><i class="fas fa-clock"></i> <strong>Recovery:</strong> ${d.recovery_time}</div>` : ''}
            
            <div class="diag-treatment-grid">
                <div class="diag-treat-card immediate">
                    <h4><i class="fas fa-bolt"></i> Immediate Action</h4>
                    <ul>${(d.treatment?.immediate || []).map(t => `<li>${t}</li>`).join('')}</ul>
                </div>
                <div class="diag-treat-card organic">
                    <h4><i class="fas fa-leaf"></i> Organic Remedies</h4>
                    <ul>${(d.treatment?.organic || []).map(t => `<li>${t}</li>`).join('')}</ul>
                </div>
                <div class="diag-treat-card chemical">
                    <h4><i class="fas fa-flask"></i> Chemical Treatment</h4>
                    <ul>${(d.treatment?.chemical || []).map(t => `<li>${t}</li>`).join('')}</ul>
                </div>
                <div class="diag-treat-card prevention">
                    <h4><i class="fas fa-shield-alt"></i> Prevention</h4>
                    <ul>${(d.treatment?.prevention || []).map(t => `<li>${t}</li>`).join('')}</ul>
                </div>
            </div>
            
            ${d.expert_tip ? `<div class="diag-expert-tip"><i class="fas fa-lightbulb"></i> <strong>Expert Tip:</strong> ${d.expert_tip}</div>` : ''}
        </div>`;
    if (state.language !== 'en') _translateAllTextIn(container, state.language);
}

async function loadDiagnosisHistory() {
    try {
        const res = await fetchAPI(`/crop_diagnosis/history/${state.user?.username || 'anonymous'}`, null, 'GET');
        const list = document.getElementById('diag-history-list');
        if (!res.history || res.history.length === 0) {
            list.innerHTML = '<p class="muted-text">No diagnoses yet. Take a photo to get started!</p>';
            return;
        }
        list.innerHTML = res.history.map(h => `
            <div class="diag-history-item">
                <div class="diag-hist-icon"><i class="fas fa-virus"></i></div>
                <div class="diag-hist-info">
                    <strong>${h.diagnosis?.disease_name || 'Analysis'}</strong>
                    <span class="diag-hist-crop">${h.crop_type || 'Unknown crop'}</span>
                    <span class="diag-hist-date">${h.created_at || ''}</span>
                </div>
                <div class="diag-hist-conf">${Math.round((h.confidence || 0) * 100)}%</div>
            </div>`).join('');
    } catch(e) { /* silent */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FEATURE 2: GOVERNMENT SCHEME MATCHER
// ═══════════════════════════════════════════════════════════════════════════════

function prefillSchemeData() {
    if (state.farmSetup) {
        const landEl = document.getElementById('scheme-land-size');
        if (landEl && state.farmSetup.land_size) landEl.value = state.farmSetup.land_size;
    }
    if (state.user?.location) {
        const stateEl = document.getElementById('scheme-state');
        // try to match state
    }
}

async function findGovtSchemes() {
    const location = document.getElementById('scheme-state').value;
    const crop = document.getElementById('scheme-crop').value;
    const landSize = parseFloat(document.getElementById('scheme-land-size').value) || 2;
    const category = document.getElementById('scheme-category').value;
    
    showLoading('Finding eligible government schemes...');
    try {
        const res = await fetchAPI('/govt_schemes', {
            username: state.user?.username || 'anonymous',
            location: location,
            land_size: landSize,
            crop: crop,
            income_category: category
        });
        hideLoading();
        
        if (res.data) {
            renderSchemeResults(res.data);
        }
    } catch(e) {
        hideLoading();
        toast('Scheme search failed: ' + e.message, 'error');
    }
}

function renderSchemeResults(data) {
    const container = document.getElementById('scheme-results');
    container.style.display = '';
    
    const schemes = data.schemes || [];
    
    container.innerHTML = `
        <div class="scheme-highlight-card card animate-fade-in">
            <div class="scheme-highlight-row">
                <div class="scheme-hl-item">
                    <i class="fas fa-trophy"></i>
                    <span>Top Pick</span>
                    <strong>${data.top_recommendation || 'PM-KISAN'}</strong>
                </div>
                <div class="scheme-hl-item">
                    <i class="fas fa-coins"></i>
                    <span>Potential Benefit</span>
                    <strong>${data.total_potential_benefit || 'Multiple schemes'}</strong>
                </div>
                <div class="scheme-hl-item">
                    <i class="fas fa-clipboard-list"></i>
                    <span>Schemes Found</span>
                    <strong>${schemes.length}</strong>
                </div>
            </div>
            ${data.farmer_tip ? `<div class="scheme-tip"><i class="fas fa-lightbulb"></i> ${data.farmer_tip}</div>` : ''}
        </div>
        
        <div class="scheme-list">
            ${schemes.map((s, i) => `
                <div class="scheme-card card animate-fade-in" style="animation-delay:${i * 0.1}s">
                    <div class="scheme-card-header">
                        <div class="scheme-name-row">
                            <span class="scheme-badge scheme-badge-${s.benefit_type || 'grant'}">${(s.benefit_type || 'benefit').toUpperCase()}</span>
                            <h3>${s.name || 'Scheme'}</h3>
                        </div>
                        <div class="scheme-match-score">
                            <div class="scheme-score-ring" style="--score:${Math.round((s.match_score || 0.5) * 100)}">
                                ${Math.round((s.match_score || 0.5) * 100)}%
                            </div>
                            <span>Match</span>
                        </div>
                    </div>
                    <div class="scheme-ministry"><i class="fas fa-building"></i> ${s.ministry || ''}</div>
                    <div class="scheme-benefit"><i class="fas fa-gift"></i> <strong>Benefit:</strong> ${s.benefit_amount || 'Varies'}</div>
                    
                    <details class="scheme-details">
                        <summary><i class="fas fa-chevron-down"></i> How to Apply & Details</summary>
                        <div class="scheme-details-content">
                            ${s.eligibility ? `<div class="scheme-section"><h4><i class="fas fa-check-circle"></i> Eligibility</h4><ul>${s.eligibility.map(e => `<li>${e}</li>`).join('')}</ul></div>` : ''}
                            ${s.how_to_apply ? `<div class="scheme-section"><h4><i class="fas fa-clipboard-list"></i> How to Apply</h4><ol>${s.how_to_apply.map(e => `<li>${e}</li>`).join('')}</ol></div>` : ''}
                            ${s.documents_needed ? `<div class="scheme-section"><h4><i class="fas fa-file-alt"></i> Documents Needed</h4><ul>${s.documents_needed.map(e => `<li>${e}</li>`).join('')}</ul></div>` : ''}
                            ${s.website ? `<div class="scheme-link"><a href="${s.website}" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i> Official Website</a></div>` : ''}
                            ${s.helpline ? `<div class="scheme-helpline"><i class="fas fa-phone"></i> Helpline: <a href="tel:${s.helpline}">${s.helpline}</a></div>` : ''}
                        </div>
                    </details>
                </div>
            `).join('')}
        </div>`;
    if (state.language !== 'en') _translateAllTextIn(container, state.language);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FEATURE 3: MANDI PRICE ALERT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function selectMandiCrop(btn, crop) {
    document.querySelectorAll('.mandi-crop-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('mandi-crop-input').value = crop;
}

async function checkMandiPrices() {
    const crop = document.getElementById('mandi-crop-input').value.trim();
    const stateVal = document.getElementById('mandi-state').value;
    
    if (!crop) { toast('Please select or enter a crop', 'error'); return; }
    
    showLoading('Fetching mandi prices...');
    try {
        const res = await fetchAPI('/mandi_prices', { crop, state: stateVal });
        hideLoading();
        if (res.data) renderMandiResults(res.data);
    } catch(e) {
        hideLoading();
        toast('Price check failed: ' + e.message, 'error');
    }
}

function renderMandiResults(data) {
    const container = document.getElementById('mandi-results');
    container.style.display = '';
    
    const recColor = data.recommendation === 'SELL' ? '#22c55e' : data.recommendation === 'HOLD' ? '#f59e0b' : '#3b82f6';
    const recIcon = data.recommendation === 'SELL' ? 'fa-check-circle' : data.recommendation === 'HOLD' ? 'fa-pause-circle' : 'fa-clock';
    
    const cp = data.current_price || {};
    const trendIcon = data.price_trend === 'rising' ? 'fa-arrow-up' : data.price_trend === 'falling' ? 'fa-arrow-down' : 'fa-minus';
    const trendColor = data.price_trend === 'rising' ? '#22c55e' : data.price_trend === 'falling' ? '#ef4444' : '#f59e0b';
    
    container.innerHTML = `
        <div class="mandi-recommendation-banner animate-fade-in" style="background:${recColor}15;border-left:4px solid ${recColor}">
            <div class="mandi-rec-icon" style="color:${recColor}"><i class="fas ${recIcon}"></i></div>
            <div class="mandi-rec-content">
                <h3 style="color:${recColor}">${data.recommendation || 'ANALYZING'}</h3>
                <p>${data.recommendation_reason || ''}</p>
                <span class="mandi-best-time"><i class="fas fa-calendar"></i> ${data.best_time_to_sell || ''}</span>
            </div>
        </div>
        
        <div class="mandi-price-cards animate-fade-in">
            <div class="mandi-price-card">
                <div class="mandi-pc-label">Min Price</div>
                <div class="mandi-pc-value">₹${cp.min || 0}</div>
                <div class="mandi-pc-unit">${cp.unit || '/quintal'}</div>
            </div>
            <div class="mandi-price-card highlight">
                <div class="mandi-pc-label">Modal Price</div>
                <div class="mandi-pc-value">₹${cp.modal || 0}</div>
                <div class="mandi-pc-trend" style="color:${trendColor}"><i class="fas ${trendIcon}"></i> ${data.price_trend || 'stable'}</div>
            </div>
            <div class="mandi-price-card">
                <div class="mandi-pc-label">Max Price</div>
                <div class="mandi-pc-value">₹${cp.max || 0}</div>
                <div class="mandi-pc-unit">${cp.unit || '/quintal'}</div>
            </div>
            <div class="mandi-price-card msp-card">
                <div class="mandi-pc-label">MSP ${data.msp?.year || ''}</div>
                <div class="mandi-pc-value">₹${data.msp?.price || 0}</div>
                <div class="mandi-pc-unit">Govt. Support Price</div>
            </div>
        </div>
        
        <div class="card mt-4 animate-fade-in">
            <h3 class="card-title"><i class="fas fa-chart-area"></i> Price History (6 months)</h3>
            <div id="mandi-price-chart" class="chart-container"></div>
        </div>
        
        <div class="card mt-4 animate-fade-in">
            <h3 class="card-title"><i class="fas fa-store-alt"></i> Top Mandis</h3>
            <div class="mandi-table-wrap">
                <table class="mandi-table">
                    <thead><tr><th>Mandi</th><th>State</th><th>Price (₹/q)</th><th>Arrivals</th></tr></thead>
                    <tbody>
                        ${(data.top_mandis || []).map(m => `
                            <tr>
                                <td><strong>${m.name}</strong></td>
                                <td>${m.state || ''}</td>
                                <td class="mandi-price-cell">₹${m.price || 0}</td>
                                <td>${m.arrival_tons ? m.arrival_tons + ' tons' : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        
        ${data.storage_advice ? `<div class="card mt-4 mandi-storage-card animate-fade-in"><h3 class="card-title"><i class="fas fa-warehouse"></i> Storage Advice</h3><p>${data.storage_advice}</p></div>` : ''}
        
        ${data.market_insights ? `<div class="card mt-4 animate-fade-in"><h3 class="card-title"><i class="fas fa-brain"></i> Market Insights</h3><ul class="mandi-insights-list">${data.market_insights.map(i => `<li><i class="fas fa-lightbulb"></i> ${i}</li>`).join('')}</ul></div>` : ''}
    `;
    
    // Translate mandi results
    if (state.language !== 'en') _translateAllTextIn(container, state.language);

    // Render price history chart
    if (data.price_history && data.price_history.length > 0) {
        const months = data.price_history.map(p => p.month);
        const prices = data.price_history.map(p => p.price);
        const mspLine = Array(months.length).fill(data.msp?.price || 0);
        
        Plotly.newPlot('mandi-price-chart', [
            { x: months, y: prices, type: 'scatter', mode: 'lines+markers', name: 'Market Price', line: { color: '#16a34a', width: 3 }, marker: { size: 8 }, fill: 'tozeroy', fillcolor: 'rgba(22,163,74,0.1)' },
            { x: months, y: mspLine, type: 'scatter', mode: 'lines', name: 'MSP', line: { color: '#ef4444', width: 2, dash: 'dash' } }
        ], {
            margin: { t: 20, r: 20, b: 40, l: 60 },
            xaxis: { title: '' },
            yaxis: { title: '₹ / quintal' },
            legend: { orientation: 'h', y: -0.2 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { family: 'Inter' }
        }, { responsive: true, displayModeBar: false });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FEATURE 4: FARMER-TO-FARMER VOICE NOTES
// ═══════════════════════════════════════════════════════════════════════════════

let vnoteRecording = false;
let vnoteRecognition = null;

function toggleVoiceNoteRecording() {
    if (vnoteRecording) {
        stopVoiceNoteRecording();
    } else {
        startVoiceNoteRecording();
    }
}

function startVoiceNoteRecording() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        toast('Voice recording not supported in this browser', 'error');
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    vnoteRecognition = new SpeechRecognition();
    vnoteRecognition.continuous = true;
    vnoteRecognition.interimResults = true;
    vnoteRecognition.lang = document.getElementById('vnote-lang').value === 'hi' ? 'hi-IN' : 'en-IN';
    
    let finalText = '';
    
    vnoteRecognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalText += event.results[i][0].transcript + ' ';
            } else {
                interim += event.results[i][0].transcript;
            }
        }
        document.getElementById('vnote-text').value = finalText + interim;
        document.getElementById('vnote-transcript').style.display = '';
    };
    
    vnoteRecognition.onerror = () => { stopVoiceNoteRecording(); };
    vnoteRecognition.onend = () => { if (vnoteRecording) stopVoiceNoteRecording(); };
    
    vnoteRecognition.start();
    vnoteRecording = true;
    document.getElementById('vnote-mic-btn').classList.add('recording');
    document.getElementById('vnote-mic-icon').className = 'fas fa-stop';
    document.getElementById('vnote-mic-label').textContent = 'Recording... Tap to stop';
    document.getElementById('vnote-wave').style.display = '';
}

function stopVoiceNoteRecording() {
    if (vnoteRecognition) vnoteRecognition.stop();
    vnoteRecording = false;
    document.getElementById('vnote-mic-btn').classList.remove('recording');
    document.getElementById('vnote-mic-icon').className = 'fas fa-microphone';
    document.getElementById('vnote-mic-label').textContent = 'Tap to record your farming tip';
    document.getElementById('vnote-wave').style.display = 'none';
}

async function shareVoiceNote() {
    const text = document.getElementById('vnote-text').value.trim();
    if (!text) { toast('Please record or type a message first', 'error'); return; }
    
    const crop = document.getElementById('vnote-crop').value.trim();
    const lang = document.getElementById('vnote-lang').value;
    
    try {
        await fetchAPI('/voice_notes', {
            username: state.user?.username || 'anonymous',
            audio_text: text,
            crop: crop,
            language: lang
        });
        toast('Voice note shared with community! 🎉', 'success');
        document.getElementById('vnote-text').value = '';
        document.getElementById('vnote-transcript').style.display = 'none';
        loadVoiceNotes();
    } catch(e) {
        toast('Failed to share: ' + e.message, 'error');
    }
}

async function loadVoiceNotes(filter = '') {
    try {
        const url = filter ? `/voice_notes?crop=${encodeURIComponent(filter)}` : '/voice_notes';
        const res = await fetchAPI(url, null, 'GET');
        const feed = document.getElementById('vnote-feed');
        
        if (!res.notes || res.notes.length === 0) {
            feed.innerHTML = '<p class="muted-text">No voice notes yet. Be the first to share!</p>';
            return;
        }
        
        feed.innerHTML = res.notes.map(n => `
            <div class="vnote-item animate-fade-in">
                <div class="vnote-avatar">${(n.username || 'F')[0].toUpperCase()}</div>
                <div class="vnote-content">
                    <div class="vnote-header">
                        <strong>${escapeHtml(n.username || 'Farmer')}</strong>
                        ${n.crop ? `<span class="vnote-crop-tag">${escapeHtml(n.crop)}</span>` : ''}
                        <span class="vnote-time">${n.created_at || ''}</span>
                    </div>
                    <p class="vnote-text-display">${escapeHtml(n.audio_text)}</p>
                    <div class="vnote-actions">
                        <button class="vnote-action-btn" onclick="speakText('${escapeHtml(n.audio_text).replace(/'/g, "\\'")}')"><i class="fas fa-volume-up"></i> Listen</button>
                        <button class="vnote-action-btn" onclick="likeVoiceNote(${n.id}, this)"><i class="fas fa-heart"></i> <span>${n.likes || 0}</span></button>
                    </div>
                </div>
            </div>`).join('');
        if (state.language !== 'en') _translateAllTextIn(feed, state.language);
    } catch(e) { /* silent */ }
}

async function likeVoiceNote(id, btn) {
    try {
        await fetchAPI(`/voice_notes/${id}/like`, {});
        const span = btn.querySelector('span');
        span.textContent = parseInt(span.textContent) + 1;
        btn.classList.add('liked');
    } catch(e) { /* silent */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FEATURE 5: EXPENSE & PROFIT TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

let currentExpenseType = 'expense';

function setExpenseType(type) {
    currentExpenseType = type;
    document.getElementById('exp-type-expense').classList.toggle('active', type === 'expense');
    document.getElementById('exp-type-income').classList.toggle('active', type === 'income');
    
    const catEl = document.getElementById('exp-category');
    if (type === 'income') {
        catEl.innerHTML = '<option value="sale">💰 Crop Sale</option><option value="subsidy">🏛️ Govt Subsidy</option><option value="income">💵 Other Income</option><option value="grant">🎁 Grant/Aid</option>';
    } else {
        catEl.innerHTML = '<option value="seeds">🌱 Seeds</option><option value="fertilizer">💊 Fertilizer</option><option value="pesticide">🧪 Pesticide</option><option value="labor">👷 Labor</option><option value="irrigation">💧 Irrigation</option><option value="equipment">🔧 Equipment</option><option value="transport">🚛 Transport</option><option value="rent">🏡 Land Rent</option><option value="other">📦 Other</option>';
    }
}

async function addExpenseEntry() {
    const category = document.getElementById('exp-category').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const description = document.getElementById('exp-description').value.trim();
    const date = document.getElementById('exp-date').value || new Date().toISOString().split('T')[0];
    
    if (!amount || amount <= 0) { toast('Please enter a valid amount', 'error'); return; }
    
    try {
        const res = await fetchAPI('/expenses', {
            username: state.user?.username || 'anonymous',
            category: category,
            amount: amount,
            description: description,
            date: date
        });
        toast(res.message || 'Entry saved!', 'success');
        document.getElementById('exp-amount').value = '';
        document.getElementById('exp-description').value = '';
        loadExpenseData();
    } catch(e) {
        toast('Failed to save: ' + e.message, 'error');
    }
}

async function loadExpenseData() {
    try {
        const res = await fetchAPI(`/expenses/${state.user?.username || 'anonymous'}`, null, 'GET');
        
        // Update summary cards
        const s = res.summary || {};
        document.getElementById('exp-income').textContent = `₹${(s.total_income || 0).toLocaleString('en-IN')}`;
        document.getElementById('exp-expense').textContent = `₹${(s.total_expense || 0).toLocaleString('en-IN')}`;
        const profitEl = document.getElementById('exp-profit');
        const profit = s.profit || 0;
        profitEl.textContent = `₹${Math.abs(profit).toLocaleString('en-IN')}`;
        profitEl.style.color = profit >= 0 ? '#22c55e' : '#ef4444';
        profitEl.textContent = (profit >= 0 ? '+' : '-') + profitEl.textContent;
        
        // Render entries list
        const listEl = document.getElementById('expense-entries-list');
        if (!res.entries || res.entries.length === 0) {
            listEl.innerHTML = '<p class="muted-text">No entries yet. Start tracking your farm finances!</p>';
        } else {
            listEl.innerHTML = res.entries.slice(0, 20).map(e => `
                <div class="exp-entry-item ${e.entry_type}">
                    <div class="exp-entry-icon ${e.entry_type}">${e.entry_type === 'income' ? '↓' : '↑'}</div>
                    <div class="exp-entry-info">
                        <strong>${e.category}</strong>
                        ${e.description ? `<span class="exp-entry-desc">${escapeHtml(e.description)}</span>` : ''}
                        <span class="exp-entry-date">${e.date || ''}</span>
                    </div>
                    <div class="exp-entry-amount ${e.entry_type}">${e.entry_type === 'income' ? '+' : '-'}₹${(e.amount || 0).toLocaleString('en-IN')}</div>
                    <button class="exp-delete-btn" onclick="deleteExpense(${e.id})" title="Delete"><i class="fas fa-trash-alt"></i></button>
                </div>`).join('');
            if (state.language !== 'en') _translateAllTextIn(listEl, state.language);
        }
        
        // Render charts
        renderExpenseCharts(s);
    } catch(e) { /* silent */ }
}

function renderExpenseCharts(summary) {
    // Category breakdown pie chart
    const cats = summary.category_breakdown || {};
    const catLabels = Object.keys(cats);
    const catValues = Object.values(cats);
    
    if (catLabels.length > 0) {
        Plotly.newPlot('expense-chart', [{
            labels: catLabels,
            values: catValues,
            type: 'pie',
            hole: 0.45,
            marker: { colors: ['#16a34a', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1'] },
            textinfo: 'label+percent',
            textposition: 'outside'
        }], {
            margin: { t: 20, r: 20, b: 20, l: 20 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { family: 'Inter' },
            showlegend: false
        }, { responsive: true, displayModeBar: false });
    }
    
    // Monthly income vs expense bar chart
    const monthly = summary.monthly_data || {};
    const monthKeys = Object.keys(monthly).sort();
    
    if (monthKeys.length > 0) {
        Plotly.newPlot('expense-monthly-chart', [
            { x: monthKeys, y: monthKeys.map(k => monthly[k]?.income || 0), type: 'bar', name: 'Income', marker: { color: '#22c55e' } },
            { x: monthKeys, y: monthKeys.map(k => monthly[k]?.expense || 0), type: 'bar', name: 'Expense', marker: { color: '#ef4444' } }
        ], {
            margin: { t: 20, r: 20, b: 40, l: 60 },
            barmode: 'group',
            xaxis: { title: '' },
            yaxis: { title: '₹' },
            legend: { orientation: 'h', y: -0.2 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { family: 'Inter' }
        }, { responsive: true, displayModeBar: false });
    }
}

async function deleteExpense(id) {
    try {
        await fetchAPI(`/expenses/${id}`, null, 'DELETE');
        toast('Entry deleted', 'info');
        loadExpenseData();
    } catch(e) { toast('Delete failed', 'error'); }
}

async function getExpenseInsights() {
    showLoading('AI is analyzing your finances...');
    try {
        const res = await fetchAPI(`/expenses/${state.user?.username || 'anonymous'}/ai-insights`, null, 'GET');
        hideLoading();
        const insEl = document.getElementById('expense-ai-insights');
        const ins = res.insights || {};
        
        insEl.innerHTML = `
            <div class="ai-insight-content animate-fade-in">
                ${ins.summary ? `<div class="ai-insight-summary"><i class="fas fa-chart-pie"></i> ${ins.summary}</div>` : ''}
                ${ins.profit_status ? `<div class="ai-insight-status ${ins.profit_status}"><i class="fas fa-${ins.profit_status === 'profitable' ? 'smile' : ins.profit_status === 'loss' ? 'frown' : 'meh'}"></i> Status: ${ins.profit_status.toUpperCase()}</div>` : ''}
                ${ins.savings_tips ? `<div class="ai-insight-section"><h4><i class="fas fa-piggy-bank"></i> Money Saving Tips</h4><ul>${ins.savings_tips.map(t => `<li>${t}</li>`).join('')}</ul></div>` : ''}
                ${ins.income_tips ? `<div class="ai-insight-section"><h4><i class="fas fa-hand-holding-usd"></i> Increase Income</h4><ul>${ins.income_tips.map(t => `<li>${t}</li>`).join('')}</ul></div>` : ''}
                ${ins.risk_alert ? `<div class="ai-insight-alert"><i class="fas fa-exclamation-triangle"></i> ${ins.risk_alert}</div>` : ''}
            </div>`;
        if (state.language !== 'en') _translateAllTextIn(insEl, state.language);
    } catch(e) {
        hideLoading();
        toast('Could not get insights', 'error');
    }
}

async function fetchAPI(endpoint, body, method = 'POST') {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
    return data;
}

function showLoading(msg) {
    const el = document.getElementById('loading-overlay');
    const loadMsg = msg || 'Processing...';
    document.getElementById('loading-message').textContent = loadMsg;
    el.style.display = '';
    // Auto-translate loading message
    if (state.language !== 'en') {
        translateText(loadMsg, state.language).then(t => {
            document.getElementById('loading-message').textContent = t;
        });
    }
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.innerHTML = `<i class="fas ${icons[type] || icons.info} toast-icon"></i><span>${message}</span>`;
    container.appendChild(div);
    // Auto-translate toast message to selected language
    if (state.language !== 'en' && /[a-zA-Z]{2,}/.test(message)) {
        translateText(message, state.language).then(translated => {
            const span = div.querySelector('span');
            if (span) span.textContent = translated;
        });
    }
    setTimeout(() => { div.style.opacity = '0'; div.style.transform = 'translateX(80px)'; setTimeout(() => div.remove(), 300); }, 4000);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Service Worker Registration ───
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
}

// ═══════════════════════════════════════
//  PRODUCTION UI — Header, Footer, Breadcrumb, Back-to-top, Search, Notifications
// ═══════════════════════════════════════

const pageNameMap = {
    'dashboard': 'Dashboard',
    'farm-setup': 'Farm Setup',
    'recommendation': 'AI Recommendations',
    'rotation': 'Crop Planner',
    'fertilizer': 'Fertilizer Calculator',
    'sustainability': 'Sustainability',
    'community': 'Community',
    'market': 'Market Forecast',
    'chatbot': 'AI Assistant',
    'weather': 'Weather',
    'soil-analysis': 'Soil Analysis',
    'pest-prediction': 'Pest Prediction',
    'history': 'My History',
    'offline': 'Offline Mode',
    'profile': 'Settings',
    'crop-diagnosis': 'Crop Diagnosis',
    'govt-schemes': 'Govt Schemes',
    'mandi-prices': 'Mandi Prices',
    'voice-notes': 'Voice Notes',
    'expense-tracker': 'Expense Tracker'
};

function updateBreadcrumb(pageId) {
    const el = document.getElementById('breadcrumb-current');
    if (el) el.textContent = pageNameMap[pageId] || pageId;
}

// ─── Global Search ───
function handleGlobalSearch(query) {
    const resultsEl = document.getElementById('search-results');
    if (!resultsEl) return;
    if (!query || query.length < 2) { resultsEl.style.display = 'none'; return; }
    const q = query.toLowerCase();
    const matches = Object.entries(pageNameMap).filter(([key, name]) =>
        name.toLowerCase().includes(q) || key.includes(q)
    ).slice(0, 6);
    if (!matches.length) { resultsEl.style.display = 'none'; return; }
    resultsEl.innerHTML = matches.map(([key, name]) =>
        `<div class="search-result-item" onclick="navigate('${key}'); document.getElementById('search-results').style.display='none'; document.getElementById('global-search').value='';"><i class="fas fa-arrow-right"></i> ${name}</div>`
    ).join('');
    resultsEl.style.display = 'block';
}

// Close search results on outside click
document.addEventListener('click', (e) => {
    const sr = document.getElementById('search-results');
    const si = document.getElementById('global-search');
    if (sr && !sr.contains(e.target) && e.target !== si) sr.style.display = 'none';
});

// ─── Notifications ───
function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    // Close user dropdown if open
    const dd = document.getElementById('user-dropdown-menu');
    if (dd) dd.style.display = 'none';
}

function addNotification(message, icon = 'fas fa-info-circle') {
    const list = document.getElementById('notif-list');
    const dot = document.getElementById('notif-dot');
    if (!list) return;
    // Remove empty state
    const empty = list.querySelector('.notif-empty');
    if (empty) empty.remove();
    const item = document.createElement('div');
    item.className = 'notif-item';
    item.innerHTML = `<div class="notif-item-icon"><i class="${icon}"></i></div><div><div class="notif-item-text">${message}</div><div class="notif-item-time">Just now</div></div>`;
    list.prepend(item);
    if (dot) { dot.classList.add('active'); dot.style.display = 'block'; }
}

function clearNotifications() {
    const list = document.getElementById('notif-list');
    const dot = document.getElementById('notif-dot');
    if (list) list.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>No new notifications</p></div>';
    if (dot) { dot.classList.remove('active'); dot.style.display = 'none'; }
}

// ─── User Dropdown ───
function toggleUserDropdown() {
    const dd = document.getElementById('user-dropdown-menu');
    if (!dd) return;
    const isVisible = dd.style.display !== 'none';
    dd.style.display = isVisible ? 'none' : 'block';
    // Close notif panel
    const np = document.getElementById('notif-panel');
    if (np) np.style.display = 'none';
}

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    const dd = document.getElementById('user-dropdown-menu');
    const ddBtn = document.querySelector('.header-avatar-btn');
    if (dd && dd.style.display !== 'none' && !dd.contains(e.target) && !ddBtn?.contains(e.target)) {
        dd.style.display = 'none';
    }
    const np = document.getElementById('notif-panel');
    const nb = document.getElementById('notif-btn');
    if (np && np.style.display !== 'none' && !np.contains(e.target) && !nb?.contains(e.target)) {
        np.style.display = 'none';
    }
});

// ─── Back to Top ───
function scrollToTop() {
    const mainArea = document.querySelector('.main-area');
    if (mainArea) mainArea.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show/hide back-to-top based on scroll
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('back-to-top');
    const mainArea = document.querySelector('.main-area');
    if (btn && mainArea) {
        mainArea.addEventListener('scroll', () => {
            btn.classList.toggle('visible', mainArea.scrollTop > 400);
        });
    }
});

// ─── Update community post count on dashboard ───
function updateCommunityCount() {
    const el = document.getElementById('stat-community');
    if (!el) return;
    const posts = document.querySelectorAll('#community-feed .community-post');
    el.textContent = posts.length || '0';
}

// ═══════════════════════════════════════════════════════════════
//  VISUAL POLISH — Scroll Reveal, Animated Counters, Tilt cards
//  ═══════════════════════════════════════════════════════════════

// ── Scroll Reveal: fade-in cards/sections as they enter viewport ──
(function initScrollReveal() {
    function tagElements() {
        const selectors = [
            '.stat-card', '.feature-card', '.explore-card', '.step-card',
            '.card', '.agent-card', '.pest-card', '.weather-day-card',
            '.npk-card', '.exp-sum-card', '.one-tap-card'
        ];
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (!el.classList.contains('scroll-reveal')) {
                    el.classList.add('scroll-reveal');
                }
            });
        });
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    function observe() {
        document.querySelectorAll('.scroll-reveal:not(.revealed)').forEach(el => observer.observe(el));
    }

    // Run after DOM ready and each navigation
    const _origNavigate = window.navigate;
    if (typeof _origNavigate === 'function') {
        window.navigate = function() {
            _origNavigate.apply(this, arguments);
            setTimeout(() => { tagElements(); observe(); }, 100);
        };
    }
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => { tagElements(); observe(); }, 200);
    });
    // Also run on main-area scroll for dynamically added content
    setTimeout(() => {
        const mainArea = document.querySelector('.main-area');
        if (mainArea) {
            mainArea.addEventListener('scroll', () => {
                observe();
            }, { passive: true });
        }
    }, 500);
})();

// ── Animated Number Counter — animates stat values on dashboard ──
function animateCounter(el, targetVal, duration = 800) {
    if (!el || isNaN(targetVal)) return;
    const start = 0;
    const startTime = performance.now();
    const isFloat = String(targetVal).includes('.');
    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = start + (targetVal - start) * eased;
        el.textContent = isFloat ? current.toFixed(1) : Math.round(current);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// Hook into stat updates to animate them
(function hookStatAnimations() {
    const statIds = ['stat-recs', 'stat-community'];
    // MutationObserver approach: whenever stat text changes, animate
    statIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const obs = new MutationObserver(() => {
            const val = parseFloat(el.textContent);
            if (!isNaN(val) && val > 0) {
                obs.disconnect();
                el.textContent = '0';
                animateCounter(el, val, 900);
                setTimeout(() => obs.observe(el, { childList: true, characterData: true, subtree: true }), 1000);
            }
        });
        obs.observe(el, { childList: true, characterData: true, subtree: true });
    });
})();

// ── Tilt hover effect — subtle 3D parallax on cards ──
(function initTiltCards() {
    document.addEventListener('DOMContentLoaded', () => {
        const cards = document.querySelectorAll('.dash-hero, .one-tap-card');
        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                card.style.transform = `perspective(800px) rotateX(${y * -3}deg) rotateY(${x * 3}deg)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
                card.style.transition = 'transform 0.4s ease';
                setTimeout(() => card.style.transition = '', 400);
            });
        });
    });
})();

// ── Parallax floating elements in hero ──
(function initHeroParallax() {
    document.addEventListener('DOMContentLoaded', () => {
        const hero = document.querySelector('.dash-hero');
        if (!hero) return;
        // Create floating decorative elements
        const emojis = ['🌱', '🌿', '☀️', '💧', '🦋'];
        emojis.forEach((emoji, i) => {
            const el = document.createElement('span');
            el.className = 'hero-float-el';
            el.textContent = emoji;
            el.style.cssText = `
                position:absolute; font-size:${1 + Math.random()}rem;
                top:${10 + Math.random() * 70}%; left:${5 + Math.random() * 85}%;
                opacity:0.12; z-index:1; pointer-events:none;
                animation: float ${3 + i}s ease-in-out infinite;
                animation-delay: ${i * 0.5}s;
            `;
            hero.appendChild(el);
        });
    });
})();

// ── Smooth page transition pulse on navigate ──
(function enhancePageTransitions() {
    const origNav = window.navigate;
    if (typeof origNav !== 'function') return;
    window.navigate = function(page) {
        const pages = document.querySelectorAll('.page');
        pages.forEach(p => {
            if (p.classList.contains('active')) {
                p.style.opacity = '0';
                p.style.transform = 'translateY(10px)';
            }
        });
        setTimeout(() => {
            origNav(page);
            const active = document.querySelector('.page.active');
            if (active) {
                active.style.opacity = '0';
                active.style.transform = 'translateY(10px)';
                requestAnimationFrame(() => {
                    active.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
                    active.style.opacity = '1';
                    active.style.transform = 'translateY(0)';
                    setTimeout(() => {
                        active.style.transition = '';
                        active.style.transform = '';
                    }, 400);
                });
            }
        }, 150);
    };
})();

// ═══════════════════════════════════════
//  FACE AUTHENTICATION (Integrated verification step)
// ═══════════════════════════════════════

var faceStream = null;
// Stores context: { mode: 'signup'|'login'|'voice-auto', username, phone, farm_name, location, source: 'manual'|'voice'|'voiceFlow' }
var _faceAuthContext = null;

function startFaceAuthVerification(ctx) {
    _faceAuthContext = ctx;
    const overlay = document.getElementById('face-auth-overlay');
    overlay.style.display = 'flex';
    document.getElementById('face-auth-actions').style.display = 'none';
    document.getElementById('face-register-section').style.display = 'none';
    document.getElementById('face-auth-status').textContent = 'Starting camera...';
    document.getElementById('face-auth-status').style.color = '#16a34a';
    const promptEl = document.getElementById('face-auth-prompt');
    if (promptEl) promptEl.textContent = `${ctx.username}, look at the camera to verify`;

    const video = document.getElementById('face-video');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 280, height: 280 } })
        .then(stream => {
            faceStream = stream;
            video.srcObject = stream;
            document.getElementById('face-auth-status').textContent = 'Camera ready \u2014 hold still...';
            document.getElementById('face-scan-line').style.display = 'block';
            speakText('Look at the camera to verify your face', state.language);
            setTimeout(() => captureFaceAndVerify(), 2500);
        })
        .catch(() => {
            document.getElementById('face-auth-status').textContent = 'Camera not available. Proceeding without face verification...';
            // If camera denied, skip face auth and proceed normally
            setTimeout(() => completeFaceAuthFlow(null), 1500);
        });
}

// Old standalone function kept for backward compatibility
function startFaceAuth() {
    startFaceAuthVerification({ mode: 'signup', username: 'Guest', source: 'manual' });
}

function captureFaceAndVerify() {
    const video = document.getElementById('face-video');
    const canvas = document.getElementById('face-canvas');
    canvas.width = 280;
    canvas.height = 280;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, 280, 280);
    const imageData = ctx.getImageData(0, 0, 280, 280);
    const faceHash = computeFaceHash(imageData.data);
    document.getElementById('face-scan-line').style.display = 'none';
    document.getElementById('face-auth-status').textContent = 'Verifying face...';
    verifyFaceForAuth(faceHash);
}

async function verifyFaceForAuth(faceHash) {
    const ctx = _faceAuthContext;
    if (!ctx) return;

    if (ctx.mode === 'login') {
        // Login: check if face matches the user
        try {
            const res = await fetch(`${API}/face_login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ face_hash: faceHash })
            });
            const data = await res.json();
            if (res.ok && data.username) {
                // Face matched — verify it's the same user or accept
                document.getElementById('face-auth-status').textContent = '\u2705 Face verified!';
                document.getElementById('face-match-name').textContent = `Welcome back, ${data.username}!`;
                document.getElementById('face-auth-actions').style.display = 'block';
                window._pendingFaceHash = faceHash;
                window._pendingFaceUser = data.username;
                speakText(`Face verified! Welcome back, ${data.username}!`, state.language);
            } else {
                // No face registered yet — register this face for the user
                document.getElementById('face-auth-status').textContent = 'Registering your face...';
                document.getElementById('face-register-section').style.display = 'block';
                await registerFaceForUser(ctx.username, faceHash);
            }
        } catch {
            // Server error — skip face and login directly
            completeFaceAuthFlow(faceHash);
        }
    } else {
        // Signup or voice-auto: register the face
        document.getElementById('face-auth-status').textContent = 'Registering your face...';
        document.getElementById('face-register-section').style.display = 'block';
        await registerFaceForUser(ctx.username, faceHash);
    }
}

async function registerFaceForUser(username, faceHash) {
    try {
        await fetch(`${API}/face_register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, face_hash: faceHash })
        });
        document.getElementById('face-auth-status').textContent = '\u2705 Face registered!';
        speakText('Face registered successfully!', state.language);
    } catch {
        document.getElementById('face-auth-status').textContent = 'Face saved locally.';
    }
    setTimeout(() => completeFaceAuthFlow(faceHash), 1200);
}

async function completeFaceAuthFlow(faceHash) {
    const ctx = _faceAuthContext;
    if (!ctx) return;
    stopFaceCamera();
    document.getElementById('face-auth-overlay').style.display = 'none';
    showLoading();

    try {
        if (ctx.mode === 'signup' || ctx.mode === 'voice-auto') {
            // Signup flow
            const username = ctx.username;
            const farmName = ctx.farm_name || `${username}'s Farm`;
            try {
                await fetchAPI('/signup', { username, farm_name: farmName, profile_picture: null });
            } catch (err) {
                // If already exists, treat as login
                if (!err.message?.includes('already exists')) {
                    toast(err.message || 'Signup failed', 'error');
                    hideLoading();
                    goBackToMethodPicker();
                    return;
                }
            }
            state.user = { username, farm_name: farmName, phone: ctx.phone || '', location: ctx.location || '' };
            localStorage.setItem('agri_user', JSON.stringify(state.user));
            speakText(`Welcome to AgriSmart, ${username}!`, state.language);
            toast(`Welcome, ${username}!`, 'success');
            enterApp();
            if (ctx.source === 'voiceFlow') {
                vcSpeak({ en: `Welcome ${username}! Your account is ready. You are now on the home page.` }, () => setVoiceState('idle'));
            }
        } else {
            // Login flow
            const username = ctx.username;
            try {
                const res = await fetchAPI('/login', { username });
                state.user = res;
                localStorage.setItem('agri_user', JSON.stringify(state.user));
                speakText(`Welcome back, ${res.username}!`, state.language);
                toast(`Welcome back, ${res.username}!`, 'success');
                enterApp();
                if (ctx.source === 'voiceFlow') {
                    vcSpeak({ en: `Welcome back, ${res.username}!` }, () => setVoiceState('idle'));
                }
            } catch {
                // User not found — try signup instead
                try {
                    await fetchAPI('/signup', { username, farm_name: `${username}'s Farm`, profile_picture: null });
                } catch { /* ignore */ }
                state.user = { username, farm_name: `${username}'s Farm` };
                localStorage.setItem('agri_user', JSON.stringify(state.user));
                speakText(`Welcome, ${username}!`, state.language);
                toast(`Welcome, ${username}!`, 'success');
                enterApp();
            }
        }
    } finally {
        hideLoading();
        _faceAuthContext = null;
    }
}

function confirmFaceAuth() {
    // Confirm face match — proceed to complete the flow
    completeFaceAuthFlow(window._pendingFaceHash);
}

function retryFaceAuth() {
    document.getElementById('face-auth-actions').style.display = 'none';
    document.getElementById('face-register-section').style.display = 'none';
    document.getElementById('face-auth-status').textContent = 'Retrying... hold still';
    document.getElementById('face-scan-line').style.display = 'block';
    setTimeout(() => captureFaceAndVerify(), 2000);
}

function cancelFaceAuth() {
    stopFaceCamera();
    const overlay = document.getElementById('face-auth-overlay');
    if (overlay) overlay.style.display = 'none';
    _faceAuthContext = null;
}

function goBackFromFaceAuth() {
    cancelFaceAuth();
    goBackToMethodPicker();
}

function computeFaceHash(pixelData) {
    const size = 16;
    const srcW = 280, srcH = 280;
    const gray = [];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const sx = Math.floor(x * srcW / size);
            const sy = Math.floor(y * srcH / size);
            const idx = (sy * srcW + sx) * 4;
            gray.push(pixelData[idx] * 0.299 + pixelData[idx + 1] * 0.587 + pixelData[idx + 2] * 0.114);
        }
    }
    const mean = gray.reduce((a, b) => a + b, 0) / gray.length;
    return gray.map(v => v > mean ? '1' : '0').join('');
}

function stopFaceCamera() {
    if (faceStream) {
        faceStream.getTracks().forEach(t => t.stop());
        faceStream = null;
    }
    const video = document.getElementById('face-video');
    if (video) video.srcObject = null;
}

// ═══════════════════════════════════════
//  CROP ROTATION VOICE NOTE
// ═══════════════════════════════════════

let lastRotationPlanText = '';

function speakRotationPlan() {
    if (lastRotationPlanText) {
        speakText(lastRotationPlanText, state.language);
    } else {
        toast('No rotation plan to read', 'info');
    }
}

// ═══════════════════════════════════════
//  WEATHER EXPLANATION (SIMPLE)
// ═══════════════════════════════════════

let lastWeatherExplanation = '';

function speakWeatherExplanation() {
    if (lastWeatherExplanation) {
        speakText(lastWeatherExplanation, state.language);
    }
}

// ═══════════════════════════════════════
//  SUSTAINABILITY EXPLANATION VOICE
// ═══════════════════════════════════════

function speakSustainabilityExplanation() {
    const text = 'Your sustainability score is based on three factors. Water usage counts for 40 percent, lower water use gives a higher score. Fertilizer use counts for 30 percent, using less chemical fertilizer is better. Crop rotation counts for 30 percent, rotating crops keeps soil healthy. A score above 80 is excellent, 60 to 79 is good, 40 to 59 needs improvement, and below 40 is critical.';
    speakText(text, state.language);
}

// ═══════════════════════════════════════
//  DRAGGABLE VOICE FAB
// ═══════════════════════════════════════

(function initDraggableVoiceFab() {
    document.addEventListener('DOMContentLoaded', () => {
        const fab = document.getElementById('voice-btn');
        if (!fab) return;
        let isDragging = false, wasDragged = false;
        let startX, startY, startLeft, startTop;

        function onStart(e) {
            const touch = e.touches ? e.touches[0] : e;
            isDragging = true;
            wasDragged = false;
            startX = touch.clientX;
            startY = touch.clientY;
            const rect = fab.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            fab.style.transition = 'none';
            fab.style.zIndex = '9999';
        }
        function onMove(e) {
            if (!isDragging) return;
            const touch = e.touches ? e.touches[0] : e;
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) wasDragged = true;
            if (!wasDragged) return;
            if (e.cancelable) e.preventDefault();
            const newLeft = Math.max(0, Math.min(window.innerWidth - fab.offsetWidth, startLeft + dx));
            const newTop = Math.max(0, Math.min(window.innerHeight - fab.offsetHeight, startTop + dy));
            fab.style.position = 'fixed';
            fab.style.left = newLeft + 'px';
            fab.style.top = newTop + 'px';
            fab.style.right = 'auto';
            fab.style.bottom = 'auto';
        }
        function onEnd() {
            isDragging = false;
            fab.style.transition = 'transform 0.2s';
            fab.style.zIndex = '30';
            if (wasDragged) {
                // Save position
                localStorage.setItem('voiceFabPos', JSON.stringify({ left: fab.style.left, top: fab.style.top }));
            }
        }

        fab.addEventListener('touchstart', onStart, { passive: true });
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
        fab.addEventListener('mousedown', onStart);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);

        // Override click to ignore drag
        fab.addEventListener('click', (e) => {
            if (wasDragged) { e.stopImmediatePropagation(); wasDragged = false; }
        }, true);

        // Restore saved position
        const saved = localStorage.getItem('voiceFabPos');
        if (saved) {
            try {
                const pos = JSON.parse(saved);
                fab.style.position = 'fixed';
                fab.style.left = pos.left;
                fab.style.top = pos.top;
                fab.style.right = 'auto';
                fab.style.bottom = 'auto';
            } catch {}
        }
    });
})();
