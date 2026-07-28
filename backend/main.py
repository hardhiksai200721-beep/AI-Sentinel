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
    description=(
        "AI-powered multi-object recognition "
        "and monitoring system"
    ),
    version="1.0.0",
)


# ============================================================
# CONNECT API ROUTERS
# ============================================================

app.include_router(scan_router)
app.include_router(history_router)
app.include_router(camera_router)
app.include_router(stats_router)


# ============================================================
# CORS CONFIGURATION
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROOT ENDPOINT
# ============================================================

@app.get("/")
async def root():

    return {
        "project":
            "Hardhik's AI Recognition/Monitoring System",

        "status":
            "online",

        "version":
            "1.0.0",

        "features": {
            "image_scanner":
                "ready",

            "camera_scanner":
                "ready",

            "live_detection":
                "ready",

            "scan_history":
                "ready",

            "history_search":
                "ready",

            "dashboard_statistics":
                "ready",
        },
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
async def health_check():

    return {

        "status":
            "healthy",

        "backend":
            "online",

        "opencv":
            "ready",

        "yolo":
            "ready",

        "gemini":
            "ready",

        "database":
            "ready",

        "supabase":
            "ready",

        "cloud_storage":
            "ready",

        "cloudinary":
            "ready",

        "camera_api":
            "ready",

        "history_api":
            "ready",

        "stats_api":
            "ready",
    }