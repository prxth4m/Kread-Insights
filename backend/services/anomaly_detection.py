"""
Anomaly detection service for Kread Insights
Detects unusual changes in restaurant metrics
"""

from datetime import date, timedelta
from typing import List, Dict, Any

from config import settings


async def run_anomaly_detection() -> int:
    """
    Run anomaly detection on all active restaurants
    Returns the number of anomalies detected
    """
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Get all active restaurants
    restaurants = supabase.table("restaurants").select("id, name").eq("is_archived", False).execute()
    restaurant_ids = [r["id"] for r in restaurants.data]

    # Define anomaly rules
    rules = [
        {"metric": "sales", "warning_threshold": settings.SALES_DROP_WARNING, "critical_threshold": settings.SALES_DROP_CRITICAL},
        {"metric": "delivered_orders", "warning_threshold": settings.ORDERS_DROP_WARNING, "critical_threshold": settings.ORDERS_DROP_CRITICAL},
        {"metric": "impressions", "warning_threshold": settings.IMPRESSIONS_DROP_WARNING, "critical_threshold": settings.IMPRESSIONS_DROP_CRITICAL},
        {"metric": "ads_roi", "warning_threshold": settings.ROI_DROP_WARNING, "critical_threshold": settings.ROI_DROP_CRITICAL},
        {"metric": "menu_to_order", "warning_threshold": settings.FUNNEL_DROP_WARNING, "critical_threshold": settings.FUNNEL_DROP_CRITICAL},
        {"metric": "cart_to_order", "warning_threshold": settings.FUNNEL_DROP_WARNING, "critical_threshold": settings.FUNNEL_DROP_CRITICAL},
    ]

    total_anomalies = 0

    # Get today's and yesterday's metrics
    today = date.today()
    yesterday = today - timedelta(days=1)

    for restaurant_id in restaurant_ids:
        # Fetch today's metrics
        today_metrics = supabase.table("daily_metrics").select("*").eq("restaurant_id", restaurant_id).eq("date", str(today)).single().execute()

        # Fetch yesterday's metrics
        yesterday_metrics = supabase.table("daily_metrics").select("*").eq("restaurant_id", restaurant_id).eq("date", str(yesterday)).single().execute()

        if not today_metrics.data or not yesterday_metrics.data:
            continue

        for rule in rules:
            metric = rule["metric"]
            current_value = float(today_metrics.data.get(metric, 0) or 0)
            previous_value = float(yesterday_metrics.data.get(metric, 0) or 0)

            if previous_value == 0:
                continue

            # Calculate percentage drop
            percentage_drop = ((previous_value - current_value) / previous_value) if current_value < previous_value else 0

            if percentage_drop <= 0:
                continue  # No drop

            # Determine severity
            severity = None
            if percentage_drop >= rule["critical_threshold"]:
                severity = "critical"
            elif percentage_drop >= rule["warning_threshold"]:
                severity = "warning"

            if severity:
                # Check if alert already exists
                existing = supabase.table("alerts").select("id").eq("restaurant_id", restaurant_id).eq("metric_name", metric).eq("acknowledged", False).execute()

                if not existing.data:
                    # Create alert
                    supabase.table("alerts").insert({
                        "restaurant_id": restaurant_id,
                        "metric_name": metric,
                        "severity": severity,
                        "current_value": current_value,
                        "previous_value": previous_value,
                        "percentage_drop": round(percentage_drop * 100, 2)
                    }).execute()
                    total_anomalies += 1

    return total_anomalies


async def detect_metric_anomaly(
    restaurant_id: str,
    metric: str,
    current_value: float,
    previous_value: float
) -> Dict[str, Any] | None:
    """
    Detect if a specific metric has an anomaly
    Returns anomaly info if detected, None otherwise
    """
    if previous_value == 0:
        return None

    percentage_drop = (previous_value - current_value) / previous_value

    if percentage_drop <= 0:
        return None

    # Get thresholds for metric
    threshold_map = {
        "sales": {"warning": 0.20, "critical": 0.30},
        "delivered_orders": {"warning": 0.20, "critical": 0.30},
        "impressions": {"warning": 0.30, "critical": 0.50},
        "ads_roi": {"warning": 0.25, "critical": 0.40},
        "menu_to_order": {"warning": 0.15, "critical": 0.25},
        "cart_to_order": {"warning": 0.15, "critical": 0.25},
    }

    thresholds = threshold_map.get(metric, {"warning": 0.20, "critical": 0.30})

    severity = None
    if percentage_drop >= thresholds["critical"]:
        severity = "critical"
    elif percentage_drop >= thresholds["warning"]:
        severity = "warning"

    if severity:
        return {
            "metric": metric,
            "severity": severity,
            "current_value": current_value,
            "previous_value": previous_value,
            "percentage_drop": round(percentage_drop * 100, 2)
        }

    return None


def generate_alert_message(alert: Dict[str, Any]) -> str:
    """Generate a human-readable alert message"""
    metric_labels = {
        "sales": "Sales",
        "delivered_orders": "Orders",
        "impressions": "Impressions",
        "ads_roi": "ROI",
        "menu_to_order": "Menu to Order rate",
        "cart_to_order": "Cart to Order rate"
    }

    label = metric_labels.get(alert["metric_name"], alert["metric_name"])
    drop = alert["percentage_drop"]

    if alert["severity"] == "critical":
        return f"CRITICAL: {label} dropped by {drop:.1f}%"
    elif alert["severity"] == "warning":
        return f"WARNING: {label} dropped by {drop:.1f}%"
    else:
        return f"{label} changed by {drop:.1f}%"
