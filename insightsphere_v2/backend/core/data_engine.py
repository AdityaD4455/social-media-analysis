"""
core/data_engine.py — Data generation, ingestion, and processing
"""
import pandas as pd
import numpy as np
import datetime
from typing import Optional, List, Dict, Any
import io


PLATFORMS = ["Instagram", "LinkedIn", "Twitter", "Facebook", "YouTube"]
CONTENT_TYPES = ["Reel/Video", "Carousel", "Photo", "Story", "Live Stream", "Text Post"]

PLATFORM_CONFIG = {
    "Instagram": {
        "base_reach": 4200, "reach_var": 2000,
        "base_eng": 4.2,  "eng_var": 2.0,
        "weekend_boost": 1.3, "growth": 0.35,
        "impressions_mult": (1.6, 2.4),
    },
    "YouTube": {
        "base_reach": 7200, "reach_var": 4500,
        "base_eng": 5.5,  "eng_var": 2.8,
        "weekend_boost": 1.4, "growth": 0.45,
        "impressions_mult": (1.5, 2.2),
    },
    "LinkedIn": {
        "base_reach": 1800, "reach_var": 900,
        "base_eng": 2.1,  "eng_var": 0.8,
        "weekend_boost": 0.6, "growth": 0.20,
        "impressions_mult": (1.5, 2.5),
    },
    "Twitter": {
        "base_reach": 5200, "reach_var": 3500,
        "base_eng": 1.9,  "eng_var": 0.9,
        "weekend_boost": 1.1, "growth": 0.15,
        "impressions_mult": (1.8, 3.0),
    },
    "Facebook": {
        "base_reach": 3800, "reach_var": 2200,
        "base_eng": 2.5,  "eng_var": 1.2,
        "weekend_boost": 1.5, "growth": 0.10,
        "impressions_mult": (1.5, 2.2),
    },
}

CONTENT_ENG_MULT = {
    "Reel/Video": 1.6,
    "Carousel": 1.3,
    "Photo": 1.0,
    "Story": 0.8,
    "Live Stream": 1.8,
    "Text Post": 0.7,
}


def generate_dataset(days: int = 90, rows_per_platform_per_day: int = 3) -> pd.DataFrame:
    """Generate realistic multi-platform social media dataset."""
    rng = np.random.default_rng(42)
    records = []
    now = datetime.datetime.utcnow()

    for platform in PLATFORMS:
        cfg = PLATFORM_CONFIG[platform]
        total_rows = days * rows_per_platform_per_day

        for i in range(total_rows):
            # Spread posts across days with some randomness
            day_offset = int(i / rows_per_platform_per_day)
            hour = int(rng.integers(6, 23))
            minute = int(rng.integers(0, 59))
            ts = now - datetime.timedelta(days=(days - day_offset), hours=hour, minutes=minute)

            trend = 1.0 + (i / total_rows * cfg["growth"])
            dow = ts.weekday()
            season = cfg["weekend_boost"] if dow >= 5 else 1.0
            hour_effect = 1.3 if 18 <= hour <= 22 else (1.2 if 9 <= hour <= 12 else 0.9)
            noise = rng.normal(1.0, 0.12)

            reach = max(
                100,
                int(cfg["base_reach"] * trend * season * hour_effect * noise
                    + int(rng.integers(-cfg["reach_var"], cfg["reach_var"])))
            )

            ct = rng.choice(
                CONTENT_TYPES,
                p=[0.28, 0.20, 0.22, 0.14, 0.08, 0.08]
            )
            eng_mult = CONTENT_ENG_MULT.get(ct, 1.0)
            eng_base = cfg["base_eng"] * eng_mult * (1 - reach / (cfg["base_reach"] * 5) * 0.15)
            engagement = float(np.clip(
                eng_base * season * rng.normal(1.0, 0.2),
                0.3, 20.0
            ))

            low_m, high_m = cfg["impressions_mult"]
            impressions = int(reach * rng.uniform(low_m, high_m))

            likes    = int(reach * engagement / 100 * rng.uniform(0.6, 0.9))
            comments = int(likes * rng.uniform(0.05, 0.15))
            shares   = int(likes * rng.uniform(0.02, 0.10))
            saves    = int(likes * rng.uniform(0.10, 0.25))
            clicks   = int(impressions * rng.uniform(0.01, 0.05))

            records.append({
                "timestamp": ts,
                "date": ts.date(),
                "platform": platform,
                "content_type": ct,
                "reach": reach,
                "impressions": impressions,
                "engagement": round(engagement, 3),
                "likes": likes,
                "comments": comments,
                "shares": shares,
                "saves": saves,
                "clicks": clicks,
                "hour": hour,
                "day_of_week": ts.strftime("%A"),
                "week": ts.isocalendar()[1],
                "month": ts.month,
            })

    df = pd.DataFrame(records).sort_values("timestamp").reset_index(drop=True)

    # Derived fields
    max_reach = df["reach"].max() or 1
    max_eng   = df["engagement"].max() or 1
    df["performance_score"] = (
        df["reach"] / max_reach * 50 + df["engagement"] / max_eng * 50
    ).round(2)
    df["viral"] = df["engagement"] > 6.0

    return df


