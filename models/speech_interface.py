# import streamlit as st
import speech_recognition as sr
try:
    import pyttsx3
except Exception:
    pyttsx3 = None
from gtts import gTTS
import io
import tempfile
import os
import threading
import time
from typing import Optional, Dict, List
try:
    from streamlit_webrtc import webrtc_streamer, WebRtcMode, RTCConfiguration
    import av
    WEBRTC_AVAILABLE = True
except Exception:
    WEBRTC_AVAILABLE = False
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SpeechInterface:
    """
    Comprehensive speech interface supporting multiple languages for farmers
    """
    
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.microphone = None
        self.pyaudio_available = False
        self.gtts_available = True  # gTTS is imported; availability may depend on network
        self.browser_mic_available = False
        
        # Try to initialize microphone with error handling
        try:
            self.microphone = sr.Microphone()
            self.pyaudio_available = True
            logger.info("PyAudio and microphone initialized successfully")
        except AttributeError as e:
            if "PyAudio" in str(e):
                logger.warning("PyAudio not available. Voice input will be disabled.")
                self.pyaudio_available = False
            else:
                logger.error(f"Microphone initialization error: {e}")
                self.pyaudio_available = False
        except Exception as e:
            logger.error(f"Unexpected error initializing microphone: {e}")
            self.pyaudio_available = False
        
        # Language mapping for speech recognition and synthesis
        self.language_codes = {
            'English': 'en',
            'Hindi': 'hi',
            'Telugu': 'te',
            'Kannada': 'kn',
            'Tamil': 'ta',
            'Malayalam': 'ml',
            'Marathi': 'mr',
            'Bengali': 'bn',
            'Gujarati': 'gu',
            'Punjabi': 'pa',
            'Urdu': 'ur',
            'French': 'fr',
            'Spanish': 'es'
        }
        
        # Initialize text-to-speech engine
        if pyttsx3 is not None:
            try:
                self.tts_engine = pyttsx3.init()
                self.tts_engine.setProperty('rate', 150)  # Speed of speech
                self.tts_engine.setProperty('volume', 0.9)  # Volume level
            except Exception as e:
                logger.warning(f"Could not initialize TTS engine: {e}")
                self.tts_engine = None
        else:
            self.tts_engine = None

    def has_tts(self) -> bool:
        """Return True if any TTS option (gTTS or pyttsx3) is available."""
        return bool(self.tts_engine) or self.gtts_available
    
    def speech_to_text(self, language: str = 'English', timeout: int = 5) -> Optional[str]:
        """
        Convert speech to text using microphone input
        """
        # Prefer native mic if available, else offer WebRTC capture
        if not (self.pyaudio_available and self.microphone is not None):
            if WEBRTC_AVAILABLE:
                return self._speech_to_text_webrtc(language)
            st.error("❌ Microphone not available. PyAudio not installed and WebRTC not available.")
            return None
        
        try:
            with self.microphone as source:
                # Adjust for ambient noise
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                
                # Show listening indicator
                st.info("🎤 Listening... Speak now!")
                
                # Listen for audio
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=10)
                
                # Show processing indicator
                st.info("🔄 Processing your speech...")
                
                # Convert speech to text
                language_code = self.language_codes.get(language, 'en')
                text = self.recognizer.recognize_google(audio, language=language_code)
                
                st.success(f"✅ Heard: {text}")
                return text
                
        except sr.WaitTimeoutError:
            st.warning("⏰ No speech detected. Please try again.")
            return None
        except sr.UnknownValueError:
            st.error("❌ Could not understand the speech. Please speak clearly.")
            return None
        except sr.RequestError as e:
            st.error(f"❌ Speech recognition service error: {e}")
            return None
        except Exception as e:
            st.error(f"❌ Unexpected error: {e}")
            return None

    def _speech_to_text_webrtc(self, language: str = 'English') -> Optional[str]:
        """Capture audio in-browser using WebRTC and run recognition on buffered audio."""
        st.info("🎤 Using browser microphone (WebRTC)")
        rtc_configuration = RTCConfiguration({
            "iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]
        })

        audio_frames: List[bytes] = []

        def recv_audio(frame: av.AudioFrame):
            # Convert to bytes and buffer
            pcm = frame.to_ndarray()
            # Downmix to mono int16 expected by Recognizer
            import numpy as np
            if pcm.ndim > 1:
                pcm = pcm.mean(axis=0)
            pcm = pcm.astype('int16').tobytes()
            audio_frames.append(pcm)
            return frame

        ctx = webrtc_streamer(
            key="webrtc-audio",
            mode=WebRtcMode.SENDONLY,
            audio_receiver_size=1024,
            rtc_configuration=rtc_configuration,
            media_stream_constraints={"audio": True, "video": False},
            async_processing=False,
            audio_frame_callback=recv_audio
        )

        self.browser_mic_available = bool(ctx and ctx.state.playing)

        if st.button("🛑 Stop & Transcribe", help="Stop capture and transcribe the recorded audio"):
            if not audio_frames:
                st.warning("No audio captured")
                return None
            # Build an AudioData object for speech_recognition
            import numpy as np
            pcm = b"".join(audio_frames)
            sr_rate = 48000  # typical WebRTC rate
            sample_width = 2  # int16
            audio_data = sr.AudioData(pcm, sr_rate, sample_width)
            try:
                language_code = self.language_codes.get(language, 'en')
                text = self.recognizer.recognize_google(audio_data, language=language_code)
                st.success(f"✅ Heard: {text}")
                return text
            except sr.UnknownValueError:
                st.error("❌ Could not understand the speech.")
            except sr.RequestError as e:
                st.error(f"❌ Speech recognition service error: {e}")
        return None
    
    def text_to_speech(self, text: str, language: str = 'English', use_gtts: bool = True) -> bool:
        """
        Convert text to speech using either gTTS (online) or pyttsx3 (offline)
        """
        try:
            if use_gtts and text.strip():
                # Use Google Text-to-Speech (online, better quality, supports more languages)
                language_code = self.language_codes.get(language, 'en')
                tts = gTTS(text=text, lang=language_code, slow=False)
                
                # Create temporary file with better handling
                import uuid
                temp_filename = f"tts_{uuid.uuid4().hex}.mp3"
                temp_path = os.path.join(tempfile.gettempdir(), temp_filename)
                
                try:
                    tts.save(temp_path)
                    
                    # Play audio in Streamlit
                    with open(temp_path, 'rb') as audio_file:
                        audio_bytes = audio_file.read()
                        st.audio(audio_bytes, format='audio/mp3')
                        st.info(f"🔊 Audio generated! If you don't hear anything, check your speakers/headphones and browser audio settings.")
                        
                        # Provide download option as fallback
                        st.download_button(
                            label="⬇️ Download Audio File",
                            data=audio_bytes,
                            file_name=f"recommendation_audio_{uuid.uuid4().hex[:8]}.mp3",
                            mime="audio/mp3",
                            help="Download the audio file to play it in your preferred audio player"
                        )
                    
                    # Clean up with retry mechanism
                    try:
                        os.unlink(temp_path)
                    except PermissionError:
                        # File might still be in use, try again after a short delay
                        import time
                        time.sleep(0.5)
                        try:
                            os.unlink(temp_path)
                        except:
                            # If still can't delete, just leave it - temp files are cleaned up by system
                            pass
                    
                    return True
                    
                except Exception as e:
                    logger.error(f"Error with gTTS file handling: {e}")
                    # Fallback to pyttsx3
                    if self.tts_engine:
                        self.tts_engine.say(text)
                        self.tts_engine.runAndWait()
                        return True
                    return False
                
            elif self.tts_engine and text.strip():
                # Use pyttsx3 (offline, limited language support)
                try:
                    self.tts_engine.say(text)
                    self.tts_engine.runAndWait()
                    st.info("🔊 Playing audio using offline TTS engine...")
                    return True
                except Exception as e:
                    logger.error(f"Error with pyttsx3: {e}")
                    st.error(f"❌ Offline TTS error: {e}")
                    return False
                
            else:
                if not text.strip():
                    st.warning("⚠️ No text provided to speak")
                else:
                    st.warning("⚠️ No TTS engine available. Please check your internet connection for online TTS or install offline TTS dependencies.")
                return False
                
        except Exception as e:
            logger.error(f"Error in text-to-speech: {e}")
            st.error(f"❌ Text-to-speech error: {e}")
            return False
    
    def create_voice_input_widget(self, label: str, language: str = 'English', 
                                key: str = None, help_text: str = None) -> Optional[str]:
        """
        Create a voice input widget for Streamlit
        """
        col1, col2 = st.columns([3, 1])
        
        # Get the current value from session state
        text_key = f"{key}_text" if key else "text_input"
        voice_result_key = f"{key}_voice_result" if key else "voice_result"
        
        # Initialize session state for voice result
        if voice_result_key not in st.session_state:
            st.session_state[voice_result_key] = ""
        
        with col1:
            text_input = st.text_input(
                label, 
                key=text_key,
                help=help_text
            )
        
        with col2:
            if st.button("🎤 Voice", key=f"{key}_voice_btn" if key else None, help="Click to speak"):
                if not self.pyaudio_available:
                    st.error("❌ Microphone not available")
                    return text_input
                
                with st.spinner("Preparing microphone..."):
                    time.sleep(1)  # Give time for microphone to initialize
                
                try:
                    voice_text = self.speech_to_text(language)
                    if voice_text:
                        # Store voice input in session state
                        st.session_state[voice_result_key] = voice_text
                        st.success(f"✅ Voice input: {voice_text}")
                        # Show the voice input in a separate display
                        st.info(f"🎤 Voice input captured: **{voice_text}**")
                        st.info("💡 Copy this text and paste it into the input field above")
                        # Force a rerun to update the text input
                        st.rerun()
                    else:
                        st.warning("⚠️ No voice input detected")
                except Exception as e:
                    st.error(f"❌ Voice input error: {e}")
                    logger.error(f"Voice input error: {e}")
        
        # Show voice result if available
        if st.session_state.get(voice_result_key):
            st.info(f"🎤 Last voice input: **{st.session_state[voice_result_key]}**")
        
        return text_input
    
    def create_voice_output_button(self, text: str, language: str = 'English', 
                                 button_text: str = "🔊 Listen", key: str = None):
        """
        Create a voice output button for Streamlit
        """
        if st.button(button_text, key=f"{key}_speak" if key else None, help="Click to hear the text"):
            if not text or not text.strip():
                st.warning("⚠️ No text to speak")
                return
            
            with st.spinner("Generating speech..."):
                success = self.text_to_speech(text, language)
                if success:
                    st.success("✅ Audio generated successfully!")
                else:
                    st.error("❌ Failed to generate audio. Please try again.")
    
    def create_voice_interface_for_sustainability(self, language: str = 'English') -> Dict:
        """
        Create voice interface specifically for sustainability tracker
        """
        
        # Voice input for water usage
        water_usage_text = self.create_voice_input_widget(
            "💧 Water Usage (ML/ha) - Voice Input",
            language=language,
            key="water_voice",
            help_text="Speak the water usage amount"
        )
        
        # Voice input for fertilizer usage
        fertilizer_usage_text = self.create_voice_input_widget(
            "🧪 Fertilizer Usage (tons/ha) - Voice Input", 
            language=language,
            key="fertilizer_voice",
            help_text="Speak the fertilizer usage amount"
        )
        
        # Voice input for crop rotation
        rotation_text = self.create_voice_input_widget(
            "🔄 Crop Rotation (Yes/No) - Voice Input",
            language=language, 
            key="rotation_voice",
            help_text="Say 'Yes' or 'No' for crop rotation"
        )
        
        # Get voice results from session state
        water_voice = st.session_state.get("water_voice_voice_result", "")
        fertilizer_voice = st.session_state.get("fertilizer_voice_voice_result", "")
        rotation_voice = st.session_state.get("rotation_voice_voice_result", "")
        
        # Use voice input if available, otherwise use text input
        water_usage_text = water_voice if water_voice else water_usage_text
        fertilizer_usage_text = fertilizer_voice if fertilizer_voice else fertilizer_usage_text
        rotation_text = rotation_voice if rotation_voice else rotation_text
        
        # Process voice inputs
        data = {}
        
        if water_usage_text:
            try:
                # Extract numbers from voice input
                import re
                numbers = re.findall(r'\d+\.?\d*', water_usage_text)
                if numbers:
                    data['water_score'] = float(numbers[0])
            except:
                st.warning("Could not parse water usage from voice input")
        
        if fertilizer_usage_text:
            try:
                import re
                numbers = re.findall(r'\d+\.?\d*', fertilizer_usage_text)
                if numbers:
                    data['fertilizer_use'] = float(numbers[0])
            except:
                st.warning("Could not parse fertilizer usage from voice input")
        
        if rotation_text:
            rotation_lower = rotation_text.lower()
            if any(word in rotation_lower for word in ['yes', 'haan', 'ಹೌದು', 'అవును', 'ஆம்', 'അതെ', 'हाँ', 'oui', 'sí']):
                data['rotation'] = True
            elif any(word in rotation_lower for word in ['no', 'nahi', 'ಇಲ್ಲ', 'లేదు', 'இல்லை', 'ഇല്ല', 'नहीं', 'non', 'no']):
                data['rotation'] = False
        
        return data
    
    def create_voice_interface_for_farm_details(self, language: str = 'English') -> Dict:
        """
        Create voice interface for farm details input
        """
        
        # Voice input for farm size
        farm_size_text = self.create_voice_input_widget(
            "🌾 Farm Size (hectares) - Voice Input",
            language=language,
            key="farm_size_voice",
            help_text="Speak the farm size in hectares"
        )
        
        # Voice input for crop preference
        crop_preference_text = self.create_voice_input_widget(
            "🌱 Crop Preference - Voice Input",
            language=language,
            key="crop_preference_voice", 
            help_text="Speak your crop preference (Grains, Vegetables, Fruits)"
        )
        
        # Voice input for soil type
        soil_type_text = self.create_voice_input_widget(
            "🗺️ Soil Type - Voice Input",
            language=language,
            key="soil_type_voice",
            help_text="Speak the soil type (Loamy, Sandy, Clay)"
        )
        
        # Get voice results from session state
        farm_size_voice = st.session_state.get("farm_size_voice_voice_result", "")
        crop_preference_voice = st.session_state.get("crop_preference_voice_voice_result", "")
        soil_type_voice = st.session_state.get("soil_type_voice_voice_result", "")
        
        # Use voice input if available, otherwise use text input
        farm_size_text = farm_size_voice if farm_size_voice else farm_size_text
        crop_preference_text = crop_preference_voice if crop_preference_voice else crop_preference_text
        soil_type_text = soil_type_voice if soil_type_voice else soil_type_text
        
        # Process voice inputs
        data = {}
        
        # Debug: Show what was captured
        if farm_size_text or crop_preference_text or soil_type_text:
            st.info(f"🎤 Voice inputs captured: Farm Size='{farm_size_text}', Crop='{crop_preference_text}', Soil='{soil_type_text}'")
        
        if farm_size_text:
            try:
                import re
                numbers = re.findall(r'\d+', farm_size_text)
                if numbers:
                    data['land_size'] = int(numbers[0])
                    st.success(f"✅ Parsed land size: {data['land_size']} hectares")
                else:
                    st.warning("Could not find numbers in farm size voice input")
            except Exception as e:
                st.warning(f"Could not parse farm size from voice input: {e}")
        
        if crop_preference_text:
            crop_lower = crop_preference_text.lower()
            if any(word in crop_lower for word in ['grain', 'grains', 'अनाज', 'ಧಾನ್ಯ', 'ధాన్యం', 'தானியம்', 'ധാന്യം']):
                data['crop_preference'] = 'Grains'
                st.success(f"✅ Parsed crop preference: {data['crop_preference']}")
            elif any(word in crop_lower for word in ['vegetable', 'vegetables', 'सब्जी', 'ತರಕಾರಿ', 'కూరగాయలు', 'காய்கறி', 'പച്ചക്കറി']):
                data['crop_preference'] = 'Vegetables'
                st.success(f"✅ Parsed crop preference: {data['crop_preference']}")
            elif any(word in crop_lower for word in ['fruit', 'fruits', 'फल', 'ಹಣ್ಣು', 'పండు', 'பழம்', 'പഴം']):
                data['crop_preference'] = 'Fruits'
                st.success(f"✅ Parsed crop preference: {data['crop_preference']}")
            else:
                st.warning(f"Could not recognize crop preference from: '{crop_preference_text}'")
        
        if soil_type_text:
            soil_lower = soil_type_text.lower()
            if any(word in soil_lower for word in ['loamy', 'loam', 'दोमट', 'ಲೋಮಿ', 'లోమి', 'லோமி', 'ലോമി']):
                data['soil_type'] = 'Loamy'
                st.success(f"✅ Parsed soil type: {data['soil_type']}")
            elif any(word in soil_lower for word in ['sandy', 'sand', 'बालू', 'ಮರಳು', 'ఇసుక', 'மணல்', 'മണൽ']):
                data['soil_type'] = 'Sandy'
                st.success(f"✅ Parsed soil type: {data['soil_type']}")
            elif any(word in soil_lower for word in ['clay', 'चिकनी', 'ಕ್ಲೇ', 'క్లే', 'களிமண்', 'കളിമണ്ണ്']):
                data['soil_type'] = 'Clay'
                st.success(f"✅ Parsed soil type: {data['soil_type']}")
            else:
                st.warning(f"Could not recognize soil type from: '{soil_type_text}'")
        
        return data
    
    def create_voice_help_system(self, language: str = 'English'):
        """
        Create a voice help system for farmers
        """
        st.markdown("### 🎤 Voice Help System")
        
        help_texts = {
            'English': {
                'welcome': "Welcome to the Sustainable Farming AI Platform. You can use voice commands to interact with the system.",
                'farm_details': "To enter farm details, speak your farm size, crop preference, and soil type.",
                'sustainability': "To log sustainability data, speak your water usage, fertilizer usage, and whether you practice crop rotation.",
                'recommendations': "Click the generate recommendation button to get AI-powered farming advice based on your inputs."
            },
            'Hindi': {
                'welcome': "सस्टेनेबल फार्मिंग AI प्लेटफॉर्म में आपका स्वागत है। आप सिस्टम के साथ बातचीत करने के लिए आवाज कमांड का उपयोग कर सकते हैं।",
                'farm_details': "फार्म विवरण दर्ज करने के लिए, अपने फार्म का आकार, फसल पसंद और मिट्टी का प्रकार बोलें।",
                'sustainability': "सस्टेनेबलिटी डेटा लॉग करने के लिए, अपने पानी के उपयोग, उर्वरक के उपयोग और क्या आप फसल चक्रण का अभ्यास करते हैं, बोलें।",
                'recommendations': "अपने इनपुट के आधार पर AI-संचालित खेती सलाह प्राप्त करने के लिए सिफारिश बटन पर क्लिक करें।"
            },
            'Telugu': {
                'welcome': "సస్టైనబుల్ ఫార్మింగ్ AI ప్లాట్‌ఫారమ్‌కు స్వాగతం. మీరు సిస్టమ్‌తో ఇంటరాక్ట్ చేయడానికి వాయిస్ కమాండ్‌లను ఉపయోగించవచ్చు.",
                'farm_details': "ఫార్మ్ వివరాలను నమోదు చేయడానికి, మీ ఫార్మ్ పరిమాణం, పంట ప్రాధాన్యత మరియు నేల రకాన్ని మాట్లాడండి.",
                'sustainability': "సస్టైనబిలిటీ డేటాను లాగ్ చేయడానికి, మీ నీటి వినియోగం, ఎరువు వినియోగం మరియు మీరు పంట మార్పిడిని అభ్యసిస్తున్నారా అని మాట్లాడండి.",
                'recommendations': "మీ ఇన్‌పుట్‌ల ఆధారంగా AI-ఆధారిత వ్యవసాయ సలహా పొందడానికి సిఫారసు బటన్‌పై క్లిక్ చేయండి."
            }
        }
        
        help_data = help_texts.get(language, help_texts['English'])
        
        col1, col2 = st.columns(2)
        
        with col1:
            if st.button("🔊 Listen to Welcome", key="help_welcome"):
                self.text_to_speech(help_data['welcome'], language)
        
        with col2:
            if st.button("🔊 Listen to Farm Details Help", key="help_farm"):
                self.text_to_speech(help_data['farm_details'], language)
        
        col3, col4 = st.columns(2)
        
        with col3:
            if st.button("🔊 Listen to Sustainability Help", key="help_sustainability"):
                self.text_to_speech(help_data['sustainability'], language)
        
        with col4:
            if st.button("🔊 Listen to Recommendations Help", key="help_recommendations"):
                self.text_to_speech(help_data['recommendations'], language)
    
    def get_supported_languages(self) -> List[str]:
        """
        Get list of supported languages
        """
        return list(self.language_codes.keys())
    
    def is_voice_available(self) -> bool:
        """
        Check if microphone input is available (PyAudio + microphone).
        """
        return (self.pyaudio_available and self.microphone is not None) or (WEBRTC_AVAILABLE and self.browser_mic_available)

