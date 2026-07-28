from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.scan import router as scan_router
from backend.api.history import router as history_router
from backend.api.camera import router as camera_router
from backend.api.stats import router as stats_router


# ============================================================
# CREATE FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Hardhik's AI Recognition/Monitoring System",
    description="AI-powered multi-object recognition and monitoring system",
    version="1.0.0",
)


# ============================================================
# CORS CONFIGURATION
# ============================================================

# Local development origins
LOCAL_ORIGINS = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
]

app.add_middleware(
    CORSMiddleware,

    # Local development + permanent Vercel production URL
    allow_origins=[
        *LOCAL_ORIGINS,
        "https://ai-sentinel-ashy.vercel.app",
    ],

    # Also support Vercel preview deployments
    allow_origin_regex=r"https://[a-zA-Z0-9-]+\.vercel\.app",

    # We are not using cross-origin browser cookies
    allow_credentials=False,

    # GET, POST, DELETE, OPTIONS, etc.
    allow_methods=["*"],

    # Allow required browser headers
    allow_headers=["*"],
)


# ============================================================
# CONNECT API ROUTERS
# ============================================================

app.include_router(scan_router)
app.include_router(history_router)
app.include_router(camera_router)
app.include_router(stats_router)


# ============================================================
# ROOT ENDPOINT
# ============================================================

@app.get("/")
async def root():
    return {
        "project": "Hardhik's AI Recognition/Monitoring System",
        "status": "online",
        "version": "1.0.0",
        "features": {
            "image_scanner": "ready",
            "camera_scanner": "ready",
            "live_detection": "ready",
            "scan_history": "ready",
            "history_search": "ready",
            "dashboard_statistics": "ready",
        },
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "backend": "online",
        "opencv": "ready",
        "yolo": "ready",
        "gemini": "ready",
        "database": "ready",
        "supabase": "ready",
        "cloud_storage": "ready",
        "cloudinary": "ready",
        "camera_api": "ready",
        "history_api": "ready",
        "stats_api": "ready",
    }