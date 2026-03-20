import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from core.config import settings
from core.database import db_manager
from models.tools import Tools
from sqlalchemy import Date, DateTime, MetaData, Table, func, select
from sqlalchemy.exc import NoSuchTableError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

MOCK_DATA_DIR = Path(__file__).resolve().parent.parent / "mock_data"
MAX_CONCURRENT_LOADS = 5


async def initialize_mock_data():
    """Populate tables with mock JSON data when they are empty."""
    if "MGX_IGNORE_INIT_DATA" in os.environ:
        logger.info("Ignore initialize data")
        return
    if not db_manager.engine:
        logger.warning("Database engine is not ready; skipping mock data initialization")
        return

    if not MOCK_DATA_DIR.exists():
        logger.info("mock_data directory not found, skipping mock initialization")
        return

    data_files = sorted(MOCK_DATA_DIR.glob("*.json"))
    if not data_files:
        logger.info("No mock JSON files detected; skipping mock initialization")
        return

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_LOADS)

    async def load_file(data_file: Path):
        async with semaphore:
            try:
                await _load_table_from_file(data_file)
            except Exception as exc:  # pragma: no cover - defensive
                logger.error("Unexpected error loading %s: %s", data_file.name, exc)

    await asyncio.gather(*(load_file(data_file) for data_file in data_files))


def _prepare_records(raw_data: Any, table: Table) -> list[dict[str, Any]]:
    """Filter JSON payload to match the table definition and coerce values."""
    if isinstance(raw_data, dict):
        records_iterable: Iterable[dict[str, Any]] = [raw_data]
    elif isinstance(raw_data, list):
        records_iterable = [item for item in raw_data if isinstance(item, dict)]
    else:
        return []

    column_map = {column.name: column for column in table.columns}
    prepared: list[dict[str, Any]] = []

    for entry in records_iterable:
        filtered = {}
        for key, value in entry.items():
            if key not in column_map:
                continue
            column = column_map[key]
            typed_value = _coerce_temporal_value(value, column)
            filtered[key] = _coerce_value(typed_value, column)
        if filtered:
            prepared.append(filtered)

    return prepared


def _coerce_temporal_value(value: Any, column) -> Any:
    """Convert ISO-like strings to Date/DateTime objects when needed."""
    if value is None or not isinstance(value, str):
        return value

    column_type = column.type
    if isinstance(column_type, Date):
        try:
            return datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            return value

    if isinstance(column_type, DateTime):
        val_wo_z = value.replace("Z", "+00:00")
        for parser in (lambda v: datetime.fromisoformat(v), lambda v: datetime.strptime(v, "%Y-%m-%d %H:%M:%S")):
            try:
                return parser(val_wo_z)
            except ValueError:
                continue
        return value

    return value


def _coerce_value(value: Any, column) -> Any:
    """Coerce nested structures to JSON strings when the column is not JSON."""
    if value is None:
        return None

    if isinstance(value, (dict, list)):
        visit_name = getattr(column.type, "__visit_name__", "").lower()
        if "json" in visit_name:
            return value
        return json.dumps(value, ensure_ascii=False)

    return value


async def _reflect_table(conn, table_name: str) -> Table:
    """Reflect a table definition inside a synchronous context."""

    def _reflect(sync_conn):
        metadata = MetaData()
        return Table(table_name, metadata, autoload_with=sync_conn)

    return await conn.run_sync(_reflect)


