import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from supabase import Client, create_client


load_dotenv()


class SupabaseService:

    def __init__(self):

        self.url = os.getenv("SUPABASE_URL")
        self.secret_key = os.getenv("SUPABASE_SECRET_KEY")

        if not self.url:
            raise RuntimeError(
                "SUPABASE_URL is missing from the .env file."
            )

        if not self.secret_key:
            raise RuntimeError(
                "SUPABASE_SECRET_KEY is missing from the .env file."
            )

        self.client: Client = create_client(
            self.url,
            self.secret_key,
        )

    # ========================================================
    # SAVE SCAN
    # ========================================================

    def save_scan(self, scan_data: dict):

        response = (
            self.client
            .table("scan_history")
            .insert(scan_data)
            .execute()
        )

        if not response.data:
            raise RuntimeError(
                "Supabase did not return the inserted scan record."
            )

        return response.data[0]

    # ========================================================
    # GET SCAN HISTORY
    # ========================================================

    def get_scan_history(self, limit: int = 50):

        response = (
            self.client
            .table("scan_history")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        return response.data

    # ========================================================
    # GET ONE SCAN
    # ========================================================

    def get_scan_by_id(self, scan_id: str):

        response = (
            self.client
            .table("scan_history")
            .select("*")
            .eq("id", scan_id)
            .limit(1)
            .execute()
        )

        if not response.data:
            return None

        return response.data[0]

    # ========================================================
    # SEARCH HISTORY
    # ========================================================

    def search_scan_history(
        self,
        query: str,
        start_date=None,
        end_date=None,
        limit: int = 50,
    ):

        db_query = (
            self.client
            .table("scan_history")
            .select("*")
        )

        if start_date:

            db_query = db_query.gte(
                "created_at",
                start_date.isoformat(),
            )

        if end_date:

            db_query = db_query.lte(
                "created_at",
                end_date.isoformat(),
            )

        if query:

            db_query = db_query.ilike(
                "filename",
                f"%{query}%"
            )

        response = (
            db_query
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        return response.data

    # ========================================================
    # HISTORY BY DATE RANGE
    # ========================================================

    def get_history_by_date_range(
        self,
        start_date=None,
        end_date=None,
        limit: int = 100,
    ):

        query = (
            self.client
            .table("scan_history")
            .select("*")
        )

        if start_date:

            query = query.gte(
                "created_at",
                start_date.isoformat(),
            )

        if end_date:

            query = query.lte(
                "created_at",
                end_date.isoformat(),
            )

        response = (
            query
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        return response.data

    # ========================================================
    # DELETE SCAN
    # ========================================================

    def delete_scan(self, scan_id: str):

        response = (
            self.client
            .table("scan_history")
            .delete()
            .eq("id", scan_id)
            .execute()
        )

        return response.data

    # ========================================================
    # DASHBOARD STATISTICS
    # ========================================================

    def get_dashboard_stats(self):

        # ----------------------------------------------------
        # Fetch only fields required for statistics.
        # ----------------------------------------------------

        response = (
            self.client
            .table("scan_history")
            .select(
                "id,source,objects_detected,created_at"
            )
            .execute()
        )

        records = response.data or []

        total_scans = len(records)

        upload_scans = 0
        camera_scans = 0
        total_objects = 0

        today_scans = 0
        last_7_days = 0
        last_30_days = 0

        now = datetime.now(timezone.utc)

        today_start = now.replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

        seven_days_ago = (
            now - timedelta(days=7)
        )

        thirty_days_ago = (
            now - timedelta(days=30)
        )

        # ----------------------------------------------------
        # Calculate statistics
        # ----------------------------------------------------

        for record in records:

            source = (
                record.get("source")
                or ""
            ).lower()

            if source == "upload":
                upload_scans += 1

            elif source == "camera":
                camera_scans += 1

            try:

                total_objects += int(
                    record.get(
                        "objects_detected"
                    ) or 0
                )

            except (TypeError, ValueError):
                pass

            # ------------------------------------------------
            # Parse Supabase timestamp
            # ------------------------------------------------

            created_at = record.get(
                "created_at"
            )

            if not created_at:
                continue

            try:

                created_datetime = (
                    datetime.fromisoformat(
                        created_at.replace(
                            "Z",
                            "+00:00"
                        )
                    )
                )

                if (
                    created_datetime.tzinfo
                    is None
                ):

                    created_datetime = (
                        created_datetime.replace(
                            tzinfo=timezone.utc
                        )
                    )

                # --------------------------------------------
                # Today
                # --------------------------------------------

                if (
                    created_datetime
                    >= today_start
                ):

                    today_scans += 1

                # --------------------------------------------
                # Last 7 days
                # --------------------------------------------

                if (
                    created_datetime
                    >= seven_days_ago
                ):

                    last_7_days += 1

                # --------------------------------------------
                # Last 30 days
                # --------------------------------------------

                if (
                    created_datetime
                    >= thirty_days_ago
                ):

                    last_30_days += 1

            except (ValueError, TypeError):
                continue

        # ----------------------------------------------------
        # Average objects per scan
        # ----------------------------------------------------

        if total_scans > 0:

            average_objects = round(
                total_objects / total_scans,
                2,
            )

        else:

            average_objects = 0

        # ----------------------------------------------------
        # Return statistics
        # ----------------------------------------------------

        return {

            "total_scans":
                total_scans,

            "upload_scans":
                upload_scans,

            "camera_scans":
                camera_scans,

            "total_objects_detected":
                total_objects,

            "average_objects_per_scan":
                average_objects,

            "today_scans":
                today_scans,

            "last_7_days":
                last_7_days,

            "last_30_days":
                last_30_days,
        }


supabase_service = SupabaseService()