def parse_uploaded_csv(content: bytes) -> pd.DataFrame:
    """Parse a user-uploaded CSV and normalise column names."""
    try:
        df = pd.read_csv(io.BytesIO(content))
    except UnicodeDecodeError:
        df = pd.read_csv(io.BytesIO(content), encoding="latin-1")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    column_map = {
        "date": ["date", "timestamp", "created_at", "post_date", "datetime"],
        "platform": ["platform", "source", "network", "channel", "social_network"],
        "content_type": ["content_type", "type", "post_type", "media_type", "format"],
        "reach": ["reach", "views", "impressions_unique", "audience_reached"],
        "impressions": ["impressions", "total_impressions", "view_count"],
        "engagement": ["engagement", "engagement_rate", "eng_rate", "eng"],
        "likes": ["likes", "reactions", "hearts", "favorites"],
        "comments": ["comments", "replies"],
        "shares": ["shares", "retweets", "reposts"],
    }

    rename = {}
    for target, aliases in column_map.items():
        for alias in aliases:
            if alias in df.columns and target not in df.columns:
                rename[alias] = target
                break
    df = df.rename(columns=rename)

    # Fill missing required columns
    if "date" not in df.columns:
        df["date"] = pd.date_range(end=datetime.date.today(), periods=len(df), freq="D")
    else:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df["date"] = df["date"].fillna(pd.Timestamp.today())

    if "platform" not in df.columns:
        df["platform"] = "Unknown"
    if "reach" not in df.columns:
        df["reach"] = np.random.randint(100, 5000, len(df))
    else:
        df["reach"] = pd.to_numeric(df["reach"], errors="coerce").fillna(100).clip(lower=0)
    if "engagement" not in df.columns:
        df["engagement"] = np.random.uniform(1.0, 5.0, len(df))
    else:
        df["engagement"] = pd.to_numeric(df["engagement"], errors="coerce").fillna(2.5)
        if df["engagement"].max() > 100:
            df["engagement"] = (df["engagement"] / df["reach"] * 100).clip(0, 100)
    if "content_type" not in df.columns:
        df["content_type"] = "Photo"
    if "impressions" not in df.columns:
        df["impressions"] = (df["reach"] * np.random.uniform(1.5, 2.5, len(df))).astype(int)

    df["timestamp"] = pd.to_datetime(df["date"])
    df["performance_score"] = (
        df["reach"] / df["reach"].max() * 50 + df["engagement"] / df["engagement"].max() * 50
    ).round(2)

    return df


