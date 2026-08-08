from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "local-development-key")
DEBUG = os.getenv("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = [x.strip() for x in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if x.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "scanner",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

if os.getenv("DB_HOST"):
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "coin_spot"),
        "USER": os.getenv("POSTGRES_USER", "coin_spot"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "coin_spot_dev_password"),
        "HOST": os.getenv("DB_HOST", "postgres"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }}
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

AUTH_PASSWORD_VALIDATORS = []
LANGUAGE_CODE = "vi"
TIME_ZONE = os.getenv("TIME_ZONE", "Asia/Bangkok")
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = [x.strip() for x in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

CELERY_BROKER_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 900
CELERY_TASK_SOFT_TIME_LIMIT = 840
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "false").lower() == "true"
CELERY_BEAT_SCHEDULE = {
    "dispatch-due-schedules-every-minute": {
        "task": "scanner.tasks.dispatch_due_schedules",
        "schedule": 60.0,
    },
    "refresh-public-unlock-evidence-every-six-hours": {
        "task": "scanner.tasks.refresh_unlock_web_evidence",
        "schedule": 21600.0,
        "options": {"queue": "crawl"},
    },
}

COINGECKO_BASE_URL = os.getenv("COINGECKO_BASE_URL", "https://api.coingecko.com/api/v3")
BINANCE_BASE_URL = os.getenv("BINANCE_BASE_URL", "https://api.binance.com")  # legacy compatibility
BINANCE_MARKET_DATA_BASE_URLS = [x.strip().rstrip("/") for x in os.getenv("BINANCE_MARKET_DATA_BASE_URLS", "https://data-api.binance.vision,https://api.binance.com,https://api-gcp.binance.com").split(",") if x.strip()]
COINPAPRIKA_BASE_URL = os.getenv("COINPAPRIKA_BASE_URL", "https://api.coinpaprika.com/v1")
DEFILLAMA_BASE_URL = os.getenv("DEFILLAMA_BASE_URL", "https://api.llama.fi").rstrip("/")
RESEARCH_DEFILLAMA_ENABLED = os.getenv("RESEARCH_DEFILLAMA_ENABLED", "true").lower() == "true"
CMC_BASE_URL = os.getenv("CMC_BASE_URL", "https://pro-api.coinmarketcap.com")
CMC_API_KEY = os.getenv("CMC_API_KEY", "")
CMC_HISTORICAL_ENABLED = os.getenv("CMC_HISTORICAL_ENABLED", "true").lower() == "true"
HTTP_TIMEOUT_SECONDS = float(os.getenv("HTTP_TIMEOUT_SECONDS", "25"))
HTTP_MAX_RETRIES = int(os.getenv("HTTP_MAX_RETRIES", "3"))
HTTP_MAX_RETRY_DELAY_SECONDS = float(os.getenv("HTTP_MAX_RETRY_DELAY_SECONDS", "5"))
USER_AGENT = os.getenv("USER_AGENT", "CoinSpotScannerV8.1-Educational/0.1")
