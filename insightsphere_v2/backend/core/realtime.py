"""
core/realtime.py — Live data simulation + real social API hooks
"""
import asyncio
import datetime
import random
import numpy as np
from typing import Dict, Any, Optional, AsyncGenerator
from core.config import settings
from core.data_engine import PLATFORMS, PLATFORM_CONFIG, CONTENT_TYPES


def _live_data_point(platform: Optional[str] = None) -> Dict[str, Any]:
    """Generate one realistic live data point."""
    plat = platform or random.choice(PLATFORMS)
    cfg  = PLATFORM_CONFIG[plat]
    now  = datetime.datetime.utcnow()

    hour     = now.hour
    is_peak  = 9 <= hour <= 11 or 18 <= hour <= 22
    factor   = 1.3 if is_peak else 0.85
    noise    = random.gauss(1.0, 0.10)

    reach = max(50, int(cfg["base_reach"] * factor * noise
                       + random.randint(-cfg["reach_var"] // 3, cfg["reach_var"] // 3)))

    ct    = random.choices(
        CONTENT_TYPES,
        weights=[28, 20, 22, 14, 8, 8], k=1
    )[0]

    ct_mult = {"Reel/Video": 1.6, "Carousel": 1.3, "Photo": 1.0,
               "Story": 0.8, "Live Stream": 1.8, "Text Post": 0.7}.get(ct, 1.0)

    eng = round(max(0.3, random.gauss(cfg["base_eng"] * ct_mult, cfg["eng_var"] * 0.5)), 3)
    impressions = int(reach * random.uniform(1.4, 2.8))
    likes    = int(reach * eng / 100 * random.uniform(0.5, 0.9))
    comments = int(likes * random.uniform(0.04, 0.14))
    shares   = int(likes * random.uniform(0.02, 0.08))

    return {
        "timestamp": now.isoformat(),
        "platform": plat,
        "content_type": ct,
        "reach": reach,
        "impressions": impressions,
        "engagement": eng,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "performance_score": round(reach / 10000 * 50 + eng / 10 * 50, 2),
        "viral": eng > 6.0,
        "is_live": True,
    }


async def live_stream(
    interval_ms: int = 3000,
    platform: Optional[str] = None,
) -> AsyncGenerator[Dict[str, Any], None]:
    """Async generator that yields live data points at set interval."""
    while True:
        await asyncio.sleep(interval_ms / 1000)
        yield _live_data_point(platform)


async def fetch_instagram_live(limit: int = 50) -> list:
    """Fetch real Instagram insights (requires access token)."""
    if not settings.has_instagram:
        return [_live_data_point("Instagram") for _ in range(limit)]

    import httpx
    url = f"https://graph.instagram.com/{settings.instagram_business_id}/insights"
    params = {
        "metric": "reach,impressions,engagement",
        "period": "day",
        "access_token": settings.instagram_access_token,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json().get("data", [])
            # Normalise to our schema
            return [{"platform": "Instagram", **d} for d in data[:limit]]
    except Exception:
        return [_live_data_point("Instagram") for _ in range(limit)]


async def fetch_twitter_live(limit: int = 50) -> list:
    """Fetch recent Twitter/X tweet metrics."""
    if not settings.has_twitter:
        return [_live_data_point("Twitter") for _ in range(limit)]

    import httpx
    headers = {"Authorization": f"Bearer {settings.twitter_bearer_token}"}
    url = "https://api.twitter.com/2/tweets/search/recent"
    params = {
        "query": "from:me",
        "tweet.fields": "public_metrics,created_at",
        "max_results": min(limit, 100),
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            tweets = resp.json().get("data", [])
            result = []
            for t in tweets:
                m = t.get("public_metrics", {})
                result.append({
                    "platform": "Twitter",
                    "timestamp": t.get("created_at", datetime.datetime.utcnow().isoformat()),
                    "reach": m.get("impression_count", 0),
                    "engagement": round(
                        (m.get("like_count", 0) + m.get("reply_count", 0) + m.get("retweet_count", 0))
                        / max(m.get("impression_count", 1), 1) * 100, 3
                    ),
                    "likes": m.get("like_count", 0),
                    "comments": m.get("reply_count", 0),
                    "shares": m.get("retweet_count", 0),
                    "content_type": "Text Post",
                })
            return result
    except Exception:
        return [_live_data_point("Twitter") for _ in range(limit)]


async def fetch_linkedin_live(limit: int = 50) -> list:
    """Fetch LinkedIn organisation analytics."""
    if not settings.has_linkedin:
        return [_live_data_point("LinkedIn") for _ in range(limit)]

    import httpx
    headers = {
        "Authorization": f"Bearer {settings.linkedin_access_token}",
        "X-Restli-Protocol-Version": "2.0.0",
    }
    url = "https://api.linkedin.com/v2/organizationalEntityShareStatistics"
    params = {
        "q": "organizationalEntity",
        "organizationalEntity": f"urn:li:organization:{settings.linkedin_access_token}",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            stats = resp.json().get("elements", [])
            result = []
            for s in stats[:limit]:
                ts_stat = s.get("totalShareStatistics", {})
                result.append({
                    "platform": "LinkedIn",
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "reach": ts_stat.get("uniqueImpressionsCount", 0),
                    "impressions": ts_stat.get("impressionCount", 0),
                    "engagement": round(ts_stat.get("engagement", 0) * 100, 3),
                    "likes": ts_stat.get("likeCount", 0),
                    "comments": ts_stat.get("commentCount", 0),
                    "shares": ts_stat.get("shareCount", 0),
                    "content_type": "Text Post",
                })
            return result
    except Exception:
        return [_live_data_point("LinkedIn") for _ in range(limit)]
