#!/usr/bin/env python3
"""
Download LARGE real agricultural datasets (10K+ records)
"""
import os
import requests
import pandas as pd
from pathlib import Path
import zipfile
import time

DATASETS_DIR = Path(__file__).parent

def download_file(url, filename):
    """Download large file with progress"""
    print(f"📥 Downloading: {filename}")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        
        with open(DATASETS_DIR / filename, 'wb') as f:
            downloaded = 0
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0:
                    percent = (downloaded / total_size) * 100
                    print(f"\r  Progress: {percent:.1f}%", end='', flush=True)
        
        print(f"\n  ✅ Downloaded: {filename}")
        return True
    except Exception as e:
        print(f"\n  ❌ Failed: {e}")
        return False

def download_fao_data():
    """Download FAO crop production data (100K+ records)"""
    print("\n1️⃣ FAO Global Crop Production Data")
    
    # FAO Bulk download link (Production data)
    fao_url = "http://fenixservices.fao.org/faostat/static/bulkdownloads/Production_Crops_E_All_Data_(Normalized).zip"
    
    if download_file(fao_url, "fao_crop_production.zip"):
        try:
            with zipfile.ZipFile(DATASETS_DIR / "fao_crop_production.zip", 'r') as zip_ref:
                zip_ref.extractall(DATASETS_DIR)
                print("  ✅ Extracted FAO data")
        except Exception as e:
            print(f"  ⚠️ Extract failed: {e}")

def download_world_bank_prices():
    """Download World Bank commodity prices (20K+ records)"""
    print("\n2️⃣ World Bank Commodity Prices")
    
    # World Bank commodity prices
    wb_url = "https://thedocs.worldbank.org/en/doc/5d903e848db1d1b83e0ec8f744e55570-0350012021/related/CMO-Historical-Data-Monthly.xlsx"
    
    if download_file(wb_url, "world_bank_prices.xlsx"):
        try:
            # Convert to CSV
            df = pd.read_excel(DATASETS_DIR / "world_bank_prices.xlsx", sheet_name=1)  # Historical data sheet
            df.to_csv(DATASETS_DIR / "world_bank_prices.csv", index=False)
            print(f"  ✅ Converted to CSV: {len(df)} records")
        except Exception as e:
            print(f"  ⚠️ Convert failed: {e}")

def download_indian_agriculture():
    """Download Indian agricultural data"""
    print("\n3️⃣ Indian Agricultural Statistics")
    
    # Sample Indian data (you'll need to manually download from government site)
    print("  ⚠️ Manual download required from:")
    print("  🔗 https://aps.dac.gov.in/APY/Public_Report1.aspx")
    print("  📝 Select: All States, All Crops, 2015-2023")
    print("  💾 Save as: indian_agriculture.csv")

def download_kaggle_datasets():
    """Download large Kaggle datasets"""
    print("\n4️⃣ Kaggle Large Datasets")
    
    # These require Kaggle API
    large_datasets = [
        "abhinand05/crop-production-in-india",  # 246K records
        "srinivas1/agriculuture-crops-production-in-india",  # 200K records
        "varshitanalluri/crop-yield-prediction-dataset",  # 50K records
    ]
    
    try:
        import kaggle
        print("  📡 Kaggle API found, downloading...")
        
        for dataset in large_datasets:
            try:
                print(f"    Downloading: {dataset}")
                kaggle.api.dataset_download_files(dataset, path=DATASETS_DIR, unzip=True)
                print(f"    ✅ Downloaded: {dataset}")
            except Exception as e:
                print(f"    ❌ Failed: {e}")
    except ImportError:
        print("  ⚠️ Kaggle API not found")
        print("  📝 Install: pip install kaggle")
        print("  🔑 Setup: kaggle.com/account → Create API Token")

def download_usda_data():
    """Download USDA NASS data via API"""
    print("\n5️⃣ USDA NASS Data")
    
    # USDA API (requires API key)
    print("  ⚠️ USDA API key required")
    print("  🔗 Get key: https://quickstats.nass.usda.gov/api")
    print("  💡 Then use their bulk download CSV files")
    
    # Direct CSV downloads available
    usda_csvs = [
        "https://www.nass.usda.gov/datasets/qs.crops_20240101.txt.gz",  # Large crop data
    ]
    
    for url in usda_csvs:
        filename = url.split('/')[-1]
        download_file(url, filename)

