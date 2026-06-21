"""
Restaurant management routes for Kread Insights Backend
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from config import settings
from routes.auth import verify_token

router = APIRouter()


class RestaurantCreate(BaseModel):
    name: str
    display_name: str
    platform: str = "zomato"
    status: str = "active"


class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    status: Optional[str] = None


class ArchiveRequest(BaseModel):
    reason: str


def check_admin_role(token: str) -> dict:
    """Verify token and check admin role"""
    payload = verify_token(token)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return payload


@router.get("/")
async def list_restaurants(
    include_archived: bool = False,
    platform: str = None,
    search: str = None
):
    """List all restaurants with optional filters"""
    from supabase import create_client, Client

    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    query = supabase.table("restaurants").select("*")

    if not include_archived:
        query = query.eq("is_archived", False)

    if platform:
        query = query.eq("platform", platform)

    response = query.order("name").execute()

    restaurants = response.data

    # Apply search filter in Python for case-insensitive search
    if search:
        search_lower = search.lower()
        restaurants = [r for r in restaurants if
                      search_lower in r["name"].lower() or
                      search_lower in r["display_name"].lower()]

    return {"restaurants": restaurants}


@router.get("/{restaurant_id}")
async def get_restaurant(restaurant_id: str):
    """Get a single restaurant by ID"""
    from supabase import create_client, Client

    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    response = supabase.table("restaurants").select("*").eq("id", restaurant_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    return response.data[0]


@router.post("/")
async def create_restaurant(restaurant: RestaurantCreate, token: str):
    """Create a new restaurant - admin only"""
    payload = check_admin_role(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Check if restaurant name exists
    existing = supabase.table("restaurants").select("id").eq("name", restaurant.name).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Restaurant with this name already exists")

    # Create restaurant
    restaurant_data = {
        "name": restaurant.name,
        "display_name": restaurant.display_name,
        "platform": restaurant.platform,
        "status": restaurant.status,
        "is_archived": False
    }

    result = supabase.table("restaurants").insert(restaurant_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create restaurant")

    new_restaurant = result.data[0]

    # Log audit
    supabase.table("audit_logs").insert({
        "user_id": payload["sub"],
        "action": "restaurant_created",
        "target_type": "restaurant",
        "target_id": new_restaurant["id"],
        "metadata": {"name": restaurant.name, "platform": restaurant.platform}
    }).execute()

    return new_restaurant


@router.put("/{restaurant_id}")
async def update_restaurant(restaurant_id: str, restaurant: RestaurantUpdate, token: str):
    """Update a restaurant - admin only"""
    payload = check_admin_role(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Check if restaurant exists
    existing = supabase.table("restaurants").select("*").eq("id", restaurant_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Build update data
    update_data = {"updated_at": "now()"}
    if restaurant.name:
        update_data["name"] = restaurant.name
    if restaurant.display_name:
        update_data["display_name"] = restaurant.display_name
    if restaurant.status:
        update_data["status"] = restaurant.status

    # Update restaurant
    result = supabase.table("restaurants").update(update_data).eq("id", restaurant_id).execute()

    # Log audit
    supabase.table("audit_logs").insert({
        "user_id": payload["sub"],
        "action": "restaurant_edited",
        "target_type": "restaurant",
        "target_id": restaurant_id,
        "metadata": update_data
    }).execute()

    return result.data[0] if result.data else {"success": True}


@router.post("/{restaurant_id}/archive")
async def archive_restaurant(restaurant_id: str, archive_request: ArchiveRequest, token: str):
    """Archive a restaurant - admin only"""
    payload = check_admin_role(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Archive restaurant
    update_data = {
        "is_archived": True,
        "archived_at": "now()",
        "archived_by": payload["sub"],
        "archive_reason": archive_request.reason,
        "updated_at": "now()"
    }

    supabase.table("restaurants").update(update_data).eq("id", restaurant_id).execute()

    # Log audit
    supabase.table("audit_logs").insert({
        "user_id": payload["sub"],
        "action": "restaurant_archived",
        "target_type": "restaurant",
        "target_id": restaurant_id,
        "metadata": {"reason": archive_request.reason}
    }).execute()

    return {"success": True, "message": "Restaurant archived successfully"}


@router.post("/{restaurant_id}/restore")
async def restore_restaurant(restaurant_id: str, token: str):
    """Restore an archived restaurant - admin only"""
    payload = check_admin_role(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Restore restaurant
    update_data = {
        "is_archived": False,
        "archived_at": None,
        "archived_by": None,
        "archive_reason": None,
        "updated_at": "now()"
    }

    supabase.table("restaurants").update(update_data).eq("id", restaurant_id).execute()

    # Log audit
    supabase.table("audit_logs").insert({
        "user_id": payload["sub"],
        "action": "restaurant_restored",
        "target_type": "restaurant",
        "target_id": restaurant_id
    }).execute()

    return {"success": True, "message": "Restaurant restored successfully"}


@router.delete("/{restaurant_id}")
async def delete_restaurant(restaurant_id: str, token: str):
    """Permanently delete a restaurant - admin only"""
    payload = check_admin_role(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Get restaurant name for audit log
    existing = supabase.table("restaurants").select("name").eq("id", restaurant_id).execute()
    restaurant_name = existing.data[0]["name"] if existing.data else "Unknown"

    # Delete related data (cascading in production use foreign key constraints)
    supabase.table("daily_metrics").delete().eq("restaurant_id", restaurant_id).execute()
    supabase.table("weekly_aggregates").delete().eq("restaurant_id", restaurant_id).execute()
    supabase.table("monthly_aggregates").delete().eq("restaurant_id", restaurant_id).execute()
    supabase.table("alerts").delete().eq("restaurant_id", restaurant_id).execute()

    # Delete restaurant
    supabase.table("restaurants").delete().eq("id", restaurant_id).execute()

    # Log audit
    supabase.table("audit_logs").insert({
        "user_id": payload["sub"],
        "action": "restaurant_deleted",
        "target_type": "restaurant",
        "target_id": restaurant_id,
        "metadata": {"name": restaurant_name}
    }).execute()

    return {"success": True, "message": "Restaurant permanently deleted"}


@router.get("/archived/list")
async def list_archived_restaurants():
    """List all archived restaurants"""
    from supabase import create_client, Client

    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    response = supabase.table("restaurants").select("""
        *,
        archived_by_user:users!restaurants_archived_by_fkey(name)
    """).eq("is_archived", True).order("archived_at", desc=True).execute()

    # Flatten nested user name
    restaurants = []
    for r in response.data:
        r["archived_by_name"] = r.get("archived_by_user", {}).get("name", "Unknown") if r.get("archived_by_user") else "Unknown"
        del r["archived_by_user"]
        restaurants.append(r)

    return {"restaurants": restaurants}
