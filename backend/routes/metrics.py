"""
Metrics routes for Kread Insights Backend
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timedelta, date
from decimal import Decimal

from config import settings

router = APIRouter()


def get_week_number(dt: date) -> tuple:
    """Get week number and year for a date (ISO week)"""
    iso_cal = dt.isocalendar()
    return iso_cal[1], iso_cal[0]  # week_number, year


def get_week_bounds(week_number: int, year: int) -> tuple:
    """Get start and end dates for a given ISO week"""
    # Find the first day of the week (Monday)
    from datetime import timedelta
    jan4 = date(year, 1, 4)  # Jan 4 is always in week 1
    week1_monday = jan4 - timedelta(days=jan4.weekday())
    target_monday = week1_monday + timedelta(weeks=week_number - 1)
    target_sunday = target_monday + timedelta(days=6)
    return target_monday, target_sunday


@router.get("/overview")
async def get_overview_metrics(
    period_type: str = "daily",
    date_value: str = None,
    compare: bool = True
):
    """Get overview dashboard metrics for all restaurants"""
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Determine current and previous periods
    if period_type == "daily":
        current_date = datetime.strptime(date_value, "%Y-%m-%d").date() if date_value else date.today()
        previous_date = current_date - timedelta(days=1)

        current_start = current_end = current_date
        previous_start = previous_end = previous_date

    elif period_type == "weekly":
        if date_value:
            week_num, year = map(int, date_value.split("-"))
        else:
            week_num, year = get_week_number(date.today())

        current_start, current_end = get_week_bounds(week_num, year)
        prev_week = week_num - 1 if week_num > 1 else 52
        prev_year = year if week_num > 1 else year - 1
        previous_start, previous_end = get_week_bounds(prev_week, prev_year)

    elif period_type == "monthly":
        if date_value:
            month, year = map(int, date_value.split("-"))
        else:
            today = date.today()
            month, year = today.month, today.year

        current_start = date(year, month, 1)
        if month == 12:
            current_end = date(year, 12, 31)
        else:
            current_end = date(year, month + 1, 1) - timedelta(days=1)

        prev_month = month - 1 if month > 1 else 12
        prev_year = year if month > 1 else year - 1
        previous_start = date(prev_year, prev_month, 1)
        if prev_month == 12:
            previous_end = date(prev_year, 12, 31)
        else:
            previous_end = date(prev_year, prev_month + 1, 1) - timedelta(days=1)
    else:
        raise HTTPException(status_code=400, detail="Invalid period_type")

    # Get active restaurants count
    restaurants_resp = supabase.table("restaurants").select("id").eq("is_archived", False).execute()
    total_restaurants = len(restaurants_resp.data)

    # Fetch current period metrics
    if period_type == "daily":
        current_metrics = supabase.table("daily_metrics").select("*").eq("date", str(current_date)).execute()
    elif period_type == "weekly":
        if date_value:
            week_num, year = map(int, date_value.split("-"))
        else:
            week_num, year = get_week_number(date.today())
        current_metrics = supabase.table("weekly_aggregates").select("*").eq("week_number", week_num).eq("year", year).execute()
    else:
        if date_value:
            month, year = map(int, date_value.split("-"))
        else:
            today = date.today()
            month, year = today.month, today.year
        current_metrics = supabase.table("monthly_aggregates").select("*").eq("month", month).eq("year", year).execute()

    # Fetch previous period metrics
    if compare:
        if period_type == "daily":
            previous_metrics = supabase.table("daily_metrics").select("*").eq("date", str(previous_date)).execute()
        elif period_type == "weekly":
            prev_week = week_num - 1 if week_num > 1 else 52
            prev_year = year if week_num > 1 else year - 1
            previous_metrics = supabase.table("weekly_aggregates").select("*").eq("week_number", prev_week).eq("year", prev_year).execute()
        else:
            prev_month = month - 1 if month > 1 else 12
            prev_year = year if month > 1 else year - 1
            previous_metrics = supabase.table("monthly_aggregates").select("*").eq("month", prev_month).eq("year", prev_year).execute()
    else:
        previous_metrics = {"data": []}

    # Aggregate current metrics
    current_data = current_metrics.data or []
    previous_data = previous_metrics.data or []

    def calc_sum(data, field):
        return sum(float(r.get(field, 0) or 0) for r in data)

    def calc_avg(data, field):
        values = [float(r.get(field, 0) or 0) for r in data if r.get(field)]
        return sum(values) / len(values) if values else 0

    current_totals = {
        "sales": calc_sum(current_data, "sales"),
        "orders": calc_sum(current_data, "delivered_orders"),
        "aov": calc_avg(current_data, "average_order_value"),
        " impressions": calc_sum(current_data, "impressions"),
        "sales_from_ads": calc_sum(current_data, "sales_from_ads"),
        "ad_spend": calc_sum(current_data, "ads_spend"),
        "offer_sales": calc_sum(current_data, "gross_sales_from_offers"),
        "roi": calc_avg(current_data, "ads_roi")
    }

    previous_totals = {
        "sales": calc_sum(previous_data, "sales"),
        "orders": calc_sum(previous_data, "delivered_orders"),
        "aov": calc_avg(previous_data, "average_order_value"),
        "impressions": calc_sum(previous_data, "impressions"),
        "sales_from_ads": calc_sum(previous_data, "sales_from_ads"),
        "ad_spend": calc_sum(previous_data, "ads_spend"),
        "offer_sales": calc_sum(previous_data, "gross_sales_from_offers"),
        "roi": calc_avg(previous_data, "ads_roi")
    }

    # Calculate changes
    def calc_change(current, previous):
        if previous == 0:
            return {"absolute": current, "percentage": 100 if current > 0 else 0, "trend": "up" if current > 0 else "neutral"}
        abs_change = current - previous
        pct_change = (abs_change / previous) * 100
        trend = "up" if abs_change > 0 else "down" if abs_change < 0 else "neutral"
        return {"absolute": abs_change, "percentage": round(pct_change, 2), "trend": trend}

    # Get active alerts count
    alerts_resp = supabase.table("alerts").select("id, severity").eq("acknowledged", False).execute()
    alert_counts = {"critical": 0, "warning": 0, "info": 0}
    for alert in alerts_resp.data:
        alert_counts[alert["severity"]] = alert_counts.get(alert["severity"], 0) + 1

    return {
        "period": {
            "type": period_type,
            "current_start": str(current_start),
            "current_end": str(current_end),
            "previous_start": str(previous_start) if compare else None,
            "previous_end": str(previous_end) if compare else None
        },
        "kpis": {
            "total_restaurants": {
                "current": total_restaurants,
                "previous": total_restaurants,
                "change": {"absolute": 0, "percentage": 0, "trend": "neutral"}
            },
            "total_sales": {
                "current": round(current_totals["sales"], 2),
                "previous": round(previous_totals["sales"], 2),
                "change": calc_change(current_totals["sales"], previous_totals["sales"])
            },
            "total_orders": {
                "current": int(current_totals["orders"]),
                "previous": int(previous_totals["orders"]),
                "change": calc_change(current_totals["orders"], previous_totals["orders"])
            },
            "average_aov": {
                "current": round(current_totals["aov"], 2),
                "previous": round(previous_totals["aov"], 2),
                "change": calc_change(current_totals["aov"], previous_totals["aov"])
            },
            "average_roi": {
                "current": round(current_totals["roi"], 2),
                "previous": round(previous_totals["roi"], 2),
                "change": calc_change(current_totals["roi"], previous_totals["roi"])
            },
            "total_ad_spend": {
                "current": round(current_totals["ad_spend"], 2),
                "previous": round(previous_totals["ad_spend"], 2),
                "change": calc_change(current_totals["ad_spend"], previous_totals["ad_spend"])
            },
            "total_offer_sales": {
                "current": round(current_totals["offer_sales"], 2),
                "previous": round(previous_totals["offer_sales"], 2),
                "change": calc_change(current_totals["offer_sales"], previous_totals["offer_sales"])
            },
            "active_alerts": {
                "current": len(alerts_resp.data),
                "previous": 0,
                "change": {"absolute": len(alerts_resp.data), "percentage": 0, "trend": "neutral"},
                "breakdown": alert_counts
            }
        }
    }


@router.get("/restaurant/{restaurant_id}")
async def get_restaurant_metrics(
    restaurant_id: str,
    period_type: str = "daily",
    start_date: str = None,
    end_date: str = None
):
    """Get metrics for a specific restaurant"""
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Verify restaurant exists
    restaurant = supabase.table("restaurants").select("*").eq("id", restaurant_id).execute()
    if not restaurant.data:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Fetch metrics based on period type
    if period_type == "daily":
        query = supabase.table("daily_metrics").select("*").eq("restaurant_id", restaurant_id)
        if start_date:
            query = query.gte("date", start_date)
        if end_date:
            query = query.lte("date", end_date)
        metrics = query.order("date", desc=True).limit(30).execute()

    elif period_type == "weekly":
        metrics = supabase.table("weekly_aggregates").select("*").eq("restaurant_id", restaurant_id).order("year", desc=True).order("week_number", desc=True).limit(12).execute()

    else:
        metrics = supabase.table("monthly_aggregates").select("*").eq("restaurant_id", restaurant_id).order("year", desc=True).order("month", desc=True).limit(12).execute()

    return {
        "restaurant": restaurant.data[0],
        "period_type": period_type,
        "metrics": metrics.data or []
    }


@router.get("/restaurant/{restaurant_id}/trends")
async def get_restaurant_trends(
    restaurant_id: str,
    metric: str = "sales",
    period_type: str = "daily",
    periods: int = 30
):
    """Get trend data for a specific metric"""
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    if period_type == "daily":
        metrics = supabase.table("daily_metrics").select(f"date, {metric}").eq("restaurant_id", restaurant_id).order("date", desc=True).limit(periods).execute()
        data = [{"period": m["date"], "value": float(m.get(metric, 0) or 0)} for m in reversed(metrics.data or [])]
    elif period_type == "weekly":
        metrics = supabase.table("weekly_aggregates").select(f"week_number, year, {metric}").eq("restaurant_id", restaurant_id).order("year", desc=True).order("week_number", desc=True).limit(periods).execute()
        data = [{"period": f"W{m['week_number']}-{m['year']}", "value": float(m.get(metric, 0) or 0)} for m in reversed(metrics.data or [])]
    else:
        metrics = supabase.table("monthly_aggregates").select(f"month, year, {metric}").eq("restaurant_id", restaurant_id).order("year", desc=True).order("month", desc=True).limit(periods).execute()
        data = [{"period": f"{m['month']}/{m['year']}", "value": float(m.get(metric, 0) or 0)} for m in reversed(metrics.data or [])]

    return {"metric": metric, "period_type": period_type, "data": data}


@router.get("/compare")
async def compare_restaurants(
    restaurant_a_id: str,
    restaurant_b_id: str,
    period_type: str = "daily",
    period_value: str = None
):
    """Compare two restaurants across all metrics"""
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Fetch restaurant details
    restaurants = supabase.table("restaurants").select("*").in_("id", [restaurant_a_id, restaurant_b_id]).execute()
    if len(restaurants.data) != 2:
        raise HTTPException(status_code=404, detail="One or both restaurants not found")

    restaurant_map = {r["id"]: r for r in restaurants.data}

    # Determine period
    if period_type == "daily":
        target_date = period_value or str(date.today())
        table = "daily_metrics"
        filter_col = "date"
        filter_val = target_date
    elif period_type == "weekly":
        if period_value:
            week_num, year = map(int, period_value.split("-"))
        else:
            week_num, year = get_week_number(date.today())
        table = "weekly_aggregates"
        filter_col = None
        filter_val = None
    else:
        if period_value:
            month, year = map(int, period_value.split("-"))
        else:
            today = date.today()
            month, year = today.month, today.year
        table = "monthly_aggregates"
        filter_col = None
        filter_val = None

    # Fetch metrics for both restaurants
    metrics_list = ["sales", "delivered_orders", "average_order_value", "impressions", "menu_to_order",
                   "menu_to_cart", "cart_to_order", "sales_from_ads", "ad_click_through_rate",
                   "ads_orders", "ads_impressions", "ads_spend", "ads_roi", "gross_sales_from_offers",
                   "orders_with_offers", "discount_given", "effective_discount"]

    # Build query
    if period_type == "daily":
        metrics_a = supabase.table(table).select("*").eq("restaurant_id", restaurant_a_id).eq("date", filter_val).single().execute()
        metrics_b = supabase.table(table).select("*").eq("restaurant_id", restaurant_b_id).eq("date", filter_val).single().execute()
    elif period_type == "weekly":
        metrics_a = supabase.table(table).select("*").eq("restaurant_id", restaurant_a_id).eq("week_number", week_num).eq("year", year).single().execute()
        metrics_b = supabase.table(table).select("*").eq("restaurant_id", restaurant_b_id).eq("week_number", week_num).eq("year", year).single().execute()
    else:
        metrics_a = supabase.table(table).select("*").eq("restaurant_id", restaurant_a_id).eq("month", month).eq("year", year).single().execute()
        metrics_b = supabase.table(table).select("*").eq("restaurant_id", restaurant_b_id).eq("month", month).eq("year", year).single().execute()

    data_a = metrics_a.data or {}
    data_b = metrics_b.data or {}

    # Build comparison
    metric_labels = {
        "sales": "Sales",
        "delivered_orders": "Delivered Orders",
        "average_order_value": "Average Order Value",
        "impressions": "Impressions",
        "menu_to_order": "Menu to Order",
        "menu_to_cart": "Menu to Cart",
        "cart_to_order": "Cart to Order",
        "sales_from_ads": "Sales from Ads",
        "ad_click_through_rate": "Ad Click-Through Rate",
        "ads_orders": "Ads Orders",
        "ads_impressions": "Ads Impressions",
        "ads_spend": "Ads Spend",
        "ads_roi": "Ads ROI",
        "gross_sales_from_offers": "Gross Sales from Offers",
        "orders_with_offers": "Orders with Offers",
        "discount_given": "Discount Given",
        "effective_discount": "Effective Discount"
    }

    comparisons = []
    a_wins = 0
    b_wins = 0

    for metric_key in metrics_list:
        val_a = float(data_a.get(metric_key, 0) or 0)
        val_b = float(data_b.get(metric_key, 0) or 0)

        abs_diff = val_a - val_b
        if val_b != 0:
            pct_diff = (abs_diff / val_b) * 100
        else:
            pct_diff = 100 if val_a > 0 else 0

        # Determine winner (higher is better for most metrics, but not for discount_given, effective_discount)
        if metric_key in ["discount_given", "effective_discount"]:
            # Lower is better
            winner = "A" if val_a < val_b else "B" if val_b < val_a else "tie"
        else:
            winner = "A" if val_a > val_b else "B" if val_b > val_a else "tie"

        if winner == "A":
            a_wins += 1
        elif winner == "B":
            b_wins += 1

        comparisons.append({
            "metric": metric_key,
            "label": metric_labels.get(metric_key, metric_key),
            "restaurant_a_value": val_a,
            "restaurant_b_value": val_b,
            "absolute_difference": round(abs_diff, 2),
            "percentage_difference": round(pct_diff, 2),
            "winner": winner
        })

    # Generate summary
    total_metrics = len(comparisons)
    summary = f"{restaurant_map[restaurant_a_id]['display_name']} leads in {a_wins} metrics, {restaurant_map[restaurant_b_id]['display_name']} leads in {b_wins} metrics."

    return {
        "restaurants": {
            "a": restaurant_map[restaurant_a_id],
            "b": restaurant_map[restaurant_b_id]
        },
        "period": {
            "type": period_type,
            "value": period_value or (str(date.today()) if period_type == "daily" else
                                     f"{week_num}-{year}" if period_type == "weekly" else
                                     f"{month}-{year}")
        },
        "comparisons": comparisons,
        "summary": summary,
        "wins": {"a": a_wins, "b": b_wins}
    }


@router.get("/rankings")
async def get_rankings(
    category: str = "top_performers",
    metric: str = "sales",
    period_type: str = "daily",
    limit: int = 5
):
    """Get restaurant rankings by category"""
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Get current period
    today = date.today()
    if period_type == "daily":
        table = "daily_metrics"
        period_filter = {"date": str(today)}
    elif period_type == "weekly":
        table = "weekly_aggregates"
        week_num, year = get_week_number(today)
        period_filter = {"week_number": week_num, "year": year}
    else:
        table = "monthly_aggregates"
        period_filter = {"month": today.month, "year": today.year}

    # Build query - join with restaurants
    query = supabase.table(table).select(f"""
        {metric},
        restaurant_id,
        restaurants!inner(id, name, display_name, is_archived)
    """).eq("restaurants.is_archived", False)

    if period_type == "daily":
        query = query.eq("date", str(today))
    elif period_type == "weekly":
        query = query.eq("week_number", week_num).eq("year", year)
    else:
        query = query.eq("month", today.month).eq("year", today.year)

    result = query.execute()

    # Sort by metric
    data = result.data or []
    reverse = category in ["top_performers", "highest_roi", "best_funnel", "strongest_growth"]
    sorted_data = sorted(data, key=lambda x: float(x.get(metric, 0) or 0), reverse=reverse)

    # Build rankings
    rankings = []
    for i, item in enumerate(sorted_data[:limit]):
        restaurant = item.get("restaurants", {})
        rankings.append({
            "rank": i + 1,
            "restaurant_id": item.get("restaurant_id"),
            "restaurant_name": restaurant.get("display_name", restaurant.get("name", "Unknown")),
            "metric_value": float(item.get(metric, 0) or 0),
            "change_from_previous": 0,  # Would need previous period comparison
            "trend": "neutral"
        })

    return {"category": category, "metric": metric, "period_type": period_type, "rankings": rankings}
