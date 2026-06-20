"""
AgriSmart Knowledge Base — TF-IDF RAG Engine
=============================================
Retrieval-Augmented Generation using local agricultural datasets.
No external vector DB needed — pure sklearn TF-IDF + cosine similarity.

Architecture:
  1. Loads 246K Indian crop production records + 50K synthetic data
  2. Builds a TF-IDF index over crop-region-season document corpus
  3. At query time, retrieves the most relevant historical records
  4. Returns structured context for the custom recommendation engine

This is a LOCAL knowledge base — no API calls, instant retrieval.
"""

import os
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

DATASETS_DIR = Path(__file__).parent.parent / "datasets"


class AgriKnowledgeBase:
    """Local RAG engine for agricultural data retrieval."""

    def __init__(self):
        self.crop_production_df = None  # 246K records
        self.agricultural_df = None     # 50K records
        self.vectorizer = None
        self.tfidf_matrix = None
        self.doc_records = []           # parallel array of record dicts
        self.crop_stats = {}            # precomputed crop statistics
        self.region_crop_stats = {}     # region-wise crop stats
        self._loaded = False
        self._load_datasets()

    def _load_datasets(self):
        """Load and index all agricultural datasets."""
        try:
            # Load Indian crop production (246K records)
            crop_file = DATASETS_DIR / "crop_production.csv"
            if crop_file.exists():
                self.crop_production_df = pd.read_csv(crop_file)
                self.crop_production_df.columns = [
                    c.strip() for c in self.crop_production_df.columns
                ]
                print(f"📚 Knowledge Base: Loaded {len(self.crop_production_df):,} crop production records")

            # Load synthetic agricultural dataset (50K records)
            agri_file = DATASETS_DIR / "large_agricultural_dataset.csv"
            if agri_file.exists():
                self.agricultural_df = pd.read_csv(agri_file)
                print(f"📚 Knowledge Base: Loaded {len(self.agricultural_df):,} agricultural records")

            # Build indices
            self._build_crop_statistics()
            if HAS_SKLEARN:
                self._build_tfidf_index()

            self._loaded = True
            total = 0
            if self.crop_production_df is not None:
                total += len(self.crop_production_df)
            if self.agricultural_df is not None:
                total += len(self.agricultural_df)
            print(f"📚 Knowledge Base ready: {total:,} total records indexed")

        except Exception as e:
            print(f"⚠️ Knowledge Base load error: {e}")
            self._loaded = False

    def _build_crop_statistics(self):
        """Precompute aggregate statistics per crop for fast lookup."""
        if self.agricultural_df is not None:
            df = self.agricultural_df
            for crop in df["crop"].unique():
                crop_data = df[df["crop"] == crop]
                self.crop_stats[crop.lower()] = {
                    "avg_yield": float(crop_data["yield_tons_per_ha"].mean()),
                    "avg_price": float(crop_data["price_per_ton"].mean()),
                    "avg_temp": float(crop_data["temperature_avg"].mean()),
                    "avg_rainfall": float(crop_data["rainfall_mm"].mean()),
                    "avg_fertilizer": float(crop_data["fertilizer_kg_ha"].mean()),
                    "avg_nitrogen": float(crop_data["nitrogen"].mean()),
                    "avg_phosphorus": float(crop_data["phosphorus"].mean()),
                    "avg_potassium": float(crop_data["potassium"].mean()),
                    "avg_ph": float(crop_data["ph"].mean()),
                    "std_yield": float(crop_data["yield_tons_per_ha"].std()),
                    "std_price": float(crop_data["price_per_ton"].std()),
                    "min_temp": float(crop_data["temperature_avg"].min()),
                    "max_temp": float(crop_data["temperature_avg"].max()),
                    "min_rain": float(crop_data["rainfall_mm"].min()),
                    "max_rain": float(crop_data["rainfall_mm"].max()),
                    "min_ph": float(crop_data["ph"].min()),
                    "max_ph": float(crop_data["ph"].max()),
                    "record_count": len(crop_data),
                    "regions": crop_data["region"].unique().tolist(),
                    "soil_types": crop_data["soil_type"].unique().tolist(),
                }

        # Production stats from Indian dataset
        if self.crop_production_df is not None:
            df = self.crop_production_df
            for crop in df["Crop"].dropna().unique():
                crop_data = df[df["Crop"] == crop]
                key = crop.lower().strip()
                if key not in self.crop_stats:
                    self.crop_stats[key] = {}
                self.crop_stats[key]["total_indian_production"] = float(
                    crop_data["Production"].sum()
                ) if "Production" in crop_data.columns else 0
                self.crop_stats[key]["indian_states"] = (
                    crop_data["State_Name"].unique().tolist()
                    if "State_Name" in crop_data.columns else []
                )
                self.crop_stats[key]["indian_seasons"] = (
                    crop_data["Season"].dropna().unique().tolist()
                    if "Season" in crop_data.columns else []
                )

    def _build_tfidf_index(self):
        """Build TF-IDF index for semantic retrieval over agricultural docs."""
        documents = []
        self.doc_records = []

        # Index agricultural dataset rows as documents
        if self.agricultural_df is not None:
            # Sample for speed — keep 10K most representative
            df = self.agricultural_df
            if len(df) > 10000:
                df = df.sample(10000, random_state=42)
            for _, row in df.iterrows():
                doc = (
                    f"crop {row.get('crop', '')} region {row.get('region', '')} "
                    f"soil {row.get('soil_type', '')} temperature {row.get('temperature_avg', '')} "
                    f"rainfall {row.get('rainfall_mm', '')} yield {row.get('yield_tons_per_ha', '')} "
                    f"price {row.get('price_per_ton', '')} nitrogen {row.get('nitrogen', '')} "
                    f"phosphorus {row.get('phosphorus', '')} potassium {row.get('potassium', '')} "
                    f"ph {row.get('ph', '')}"
                )
                documents.append(doc)
                self.doc_records.append(row.to_dict())

        if documents:
            self.vectorizer = TfidfVectorizer(
                max_features=5000, stop_words="english",
                ngram_range=(1, 2), sublinear_tf=True,
            )
            self.tfidf_matrix = self.vectorizer.fit_transform(documents)

    # ── Public Query API ─────────────────────────────────────────────

    def query_similar_conditions(
        self, temperature: float, rainfall: float, ph: float,
        nitrogen: float = 80, top_k: int = 20
    ) -> List[Dict]:
        """Find records with most similar growing conditions via TF-IDF."""
        if not HAS_SKLEARN or self.vectorizer is None:
            return self._fallback_query(temperature, rainfall, ph, nitrogen, top_k)

        query = (
            f"temperature {temperature} rainfall {rainfall} "
            f"ph {ph} nitrogen {nitrogen}"
        )
        query_vec = self.vectorizer.transform([query])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
        top_indices = similarities.argsort()[-top_k:][::-1]

        results = []
        for idx in top_indices:
            rec = self.doc_records[idx].copy()
            rec["similarity_score"] = float(similarities[idx])
            results.append(rec)
        return results

    def _fallback_query(self, temperature, rainfall, ph, nitrogen, top_k):
        """Euclidean distance fallback when sklearn TF-IDF is unavailable."""
        if self.agricultural_df is None:
            return []
        df = self.agricultural_df.copy()
        df["_dist"] = np.sqrt(
            ((df["temperature_avg"] - temperature) / 10) ** 2
            + ((df["rainfall_mm"] - rainfall) / 100) ** 2
            + ((df["ph"] - ph) / 2) ** 2
            + ((df["nitrogen"] - nitrogen) / 50) ** 2
        )
        top = df.nsmallest(top_k, "_dist")
        return top.drop(columns=["_dist"]).to_dict("records")

    def get_crop_statistics(self, crop_name: str) -> Optional[Dict]:
        """Get precomputed statistics for a specific crop."""
        return self.crop_stats.get(crop_name.lower().strip())

    def get_all_crop_names(self) -> List[str]:
        """Return all known crop names."""
        return list(self.crop_stats.keys())

    def get_best_crops_for_conditions(
        self, temperature: float, rainfall: float, ph: float,
        nitrogen: float = 80, top_k: int = 5
    ) -> List[Dict]:
        """Aggregate similar conditions to find which crops perform best."""
        similar = self.query_similar_conditions(
            temperature, rainfall, ph, nitrogen, top_k=50
        )
        if not similar:
            return []

        # Aggregate by crop
        crop_agg = defaultdict(lambda: {"yields": [], "prices": [], "count": 0, "sim_scores": []})
        for rec in similar:
            crop = rec.get("crop", "unknown")
            crop_agg[crop]["yields"].append(rec.get("yield_tons_per_ha", 0))
            crop_agg[crop]["prices"].append(rec.get("price_per_ton", 0))
            crop_agg[crop]["count"] += 1
            crop_agg[crop]["sim_scores"].append(rec.get("similarity_score", 0))

        results = []
        for crop, data in crop_agg.items():
            results.append({
                "crop": crop,
                "avg_yield": np.mean(data["yields"]),
                "avg_price": np.mean(data["prices"]),
                "frequency": data["count"],
                "avg_similarity": np.mean(data["sim_scores"]),
                "confidence": min(100, data["count"] * 10),
            })

        # Sort by frequency * similarity (crops appearing more often in similar conditions)
        results.sort(key=lambda x: x["frequency"] * x["avg_similarity"], reverse=True)
        return results[:top_k]

    def get_historical_yield_trend(self, crop_name: str, region: str = None) -> Dict:
        """Get year-over-year yield trends for a crop."""
        if self.agricultural_df is None:
            return {"trend": "unknown", "data": []}

        df = self.agricultural_df
        mask = df["crop"].str.lower() == crop_name.lower()
        if region:
            mask &= df["region"].str.lower() == region.lower()
        crop_data = df[mask]

        if len(crop_data) < 5:
            return {"trend": "insufficient_data", "data": []}

        yearly = crop_data.groupby("year").agg({
            "yield_tons_per_ha": "mean",
            "price_per_ton": "mean",
        }).reset_index()

        if len(yearly) >= 2:
            yield_change = (
                yearly["yield_tons_per_ha"].iloc[-1]
                - yearly["yield_tons_per_ha"].iloc[0]
            )
            if yield_change > 0.5:
                trend = "increasing"
            elif yield_change < -0.5:
                trend = "decreasing"
            else:
                trend = "stable"
        else:
            trend = "stable"

        return {
            "trend": trend,
            "years": yearly["year"].tolist(),
            "yields": yearly["yield_tons_per_ha"].round(2).tolist(),
            "prices": yearly["price_per_ton"].round(2).tolist(),
        }

    def get_region_performance(self, crop_name: str) -> List[Dict]:
        """Which regions perform best for a given crop."""
        if self.agricultural_df is None:
            return []

        df = self.agricultural_df
        crop_data = df[df["crop"].str.lower() == crop_name.lower()]
        if len(crop_data) == 0:
            return []

        by_region = crop_data.groupby("region").agg({
            "yield_tons_per_ha": "mean",
            "price_per_ton": "mean",
            "temperature_avg": "mean",
            "rainfall_mm": "mean",
        }).reset_index()

        results = []
        for _, row in by_region.iterrows():
            results.append({
                "region": row["region"],
                "avg_yield": round(float(row["yield_tons_per_ha"]), 2),
                "avg_price": round(float(row["price_per_ton"]), 2),
                "avg_temp": round(float(row["temperature_avg"]), 1),
                "avg_rain": round(float(row["rainfall_mm"]), 1),
            })
        results.sort(key=lambda x: x["avg_yield"], reverse=True)
        return results

    @property
    def is_loaded(self) -> bool:
        return self._loaded