def create_large_synthetic_data():
    """Create large synthetic dataset as fallback"""
    print("\n6️⃣ Creating Large Synthetic Dataset (Fallback)")
    
    import numpy as np
    import random
    
    # Generate 50K records
    n_records = 50000
    
    print(f"  🔄 Generating {n_records:,} synthetic records...")
    
    crops = ['wheat', 'rice', 'corn', 'soybean', 'barley', 'oats', 'cotton', 'sugarcane', 'tomato', 'potato']
    regions = ['North', 'South', 'East', 'West', 'Central', 'Northeast', 'Northwest', 'Southeast', 'Southwest']
    soil_types = ['loamy', 'clay', 'sandy', 'silt', 'peat']
    
    data = {
        'year': [random.randint(2000, 2023) for _ in range(n_records)],
        'crop': [random.choice(crops) for _ in range(n_records)],
        'region': [random.choice(regions) for _ in range(n_records)],
        'soil_type': [random.choice(soil_types) for _ in range(n_records)],
        'area_hectares': [random.uniform(100, 10000) for _ in range(n_records)],
        'production_tons': [random.uniform(1000, 50000) for _ in range(n_records)],
        'yield_tons_per_ha': [random.uniform(2.0, 12.0) for _ in range(n_records)],
        'temperature_avg': [random.uniform(15.0, 35.0) for _ in range(n_records)],
        'rainfall_mm': [random.uniform(300, 2000) for _ in range(n_records)],
        'fertilizer_kg_ha': [random.uniform(50, 300) for _ in range(n_records)],
        'price_per_ton': [random.uniform(200, 5000) for _ in range(n_records)],
        'nitrogen': [random.uniform(10, 150) for _ in range(n_records)],
        'phosphorus': [random.uniform(5, 80) for _ in range(n_records)],
        'potassium': [random.uniform(10, 100) for _ in range(n_records)],
        'ph': [random.uniform(5.5, 8.5) for _ in range(n_records)],
        'organic_matter': [random.uniform(1.0, 5.0) for _ in range(n_records)]
    }
    
    # Create correlated yield based on inputs
    for i in range(n_records):
        base_yield = 3.0
        if data['soil_type'][i] == 'loamy':
            base_yield += 1.5
        elif data['soil_type'][i] == 'clay':
            base_yield += 1.0
        
        if 20 < data['temperature_avg'][i] < 30:
            base_yield += 1.0
        
        if 500 < data['rainfall_mm'][i] < 1200:
            base_yield += 1.2
        
        if 6.0 < data['ph'][i] < 7.5:
            base_yield += 0.8
        
        # Add some noise
        base_yield += random.uniform(-1.0, 1.0)
        data['yield_tons_per_ha'][i] = max(0.5, base_yield)
        
        # Production = area * yield
        data['production_tons'][i] = data['area_hectares'][i] * data['yield_tons_per_ha'][i]
    
    df = pd.DataFrame(data)
    df.to_csv(DATASETS_DIR / 'large_agricultural_dataset.csv', index=False)
    print(f"  ✅ Created: large_agricultural_dataset.csv ({n_records:,} records)")

if __name__ == '__main__':
    print("=" * 70)
    print("🌾 LARGE AGRICULTURAL DATASETS DOWNLOADER")
    print("=" * 70)
    print(f"📁 Target: {DATASETS_DIR}")
    print("⚠️  Large downloads may take time...")
    
    # Download real datasets
    download_fao_data()
    download_world_bank_prices()
    download_indian_agriculture()
    download_kaggle_datasets()
    download_usda_data()
    
    # Create large synthetic as backup
    create_large_synthetic_data()
    
    # List all files
    print("\n📊 Downloaded datasets:")
    csv_files = list(DATASETS_DIR.glob('*.csv'))
    total_size = 0
    
    for f in sorted(csv_files):
        try:
            df = pd.read_csv(f)
            size_mb = f.stat().st_size / (1024*1024)
            total_size += size_mb
            print(f"  ✓ {f.name:<30} {len(df):>8,} records ({size_mb:.1f} MB)")
        except:
            print(f"  ? {f.name}")
    
    print(f"\n📈 Total: {len(csv_files)} files, {total_size:.1f} MB")
    print("✅ Large dataset download complete!")