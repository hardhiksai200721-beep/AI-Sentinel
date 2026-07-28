from fastapi import APIRouter, HTTPException

from backend.services.supabase_service import supabase_service


router = APIRouter(
    prefix="/api",
    tags=["Dashboard"],
)


# ============================================================
# DASHBOARD STATISTICS
# ============================================================

@router.get("/stats")
def get_dashboard_stats():

    try:

        stats = (
            supabase_service
            .get_dashboard_stats()
        )

        return {
            "status": "success",
            "stats": stats,
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to retrieve "
                f"dashboard statistics: {str(error)}"
            ),
        )