from app.core.config import Settings


def test_settings_accept_release_debug_value():
    settings = Settings(debug="release")
    assert settings.debug is False


def test_settings_parse_cors_origins():
    settings = Settings(cors_allowed_origins="http://localhost:8081,http://localhost:19006")
    assert settings.cors_allowed_origins == [
        "http://localhost:8081",
        "http://localhost:19006",
    ]
