"""
Kread Insights Backend - FastAPI Application
Internal restaurant analytics platform for KREAD Consulting
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from routes import restaurants, metrics, upload, reports, auth, alerts
from models.database import create_seed_admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create seed admin user if not exists
    await create_seed_admin()
    yield
    # Shutdown: cleanup if needed

app = FastAPI(
    title="Kread Insights API",
    description="Internal restaurant analytics platform for KREAD Consulting",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(restaurants.router, prefix="/api/restaurants", tags=["Restaurants"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["Metrics"])
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "kread-insights-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
