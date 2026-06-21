"""
Alerts routes for Kread Insights Backend
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, date, timedelta

from config import settings
from routes.auth import verify_token, check_admin_role

router = APIRouter()


@router.get("/")
async def list_alerts(
    severity: str = None,
    acknowledged: bool = None,
    restaurant_id: str = None,
    limit: int = 50
):
    """List alerts with optional filters"""
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    query = supabase.table("alerts").select("""
        *,
        restaurants!inner(name, display_name)
    """)

    if severity:
        query = query.eq("severity", severity)
    if acknowledged is not None:
        query = query.eq("acknowledged", acknowledged)
    if restaurant_id:
        query = query.eq("restaurant_id", restaurant_id)

    response = query.order("detected_at", desc=True).limit(limit).execute()

    # Flatten restaurant data
    alerts = []
    for a in response.data:
        restaurant = a.get("restaurants", {})
        a["restaurant_name"] = restaurant.get("display_name", restaurant.get("name", "Unknown"))
        del a["restaurants"]
        alerts.append(a)

    # Group by severity for summary
    summary = {"critical": 0, "warning": 0, "info": 0}
    for a in alerts:
        if a["severity"] in summary:
            summary[a["severity"]] += 1

    return {
        "alerts": alerts,
        "summary": summary,
        "total": len(alerts)
    }


@router.get("/{alert_id}")
async def get_alert(alert_id: str):
    """Get a specific alert"""
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    response = supabase.table("alerts").select("""
        *,
        restaurants!inner(name, display_name)
    """).eq("id", alert_id).single().execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert = response.data
    restaurant = alert.get("restaurants", {})
    alert["restaurant_name"] = restaurant.get("display_name", restaurant.get("name", "Unknown"))
    del alert["restaurants"]

    return alert


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, token: str):
    """Acknowledge an alert"""
    payload = verify_token(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Update alert
    response = supabase.table("alerts").update({
        "acknowledged": True,
        "acknowledged_by": payload["sub"],
        "acknowledged_at": "now()"
    }).eq("id", alert_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Audit log
    supabase.table("audit_logs").insert({
        "user_id": payload["sub"],
        "action": "alert_acknowledged",
        "target_type": "alert",
        "target_id": alert_id
    }).execute()

    return {"success": True, "message": "Alert acknowledged"}


@router.post("/acknowledge-all")
async def acknowledge_all_alerts(severity: str = None, token: str):
    """Acknowledge all alerts of a certain severity"""
    payload = verify_token(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    query = supabase.table("alerts").update({
        "acknowledged": True,
        "acknowledged_by": payload["sub"],
        "acknowledged_at": "now()"
    }).eq("acknowledged", False)

    if severity:
        query = query.eq("severity", severity)

    response = query.execute()

    count = len(response.data) if response.data else 0

    return {"success": True, "message": f"Acknowledged {count} alerts"}


@router.get("/restaurant/{restaurant_id}")
async def get_restaurant_alerts(restaurant_id: str, limit: int = 20):
    """Get alerts for a specific restaurant"""
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    response = supabase.table("alerts").select("*").eq("restaurant_id", restaurant_id).order("detected_at", desc=True).limit(limit).execute()

    return {"alerts": response.data or []}


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, token: str):
    """Delete an alert"""
    payload = check_admin_role(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    supabase.table("alerts").delete().eq("id", alert_id).execute()

    return {"success": True, "message": "Alert deleted"}
