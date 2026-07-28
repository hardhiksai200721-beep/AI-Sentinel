from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from backend.services.supabase_service import supabase_service
from backend.services.cloudinary_service import cloudinary_service


router = APIRouter(
    prefix="/api",
    tags=["Scan History"],
)


# ============================================================
# UUID VALIDATION
# ============================================================

def validate_scan_id(scan_id: str) -> str:
    """
    Validate that scan_id is a proper UUID.

    This prevents values such as:
        scan_ec777cacad784d9cb2b9176a56214c55

    from being sent to a PostgreSQL UUID column.
    """

    try:
        return str(UUID(scan_id))

    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid scan ID. The scan_id must be a valid UUID. "
                "Use the 'id' field from the scan history, not the "
                "Cloudinary public_id."
            ),
        )


# ============================================================
# GET ALL SCAN HISTORY
# ============================================================

@router.get("/history")
def get_history(
    limit: int = Query(default=50, ge=1, le=100)
):

    try:

        records = supabase_service.get_scan_history(
            limit
        )

        return {
            "status": "success",
            "count": len(records),
            "history": records,
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to retrieve scan history: "
                f"{str(error)}"
            ),
        )


# ============================================================
# SEARCH + TIME FILTER SCAN HISTORY
# ============================================================

@router.get("/history/search")
async def search_history(
    q: str = Query(default=""),
    period: str = Query(default="all"),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
):

    now = datetime.now(timezone.utc)

    filter_start = None
    filter_end = None

    # ========================================================
    # CUSTOM DATE RANGE
    # ========================================================

    if period == "custom":

        if not start_date or not end_date:

            raise HTTPException(
                status_code=400,
                detail=(
                    "start_date and end_date are required "
                    "when period='custom'. Use YYYY-MM-DD."
                ),
            )

        try:

            filter_start = datetime.strptime(
                start_date,
                "%Y-%m-%d",
            ).replace(
                tzinfo=timezone.utc
            )

            # Include the entire end date.
            filter_end = (
                datetime.strptime(
                    end_date,
                    "%Y-%m-%d",
                ).replace(
                    tzinfo=timezone.utc
                )
                + timedelta(days=1)
                - timedelta(microseconds=1)
            )

        except ValueError:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid date format. "
                    "Use YYYY-MM-DD."
                ),
            )

        if filter_start > filter_end:

            raise HTTPException(
                status_code=400,
                detail=(
                    "start_date cannot be later "
                    "than end_date."
                ),
            )

    # ========================================================
    # TODAY
    # ========================================================

    elif period == "today":

        filter_start = now.replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

        filter_end = now

    # ========================================================
    # LAST 7 DAYS
    # ========================================================

    elif period == "7d":

        filter_start = now - timedelta(days=7)
        filter_end = now

    # ========================================================
    # LAST 30 DAYS
    # ========================================================

    elif period == "30d":

        filter_start = now - timedelta(days=30)
        filter_end = now

    # ========================================================
    # LAST 3 MONTHS
    # ========================================================

    elif period == "3m":

        filter_start = now - timedelta(days=90)
        filter_end = now

    # ========================================================
    # LAST 6 MONTHS
    # ========================================================

    elif period == "6m":

        filter_start = now - timedelta(days=180)
        filter_end = now

    # ========================================================
    # LAST 1 YEAR
    # ========================================================

    elif period == "1y":

        filter_start = now - timedelta(days=365)
        filter_end = now

    # ========================================================
    # ALL TIME
    # ========================================================

    elif period == "all":

        filter_start = None
        filter_end = None

    # ========================================================
    # INVALID PERIOD
    # ========================================================

    else:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid period. Use: "
                "today, 7d, 30d, 3m, 6m, "
                "1y, all, custom"
            ),
        )

    # ========================================================
    # GET RECORDS FROM SUPABASE
    # ========================================================

    try:

        records = (
            supabase_service
            .get_history_by_date_range(
                start_date=filter_start,
                end_date=filter_end,
                limit=limit,
            )
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "History search failed: "
                f"{str(error)}"
            ),
        )

    # ========================================================
    # SEARCH AI + YOLO DATA
    # ========================================================

    search_term = q.strip().lower()

    if search_term:

        filtered_records = []

        for record in records:

            searchable_parts = []

            # Filename
            searchable_parts.append(
                str(record.get("filename", ""))
            )

            # Source
            searchable_parts.append(
                str(record.get("source", ""))
            )

            # ------------------------------------------------
            # YOLO OBJECTS
            # ------------------------------------------------

            for obj in (
                record.get("yolo_objects") or []
            ):

                searchable_parts.append(
                    str(obj.get("name", ""))
                )

            # ------------------------------------------------
            # GEMINI ANALYSIS
            # ------------------------------------------------

            for item in (
                record.get("gemini_analysis") or []
            ):

                searchable_parts.extend([
                    str(item.get("category", "")),
                    str(item.get("brand", "")),
                    str(item.get("model", "")),
                    str(
                        item.get(
                            "product_family",
                            "",
                        )
                    ),
                    str(item.get("description", "")),
                    str(
                        item.get(
                            "visual_evidence",
                            "",
                        )
                    ),
                    str(item.get("confidence", "")),
                    str(
                        item.get(
                            "identification_confidence",
                            "",
                        )
                    ),
                ])

                # --------------------------------------------
                # VISIBLE TEXT
                # --------------------------------------------

                visible_text = item.get(
                    "visible_text",
                    []
                )

                if isinstance(
                    visible_text,
                    list
                ):

                    searchable_parts.extend(
                        str(text)
                        for text in visible_text
                    )

                else:

                    searchable_parts.append(
                        str(visible_text)
                    )

                # --------------------------------------------
                # ALTERNATIVE MATCHES
                # --------------------------------------------

                alternatives = item.get(
                    "alternative_matches",
                    []
                )

                if isinstance(
                    alternatives,
                    list
                ):

                    searchable_parts.extend(
                        str(value)
                        for value in alternatives
                    )

                else:

                    searchable_parts.append(
                        str(alternatives)
                    )

            # ------------------------------------------------
            # COMBINE SEARCHABLE DATA
            # ------------------------------------------------

            searchable_text = " ".join(
                searchable_parts
            ).lower()

            if search_term in searchable_text:

                filtered_records.append(
                    record
                )

        records = filtered_records

    # ========================================================
    # RETURN SEARCH RESULTS
    # ========================================================

    return {

        "status": "success",

        "filters": {
            "query": q,
            "period": period,
            "start_date": start_date,
            "end_date": end_date,
            "limit": limit,
        },

        "count": len(records),

        "history": records,
    }


