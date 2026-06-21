"""
Upload and CSV processing routes for Kread Insights Backend
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from typing import Optional, List
from datetime import datetime
import io
import csv
import json

from config import settings
from routes.auth import verify_token, check_admin_role

router = APIRouter()


# Expected CSV columns (Zomato format)
EXPECTED_COLUMNS = {
    # Restaurant identification
    "restaurant_name": ["restaurant_name", "restaurant", "name", "restaurant id"],

    # Sales Overview
    "date": ["date", "order_date", "date_of_order"],
    "sales": ["sales", "total_sales", "revenue", "total_revenue"],
    "delivered_orders": ["delivered_orders", "orders", "total_orders", "order_count"],
    "average_order_value": ["average_order_value", "aov", "avg_order_value"],

    # Customer Funnel
    "impressions": ["impressions", "page_views", "views"],
    "menu_to_order": ["menu_to_order", "mto", "menu_to_order_rate", "menu_to_order_percentage"],
    "menu_to_cart": ["menu_to_cart", "mtc", "menu_to_cart_rate", "menu_to_cart_percentage"],
    "cart_to_order": ["cart_to_order", "cto", "cart_to_order_rate", "cart_to_order_percentage"],

    # Marketing
    "sales_from_ads": ["sales_from_ads", "ad_sales", "ads_sales"],
    "ad_click_through_rate": ["ad_click_through_rate", "ctr", "ad_ctr", "click_through_rate"],
    "ads_orders": ["ads_orders", "ad_orders", "orders_from_ads"],
    "ads_impressions": ["ads_impressions", "ad_impressions", "ad_views"],
    "ads_spend": ["ads_spend", "ad_spend", "marketing_spend"],
    "ads_roi": ["ads_roi", "roi", "ad_roi", "return_on_investment"],
    "gross_sales_from_offers": ["gross_sales_from_offers", "offer_sales", "offers_sales"],
    "orders_with_offers": ["orders_with_offers", "offer_orders", "orders_from_offers"],
    "discount_given": ["discount_given", "discount", "total_discount"],
    "effective_discount": ["effective_discount", "effective_discount_rate", "effective_discount_percentage"]
}


def find_column_mapping(headers: List[str]) -> dict:
    """Map CSV headers to expected columns"""
    mapping = {}
    headers_lower = [h.lower().strip() for h in headers]

    for expected_col, aliases in EXPECTED_COLUMNS.items():
        for i, h in enumerate(headers_lower):
            if h in [a.lower() for a in aliases]:
                mapping[expected_col] = headers[i]  # Use original case
                break

    return mapping


def validate_csv_structure(mapping: dict) -> List[str]:
    """Validate that required columns are present"""
    required = ["restaurant_name", "date", "sales"]
    missing = []

    for col in required:
        if col not in mapping:
            missing.append(col)

    return missing


async def process_csv_row(row: dict, column_mapping: dict, file_id: str, user_id: str):
    """Process a single CSV row and return metrics"""
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Extract values using mapping
    def get_value(key, default=0):
        src_col = column_mapping.get(key)
        if src_col and src_col in row:
            val = row[src_col]
            if val is None or val == '':
                return default
            try:
                # Clean and parse numeric values
                if isinstance(val, str):
                    val = val.replace(',', '').replace('%', '').replace('₹', '').strip()
                return float(val) if '.' in str(val) else int(float(val))
            except (ValueError, TypeError):
                return default
        return default

    restaurant_name = row.get(column_mapping.get("restaurant_name", ""), "").strip()
    date_str = row.get(column_mapping.get("date", ""), "").strip()

    # Parse date
    try:
        from datetime import datetime
        date_val = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        try:
            date_val = datetime.strptime(date_str, "%d-%m-%Y").date()
        except ValueError:
            try:
                date_val = datetime.strptime(date_str, "%m/%d/%Y").date()
            except ValueError:
                return None, f"Invalid date format: {date_str}"

    # Find or create restaurant
    restaurant_resp = supabase.table("restaurants").select("id").eq("name", restaurant_name).execute()

    if not restaurant_resp.data:
        # Create restaurant if not exists
        create_resp = supabase.table("restaurants").insert({
            "name": restaurant_name,
            "display_name": restaurant_name,
            "platform": "zomato",
            "status": "active",
            "is_archived": False
        }).execute()
        restaurant_id = create_resp.data[0]["id"]

        # Audit log
        supabase.table("audit_logs").insert({
            "user_id": user_id,
            "action": "restaurant_created",
            "target_type": "restaurant",
            "target_id": restaurant_id,
            "metadata": {"name": restaurant_name, "via_upload": True}
        }).execute()
    else:
        restaurant_id = restaurant_resp.data[0]["id"]

    # Store raw import
    raw_import = supabase.table("raw_imports").insert({
        "uploaded_file_id": file_id,
        "restaurant_id": restaurant_id,
        "date": str(date_val),
        "raw_row_data": row
    }).execute()

    # Build metrics data
    metrics_data = {
        "restaurant_id": restaurant_id,
        "date": str(date_val),
        "sales": get_value("sales"),
        "delivered_orders": int(get_value("delivered_orders")),
        "average_order_value": get_value("average_order_value"),
        "impressions": int(get_value("impressions")),
        "menu_to_order": get_value("menu_to_order"),
        "menu_to_cart": get_value("menu_to_cart"),
        "cart_to_order": get_value("cart_to_order"),
        "sales_from_ads": get_value("sales_from_ads"),
        "ad_click_through_rate": get_value("ad_click_through_rate"),
        "ads_orders": int(get_value("ads_orders")),
        "ads_impressions": int(get_value("ads_impressions")),
        "ads_spend": get_value("ads_spend"),
        "ads_roi": get_value("ads_roi"),
        "gross_sales_from_offers": get_value("gross_sales_from_offers"),
        "orders_with_offers": int(get_value("orders_with_offers")),
        "discount_given": get_value("discount_given"),
        "effective_discount": get_value("effective_discount")
    }

    return metrics_data, None


@router.post("/upload")
async def upload_csv(
    file: UploadFile = File(...),
    token: str = Form(...)
):
    """Upload and process a CSV file - admin only"""
    payload = check_admin_role(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Validate file extension
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    # Check file size
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File size exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    # Create upload record
    upload_record = supabase.table("uploaded_files").insert({
        "file_name": file.filename,
        "file_size": len(content),
        "uploaded_by": payload["sub"],
        "status": "processing"
    }).execute()

    file_id = upload_record.data[0]["id"]

    try:
        # Parse CSV
        content_str = content.decode('utf-8')
        reader = csv.DictReader(io.StringIO(content_str))

        # Get headers and map columns
        headers = reader.fieldnames or []
        column_mapping = find_column_mapping(headers)

        # Validate structure
        missing_cols = validate_csv_structure(column_mapping)
        if missing_cols:
            supabase.table("uploaded_files").update({
                "status": "failed",
                "error_details": {"missing_columns": missing_cols}
            }).eq("id", file_id).execute()
            raise HTTPException(status_code=400, detail=f"Missing required columns: {missing_cols}")

        # Process rows
        import_errors = []
        metrics_to_insert = []
        restaurants_matched = set()
        row_count = 0
        skipped_rows = 0

        for row_idx, row in enumerate(reader):
            row_count += 1
            metrics, error = await process_csv_row(row, column_mapping, file_id, payload["sub"])

            if error:
                import_errors.append(f"Row {row_idx + 1}: {error}")
                skipped_rows += 1
            elif metrics:
                metrics_to_insert.append(metrics)
                restaurants_matched.add(metrics["restaurant_id"])

        # Upsert metrics (using conflict handling)
        if metrics_to_insert:
            for m in metrics_to_insert:
                supabase.table("daily_metrics").upsert(m, on_conflict="restaurant_id,date").execute()

        # Update aggregates
        for restaurant_id in restaurants_matched:
            # This would trigger aggregate computation - simplified for now
            pass

        # Update upload record
        supabase.table("uploaded_files").update({
            "status": "processed",
            "row_count": row_count,
            "error_details": {"errors": import_errors[:10]} if import_errors else None
        }).eq("id", file_id).execute()

        # Run anomaly detection
        from services.anomaly_detection import run_anomaly_detection
        anomaly_count = await run_anomaly_detection()

        # Audit log
        supabase.table("audit_logs").insert({
            "user_id": payload["sub"],
            "action": "file_uploaded",
            "target_type": "file",
            "target_id": file_id,
            "metadata": {
                "file_name": file.filename,
                "rows_imported": len(metrics_to_insert),
                "rows_skipped": skipped_rows,
                "restaurants_matched": len(restaurants_matched),
                "anomalies_detected": anomaly_count
            }
        }).execute()

        return {
            "success": True,
            "file_id": file_id,
            "summary": {
                "total_rows": row_count,
                "imported_rows": len(metrics_to_insert),
                "skipped_rows": skipped_rows,
                "restaurants_matched": len(restaurants_matched),
                "anomalies_detected": anomaly_count,
                "errors": import_errors[:5]
            }
        }

    except Exception as e:
        supabase.table("uploaded_files").update({
            "status": "failed",
            "error_details": {"error": str(e)}
        }).eq("id", file_id).execute()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@router.get("/history")
async def get_upload_history(limit: int = 10):
    """Get upload history"""
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    response = supabase.table("uploaded_files").select("""
        *,
        uploader:users!uploaded_files_uploaded_by_fkey(name, email)
    """).order("uploaded_at", desc=True).limit(limit).execute()

    # Flatten user data
    uploads = []
    for u in response.data:
        u["uploaded_by_name"] = u.get("uploader", {}).get("name", "Unknown") if u.get("uploader") else "Unknown"
        del u["uploader"]
        uploads.append(u)

    return {"uploads": uploads}


@router.get("/{file_id}/preview")
async def get_file_preview(file_id: str, limit: int = 50):
    """Preview processed data from an uploaded file"""
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Get file info
    file_info = supabase.table("uploaded_files").select("*").eq("id", file_id).execute()
    if not file_info.data:
        raise HTTPException(status_code=404, detail="File not found")

    # Get raw imports
    imports = supabase.table("raw_imports").select(f"""
        *,
        restaurants!inner(name, display_name)
    """).eq("uploaded_file_id", file_id).limit(limit).execute()

    # Get daily metrics
    metrics = supabase.table("daily_metrics").select("restaurant_id, date, sales").limit(limit).execute()

    return {
        "file": file_info.data[0],
        "preview": imports.data or []
    }


@router.delete("/{file_id}")
async def delete_upload(file_id: str, token: str):
    """Delete an uploaded file and its associated data - admin only"""
    payload = check_admin_role(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Delete raw imports
    supabase.table("raw_imports").delete().eq("uploaded_file_id", file_id).execute()

    # Delete file record
    supabase.table("uploaded_files").delete().eq("id", file_id).execute()

    # Audit log
    supabase.table("audit_logs").insert({
        "user_id": payload["sub"],
        "action": "file_uploaded",  # Consider adding file_deleted action
        "target_type": "file",
        "target_id": file_id,
        "metadata": {"action": "deleted"}
    }).execute()

    return {"success": True, "message": "Upload deleted successfully"}
