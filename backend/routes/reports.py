"""
Reports generation routes for Kread Insights Backend
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date, timedelta
from decimal import Decimal
import io

from config import settings
from routes.auth import verify_token

router = APIRouter()


class ReportRequest(BaseModel):
    report_type: str
    period_start: str
    period_end: str
    restaurant_ids: List[str]
    format: str = "csv"


@router.get("/")
async def list_reports(limit: int = 20):
    """List all generated reports"""
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    response = supabase.table("reports").select("""
        *,
        generator:users!reports_generated_by_fkey(name, email)
    """).order("generated_at", desc=True).limit(limit).execute()

    reports = []
    for r in response.data:
        r["generated_by_name"] = r.get("generator", {}).get("name", "Unknown") if r.get("generator") else "Unknown"
        del r["generator"]
        reports.append(r)

    return {"reports": reports}


@router.post("/generate")
async def generate_report(request: ReportRequest, token: str):
    """Generate a new report"""
    payload = verify_token(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Parse dates
    period_start = datetime.strptime(request.period_start, "%Y-%m-%d").date()
    period_end = datetime.strptime(request.period_end, "%Y-%m-%d").date()

    # Fetch data based on report type
    if request.report_type == "daily":
        table = "daily_metrics"
        date_filter = lambda q: q.gte("date", str(period_start)).lte("date", str(period_end))
    elif request.report_type == "weekly":
        table = "weekly_aggregates"
        # Calculate week numbers
        start_week = get_week_number(period_start)
        end_week = get_week_number(period_end)
        date_filter = lambda q: q.gte("week_number", start_week[0]).lte("week_number", end_week[0])
    else:
        table = "monthly_aggregates"
        date_filter = lambda q: q.gte("month", period_start.month).lte("month", period_end.month)

    # Fetch metrics
    metrics_data = []
    for restaurant_id in request.restaurant_ids:
        query = supabase.table(table).select("*").eq("restaurant_id", restaurant_id)
        query = date_filter(query)
        result = query.execute()
        metrics_data.extend(result.data or [])

    # Fetch restaurant names
    restaurants = supabase.table("restaurants").select("id, name, display_name").in_("id", request.restaurant_ids).execute()
    restaurant_map = {r["id"]: r for r in restaurants.data}

    # Generate report content based on format
    if request.format == "csv":
        content = generate_csv_report(metrics_data, restaurant_map, request)
        content_type = "text/csv"
        file_extension = "csv"
    elif request.format == "xlsx":
        content = generate_xlsx_report(metrics_data, restaurant_map, request)
        content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        file_extension = "xlsx"
    else:
        content = generate_pdf_report(metrics_data, restaurant_map, request)
        content_type = "application/pdf"
        file_extension = "pdf"

    # Save report record
    file_name = f"report_{request.report_type}_{period_start}_{period_end}.{file_extension}"
    report_record = supabase.table("reports").insert({
        "generated_by": payload["sub"],
        "report_type": request.report_type,
        "period_start": str(period_start),
        "period_end": str(period_end),
        "restaurant_ids": request.restaurant_ids,
        "format": request.format,
        "file_path": file_name
    }).execute()

    # Audit log
    supabase.table("audit_logs").insert({
        "user_id": payload["sub"],
        "action": "report_generated",
        "target_type": "report",
        "target_id": report_record.data[0]["id"],
        "metadata": {
            "report_type": request.report_type,
            "format": request.format,
            "restaurants": len(request.restaurant_ids)
        }
    }).execute()

    return {
        "success": True,
        "report_id": report_record.data[0]["id"],
        "file_name": file_name,
        "content_type": content_type,
        "data": metrics_data if request.format == "csv" else None
    }


def get_week_number(dt: date) -> tuple:
    """Get week number and year for a date"""
    iso_cal = dt.isocalendar()
    return iso_cal[1], iso_cal[0]


def generate_csv_report(metrics_data: list, restaurant_map: dict, request: ReportRequest) -> str:
    """Generate CSV report content"""
    import csv
    from io import StringIO

    output = StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Restaurant", "Date", "Sales", "Orders", "AOV",
        "Impressions", "Menu to Order", "Menu to Cart", "Cart to Order",
        "Sales from Ads", "Ad CTR", "Ads Orders", "Ads Impressions", "Ads Spend", "Ads ROI",
        "Offer Sales", "Orders with Offers", "Discount Given", "Effective Discount"
    ])

    for m in metrics_data:
        restaurant = restaurant_map.get(m["restaurant_id"], {})
        writer.writerow([
            restaurant.get("display_name", m["restaurant_id"]),
            m.get("date", m.get("period_start", "")),
            m.get("sales", 0),
            m.get("delivered_orders", 0),
            m.get("average_order_value", 0),
            m.get("impressions", 0),
            m.get("menu_to_order", 0),
            m.get("menu_to_cart", 0),
            m.get("cart_to_order", 0),
            m.get("sales_from_ads", 0),
            m.get("ad_click_through_rate", 0),
            m.get("ads_orders", 0),
            m.get("ads_impressions", 0),
            m.get("ads_spend", 0),
            m.get("ads_roi", 0),
            m.get("gross_sales_from_offers", 0),
            m.get("orders_with_offers", 0),
            m.get("discount_given", 0),
            m.get("effective_discount", 0)
        ])

    return output.getvalue()


def generate_xlsx_report(metrics_data: list, restaurant_map: dict, request: ReportRequest) -> bytes:
    """Generate Excel report content (simplified - returns CSV for now)"""
    # In production, use openpyxl or xlsxwriter
    # Returning CSV bytes for now
    csv_content = generate_csv_report(metrics_data, restaurant_map, request)
    return csv_content.encode('utf-8')


def generate_pdf_report(metrics_data: list, restaurant_map: dict, request: ReportRequest) -> bytes:
    """Generate PDF report content (simplified - returns HTML for now)"""
    # In production, use weasyprint or reportlab
    # Returning HTML that can be converted
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Kread Insights Report</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; }}
            h1 {{ color: #1a1a1a; }}
            table {{ border-collapse: collapse; width: 100%; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
            th {{ background-color: #f4f4f4; }}
        </style>
    </head>
    <body>
        <h1>Kread Insights Report</h1>
        <p>Period: {request.period_start} to {request.period_end}</p>
        <p>Report Type: {request.report_type}</p>
        <table>
            <tr>
                <th>Restaurant</th>
                <th>Sales</th>
                <th>Orders</th>
                <th>AOV</th>
            </tr>
    """

    for m in metrics_data:
        restaurant = restaurant_map.get(m["restaurant_id"], {})
        html += f"""
            <tr>
                <td>{restaurant.get("display_name", "Unknown")}</td>
                <td>₹{m.get("sales", 0):,.2f}</td>
                <td>{m.get("delivered_orders", 0)}</td>
                <td>₹{m.get("average_order_value", 0):,.2f}</td>
            </tr>
        """

    html += """
        </table>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">
            Generated by Kread Insights - KREAD Consulting
        </p>
    </body>
    </html>
    """

    return html.encode('utf-8')


@router.get("/{report_id}")
async def get_report(report_id: str):
    """Get a specific report"""
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    response = supabase.table("reports").select("*").eq("id", report_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Report not found")

    return response.data[0]


@router.delete("/{report_id}")
async def delete_report(report_id: str, token: str):
    """Delete a report"""
    payload = verify_token(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    supabase.table("reports").delete().eq("id", report_id).execute()

    # Audit log
    supabase.table("audit_logs").insert({
        "user_id": payload["sub"],
        "action": "report_generated",  # Consider adding report_deleted action
        "target_type": "report",
        "target_id": report_id,
        "metadata": {"action": "deleted"}
    }).execute()

    return {"success": True, "message": "Report deleted"}