# ============================================================
# GET ONE SCAN BY ID
# ============================================================

@router.get("/history/{scan_id}")
def get_history_item(scan_id: str):

    # --------------------------------------------------------
    # VALIDATE UUID
    # --------------------------------------------------------

    valid_scan_id = validate_scan_id(
        scan_id
    )

    try:

        record = supabase_service.get_scan_by_id(
            valid_scan_id
        )

        if record is None:

            raise HTTPException(
                status_code=404,
                detail="Scan record not found.",
            )

        return {
            "status": "success",
            "scan": record,
        }

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to retrieve scan: "
                f"{str(error)}"
            ),
        )


# ============================================================
# DELETE ONE SCAN
# ============================================================

@router.delete("/history/{scan_id}")
def delete_history_item(scan_id: str):

    # --------------------------------------------------------
    # 1. VALIDATE UUID
    # --------------------------------------------------------

    valid_scan_id = validate_scan_id(
        scan_id
    )

    # --------------------------------------------------------
    # 2. FIND SCAN
    # --------------------------------------------------------

    try:

        record = supabase_service.get_scan_by_id(
            valid_scan_id
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to find scan: "
                f"{str(error)}"
            ),
        )

    if record is None:

        raise HTTPException(
            status_code=404,
            detail="Scan record not found.",
        )

    # --------------------------------------------------------
    # 3. GET CLOUDINARY PUBLIC ID
    # --------------------------------------------------------

    cloudinary_public_id = record.get(
        "cloudinary_public_id"
    )

    cloudinary_delete_result = None

    # --------------------------------------------------------
    # 4. DELETE CLOUDINARY IMAGE
    # --------------------------------------------------------

    if cloudinary_public_id:

        try:

            cloudinary_delete_result = (
                cloudinary_service.delete_image(
                    cloudinary_public_id
                )
            )

        except Exception as error:

            raise HTTPException(
                status_code=500,
                detail=(
                    "Cloudinary image deletion "
                    "failed: "
                    f"{str(error)}"
                ),
            )

    # --------------------------------------------------------
    # 5. DELETE SUPABASE RECORD
    # --------------------------------------------------------

    try:

        deleted_record = (
            supabase_service.delete_scan(
                valid_scan_id
            )
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Supabase record deletion "
                "failed: "
                f"{str(error)}"
            ),
        )

    if deleted_record is None:

        raise HTTPException(
            status_code=500,
            detail=(
                "The Cloudinary image may have "
                "been deleted, but the Supabase "
                "record was not deleted."
            ),
        )

    # --------------------------------------------------------
    # 6. RETURN SUCCESS
    # --------------------------------------------------------

    return {

        "status": "success",

        "message":
            "Scan deleted successfully.",

        "deleted_scan": {
            "id":
                deleted_record.get("id"),

            "filename":
                deleted_record.get("filename"),
        },

        "cloudinary": {
            "public_id":
                cloudinary_public_id,

            "result": (
                cloudinary_delete_result.get(
                    "result"
                )
                if cloudinary_delete_result
                else "no_image"
            ),
        },

        "database": {
            "deleted": True,
        },
    }