def compute_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """Compute high-level KPI summary."""
    if df.empty:
        return {}

    total_reach = int(df["reach"].sum())
    avg_eng = float(df["engagement"].mean())
    best_platform = df.groupby("platform")["engagement"].mean().idxmax()
    total_impressions = int(df.get("impressions", pd.Series([0])).sum())
    viral_count = int(df.get("viral", pd.Series([False])).sum())

    # Growth: compare last-30% vs first-30%
    n = len(df)
    early = df.head(int(n * 0.3))
    late  = df.tail(int(n * 0.3))
    growth = 0.0
    if not early.empty and early["reach"].mean() > 0:
        growth = (late["reach"].mean() - early["reach"].mean()) / early["reach"].mean() * 100

    return {
        "total_reach": total_reach,
        "avg_engagement": round(avg_eng, 3),
        "best_platform": best_platform,
        "total_impressions": total_impressions,
        "viral_posts": viral_count,
        "avg_performance_score": round(df["performance_score"].mean(), 2),
        "growth_rate": round(growth, 2),
        "total_records": n,
        "date_range": {
            "from": str(df["timestamp"].min().date()),
            "to":   str(df["timestamp"].max().date()),
        },
    }


def compute_platform_stats(df: pd.DataFrame) -> List[Dict]:
    """Per-platform aggregated stats."""
    results = []
    for platform in df["platform"].unique():
        p = df[df["platform"] == platform]
        results.append({
            "platform": platform,
            "avg_reach": round(p["reach"].mean()),
            "total_reach": int(p["reach"].sum()),
            "avg_engagement": round(p["engagement"].mean(), 3),
            "avg_impressions": round(p.get("impressions", pd.Series([0])).mean()),
            "post_count": len(p),
            "avg_score": round(p["performance_score"].mean(), 2),
            "viral_count": int(p.get("viral", pd.Series([False])).sum()),
        })
    return sorted(results, key=lambda x: x["avg_engagement"], reverse=True)


def compute_heatmap(df: pd.DataFrame) -> Dict:
    """Day-of-week × hour engagement heatmap."""
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    matrix = {day: {h: {"total": 0, "count": 0} for h in range(24)} for day in days}

    for _, row in df.iterrows():
        dow = row.get("day_of_week") or datetime.datetime.fromisoformat(str(row["timestamp"])).strftime("%A")
        hr  = int(row.get("hour", 0))
        if dow in matrix:
            matrix[dow][hr]["total"] += row["engagement"]
            matrix[dow][hr]["count"] += 1

    result = {}
    for day in days:
        result[day] = {}
        for h in range(24):
            cell = matrix[day][h]
            result[day][h] = round(cell["total"] / cell["count"], 3) if cell["count"] else 0
    return result


def compute_content_performance(df: pd.DataFrame) -> List[Dict]:
    """Engagement + reach per content type."""
    results = []
    for ct in CONTENT_TYPES:
        rows = df[df["content_type"] == ct]
        if rows.empty:
            continue
        results.append({
            "content_type": ct,
            "avg_reach": round(rows["reach"].mean()),
            "avg_engagement": round(rows["engagement"].mean(), 3),
            "post_count": len(rows),
            "viral_count": int(rows.get("viral", pd.Series([False])).sum()),
        })
    return sorted(results, key=lambda x: x["avg_engagement"], reverse=True)


def compute_time_series(df: pd.DataFrame, platform: Optional[str] = None) -> List[Dict]:
    """Daily aggregated time series (optionally filtered by platform)."""
    if platform and platform != "all":
        df = df[df["platform"] == platform]
    if df.empty:
        return []

    df["date_str"] = df["timestamp"].dt.date.astype(str)
    grouped = df.groupby("date_str").agg(
        total_reach=("reach", "sum"),
        avg_engagement=("engagement", "mean"),
        total_impressions=("impressions", "sum") if "impressions" in df.columns else ("reach", "sum"),
        post_count=("reach", "count"),
    ).reset_index()
    grouped["avg_engagement"] = grouped["avg_engagement"].round(3)
    return grouped.rename(columns={"date_str": "date"}).to_dict(orient="records")
