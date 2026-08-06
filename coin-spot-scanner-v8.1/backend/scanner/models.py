import uuid
from django.db import models
from django.utils import timezone

class ChecklistProfile(models.Model):
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True)
    version = models.PositiveIntegerField(default=1)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=False)
    config = models.JSONField(default=dict)
    checksum = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_active", "-updated_at"]

    def __str__(self):
        return self.name

class StepSchedule(models.Model):
    POLICY_ALWAYS = "ALWAYS_REFRESH"
    POLICY_STALE = "REFRESH_IF_STALE"
    POLICY_LATEST = "USE_LATEST_VALID"
    POLICY_CHOICES = [
        (POLICY_ALWAYS, "Luôn lấy dữ liệu mới"),
        (POLICY_STALE, "Chỉ lấy lại nếu dữ liệu cũ"),
        (POLICY_LATEST, "Dùng dữ liệu hợp lệ gần nhất"),
    ]
    profile = models.ForeignKey(ChecklistProfile, on_delete=models.CASCADE, related_name="step_schedules")
    step_key = models.CharField(max_length=40)
    sequence = models.PositiveSmallIntegerField()
    auto_enabled = models.BooleanField(default=False)
    interval_minutes = models.PositiveIntegerField(default=240)
    total_scan_policy = models.CharField(max_length=32, choices=POLICY_CHOICES, default=POLICY_STALE)
    notify_on_complete = models.BooleanField(default=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("profile", "step_key")]
        ordering = ["sequence"]

class ScanRun(models.Model):
    STATUS_QUEUED = "QUEUED"
    STATUS_RUNNING = "RUNNING"
    STATUS_PAUSED = "PAUSED"
    STATUS_COMPLETED = "COMPLETED"
    STATUS_WARNINGS = "COMPLETED_WITH_WARNINGS"
    STATUS_FAILED = "FAILED"
    STATUS_CANCELLED = "CANCELLED"
    STATUS_CHOICES = [(x, x) for x in [STATUS_QUEUED, STATUS_RUNNING, STATUS_PAUSED, STATUS_COMPLETED, STATUS_WARNINGS, STATUS_FAILED, STATUS_CANCELLED]]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(ChecklistProfile, on_delete=models.PROTECT, related_name="scan_runs")
    profile_snapshot = models.JSONField(default=dict)
    requested_steps = models.JSONField(default=list)
    mode_requested = models.CharField(max_length=40, default="FULL_SCAN_EXECUTION")
    mode_validated = models.CharField(max_length=40, default="FULL_SCAN_RESEARCH")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_QUEUED)
    current_step = models.CharField(max_length=40, blank=True)
    progress = models.PositiveSmallIntegerField(default=0)
    counters = models.JSONField(default=dict)
    results = models.JSONField(default=dict)
    validation = models.JSONField(default=dict)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

class ScanStepRun(models.Model):
    STATUS_WAITING = "WAITING"
    STATUS_RUNNING = "RUNNING"
    STATUS_COMPLETED = "COMPLETED"
    STATUS_WARNINGS = "COMPLETED_WITH_WARNINGS"
    STATUS_FAILED = "FAILED"
    STATUS_STALE = "STALE"
    STATUS_SKIPPED = "SKIPPED"

    scan_run = models.ForeignKey(ScanRun, on_delete=models.CASCADE, related_name="steps")
    step_key = models.CharField(max_length=40)
    sequence = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=32, default=STATUS_WAITING)
    progress = models.PositiveSmallIntegerField(default=0)
    message = models.CharField(max_length=300, blank=True)
    policy = models.CharField(max_length=32, blank=True)
    payload = models.JSONField(default=dict)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("scan_run", "step_key")]
        ordering = ["sequence"]

class Candidate(models.Model):
    scan_run = models.ForeignKey(ScanRun, on_delete=models.CASCADE, related_name="candidates")
    coingecko_id = models.CharField(max_length=160, blank=True)
    symbol = models.CharField(max_length=30)
    name = models.CharField(max_length=160)
    binance_pair = models.CharField(max_length=40, blank=True)
    stage = models.CharField(max_length=40, default="UNIVERSE")
    rank = models.PositiveIntegerField(default=0)
    market_cap_usd = models.DecimalField(max_digits=28, decimal_places=4, null=True, blank=True)
    fdv_usd = models.DecimalField(max_digits=28, decimal_places=4, null=True, blank=True)
    volume_24h_usd = models.DecimalField(max_digits=28, decimal_places=4, null=True, blank=True)
    price_usd = models.DecimalField(max_digits=28, decimal_places=12, null=True, blank=True)
    quality_score_low = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    quality_score_high = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    quality_status = models.CharField(max_length=24, default="NOT_SCORED")
    entry_score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    entry_status = models.CharField(max_length=24, default="NOT_SCORED")
    opportunity_score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    opportunity_status = models.CharField(max_length=24, default="NOT_SCORED")
    action = models.CharField(max_length=40, default="WATCH_ONLY")
    risk_codes = models.JSONField(default=list)
    details = models.JSONField(default=dict)

    class Meta:
        ordering = ["rank", "-market_cap_usd"]
        indexes = [models.Index(fields=["scan_run", "stage"]), models.Index(fields=["symbol"])]

class Notification(models.Model):
    LEVEL_INFO = "INFO"
    LEVEL_SUCCESS = "SUCCESS"
    LEVEL_WARNING = "WARNING"
    LEVEL_ERROR = "ERROR"
    level = models.CharField(max_length=16, default=LEVEL_INFO)
    title = models.CharField(max_length=180)
    message = models.TextField(blank=True)
    scan_run = models.ForeignKey(ScanRun, null=True, blank=True, on_delete=models.CASCADE, related_name="notifications")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
