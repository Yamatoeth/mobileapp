"""
Script to populate JARVIS Knowledge Base from me.json

Usage:
    python scripts/seed_knowledge.py

Requirements:
    - Backend must be running
    - Set API_BASE_URL if not localhost:8000
"""
import json
import os
import httpx
import asyncio

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")


def load_profile(filepath: str = "me.json") -> dict:
    """Load the user profile JSON file."""
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def flatten_profile(profile: dict) -> list[dict]:
    """Convert nested profile into flat KB entries."""
    user_id = "local-user"  # TODO: make configurable
    
    entries = []
    
    # === IDENTITY ===
    identity = profile.get("identity", {})
    entries.append({"user_id": user_id, "domain": "identity", "field_name": "full_name", "field_value": identity.get("full_name", ""), "confidence": 1.0, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "identity", "field_name": "age", "field_value": str(identity.get("age", "")), "confidence": 1.0, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "identity", "field_name": "gender", "field_value": identity.get("gender", ""), "confidence": 1.0, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "identity", "field_name": "nationality", "field_value": identity.get("nationality", ""), "confidence": 1.0, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "identity", "field_name": "languages", "field_value": " | ".join(identity.get("languages", [])), "confidence": 1.0, "source": "profile_seed"})
    
    location = identity.get("location", {})
    entries.append({"user_id": user_id, "domain": "identity", "field_name": "city", "field_value": location.get("city", ""), "confidence": 1.0, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "identity", "field_name": "country", "field_value": location.get("country", ""), "confidence": 1.0, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "identity", "field_name": "timezone", "field_value": location.get("timezone", ""), "confidence": 1.0, "source": "profile_seed"})
    
    entries.append({"user_id": user_id, "domain": "identity", "field_name": "personality", "field_value": " | ".join(identity.get("personality", [])), "confidence": 1.0, "source": "profile_seed"})
    
    # === PRESENT / JOB ===
    present = profile.get("present", {})
    job = present.get("job", {})
    entries.append({"user_id": user_id, "domain": "projects", "field_name": "job_title", "field_value": job.get("title", ""), "confidence": 1.0, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "projects", "field_name": "years_experience", "field_value": str(job.get("years_experience", "")), "confidence": 1.0, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "projects", "field_name": "working_hours", "field_value": job.get("working_hours", ""), "confidence": 1.0, "source": "profile_seed"})
    
    daily = present.get("daily_routine", {})
    entries.append({"user_id": user_id, "domain": "patterns", "field_name": "wake_up", "field_value": daily.get("wake_up", ""), "confidence": 0.8, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "patterns", "field_name": "sleep_goal", "field_value": daily.get("sleep", ""), "confidence": 0.8, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "patterns", "field_name": "exercise", "field_value": daily.get("exercise", ""), "confidence": 0.8, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "patterns", "field_name": "diet", "field_value": daily.get("diet", ""), "confidence": 0.8, "source": "profile_seed"})
    
    # === FINANCE ===
    finance = profile.get("finance", {})
    entries.append({"user_id": user_id, "domain": "finances", "field_name": "financial_situation", "field_value": finance.get("financial_situation", ""), "confidence": 1.0, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "finances", "field_name": "financial_goals", "field_value": " | ".join(finance.get("financial_goals", [])), "confidence": 1.0, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "finances", "field_name": "debts", "field_value": finance.get("debts", ""), "confidence": 1.0, "source": "profile_seed"})
    entries.append({"user_id": user_id, "domain": "finances", "field_name": "financial_mindset", "field_value": finance.get("financial_mindset", ""), "confidence": 1.0, "source": "profile_seed"})
    
    # === GOALS ===
    goals = profile.get("goals", {})
    for i, goal in enumerate(goals.get("short_term", [])):
        entries.append({"user_id": user_id, "domain": "goals", "field_name": f"short_term_{i+1}", "field_value": goal, "confidence": 1.0, "source": "profile_seed"})
    for i, goal in enumerate(goals.get("mid_term", [])):
        entries.append({"user_id": user_id, "domain": "goals", "field_name": f"mid_term_{i+1}", "field_value": goal, "confidence": 1.0, "source": "profile_seed"})
    for i, goal in enumerate(goals.get("long_term", [])):
        entries.append({"user_id": user_id, "domain": "goals", "field_name": f"long_term_{i+1}", "field_value": goal, "confidence": 1.0, "source": "profile_seed"})
    
    if goals.get("life_mission"):
        entries.append({"user_id": user_id, "domain": "goals", "field_name": "life_mission", "field_value": goals.get("life_mission", ""), "confidence": 1.0, "source": "profile_seed"})
    
    # === RELATIONSHIPS ===
    rels = profile.get("relationships", {})
    if rels.get("important_people"):
        entries.append({"user_id": user_id, "domain": "relationships", "field_name": "important_people", "field_value": " | ".join(rels.get("important_people", [])), "confidence": 1.0, "source": "profile_seed"})
    
    # === PREFERENCES ===
    prefs = profile.get("preferences", {})
    if prefs.get("hobbies"):
        entries.append({"user_id": user_id, "domain": "patterns", "field_name": "hobbies", "field_value": " | ".join(prefs.get("hobbies", [])), "confidence": 1.0, "source": "profile_seed"})
    if prefs.get("communication_style"):
        entries.append({"user_id": user_id, "domain": "patterns", "field_name": "communication_style", "field_value": prefs.get("communication_style", ""), "confidence": 1.0, "source": "profile_seed"})
    
    # === SKILLS ===
    skills = profile.get("skills", {})
    if skills.get("technical"):
        entries.append({"user_id": user_id, "domain": "projects", "field_name": "technical_skills", "field_value": " | ".join(skills.get("technical", [])), "confidence": 1.0, "source": "profile_seed"})
    if skills.get("professional"):
        entries.append({"user_id": user_id, "domain": "projects", "field_name": "professional_skills", "field_value": " | ".join(skills.get("professional", [])), "confidence": 1.0, "source": "profile_seed"})
    
    # Filter out empty values
    return [e for e in entries if e["field_value"]]


async def seed_knowledge_base(entries: list[dict]):
    """Send KB entries to the backend API."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        success_count = 0
        error_count = 0
        
        for entry in entries:
            try:
                # Use the Redis-backed KB endpoint (POST /api/v1/kb)
                response = await client.post(
                    f"{API_BASE_URL}/api/v1/kb",
                    json=entry
                )
                if response.status_code in (200, 201):
                    print(f"✓ {entry['domain']}.{entry['field_name']}")
                    success_count += 1
                else:
                    print(f"✗ {entry['domain']}.{entry['field_name']}: {response.status_code} - {response.text[:100]}")
                    error_count += 1
            except Exception as e:
                print(f"✗ {entry['domain']}.{entry['field_name']}: {e}")
                error_count += 1
        
        print(f"\n=== Summary ===")
        print(f"Success: {success_count}")
        print(f"Errors: {error_count}")
        return success_count, error_count


async def main():
    print("Loading profile from me.json...")
    profile = load_profile()
    
    print("Flattening profile into KB entries...")
    entries = flatten_profile(profile)
    print(f"Generated {len(entries)} entries\n")
    
    print("Seeding knowledge base...")
    await seed_knowledge_base(entries)


if __name__ == "__main__":
    asyncio.run(main())