async def _load_table_from_file(data_file: Path):
    table_name = data_file.stem
    logger.info("Processing mock data file %s for table %s", data_file.name, table_name)

    async with db_manager.engine.begin() as conn:
        try:
            table = await _reflect_table(conn, table_name)
        except NoSuchTableError:
            logger.warning("Table %s does not exist; skipping %s", table_name, data_file.name)
            return
        except SQLAlchemyError as exc:
            logger.error("Failed to reflect table %s: %s", table_name, exc)
            return

        row_count = await conn.scalar(select(func.count()).select_from(table))
        if row_count and row_count > 0:
            logger.info("Table %s already has %d rows; skipping mock insert", table_name, row_count)
            return

        try:
            raw_records = json.loads(data_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            logger.error("Invalid JSON in %s: %s", data_file.name, exc)
            return

        records = _prepare_records(raw_records, table)
        if not records:
            logger.warning("No valid records found in %s after preparing data", data_file.name)
            return

        try:
            await conn.execute(table.insert(), records)
            logger.info("Inserted %d mock records into %s", len(records), table_name)
        except SQLAlchemyError as exc:
            logger.error("Failed to insert mock data into %s: %s", table_name, exc)


REQUIRED_TOOL_FIELDS = {
    "name",
    "slug",
    "category",
    "pricing_model",
    "short_description",
    "website_url",
    "internal_score",
    "beginner_friendly",
    "popularity_score",
}


def _sanitize_tool_record(raw: dict[str, Any], allowed_columns: set[str]) -> dict[str, Any] | None:
    """Sanitize and validate one tools.json row for DB upsert."""
    if not isinstance(raw, dict):
        return None

    missing = [k for k in REQUIRED_TOOL_FIELDS if not raw.get(k)]
    if missing:
        return None

    record = {k: v for k, v in raw.items() if k in allowed_columns and k != "id"}
    if not record.get("active"):
        record["active"] = True
    return record


def _resolve_database_target_for_sync(db: AsyncSession) -> str:
    """Resolve active DB target and hard-fail if admin sync is pointed to sqlite."""
    raw_database_url = os.environ.get("DATABASE_URL")
    if not raw_database_url:
        raise RuntimeError("Live database not configured")

    if raw_database_url.lower().startswith("sqlite") or "stackely.db" in raw_database_url.lower():
        raise RuntimeError("Live database not configured")

    bind = db.get_bind()
    target = str(getattr(bind, "url", raw_database_url))
    lower_target = target.lower()

    if lower_target.startswith("sqlite") or "stackely.db" in lower_target:
        raise RuntimeError("Live database not configured")

    return target


async def sync_tools_catalog_from_mock_data(
    db: AsyncSession,
    data_file: Path | None = None,
) -> dict[str, Any]:
    """Upsert tools catalog from mock_data/tools.json into the live DB tools table.

    This is designed for authenticated admin-triggered synchronization.
    """
    path = data_file or (MOCK_DATA_DIR / "tools.json")
    if not path.exists():
        raise FileNotFoundError(f"Tools dataset not found: {path}")

    raw_data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw_data, list):
        raise ValueError("tools.json must be a JSON array")

    current_database_target = _resolve_database_target_for_sync(db)

    allowed_columns = {col.name for col in Tools.__table__.columns}

    # Dedupe and validate incoming rows.
    seen_slugs: set[str] = set()
    seen_names: set[str] = set()
    cleaned: list[dict[str, Any]] = []
    skipped_invalid = 0
    skipped_duplicates = 0

    for row in raw_data:
        record = _sanitize_tool_record(row, allowed_columns)
        if record is None:
            skipped_invalid += 1
            continue

        slug_key = str(record.get("slug", "")).strip().lower()
        name_key = str(record.get("name", "")).strip().lower()
        if not slug_key or not name_key:
            skipped_invalid += 1
            continue

        if slug_key in seen_slugs or name_key in seen_names:
            skipped_duplicates += 1
            continue

        seen_slugs.add(slug_key)
        seen_names.add(name_key)
        cleaned.append(record)

    if not cleaned:
        skipped_total = skipped_invalid + skipped_duplicates
        return {
            "current_database_target": current_database_target,
            "source_total": len(raw_data),
            "prepared_total": 0,
            "inserted": 0,
            "updated": 0,
            "skipped": skipped_total,
            "skipped_invalid": skipped_invalid,
            "skipped_duplicates": skipped_duplicates,
            "active_total": 0,
            "active_total_after": 0,
            "category_distribution": {},
        }

    slugs = [str(item["slug"]).strip() for item in cleaned]
    existing_rows = await db.execute(select(Tools).where(Tools.slug.in_(slugs)))
    existing_by_slug = {str(t.slug).strip().lower(): t for t in existing_rows.scalars().all()}

    inserted = 0
    updated = 0

    for record in cleaned:
        slug_key = str(record["slug"]).strip().lower()
        existing = existing_by_slug.get(slug_key)
        if existing:
            for key, value in record.items():
                setattr(existing, key, value)
            updated += 1
        else:
            db.add(Tools(**record))
            inserted += 1

    await db.commit()

    # Debug/verification counters required by task.
    total_active = await db.scalar(select(func.count()).select_from(Tools).where(Tools.active.is_(True)))
    category_rows = await db.execute(
        select(Tools.category, func.count().label("count"))
        .where(Tools.active.is_(True))
        .group_by(Tools.category)
    )
    category_distribution = {str(row.category): int(row.count) for row in category_rows}

    duplicate_slug_rows = await db.execute(
        select(Tools.slug)
        .group_by(Tools.slug)
        .having(func.count() > 1)
    )
    duplicate_name_rows = await db.execute(
        select(func.lower(Tools.name).label("name_key"))
        .group_by(func.lower(Tools.name))
        .having(func.count() > 1)
    )
    duplicate_slug_groups = len(duplicate_slug_rows.scalars().all())
    duplicate_name_groups = len(duplicate_name_rows.scalars().all())
    skipped_total = skipped_invalid + skipped_duplicates

    return {
        "current_database_target": current_database_target,
        "source_total": len(raw_data),
        "prepared_total": len(cleaned),
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped_total,
        "skipped_invalid": skipped_invalid,
        "skipped_duplicates": skipped_duplicates,
        "active_total": int(total_active or 0),
        "active_total_after": int(total_active or 0),
        "duplicate_slug_groups": duplicate_slug_groups,
        "duplicate_name_groups": duplicate_name_groups,
        "category_distribution": dict(sorted(category_distribution.items())),
    }
