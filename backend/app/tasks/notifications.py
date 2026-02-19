"""Background tasks for proactive notifications (Celery-aware).

Provides:
- `send_pending_for_user_task` to flush queued pushes for a user
- `send_morning_briefing` scheduled daily to queue a morning briefing per user
- `periodic_checkin` scheduled to run a couple times per day to queue proactive check-ins

If Celery is not available, synchronous runner functions are provided.
"""
from datetime import datetime
import asyncio
import logging
from typing import Any

from app.db.redis_client import redis_client
from app.core.config import get_settings
from app.services.push_service import send_pending_for_user
from app.services.briefing_service import build_morning_briefing

logger = logging.getLogger(__name__)


# Try to reuse the existing Celery app from fact_extraction if available
try:
    from app.tasks.fact_extraction import celery_app, CELERY_AVAILABLE
except Exception:
    celery_app = None
    CELERY_AVAILABLE = False


async def _queue_message_for_user(user_id: str, title: str, body: str) -> None:
    await redis_client.connect()
    # Respect daily limit
    settings = get_settings()
    today_key = datetime.utcnow().strftime('%Y-%m-%d')
    counter_key = f"push_count:{user_id}:{today_key}"
    count = await redis_client.client.get(counter_key) or 0
    try:
        count = int(count)
    except Exception:
        count = 0

    if count >= settings.max_proactive_notifications_per_day:
        logger.info("Skipping push for %s: daily limit reached", user_id)
        return

    pending_key = f"pending_push:{user_id}"
    message = {"title": title, "body": body}
    await redis_client.client.rpush(pending_key, str(message))
    await redis_client.client.expire(pending_key, 60 * 60 * 24)
    await redis_client.client.incr(counter_key)
    await redis_client.client.expire(counter_key, 60 * 60 * 24)


async def _gather_all_user_ids() -> list[str]:
    await redis_client.connect()
    keys = await redis_client.client.keys('push_tokens:*')
    user_ids = [k.split(':', 1)[1] for k in keys]
    return user_ids


def run_send_pending_for_user(user_id: str) -> Any:
    return asyncio.run(send_pending_for_user(user_id))


def run_send_morning_briefing() -> Any:
    async def _run():
        users = await _gather_all_user_ids()
        for u in users:
            # Build LLM-based morning briefing and queue it
            brief = await build_morning_briefing(u)
            title = brief.get('title')
            body = brief.get('body')
            await _queue_message_for_user(u, title, body)
        return {"queued_for": len(users)}

    return asyncio.run(_run())


def run_periodic_checkin() -> Any:
    async def _run():
        users = await _gather_all_user_ids()
        for u in users:
            title = "Quick check-in from JARVIS"
            body = "You mentioned finishing X last week — update?"
            await _queue_message_for_user(u, title, body)
        return {"queued_for": len(users)}

    return asyncio.run(_run())


if CELERY_AVAILABLE and celery_app is not None:
    try:
        from celery.schedules import crontab

        @celery_app.task(name='jarvis.send_pending_for_user')
        def send_pending_for_user_task(user_id: str):
            try:
                return run_send_pending_for_user(user_id)
            except Exception as e:
                logger.exception('send_pending_for_user_task failed: %s', e)
                return {'status': 'error', 'error': str(e)}


        @celery_app.task(name='jarvis.send_morning_briefing')
        def send_morning_briefing():
            try:
                return run_send_morning_briefing()
            except Exception as e:
                logger.exception('send_morning_briefing failed: %s', e)
                return {'status': 'error', 'error': str(e)}


        @celery_app.task(name='jarvis.periodic_checkin')
        def periodic_checkin():
            try:
                return run_periodic_checkin()
            except Exception as e:
                logger.exception('periodic_checkin failed: %s', e)
                return {'status': 'error', 'error': str(e)}


        # Configure beat schedule: morning briefing at 08:00 UTC, checkins at 11:00 and 16:00 UTC
        celery_app.conf.beat_schedule = {
            'morning-briefing-everyday': {
                'task': 'jarvis.send_morning_briefing',
                'schedule': crontab(hour=8, minute=0),
            },
            'periodic-checkin-1100': {
                'task': 'jarvis.periodic_checkin',
                'schedule': crontab(hour=11, minute=0),
            },
            'periodic-checkin-1600': {
                'task': 'jarvis.periodic_checkin',
                'schedule': crontab(hour=16, minute=0),
            },
        }

    except Exception:
        logger.exception('Failed to register Celery notification tasks')


__all__ = [
    'run_send_pending_for_user',
    'run_send_morning_briefing',
    'run_periodic_checkin',
]
